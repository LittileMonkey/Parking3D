import { useState, useEffect } from "react";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  Users,
  Building2,
  UserCheck,
  Server,
  Activity,
  RefreshCw,
  LogOut,
  ParkingCircle,
  Eye,
  Sliders,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import "./AdminPortal.css";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [healthStatus, setHealthStatus] = useState<"HEALTHY" | "CHECKING" | "DEGRADED">("CHECKING");
  const [menuOpen, setMenuOpen] = useState(false);

  // Responsive media listener
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const changed = () => {
      setMenuOpen(false);
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  // Check system health on load or refresh (safely guarding against non-JSON / HTML responses)
  useEffect(() => {
    let mounted = true;
    async function checkHealth() {
      try {
        const res = await fetch("/health/ready");
        if (!mounted) return;
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const data = await res.json();
          if (data?.isSuccess && data?.result?.dependencies) {
            const deps = data.result.dependencies;
            const allHealthy = Object.values(deps).every(Boolean);
            setHealthStatus(allHealthy ? "HEALTHY" : "DEGRADED");
          } else {
            setHealthStatus("DEGRADED");
          }
        } else {
          setHealthStatus("DEGRADED");
        }
      } catch {
        if (mounted) setHealthStatus("DEGRADED");
      }
    }
    checkHealth();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { id: "dashboard", label: t("admin.nav_dashboard"), path: "/admin/dashboard", icon: <Activity size={17} /> },
    { id: "map-3d", label: t("admin.nav_map3d"), path: "/admin/map-3d", icon: <Eye size={17} /> },
    { id: "slots", label: t("admin.nav_slots"), path: "/admin/slots", icon: <Sliders size={17} /> },
    { id: "users", label: t("admin.nav_users"), path: "/admin/users", icon: <Users size={17} /> },
    { id: "facilities", label: t("admin.nav_facilities"), path: "/admin/facilities", icon: <Building2 size={17} /> },
    { id: "staff-assignments", label: t("admin.nav_staff"), path: "/admin/staff-assignments", icon: <UserCheck size={17} /> },
    { id: "services", label: t("admin.nav_services"), path: "/admin/services", icon: <Server size={17} /> },
  ];

  const getPageTitle = () => {
    const isEn = lang === "en";
    if (location.pathname.includes("/map-3d")) {
      return isEn ? "3D Digital Twin Map View (Admin)" : "Sơ Đồ Không Gian 3D Digital Twin (Admin View)";
    }
    if (location.pathname.includes("/slots")) {
      return isEn ? "Slot Operation & Override" : "Quản Lý Vận Hành & Khóa Ô Đỗ";
    }
    if (location.pathname.includes("/users")) {
      return isEn ? "User Identity & RBAC Permissions" : "Quản Lý Người Dùng & Phân Quyền RBAC";
    }
    if (location.pathname.includes("/facilities")) {
      return isEn ? "Multi-Parking Facility Network" : "Quản Lý Hạ Tầng Mạng Lưới Bãi Đỗ Xe";
    }
    if (location.pathname.includes("/staff-assignments")) {
      return isEn ? "Systemwide Staff & Manager Assignments" : "Phân Bổ Nhân Sự Toàn Hệ Thống";
    }
    if (location.pathname.includes("/services")) {
      return isEn ? "Microservices Monitoring & AI Vision Engine" : "Giám Sát Microservices & AI Vision Engine";
    }
    return isEn ? "Platform System Overview & Control" : "Bảng Điều Khiển Quản Trị Hệ Thống (System Overview)";
  };

  const displayName = user?.fullName || user?.email || (lang === "en" ? "Platform Admin" : "Quản Trị Viên Tối Cao");
  const userInitials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="adm-shell">
      {/* ── Mobile Menu Backdrop ── */}
      {menuOpen && (
        <button
          className="adm-menu-backdrop"
          aria-label={lang === "en" ? "Close menu" : "Đóng menu điều hướng"}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Left Sidebar (Cố định desktop, drawer trượt trên tablet/mobile) ── */}
      <aside className={`adm-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Admin Navigation">
        <div className="adm-sidebar-top">
          {/* Brand Logo */}
          <Link to="/admin/dashboard" className="adm-sidebar-brand" title="ParkMatrix Admin Portal">
            <span className="adm-sidebar-logo-icon">
              <ParkingCircle size={32} />
            </span>
            <div className="adm-sidebar-logo-text">
              <span className="adm-brand-name">PARKMATRIX</span>
              <span className="adm-brand-subtitle">
                {t("admin.brand_subtitle")} <span className="adm-super-badge">Admin</span>
              </span>
            </div>
          </Link>

          {/* Scope Card */}
          <div className="adm-scope-card">
            <div className="adm-scope-label">
              <ShieldAlert size={14} color="#0d4685" />
              <span>{t("admin.scope")}</span>
            </div>
            <div className="adm-scope-value">
              <span className="adm-pulse-dot" />
              <span>{t("admin.scope_val")}</span>
            </div>
          </div>

          {/* Nav Items */}
          <div className="adm-sidebar-caption">{t("admin.section_heading")}</div>
          <nav className="adm-nav-group">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/admin/dashboard" && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`adm-nav-item ${isActive ? "active" : ""}`}
                >
                  <span className="adm-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="adm-sidebar-footer">
          <div className="adm-user-profile">
            <div className="adm-avatar">{userInitials}</div>
            <div className="adm-user-meta">
              <span className="adm-user-name" title={displayName}>{displayName}</span>
              <span className="adm-user-role-tag">{t("admin.role_tag")}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="adm-btn-logout"
            title={lang === "en" ? "Logout from admin" : "Đăng xuất khỏi tài khoản quản trị"}
          >
            <LogOut size={16} />
            <span>{t("admin.logout")}</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="adm-main">
        {/* Topbar */}
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            {/* Hamburger Button for Mobile / Tablet */}
            <button
              type="button"
              className="adm-menu-button"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="adm-topbar-title-wrap">
              <small className="adm-topbar-eyebrow">{t("admin.eyebrow")}</small>
              <h1 className="adm-page-title" title={getPageTitle()}>{getPageTitle()}</h1>
            </div>
          </div>

          <div className="adm-topbar-right">
            {/* Language Switcher (VI / EN) */}
            <div className="adm-lang-switch" title={lang === "vi" ? "Chuyển ngôn ngữ" : "Switch language"}>
              <button
                type="button"
                className={`adm-lang-pill ${lang === "vi" ? "active" : ""}`}
                onClick={() => setLang("vi")}
                aria-label="Tiếng Việt"
              >
                VI
              </button>
              <button
                type="button"
                className={`adm-lang-pill ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                aria-label="English"
              >
                EN
              </button>
            </div>

            {/* Health status badge */}
            <div className="adm-status-chip">
              <span
                className="adm-pulse-dot"
                style={{ background: healthStatus === "HEALTHY" ? "#10b981" : "#ef4444" }}
              />
              <span>
                {healthStatus === "HEALTHY" ? t("admin.status_ready") : t("admin.status_checking")}
              </span>
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              className="adm-btn-refresh"
              disabled={isRefreshing}
              title={lang === "en" ? "Refresh platform data" : "Làm mới dữ liệu nền tảng"}
            >
              <RefreshCw size={13} className={isRefreshing ? "adm-spin" : ""} />
              <span className="adm-btn-refresh-text">{t("admin.refresh")}</span>
            </button>
          </div>
        </header>

        {/* Dynamic Child Page Content */}
        <main className="adm-content-wrapper">
          <Outlet context={{ refreshKey, onTriggerRefresh: handleRefresh }} />
        </main>
      </div>
    </div>
  );
}
