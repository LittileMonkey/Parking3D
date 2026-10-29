import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Layers,
  Car,
  CreditCard,
  ArrowLeftRight,
  AlertTriangle,
  ChevronRight,
  Box,
  Building2,
  Activity,
  Coins,
  RefreshCw,
  Search,
  Plus,
  MessageSquare,
  CheckCircle2,
  Clock,
  Zap,
  Sun,
  Moon,
  ChevronLeft,
  X,
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
  theme?: "dark" | "light";
  toggleTheme?: () => void;
}

interface OperationalDrillItem {
  id: string;
  badge: string;
  badgeType: "green" | "teal" | "orange" | "blue" | "slate";
  title: string;
  subtitle: string;
  statusText: string;
  statusType: "completed" | "in-progress" | "scheduled";
  details: {
    zone: string;
    capacity: string;
    rate: string;
    notes: string;
  };
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext<OutletContextType>() || {
    selectedLotId: "all",
    period: "today",
    refreshKey: 0,
    handleRefresh: () => {},
  };
  const { selectedLotId, period, refreshKey, theme = "dark", toggleTheme } = outletCtx;

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // View switch: "admin" (Dashboard 1 - Screenshot style) vs "deep" (Dashboard 2 - Deep Analytics)
  const [activeDashboardTab, setActiveDashboardTab] = useState<"admin" | "deep">("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDrill, setSelectedDrill] = useState<OperationalDrillItem | null>(null);
  const [selectedCalDay, setSelectedCalDay] = useState<number>(23);
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);

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

  // 5 Operational Drills / Strip items matching the screenshot layout
  const drillItems: OperationalDrillItem[] = [
    {
      id: "drill-1",
      badge: "L1 - Ô Đỗ Thường (Available: 142/160)",
      badgeType: "green",
      title: "Metropolis Central - Tầng L1 Khu A & B (Cảm biến 100% Online)",
      subtitle: "Biểu phí: 15.000 đ/giờ • Giữ chỗ tự động 15 phút • Cảm biến siêu âm độ trễ 200ms",
      statusText: "Completed ✓",
      statusType: "completed",
      details: {
        zone: "Tầng L1 - Zone A & Zone B",
        capacity: "142 ô khả dụng / 160 tổng ô",
        rate: "15.000 đ/block 60 phút",
        notes: "Tất cả 160 cảm biến siêu âm hoạt động ổn định, đèn LED xanh/đỏ chỉ dẫn chính xác.",
      },
    },
    {
      id: "drill-2",
      badge: "Khu B - Sạc Nhanh Xe Điện EV (8/12 trụ)",
      badgeType: "teal",
      title: "Trụ sạc DC Fast Charge 120kW - 4 trụ đang sạc công suất cao",
      subtitle: "Công suất tiêu thụ: 480kW • Phụ thu sạc: 3.500 đ/kWh • Tự động ngắt khi đầy",
      statusText: "Completed ✓",
      statusType: "completed",
      details: {
        zone: "Tầng L1 - Zone B Điện",
        capacity: "8 trụ trống / 12 trụ tổng",
        rate: "3.500 đ/kWh + phí đỗ thông thường",
        notes: "4 xe ô tô điện VinFast VF8 & Porsche Taycan đang sạc, hệ thống PCCC pin Lithium đạt chuẩn.",
      },
    },
    {
      id: "drill-3",
      badge: "Surge Multiplier Peak (1.25x Active)",
      badgeType: "orange",
      title: "Áp dụng tự động khung giờ cao điểm 08:30 - 11:30 | Doanh thu +18%",
      subtitle: "Ngưỡng kích hoạt: Lấp đầy > 80% • Giá tạm tính: 18.750 đ/giờ • Báo động bãi xe đầy",
      statusText: "In Progress ⚡",
      statusType: "in-progress",
      details: {
        zone: "Toàn bộ bãi xe Metropolis",
        capacity: "Lấp đầy hiện tại: 68.5% (Dự báo chạm 88% lúc 09:15)",
        rate: "Hệ số Surge 1.25x (Tự động theo chính sách Dynamic Pricing)",
        notes: "Hệ thống tự động bật hệ số nhằm cân bằng lưu lượng và tối đa hóa doanh thu.",
      },
    },
    {
      id: "drill-4",
      badge: "Bảo Trì Barrier Cổng Tây (Zone C)",
      badgeType: "blue",
      title: "Hiệu chuẩn cảm biến camera nhận diện biển số xe ANPR 4K",
      subtitle: "Thời gian dự kiến: 14:00 - 14:30 • Chuyển lưu lượng sang Cổng Đông • Staff trực hỗ trợ",
      statusText: "Scheduled 📅",
      statusType: "scheduled",
      details: {
        zone: "Cổng kiểm soát phía Tây (Gate 02)",
        capacity: "Tạm đóng 1 làn xe vào",
        rate: "Kế hoạch định kỳ thứ Năm hàng tuần",
        notes: "Độ chính xác nhận diện biển số hiện tại 99.8%, bảo trì ống kính chống lóa ngược sáng.",
      },
    },
    {
      id: "drill-5",
      badge: "Kiểm Toán & Đối Soát Doanh Thu Ca Sáng",
      badgeType: "slate",
      title: "Tổng đối soát 64.850.000 đ (VNPay: 58%, Tiền mặt: 42%)",
      subtitle: "Trưởng ca Nguyễn Văn Hùng • Chênh lệch quỹ: 0 đ • Chờ phê duyệt kết ca 12:00",
      statusText: "Scheduled",
      statusType: "scheduled",
      details: {
        zone: "Phòng điều hành & Quầy thu ngân",
        capacity: "1.030 lượt vào, 860 lượt ra",
        rate: "Tiền mặt: 27.200.000 đ | VNPay QR: 37.650.000 đ",
        notes: "Toàn bộ mã giao dịch VNPay đã được reconcile tự động với webhook ngân hàng.",
      },
    },
  ];

