import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Car,
  TrendingUp,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type { DashboardOverview, ActivityEvent, OperationalAlert } from "../../types/staff";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { selectedLotId } = useOutletContext<{ selectedLotId?: string }>() || {};

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [quickSearchInput, setQuickSearchInput] = useState("");

  const loadData = async () => {
    try {
      const lotId = selectedLotId || "lot-01";
      const [ov, evs, alts] = await Promise.all([
        staffApi.getDashboardOverview(lotId),
        staffApi.getActivityEvents(),
        staffApi.getOperationalAlerts(),
      ]);
      setOverview(ov);
      setEvents(evs);
      setAlerts(alts);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [selectedLotId]);

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearchInput.trim()) {
      navigate(`/staff/operations?plate=${encodeURIComponent(quickSearchInput.trim())}`);
    }
  };

  if (loading && !overview) {
    return (
      <div className="pm-loading-container">
        <div className="pm-spinner" />
        <p>Đang tải dữ liệu ca trực...</p>
      </div>
    );
  }

  // Exact metrics as requested or dynamic from API
  const occupancyRate = overview ? Math.round((overview.occupiedCount / overview.totalCapacity) * 100) : 46;
  const occupiedCount = overview?.occupiedCount ?? 69;
  const totalCapacity = overview?.totalCapacity ?? 150;
  const availableCount = overview?.availableCount ?? 76;
  const maintenanceCount = 3;
  const entriesCount = overview?.todayEntries ?? 42;
  const exitsCount = overview?.todayExits ?? 28;
  const incidentsCount = overview?.openIncidents ?? 2;

  return (
    <div className="pm-dashboard-wrapper">
      {/* ─── Page Title Header ────────────────────────────────────────────── */}
      <div className="pm-header-row">
        <div>
          <h1 className="pm-section-title">Tổng quan ca trực</h1>
        </div>
        <div className="pm-header-actions">
          <button
            type="button"
            className="pm-action-link"
            onClick={() => navigate("/staff/operations")}
          >
            <span>Điều phối Vào / Ra</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ─── 4 Main Summary KPI Cards (With Restored Detail Sub-texts) ────── */}
      <div className="pm-kpi-row">
        {/* Card 1: Tỷ lệ lấp đầy */}
        <div className="pm-kpi-box">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">TỶ LỆ LẤP ĐẦY</span>
            <Car size={16} className="pm-kpi-icon teal" />
          </div>
          <div className="pm-kpi-metric">
            {occupancyRate}%
            <span className="pm-kpi-subtext">
              ({occupiedCount}/{totalCapacity} xe)
            </span>
          </div>
          <div className="pm-progress-track">
            <div
              className="pm-progress-fill"
              style={{
                width: `${Math.min(occupancyRate, 100)}%`,
                backgroundColor: occupancyRate > 85 ? "#ef4444" : occupancyRate > 70 ? "#f59e0b" : "#00B4D8",
              }}
            />
          </div>
          <div className="pm-kpi-detail-line">
            <span className="pm-text-success">{availableCount} chỗ trống</span>
            <span className="pm-text-muted">• {maintenanceCount} đang bảo trì</span>
          </div>
        </div>

        {/* Card 2: Xe vào trong ca */}
        <div className="pm-kpi-box">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">XE VÀO TRONG CA</span>
            <ArrowDownLeft size={16} className="pm-kpi-icon green" />
          </div>
          <div className="pm-kpi-metric">{entriesCount}</div>
          <div className="pm-kpi-detail-line pm-text-success">
            <TrendingUp size={13} />
            <span>+12% so với ca trước</span>
          </div>
        </div>

        {/* Card 3: Xe ra trong ca */}
        <div className="pm-kpi-box">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">XE RA TRONG CA</span>
            <ArrowUpRight size={16} className="pm-kpi-icon teal" />
          </div>
          <div className="pm-kpi-metric">{exitsCount}</div>
          <div className="pm-kpi-detail-line pm-text-muted">
            <span>Doanh thu tiền mặt: ~1.280.000đ</span>
          </div>
        </div>

        {/* Card 4: Sự cố cần xử lý */}
        <div className={`pm-kpi-box ${incidentsCount > 0 ? "warning-highlight" : ""}`}>
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">SỰ CỐ CẦN XỬ LÝ</span>
            <AlertTriangle size={16} className="pm-kpi-icon red" />
          </div>
          <div className="pm-kpi-metric" style={{ color: incidentsCount > 0 ? "#f87171" : "#ffffff" }}>
            {incidentsCount}
          </div>
          <div className="pm-kpi-detail-line">
            <button
              type="button"
              className="pm-link-action"
              onClick={() => navigate("/staff/incidents")}
            >
              Xem danh sách sự cố &gt;
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="pm-grid-layout">
        {/* Left Column: Quick Search Module & Xe và hoạt động ca trực */}
        <div className="pm-main-stack">
          {/* 3. Tra cứu nhanh Biển số / Mã vé */}
          <div className="pm-panel pm-search-panel">
            <div className="pm-panel-header">
              <h2 className="pm-panel-title pm-flex-title">
                <Sparkles size={16} className="pm-icon-teal" />
                <span>Tra cứu nhanh Biển số / Mã vé</span>
              </h2>
            </div>
            <div className="pm-panel-body">
              <form onSubmit={handleQuickLookup} className="pm-quicksearch-row">
                <input
                  type="text"
                  className="pm-quicksearch-input"
                  placeholder="NHẬP 51K-892.45 HOẶC BK-261013..."
                  value={quickSearchInput}
                  onChange={(e) => setQuickSearchInput(e.target.value)}
                />
                <button type="submit" className="pm-quicksearch-btn">
                  Tìm xe
                </button>
              </form>
              <p className="pm-quicksearch-subtext">
                Tra cứu tức thì vị trí đỗ, thời gian gửi, hoặc chuyển nhanh sang màn hình thanh toán ra cổng.
              </p>
            </div>
          </div>

          {/* Xe và hoạt động ca trực */}
          <div className="pm-panel">
            <div className="pm-panel-header">
              <h2 className="pm-panel-title">Xe và hoạt động ca trực</h2>
              <button
                type="button"
                className="pm-view-all-btn"
                onClick={() => navigate("/staff/operations")}
              >
                Xem tất cả
              </button>
            </div>

            <div className="pm-panel-body">
              <div className="pm-activity-table">
                {events.slice(0, 6).map((evt) => (
                  <div key={evt.eventId} className="pm-activity-row">
                    <div className="pm-activity-icon-col">
                      <div className={`pm-act-badge ${evt.type === "CheckIn" ? "in" : evt.type === "CheckOut" ? "out" : "op"}`}>
                        {evt.type === "CheckIn" ? (
                          <ArrowDownLeft size={16} />
                        ) : evt.type === "CheckOut" ? (
                          <ArrowUpRight size={16} />
                        ) : (
                          <Car size={16} />
                        )}
                      </div>
                    </div>

                    <div className="pm-activity-desc-col">
                      <span className="pm-act-title">{evt.label}</span>
                      <span className="pm-act-sub">{evt.performedBy}</span>
                    </div>

                    <div className="pm-activity-badge-col">
                      <span className={`pm-status-pill ${evt.type === "CheckIn" ? "pill-teal" : evt.type === "CheckOut" ? "pill-blue" : "pill-gray"}`}>
                        {evt.type === "CheckIn" ? "Vào cổng" : evt.type === "CheckOut" ? "Đã ra bãi" : "Hoàn tất"}
                      </span>
                    </div>

                    <div className="pm-activity-time-col">
                      <span>{new Date(evt.occurredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Barrier & Equipment, Alerts, Real-time Logs */}
        <div className="pm-side-stack">
          {/* 4. Barrier & Equipment Status */}
          <div className="pm-panel">
            <div className="pm-panel-header">
              <h2 className="pm-panel-title">Barrier & Equipment Status</h2>
            </div>
            <div className="pm-panel-body">
              <div className="pm-equipment-list">
                <div className="pm-equipment-item">
                  <div className="pm-equipment-info">
                    <span className="pm-equipment-name">Cổng Vào G1 (Barrier 01 - ANPR)</span>
                    <span className="pm-equipment-sub">Camera nhận diện tự động</span>
                  </div>
                  <span className="pm-tag-online">Online</span>
                </div>
                <div className="pm-equipment-item">
                  <div className="pm-equipment-info">
                    <span className="pm-equipment-name">Cổng Ra G3 (Barrier 02 - POS)</span>
                    <span className="pm-equipment-sub">Quét QR & Thu phí tự động</span>
                  </div>
                  <span className="pm-tag-online">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Alerts & Handover Notes */}
          <div className="pm-panel">
            <div className="pm-panel-header">
              <h2 className="pm-panel-title">Alerts & Handover Notes</h2>
              <span className="pm-alert-counter">2 cảnh báo</span>
            </div>
            <div className="pm-panel-body">
              <div className="pm-notes-box">
                {/* Yellow Warning Alert Box */}
                <div className="pm-warning-alert-box">
                  <AlertTriangle size={17} className="pm-warning-icon" />
                  <div className="pm-warning-content">
                    <div className="pm-warning-text">Khu vực sạc xe điện Tầng B2 đạt 80% công suất</div>
                    <div className="pm-warning-time">Ưu tiên điều hướng xe xăng sang Zone A & Zone C</div>
                  </div>
                </div>

                {/* Additional Handover Note */}
                <div className="pm-note-item">
                  <CheckCircle2 size={15} color="#14b8a6" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>Bàn giao thiết bị đầy đủ; 2 thẻ dự phòng tại quầy trực bàn giao cho ca tối.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time log list */}
          <div className="pm-panel">
            <div className="pm-panel-header">
              <h2 className="pm-panel-title">Real time log list</h2>
              <button
                type="button"
                className="pm-view-all-btn"
                onClick={() => navigate("/staff/operations")}
              >
                Xem tất cả
              </button>
            </div>
            <div className="pm-panel-body">
              <div className="pm-log-timeline">
                {events.slice(0, 3).map((evt, idx) => (
                  <div key={evt.eventId || idx} className="pm-timeline-item">
                    <span className="pm-timeline-dot" />
                    <div className="pm-timeline-content">
                      <div className="pm-timeline-title">{evt.label}</div>
                      <div className="pm-timeline-meta">
                        {new Date(evt.occurredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
