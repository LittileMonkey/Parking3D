import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Phone,
  DollarSign,
  CheckCircle2,
  FileCheck,
  Flag,
  UserPlus,
  Shield,
  X,
  Search,
} from "lucide-react";
import FacilityRbacStrip from "../../components/manager/FacilityRbacStrip";
import { managerApi } from "../../services/manager/managerApi";
import type {
  OnDutyStaff,
  CashReconciliationRecord,
} from "../../types/manager";

interface OutletContextType {
  selectedLotId: string;
}

export default function StaffShiftsPage() {
  const { selectedLotId } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<OnDutyStaff[]>([]);
  const [records, setRecords] = useState<CashReconciliationRecord[]>([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [selectedRecordToFlag, setSelectedRecordToFlag] = useState<CashReconciliationRecord | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal 1: Assign Staff to Facility State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState("PARKING_STAFF");
  const [assignValidFrom, setAssignValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [assignValidUntil, setAssignValidUntil] = useState("");
  const [allAccounts, setAllAccounts] = useState<any[]>([]);

  // Modal 2: Role Assignment State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleSearchEmail, setRoleSearchEmail] = useState("");
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [newRoleCode, setNewRoleCode] = useState("PARKING_STAFF");

  const handleOpenAssignModal = async () => {
    setIsAssignModalOpen(true);
    try {
      const accounts = await managerApi.getAllStaffAccounts();
      if (accounts) setAllAccounts(accounts);
    } catch (err) {
      console.warn("Could not load all accounts:", err);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) {
      alert("Vui lòng chọn nhân viên cần phân công.");
      return;
    }
    const lotId = selectedLotId === "all" ? "b1e2a3c4-5678-90ab-cdef-111122223333" : selectedLotId;
    setIsProcessing(true);
    try {
      const res = await managerApi.assignStaff({
        staffUserId: assignUserId,
        lotId,
        roleCode: assignRole,
        validFrom: assignValidFrom,
        validUntil: assignValidUntil || undefined,
      });
      if (res.isSuccess) {
        setActionSuccessMsg(`Phân công nhân viên vào bãi thành công!`);
        setIsAssignModalOpen(false);
        setAssignUserId("");
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert("Lỗi phân công: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchUserByEmail = async () => {
    if (!roleSearchEmail.trim()) return;
    setIsProcessing(true);
    try {
      const user = await managerApi.getAccountByEmail(roleSearchEmail.trim());
      setTargetUser(user);
    } catch (err: any) {
      alert("Không tìm thấy tài khoản với email này: " + err.message);
      setTargetUser(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setIsProcessing(true);
    try {
      const res = await managerApi.updateUserRole(targetUser.id, newRoleCode);
      if (res.isSuccess) {
        setActionSuccessMsg(`Cập nhật vai trò thành [${newRoleCode}] thành công!`);
        setIsRoleModalOpen(false);
        setTargetUser(null);
        setRoleSearchEmail("");
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert("Lỗi cập nhật vai trò: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await managerApi.getStaffShiftReconciliation(selectedLotId || "PKM-METRO-01");
        if (res.isSuccess && res.result) {
          setStaffList(res.result.onDutyStaff);
          setRecords(res.result.records);
        }
      } catch (err) {
        console.error("Load shift reconciliation error", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedLotId]);

  const handleApproveShift = async (record: CashReconciliationRecord) => {
    setIsProcessing(true);
    try {
      const res = await managerApi.approveCashShift(record.id);
      if (res.isSuccess) {
        setRecords((prev) =>
          prev.map((r) => (r.id === record.id ? res.result : r))
        );
        setActionSuccessMsg(res.message);
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Approve shift error", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordToFlag) return;
    setIsProcessing(true);
    try {
      const res = await managerApi.flagCashDiscrepancy(selectedRecordToFlag.id, flagReason);
      if (res.isSuccess) {
        setRecords((prev) =>
          prev.map((r) => (r.id === selectedRecordToFlag.id ? res.result : r))
        );
        setActionSuccessMsg(res.message);
        setSelectedRecordToFlag(null);
        setFlagReason("");
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Flag discrepancy error", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pm-module-page">
      <FacilityRbacStrip
        parkingLotId={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        facilityName="Metropolis Central Hub"
        facilityCode={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        moduleTitle="Staff & Shift Reconciliation"
        moduleDescription="Giám sát vị trí nhân sự ca trực & Đối soát bàn giao két tiền mặt quầy thu ngân (Task S2-06)"
      />

      {actionSuccessMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", borderRadius: 12, padding: "12px 18px", color: "#34d399", display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Section 1: Currently On-Shift Staff List with Gate/Booth Assignments */}
      <div className="pm-glass-card">
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <Users size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Nhân Sự Đang Trực Ca Hiện Tại</h2>
              <span className="pm-card-subtitle">Phân bổ cổng kiểm soát, làn thu phí & đội tuần tra an ninh</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleOpenAssignModal}
              style={{
                background: "linear-gradient(135deg, #087f8c 0%, #14afbe 100%)",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <UserPlus size={14} />
              <span>+ Phân công trực bãi</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(true)}
              style={{
                background: "rgba(34, 211, 238, 0.12)",
                border: "1px solid rgba(34, 211, 238, 0.3)",
                borderRadius: 8,
                padding: "8px 14px",
                color: "#22d3ee",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Shield size={14} />
              <span>Phân quyền vai trò</span>
            </button>
            <span className="pm-badge pm-badge-success">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              {staffList.filter((s) => s.status === "Active").length} Đang làm nhiệm vụ
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: "#94a3b8" }}>Đang tải danh sách nhân sự…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {staffList.map((staff) => (
              <div
                key={staff.id}
                style={{
                  background: "rgba(17, 24, 39, 0.75)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #087f8c 0%, #14afbe 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    color: "#fff",
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {staff.avatarInitials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>{staff.staffName}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{staff.staffCode}</span>
                  </div>

                  <div style={{ fontSize: 12, color: "#22d3ee", marginTop: 2, fontWeight: 600 }}>
                    {staff.assignedGate}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={11} /> Vào ca: {staff.checkInTime}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Phone size={11} /> {staff.phone}
                    </span>
                  </div>
                </div>

                <div>
                  {staff.status === "Active" ? (
                    <span className="pm-badge pm-badge-success" title="Đang trực">Hoạt động</span>
                  ) : staff.status === "HandoverPending" ? (
                    <span className="pm-badge pm-badge-warning" title="Chờ bàn giao">Chờ giao ca</span>
                  ) : (
                    <span className="pm-badge pm-badge-neutral">Nghỉ giữa ca</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Cash Reconciliation Panel */}
      <div className="pm-glass-card">
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Bảng Đối Soát Doanh Thu & Két Tiền Mặt Thu Ngân</h2>
              <span className="pm-card-subtitle">So sánh tiền mặt lý thuyết hệ thống ghi nhận vs Thực tế kiểm đếm tại quầy</span>
            </div>
          </div>
        </div>

        <div className="pm-table-wrapper">
          <table className="pm-data-table">
            <thead>
              <tr>
                <th>Mã Ca Trực</th>
                <th>Cổng / Quầy Thu Phí</th>
                <th>Thu Ngân Phụ Trách</th>
                <th>Tiền Mặt Lý Thuyết</th>
                <th>Tiền Mặt Thực Tế</th>
                <th>Chênh Lệch</th>
                <th>Thanh Toán Số (QR)</th>
                <th>Trạng Thái Đối Soát</th>
                <th>Phê Duyệt Quản Lý</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const isMatched = rec.difference === 0;
                const isDeficit = rec.difference < 0;

                return (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 600, color: "#00f2fe", fontFamily: "monospace" }}>{rec.shiftId}</td>
                    <td style={{ color: "#ffffff", fontWeight: 600 }}>{rec.gateName}</td>
                    <td>
                      <div>{rec.cashierName}</div>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{rec.cashierCode}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{rec.expectedCash.toLocaleString("vi-VN")} đ</td>
                    <td style={{ fontWeight: 700, color: "#ffffff" }}>{rec.actualCash.toLocaleString("vi-VN")} đ</td>
                    <td>
                      {isMatched ? (
                        <span className="pm-badge pm-badge-success">0 đ</span>
                      ) : isDeficit ? (
                        <span className="pm-badge pm-badge-danger">{rec.difference.toLocaleString("vi-VN")} đ</span>
                      ) : (
                        <span className="pm-badge pm-badge-warning">+{rec.difference.toLocaleString("vi-VN")} đ</span>
                      )}
                    </td>
                    <td style={{ color: "#38bdf8" }}>{rec.digitalPaymentsTotal.toLocaleString("vi-VN")} đ</td>
                    <td>
                      {isMatched ? (
                        <span className="pm-badge pm-badge-success">Matched 100%</span>
                      ) : isDeficit ? (
                        <span className="pm-badge pm-badge-danger">Mismatch -50,000 đ</span>
                      ) : (
                        <span className="pm-badge pm-badge-warning">Mismatch +20,000 đ</span>
                      )}
                    </td>
                    <td>
                      {rec.approvalStatus === "Approved" ? (
                        <span className="pm-badge pm-badge-success">
                          <CheckCircle size={11} /> Đã Phê Duyệt
                        </span>
                      ) : rec.approvalStatus === "Flagged" ? (
                        <span className="pm-badge pm-badge-danger">
                          <AlertTriangle size={11} /> Cảnh Báo Lệch
                        </span>
                      ) : (
                        <span className="pm-badge pm-badge-warning">Chờ Duyệt</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {rec.approvalStatus === "Pending" && (
                          <>
                            <button
                              type="button"
                              className="pm-btn-primary"
                              style={{ padding: "6px 12px", fontSize: 11 }}
                              disabled={isProcessing}
                              onClick={() => handleApproveShift(rec)}
                              title="Duyệt khóa sổ ca tiền mặt"
                            >
                              <FileCheck size={13} /> Duyệt Ca
                            </button>
                            <button
                              type="button"
                              className="pm-btn-danger"
                              style={{ padding: "6px 12px", fontSize: 11 }}
                              disabled={isProcessing}
                              onClick={() => setSelectedRecordToFlag(rec)}
                              title="Đánh dấu sai lệch"
                            >
                              <Flag size={13} /> Báo Sai Lệch
                            </button>
                          </>
                        )}
                        {rec.approvalStatus === "Approved" && (
                          <span style={{ fontSize: 11, color: "#34d399" }}>Đã khóa sổ</span>
                        )}
                        {rec.approvalStatus === "Flagged" && (
                          <span style={{ fontSize: 11, color: "#f87171" }}>Đang điều tra</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flag Discrepancy Modal */}
      {selectedRecordToFlag && (
        <div className="pm-modal-backdrop" onClick={() => setSelectedRecordToFlag(null)}>
          <div className="pm-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="pm-header-icon-box" style={{ background: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 0.5)", color: "#f87171" }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    Ghi Nhận Sai Lệch Tiền Mặt Ca: {selectedRecordToFlag.shiftId}
                  </h3>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    Thu ngân: {selectedRecordToFlag.cashierName} • Chênh lệch: {selectedRecordToFlag.difference.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmFlag} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="pm-form-group">
                <label className="pm-form-label" style={{ color: "#f87171" }}>
                  Lý do / Giải trình sai lệch (BẮT BUỘC):
                </label>
                <textarea
                  className="pm-form-textarea"
                  rows={3}
                  placeholder="Ghi chú đối soát: Khách không lấy tiền thừa, nhầm lẫn tiền mệnh giá 50k với 20k..."
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  required
                />
              </div>

              <div className="pm-modal-footer">
                <button
                  type="button"
                  className="pm-btn-outline"
                  onClick={() => setSelectedRecordToFlag(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="pm-btn-danger"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Đang xử lý..." : "Xác nhận & Chuyển kiểm toán"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: ASSIGN STAFF TO LOT (POST /api/v1/staff-assignments) ─── */}
      {isAssignModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setIsAssignModalOpen(false)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: 24,
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(16, 185, 129, 0.2)", padding: 8, borderRadius: 8 }}>
                  <UserPlus size={20} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Phân Công Nhân Viên Trực Bãi</h3>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Facility-Scoped RBAC • Identity Service</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="pm-form-group">
                <label className="pm-form-label" style={{ color: "#e2e8f0" }}>Chọn Nhân Viên (Từ CSDL Identity):</label>
                <select
                  className="pm-form-select"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn tài khoản nhân sự --</option>
                  {allAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.fullName} ({acc.emailNormalized || acc.email || "No Email"}) - {acc.roles?.join(",") || acc.role || "User"}
                    </option>
                  ))}
                  {allAccounts.length === 0 && (
                    <>
                      <option value="22222222-2222-2222-2222-222222222222">Nguyễn Văn Hùng (Staff Mặc định)</option>
                      <option value="33333333-3333-3333-3333-333333333333">Trần Thị Mai (Staff Cổng Ra)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label" style={{ color: "#e2e8f0" }}>Vai Trò Tại Cơ Sở:</label>
                <select
                  className="pm-form-select"
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                >
                  <option value="PARKING_STAFF">Nhân viên vận hành (PARKING_STAFF)</option>
                  <option value="PARKING_MANAGER">Quản lý cơ sở (PARKING_MANAGER)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="pm-form-group">
                  <label className="pm-form-label" style={{ color: "#e2e8f0" }}>Hiệu Lực Từ:</label>
                  <input
                    type="date"
                    className="pm-form-input"
                    value={assignValidFrom}
                    onChange={(e) => setAssignValidFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="pm-form-group">
                  <label className="pm-form-label" style={{ color: "#e2e8f0" }}>Đến Ngày (Tuỳ chọn):</label>
                  <input
                    type="date"
                    className="pm-form-input"
                    value={assignValidUntil}
                    onChange={(e) => setAssignValidUntil(e.target.value)}
                  />
                </div>
              </div>

              <div className="pm-modal-footer" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="pm-btn-outline"
                  onClick={() => setIsAssignModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="pm-btn-primary"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Đang xử lý..." : "Lưu Phân Công"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: UPDATE ROLE (POST /api/v1/author/update-role) ─────────── */}
      {isRoleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setIsRoleModalOpen(false)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(34, 211, 238, 0.3)",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: 24,
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(34, 211, 238, 0.2)", padding: 8, borderRadius: 8 }}>
                  <Shield size={20} color="#22d3ee" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Phân Quyền Vai Trò Người Dùng</h3>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Quản trị Phân quyền Identity</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRoleModalOpen(false);
                  setTargetUser(null);
                }}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                type="email"
                className="pm-form-input"
                placeholder="Nhập email tài khoản cần phân quyền..."
                value={roleSearchEmail}
                onChange={(e) => setRoleSearchEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSearchUserByEmail}
                className="pm-btn-primary"
                disabled={isProcessing}
                style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
              >
                <Search size={14} />
                <span>Tìm kiếm</span>
              </button>
            </div>

            {targetUser && (
              <form onSubmit={handleUpdateRoleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#94a3b8" }}>Họ và tên:</span>
                    <strong>{targetUser.fullName}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#94a3b8" }}>Email:</span>
                    <span>{targetUser.emailNormalized || targetUser.email}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Vai trò hiện tại:</span>
                    <span style={{ color: "#38bdf8" }}>{targetUser.roles?.join(", ") || targetUser.role || "CUSTOMER"}</span>
                  </div>
                </div>

                <div className="pm-form-group">
                  <label className="pm-form-label" style={{ color: "#e2e8f0" }}>Gán Vai Trò Mới:</label>
                  <select
                    className="pm-form-select"
                    value={newRoleCode}
                    onChange={(e) => setNewRoleCode(e.target.value)}
                  >
                    <option value="PARKING_STAFF">Nhân viên vận hành (PARKING_STAFF)</option>
                    <option value="PARKING_MANAGER">Quản lý cơ sở (PARKING_MANAGER)</option>
                    <option value="ADMIN">Quản trị viên nền tảng (ADMIN)</option>
                    <option value="CUSTOMER">Khách hàng tiêu chuẩn (CUSTOMER)</option>
                  </select>
                </div>

                <div className="pm-modal-footer" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="pm-btn-outline"
                    onClick={() => {
                      setIsRoleModalOpen(false);
                      setTargetUser(null);
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="pm-btn-primary"
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Đang cập nhật..." : "Cập Nhật Vai Trò"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
