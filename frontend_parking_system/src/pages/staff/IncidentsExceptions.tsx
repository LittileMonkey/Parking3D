import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  PlusCircle,
  X,
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Car,
  Wrench,
  Check,
  AlertOctagon,
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
      // Ensure at least 3 realistic incidents if store is empty
      if (data.length === 0) {
        setIncidents([
          {
            incidentId: "INC-2026-001",
            title: "Barrier Cổng Vào G1 kẹt cảm biến an toàn",
            type: "Thiết bị cổng",
            severity: "Medium",
            status: "InProgress",
            description: "Cần gạt barrier không tự hạ sau khi xe qua. Đang dùng điều khiển tay.",
            relatedGate: "Cổng Vào G1",
            reportedBy: "Nguyễn Văn Hùng",
            assignedTo: "Kỹ thuật trực ca",
            detectedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            notes: "Kỹ thuật đang kiểm tra motor giảm tốc.",
          },
          {
            incidentId: "INC-2026-002",
            title: "Xe đỗ lệch vạch chiếm ô lân cận",
            type: "Sai quy định đỗ",
            severity: "High",
            status: "Open",
            description: "Xe SUV đậu chèn sang vạch ô bên cạnh, gây cản trở phương tiện lùi vào.",
            relatedLicensePlate: "51K-892.45",
            relatedSlotCode: "B1-A04",
            reportedBy: "Nguyễn Văn Hùng",
            detectedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          },
          {
            incidentId: "INC-2026-003",
            title: "Camera ANPR Cổng Ra chớp nháy nguồn",
            type: "Nhận diện biển số",
            severity: "Critical",
            status: "Open",
            description: "Màn hình quan sát cổng ra chập chờn, tỷ lệ nhận diện giảm còn 60%.",
            relatedGate: "Cổng Ra G3",
            reportedBy: "Nguyễn Văn Hùng",
            detectedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          },
        ]);
      } else {
        setIncidents(data);
      }
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

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case "Critical":
        return (
          <span className="pm-severity-badge critical">
            <AlertOctagon size={12} />
            <span>Khẩn cấp</span>
          </span>
        );
      case "High":
        return (
          <span className="pm-severity-badge high">
            <AlertTriangle size={12} />
            <span>Cao</span>
          </span>
        );
      case "Medium":
        return (
          <span className="pm-severity-badge medium">
            <AlertTriangle size={12} />
            <span>Trung bình</span>
          </span>
        );
      case "Low":
      default:
        return (
          <span className="pm-severity-badge low">
            <span>Thấp</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return (
          <span className="pm-incident-status-badge open">
            <span>Mới tiếp nhận</span>
          </span>
        );
      case "InProgress":
        return (
          <span className="pm-incident-status-badge in-progress">
            <Clock size={12} />
            <span>Đang xử lý</span>
          </span>
        );
      case "Resolved":
        return (
          <span className="pm-incident-status-badge resolved">
            <Check size={12} />
            <span>Đã giải quyết</span>
          </span>
        );
      default:
        return <span className="pm-incident-status-badge">{status}</span>;
    }
  };

  return (
    <div className="pm-incidents-container">
      {/* ─── 1. Page Header & Theme Consistency ───────────────────────────── */}
      <div className="pm-header-row">
        <div>
          <h1 className="pm-section-title pm-title-flex">
            <ShieldAlert size={26} color="#fbbf24" />
            <span>Quản lý Sự cố &amp; Ngoại lệ Vận hành</span>
          </h1>
          <p className="pm-section-subtitle">
            Tiếp nhận, theo dõi tiến độ xử lý lỗi thiết bị cổng barrier, lỗi biển số, xe đỗ sai quy định
          </p>
        </div>

        {/* Top-Right CTA Button */}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="pm-cta-btn pm-btn-teal pm-cta-header-btn"
        >
          <PlusCircle size={16} />
          <span>+ Báo cáo Sự cố Mới</span>
        </button>
      </div>

      {/* ─── 2. Filter & Search Toolbar Panel ─────────────────────────────── */}
      <div className="pm-incidents-toolbar">
        <div className="pm-toolbar-left">
          <span className="pm-toolbar-label">Mức độ ưu tiên:</span>
          <div className="pm-filter-pills">
            {[
              { id: "All", label: "Tất cả" },
              { id: "Critical", label: "Khẩn cấp" },
              { id: "High", label: "Cao" },
              { id: "Medium", label: "Trung bình" },
              { id: "Low", label: "Thấp" },
            ].map((sev) => (
              <button
                key={sev.id}
                type="button"
                onClick={() => setSeverityFilter(sev.id)}
                className={`pm-filter-pill-btn ${severityFilter === sev.id ? "active" : ""}`}
              >
                <span>{sev.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pm-toolbar-right">
          {/* Status Dropdown */}
          <select
            className="pm-toolbar-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái sự cố"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Open">Chờ xử lý (Mới tiếp nhận)</option>
            <option value="InProgress">Đang xử lý (In Progress)</option>
            <option value="Resolved">Đã giải quyết (Resolved)</option>
          </select>

          {/* Search Input */}
          <div className="pm-search-input-wrap">
            <Search size={14} className="pm-search-wrap-icon" />
            <input
              type="text"
              className="pm-filter-search-field"
              placeholder="Tìm mã / biển số..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ─── 3. Incident List Container & Dark Table ──────────────────────── */}
      <div className="pm-op-card">
        <div className="pm-op-card-header">
          <div className="pm-card-title-group">
            <AlertTriangle size={18} color="#fbbf24" />
            <h2 className="pm-op-card-title">
              Danh sách Sự cố ({filteredIncidents.length})
            </h2>
          </div>

          <div className="pm-incident-counter-chip">
            <span>Chờ xử lý:</span>
            <strong style={{ color: "#f87171" }}>
              {incidents.filter((i) => i.status === "Open").length}
            </strong>
          </div>
        </div>

        <div className="pm-table-wrapper">
          <table className="pm-dark-table">
            <thead>
              <tr>
                <th>MÃ SỰ CỐ</th>
                <th>TIÊU ĐỀ &amp; MÔ TẢ</th>
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
                  <td colSpan={8} className="pm-table-empty">
                    Đang tải dữ liệu sự cố...
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pm-table-empty">
                    Không có sự cố nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.incidentId} className="pm-table-row">
                    {/* INCIDENT CODE */}
                    <td>
                      <span className="pm-incident-code">{inc.incidentId}</span>
                    </td>

                    {/* TITLE & DESCRIPTION */}
                    <td style={{ maxWidth: 320 }}>
                      <div className="pm-incident-title">{inc.title}</div>
                      <div className="pm-incident-desc">{inc.description}</div>
                      {inc.notes && (
                        <div className="pm-incident-notes">
                          <em>Ghi chú: {inc.notes}</em>
                        </div>
                      )}
                    </td>

                    {/* TYPE */}
                    <td>
                      <span className="pm-incident-type-tag">{inc.type}</span>
                    </td>

                    {/* SEVERITY BADGE */}
                    <td>
                      {getSeverityBadge(inc.severity)}
                    </td>

                    {/* AFFECTED OBJECTS */}
                    <td>
                      <div className="pm-affected-group">
                        {inc.relatedLicensePlate && (
                          <div className="pm-affected-item">
                            <span className="pm-affected-label">Biển số:</span>
                            <strong className="pm-plate-text">{inc.relatedLicensePlate}</strong>
                          </div>
                        )}
                        {inc.relatedSlotCode && (
                          <div className="pm-affected-item">
                            <span className="pm-affected-label">Vị trí:</span>
                            <strong className="pm-slot-text">{inc.relatedSlotCode}</strong>
                          </div>
                        )}
                        {inc.relatedGate && (
                          <div className="pm-affected-item">
                            <span className="pm-affected-label">Cổng:</span>
                            <span>{inc.relatedGate}</span>
                          </div>
                        )}
                        {!inc.relatedLicensePlate && !inc.relatedSlotCode && !inc.relatedGate && (
                          <span className="pm-text-muted">—</span>
                        )}
                      </div>
                    </td>

                    {/* TIMESTAMP */}
                    <td>
                      <div className="pm-time-text">
                        {new Date(inc.detectedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="pm-date-sub">
                        {new Date(inc.detectedAt).toLocaleDateString("vi-VN")}
                      </div>
                    </td>

                    {/* STATUS BADGE */}
                    <td>
                      {getStatusBadge(inc.status)}
                    </td>

                    {/* ACTIONS */}
                    <td>
                      <div className="pm-action-buttons-group">
                        {inc.status === "Open" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(inc.incidentId, "InProgress", "Nhân viên ca trực đã tiếp nhận xử lý")}
                            className="pm-btn-pill cyan"
                          >
                            Tiếp nhận
                          </button>
                        )}
                        {inc.status === "InProgress" && (
                          <button
                            type="button"
                            onClick={() => setResolvingId(inc.incidentId)}
                            className="pm-btn-pill green"
                          >
                            Hoàn tất
                          </button>
                        )}
                        {inc.status === "Resolved" && (
                          <span className="pm-resolved-text">
                            <Check size={14} /> Đã xử lý
                          </span>
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

      {/* ─── 5. Create Incident Modal (Dark Theme) ─────────────────────────── */}
      {showCreateModal && (
        <div className="staff-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="staff-modal pm-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header pm-dark-modal-header">
              <h3 className="staff-modal-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}>
                <PlusCircle size={20} color="var(--pm-teal)" />
                <span>Báo cáo Sự cố &amp; Ngoại lệ Mới</span>
              </h3>
              <button
                type="button"
                className="staff-btn-secondary pm-modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="staff-modal-body pm-dark-modal-body">
                <div className="pm-form-stack">
                  <div className="pm-form-field">
                    <label className="pm-form-label">
                      Tiêu đề sự cố <span className="pm-required">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      className="pm-form-input"
                      placeholder="VD: Cổng G1 kẹt barrier, Xe 51F-123.45 mất vé..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="pm-form-row">
                    <div className="pm-form-field">
                      <label className="pm-form-label">Phân loại sự cố:</label>
                      <select
                        className="pm-form-select"
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

                    <div className="pm-form-field">
                      <label className="pm-form-label">Mức độ nghiêm trọng:</label>
                      <select
                        className="pm-form-select"
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

                  <div className="pm-form-row">
                    <div className="pm-form-field">
                      <label className="pm-form-label">Biển số xe liên quan (nếu có):</label>
                      <input
                        type="text"
                        className="pm-form-input"
                        placeholder="VD: 51K-892.45"
                        value={relatedPlate}
                        onChange={(e) => setRelatedPlate(e.target.value)}
                      />
                    </div>

                    <div className="pm-form-field">
                      <label className="pm-form-label">Vị trí ô đỗ (nếu có):</label>
                      <input
                        type="text"
                        className="pm-form-input"
                        placeholder="VD: B1-A12"
                        value={relatedSlot}
                        onChange={(e) => setRelatedSlot(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pm-form-field">
                    <label className="pm-form-label">Cổng phát sinh:</label>
                    <select
                      className="pm-form-select"
                      value={relatedGate}
                      onChange={(e) => setRelatedGate(e.target.value)}
                    >
                      <option value="Cổng Vào G1">Cổng Vào G1</option>
                      <option value="Cổng Vào G2">Cổng Vào G2</option>
                      <option value="Cổng Ra G3">Cổng Ra G3</option>
                      <option value="Trong bãi đỗ">Bên trong khuôn viên bãi đỗ</option>
                    </select>
                  </div>

                  <div className="pm-form-field">
                    <label className="pm-form-label">
                      Mô tả chi tiết tình huống <span className="pm-required">*</span>:
                    </label>
                    <textarea
                      required
                      className="pm-form-input"
                      style={{ height: 80, padding: 12, resize: "vertical" }}
                      placeholder="Mô tả cụ thể hiện tượng phát sinh và hướng xử lý tạm thời..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="staff-modal-footer pm-dark-modal-footer">
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
                  className="pm-cta-btn pm-btn-teal"
                  style={{ width: "auto", padding: "8px 20px" }}
                >
                  {submitting ? "Đang lưu..." : "Ghi nhận Sự cố"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Resolve Note Modal (Dark Theme) ────────────────────────────── */}
      {resolvingId && (
        <div className="staff-modal-backdrop" onClick={() => setResolvingId(null)}>
          <div className="staff-modal pm-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header pm-dark-modal-header">
              <h3 className="staff-modal-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}>
                <CheckCircle2 size={20} color="#10b981" />
                <span>Xác nhận Hoàn tất &amp; Đóng Sự cố</span>
              </h3>
              <button
                type="button"
                className="staff-btn-secondary pm-modal-close-btn"
                onClick={() => setResolvingId(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-modal-body pm-dark-modal-body">
              <div className="pm-form-field">
                <label className="pm-form-label">Biện pháp xử lý đã thực hiện (*):</label>
                <textarea
                  className="pm-form-input"
                  style={{ height: 80, padding: 12, resize: "vertical" }}
                  placeholder="VD: Đã khởi động lại cảm biến barrier, cơ chế tự động hoạt động bình thường..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                />
              </div>
            </div>

            <div className="staff-modal-footer pm-dark-modal-footer">
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
                className="pm-cta-btn"
                style={{ background: "#10b981", color: "#ffffff", width: "auto", padding: "8px 20px" }}
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
