import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  PlusCircle,
  X,
  Search,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type {
  Incident,
  IncidentSeverity,
  CreateIncidentPayload,
} from "../../types/staff";

export default function IncidentsExceptions() {
  const [searchParams] = useSearchParams();
  const prefillSlot = searchParams.get("slot") || "";
  const prefillPlate = searchParams.get("plate") || "";

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(Boolean(prefillSlot || prefillPlate));
  const [title, setTitle] = useState(
    prefillSlot ? `Sự cố liên quan ô ${prefillSlot}` : prefillPlate ? `Sự cố xe biển số ${prefillPlate}` : "",
  );
  const [type, setType] = useState("Thiết bị cổng");
  const [severity, setSeverity] = useState<IncidentSeverity>("Medium");
  const [description, setDescription] = useState("");
  const [relatedPlate, setRelatedPlate] = useState(prefillPlate);
  const [relatedSlot, setRelatedSlot] = useState(prefillSlot);
  const [relatedGate, setRelatedGate] = useState("Cổng Vào G1");
  const [submitting, setSubmitting] = useState(false);

  // Resolution modal / note prompt
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const loadIncidents = async () => {
    try {
      const data = await staffApi.getIncidents();
      setIncidents(data);
    } catch (err) {
      console.error("Load incidents error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: CreateIncidentPayload = {
        title,
        type,
        severity,
        description,
        relatedLicensePlate: relatedPlate.trim() || undefined,
        relatedSlotCode: relatedSlot.trim() || undefined,
        relatedGate: relatedGate || undefined,
        detectedAt: new Date().toISOString(),
      };
      await staffApi.createIncident(payload);
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setRelatedPlate("");
      setRelatedSlot("");
      loadIncidents();
    } catch (err: any) {
      alert("Lỗi tạo sự cố: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    incidentId: string,
    newStatus: "InProgress" | "Resolved" | "Escalated",
    notes?: string,
  ) => {
    try {
      await staffApi.updateIncidentStatus(incidentId, newStatus, notes);
      setResolvingId(null);
      setResolveNote("");
      loadIncidents();
    } catch (err: any) {
      alert("Lỗi cập nhật: " + err.message);
    }
  };

  const filteredIncidents = incidents.filter((i) => {
    if (severityFilter !== "All" && i.severity !== severityFilter) return false;
    if (statusFilter !== "All" && i.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        i.title.toLowerCase().includes(q) ||
        i.incidentId.toLowerCase().includes(q) ||
        (i.relatedLicensePlate && i.relatedLicensePlate.toLowerCase().includes(q)) ||
        (i.relatedSlotCode && i.relatedSlotCode.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="staff-page-header">
        <div>
          <h1 className="staff-page-title">
            <AlertTriangle size={24} color="var(--amber)" />
            Quản lý Sự cố & Ngoại lệ Vận hành
          </h1>
          <p className="staff-page-desc">
            Tiếp nhận, theo dõi tiến độ xử lý lỗi thiết bị cổng barrier, lỗi biển số, xe đỗ sai quy định
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="staff-quick-btn staff-btn-primary"
        >
          <PlusCircle size={16} />
          <span>Báo cáo Sự cố Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="staff-card" style={{ marginBottom: 20 }}>
        <div className="staff-card-body" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Mức độ:</span>
            {["All", "Critical", "High", "Medium", "Low"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  border: "1px solid",
                  borderColor: severityFilter === sev ? "var(--teal)" : "var(--line)",
                  background: severityFilter === sev ? "#eff9f7" : "white",
                  color: severityFilter === sev ? "var(--teal)" : "var(--muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {sev === "All" ? "Tất cả" : sev === "Critical" ? "Khẩn cấp" : sev === "High" ? "Cao" : sev === "Medium" ? "Trung bình" : "Thấp"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              className="staff-select"
              style={{ fontSize: 12, padding: "4px 8px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Open">Chờ xử lý (Open)</option>
              <option value="InProgress">Đang xử lý (In Progress)</option>
              <option value="Resolved">Đã giải quyết (Resolved)</option>
            </select>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="staff-input"
                style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
                placeholder="Tìm mã / biển số..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={13} style={{ position: "absolute", left: 8, top: 9, color: "var(--muted)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="staff-card">
        <div className="staff-card-header">
          <h2 className="staff-card-title">
            <AlertTriangle size={16} color="var(--amber)" />
            Danh sách Sự cố ({filteredIncidents.length})
          </h2>
        </div>

        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>MÃ SỰ CỐ</th>
                <th>TIÊU ĐỀ & MÔ TẢ</th>
                <th>PHÂN LOẠI</th>
                <th>MỨC ĐỘ</th>
                <th>ĐỐI TƯỢNG LIÊN QUAN</th>
                <th>THỜI GIAN PHÁT HIỆN</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                    Đang tải dữ liệu sự cố...
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                    Không có sự cố nào cần xử lý.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.incidentId}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{inc.incidentId}</span>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{inc.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{inc.description}</div>
                      {inc.notes && (
                        <div style={{ fontSize: 11, color: "var(--teal)", marginTop: 4 }}>
                          <em>Ghi chú: {inc.notes}</em>
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#475569" }}>{inc.type}</span>
                    </td>
                    <td>
                      <span
                        className={`staff-badge ${
                          inc.severity === "Critical"
                            ? "badge-open"
                            : inc.severity === "High"
                            ? "badge-progress"
                            : "badge-maintenance"
                        }`}
                        style={{
                          background:
                            inc.severity === "Critical" ? "#fee2e2" : inc.severity === "High" ? "#ffedd5" : undefined,
                          color:
                            inc.severity === "Critical" ? "#b91c1c" : inc.severity === "High" ? "#c2410c" : undefined,
                        }}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {inc.relatedLicensePlate && <div>Biển số: <strong>{inc.relatedLicensePlate}</strong></div>}
                      {inc.relatedSlotCode && <div>Vị trí: <strong>{inc.relatedSlotCode}</strong></div>}
                      {inc.relatedGate && <div>Cổng: {inc.relatedGate}</div>}
                      {!inc.relatedLicensePlate && !inc.relatedSlotCode && !inc.relatedGate && "—"}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{new Date(inc.detectedAt).toLocaleTimeString("vi-VN")}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        {new Date(inc.detectedAt).toLocaleDateString("vi-VN")}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`staff-badge ${
                          inc.status === "Open"
                            ? "badge-open"
                            : inc.status === "InProgress"
                            ? "badge-progress"
                            : "badge-resolved"
                        }`}
                      >
                        {inc.status === "Open" ? "Mới tiếp nhận" : inc.status === "InProgress" ? "Đang xử lý" : "Đã giải quyết"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {inc.status === "Open" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(inc.incidentId, "InProgress", "Nhân viên ca trực đã tiếp nhận")}
                            className="staff-quick-btn staff-btn-secondary"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                          >
                            Tiếp nhận
                          </button>
                        )}
                        {inc.status === "InProgress" && (
                          <button
                            type="button"
                            onClick={() => setResolvingId(inc.incidentId)}
                            className="staff-quick-btn staff-btn-primary"
                            style={{ fontSize: 11, padding: "4px 8px", background: "var(--green)" }}
                          >
                            Hoàn tất
                          </button>
                        )}
                        {inc.status === "Resolved" && (
                          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>✓ Đã xử lý</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="staff-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header">
              <h3 className="staff-modal-title">Báo cáo Sự cố & Ngoại lệ Mới</h3>
              <button
                type="button"
                className="staff-btn-secondary"
                style={{ padding: 4 }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="staff-modal-body">
                <div className="staff-form-group">
                  <label className="staff-label">Tiêu đề sự cố (*):</label>
                  <input
                    type="text"
                    required
                    className="staff-input"
                    placeholder="VD: Cổng G1 kẹt barrier, Xe 51F-123.45 mất vé..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="staff-form-group">
                    <label className="staff-label">Phân loại sự cố:</label>
                    <select
                      className="staff-select"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="Thiết bị cổng">Thiết bị cổng (Barrier/Cảm biến)</option>
                      <option value="Nhận diện biển số">Nhận diện biển số (ANPR)</option>
                      <option value="Sai quy định đỗ">Đỗ xe sai vạch / Chiếm chỗ</option>
                      <option value="Mất vé/Mã đặt chỗ">Mất vé / Mất mã đặt chỗ</option>
                      <option value="Khẩn cấp">Tình huống khẩn cấp</option>
                    </select>
                  </div>

                  <div className="staff-form-group">
                    <label className="staff-label">Mức độ nghiêm trọng:</label>
                    <select
                      className="staff-select"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    >
                      <option value="Low">Thấp (Low)</option>
                      <option value="Medium">Trung bình (Medium)</option>
                      <option value="High">Cao (High)</option>
                      <option value="Critical">Khẩn cấp (Critical)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="staff-form-group">
                    <label className="staff-label">Biển số xe liên quan (nếu có):</label>
                    <input
                      type="text"
                      className="staff-input"
                      placeholder="VD: 51K-892.45"
                      value={relatedPlate}
                      onChange={(e) => setRelatedPlate(e.target.value)}
                    />
                  </div>

                  <div className="staff-form-group">
                    <label className="staff-label">Vị trí ô đỗ (nếu có):</label>
                    <input
                      type="text"
                      className="staff-input"
                      placeholder="VD: B1-A12"
                      value={relatedSlot}
                      onChange={(e) => setRelatedSlot(e.target.value)}
                    />
                  </div>
                </div>

                <div className="staff-form-group">
                  <label className="staff-label">Cổng phát sinh:</label>
                  <select
                    className="staff-select"
                    value={relatedGate}
                    onChange={(e) => setRelatedGate(e.target.value)}
                  >
                    <option value="Cổng Vào G1">Cổng Vào G1</option>
                    <option value="Cổng Vào G2">Cổng Vào G2</option>
                    <option value="Cổng Ra G3">Cổng Ra G3</option>
                    <option value="Trong bãi đỗ">Bên trong khuôn viên bãi đỗ</option>
                  </select>
                </div>

                <div className="staff-form-group">
                  <label className="staff-label">Mô tả chi tiết tình huống (*):</label>
                  <textarea
                    required
                    className="staff-textarea"
                    placeholder="Mô tả cụ thể hiện tượng phát sinh và hướng xử lý tạm thời..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="staff-quick-btn staff-btn-primary"
                >
                  {submitting ? "Đang lưu..." : "Ghi nhận Sự cố"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Note Modal */}
      {resolvingId && (
        <div className="staff-modal-backdrop" onClick={() => setResolvingId(null)}>
          <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header">
              <h3 className="staff-modal-title">Xác nhận Hoàn tất & Đóng Sự cố</h3>
              <button
                type="button"
                className="staff-btn-secondary"
                style={{ padding: 4 }}
                onClick={() => setResolvingId(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="staff-modal-body">
              <div className="staff-form-group">
                <label className="staff-label">Biện pháp xử lý đã thực hiện (*):</label>
                <textarea
                  className="staff-textarea"
                  placeholder="VD: Đã khởi động lại cảm biến barrier, cơ chế tự động hoạt động bình thường..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                />
              </div>
            </div>
            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn-secondary"
                onClick={() => setResolvingId(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(resolvingId, "Resolved", resolveNote)}
                className="staff-quick-btn staff-btn-primary"
                style={{ background: "var(--green)" }}
              >
                Đánh dấu Đã Giải Quyết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
