import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Layers,
  Car,
  CreditCard,
  ArrowLeftRight,
  AlertTriangle,
  ChevronRight,
  Calendar,
  Box,
  Building2,
  ShieldCheck,
  Activity,
  Coins,
  RefreshCw,
} from "lucide-react";
import { managerApi } from "../../services/manager/managerApi";
import type {
  ManagerDashboardData,
  ReportingPeriod,
} from "../../types/manager";
import OccupancyAreaChart from "../../components/manager/OccupancyAreaChart";
import RevenueBarChart from "../../components/manager/RevenueBarChart";

interface OutletContextType {
  selectedLotId: string;
  setSelectedLotId: (id: string) => void;
  period: ReportingPeriod;
  setPeriod: (p: ReportingPeriod) => void;
  refreshKey: number;
  handleRefresh: () => void;
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { selectedLotId, period, refreshKey } =
    useOutletContext<OutletContextType>() || {
      selectedLotId: "all",
      period: "today",
      refreshKey: 0,
      handleRefresh: () => {},
    };

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load live manager dashboard data
  useEffect(() => {
    let active = true;
    async function fetchDashboard() {
      setLoading(true);
      setError(null);
      try {
        const result = await managerApi.getDashboardData(selectedLotId, period);
        if (active) {
          setData(result);
        }
      } catch (err: any) {
        if (active) {
          console.error("Dashboard data load error:", err);
          setError("Không thể kết nối đến máy chủ. Đang hiển thị bản chụp điều hành đã lưu.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchDashboard();
    return () => {
      active = false;
    };
  }, [selectedLotId, period, refreshKey]);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const todayStr = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  if (loading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", color: "#fff" }}>
        <RefreshCw size={36} className="pm-header-icon-btn spinning" style={{ background: "transparent", border: "none" }} />
        <p style={{ marginTop: 14, color: "#a8ccd4", fontSize: "14px", fontWeight: 600 }}>
          Đang đồng bộ dữ liệu thời gian thực từ mạng lưới bãi đỗ...
        </p>
      </div>
    );
  }

  const kpi = data?.kpi || {
    totalCapacity: 850,
    occupiedCount: 582,
    availableCount: 253,
    maintenanceCount: 15,
    capacityTrend: "+18 ô đỗ",
    occupancyRate: 68.5,
    occupancyRateChange: 4.2,
    peakHour: "08:30 - 09:45",
    peakRate: 88.4,
    todayRevenue: 64850000,
    todayRevenueChange: 8.5,
    cashRevenue: 27200000,
    digitalRevenue: 37650000,
    dailyRevenueTarget: 70000000,
    targetProgressPercent: 92,
    parkedVehicles: 582,
    todayEntries: 1030,
    todayExits: 860,
    evVehiclesCount: 93,
    motorcycleCount: 221,
    carCount: 268,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* ─── C. Welcome Banner Section ─────────────────────────────────── */}
      <section className="pm-welcome-row" aria-labelledby="welcome-heading">
        <div>
          <h1 id="welcome-heading" className="pm-welcome-title">
            Chào buổi sáng, Quản lý Trần Anh Tuấn 👋
          </h1>
          <p className="pm-welcome-sub">
            {todayStr} • Tổng quan vận hành và chỉ số hiệu suất thời gian thực các cơ sở bãi đỗ.
          </p>
        </div>

        <div className="pm-telemetry-pill">
          <Activity size={16} style={{ color: "#22d3ee" }} />
          <span>Hệ thống IoT V4: <strong>100% Hoạt Động</strong></span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>Không khí: <strong>Tốt (AQI 42)</strong></span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>Cập nhật: <strong>{data?.facility.lastUpdated || "Vừa xong"}</strong></span>
        </div>
      </section>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", padding: "10px 16px", borderRadius: "12px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* ─── D. 4 Primary KPI Statistics Cards ─────────────────────────── */}
      <section className="pm-kpi-grid" aria-label="Các chỉ số điều hành cốt lõi">
        {/* Card 1: Tổng công suất */}
        <div className="pm-kpi-card">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">Tổng Công Suất Bãi Xe</span>
            <div className="pm-kpi-icon-wrap teal">
              <Layers size={18} />
            </div>
          </div>
          <div className="pm-kpi-value-row">
            <span className="pm-kpi-value">{kpi.totalCapacity}</span>
            <span className="pm-kpi-unit">ô đỗ</span>
          </div>
          <div className="pm-card-progress-bar">
            <div
              className="pm-progress-fill"
              style={{ width: `${Math.min(100, (kpi.occupiedCount / kpi.totalCapacity) * 100)}%` }}
            />
          </div>
          <div className="pm-kpi-footer">
            <span className="pm-kpi-subtext">
              Đang đỗ: <strong>{kpi.occupiedCount}</strong> • Còn trống: <strong>{kpi.availableCount}</strong>
            </span>
            <span className="pm-kpi-trend positive" title="Công suất tăng">+18 mới</span>
          </div>
        </div>

        {/* Card 2: Tỷ lệ lấp đầy */}
        <div className="pm-kpi-card">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">Tỷ Lệ Lấp Đầy Hiện Tại</span>
            <div className="pm-kpi-icon-wrap cyan">
              <Car size={18} />
            </div>
          </div>
          <div className="pm-kpi-value-row">
            <span className="pm-kpi-value">{kpi.occupancyRate}%</span>
            <span className="pm-kpi-unit">công suất</span>
          </div>
          <div className="pm-card-progress-bar">
            <div
              className={`pm-progress-fill ${kpi.occupancyRate >= 80 ? "warning" : ""}`}
              style={{ width: `${Math.min(100, kpi.occupancyRate)}%` }}
            />
          </div>
          <div className="pm-kpi-footer">
            <span className="pm-kpi-subtext">
              Giờ cao điểm: <strong>{kpi.peakHour} ({kpi.peakRate}%)</strong>
            </span>
            <span className="pm-kpi-trend positive">+{kpi.occupancyRateChange}%</span>
          </div>
        </div>

        {/* Card 3: Doanh thu ghi nhận */}
        <div className="pm-kpi-card">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">
              Doanh Thu {period === "today" ? "Hôm Nay" : period === "week" ? "Tuần Này" : "Tháng Này"}
            </span>
            <div className="pm-kpi-icon-wrap green">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="pm-kpi-value-row">
            <span className="pm-kpi-value">{formatVnd(kpi.todayRevenue)}</span>
          </div>
          <div className="pm-card-progress-bar">
            <div
              className="pm-progress-fill"
              style={{ width: `${kpi.targetProgressPercent}%`, background: "linear-gradient(90deg, #10b981, #087f8c)" }}
            />
          </div>
          <div className="pm-kpi-footer">
            <span className="pm-kpi-subtext">
              Tiền mặt: <strong>{formatVnd(kpi.cashRevenue)}</strong> • Số: <strong>{formatVnd(kpi.digitalRevenue)}</strong>
            </span>
            <span className="pm-kpi-trend positive">+{kpi.todayRevenueChange}%</span>
          </div>
        </div>

        {/* Card 4: Hoạt động lượt xe */}
        <div className="pm-kpi-card">
          <div className="pm-kpi-header">
            <span className="pm-kpi-label">Lưu Lượng Phương Tiện</span>
            <div className="pm-kpi-icon-wrap navy">
              <ArrowLeftRight size={18} />
            </div>
          </div>
          <div className="pm-kpi-value-row">
            <span className="pm-kpi-value">{kpi.todayEntries + kpi.todayExits}</span>
            <span className="pm-kpi-unit">lượt xe</span>
          </div>
          <div className="pm-card-progress-bar">
            <div
              className="pm-progress-fill"
              style={{ width: "74%", background: "linear-gradient(90deg, #3b82f6, #06b6d4)" }}
            />
          </div>
          <div className="pm-kpi-footer">
            <span className="pm-kpi-subtext">
              Vào: <strong>{kpi.todayEntries}</strong> • Ra: <strong>{kpi.todayExits}</strong> • EV: <strong>{kpi.evVehiclesCount}</strong>
            </span>
            <span className="pm-kpi-trend positive">99.8% ANPR</span>
          </div>
        </div>
      </section>

      {/* ─── E & F. Two Large Analytics Panels (Occupancy & Revenue) ───── */}
      <section className="pm-analytics-grid" aria-label="Phân tích biểu đồ xu hướng">
        {/* E. Occupancy Area Chart */}
        <OccupancyAreaChart
          data={data?.occupancyTrend || []}
          totalCapacity={kpi.totalCapacity}
        />

        {/* F. Revenue & Payment Method Bar Chart */}
        <RevenueBarChart
          data={data?.revenueTrend || []}
          totalTodayRevenue={kpi.todayRevenue}
        />
      </section>

      {/* ─── G & H & I. Operational Details & Live Facilities Grid ──────── */}
      <div className="pm-lower-grid">
        {/* Left Column: Live Facilities & Recent Events */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* G. Live Facilities Overview */}
          <div className="pm-facilities-card">
            <div className="pm-section-card-header">
              <h2 className="pm-section-card-title">
                <Building2 size={19} style={{ color: "#087f8c" }} />
                <span>Trạng Thái Các Cơ Sở Bãi Đỗ Phụ Trách ({data?.allFacilities.length || 3})</span>
              </h2>
              <button
                type="button"
                className="pm-btn-secondary"
                onClick={() => navigate("/booking")}
                title="Mở sơ đồ mô phỏng 3D"
              >
                <Box size={14} />
                <span>Sơ Đồ 3D Toàn Cảnh</span>
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="pm-facility-table">
                <thead>
                  <tr>
                    <th>Bãi Đỗ Xe & Địa Chỉ</th>
                    <th>Công Suất</th>
                    <th>Tỷ Lệ Đỗ</th>
                    <th>Doanh Thu Hôm Nay</th>
                    <th>Trạng Thái</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.allFacilities || []).map((fac) => {
                    const isNearCap = fac.occupancyRate >= 80;
                    return (
                      <tr key={fac.lotId} className="pm-facility-row">
                        <td>
                          <div className="pm-fac-name-col">
                            <strong>{fac.name}</strong>
                            <small>{fac.address}</small>
                          </div>
                        </td>
                        <td>
                          <strong>{fac.occupiedCount}</strong> / {fac.totalCapacity} chỗ
                          <div style={{ fontSize: "11px", color: "#16a34a" }}>
                            Trống: {fac.availableCount}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "70px", height: "6px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${fac.occupancyRate}%`,
                                  background: isNearCap ? "#f59e0b" : "#087f8c",
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 800, fontSize: "12px", color: isNearCap ? "#b45309" : "#087f8c" }}>
                              {fac.occupancyRate}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{formatVnd(fac.todayRevenue)}</strong>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {fac.todayEntries} lượt xe
                          </div>
                        </td>
                        <td>
                          <span className={`pm-status-chip ${isNearCap ? "nearcapacity" : "active"}`}>
                            {isNearCap ? "Sắp đầy" : "Bình thường"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="pm-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => navigate("/booking")}
                          >
                            <span>Xem 3D</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* H. Recent Operational Activity Feed */}
          <div className="pm-activity-card">
            <div className="pm-section-card-header">
              <h2 className="pm-section-card-title">
                <Activity size={19} style={{ color: "#087f8c" }} />
                <span>Nhật Ký Vận Hành Trực Tuyến</span>
              </h2>
              <button
                type="button"
                className="pm-btn-secondary"
                onClick={() => navigate("/staff/operations")}
              >
                <span>Xem tất cả lượt xe</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="pm-activity-list">
              {(data?.recentActivities || []).map((act) => (
                <div key={act.id} className="pm-activity-item">
                  <div className={`pm-act-icon ${act.type}`}>
                    {act.type === "entry" && <Car size={16} />}
                    {act.type === "exit" && <ArrowLeftRight size={16} />}
                    {act.type === "payment" && <Coins size={16} />}
                    {act.type === "reservation" && <Box size={16} />}
                    {act.type === "incident" && <AlertTriangle size={16} />}
                    {act.type === "staff" && <ShieldCheck size={16} />}
                  </div>
                  <div className="pm-act-body">
                    <div className="pm-act-title-row">
                      <span className="pm-act-title">{act.title}</span>
                      <span className="pm-act-time">{act.timestamp}</span>
                    </div>
                    <div className="pm-act-desc">
                      {act.licensePlate && (
                        <span className="pm-act-plate">{act.licensePlate}</span>
                      )}
                      {act.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Schedule / Calendar & Alerts (Admin Dashboard V7 Style) */}
        <div className="pm-right-column">
          {/* I. Actionable Alerts & Exceptions */}
          <div className="pm-alerts-card">
            <div className="pm-section-card-header">
              <h2 className="pm-section-card-title">
                <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
                <span>Cảnh Báo Vận Hành ({data?.alerts.length || 0})</span>
              </h2>
              <button
                type="button"
                className="pm-btn-secondary"
                onClick={() => navigate("/staff/incidents")}
              >
                <span>Sự cố</span>
              </button>
            </div>

            <div className="pm-alerts-list">
              {(data?.alerts || []).map((alt) => (
                <div key={alt.id} className={`pm-alert-item ${alt.severity}`}>
                  <div className="pm-alert-header">
                    <span className="pm-alert-title">{alt.title}</span>
                    <small style={{ color: "#94a3b8" }}>{alt.createdAt}</small>
                  </div>
                  <p className="pm-alert-desc">{alt.description}</p>
                  {alt.actionLabel && (
                    <button
                      type="button"
                      className="pm-alert-action-btn"
                      onClick={() => navigate(alt.actionUrl || "/staff/incidents")}
                    >
                      <span>{alt.actionLabel}</span>
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mini Schedule / Duty Calendar Widget */}
          <div className="pm-schedule-card">
            <div className="pm-section-card-header">
              <h2 className="pm-section-card-title">
                <Calendar size={18} style={{ color: "#087f8c" }} />
                <span>Lịch Trực & Ca Phân Công</span>
              </h2>
            </div>

            <div className="pm-calendar-widget">
              <div className="pm-calendar-header">
                <span>Tháng {new Date().getMonth() + 1}, {new Date().getFullYear()}</span>
                <span style={{ fontSize: "12px", color: "#087f8c", fontWeight: 700 }}>Hôm nay: Ngày {new Date().getDate()}</span>
              </div>

              <div className="pm-calendar-days-grid">
                <div className="pm-cal-day-label">T2</div>
                <div className="pm-cal-day-label">T3</div>
                <div className="pm-cal-day-label">T4</div>
                <div className="pm-cal-day-label">T5</div>
                <div className="pm-cal-day-label">T6</div>
                <div className="pm-cal-day-label">T7</div>
                <div className="pm-cal-day-label">CN</div>

                {/* Sample interactive calendar days */}
                {[19, 20, 21, 22, 23, 24, 25].map((d) => {
                  const isCurrent = d === new Date().getDate();
                  return (
                    <div
                      key={d}
                      className={`pm-cal-day-cell ${isCurrent ? "today" : ""}`}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Staff Roster Overview */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "8px" }}>
                NHÂN SỰ TRỰC CA HIỆN TẠI
              </div>
              <div className="pm-roster-list">
                {(data?.staffRoster || []).map((staff) => (
                  <div key={staff.id} className="pm-roster-item">
                    <div className="pm-roster-info">
                      <div className="pm-roster-avatar">
                        {staff.staffName.split(" ").pop()?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="pm-roster-meta">
                        <div className="pm-roster-name">{staff.staffName}</div>
                        <div className="pm-roster-role">{staff.role} • {staff.lotName}</div>
                      </div>
                    </div>
                    <span className="pm-roster-shift-badge">
                      {staff.status === "OnDuty" ? "Đang trực" : "Đã xếp lịch"}
                    </span>
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
