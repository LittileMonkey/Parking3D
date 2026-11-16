import { useState, useEffect } from "react";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Sliders,
  Users,
  AlertTriangle,
  FileText,
  Building2,
  Calendar,
  RefreshCw,
  Download,
  Sparkles,
  ParkingCircle,
  ShieldCheck,
  LogOut,
  MapPin,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../customer/NotificationBell";
import { managerApi } from "../../services/manager/managerApi";
import type { ManagerFacilitySummary, ReportingPeriod } from "../../types/manager";
import "./ManagerPortalLight.css";

export default function ManagerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [facilities, setFacilities] = useState<Pick<ManagerFacilitySummary, "lotId" | "code" | "name" | "address">[]>([]);
  const [facilityError, setFacilityError] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string>("all");
  const [period, setPeriod] = useState<ReportingPeriod>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Load facility list
  useEffect(() => {
    async function loadFacilities() {
      try {
        const facs = await managerApi.getManagedFacilities();
        setFacilities(facs);
        setSelectedLotId((current) => (current === "all" && facs.length === 1 ? facs[0].lotId : current));
        setFacilityError("");
      } catch (err) {
        setFacilities([]);
        setFacilityError(err instanceof Error ? err.message : "Không tải được danh sách bãi.");
      }
    }
    loadFacilities();
  }, [refreshKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navTabs = [
    { id: "overview", label: "Tổng Quan", path: "/manager/dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "pricing", label: "Biểu Phí & Giá", path: "/manager/pricing", icon: <CreditCard size={18} /> },
    { id: "slots", label: "Sơ Đồ Ô Đỗ", path: "/manager/facility-layout", icon: <Sliders size={18} /> },
    { id: "staff", label: "Nhân Sự & Ca", path: "/manager/staff-shifts", icon: <Users size={18} /> },
    { id: "incidents", label: "Sự Cố & Ngoại Lệ", path: "/manager/incidents-approvals", icon: <AlertTriangle size={18} /> },
    { id: "reports", label: "Báo Cáo & Audit", path: "/manager/reports-audit", icon: <FileText size={18} /> },
  ];

  const getActiveTab = () => {
    if (location.pathname.includes("/pricing")) return "pricing";
    if (location.pathname.includes("/facility-layout")) return "slots";
    if (location.pathname.includes("/staff-shifts")) return "staff";
    if (location.pathname.includes("/incidents-approvals")) return "incidents";
    if (location.pathname.includes("/reports-audit")) return "reports";
    return "overview";
  };

  const activeTabId = getActiveTab();
  const selectedFacility = facilities.find((f) => f.lotId === selectedLotId);

  const displayName = user?.fullName || user?.email || "Quản lý bãi xe";
  const userInitials = displayName.slice(0, 2).toUpperCase();
  const userRoles = (user?.roles ?? (user?.role ? [user.role] : [])).map((r) => r.toUpperCase());
  const roleName = userRoles.some((r) => r.includes("ADMIN")) ? "System Admin" : "Station Manager";

  return (
    <div className="pm-manager-shell">
      {/* ── Left Sidebar (Thanh Taskbar Điều Hướng Bên Tay Trái) ── */}
      <aside className="pm-manager-sidebar">
        <div className="pm-sidebar-top">
          {/* Brand Logo & Name */}
          <Link to="/manager/dashboard" className="pm-sidebar-brand" title="ParkMatrix Dashboard">
            <span className="pm-sidebar-logo-icon">
              <ParkingCircle size={24} />
            </span>
            <div className="pm-sidebar-logo-text">
              <span className="pm-sidebar-brand-name">
                PARK<span>MATRIX</span>
              </span>
              <small className="pm-sidebar-brand-sub">Station Manager Portal</small>
            </div>
          </Link>

          {/* Active Facility Pill Box */}
          <div className="pm-sidebar-facility-box" title="Cơ sở bãi đỗ hiện đang quản lý">
            <div className="pm-sidebar-fac-label">
              <MapPin size={12} /> Cơ sở đang chọn:
            </div>
            <div className="pm-sidebar-fac-name">
              {selectedFacility ? selectedFacility.name : `Tất cả cơ sở (${facilities.length})`}
            </div>
          </div>

          {/* Navigation Links List */}
          <nav className="pm-sidebar-nav" aria-label="Menu quản trị bãi xe">
            <div className="pm-sidebar-nav-heading">Phân Hệ Quản Trị</div>
            {navTabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`pm-sidebar-link ${isActive ? "active" : ""}`}
                >
                  <span className="pm-sidebar-link-icon">{tab.icon}</span>
                  <span className="pm-sidebar-link-text">{tab.label}</span>
                  {isActive && <span className="pm-sidebar-active-indicator" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pm-sidebar-footer">
          {/* IoT Status indicator */}
          <div className="pm-sidebar-iot-badge" title="Mạng lưới IoT & Barie kết nối ổn định">
            <span className="pm-live-dot" />
            <span>IoT Command Online</span>
          </div>

          {/* Manager User Pill */}
          <div className="pm-sidebar-user-card">
            <div className="pm-sidebar-user-avatar">{userInitials}</div>
            <div className="pm-sidebar-user-info">
              <span className="pm-sidebar-user-name">{displayName}</span>
              <span className="pm-sidebar-user-role">
                <ShieldCheck size={11} /> {roleName}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            className="pm-sidebar-logout-btn"
            onClick={handleLogout}
            title="Đăng xuất khỏi phiên quản trị"
          >
            <LogOut size={15} />
            <span>Đăng Xuất</span>
          </button>
        </div>
      </aside>

      {/* ── Right Main Workspace ── */}
      <main className="pm-manager-main">
        {/* Top Operational Control Bar */}
        <header className="pm-control-card">
          <div className="pm-control-left">
            <div className="pm-control-group">
              <span className="pm-control-label">
                <Building2 size={16} />
                Cơ sở:
              </span>
              <select
                className="pm-select-light"
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                aria-label="Chọn cơ sở bãi xe"
              >
                <option value="all">Tất cả cơ sở ({facilities.length})</option>
                {facilities.map((fac) => (
                  <option key={fac.lotId} value={fac.lotId}>
                    {fac.name} ({fac.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="pm-control-group">
              <span className="pm-control-label">
                <Calendar size={16} />
                Kỳ báo cáo:
              </span>
              <div className="pm-period-pills">
                {(
                  [
                    { id: "today", label: "Hôm nay" },
                    { id: "week", label: "7 ngày" },
                    { id: "month", label: "30 ngày" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pm-period-btn ${period === p.id ? "active" : ""}`}
                    onClick={() => setPeriod(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pm-control-right">
            <div className="pm-live-badge" title="Mạng lưới IoT & telemetry đồng bộ thời gian thực">
              <span className="pm-live-dot" />
              <span>Real-time IoT Sync</span>
            </div>

            <button
              type="button"
              className="pm-btn pm-btn-secondary"
              onClick={handleRefresh}
              title="Tải lại dữ liệu từ máy chủ"
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={isRefreshing ? "spin-animation" : ""} />
              <span>{isRefreshing ? "Đang tải…" : "Làm mới"}</span>
            </button>

            <button
              type="button"
              className="pm-btn pm-btn-primary"
              onClick={() => {
                navigate("/manager/reports-audit");
              }}
              title="Xem & xuất báo cáo CSV"
            >
              <Download size={14} />
              <span>Xuất Báo Cáo</span>
            </button>

            <NotificationBell open={isNotificationOpen} onOpenChange={setIsNotificationOpen} />
          </div>
        </header>

        {/* Hero Eyebrow Banner */}
        <div className="pm-manager-hero">
          <span className="pm-hero-eyebrow">
            <Sparkles size={12} />
            PARKMATRIX ENTERPRISE • OPERATIONS & MANAGEMENT
          </span>
          <div className="pm-hero-title-row">
            <div>
              <h1 className="pm-hero-title">
                Bàn Làm Việc <span>Quản Trị Bãi Đỗ Xe</span>
              </h1>
              <p className="pm-hero-sub">
                Hệ thống quản lý thời gian thực đa cơ sở, kiểm soát biểu phí, ma trận ô đỗ 3D, phân công nhân sự và báo cáo kiểm toán doanh thu.
              </p>
            </div>
          </div>
        </div>

        {/* Facility Error Alert if any */}
        {facilityError && (
          <div className="v18-alert-error" role="alert">
            {facilityError}
          </div>
        )}

        {/* Main Subpage Content */}
        <Outlet
          context={{
            selectedLotId,
            setSelectedLotId,
            period,
            setPeriod,
            refreshKey,
            handleRefresh,
            facilities,
            selectedFacility,
          }}
        />
      </main>
    </div>
  );
}
