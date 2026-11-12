import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  AlertTriangle,
  FileText,
  Sliders,
  Users,
  LogOut,
  Bell,
  RefreshCw,
  Clock,
  Grid3X3,
  Download,
  ArrowUpRight,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { managerApi } from "../../services/manager/managerApi";
import { staffApi } from "../../services/staff/staffApi";
import { operations } from "../../services/operations";
import "./VisionSpatialWorkspace.css";

export interface VisionNavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  routePath?: string;
}

interface VisionSpatialWorkspaceProps {
  role: "admin" | "staff";
  currentTabId?: string;
  onTabSelect?: (tabId: string) => void;
  onRefresh?: () => void;
  openIncidentCount?: number;
  children?: React.ReactNode;
}

interface LiveStats {
  lotCount: number;
  primaryLotName: string;
  occupied: number;
  capacity: number;
  entries: number;
  exits: number;
  netRevenue: number;
  cashRevenue: number;
  digitalRevenue: number;
  openIncidents: number;
  unreadNotifications: number;
}

const INITIAL_STATS: LiveStats = {
  lotCount: 0,
  primaryLotName: "Chưa phân công bãi",
  occupied: 0,
  capacity: 0,
  entries: 0,
  exits: 0,
  netRevenue: 0,
  cashRevenue: 0,
  digitalRevenue: 0,
  openIncidents: 0,
  unreadNotifications: 0,
};

