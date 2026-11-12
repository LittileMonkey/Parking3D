import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError, request, type ShiftHandoverSummaryDto } from "../../services/api";
import { operations } from "../../services/operations";

interface RosterAssignment {
  assignmentId: string;
  staffUserId: string;
  name: string;
  roleCode: string;
  validFrom: string;
  validUntil?: string | null;
}

interface ShiftItem {
  id: string;
  lotId: string;
  staffUserId: string;
  startedAt: string;
}

export default function StaffShiftsPage() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const [staff, setStaff] = useState<RosterAssignment[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandoverSummaryDto[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [validUntil, setValidUntil] = useState("");

  // Reassign receiver state (SCRUM-112 / SCRUM-114)
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [newReceiverId, setNewReceiverId] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  useEffect(() => {
    let current = true;
    setStaff([]);
    setShifts([]);
    setHandovers([]);
    setError("");
    if (!selectedLotId || selectedLotId === "all") return;
    Promise.all([
      request<RosterAssignment[]>(`/api/v1/staff-assignments?lotId=${encodeURIComponent(selectedLotId)}`),
      operations.shifts(selectedLotId),
      api.getShiftHandovers(selectedLotId),
    ])
      .then(([roster, active, transfers]) => {
        if (current) {
          setStaff(roster);
          setShifts(active);
          setHandovers(transfers.items);
        }
      })
      .catch((err) => {
        if (current) setError(err instanceof Error ? err.message : "Không tải được dữ liệu nhân sự.");
      });
    return () => {
      current = false;
    };
  }, [selectedLotId, revision]);

  async function mutate(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice("Đã lưu thay đổi.");
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được phân công.");
    } finally {
      setBusy(false);
    }
  }

  function assign(event: React.FormEvent) {
    event.preventDefault();
    mutate(() =>
      api.assignStaffToLot({
        staffUserId: userId,
        lotId: selectedLotId,
        roleCode: "PARKING_STAFF",
        validFrom: new Date().toISOString(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      })
    );
  }

  async function submitReassign(item: ShiftHandoverSummaryDto) {
    if (!newReceiverId || !reassignReason.trim()) {
      setError("Chọn nhân viên nhận ca mới và nhập lý do đổi người nhận.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.reassignShiftHandoverReceiver(selectedLotId, item.handoverId, {
        receiverUserId: newReceiverId,
        reason: reassignReason.trim(),
        expectedVersion: item.version,
      });
      setReassignId(null);
      setNewReceiverId("");
      setReassignReason("");
      setNotice("Đã chỉ định lại người nhận ca.");
      setRevision((value) => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const latest = await api.getShiftHandoverById(selectedLotId, item.handoverId);
          setHandovers((prev) => prev.map((row) => (row.handoverId === item.handoverId ? latest : row)));
          setError(
            `Xung đột phiên bản (409): Biên bản đã lên v${latest.version} (${latest.status}). Lý do & lựa chọn của bạn vẫn được giữ lại — vui lòng kiểm tra và xác nhận lại.`
          );
        } catch {
          setRevision((value) => value + 1);
          setError("Xung đột phiên bản (409). Đã tải lại danh sách bàn giao.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Không đổi được người nhận ca.");
      }
    } finally {
      setBusy(false);
    }
  }

  const name = (id: string) => staff.find((item) => item.staffUserId === id)?.name ?? id;

  return (
    <section className="pm-module-page">
      <h1>Nhân sự và ca trực</h1>
      <p>
        Chọn một bãi cụ thể. Quyền phân công/thu hồi được kiểm tra theo quyền quản lý nhân sự của bạn tại bãi; thay đổi
        vai trò toàn nền tảng thuộc Admin.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={assign}>
        <fieldset disabled={busy || !selectedLotId || selectedLotId === "all"}>
          <label>
            Mã tài khoản nhân viên do Admin cung cấp{" "}
            <input required value={userId} pattern="[0-9a-fA-F-]{36}" onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label>
            Hiệu lực đến (để trống nếu không giới hạn){" "}
            <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
          <button type="submit">Phân công nhân viên</button>
        </fieldset>
      </form>
      <table>
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Vai trò</th>
            <th>Từ</th>
            <th>Đến</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((item) => (
            <tr key={item.assignmentId}>
              <td>{item.name}</td>
              <td>{item.roleCode}</td>
              <td>{new Date(item.validFrom).toLocaleString("vi-VN")}</td>
              <td>{item.validUntil ? new Date(item.validUntil).toLocaleString("vi-VN") : "Không giới hạn"}</td>
              <td>
                <button disabled={busy} onClick={() => mutate(() => api.revokeStaffAssignment(item.assignmentId))}>
                  Thu hồi phân công
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Ca đang mở</h2>
      {shifts.map((shift) => (
        <p key={shift.id}>
          {name(shift.staffUserId)} · Bắt đầu {new Date(shift.startedAt).toLocaleString("vi-VN")}
        </p>
      ))}
      <h2>Bàn giao gần đây</h2>
      {handovers.map((item) => (
        <div key={item.handoverId} style={{ marginBottom: 10 }}>
          <p>
            {name(item.senderUserId)} → {name(item.receiverUserId)} · {item.status} · v{item.version}
            {item.status === "PendingConfirmation" && (
              <button
                type="button"
                disabled={busy}
                style={{ marginLeft: 10 }}
                onClick={() => {
                  setReassignId(item.handoverId);
                  setNewReceiverId("");
                  setReassignReason("");
                }}
              >
                Đổi người nhận
              </button>
            )}
          </p>
          {reassignId === item.handoverId && (
            <div className="pm-glass-card" style={{ display: "grid", gap: 8, marginTop: 6 }}>
              <label>
                Người nhận mới (thuộc bãi đang chọn)
                <select value={newReceiverId} onChange={(e) => setNewReceiverId(e.target.value)}>
                  <option value="">Chọn nhân viên</option>
                  {staff
                    .filter((s) => s.staffUserId !== item.senderUserId && s.staffUserId !== item.receiverUserId)
                    .map((s) => (
                      <option key={s.assignmentId} value={s.staffUserId}>
                        {s.name} ({s.roleCode})
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Lý do đổi người nhận
                <input
                  value={reassignReason}
                  maxLength={500}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Ví dụ: Nhân viên nhận ca xin nghỉ đột xuất"
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => void submitReassign(item)}>
                  Xác nhận đổi
                </button>
                <button type="button" disabled={busy} onClick={() => setReassignId(null)}>
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
