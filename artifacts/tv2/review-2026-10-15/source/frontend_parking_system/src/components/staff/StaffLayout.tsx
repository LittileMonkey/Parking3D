import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Grid3X3,
  AlertTriangle,
  Clock,
  Building2,
  LogOut,
  Menu,
  X,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type { ParkingLotSummary, Incident } from "../../types/staff";
import "./StaffPortal.css";

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const handleLotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLotId(e.target.value);
    // Dispatch a custom event or let subpages react
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
      icon: <LayoutDashboard size={18} />,
    },
    {
      to: "/staff/operations",
      label: "Điều phối Vào / Ra",
      icon: <ArrowLeftRight size={18} />,
    },
    {
      to: "/staff/parking",
      label: "Mặt bằng bãi xe",
      icon: <Grid3X3 size={18} />,
    },
    {
      to: "/staff/incidents",
      label: "Sự cố & Ngoại lệ",
      icon: <AlertTriangle size={18} />,
      badge: openIncidentCount > 0 ? openIncidentCount : undefined,
      badgeType: "danger",
    },
    {
      to: "/staff/shifts",
      label: "Quản lý ca & Bàn giao",
      icon: <Clock size={18} />,
    },
  ];

  return (
    <div className="staff-shell">
      {/* Mobile Backdrop */}
      {sidebarOpen && <div className="staff-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`staff-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="staff-sidebar-brand">
          <div className="staff-brand-icon">
            <Radio size={20} />
          </div>
          <div>
            <div className="staff-brand-title">Smart 3D Parking</div>
            <span className="staff-brand-badge">Staff Operations V4</span>
          </div>
        </div>

        <nav className="staff-nav">
          <div className="staff-nav-heading">Điều hành bãi xe</div>
          {navLinks.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`staff-nav-item ${isActive ? "active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`staff-nav-badge ${item.badgeType || "warning"}`}>{item.badge}</span>
                )}
              </NavLink>
            );
          })}

          <div className="staff-nav-heading" style={{ marginTop: 12 }}>Hệ thống</div>
          <button
            type="button"
            className="staff-nav-item"
            style={{ background: "none", border: "none", textAlign: "left", width: "100%" }}
            onClick={() => navigate("/")}
          >
            <Building2 size={18} />
            <span>Xem Cổng Customer</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="staff-sidebar-footer">
          <div className="staff-profile-chip">
            <div className="staff-avatar">ST</div>
            <div className="staff-profile-info">
              <div className="staff-profile-name">Nguyễn Văn Hùng</div>
              <div className="staff-profile-role">NV Vận hành • #STF-091</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <div className="staff-main">
        {/* Top Header */}
        <header className="staff-topbar">
          <div className="staff-topbar-left">
            <button
              type="button"
              className="staff-btn-secondary"
              style={{ display: "inline-flex", padding: 8 }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Facility Selector */}
            <div className="staff-lot-selector">
              <Building2 size={16} color="var(--teal)" />
              <select
                className="staff-lot-select"
                value={selectedLotId}
                onChange={handleLotChange}
                aria-label="Chọn bãi đỗ xe vận hành"
              >
                {lots.map((lot) => (
                  <option key={lot.lotId} value={lot.lotId}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="staff-topbar-right">
            <div className="staff-shift-chip">
              <Clock size={14} />
              <span>Ca Sáng (06:00 - 14:00)</span>
            </div>

            <div className="staff-connection-pill">
              <span className="live-dot" />
              <span>Hệ thống Trực tuyến</span>
            </div>

            <button
              type="button"
              className="staff-quick-btn staff-btn-alert"
              onClick={() => setShowEmergencyModal(true)}
            >
              <ShieldAlert size={15} />
              <span>Báo động khẩn</span>
            </button>

            <button
              type="button"
              className="staff-btn-secondary"
              style={{ padding: "8px 12px" }}
              onClick={() => navigate("/login")}
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="staff-content">
          <Outlet context={{ selectedLotId }} />
        </main>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="staff-modal-backdrop" onClick={() => setShowEmergencyModal(false)}>
          <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header" style={{ background: "#fee2e2" }}>
              <h3 className="staff-modal-title" style={{ color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={20} />
                Phát lệnh Báo động Sự cố Khẩn cấp
              </h3>
              <button
                type="button"
                className="staff-btn-secondary"
                style={{ padding: 4 }}
                onClick={() => setShowEmergencyModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEmergencySubmit}>
              <div className="staff-modal-body">
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  Hành động này sẽ ghi nhận sự cố mức <strong>CRITICAL</strong> ngay lập tức lên hệ thống giám sát và thông báo cho Trưởng ca / Quản lý cơ sở.
                </p>
                <div className="staff-form-group">
                  <label className="staff-label">Mô tả tình huống khẩn cấp (*):</label>
                  <textarea
                    required
                    className="staff-textarea"
                    placeholder="Ví dụ: Chập điện khu vực cổng vào G1, barrier không thể mở tự động, phát hiện khói nhẹ..."
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                  />
                </div>
              </div>
              <div className="staff-modal-footer">
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
