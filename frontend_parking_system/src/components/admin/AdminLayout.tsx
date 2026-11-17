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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./AdminPortal.css";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [healthStatus, setHealthStatus] = useState<"HEALTHY" | "CHECKING" | "DEGRADED">("CHECKING");

  // Check system health on load or refresh
  useEffect(() => {
    let mounted = true;
    async function checkHealth() {
      try {
        const res = await fetch("/health/ready");
        if (!mounted) return;
        if (res.ok) {
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
    return () => { mounted = false; };
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
    { id: "dashboard", label: "Tổng Quan Nền Tảng", path: "/admin/dashboard", icon: <Activity size={17} /> },
    { id: "map-3d", label: "Sơ Đồ 3D Toàn Cảnh", path: "/admin/map-3d", icon: <Eye size={17} /> },
    { id: "slots", label: "Quản Lý Ô Đỗ (Slots)", path: "/admin/slots", icon: <Sliders size={17} /> },
    { id: "users", label: "Người Dùng & Phân Quyền", path: "/admin/users", icon: <Users size={17} /> },
    { id: "facilities", label: "Hạ Tầng Bãi Đỗ Xe", path: "/admin/facilities", icon: <Building2 size={17} /> },
    { id: "staff-assignments", label: "Phân Bổ Nhân Sự Cơ Sở", path: "/admin/staff-assignments", icon: <UserCheck size={17} /> },
    { id: "services", label: "Dịch Vụ & AI Vision", path: "/admin/services", icon: <Server size={17} /> },
  ];

  const getPageTitle = () => {
    if (location.pathname.includes("/map-3d")) return "Sơ Đồ Không Gian 3D Digital Twin (Admin View)";
    if (location.pathname.includes("/slots")) return "Quản Lý Vận Hành & Khóa Ô Đỗ (Slot Override)";
    if (location.pathname.includes("/users")) return "Quản Lý Người Dùng & Phân Quyền RBAC";
    if (location.pathname.includes("/facilities")) return "Quản Lý Hạ Tầng Mạng Lưới Bãi Đỗ Xe";
    if (location.pathname.includes("/staff-assignments")) return "Phân Bổ Nhân Sự Toàn Hệ Thống";
    if (location.pathname.includes("/services")) return "Giám Sát Microservices & AI Vision Engine";
    return "Bảng Điều Khiển Quản Trị Hệ Thống (System Overview)";
  };

  const displayName = user?.fullName || user?.email || "Quản Trị Viên Tối Cao";
  const userInitials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="adm-shell">
      {/* ── Left Sidebar (Luôn cố định 100vh) ── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-top">
          {/* Brand Logo */}
          <Link to="/admin/dashboard" className="adm-sidebar-brand" title="ParkMatrix Admin Portal">
            <span className="adm-sidebar-logo-icon">
              <ParkingCircle size={22} />
            </span>
            <div className="adm-sidebar-logo-text">
              <span className="adm-brand-name">ParkMatrix</span>
              <span className="adm-brand-subtitle">
                System Console <span className="adm-super-badge">Admin</span>
              </span>
            </div>
          </Link>

          {/* Scope Card */}
          <div className="adm-scope-card">
            <div className="adm-scope-label">
              <ShieldAlert size={13} color="#38bdf8" />
              Phạm Vi Quản Trị
            </div>
            <div className="adm-scope-value">
              <span className="adm-pulse-dot" />
              Toàn Nền Tảng (Global)
            </div>
          </div>

          {/* Nav Items */}
          <nav className="adm-nav-group">
            <div className="adm-nav-heading">Phân hệ quản trị</div>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== "/admin/dashboard" && location.pathname.startsWith(item.path));
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

        {/* Sidebar Footer (Đơn giản, tách bạch rõ ràng) */}
        <div className="adm-sidebar-footer">
          <div className="adm-user-profile">
            <div className="adm-avatar">{userInitials}</div>
            <div className="adm-user-meta">
              <span className="adm-user-name" title={displayName}>{displayName}</span>
              <span className="adm-user-role-tag">PLATFORM ADMIN</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="adm-btn-logout"
            title="Đăng xuất khỏi tài khoản quản trị"
          >
            <LogOut size={13} />
            <span>Thoát</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="adm-main">
        {/* Topbar */}
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            <h1 className="adm-page-title">{getPageTitle()}</h1>
          </div>

          <div className="adm-topbar-right">
            <div className="adm-status-chip">
              <span className="adm-pulse-dot" style={{ background: healthStatus === "HEALTHY" ? "#10b981" : "#ef4444" }} />
              <span>{healthStatus === "HEALTHY" ? "4 Microservices Sẵn Sàng" : "Kiểm tra kết nối"}</span>
            </div>

            <button
              onClick={handleRefresh}
              className="adm-btn-refresh"
              disabled={isRefreshing}
              title="Làm mới dữ liệu nền tảng"
            >
              <RefreshCw size={13} className={isRefreshing ? "adm-spin" : ""} />
              <span>Làm mới</span>
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
