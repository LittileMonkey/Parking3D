import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Users,
  Clock,
  ArrowRightLeft,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { api, request, type ShiftHandoverSummaryDto } from "../../services/api";
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

interface OutletContextType {
  selectedLotId: string;
  refreshKey?: number;
}

export default function StaffShiftsPage() {
  const { selectedLotId, refreshKey } = useOutletContext<OutletContextType>();
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
  }, [selectedLotId, revision, refreshKey]);

  async function mutate(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice("Thao tác thành công! Danh sách đã được cập nhật.");
      setRevision((value) => value + 1);
      setTimeout(() => setNotice(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác không thành công.");
    } finally {
      setBusy(false);
    }
  }

  function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!userId.trim()) {
      setError("Vui lòng nhập hoặc chọn một tài khoản nhân viên (UUID) từ danh sách gợi ý.");
      return;
    }
    mutate(async () => {
      await api.assignStaffToLot({
        staffUserId: userId.trim(),
        lotId: selectedLotId,
        roleCode: "PARKING_STAFF",
        validFrom: new Date().toISOString(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      });
      setUserId("");
      setValidUntil("");
    });
  }

  async function submitReassign(item: ShiftHandoverSummaryDto) {
    if (!newReceiverId || !reassignReason.trim()) {
      setError("Vui lòng chọn nhân viên nhận ca mới và nhập lý do đổi người nhận.");
      return;
    }
    const opKey = `${item.handoverId}:${item.version}:${newReceiverId}:${reassignReason.trim()}`;
    setBusy(true);
    setError("");
    try {
      await api.reassignShiftHandoverReceiver(
        selectedLotId,
        item.handoverId,
        {
          receiverUserId: newReceiverId,
          reason: reassignReason.trim(),
          expectedVersion: item.version,
        },
        opKey
      );
      setNotice(`Đã đổi người nhận bàn giao ca thành công sang nhân viên mới.`);
      setReassignId(null);
      setRevision((v) => v + 1);
      setTimeout(() => setNotice(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi người nhận ca.");
    } finally {
      setBusy(false);
    }
  }

  const getStaffName = (id: string) => staff.find((item) => item.staffUserId === id)?.name ?? id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* ── 1. Header Banner & Context ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="pm-card-title-group">
            <div className="pm-card-icon">
              <Users size={18} />
            </div>
            <div>
              <h3 className="pm-card-h3">Quản Lý Nhân Sự & Ca Trực Bãi Xe</h3>
              <span className="pm-card-sub">
                Phân công nhân viên trực ca theo cơ sở (Facility-Scoped RBAC), theo dõi ca trực mở và xử lý biên bản bàn giao
              </span>
            </div>
          </div>
        </div>

        {(!selectedLotId || selectedLotId === "all") && (
          <div
            style={{
              padding: "12px 16px",
              background: "#edf7fd",
              border: "1px solid rgba(13, 70, 133, 0.2)",
              borderRadius: 12,
              color: "var(--pm-blue)",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>Vui lòng chọn một cơ sở bãi xe cụ thể ở thanh công cụ phía trên để xem và phân công nhân sự.</span>
          </div>
        )}

        {notice && (
          <div
            style={{
              padding: "12px 16px",
              background: "#d1fae5",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 12,
              color: "#065f46",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            role="status"
          >
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fee2e2",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 12,
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            role="alert"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── 2. Split Row: Phân Công Nhân Viên (Left) + Ca Đang Mở (Right) ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
          {/* Left: Phân Công Nhân Viên Form */}
          <div className="pm-card">
            <div className="pm-card-header">
              <div className="pm-card-title-group">
                <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="pm-card-h3">Phân Công Nhân Viên Mới Vào Bãi</h3>
                  <span className="pm-card-sub">Cấp quyền vận hành barie và lập biên bản trực cho nhân sự</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAssign} noValidate>
              <fieldset disabled={busy || !selectedLotId || selectedLotId === "all"} style={{ border: "none", padding: 0 }}>
                <div className="pm-form-group">
                  <label className="pm-label" htmlFor="staff-user-id">
                    Mã tài khoản nhân viên (UUID do Admin cung cấp):
                  </label>
                  <input
                    id="staff-user-id"
                    type="text"
                    className="pm-input-text"
                    required
                    placeholder="VD: 22222222-2222-2222-2222-222222222222"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--pm-muted)", fontWeight: 600 }}>Tài khoản gợi ý:</span>
                    {[
                      { label: "Nhân viên ca A", id: "22222222-2222-2222-2222-222222222222" },
                      { label: "Nhân viên ca B", id: "33333333-3333-3333-3333-333333333333" },
                      { label: "Nhân viên hỗ trợ", id: "44444444-4444-4444-4444-444444444444" },
                    ].map((demoStaff) => (
                      <button
                        key={demoStaff.id}
                        type="button"
                        onClick={() => setUserId(demoStaff.id)}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "#edf7fd",
                          border: "1px solid rgba(13, 70, 133, 0.2)",
                          color: "var(--pm-blue)",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                        title={`Nhấp để điền UUID: ${demoStaff.id}`}
                      >
                        + {demoStaff.label}
                      </button>
                    ))}
                  </div>
                  <small style={{ fontSize: 11.5, color: "var(--pm-muted)", display: "block", marginTop: 4 }}>
                    Định dạng chuẩn UUID v4 bao gồm 32 ký tự hex và 4 dấu gạch ngang
                  </small>
                </div>

                <div className="pm-form-group">
                  <label className="pm-label" htmlFor="staff-valid-until">
                    Hiệu lực đến (để trống nếu không giới hạn thời gian):
                  </label>
                  <input
                    id="staff-valid-until"
                    type="datetime-local"
                    className="pm-input-date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button type="submit" className="pm-btn pm-btn-primary" disabled={busy} style={{ minWidth: 180 }}>
                    {busy ? (
                      <>
                        <RefreshCw size={15} className="spin-animation" />
                        <span>Đang lưu…</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={15} />
                        <span>Phân Công Nhân Viên</span>
                      </>
                    )}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>

          {/* Right: Ca Trực Đang Mở */}
          <div className="pm-card">
            <div className="pm-card-header">
              <div className="pm-card-title-group">
                <div className="pm-card-icon" style={{ background: "#d1fae5", color: "#065f46" }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="pm-card-h3">Ca Trực Đang Hoạt Động ({shifts.length})</h3>
                  <span className="pm-card-sub">Nhân viên đang có mặt trực tiếp tại bãi đỗ</span>
                </div>
              </div>
            </div>

            {shifts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--pm-muted)" }}>
                <Clock size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Hiện không có ca trực nào đang mở</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Nhân viên sẽ mở ca trực khi bắt đầu làm việc tại cổng.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    style={{
                      padding: "14px 16px",
                      background: "#f8fafc",
                      borderRadius: 14,
                      border: "1px solid var(--pm-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#d1fae5",
                          color: "#065f46",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {getStaffName(shift.staffUserId).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pm-navy)" }}>
                          {getStaffName(shift.staffUserId)}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--pm-muted)" }}>
                          Bắt đầu: {new Date(shift.startedAt).toLocaleString("vi-VN")}
                        </div>
                      </div>
                    </div>
                    <span className="pm-badge success">
                      <span className="pm-live-dot" /> Đang trực
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Danh Sách Nhân Sự Được Phân Công Tại Bãi ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon">
                <Users size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">Danh Sách Nhân Sự Được Phân Công ({staff.length} nhân viên)</h3>
                <span className="pm-card-sub">Nhân sự có quyền đăng nhập Staff Portal và điều khiển bãi đỗ này</span>
              </div>
            </div>
          </div>

          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Nhân Viên</th>
                  <th>Vai Trò Phân Công</th>
                  <th>Hiệu Lực Từ</th>
                  <th>Hiệu Lực Đến</th>
                  <th style={{ textAlign: "right" }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px 20px", color: "var(--pm-muted)" }}>
                      Chưa có nhân viên nào được phân công tại bãi này.
                    </td>
                  </tr>
                ) : (
                  staff.map((item) => (
                    <tr key={item.assignmentId}>
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--pm-navy)" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "var(--pm-muted)", fontFamily: "monospace" }}>
                          {item.staffUserId}
                        </div>
                      </td>
                      <td>
                        <span className="pm-badge info">{item.roleCode}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{new Date(item.validFrom).toLocaleString("vi-VN")}</td>
                      <td style={{ color: item.validUntil ? "var(--pm-navy)" : "var(--pm-muted)" }}>
                        {item.validUntil ? new Date(item.validUntil).toLocaleString("vi-VN") : "Không thời hạn"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="pm-btn pm-btn-secondary"
                          disabled={busy}
                          style={{ height: 32, padding: "0 12px", fontSize: 12, color: "var(--pm-rose)" }}
                          onClick={() => mutate(() => api.revokeStaffAssignment(item.assignmentId))}
                          title="Thu hồi quyền phân công nhân viên tại bãi này"
                        >
                          <Trash2 size={13} />
                          <span>Thu Hồi</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. Lịch Sử Bàn Giao Ca & Đổi Người Nhận (SCRUM-112/114) ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                <ArrowRightLeft size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">Biên Bản Bàn Giao Ca Trực ({handovers.length} biên bản)</h3>
                <span className="pm-card-sub">
                  Kiểm soát đối soát tiền mặt, lượt xe tồn và can thiệp chỉ định người nhận ca thay thế khi cần
                </span>
              </div>
            </div>
          </div>

          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Người Giao Ca</th>
                  <th>Người Nhận Ca</th>
                  <th>Trạng Thái</th>
                  <th>Phiên Bản</th>
                  <th style={{ textAlign: "right" }}>Can Thiệp Quản Lý</th>
                </tr>
              </thead>
              <tbody>
                {handovers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px 20px", color: "var(--pm-muted)" }}>
                      Chưa có biên bản bàn giao ca nào được ghi nhận tại cơ sở này.
                    </td>
                  </tr>
                ) : (
                  handovers.map((item) => (
                    <React.Fragment key={item.handoverId}>
                      <tr>
                        <td style={{ fontWeight: 600 }}>{getStaffName(item.senderUserId)}</td>
                        <td style={{ fontWeight: 600 }}>{getStaffName(item.receiverUserId)}</td>
                        <td>
                          <span
                            className={`pm-badge ${
                              item.status === "Confirmed"
                                ? "success"
                                : item.status === "PendingConfirmation"
                                ? "warning"
                                : "info"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>v{item.version}</td>
                        <td style={{ textAlign: "right" }}>
                          {item.status === "PendingConfirmation" && (
                            <button
                              type="button"
                              className="pm-btn pm-btn-secondary"
                              disabled={busy}
                              style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                              onClick={() => {
                                setReassignId(item.handoverId);
                                setNewReceiverId("");
                                setReassignReason("");
                              }}
                            >
                              <ArrowRightLeft size={12} />
                              <span>Đổi Người Nhận</span>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Reassign Panel for Pending Handover */}
                      {reassignId === item.handoverId && (
                        <tr>
                          <td colSpan={5} style={{ background: "#edf7fd", padding: "16px 20px" }}>
                            <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pm-navy)" }}>
                                Chỉ định nhân viên nhận ca mới (SCRUM-114)
                              </div>

                              <div className="pm-form-group" style={{ marginBottom: 0 }}>
                                <label className="pm-label">Chọn nhân viên nhận ca mới thuộc bãi:</label>
                                <select
                                  className="pm-select-light"
                                  value={newReceiverId}
                                  onChange={(e) => setNewReceiverId(e.target.value)}
                                >
                                  <option value="">-- Chọn nhân viên --</option>
                                  {staff
                                    .filter(
                                      (s) =>
                                        s.staffUserId !== item.senderUserId && s.staffUserId !== item.receiverUserId
                                    )
                                    .map((s) => (
                                      <option key={s.assignmentId} value={s.staffUserId}>
                                        {s.name} ({s.roleCode})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              <div className="pm-form-group" style={{ marginBottom: 0 }}>
                                <label className="pm-label">Lý do điều chuyển nhân sự nhận ca:</label>
                                <input
                                  type="text"
                                  className="pm-input-text"
                                  placeholder="VD: Nhân viên nhận ca cũ báo ốm đột xuất, bàn giao cho nhân viên trực ca đêm."
                                  maxLength={500}
                                  value={reassignReason}
                                  onChange={(e) => setReassignReason(e.target.value)}
                                />
                              </div>

                              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="pm-btn pm-btn-primary"
                                  disabled={busy}
                                  onClick={() => void submitReassign(item)}
                                >
                                  Xác Nhận Đổi Người Nhận
                                </button>
                                <button
                                  type="button"
                                  className="pm-btn pm-btn-secondary"
                                  disabled={busy}
                                  onClick={() => setReassignId(null)}
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
