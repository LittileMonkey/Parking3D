import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  UserCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
} from "lucide-react";
import { api, type ParkingLot, type AccountUserDto, type StaffAssignmentItem } from "../../services/api";

interface AdminOutletContext {
  refreshKey: number;
  onTriggerRefresh: () => void;
}

export default function AdminStaffAssignmentsPage() {
  const { refreshKey, onTriggerRefresh } = useOutletContext<AdminOutletContext>();

  const [facilities, setFacilities] = useState<ParkingLot[]>([]);
  const [accounts, setAccounts] = useState<AccountUserDto[]>([]);
  const [myAssignments, setMyAssignments] = useState<StaffAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [roleCode, setRoleCode] = useState<"PARKING_STAFF" | "PARKING_MANAGER">("PARKING_STAFF");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [facs, accs, assigns] = await Promise.all([
          api.getParkingLots(),
          api.getAllAccounts(),
          api.getStaffAssignmentsMe().catch(() => []),
        ]);
        if (!mounted) return;
        setFacilities(facs || []);
        setAccounts(accs || []);
        setMyAssignments(assigns || []);
        if (facs.length > 0) setSelectedLotId(facs[0].id);
        const staffCandidates = accs.filter((a) =>
          a.roles?.some((r) => r.toUpperCase().includes("STAFF") || r.toUpperCase().includes("MANAGER"))
        );
        if (staffCandidates.length > 0) setSelectedUserId(staffCandidates[0].id);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Không tải được dữ liệu phân công nhân sự.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [refreshKey]);

  const handleAssign = async () => {
    if (!selectedUserId || !selectedLotId) return;
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await api.assignStaffToLot({
        staffUserId: selectedUserId,
        lotId: selectedLotId,
        roleCode,
        validFrom: new Date().toISOString(),
      });
      setActionMessage({ type: "success", text: "Đã phân bổ nhân sự thành công!" });
      setTimeout(() => {
        setIsModalOpen(false);
        onTriggerRefresh();
      }, 1000);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Phân bổ nhân sự thất bại.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (assignmentId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn thu hồi phân quyền bãi này của nhân viên?")) return;
    try {
      await api.revokeStaffAssignment(assignmentId);
      onTriggerRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Thu hồi quyền thất bại.");
    }
  };

  const staffUsers = accounts.filter((a) =>
    a.roles?.some((r) => r.toUpperCase().includes("STAFF") || r.toUpperCase().includes("MANAGER") || r.toUpperCase().includes("ADMIN"))
  );

  return (
    <div>
      <div className="adm-card">
        <div className="adm-card-header">
          <div className="adm-card-title-group">
            <h2 className="adm-card-title">
              <UserCheck size={20} color="#4338ca" />
              Phân Bổ Nhân Sự Cơ Sở (Facility-Scoped RBAC Staffing)
            </h2>
            <p className="adm-card-desc">
              Chỉ định nhân viên trực bãi (PARKING_STAFF) và Quản lý cơ sở (PARKING_MANAGER) vào từng bãi đỗ xe cụ thể. Tuân thủ nguyên tắc giới hạn quyền theo cơ sở của dự án.
            </p>
          </div>
          <button
            onClick={() => {
              setIsModalOpen(true);
              setActionMessage(null);
            }}
            className="adm-btn-primary"
          >
            <Plus size={16} />
            <span>Thêm Phân Bổ Mới</span>
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#b91c1c", borderRadius: "10px", fontSize: "0.85rem", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {/* Existing Assignments Table */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Cơ Sở Bãi Đỗ Xe</th>
                <th>Mã Phân Bổ (Assignment ID)</th>
                <th>Vai Trò Phân Bổ</th>
                <th>Thời Hạn Hiệu Lực</th>
                <th>Quyền Quản Trị</th>
                <th style={{ textAlign: "right" }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {myAssignments.map((item) => {
                const lot = facilities.find((f) => f.id === item.lotId);
                return (
                  <tr key={item.assignmentId}>
                    <td>
                      <div>
                        <strong>{lot?.name || item.lotId}</strong>
                        {lot?.code && (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-muted)" }}>
                            Mã bãi: {lot.code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "var(--adm-muted)" }}>
                        {item.assignmentId}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`adm-role-badge ${
                          item.roleCode === "PARKING_MANAGER" ? "adm-role-manager" : "adm-role-staff"
                        }`}
                      >
                        {item.roleCode}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.82rem", color: "var(--adm-muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Calendar size={13} />
                        <span>Từ: {item.validFrom ? new Date(item.validFrom).toLocaleDateString("vi-VN") : "Hiện tại"}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: item.canManageStaffAssignments ? "#15803d" : "var(--adm-muted)" }}>
                        {item.canManageStaffAssignments ? "Có quyền quản lý" : "Chỉ vận hành"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleRevoke(item.assignmentId)}
                        className="adm-btn-revoke"
                        title="Thu hồi quyền phân công nhân viên trên bãi này"
                      >
                        <Trash2 size={13} />
                        <span>Thu hồi</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {myAssignments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--adm-muted)" }}>
                    Chưa có danh sách phân bổ nào được lưu lại hoặc bạn chưa được gán quyền bãi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Assignment Modal ── */}
      {isModalOpen && (
        <div className="adm-modal-backdrop" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">Phân Bổ Nhân Sự Vào Bãi Đỗ Xe</h3>
              <button
                className="adm-modal-close"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="adm-modal-body">
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                  Chọn nhân sự cần phân công:
                </label>
                <select
                  className="adm-select"
                  style={{ width: "100%", marginTop: "6px" }}
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isSubmitting}
                >
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.emailNormalized}) — Vai trò: {u.roles?.join(", ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                  Chọn cơ sở bãi đỗ xe:
                </label>
                <select
                  className="adm-select"
                  style={{ width: "100%", marginTop: "6px" }}
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  disabled={isSubmitting}
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.code}] {f.name} — {f.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                  Vai trò tại bãi đỗ (Facility Role):
                </label>
                <select
                  className="adm-select"
                  style={{ width: "100%", marginTop: "6px" }}
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value as "PARKING_STAFF" | "PARKING_MANAGER")}
                  disabled={isSubmitting}
                >
                  <option value="PARKING_STAFF">PARKING_STAFF — Nhân viên trực cổng, soát vé và thu tiền</option>
                  <option value="PARKING_MANAGER">PARKING_MANAGER — Quản lý bãi, giám sát ô đỗ và phân ca</option>
                </select>
              </div>

              {actionMessage && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: actionMessage.type === "success" ? "#dcfce7" : "#fee2e2",
                    color: actionMessage.type === "success" ? "#15803d" : "#b91c1c",
                  }}
                >
                  {actionMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{actionMessage.text}</span>
                </div>
              )}
            </div>

            <div className="adm-modal-footer">
              <button
                type="button"
                className="adm-btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="adm-btn-primary"
                onClick={handleAssign}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang xử lý..." : "Xác nhận phân công"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
