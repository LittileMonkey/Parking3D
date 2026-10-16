import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Grid3X3,
  AlertTriangle,
  Clock,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  Building2,
  ShieldAlert,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type { ParkingLotSummary, Incident } from "../../types/staff";
import "./StaffPortal.css";

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lots, setLots] = useState<ParkingLotSummary[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [openIncidentCount, setOpenIncidentCount] = useState<number>(0);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyText, setEmergencyText] = useState("");
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);

  // Load facilities & active incidents count
  useEffect(() => {
    async function loadInitial() {
      try {
        const facilityList = await staffApi.getParkingLots();
        setLots(facilityList);
        if (facilityList.length > 0 && !selectedLotId) {
          setSelectedLotId(facilityList[0].lotId);
        }
        const incidents: Incident[] = await staffApi.getIncidents();
        const active = incidents.filter((i) => i.status === "Open" || i.status === "InProgress");
        setOpenIncidentCount(active.length);
      } catch (err) {
        console.error("Staff layout init error:", err);
      }
    }
    loadInitial();
    const interval = setInterval(loadInitial, 15000);
    return () => clearInterval(interval);
  }, [selectedLotId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/staff/operations?plate=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLotId(e.target.value);
    window.dispatchEvent(new CustomEvent("lotChanged", { detail: { lotId: e.target.value } }));
  };

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyText.trim()) return;
    setEmergencySubmitting(true);
    try {
      await staffApi.createIncident({
        title: "Báo động khẩn cấp từ nhân viên trực ca",
        type: "Khẩn cấp",
        severity: "Critical",
        description: emergencyText,
        detectedAt: new Date().toISOString(),
      });
      setShowEmergencyModal(false);
      setEmergencyText("");
      setOpenIncidentCount((prev) => prev + 1);
      navigate("/staff/incidents");
    } finally {
      setEmergencySubmitting(false);
    }
  };

  const navLinks = [
    {
      to: "/staff/dashboard",
      label: "Tổng quan ca trực",
      icon: <LayoutDashboard size={19} />,
    },
    {
      to: "/staff/operations",
      label: "Điều phối Vào / Ra",
      icon: <ArrowLeftRight size={19} />,
    },
    {
      to: "/staff/parking",
      label: "Mặt bằng bãi xe",
      icon: <Grid3X3 size={19} />,
    },
    {
      to: "/staff/incidents",
      label: "Sự cố & Ngoại lệ",
      icon: <AlertTriangle size={19} />,
      badge: openIncidentCount > 0 ? openIncidentCount : undefined,
      badgeType: "danger",
    },
    {
      to: "/staff/shifts",
      label: "Quản lý ca trực",
      icon: <Clock size={19} />,
    },
  ];

  return (
    <div className="pm-staff-shell">
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="pm-topbar">
        {/* Brand Logo Left */}
        <div className="pm-topbar-brand">
          <button
            type="button"
            className="pm-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle Menu"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="pm-logo" onClick={() => navigate("/staff/dashboard")} role="button" tabIndex={0}>
            <div className="pm-logo-mark">
              <span>P</span>
            </div>
            <span className="pm-logo-text">ParkMatrix</span>
          </div>
        </div>

        {/* Facility Selector & Shift Badge */}
        <div className="pm-topbar-context">
          {lots.length > 0 && (
            <div className="pm-facility-chip">
              <Building2 size={15} className="pm-facility-icon" />
              <select
                className="pm-facility-select"
                value={selectedLotId}
                onChange={handleLotChange}
                aria-label="Chọn cơ sở bãi đỗ"
              >
                {lots.map((lot) => (
                  <option key={lot.lotId} value={lot.lotId}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shift Info Badge */}
          <div className="pm-shift-chip">
            <Clock size={14} className="pm-shift-icon" />
            <span>Ca Sáng (06:00 - 14:00)</span>
          </div>

          {/* System Status Indicator */}
          <div className="pm-system-status">
            <span className="pm-dot-online" />
            <span>Hệ thống Trực tuyến</span>
          </div>
        </div>

        {/* Search Bar */}
        <form className="pm-search-form" onSubmit={handleSearchSubmit}>
          <Search size={15} className="pm-search-icon" />
          <input
            type="text"
            className="pm-search-input"
            placeholder="Tìm kiếm biển số, mã vé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        {/* Top Navigation Right Actions */}
        <div className="pm-topbar-actions">
          {/* Emergency Alert Button */}
          <button
            type="button"
            className="pm-header-alert-btn"
            onClick={() => setShowEmergencyModal(true)}
            title="Báo động sự cố khẩn cấp"
          >
            <ShieldAlert size={15} />
            <span>Báo động khẩn</span>
          </button>

          {/* Notifications with badge */}
          <button
            type="button"
            className="pm-icon-btn"
            title="Thông báo vận hành"
            onClick={() => navigate("/staff/incidents")}
          >
            <Bell size={18} />
            <span className="pm-notif-badge">{openIncidentCount > 0 ? openIncidentCount : 1}</span>
          </button>

          {/* Staff Profile Chip */}
          <div className="pm-profile-chip">
            <div className="pm-profile-avatar">ST</div>
            <div className="pm-profile-name">
              <span>ST Nguyễn Văn Hùng</span>
              <ChevronDown size={14} className="pm-profile-chevron" />
            </div>
          </div>

          {/* Quick Logout Button */}
          <button
            type="button"
            className="pm-logout-btn"
            onClick={() => navigate("/login")}
            title="Đăng xuất nhanh"
          >
            <LogOut size={16} />
            <span>Quick logout</span>
          </button>
        </div>
      </header>

      {/* ─── Main App Body ─────────────────────────────────────────────────── */}
      <div className="pm-body-container">
        {/* Mobile Backdrop */}
        {sidebarOpen && <div className="pm-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* ─── Sidebar Navigation ─────────────────────────────────────────── */}
        <aside className={`pm-sidebar ${sidebarOpen ? "open" : ""}`}>
          <nav className="pm-nav-list">
            {navLinks.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`pm-nav-link ${isActive ? "active" : ""}`}
                >
                  <span className="pm-nav-icon">{item.icon}</span>
                  <span className="pm-nav-label">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`pm-nav-badge ${item.badgeType || "warning"}`}>{item.badge}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Emergency Alert Button at Bottom of Sidebar */}
          <div className="pm-sidebar-bottom">
            <button
              type="button"
              className="pm-emergency-btn"
              onClick={() => setShowEmergencyModal(true)}
            >
              <ShieldAlert size={16} />
              <span>Báo động khẩn cấp</span>
            </button>
          </div>
        </aside>

        {/* ─── Central Content Area ──────────────────────────────────────── */}
        <main className="pm-main-content">
          <Outlet context={{ selectedLotId }} />
        </main>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="staff-modal-backdrop" onClick={() => setShowEmergencyModal(false)}>
          <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header" style={{ background: "#331616", borderBottom: "1px solid #7f1d1d" }}>
              <h3 className="staff-modal-title" style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={20} />
                Phát lệnh Báo động Sự cố Khẩn cấp
              </h3>
              <button
                type="button"
                className="staff-btn-secondary"
                style={{ padding: 4, background: "transparent", color: "#f87171" }}
                onClick={() => setShowEmergencyModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEmergencySubmit}>
              <div className="staff-modal-body" style={{ background: "#1c222a", color: "#e2e8f0" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Hành động này sẽ ghi nhận sự cố mức <strong style={{ color: "#ef4444" }}>CRITICAL</strong> ngay lập tức lên hệ thống giám sát ParkMatrix.
                </p>
                <div className="staff-form-group" style={{ marginTop: 14 }}>
                  <label className="staff-label" style={{ color: "#cbd5e1" }}>Mô tả tình huống khẩn cấp (*):</label>
                  <textarea
                    required
                    className="staff-textarea"
                    style={{ background: "#12171d", borderColor: "#334155", color: "#f8fafc" }}
                    placeholder="Ví dụ: Barrier cổng G1 không mở, camera ANPR mất nguồn..."
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                  />
                </div>
              </div>
              <div className="staff-modal-footer" style={{ background: "#181d24", borderTop: "1px solid #2a3340" }}>
                <button
                  type="button"
                  className="staff-btn-secondary"
                  onClick={() => setShowEmergencyModal(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={emergencySubmitting}
                  className="staff-quick-btn staff-btn-alert"
                  style={{ background: "#dc2626", color: "white" }}
                >
                  {emergencySubmitting ? "Đang gửi..." : "Gửi Báo động Ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
