import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import { api, ApiError, type ShiftHandoverDto } from "../../services/api";
import { operations } from "../../services/operations";

type Shift = { id: string; lotId: string; staffUserId: string; startedAt: string };

export default function ShiftManagement() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandoverDto[]>([]);
  const [receiver, setReceiver] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    completedTasks: "",
    unresolvedIssues: "",
    pendingTransactions: "",
    equipmentStatus: "",
    notesForNext: "",
  });
  const mine = shifts.find((shift) => shift.staffUserId === user?.userId);
  const [revision, setRevision] = useState(0);
  const { key: createHandoverKey, renewKey: renewCreateHandoverKey } = useIdempotencyKey("handover");
  const confirmKeysRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let current = true;
    setShifts([]);
    setHandovers([]);
    setReceiver("");
    setError("");
    if (!selectedLotId) return;
    Promise.all([operations.shifts(selectedLotId), api.getShiftHandovers(selectedLotId)])
      .then(async ([active, list]) => {
        const details = await Promise.all(
          list.items.map((item) => api.getShiftHandoverById(selectedLotId, item.handoverId))
        );
        if (current) {
          setShifts(active);
          setHandovers(details);
        }
      })
      .catch((err) => {
        if (current) setError(err instanceof Error ? err.message : "Không tải được dữ liệu ca trực.");
      });
    return () => {
      current = false;
    };
  }, [selectedLotId, revision]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const next = shifts.find((shift) => shift.id === receiver);
    if (!mine || !next) {
      setError("Cả người giao và nhận phải bắt đầu ca tại bãi này.");
      return;
    }
    if (next.staffUserId === user?.userId) {
      setError("Người nhận ca phải khác người giao ca.");
      return;
    }
    if (mine.lotId !== selectedLotId || next.lotId !== selectedLotId) {
      setError("Ca giao và ca nhận phải thuộc cùng bãi đang chọn.");
      return;
    }
    setBusy(true);
    try {
      await api.createShiftHandover(
        selectedLotId,
        {
          ...form,
          senderShiftId: mine.id,
          receiverShiftId: next.id,
          receiverUserId: next.staffUserId,
        },
        createHandoverKey
      );
      setForm({
        completedTasks: "",
        unresolvedIssues: "",
        pendingTransactions: "",
        equipmentStatus: "",
        notesForNext: "",
      });
      setReceiver("");
      renewCreateHandoverKey();
      setNotice("Đã gửi biên bản bàn giao ca.");
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được bàn giao.");
    } finally {
      setBusy(false);
    }
  }

  async function startMyShift() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operations.startShift(selectedLotId);
      setNotice("Đã mở ca trực mới.");
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được ca trực.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmHandover(item: ShiftHandoverDto) {
    setBusy(true);
    setError("");
    setNotice("");
    const cacheKey = `${item.handoverId}:${item.version}`;
    if (!confirmKeysRef.current[cacheKey]) {
      confirmKeysRef.current[cacheKey] = crypto.randomUUID();
    }
    try {
      await api.confirmShiftHandover(
        selectedLotId,
        item.handoverId,
        { expectedVersion: item.version },
        confirmKeysRef.current[cacheKey]
      );
      setNotice("Đã xác nhận nhận ca trực.");
      setRevision((value) => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const latest = await api.getShiftHandoverById(selectedLotId, item.handoverId);
          setHandovers((prev) => prev.map((row) => (row.handoverId === item.handoverId ? latest : row)));
          setError(
            `Xung đột phiên bản (409): Biên bản đã cập nhật lên v${latest.version} (${latest.status}). Vui lòng kiểm tra và xác nhận lại.`
          );
        } catch {
          setRevision((value) => value + 1);
          setError("Xung đột phiên bản (409). Đã tải lại danh sách biên bản.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Không xác nhận được bàn giao.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pm-module-page">
      <h1>Ca trực và bàn giao</h1>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy || !selectedLotId} onClick={() => setRevision((value) => value + 1)}>
        Tải lại
      </button>
      {mine ? (
        <p>Ca của bạn bắt đầu: {new Date(mine.startedAt).toLocaleString("vi-VN")}</p>
      ) : (
        <button disabled={busy || !selectedLotId} onClick={() => void startMyShift()}>
          Bắt đầu ca
        </button>
      )}
      <p>Người nhận phải đăng nhập và bắt đầu ca tại cùng bãi. Ca gửi chỉ kết thúc khi người nhận xác nhận biên bản.</p>
      <form className="pm-glass-card" onSubmit={submit}>
        <fieldset disabled={busy || !mine} style={{ display: "grid", gap: 12 }}>
          <label>
            Nhân viên nhận ca{" "}
            <select
              required
              value={receiver}
              onChange={(e) => {
                setReceiver(e.target.value);
                renewCreateHandoverKey();
              }}
            >
              <option value="">Chọn nhân viên đang có ca</option>
              {shifts
                .filter((shift) => shift.staffUserId !== user?.userId)
                .map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.staffUserId} · {new Date(shift.startedAt).toLocaleString("vi-VN")}
                  </option>
                ))}
            </select>
          </label>
          {(
            [
              ["completedTasks", "Công việc đã hoàn thành"],
              ["unresolvedIssues", "Sự cố chưa xử lý"],
              ["pendingTransactions", "Giao dịch còn chờ"],
              ["equipmentStatus", "Tình trạng thiết bị"],
              ["notesForNext", "Lưu ý cho ca sau"],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <textarea
                required
                maxLength={2000}
                value={form[field]}
                onChange={(e) => {
                  setForm({ ...form, [field]: e.target.value });
                  renewCreateHandoverKey();
                }}
              />
            </label>
          ))}
          <button type="submit">Gửi biên bản bàn giao</button>
        </fieldset>
      </form>
      <h2>Biên bản liên quan đến bạn</h2>
      {handovers.map((item) => (
        <article className="pm-glass-card" key={item.handoverId}>
          <p>
            {new Date(item.createdAt).toLocaleString("vi-VN")} · {item.status} · v{item.version}
          </p>
          <p>
            Người giao: {item.senderUserId} · Người nhận: {item.receiverUserId}
          </p>
          <p>Đã làm: {item.completedTasks}</p>
          <p>Chưa xử lý: {item.unresolvedIssues}</p>
          <p>Giao dịch chờ: {item.pendingTransactions}</p>
          <p>Thiết bị: {item.equipmentStatus}</p>
          <p>Lưu ý: {item.notesForNext}</p>
          {item.receiverUserId === user?.userId && item.status === "PendingConfirmation" && (
            <button disabled={busy} onClick={() => void confirmHandover(item)}>
              Đã đọc và xác nhận nhận ca
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
