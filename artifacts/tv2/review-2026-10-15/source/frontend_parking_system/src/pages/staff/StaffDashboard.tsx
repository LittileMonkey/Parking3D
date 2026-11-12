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
  Layers,
  ChevronRight,
  Radio,
  CheckCircle2,
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
  const [quickPlate, setQuickPlate] = useState("");

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
    if (quickPlate.trim()) {
      navigate(`/staff/operations?plate=${encodeURIComponent(quickPlate.trim())}`);
    }
  };

  if (loading && !overview) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        <p>Đang tải dữ liệu tổng quan ca trực...</p>
      </div>
    );
  }

  const occupancyRate = overview ? Math.round((overview.occupiedCount / overview.totalCapacity) * 100) : 0;

  return (
    <div>
      {/* Page Title & Quick Actions */}
      <div className="staff-page-header">
        <div>
          <h1 className="staff-page-title">
            <Radio size={24} color="var(--teal)" />
            Trung tâm Điều hành Ca trực
          </h1>
          <p className="staff-page-desc">
            Giám sát vận hành bãi xe thời gian thực • Cập nhật tự động mỗi 10 giây
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="staff-quick-btn staff-btn-primary"
            onClick={() => navigate("/staff/operations")}
          >
            <ArrowDownLeft size={16} />
            <span>Tiếp nhận Xe Vào</span>
          </button>
          <button
            type="button"
            className="staff-quick-btn staff-btn-secondary"
            onClick={() => navigate("/staff/operations?tab=checkout")}
          >
            <ArrowUpRight size={16} />
            <span>Xử lý Xe Ra</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="staff-kpi-grid">
        {/* Tỷ lệ lấp đầy */}
        <div className="staff-kpi-card">
          <div className="staff-kpi-header">
            <span>TỶ LỆ LẤP ĐẦY</span>
            <Car size={18} color="var(--teal)" />
          </div>
          <div className="staff-kpi-value">
            {occupancyRate}%
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)", marginLeft: 6 }}>
              ({overview?.occupiedCount}/{overview?.totalCapacity} xe)
            </span>
          </div>
          <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${occupancyRate}%`,
                height: "100%",
                background: occupancyRate > 85 ? "var(--red)" : occupancyRate > 70 ? "var(--amber)" : "var(--teal)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div className="staff-kpi-meta">
            <span style={{ color: "var(--green)", fontWeight: 600 }}>{overview?.availableCount} chỗ trống</span>
            <span>• 3 đang bảo trì</span>
          </div>
        </div>

        {/* Lượt xe vào trong ca */}
        <div className="staff-kpi-card success">
          <div className="staff-kpi-header">
            <span>XE VÀO TRONG CA</span>
            <ArrowDownLeft size={18} color="var(--green)" />
          </div>
          <div className="staff-kpi-value">{overview?.todayEntries ?? 0}</div>
          <div className="staff-kpi-meta">
            <TrendingUp size={14} color="var(--green)" />
            <span>+12% so với ca trước</span>
          </div>
        </div>

        {/* Lượt xe ra trong ca */}
        <div className="staff-kpi-card">
          <div className="staff-kpi-header">
            <span>XE RA TRONG CA</span>
            <ArrowUpRight size={18} color="var(--teal)" />
          </div>
          <div className="staff-kpi-value">{overview?.todayExits ?? 0}</div>
          <div className="staff-kpi-meta">
            <span>Doanh thu thu tiền mặt: ~1.280.000đ</span>
          </div>
        </div>

        {/* Sự cố đang mở */}
        <div className={`staff-kpi-card ${overview && overview.openIncidents > 0 ? "warning" : ""}`}>
          <div className="staff-kpi-header">
            <span>SỰ CỐ CẦN XỬ LÝ</span>
            <AlertTriangle size={18} color={overview && overview.openIncidents > 0 ? "var(--amber)" : "var(--muted)"} />
          </div>
          <div className="staff-kpi-value" style={{ color: overview && overview.openIncidents > 0 ? "#b45309" : undefined }}>
            {overview?.openIncidents ?? 0}
          </div>
          <div className="staff-kpi-meta">
            <span
              style={{ cursor: "pointer", textDecoration: "underline", color: "var(--teal)" }}
              onClick={() => navigate("/staff/incidents")}
            >
              Xem danh sách sự cố &gt;
            </span>
          </div>
        </div>
      </div>

      {/* Quick Lookup & Gate Monitoring */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 24 }}>
        {/* Tra cứu nhanh biển số */}
        <div className="staff-card" style={{ marginBottom: 0 }}>
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <Sparkles size={16} color="var(--teal)" />
              Tra cứu nhanh Biển số / Mã vé
            </h2>
          </div>
          <div className="staff-card-body">
            <form onSubmit={handleQuickLookup} style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                className="staff-input"
                style={{ flex: 1, textTransform: "uppercase" }}
                placeholder="Nhập 51K-892.45 hoặc BK-261013..."
                value={quickPlate}
                onChange={(e) => setQuickPlate(e.target.value)}
              />
              <button type="submit" className="staff-quick-btn staff-btn-primary">
                Tìm xe
              </button>
            </form>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Tra cứu tức thì vị trí đỗ, thời gian gửi, hoặc chuyển nhanh sang màn hình thanh toán ra cổng.
            </p>
          </div>
        </div>

        {/* Trạng thái cổng vào / ra */}
        <div className="staff-card" style={{ marginBottom: 0 }}>
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <Layers size={16} color="var(--teal)" />
              Giám sát Cổng & Thiết bị Barrier
            </h2>
          </div>
          <div className="staff-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="live-dot" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Cổng Vào G1 (ANPR Cam 01)</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Tự động nhận diện biển số • Barrier hoạt động</div>
                </div>
              </div>
              <span className="staff-badge badge-available">Online</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="live-dot" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Cổng Ra G3 (ANPR Cam 02)</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Đầu đọc QR & Máy in biên nhận • Sẵn sàng</div>
                </div>
              </div>
              <span className="staff-badge badge-available">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Alerts & Activities */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {/* Cảnh báo vận hành */}
        <div className="staff-card">
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <ShieldAlert size={16} color="var(--red)" />
              Cảnh báo & Lưu ý Vận hành
            </h2>
            <span className="staff-badge badge-progress">{alerts.length} cảnh báo</span>
          </div>
          <div className="staff-card-body" style={{ padding: "12px 20px" }}>
            {alerts.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "10px 0" }}>Không có cảnh báo nghiêm trọng.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((alt) => (
                  <div
                    key={alt.alertId}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: alt.severity === "Critical" ? "#fca5a5" : "#fde047",
                      background: alt.severity === "Critical" ? "#fef2f2" : "#fefce8",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <AlertTriangle
                      size={18}
                      color={alt.severity === "Critical" ? "var(--red)" : "var(--amber)"}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{alt.message}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        {new Date(alt.createdAt).toLocaleTimeString("vi-VN")} • Phân loại: {alt.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dòng hoạt động gần nhất */}
        <div className="staff-card">
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <Clock size={16} color="var(--teal)" />
              Nhật ký Vận hành Thời gian thực
            </h2>
            <button
              type="button"
              className="staff-btn-secondary"
              style={{ fontSize: 12, padding: "4px 8px" }}
              onClick={() => navigate("/staff/operations")}
            >
              Xem tất cả <ChevronRight size={14} />
            </button>
          </div>
          <div className="staff-card-body" style={{ padding: "12px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {events.slice(0, 5).map((evt) => (
                <div key={evt.eventId} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: evt.type === "CheckIn" ? "#dcfce7" : evt.type === "CheckOut" ? "#e0f2fe" : "#fef3c7",
                      color: evt.type === "CheckIn" ? "#16a34a" : evt.type === "CheckOut" ? "#0284c7" : "#d97706",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {evt.type === "CheckIn" ? (
                      <ArrowDownLeft size={14} />
                    ) : evt.type === "CheckOut" ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", wordBreak: "break-word" }}>
                      {evt.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {new Date(evt.occurredAt).toLocaleTimeString("vi-VN")} • Thực hiện: {evt.performedBy}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
