import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Box,
  Car,
  Users,
  AlertTriangle,
  Bell,
  Search,
  RotateCw,
  ParkingCircle,
  DollarSign,
  Sliders,
  FileText,
  Sun,
  Moon,
  ArrowLeftRight,
  Menu,
  X,
} from "lucide-react";
import { managerApi } from "../../services/manager/managerApi";
import type { ManagerFacilitySummary, ReportingPeriod } from "../../types/manager";
import "./ManagerDashboard.css";

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("pm-manager-theme") as "dark" | "light") || "dark";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facilities, setFacilities] = useState<ManagerFacilitySummary[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("all");
  const [period, setPeriod] = useState<ReportingPeriod>("today");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Sync theme with localStorage
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("pm-manager-theme", nextTheme);
  };

  // Load facility list for the header selector
  useEffect(() => {
    async function loadFacilities() {
      try {
        const facs = await managerApi.getManagedFacilities();
        setFacilities(facs);
      } catch (err) {
        console.error("ManagerLayout load facilities error:", err);
      }
    }
    loadFacilities();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const navItems = [
    {
      to: "/manager/dashboard",
      label: "Overview",
      fullName: "Tổng quan điều hành",
      icon: <LayoutDashboard size={21} />,
    },
    {
      to: "/manager/pricing",
      label: "Biểu phí",
      fullName: "Biểu phí & Chính sách",
      icon: <DollarSign size={21} />,
    },
    {
      to: "/manager/facility-layout",
      label: "Sơ đồ Ô đỗ",
      fullName: "Sơ đồ & Ô đỗ (Slots)",
      icon: <Sliders size={21} />,
    },
    {
      to: "/manager/staff-shifts",
      label: "Nhân sự",
      fullName: "Ca trực & Đối soát quỹ",
      icon: <Users size={21} />,
    },
    {
      to: "/manager/incidents-approvals",
      label: "Ngoại lệ",
      fullName: "Phê duyệt ngoại lệ",
      icon: <AlertTriangle size={21} />,
      badge: 3,
    },
    {
      to: "/manager/reports-audit",
      label: "Báo cáo",
      fullName: "Báo cáo & Audit logs",
      icon: <FileText size={21} />,
    },
    {
      to: "/booking",
      label: "Bản đồ 3D",
      fullName: "Bản đồ 3D bãi xe",
      icon: <Box size={21} />,
    },
    {
      to: "/staff/operations",
      label: "Kiểm soát xe",
      fullName: "Cổng kiểm soát xe",
      icon: <Car size={21} />,
    },
  ];

  return (
    <div className={`pm-manager-shell pm-theme-${theme}`}>
      {/* ─── Floating Left Capsule Dock (Inspired by Screenshot) ─────────────── */}
      <aside className="pm-floating-dock" aria-label="Thanh điều hướng nhanh">
        {/* Top Logo / Brand Icon */}
        <div className="pm-dock-top">
          <div
            className="pm-dock-brand-icon"
            onClick={() => navigate("/manager/dashboard")}
            role="button"
            tabIndex={0}
            title="ParkMatrix Smart 3D System"
          >
            <ParkingCircle size={24} />
          </div>

          <button
            type="button"
            className="pm-dock-link"
            style={{ width: "36px", height: "36px", opacity: 0.7 }}
            onClick={() => navigate("/staff/operations")}
            title="Chuyển chế độ điều phối"
          >
            <ArrowLeftRight size={17} />
          </button>
        </div>

        {/* Vertical Icon Navigation List */}
        <nav className="pm-dock-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <div key={item.to} className="pm-dock-item-wrap">
                <NavLink
                  to={item.to}
                  className={({ isActive: active }) =>
                    `pm-dock-link ${active || isActive ? "active" : ""}`
                  }
                  aria-label={item.fullName}
                >
                  {item.icon}
                  {item.badge && <span className="pm-dock-badge" />}
                </NavLink>
                {/* Floating Tooltip just like the "Overview" tooltip in screenshot! */}
                <div className="pm-dock-tooltip">{item.label}</div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Theme Toggle & Profile Avatar */}
        <div className="pm-dock-bottom">
          <button
            type="button"
            className="pm-dock-theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "Chuyển sang giao diện Sáng (Light Mode)" : "Chuyển sang giao diện Tối (Dark Mode)"}
            aria-label="Đổi giao diện Sáng / Tối"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div
            className="pm-dock-avatar"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            role="button"
            tabIndex={0}
            title="Tài khoản Quản lý"
          >
            QL
          </div>
        </div>
      </aside>

      {/* ─── Main Content Canvas ────────────────────────────────────────── */}
      <main className="pm-manager-main" style={{ flex: 1, minWidth: 0, paddingRight: "16px" }}>
        {/* Top Header Bar */}
        <header className="pm-manager-header" style={{ marginBottom: "16px" }}>
          {/* Header Left: Mobile toggle & Facility Selector */}
          <div className="pm-header-left">
            <button
              type="button"
              className="pm-mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              title="Menu"
            >
              {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="pm-facility-dropdown-wrap">
              <span className="pm-pulsing-dot" title="Hệ thống trực tuyến" />
              <Building2 size={15} style={{ marginRight: 6, color: "#22d3ee" }} />
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                aria-label="Chọn cơ sở bãi xe"
              >
                <option value="all">Metropolis Central Hub (PKM-METRO-01)</option>
                {facilities.map((fac) => (
                  <option key={fac.lotId} value={fac.lotId}>
                    {fac.name} ({fac.totalCapacity} chỗ)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Header Center: Reporting Period Pills */}
          <div className="pm-header-center" role="tablist" aria-label="Kỳ báo cáo">
            <button
              type="button"
              className={`pm-period-btn ${period === "today" ? "active" : ""}`}
              onClick={() => setPeriod("today")}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className={`pm-period-btn ${period === "week" ? "active" : ""}`}
              onClick={() => setPeriod("week")}
            >
              7 ngày
            </button>
            <button
              type="button"
              className={`pm-period-btn ${period === "month" ? "active" : ""}`}
              onClick={() => setPeriod("month")}
            >
              30 ngày
            </button>
          </div>

          {/* Header Right: Search, Theme Toggle, Refresh, Alerts, Profile */}
          <div className="pm-header-right">
            {/* Theme Toggle Pill Button */}
            <button
              type="button"
              className="pm-v8-theme-pill-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Chuyển sang giao diện Sáng (Light Mode)" : "Chuyển sang giao diện Tối (Dark Mode)"}
            >
              {theme === "dark" ? (
                <>
                  <Sun size={15} style={{ color: "#ff7828" }} />
                  <span>Chế độ Sáng</span>
                </>
              ) : (
                <>
                  <Moon size={15} style={{ color: "#087f8c" }} />
                  <span>Chế độ Tối</span>
                </>
              )}
            </button>

            <button
              type="button"
              className={`pm-header-icon-btn ${isRefreshing ? "spinning" : ""}`}
              onClick={handleRefresh}
              title="Làm mới dữ liệu thời gian thực"
            >
              <RotateCw size={17} />
            </button>

            <button
              type="button"
              className="pm-header-icon-btn"
              onClick={() => navigate("/staff/incidents")}
              title="Thông báo vận hành"
            >
              <Bell size={17} />
              <span className="pm-badge-dot" />
            </button>

            {/* Profile Avatar Chip */}
            <div
              className="pm-profile-chip"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              role="button"
              tabIndex={0}
            >
              <div className="pm-avatar-img">QL</div>
              <div className="pm-profile-meta">
                <span className="pm-profile-name">Lionel Messi</span>
                <span className="pm-profile-role">PARKING MANAGER</span>
              </div>
            </div>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "65px",
                  right: "24px",
                  background: "var(--pm-card-bg)",
                  backdropFilter: "blur(18px)",
                  border: "1px solid var(--pm-card-border)",
                  borderRadius: "16px",
                  padding: "8px",
                  boxShadow: "var(--pm-card-shadow)",
                  zIndex: 80,
                  minWidth: "210px",
                }}
              >
                <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--pm-text-muted)", fontSize: "11px" }}>
                  Tài khoản Quản lý cơ sở (@manager)
                </div>
                <button
                  type="button"
                  style={{ width: "100%", background: "none", border: "none", color: "var(--pm-text-heading)", textAlign: "left", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", fontWeight: 600 }}
                  onClick={() => { setShowProfileMenu(false); navigate("/staff/dashboard"); }}
                >
                  <Users size={14} style={{ color: "#ff7828" }} /> Chuyển Cổng Nhân Viên
                </button>
                <button
                  type="button"
                  style={{ width: "100%", background: "none", border: "none", color: "var(--pm-text-heading)", textAlign: "left", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", fontWeight: 600 }}
                  onClick={() => { setShowProfileMenu(false); navigate("/"); }}
                >
                  <Building2 size={14} style={{ color: "#14afbe" }} /> Về Trang Chủ Khách Hàng
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Outlet for Dashboard and Sub-views */}
        <Outlet
          context={{
            selectedLotId,
            setSelectedLotId,
            period,
            setPeriod,
            refreshKey,
            handleRefresh,
            theme,
            toggleTheme,
          }}
        />
      </main>
    </div>
  );
}

