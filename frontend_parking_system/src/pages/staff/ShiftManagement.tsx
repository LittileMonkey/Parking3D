import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { RotateCcw, PlayCircle, Send, CheckCircle2, Clock, AlertTriangle, UserCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import { api, ApiError, request, type ShiftHandoverDto } from "../../services/api";
import { operations } from "../../services/operations";

type Shift = { id: string; lotId: string; staffUserId: string; startedAt: string };
interface RosterMember { staffUserId: string; name: string; roleCode?: string }

export default function ShiftManagement() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandoverDto[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [historyFilter, setHistoryFilter] = useState<"All" | "PendingConfirmation" | "Confirmed" | "Cancelled">("All");
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
    const isManager = Boolean(user?.roles?.some(r => r === "PARKING_MANAGER" || r === "ADMIN") || user?.role === "PARKING_MANAGER" || user?.role === "ADMIN");
    const rosterPromise = isManager
      ? request<RosterMember[]>(`/api/v1/staff-assignments?lotId=${encodeURIComponent(selectedLotId)}`).catch(() => [] as RosterMember[])
      : Promise.resolve([] as RosterMember[]);

    Promise.all([
      operations.shifts(selectedLotId),
      api.getShiftHandovers(selectedLotId, historyFilter === "All" ? undefined : historyFilter),
      rosterPromise,
    ])
      .then(async ([active, list, roster]) => {
        const details = await Promise.all(
          list.items.map((item) => api.getShiftHandoverById(selectedLotId, item.handoverId))
        );
        if (current) {
          const map: Record<string, string> = {};
          if (user?.userId) {
            map[user.userId] = user.fullName || user.email || user.userName || "Bạn";
          }
          for (const member of roster) {
            if (member.staffUserId && member.name) map[member.staffUserId] = member.name;
          }
          setStaffNames(map);
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
  }, [selectedLotId, revision, historyFilter, user?.userId]);

  const formatStaffLabel = (staffId: string) => {
    if (staffNames[staffId]) return staffNames[staffId];
    if (user?.userId === staffId) return user.fullName || user.email || "Bạn";
    return `Nhân viên #${staffId.slice(0, 8)}`;
  };

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
    <div className="staff-shift-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Shift Status & Action Bar */}
      <div
        className="staff-shift-status"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          borderRadius: 16,
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            className="staff-shift-status-icon"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: mine ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
              color: mine ? "#34d399" : "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div className="staff-shift-status-title" style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
              {mine ? "Bạn đang trong ca trực hoạt động" : "Bạn chưa bắt đầu ca trực tại bãi này"}
            </div>
            <div className="staff-shift-status-description" style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>
              {mine
                ? `Bắt đầu lúc: ${new Date(mine.startedAt).toLocaleString("vi-VN")}`
                : "Bấm 'Bắt đầu ca' để tiếp nhận quyền check-in và bàn giao ca."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="pm-btn-secondary staff-shift-secondary-button"
            disabled={busy || !selectedLotId}
            onClick={() => setRevision((value) => value + 1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={15} /> Tải lại
          </button>

          {!mine && (
            <button
              type="button"
              className="staff-shift-primary-button"
              disabled={busy || !selectedLotId}
              onClick={() => void startMyShift()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 18px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                border: "none",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
              }}
            >
              <PlayCircle size={16} /> Bắt đầu ca trực
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="staff-shift-error"
          style={{
            background: "rgba(239, 68, 68, 0.18)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 12,
            padding: "12px 16px",
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {notice && (
        <div
          className="staff-shift-notice"
          style={{
            background: "rgba(16, 185, 129, 0.18)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: 12,
            padding: "12px 16px",
            color: "#86efac",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Main Shift Handover Form Card */}
      <div
        className="staff-shift-form-card"
        style={{
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 20,
          padding: "24px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div className="staff-shift-form-heading" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 12 }}>
          <h2 className="staff-shift-form-title" style={{ fontSize: 17, fontWeight: 700, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <UserCheck size={19} color="#38bdf8" /> Tạo biên bản bàn giao ca trực mới
          </h2>
          <p className="staff-shift-form-description" style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.6)", margin: "4px 0 0 0" }}>
            Người nhận ca phải đang trong ca trực tại cùng bãi đỗ. Ca của bạn chỉ kết thúc khi nhân viên nhận xác nhận biên bản.
          </p>
        </div>

        <form onSubmit={submit}>
          <fieldset
            disabled={busy || !mine}
            style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)", marginBottom: 6 }}>
                Nhân viên nhận ca trực *
              </label>
              <select
                required
                className="pm-form-select"
                style={{
                  width: "100%",
                  height: 44,
                  background: "rgba(10, 15, 26, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: 10,
                  color: "#ffffff",
                  padding: "0 14px",
                  fontSize: 13.5,
                  outline: "none",
                }}
                value={receiver}
                onChange={(e) => {
                  setReceiver(e.target.value);
                  renewCreateHandoverKey();
                }}
              >
                <option value="">-- Chọn nhân viên nhận đang mở ca --</option>
                {shifts
                  .filter((shift) => shift.staffUserId !== user?.userId)
                  .map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {formatStaffLabel(shift.staffUserId)} · Bắt đầu {new Date(shift.startedAt).toLocaleString("vi-VN")}
                    </option>
                  ))}
              </select>
            </div>

            <div className="staff-shift-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
              {(
                [
                  ["completedTasks", "Công việc đã hoàn thành trong ca"],
                  ["unresolvedIssues", "Sự cố / Xe tồn chưa xử lý"],
                  ["pendingTransactions", "Giao dịch tiền mặt / Chờ xác nhận"],
                  ["equipmentStatus", "Tình trạng Barrier, Camera & Thiết bị"],
                  ["notesForNext", "Lưu ý quan trọng cho ca tiếp theo"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="staff-shift-form-field" style={{ gridColumn: field === "notesForNext" ? "1 / -1" : "auto" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)", marginBottom: 6 }}>
                    {label} *
                  </label>
                  <textarea
                    className="staff-shift-input"
                    required
                    maxLength={2000}
                    rows={field === "notesForNext" ? 3 : 2}
                    style={{
                      width: "100%",
                      background: "rgba(10, 15, 26, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: 10,
                      color: "#ffffff",
                      padding: "10px 14px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      outline: "none",
                      resize: "vertical",
                    }}
                    value={form[field]}
                    placeholder={`Ghi nhận cụ thể ${label.toLowerCase()}...`}
                    onChange={(e) => {
                      setForm({ ...form, [field]: e.target.value });
                      renewCreateHandoverKey();
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="staff-shift-primary-button"
              disabled={busy || !mine || !receiver}
              style={{
                alignSelf: "flex-end",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 24px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)",
                border: "none",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: busy || !mine || !receiver ? "not-allowed" : "pointer",
                opacity: busy || !mine || !receiver ? 0.6 : 1,
                boxShadow: "0 6px 20px rgba(6, 182, 212, 0.35)",
                marginTop: 6,
              }}
            >
              <Send size={16} /> Gửi biên bản bàn giao
            </button>
          </fieldset>
        </form>
      </div>

      {/* Handover History List */}
      <div>
        <div className="staff-shift-history-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", margin: 0 }}>
            Lịch sử &amp; Biên bản bàn giao liên quan ({handovers.length})
          </h2>
          <select
            className="pm-form-select"
            style={{
              width: "auto",
              height: 38,
              background: "rgba(10, 15, 26, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 8,
              color: "#ffffff",
              padding: "0 12px",
              fontSize: 13,
            }}
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value as typeof historyFilter)}
            aria-label="Lọc lịch sử bàn giao"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="PendingConfirmation">Chờ xác nhận</option>
            <option value="Confirmed">Đã xác nhận hoàn tất</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
        </div>

        {handovers.length === 0 ? (
          <div
            className="staff-shift-empty"
            style={{
              padding: "32px 20px",
              textAlign: "center",
              borderRadius: 14,
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px dashed rgba(255, 255, 255, 0.15)",
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: 13.5,
            }}
          >
            Chưa có biên bản bàn giao nào cho bộ lọc hiện tại.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {handovers.map((item) => {
              const isPending = item.status === "PendingConfirmation";
              const isReceiverMe = item.receiverUserId === user?.userId;

              return (
                <div
                  key={item.handoverId}
                  className="staff-shift-handover-card"
                  style={{
                    background: "rgba(15, 23, 42, 0.7)",
                    backdropFilter: "blur(16px)",
                    border: isPending && isReceiverMe ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 16,
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        className={`staff-shift-status-badge ${item.status === "Confirmed" ? "is-confirmed" : item.status === "Cancelled" ? "is-cancelled" : "is-pending"}`}
                        style={{
                          padding: "3px 10px",
                          borderRadius: "9999px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          background:
                            item.status === "Confirmed"
                              ? "rgba(16, 185, 129, 0.2)"
                              : item.status === "Cancelled"
                              ? "rgba(239, 68, 68, 0.2)"
                              : "rgba(245, 158, 11, 0.2)",
                          color:
                            item.status === "Confirmed"
                              ? "#34d399"
                              : item.status === "Cancelled"
                              ? "#fca5a5"
                              : "#fbbf24",
                        }}
                      >
                        {item.status === "PendingConfirmation"
                          ? "Chờ xác nhận"
                          : item.status === "Confirmed"
                          ? "Đã xác nhận"
                          : "Đã hủy"}
                      </span>
                      <span className="staff-shift-timestamp" style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>
                        Tạo lúc: {new Date(item.createdAt).toLocaleString("vi-VN")} · Phiên bản v{item.version}
                      </span>
                    </div>

                    {isReceiverMe && isPending && (
                      <button
                        type="button"
                        className="staff-shift-primary-button"
                        disabled={busy}
                        onClick={() => void confirmHandover(item)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 16px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          border: "none",
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
                        }}
                      >
                        <CheckCircle2 size={15} /> Xác nhận nhận ca
                      </button>
                    )}
                  </div>

                  <div className="staff-shift-participants" style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div>
                      Người giao: <strong style={{ color: "#ffffff" }}>{formatStaffLabel(item.senderUserId)}</strong>
                    </div>
                    <div>
                      Người nhận: <strong style={{ color: "#ffffff" }}>{formatStaffLabel(item.receiverUserId)}</strong>
                    </div>
                    {item.confirmedAt && (
                      <div>
                        Xác nhận lúc: <span style={{ color: "#86efac" }}>{new Date(item.confirmedAt).toLocaleString("vi-VN")}</span>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                      gap: 10,
                      background: "rgba(0, 0, 0, 0.25)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: 12.5,
                      color: "rgba(255, 255, 255, 0.75)",
                    }}
                    className="staff-shift-handover-details"
                  >
                    <div><strong style={{ color: "#ffffff" }}>Đã làm:</strong> {item.completedTasks}</div>
                    <div><strong style={{ color: "#ffffff" }}>Chưa xử lý:</strong> {item.unresolvedIssues}</div>
                    <div><strong style={{ color: "#ffffff" }}>Giao dịch chờ:</strong> {item.pendingTransactions}</div>
                    <div><strong style={{ color: "#ffffff" }}>Thiết bị:</strong> {item.equipmentStatus}</div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <strong style={{ color: "#ffffff" }}>Lưu ý ca sau:</strong> {item.notesForNext}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