  const filteredDrills = searchQuery.trim()
    ? drillItems.filter(
        (d) =>
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : drillItems;

  if (loading && !data) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          color: "var(--pm-text-heading)",
        }}
      >
        <RefreshCw
          size={36}
          className="pm-header-icon-btn spinning"
          style={{ background: "transparent", border: "none" }}
        />
        <p style={{ marginTop: 14, color: "var(--pm-text-muted)", fontSize: "14px", fontWeight: 600 }}>
          Đang đồng bộ dữ liệu thời gian thực từ mạng lưới bãi đỗ...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", color: "#fca5a5", fontSize: "13px" }}>
          ⚠️ {error}
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: DASHBOARD 1 (ADMIN) — THE SIGNATURE SCREENSHOT REDESIGN
          ═══════════════════════════════════════════════════════════════════ */}
      {activeDashboardTab === "admin" && (
        <div className="pm-v8-layout">
          {/* ─── 1. Main Center Floating Card ───────────────────────────── */}
          <section className="pm-v8-center-card" aria-label="Kế hoạch điều hành bãi đỗ">
            {/* Header: Greeting + Capsule Search + Quick Icons */}
            <div className="pm-v8-header">
              <div className="pm-v8-greeting-block">
                <h1 className="pm-v8-greeting-title">
                  Good Morning, Lionel 👋
                </h1>
                <p className="pm-v8-greeting-sub">
                  Let's optimize parking operations today • Metropolis Central Hub
                </p>
              </div>

              <div className="pm-v8-header-actions">
                {/* Capsule Search Input */}
                <div className="pm-v8-search-pill">
                  <Search size={15} style={{ color: "var(--pm-text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search something here..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Tìm kiếm thao tác vận hành"
                  />
                  <span className="pm-v8-shortcut">⌘K</span>
                </div>

                {/* Dark / Light Mode Toggle Pill */}
                {toggleTheme && (
                  <button
                    type="button"
                    className="pm-v8-theme-pill-btn"
                    onClick={toggleTheme}
                    title="Chuyển đổi chế độ Sáng / Tối"
                  >
                    {theme === "dark" ? <Sun size={15} style={{ color: "#ff7828" }} /> : <Moon size={15} style={{ color: "#087f8c" }} />}
                    <span>{theme === "dark" ? "Light" : "Dark"}</span>
                  </button>
                )}

                {/* Notification icon button */}
                <button
                  type="button"
                  className="pm-v8-round-btn"
                  onClick={() => navigate("/manager/incidents-approvals")}
                  title="3 phê duyệt ngoại lệ cần xử lý"
                >
                  <AlertTriangle size={16} style={{ color: "#ff7828" }} />
                  <span className="pm-dock-badge" />
                </button>
              </div>
            </div>

            {/* Section Banner: Title + Orange Pill Button (+ New Drill style) */}
            <div className="pm-v8-section-banner">
              <div className="pm-v8-section-title-wrap">
                <h2 className="pm-v8-section-title">
                  Weekly Elite Parking Operations
                </h2>
                <p className="pm-v8-section-subtitle">
                  5 mục tiêu điều phối ưu tiên cao • Cảm biến IoT 100% Online
                </p>
              </div>

              <button
                type="button"
                className="pm-v8-orange-pill-cta"
                onClick={() => setShowQuickActionModal(true)}
              >
                <Plus size={16} />
                <span>+ Thêm thao tác</span>
              </button>
            </div>

            {/* List of 5 High-Contrast Rounded Strips (Card Items) */}
            <div className="pm-v8-strips-list">
              {filteredDrills.map((item) => (
                <div
                  key={item.id}
                  className="pm-v8-strip-card"
                  onClick={() => setSelectedDrill(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedDrill(item)}
                  title="Nhấn để xem chi tiết thông số vận hành"
                >
                  <div className="pm-v8-strip-left">
                    <div className="pm-v8-strip-tag-row">
                      <span className={`pm-v8-strip-tag ${item.badgeType}`}>
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="pm-v8-strip-title">{item.title}</h3>
                    <p className="pm-v8-strip-subtitle">{item.subtitle}</p>
                  </div>

                  <div className="pm-v8-strip-right">
                    <span className={`pm-v8-strip-status ${item.statusType}`}>
                      {item.statusText}
                    </span>
                    <ChevronRight size={16} style={{ color: "var(--pm-strip-sub)", opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── 2. Right Floating Companion Card ────────────────────────── */}
          <aside className="pm-v8-right-card" aria-label="Hồ sơ quản lý và lịch trình">
            {/* User Profile Card */}
            <div className="pm-v8-profile-header">
              <div className="pm-v8-user-info">
                <div className="pm-v8-user-avatar">LM</div>
                <div className="pm-v8-user-names">
                  <span className="pm-v8-user-fullname">Lionel Messi</span>
                  <span className="pm-v8-user-handle">@manager</span>
                </div>
              </div>

              <button
                type="button"
                className="pm-v8-round-btn"
                style={{ width: "32px", height: "32px" }}
                onClick={() => navigate("/manager/reports-audit")}
                title="Tùy chọn quản trị"
              >
                •••
              </button>
            </div>

            {/* 3 Quick Stat Pills (Occupancy, Revenue, Total Slots) */}
            <div className="pm-v8-stat-pills-row">
              <div className="pm-v8-stat-pill">
                <span className="pm-v8-stat-pill-val">{kpi.occupancyRate}%</span>
                <span className="pm-v8-stat-pill-label">Lấp Đầy</span>
              </div>
              <div className="pm-v8-stat-pill">
                <span className="pm-v8-stat-pill-val">64.8M</span>
                <span className="pm-v8-stat-pill-label">Doanh Thu</span>
              </div>
              <div className="pm-v8-stat-pill">
                <span className="pm-v8-stat-pill-val">{kpi.totalCapacity}</span>
                <span className="pm-v8-stat-pill-label">Tổng Ô</span>
              </div>
            </div>

            {/* Mini Calendar Widget (December 2026 style) */}
            <div className="pm-v8-calendar-wrap">
              <div className="pm-v8-calendar-header">
                <span className="pm-v8-calendar-month-title">December 2026</span>
                <div className="pm-v8-calendar-nav-btns">
                  <button type="button" className="pm-v8-cal-arrow-btn" title="Tháng trước">
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" className="pm-v8-cal-arrow-btn" title="Tháng sau">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="pm-v8-cal-weekdays">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              <div className="pm-v8-cal-grid">
                {/* 31 days representation with screenshot highlights */}
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  let specialClass = "";
                  if (day === 8) specialClass = "active-red"; // Incident day
                  else if (day === 15 || day === 29) specialClass = "active-green"; // High revenue peak
                  else if (day === selectedCalDay) specialClass = "active-orange"; // Selected active day

                  return (
                    <div
                      key={day}
                      className={`pm-v8-cal-day ${specialClass}`}
                      onClick={() => setSelectedCalDay(day)}
                      role="button"
                      tabIndex={0}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scheduled / Live Feed Section */}
            <div className="pm-v8-scheduled-section">
              <div className="pm-v8-scheduled-title-row">
                <span className="pm-v8-scheduled-accent-line" />
                <h4 className="pm-v8-scheduled-title">Scheduled</h4>
              </div>

              <div className="pm-v8-feed-list">
                <div className="pm-v8-feed-item">
                  <div className="pm-v8-feed-thumb">
                    <Car size={18} />
                  </div>
                  <div className="pm-v8-feed-details">
                    <span className="pm-v8-feed-name">Check-in: 30F-889.92</span>
                    <span className="pm-v8-feed-sub">Cổng 1 • L1-A04 • 2 phút trước</span>
                  </div>
                </div>

                <div className="pm-v8-feed-item">
                  <div className="pm-v8-feed-thumb">
                    <Coins size={18} />
                  </div>
                  <div className="pm-v8-feed-details">
                    <span className="pm-v8-feed-name">Thanh toán VNPay 45.000đ</span>
                    <span className="pm-v8-feed-sub">51G-123.45 • 6 phút trước</span>
                  </div>
                </div>

                <div className="pm-v8-feed-item">
                  <div className="pm-v8-feed-thumb">
                    <Clock size={18} />
                  </div>
                  <div className="pm-v8-feed-details">
                    <span className="pm-v8-feed-name">Giải phóng Hold Slot</span>
                    <span className="pm-v8-feed-sub">L2-B12 (Timeout 15p) • 14 phút trước</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Action Circle Triggers (Bottom Right of Screenshot) */}
            <div className="pm-v8-floating-actions">
              <button
                type="button"
                className="pm-v8-circle-trigger green"
                onClick={() => navigate("/staff/operations")}
                title="Hỗ trợ hotline điều phối bãi xe"
              >
                <MessageSquare size={20} />
              </button>

              <button
                type="button"
                className="pm-v8-circle-trigger pink"
                onClick={() => setShowQuickActionModal(true)}
                title="Thao tác khẩn cấp / Đặt chỗ cưỡng chế"
              >
                <Plus size={22} />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: DASHBOARD 2 (DEEP VIEWS & ANALYTICS) — METRICS & CHARTS
          ═══════════════════════════════════════════════════════════════════ */}
      {activeDashboardTab === "deep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px", padding: "0 16px 80px 16px" }}>
          {/* Welcome telemetry row */}
          <div className="pm-welcome-row">
            <div>
              <h2 className="pm-welcome-title" style={{ fontSize: "22px" }}>
                Phân Tích Dữ Liệu Chuyên Sâu (Deep Analytics)
              </h2>
              <p className="pm-welcome-sub">
                Đồ thị tỷ lệ lấp đầy, dòng tiền thanh toán số và phân bổ các cơ sở thời gian thực.
              </p>
            </div>
            <div className="pm-telemetry-pill">
              <Activity size={16} style={{ color: "#22d3ee" }} />
              <span>Hệ thống IoT V4: <strong>100% Hoạt Động</strong></span>
            </div>
          </div>

          {/* 4 Primary KPI Cards */}
          <div className="pm-kpi-grid">
            <div className="pm-kpi-card">
              <div className="pm-kpi-header">
                <span className="pm-kpi-label">Tổng Công Suất Bãi Xe</span>
                <div className="pm-kpi-icon-wrap teal"><Layers size={18} /></div>
              </div>
              <div className="pm-kpi-value-row">
                <span className="pm-kpi-value">{kpi.totalCapacity}</span>
                <span className="pm-kpi-unit">ô đỗ</span>
              </div>
              <div className="pm-card-progress-bar">
                <div className="pm-progress-fill" style={{ width: `${(kpi.occupiedCount / kpi.totalCapacity) * 100}%` }} />
              </div>
              <div className="pm-kpi-footer">
                <span className="pm-kpi-subtext">Đang đỗ: <strong>{kpi.occupiedCount}</strong> • Trống: <strong>{kpi.availableCount}</strong></span>
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-header">
                <span className="pm-kpi-label">Tỷ Lệ Lấp Đầy Hiện Tại</span>
                <div className="pm-kpi-icon-wrap cyan"><Car size={18} /></div>
              </div>
              <div className="pm-kpi-value-row">
                <span className="pm-kpi-value">{kpi.occupancyRate}%</span>
                <span className="pm-kpi-unit">công suất</span>
              </div>
              <div className="pm-card-progress-bar">
                <div className="pm-progress-fill warning" style={{ width: `${kpi.occupancyRate}%` }} />
              </div>
              <div className="pm-kpi-footer">
                <span className="pm-kpi-subtext">Cao điểm: <strong>{kpi.peakHour} ({kpi.peakRate}%)</strong></span>
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-header">
                <span className="pm-kpi-label">Doanh Thu Ghi Nhận</span>
                <div className="pm-kpi-icon-wrap green"><CreditCard size={18} /></div>
              </div>
              <div className="pm-kpi-value-row">
                <span className="pm-kpi-value">{formatVnd(kpi.todayRevenue)}</span>
              </div>
              <div className="pm-card-progress-bar">
                <div className="pm-progress-fill" style={{ width: `${kpi.targetProgressPercent}%` }} />
              </div>
              <div className="pm-kpi-footer">
                <span className="pm-kpi-subtext">Tiền mặt: <strong>{formatVnd(kpi.cashRevenue)}</strong> • Số: <strong>{formatVnd(kpi.digitalRevenue)}</strong></span>
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-header">
                <span className="pm-kpi-label">Lưu Lượng Phương Tiện</span>
                <div className="pm-kpi-icon-wrap navy"><ArrowLeftRight size={18} /></div>
              </div>
              <div className="pm-kpi-value-row">
                <span className="pm-kpi-value">{kpi.todayEntries + kpi.todayExits}</span>
                <span className="pm-kpi-unit">lượt xe</span>
              </div>
              <div className="pm-card-progress-bar">
                <div className="pm-progress-fill" style={{ width: "75%" }} />
              </div>
              <div className="pm-kpi-footer">
                <span className="pm-kpi-subtext">Vào: <strong>{kpi.todayEntries}</strong> • Ra: <strong>{kpi.todayExits}</strong></span>
              </div>
            </div>
          </div>

          {/* Large Analytics Panels (Occupancy & Revenue Charts) */}
          <div className="pm-analytics-grid">
            <OccupancyAreaChart data={data?.occupancyTrend || []} totalCapacity={kpi.totalCapacity} />
            <RevenueBarChart data={data?.revenueTrend || []} totalTodayRevenue={kpi.todayRevenue} />
          </div>

          {/* Managed Facilities Table */}
          <div className="pm-facilities-card">
            <div className="pm-section-card-header">
              <h3 className="pm-section-card-title">
                <Building2 size={18} style={{ color: "#14afbe" }} />
                <span>Trạng Thái Các Cơ Sở Bãi Đỗ ({data?.allFacilities.length || 3})</span>
              </h3>
              <button type="button" className="pm-btn-secondary" onClick={() => navigate("/booking")}>
                <Box size={14} /> <span>Xem Sơ Đồ 3D</span>
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
                  </tr>
                </thead>
                <tbody>
                  {(data?.allFacilities || []).map((fac) => (
                    <tr key={fac.lotId} className="pm-facility-row">
                      <td><strong>{fac.name}</strong><br /><small style={{ opacity: 0.7 }}>{fac.address}</small></td>
                      <td><strong>{fac.occupiedCount}</strong> / {fac.totalCapacity} chỗ</td>
                      <td><strong>{fac.occupancyRate}%</strong></td>
                      <td><strong>{formatVnd(fac.todayRevenue)}</strong></td>
                      <td><span className="pm-status-chip active">Bình thường</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FLOATING BOTTOM DOCK SELECTOR (PILL TABS)
          [ Dashboard 1 (Admin) ]   [ Dashboard 2 (Deep Views) ]
          ═══════════════════════════════════════════════════════════════════ */}
      <nav className="pm-v8-bottom-dock" aria-label="Bộ chọn giao diện Dashboard">
        <button
          type="button"
          className={`pm-v8-bottom-dock-tab ${activeDashboardTab === "admin" ? "active" : ""}`}
          onClick={() => setActiveDashboardTab("admin")}
        >
          Dashboard 1 (Admin)
        </button>
        <button
          type="button"
          className={`pm-v8-bottom-dock-tab ${activeDashboardTab === "deep" ? "active" : ""}`}
          onClick={() => setActiveDashboardTab("deep")}
        >
          Dashboard 2 (Deep Views)
        </button>
      </nav>

      {/* ─── Detail Modal When Clicking a Strip ─────────────────────────── */}
      {selectedDrill && (
        <div className="pm-modal-backdrop" onClick={() => setSelectedDrill(null)}>
          <div className="pm-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`pm-v8-strip-tag ${selectedDrill.badgeType}`}>
                  {selectedDrill.badge}
                </span>
              </div>
              <button
                type="button"
                className="pm-modal-close-btn"
                onClick={() => setSelectedDrill(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                {selectedDrill.title}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--pm-text-muted)", margin: 0 }}>
                {selectedDrill.subtitle}
              </p>

              <div style={{ background: "var(--pm-subcard-bg)", padding: "14px", borderRadius: "14px", border: "1px solid var(--pm-subcard-border)", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                <div><strong>Khu vực:</strong> {selectedDrill.details.zone}</div>
                <div><strong>Công suất:</strong> {selectedDrill.details.capacity}</div>
                <div><strong>Biểu giá:</strong> {selectedDrill.details.rate}</div>
                <div><strong>Ghi chú vận hành:</strong> {selectedDrill.details.notes}</div>
              </div>
            </div>

            <div className="pm-modal-footer">
              <button
                type="button"
                className="pm-btn-secondary"
                onClick={() => setSelectedDrill(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="pm-btn-primary"
                onClick={() => {
                  setSelectedDrill(null);
                  navigate("/manager/facility-layout");
                }}
              >
                Điều Chỉnh Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Quick Action Modal (+ Thêm thao tác) ────────────────────────── */}
      {showQuickActionModal && (
        <div className="pm-modal-backdrop" onClick={() => setShowQuickActionModal(false)}>
          <div className="pm-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                + Thao Tác Điều Hành Khẩn Cấp
              </h3>
              <button
                type="button"
                className="pm-modal-close-btn"
                onClick={() => setShowQuickActionModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                className="pm-btn-secondary"
                style={{ padding: "14px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                onClick={() => { setShowQuickActionModal(false); navigate("/booking"); }}
              >
                <Box size={18} style={{ color: "#22d3ee" }} />
                <strong>Mở Sơ Đồ 3D</strong>
                <small style={{ color: "var(--pm-text-muted)" }}>Khóa hoặc giữ chỗ ô đỗ</small>
              </button>

              <button
                type="button"
                className="pm-btn-secondary"
                style={{ padding: "14px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                onClick={() => { setShowQuickActionModal(false); navigate("/manager/pricing"); }}
              >
                <Zap size={18} style={{ color: "#ff7828" }} />
                <strong>Kích Hoạt Surge</strong>
                <small style={{ color: "var(--pm-text-muted)" }}>Tăng hệ số giá giờ cao điểm</small>
              </button>

              <button
                type="button"
                className="pm-btn-secondary"
                style={{ padding: "14px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                onClick={() => { setShowQuickActionModal(false); navigate("/manager/incidents-approvals"); }}
              >
                <AlertTriangle size={18} style={{ color: "#f43f5e" }} />
                <strong>Báo Cáo Sự Cố</strong>
                <small style={{ color: "var(--pm-text-muted)" }}>Xử lý barrier hoặc camera</small>
              </button>

              <button
                type="button"
                className="pm-btn-secondary"
                style={{ padding: "14px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px" }}
                onClick={() => { setShowQuickActionModal(false); navigate("/manager/staff-shifts"); }}
              >
                <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                <strong>Đối Soát Quỹ</strong>
                <small style={{ color: "var(--pm-text-muted)" }}>Chốt doanh thu ca trực</small>
              </button>
            </div>

            <div className="pm-modal-footer">
              <button
                type="button"
                className="pm-btn-secondary"
                onClick={() => setShowQuickActionModal(false)}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
