import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Camera,
  CreditCard,
  FileText,
  ShieldAlert,
  Clock,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import FacilityRbacStrip from "../../components/manager/FacilityRbacStrip";
import { managerApi } from "../../services/manager/managerApi";
import type {
  ExceptionRequest,
  ExceptionType,
} from "../../types/manager";

interface OutletContextType {
  selectedLotId: string;
}

export default function IncidentsApprovalsPage() {
  const { selectedLotId } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ExceptionRequest[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [selectedRequest, setSelectedRequest] = useState<ExceptionRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      try {
        const res = await managerApi.getExceptionRequests(selectedLotId || "PKM-METRO-01");
        if (res.isSuccess && res.result) {
          setRequests(res.result);
        }
      } catch (err) {
        console.error("Load exception requests error", err);
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, [selectedLotId]);

  const filteredRequests = requests.filter((r) => {
    if (filterType === "ALL") return true;
    return r.exceptionType === filterType;
  });

  const handleOpenReview = (req: ExceptionRequest, action: "Approved" | "Rejected") => {
    setSelectedRequest(req);
    setReviewAction(action);
    setReviewRemarks(
      action === "Approved"
        ? "Quản lý đã xác minh qua camera giám sát và phê duyệt giải quyết ngoại lệ."
        : "Từ chối do thiếu chứng từ xác minh hợp lệ."
    );
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      const res = await managerApi.reviewException(selectedRequest.id, reviewAction, reviewRemarks);
      if (res.isSuccess) {
        setRequests((prev) =>
          prev.map((r) => (r.id === selectedRequest.id ? res.result : r))
        );
        setSuccessMsg(res.message);
        setSelectedRequest(null);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Review exception error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExceptionTypeBadge = (type: ExceptionType) => {
    switch (type) {
      case "Refund":
        return <span className="pm-badge pm-badge-info"><CreditCard size={11} /> Hoàn Phí Trừ Trùng</span>;
      case "PlateMismatch":
        return <span className="pm-badge pm-badge-warning"><Camera size={11} /> Lệch Biển Số OCR</span>;
      case "EmergencyBarrierOpen":
        return <span className="pm-badge pm-badge-danger"><ShieldAlert size={11} /> Mở Khẩn Cấp Barrier</span>;
      case "LostTicket":
        return <span className="pm-badge pm-badge-neutral"><FileText size={11} /> Báo Mất Thẻ Từ</span>;
    }
  };

  return (
    <div className="pm-module-page">
      <FacilityRbacStrip
        parkingLotId={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        facilityName="Metropolis Central Hub"
        facilityCode={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        moduleTitle="Incident & Exception Approvals"
        moduleDescription="Xét duyệt yêu cầu hoàn tiền, mở barrier khẩn cấp, giải quyết sai lệch OCR biển số & mất thẻ"
      />

      {successMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", borderRadius: 12, padding: "12px 18px", color: "#34d399", display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="pm-glass-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`pm-badge ${filterType === "ALL" ? "pm-badge-info" : "pm-badge-neutral"}`}
              style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
              onClick={() => setFilterType("ALL")}
            >
              Tất Cả Yêu Cầu ({requests.length})
            </button>
            <button
              type="button"
              className={`pm-badge ${filterType === "PlateMismatch" ? "pm-badge-warning" : "pm-badge-neutral"}`}
              style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
              onClick={() => setFilterType("PlateMismatch")}
            >
              Lệch OCR Biển Số
            </button>
            <button
              type="button"
              className={`pm-badge ${filterType === "Refund" ? "pm-badge-info" : "pm-badge-neutral"}`}
              style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
              onClick={() => setFilterType("Refund")}
            >
              Hoàn Phí Thanh Toán
            </button>
            <button
              type="button"
              className={`pm-badge ${filterType === "EmergencyBarrierOpen" ? "pm-badge-danger" : "pm-badge-neutral"}`}
              style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
              onClick={() => setFilterType("EmergencyBarrierOpen")}
            >
              Mở Barrier Khẩn Cấp
            </button>
            <button
              type="button"
              className={`pm-badge ${filterType === "LostTicket" ? "pm-badge-neutral" : "pm-badge-neutral"}`}
              style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
              onClick={() => setFilterType("LostTicket")}
            >
              Mất Thẻ Vật Lý
            </button>
          </div>

          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Chờ xử lý: <strong style={{ color: "#fbbf24" }}>{requests.filter((r) => r.status === "Pending").length}</strong> yêu cầu
          </div>
        </div>
      </div>

      {/* Exception Request Cards Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Đang tải danh sách phê duyệt ngoại lệ…</div>
      ) : (
        <div className="pm-exception-grid">
          {filteredRequests.map((req) => (
            <div key={req.id} className="pm-exception-card">
              <div className="pm-exception-top">
                <div>
                  <span style={{ fontSize: 11, color: "#00f2fe", fontWeight: 700, fontFamily: "monospace" }}>
                    {req.id}
                  </span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", margin: "4px 0" }}>
                    {req.title}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                    <MapPin size={11} /> {req.gateOrLocation} • <Clock size={11} /> {req.createdAt}
                  </div>
                </div>
                {getExceptionTypeBadge(req.exceptionType)}
              </div>

              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: 0 }}>
                {req.description}
              </p>

              {/* Data Highlights */}
              <div style={{ background: "rgba(17, 24, 39, 0.6)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                {req.licensePlate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Biển số xe:</span>
                    <strong style={{ color: "#ffffff" }}>{req.licensePlate}</strong>
                  </div>
                )}
                {req.detectedPlate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>OCR đọc nhầm:</span>
                    <strong style={{ color: "#f87171" }}>{req.detectedPlate}</strong>
                  </div>
                )}
                {req.requestedAmount && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Số tiền đề xuất:</span>
                    <strong style={{ color: "#34d399" }}>{req.requestedAmount.toLocaleString("vi-VN")} đ</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Nhân viên đề xuất:</span>
                  <span style={{ color: "#a8cdd0" }}>{req.requesterStaffName} ({req.requesterStaffCode})</span>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="pm-exception-actions">
                {req.status === "Pending" ? (
                  <>
                    <button
                      type="button"
                      className="pm-btn-primary"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => handleOpenReview(req, "Approved")}
                    >
                      <CheckCircle size={14} /> Phê Duyệt & Ghi Audit
                    </button>
                    <button
                      type="button"
                      className="pm-btn-danger"
                      onClick={() => handleOpenReview(req, "Rejected")}
                    >
                      <XCircle size={14} /> Từ Chối
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontSize: 12 }}>
                    <span className={`pm-badge ${req.status === "Approved" ? "pm-badge-success" : "pm-badge-danger"}`}>
                      {req.status === "Approved" ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {req.status === "Approved" ? "Đã Phê Duyệt" : "Đã Từ Chối"}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>
                      Bởi: {req.reviewedBy} lúc {req.reviewedAt}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Confirmation Modal */}
      {selectedRequest && (
        <div className="pm-modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <div className="pm-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="pm-header-icon-box" style={{ background: reviewAction === "Approved" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)", borderColor: reviewAction === "Approved" ? "#10b981" : "#ef4444", color: reviewAction === "Approved" ? "#34d399" : "#f87171" }}>
                  {reviewAction === "Approved" ? <CheckCircle size={18} /> : <XCircle size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {reviewAction === "Approved" ? "Phê Duyệt Ngoại Lệ" : "Từ Chối Ngoại Lệ"} ({selectedRequest.id})
                  </h3>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{selectedRequest.title}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmReview} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="pm-form-group">
                <label className="pm-form-label">
                  Ghi chú thẩm định & Căn cứ phê duyệt (Lưu vết nhật ký kiểm toán):
                </label>
                <textarea
                  className="pm-form-textarea"
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  required
                />
              </div>

              <div className="pm-modal-footer">
                <button
                  type="button"
                  className="pm-btn-outline"
                  onClick={() => setSelectedRequest(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={reviewAction === "Approved" ? "pm-btn-primary" : "pm-btn-danger"}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang xử lý..." : reviewAction === "Approved" ? "Xác nhận Phê Duyệt" : "Xác nhận Từ Chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