export default function VisionSpatialWorkspace({
  role,
  currentTabId = "overview",
  onTabSelect,
  onRefresh,
  openIncidentCount,
  children,
}: VisionSpatialWorkspaceProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState(currentTabId);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<LiveStats>(INITIAL_STATS);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (currentTabId) {
      setActiveTab(currentTabId);
    }
  }, [currentTabId]);

  const loadLiveStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const fromIso = from.toISOString();
      const untilIso = new Date().toISOString();

      const notifPromise = api.getNotifications().catch(() => ({ unreadCount: 0, items: [] }));

      if (role === "admin") {
        const [facilities, notifs] = await Promise.all([
          managerApi.getManagedFacilities().catch(() => []),
          notifPromise,
        ]);
        const summaries = await Promise.all(
          facilities.map(async (fac) => {
            const [usage, revenue, inc] = await Promise.all([
              operations.usage(fac.lotId, fromIso, untilIso).catch(() => null),
              operations.revenue(fac.lotId, fromIso, untilIso).catch(() => null),
              api.getIncidents(fac.lotId).catch(() => ({ items: [] })),
            ]);
            return { usage, revenue, openCount: inc.items.filter((i: any) => i.status === "Open" || i.status === "InProgress").length };
          })
        );
        setStats({
          lotCount: facilities.length,
          primaryLotName: facilities[0]?.name ?? "Chưa phân công bãi quản lý",
          occupied: summaries.reduce((s, r) => s + (r.usage?.occupied ?? 0), 0),
          capacity: summaries.reduce((s, r) => s + (r.usage?.capacity ?? 0), 0),
          entries: summaries.reduce((s, r) => s + (r.usage?.entries ?? 0), 0),
          exits: summaries.reduce((s, r) => s + (r.usage?.exits ?? 0), 0),
          netRevenue: summaries.reduce((s, r) => s + (r.revenue?.net ?? 0), 0),
          cashRevenue: summaries.reduce((s, r) => s + (r.revenue?.cash ?? 0), 0),
          digitalRevenue: summaries.reduce((s, r) => s + (r.revenue?.digital ?? 0), 0),
          openIncidents: summaries.reduce((s, r) => s + r.openCount, 0),
          unreadNotifications: notifs.unreadCount ?? 0,
        });
      } else {
        const [lots, notifs] = await Promise.all([
          staffApi.getParkingLots().catch(() => []),
          notifPromise,
        ]);
        const primaryLot = lots[0];
        const [summary, inc] = primaryLot
          ? await Promise.all([
              operations.summary(primaryLot.lotId, fromIso, untilIso).catch(() => null),
              api.getIncidents(primaryLot.lotId).catch(() => ({ items: [] })),
            ])
          : [null, { items: [] }];
        setStats({
          lotCount: lots.length,
          primaryLotName: primaryLot?.name ?? "Chưa phân công bãi trực",
          occupied: lots.reduce((s, l) => s + l.occupiedCount, 0),
          capacity: lots.reduce((s, l) => s + l.totalCapacity, 0),
          entries: summary?.entries ?? 0,
          exits: summary?.exits ?? 0,
          netRevenue: 0,
          cashRevenue: 0,
          digitalRevenue: 0,
          openIncidents:
            openIncidentCount ??
            inc.items.filter((i: any) => i.status === "Open" || i.status === "InProgress").length,
          unreadNotifications: notifs.unreadCount ?? 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [role, openIncidentCount]);

  useEffect(() => {
    void loadLiveStats();
  }, [loadLiveStats, refreshTick]);

  const handleRefresh = () => {
    setRefreshTick((n) => n + 1);
    onRefresh?.();
  };

  const handleTabClick = (tab: VisionNavTab) => {
    setActiveTab(tab.id);
    onTabSelect?.(tab.id);
    if (tab.routePath) {
      navigate(tab.routePath);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ["Chỉ số", "Giá trị"],
      ["Cơ sở chính", stats.primaryLotName],
      ["Số bãi phụ trách", String(stats.lotCount)],
      ["Đang đỗ", String(stats.occupied)],
      ["Sức chứa", String(stats.capacity)],
      ["Lượt vào hôm nay", String(stats.entries)],
      ["Lượt ra hôm nay", String(stats.exits)],
      ["Thu ròng (VND)", String(stats.netRevenue)],
      ["Tiền mặt (VND)", String(stats.cashRevenue)],
      ["Điện tử (VND)", String(stats.digitalRevenue)],
      ["Sự cố đang mở", String(stats.openIncidents)],
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `parking-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setShowExportModal(false);
    setExportNotice("Đã xuất báo cáo CSV từ dữ liệu máy chủ.");
    setTimeout(() => setExportNotice(null), 3500);
  };

  const incidentBadge = openIncidentCount ?? stats.openIncidents;

  const adminNavTabs: VisionNavTab[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={17} />, routePath: "/manager/dashboard" },
    { id: "pricing", label: "Biểu phí", icon: <CreditCard size={17} />, routePath: "/manager/pricing" },
    { id: "slots", label: "Sơ đồ Ô đỗ", icon: <Sliders size={17} />, routePath: "/manager/facility-layout" },
    { id: "staff", label: "Nhân sự & Ca", icon: <Users size={17} />, routePath: "/manager/staff-shifts" },
    {
      id: "incidents",
      label: "Ngoại lệ",
      icon: <AlertTriangle size={17} />,
      badge: incidentBadge > 0 ? incidentBadge : undefined,
      routePath: "/manager/incidents-approvals",
    },
    { id: "reports", label: "Báo cáo", icon: <FileText size={17} />, routePath: "/manager/reports-audit" },
  ];

  const staffNavTabs: VisionNavTab[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={17} />, routePath: "/staff/dashboard" },
    { id: "operations", label: "Vào / Ra xe", icon: <ArrowLeftRight size={17} />, routePath: "/staff/operations" },
    { id: "parking", label: "Mặt bằng 3D", icon: <Grid3X3 size={17} />, routePath: "/staff/parking" },
    {
      id: "incidents",
      label: "Sự cố trực",
      icon: <AlertTriangle size={17} />,
      badge: incidentBadge > 0 ? incidentBadge : undefined,
      routePath: "/staff/incidents",
    },
    { id: "shifts", label: "Giao ca trực", icon: <Clock size={17} />, routePath: "/staff/shifts" },
  ];

  const currentNavTabs = role === "admin" ? adminNavTabs : staffNavTabs;
  const displayName = user?.fullName || user?.email || (role === "admin" ? "Quản lý bãi xe" : "Nhân viên vận hành");
  const initials = displayName.slice(0, 2).toUpperCase();
  const occupancyPct = stats.capacity > 0 ? Math.round((stats.occupied * 100) / stats.capacity) : 0;

  return (
    <div className={`vision-spatial-shell role-${role}`}>
      <div className="vision-spatial-container">
        <main className="vision-main-window">
          <div className="vision-window-handle" />

          <aside className="vision-sidebar">
            <div>
              <div className="vision-workspace-header">
                <div className="vision-workspace-avatar">{initials}</div>
                <div className="vision-workspace-info">
                  <span className="vision-workspace-name">{displayName}</span>
                  <span className="vision-workspace-status">
                    <span className="vision-status-dot" />
                    {stats.primaryLotName}
                  </span>
                </div>
              </div>

              <nav className="vision-nav-list">
                {currentNavTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      className={`vision-nav-item ${isActive ? "active" : ""}`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleTabClick(tab)}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && <span className="vision-nav-badge">{tab.badge}</span>}
                    </motion.button>
                  );
                })}
              </nav>
            </div>

            <div className="vision-sidebar-footer">
              <button
                type="button"
                className="vision-nav-item"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                title="Đăng xuất"
              >
                <LogOut size={16} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </aside>

          <section className="vision-center-pane">
            <header className="vision-header-row">
              <div>
                <h1 className="vision-reports-title">
                  {activeTab === "reports"
                    ? "Báo cáo & Audit"
                    : activeTab === "pricing"
                      ? "Biểu phí & Chính sách"
                      : activeTab === "slots"
                        ? "Sơ đồ Ô đỗ"
                        : activeTab === "staff"
                          ? "Nhân sự & Ca trực"
                          : activeTab === "incidents"
                            ? "Sự cố & Phê duyệt"
                            : activeTab === "operations"
                              ? "Kiểm soát Vào / Ra xe"
                              : activeTab === "parking"
                                ? "Mặt bằng Đỗ xe"
                                : activeTab === "shifts"
                                  ? "Quản lý Giao ca Trực"
                                  : role === "admin"
                                    ? "Điều hành Bãi đỗ xe"
                                    : "Vận hành Bãi xe"}
                </h1>
                <p className="vision-reports-sub">
                  {stats.primaryLotName} • {stats.lotCount} cơ sở được phân công
                </p>
              </div>

              <div className="vision-header-actions">
                <motion.button
                  type="button"
                  className="vision-export-btn"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setShowExportModal(true)}
                  title="Xuất báo cáo tổng hợp CSV"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </motion.button>

                <motion.button
                  type="button"
                  className="vision-icon-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleRefresh}
                  title="Tải lại dữ liệu từ máy chủ"
                >
                  <RefreshCw size={15} className={isLoading ? "spin-animation" : ""} />
                </motion.button>

                <motion.button
                  type="button"
                  className="vision-icon-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => navigate(role === "admin" ? "/manager/incidents-approvals" : "/staff/incidents")}
                  title={`Thông báo chưa đọc: ${stats.unreadNotifications}`}
                >
                  <Bell size={15} />
                  {stats.unreadNotifications > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#ef4444",
                      }}
                    />
                  )}
                </motion.button>
              </div>
            </header>

            {exportNotice && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.22)",
                  border: "1px solid rgba(16, 185, 129, 0.45)",
                  borderRadius: 14,
                  padding: "10px 16px",
                  color: "#86efac",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {exportNotice}
              </div>
            )}

            <div className="vision-subpage-wrap">{children}</div>
          </section>
        </main>

        <aside className="vision-right-stack">
          <motion.div
            className="vision-float-card blue-widget"
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div>
              <div className="vision-widget-header">
                <span className="vision-widget-title">Công suất bãi</span>
                <span className="vision-widget-pill">{occupancyPct}%</span>
              </div>
              <div className="vision-widget-val">
                {stats.occupied} / {stats.capacity}
              </div>
              <div className="vision-widget-sub">Ô đang đỗ / Sức chứa hoạt động</div>
            </div>
          </motion.div>

          <motion.div
            className="vision-float-card amber-widget"
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="vision-widget-header">
              <span className="vision-widget-title">{role === "admin" ? "Thu ròng hôm nay" : "Lưu lượng hôm nay"}</span>
            </div>
            <div>
              <div className="vision-widget-val">
                {role === "admin" ? `${stats.netRevenue.toLocaleString("vi-VN")} đ` : `${stats.entries} / ${stats.exits}`}
              </div>
              <div className="vision-widget-sub">
                {role === "admin"
                  ? `Tiền mặt: ${stats.cashRevenue.toLocaleString("vi-VN")} đ · Điện tử: ${stats.digitalRevenue.toLocaleString("vi-VN")} đ`
                  : "Lượt vào / Lượt ra trong ngày"}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="vision-float-card dark-widget"
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div>
              <div className="vision-widget-header">
                <span className="vision-widget-title">Sự cố & Cảnh báo</span>
                <span className="vision-widget-pill">Live</span>
              </div>
              <div className="vision-widget-val">{incidentBadge}</div>
              <div className="vision-widget-sub" style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowUpRight size={13} /> Vào: {stats.entries} · Ra: {stats.exits} · Thông báo: {stats.unreadNotifications}
              </div>
            </div>
          </motion.div>
        </aside>
      </div>

      <AnimatePresence>
        {showExportModal && (
          <motion.div
            className="vision-export-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              className="vision-export-modal-box"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vision-export-modal-header">
                <h3 className="vision-export-modal-title">Xuất báo cáo tổng hợp</h3>
                <button type="button" className="vision-icon-btn" onClick={() => setShowExportModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="vision-export-grid">
                <div className="vision-export-option-card" onClick={handleExportCsv}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <FileSpreadsheet size={22} style={{ color: "#34d399" }} />
                    <div>
                      <strong style={{ fontSize: 14 }}>Tải tổng hợp vận hành & doanh thu (CSV)</strong>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        Dữ liệu trực tiếp từ API Parking & Payment
                      </div>
                    </div>
                  </div>
                  <span className="vision-widget-pill" style={{ color: "#34d399" }}>CSV</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
