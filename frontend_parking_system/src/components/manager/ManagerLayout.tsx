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
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  RotateCw,
  ParkingCircle,
  ExternalLink,
  DollarSign,
  Sliders,
  FileText,
} from "lucide-react";
import { managerApi } from "../../services/manager/managerApi";
import type { ManagerFacilitySummary, ReportingPeriod } from "../../types/manager";
import "./ManagerDashboard.css";

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facilities, setFacilities] = useState<ManagerFacilitySummary[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("all");
  const [period, setPeriod] = useState<ReportingPeriod>("today");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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
      label: "Tổng quan điều hành",
      icon: <LayoutDashboard size={20} />,
    },
    {
      to: "/manager/pricing",
      label: "Biểu phí & Chính sách",
      icon: <DollarSign size={20} />,
    },
    {
      to: "/manager/facility-layout",
      label: "Sơ đồ & Ô đỗ (Slots)",
      icon: <Sliders size={20} />,
    },
    {
      to: "/manager/staff-shifts",
      label: "Ca trực & Đối soát quỹ",
      icon: <Users size={20} />,
    },
    {
      to: "/manager/incidents-approvals",
      label: "Phê duyệt ngoại lệ",
      icon: <AlertTriangle size={20} />,
      badge: 3,
    },
    {
      to: "/manager/reports-audit",
      label: "Báo cáo & Audit logs",
      icon: <FileText size={20} />,
    },
    {
      to: "/booking",
      label: "Bản đồ 3D bãi xe",
      icon: <Box size={20} />,
      isExternalLike: true,
    },
    {
      to: "/staff/operations",
      label: "Cổng kiểm soát xe",
      icon: <Car size={20} />,
      isExternalLike: true,
    },
  ];

  return (
    <div className="pm-manager-shell">
      {/* ─── Left Sidebar / Rail (Admin Dashboard V7 Style) ─────────────── */}
      <aside
        className={`pm-manager-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${
          mobileSidebarOpen ? "mobile-open" : ""
        }`}
        aria-label="Thanh điều hướng quản lý"
      >
        {/* Brand Header */}
        <div className="pm-sidebar-brand">
          <div
            className="pm-sidebar-logo-icon"
            onClick={() => navigate("/manager/dashboard")}
            role="button"
            tabIndex={0}
            title="ParkMatrix Manager"
          >
            <ParkingCircle size={24} />
          </div>
          {!sidebarCollapsed && (
            <div className="pm-sidebar-logo-text">
              <span className="pm-sidebar-brand-name">
                Park<span>Matrix</span>
              </span>
              <span className="pm-sidebar-brand-sub">Manager V7</span>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className="pm-sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive: active }) =>
                  `pm-sidebar-link ${active || isActive ? "active" : ""}`
                }
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <span className="pm-nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && item.badge && (
                  <span className="pm-sidebar-badge">{item.badge}</span>
                )}
                {!sidebarCollapsed && item.isExternalLike && (
                  <ExternalLink size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Collapse & Logout Footer */}
        <div className="pm-sidebar-footer">
          <button
            type="button"
            className="pm-sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!sidebarCollapsed && <span>Thu gọn thanh trượt</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main Content Canvas ────────────────────────────────────────── */}
      <main className="pm-manager-main">
        {/* Top Header Bar */}
        <header className="pm-manager-header">
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

          {/* Header Right: Search, Refresh, Alerts, Profile */}
          <div className="pm-header-right">
            <div className="pm-header-search">
              <Search size={14} style={{ color: "#7aa5ae" }} />
              <input type="text" placeholder="Tra cứu biển số, mã đặt chỗ..." />
              <span className="pm-search-shortcut">⌘K</span>
            </div>

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
                <span className="pm-profile-name">Trần Anh Tuấn</span>
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
                  background: "rgba(10, 28, 38, 0.95)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "14px",
                  padding: "8px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  zIndex: 50,
                  minWidth: "190px",
                }}
              >
                <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#a8cdd0", fontSize: "11px" }}>
                  Tài khoản Quản lý cơ sở
                </div>
                <button
                  type="button"
                  style={{ width: "100%", background: "none", border: "none", color: "#fff", textAlign: "left", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}
                  onClick={() => { setShowProfileMenu(false); navigate("/staff/dashboard"); }}
                >
                  <Users size={14} /> Chuyển Cổng Nhân Viên
                </button>
                <button
                  type="button"
                  style={{ width: "100%", background: "none", border: "none", color: "#fff", textAlign: "left", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}
                  onClick={() => { setShowProfileMenu(false); navigate("/"); }}
                >
                  <Building2 size={14} /> Về Trang Chủ Khách Hàng
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
          }}
        />
      </main>
    </div>
  );
}
