import React, { useState, useEffect } from "react";
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
  Search,
  RefreshCw,
  Clock,
  Grid3X3,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Car,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  FileDown,
  Layers,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./VisionSpatialWorkspace.css";

export interface VisionNavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  routePath?: string;
}

interface VisionSpatialWorkspaceProps {
  role: "admin" | "staff";
  currentTabId?: string;
  onTabSelect?: (tabId: string) => void;
  children?: React.ReactNode;
}

export default function VisionSpatialWorkspace({
  role,
  currentTabId = "overview",
  onTabSelect,
  children,
}: VisionSpatialWorkspaceProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState(currentTabId);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetailedSubpage, setShowDetailedSubpage] = useState(false);
  const [selectedSegTab, setSelectedSegTab] = useState<"day" | "week" | "month" | "live">("week");
  const [activeBarIndex, setActiveBarIndex] = useState<number>(6);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Dynamic interactive counters matching Image 2
  const [cashCredits, setCashCredits] = useState<number>(role === "admin" ? 2450 : 1592);
  const [scanCount, setScanCount] = useState<number>(role === "admin" ? 95215 : 40772);
  const [contactsCount, setContactsCount] = useState<number>(role === "admin" ? 3241 : 2497);

  // Sync active tab with prop
  useEffect(() => {
    if (currentTabId) {
      setActiveTab(currentTabId);
    }
  }, [currentTabId]);

  // Loading shimmer state on initial mount & tab change
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCashCredits((prev) => prev + Math.floor(Math.random() * 25) + 5);
      setScanCount((prev) => prev + Math.floor(Math.random() * 15) + 1);
      setContactsCount((prev) => prev + (Math.random() > 0.5 ? 2 : -1));
    }, 700);
  };

  const handleTabClick = (tab: VisionNavTab) => {
    setActiveTab(tab.id);
    if (onTabSelect) {
      onTabSelect(tab.id);
    }
    if (tab.routePath) {
      navigate(tab.routePath);
    }
  };

  const handleExportSim = (reportName: string, format: string) => {
    setShowExportModal(false);
    setExportNotice(`Đã kết xuất file "${reportName}.${format}" thành công.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Admin Navigation Items
  const adminNavTabs: VisionNavTab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard size={17} />,
      routePath: "/manager/dashboard",
    },
    {
      id: "pricing",
      label: "Biểu phí",
      icon: <CreditCard size={17} />,
      routePath: "/manager/pricing",
    },
    {
      id: "slots",
      label: "Sơ đồ Ô đỗ",
      icon: <Sliders size={17} />,
      routePath: "/manager/facility-layout",
    },
    {
      id: "staff",
      label: "Nhân sự & Ca",
      icon: <Users size={17} />,
      routePath: "/manager/staff-shifts",
    },
    {
      id: "incidents",
      label: "Ngoại lệ",
      icon: <AlertTriangle size={17} />,
      badge: 3,
      routePath: "/manager/incidents-approvals",
    },
    {
      id: "reports",
      label: "Báo cáo",
      icon: <FileText size={17} />,
      routePath: "/manager/reports-audit",
    },
  ];

  // Staff Navigation Items
  const staffNavTabs: VisionNavTab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard size={17} />,
      routePath: "/staff/dashboard",
    },
    {
      id: "operations",
      label: "Vào / Ra xe",
      icon: <ArrowLeftRight size={17} />,
      routePath: "/staff/operations",
    },
    {
      id: "parking",
      label: "Mặt bằng 3D",
      icon: <Grid3X3 size={17} />,
      routePath: "/staff/parking",
    },
    {
      id: "incidents",
      label: "Sự cố trực",
      icon: <AlertTriangle size={17} />,
      badge: 1,
      routePath: "/staff/incidents",
    },
    {
      id: "shifts",
      label: "Giao ca trực",
      icon: <Clock size={17} />,
      routePath: "/staff/shifts",
    },
  ];

  const currentNavTabs = role === "admin" ? adminNavTabs : staffNavTabs;

  // Blue card bar chart days: D, L, M, M, J, V, S (as in reference Image 2)
  const blueBarData = [
    { day: "D", height: 42 },
    { day: "L", height: 68 },
    { day: "M", height: 50 },
    { day: "M", height: 86 },
    { day: "J", height: 60 },
    { day: "V", height: 75 },
    { day: "S", height: 68, isSpecial: true },
  ];

  // 14 Volume bars for Revenue chart
  const revenueBars = [
    { h: 32, val: "$18k", sub: "08:00 Mở ca", label: "08:00" },
    { h: 48, val: "$26k", sub: "09:00 Xe văn phòng", label: "" },
    { h: 62, val: "$34k", sub: "10:00 Cao điểm sáng", label: "10:00" },
    { h: 54, val: "$30k", sub: "11:00 Khách ẩm thực", label: "" },
    { h: 76, val: "$41k", sub: "12:00 Ăn trưa", label: "12:00" },
    { h: 60, val: "$35k", sub: "13:00 Xe ra vào ổn định", label: "" },
    { h: 96, val: "$46k Top", sub: "12:30 Optimal • Slot B1", isPeak: true, label: "14:00" },
    { h: 72, val: "$39k", sub: "15:00 Khách vãng lai", label: "" },
    { h: 58, val: "$32k", sub: "16:00 Giao dịch chuyển", label: "16:00" },
    { h: 66, val: "$37k", sub: "17:00 Tan tầm chiều", label: "" },
    { h: 84, val: "$44k", sub: "18:00 Cao điểm tối", label: "18:00" },
    { h: 50, val: "$28k", sub: "19:00 Khách sự kiện", label: "" },
    { h: 70, val: "$38k", sub: "20:00 Về bãi đêm", label: "20:00" },
    { h: 40, val: "$22k", sub: "22:00 Đóng cổng phụ", label: "22:00" },
  ];

  // Decide if we show the main VisionOS Reports/Analytics dashboard
  // Matches Image 2 if activeTab is "reports" or "overview", or if user toggles
  const isVisionDashboardView =
    (!showDetailedSubpage && (activeTab === "reports" || activeTab === "overview")) ||
    !children;

  return (
    <div className={`vision-spatial-shell role-${role}`}>
      {/* ── Spatial Container (Main Window + Right Floating Cards Stack) ── */}
      <div className="vision-spatial-container">
        {/* ── CENTRAL SPATIAL WINDOW ── */}
        <main className="vision-main-window">
          {/* Iconic Bottom Window Grab Handle */}
          <div className="vision-window-handle" />

          {/* ── INTEGRATED LEFT GLASS SIDEBAR ── */}
          <aside className="vision-sidebar">
            <div>
              {/* Workspace Header */}
              <div className="vision-workspace-header">
                <div className="vision-workspace-avatar">
                  {role === "admin" ? "AD" : "ST"}
                </div>
                <div className="vision-workspace-info">
                  <span className="vision-workspace-name">
                    {role === "admin" ? "Sarah's Workspace" : "Station Staff Officer"}
                  </span>
                  <span className="vision-workspace-status">
                    <span className="vision-status-dot" />
                    {role === "admin" ? "Metropolis HQ" : "Làn Barrier A1"}
                  </span>
                </div>
              </div>

              {/* Navigation Menu */}
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
                      {tab.badge && (
                        <span className="vision-nav-badge">{tab.badge}</span>
                      )}
                    </motion.button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="vision-sidebar-footer">
              <button
                type="button"
                className="vision-nav-item"
                onClick={() => setShowDetailedSubpage((prev) => !prev)}
                title="Chuyển đổi giao diện nghiệp vụ"
              >
                <Layers size={16} />
                <span>{showDetailedSubpage ? "Giao diện Không Gian" : "Chi tiết Nghiệp vụ"}</span>
              </button>
              <button
                type="button"
                className="vision-nav-item"
                onClick={logout}
                title="Đăng xuất"
              >
                <LogOut size={16} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </aside>

          {/* ── CENTER SPATIAL CONTENT PANE ── */}
          <section className="vision-center-pane">
            {/* Header row matching Image 2 */}
            <header className="vision-header-row">
              <div>
                <h1 className="vision-reports-title">
                  {activeTab === "reports"
                    ? "Reports"
                    : activeTab === "pricing"
                    ? "Biểu phí & Chính sách"
                    : activeTab === "slots"
                    ? "Sơ đồ Ô đỗ 3D"
                    : activeTab === "staff"
                    ? "Nhân sự & Ca trực"
                    : activeTab === "incidents"
                    ? "Sự cố & Phê duyệt"
                    : activeTab === "operations"
                    ? "Kiểm soát Vào / Ra xe"
                    : activeTab === "parking"
                    ? "Mặt bằng Đỗ xe 3D"
                    : activeTab === "shifts"
                    ? "Quản lý Giao ca Trực"
                    : role === "admin"
                    ? "Reports"
                    : "Field Operations"}
                </h1>
                <p className="vision-reports-sub">
                  {activeTab === "reports" || (activeTab === "overview" && role === "admin")
                    ? "Sales performance, updated live • Smart Parking Telemetry"
                    : role === "staff"
                    ? "Giám sát làn barrier & kiểm soát phương tiện trực tiếp"
                    : "Hệ thống quản lý bãi đỗ xe thông minh Metropolis • IoT Telemetry Online"}
                </p>
              </div>

              {/* Action Buttons (Export, Refresh, Search, Notifications) */}
              <div className="vision-header-actions">
                <motion.button
                  type="button"
                  className="vision-export-btn"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setShowExportModal(true)}
                  title="Xuất báo cáo định dạng PDF/Excel"
                >
                  <Download size={14} />
                  <span>Export</span>
                </motion.button>

                <motion.button
                  type="button"
                  className="vision-icon-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleRefresh}
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw size={15} className={isLoading ? "spin-animation" : ""} />
                </motion.button>

                <motion.button
                  type="button"
                  className="vision-icon-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  title="Tìm kiếm"
                >
                  <Search size={15} />
                </motion.button>

                <motion.button
                  type="button"
                  className="vision-icon-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  title="Thông báo"
                >
                  <Bell size={15} />
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
                </motion.button>
              </div>
            </header>

            {/* Notification Banner when file is exported */}
            {exportNotice && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  background: "rgba(16, 185, 129, 0.22)",
                  border: "1px solid rgba(16, 185, 129, 0.45)",
                  borderRadius: 14,
                  padding: "10px 16px",
                  color: "#86efac",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} />
                <span>{exportNotice}</span>
              </motion.div>
            )}

            {/* Content Switcher: Show exact Image 2 Dashboard OR Nested Subpage */}
            {isVisionDashboardView ? (
              <AnimatePresence mode="wait">
                {isLoading ? (
                  /* ── SKELETON SHIMMER LOADING (Matching Image 1 & 2) ── */
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                  >
                    <div className="vision-stat-row">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="vision-skeleton-card">
                          <div className="vision-skeleton-shimmer" />
                          <div className="vision-skeleton-line short" />
                          <div className="vision-skeleton-line large" />
                        </div>
                      ))}
                    </div>
                    <div className="vision-two-col-grid">
                      <div className="vision-glass-panel" style={{ height: 230 }}>
                        <div className="vision-skeleton-shimmer" />
                        <div className="vision-skeleton-line short" />
                        <div className="vision-skeleton-line large" style={{ width: "90%", height: 110 }} />
                      </div>
                      <div className="vision-glass-panel" style={{ height: 230 }}>
                        <div className="vision-skeleton-shimmer" />
                        <div className="vision-skeleton-line short" />
                        <div className="vision-skeleton-line medium" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ── LOADED DASHBOARD EXACTLY MATCHING IMAGE 2 ─────────── */
                  <motion.div
                    key="loaded"
                    initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                  >
                    {/* ── ROW 1: 4 STAT CARDS (Exact match to Image 2) ── */}
                    <div className="vision-stat-row">
                      {/* Card 1: Revenue ($511k) */}
                      <motion.div
                        className="vision-stat-card"
                        whileHover={{ y: -5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-stat-top">
                          <span className="vision-stat-label">Revenue</span>
                          <span className="vision-trend-pill positive">
                            <ArrowUpRight size={12} /> 8.2%
                          </span>
                        </div>
                        <div className="vision-stat-num">
                          {role === "admin" ? "$511k" : "$182k"}
                        </div>
                      </motion.div>

                      {/* Card 2: Occupancy (32.1%) */}
                      <motion.div
                        className="vision-stat-card"
                        whileHover={{ y: -5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-stat-top">
                          <span className="vision-stat-label">Occupancy</span>
                          <span className="vision-trend-pill blue">
                            <ArrowUpRight size={12} /> 2.4%
                          </span>
                        </div>
                        <div className="vision-stat-num">
                          {role === "admin" ? "32.1%" : "78.4%"}
                        </div>
                      </motion.div>

                      {/* Card 3: Avg Ticket ($13,906) */}
                      <motion.div
                        className="vision-stat-card"
                        whileHover={{ y: -5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-stat-top">
                          <span className="vision-stat-label">Avg Ticket</span>
                          <span className="vision-trend-pill positive">
                            <ArrowUpRight size={12} /> 5.8%
                          </span>
                        </div>
                        <div className="vision-stat-num">
                          {role === "admin" ? "$13,906" : "$8,450"}
                        </div>
                      </motion.div>

                      {/* Card 4: Turnover (20 days) */}
                      <motion.div
                        className="vision-stat-card"
                        whileHover={{ y: -5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-stat-top">
                          <span className="vision-stat-label">Turnover</span>
                          <span className="vision-trend-pill negative">
                            <ArrowDownRight size={12} /> 1.2%
                          </span>
                        </div>
                        <div className="vision-stat-num">
                          {role === "admin" ? "20 days" : "2.4 hrs"}
                        </div>
                      </motion.div>
                    </div>

                    {/* ── ROW 2: REVENUE BAR CHART + LEAD SOURCES DONUT ── */}
                    <div className="vision-two-col-grid">
                      {/* Left Card: Revenue Volume Bar Chart */}
                      <motion.div
                        className="vision-glass-panel"
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-panel-header">
                          <div className="vision-panel-title-wrap">
                            <h3 className="vision-panel-title">Revenue</h3>
                            <p className="vision-panel-sub">+12.4% vs last week</p>
                          </div>
                          {/* Segmented Time Filters */}
                          <div className="vision-seg-tabs">
                            <button
                              type="button"
                              className={`vision-seg-tab ${selectedSegTab === "day" ? "active" : ""}`}
                              onClick={() => setSelectedSegTab("day")}
                            >
                              Day
                            </button>
                            <button
                              type="button"
                              className={`vision-seg-tab ${selectedSegTab === "week" ? "active" : ""}`}
                              onClick={() => setSelectedSegTab("week")}
                            >
                              Week
                            </button>
                            <button
                              type="button"
                              className={`vision-seg-tab ${selectedSegTab === "month" ? "active" : ""}`}
                              onClick={() => setSelectedSegTab("month")}
                            >
                              Month
                            </button>
                            <button
                              type="button"
                              className={`vision-seg-tab ${selectedSegTab === "live" ? "active" : ""}`}
                              onClick={() => setSelectedSegTab("live")}
                            >
                              Live
                            </button>
                          </div>
                        </div>

                        {/* Bar Chart Container */}
                        <div className="vision-revenue-chart-wrap">
                          {/* The Exact Floating Peak Tooltip from Image 2 */}
                          <div
                            className="vision-peak-tooltip"
                            style={{
                              left: `${Math.min(82, Math.max(18, ((activeBarIndex + 0.5) / revenueBars.length) * 100))}%`,
                            }}
                          >
                            <span className="vision-peak-tooltip-val">
                              {revenueBars[activeBarIndex]?.val}
                            </span>
                            <span className="vision-peak-tooltip-sub">
                              {revenueBars[activeBarIndex]?.sub}
                            </span>
                          </div>

                          {/* Volume Bars */}
                          <div className="vision-vol-bars">
                            {revenueBars.map((bar, idx) => (
                              <div
                                key={idx}
                                className={`vision-vol-bar-col ${activeBarIndex === idx ? "peak" : ""}`}
                                onMouseEnter={() => setActiveBarIndex(idx)}
                                onClick={() => setActiveBarIndex(idx)}
                              >
                                <motion.div
                                  className="vision-vol-bar-pill"
                                  initial={{ height: 0 }}
                                  animate={{ height: `${bar.h}%` }}
                                  transition={{ duration: 0.6, delay: idx * 0.03 }}
                                />
                              </div>
                            ))}
                          </div>

                          {/* Time Labels */}
                          <div className="vision-vol-time-labels">
                            <span>08:00</span>
                            <span>10:00</span>
                            <span>12:00</span>
                            <span>14:00</span>
                            <span>16:00</span>
                            <span>18:00</span>
                            <span>20:00</span>
                            <span>22:00</span>
                          </div>
                        </div>
                      </motion.div>

                      {/* Right Card: Lead Sources Donut Chart */}
                      <motion.div
                        className="vision-glass-panel"
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-panel-header">
                          <div className="vision-panel-title-wrap">
                            <h3 className="vision-panel-title">Lead sources</h3>
                            <p className="vision-panel-sub">This Month</p>
                          </div>
                        </div>

                        <div className="vision-donut-card-body">
                          {/* SVG Donut Ring */}
                          <div className="vision-donut-svg-wrap">
                            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                              {/* Background Circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r="38"
                                fill="none"
                                stroke="rgba(255, 255, 255, 0.08)"
                                strokeWidth="9"
                              />
                              {/* Cyan Arc (58%) */}
                              <circle
                                cx="50"
                                cy="50"
                                r="38"
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="9"
                                strokeDasharray="138 238"
                                strokeDashoffset="0"
                                strokeLinecap="round"
                              />
                              {/* Emerald Arc (28%) */}
                              <circle
                                cx="50"
                                cy="50"
                                r="38"
                                fill="none"
                                stroke="#34d399"
                                strokeWidth="9"
                                strokeDasharray="66 238"
                                strokeDashoffset="-142"
                                strokeLinecap="round"
                              />
                              {/* Purple Arc (14%) */}
                              <circle
                                cx="50"
                                cy="50"
                                r="38"
                                fill="none"
                                stroke="#c084fc"
                                strokeWidth="9"
                                strokeDasharray="33 238"
                                strokeDashoffset="-212"
                                strokeLinecap="round"
                              />
                            </svg>
                            {/* Center Value */}
                            <div className="vision-donut-center-text">
                              <span className="vision-donut-center-num">248</span>
                              <span className="vision-donut-center-sub">Total</span>
                            </div>
                          </div>

                          {/* Legend List */}
                          <div className="vision-donut-legend">
                            <div className="vision-donut-legend-item">
                              <div className="vision-donut-item-left">
                                <span className="vision-donut-dot" style={{ background: "#38bdf8" }} />
                                <span>Ô tô vãng lai</span>
                              </div>
                              <span className="vision-donut-pct">58%</span>
                            </div>
                            <div className="vision-donut-legend-item">
                              <div className="vision-donut-item-left">
                                <span className="vision-donut-dot" style={{ background: "#34d399" }} />
                                <span>Cư dân tháng</span>
                              </div>
                              <span className="vision-donut-pct">28%</span>
                            </div>
                            <div className="vision-donut-legend-item">
                              <div className="vision-donut-item-left">
                                <span className="vision-donut-dot" style={{ background: "#c084fc" }} />
                                <span>Xe điện / VIP</span>
                              </div>
                              <span className="vision-donut-pct">14%</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* ── ROW 3: LEADERBOARD + CONVERSION FUNNEL ── */}
                    <div className="vision-two-col-grid">
                      {/* Left: Leaderboard (Zone Occupancy) */}
                      <motion.div
                        className="vision-glass-panel"
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-panel-header">
                          <div className="vision-panel-title-wrap">
                            <h3 className="vision-panel-title">Leaderboard</h3>
                            <p className="vision-panel-sub">Top Performing Zones</p>
                          </div>
                        </div>

                        <div className="vision-leaderboard-list">
                          {/* Item 1 */}
                          <div className="vision-leader-item">
                            <div className="vision-leader-avatar" style={{ background: "rgba(56, 189, 248, 0.2)", borderColor: "#38bdf8" }}>
                              B1
                            </div>
                            <div className="vision-leader-info">
                              <span className="vision-leader-name">Tầng hầm B1 - Khu A (SUV & Sedan)</span>
                              <div className="vision-leader-bar-bg">
                                <div
                                  className="vision-leader-bar-fill"
                                  style={{ width: "100%", background: "linear-gradient(90deg, #38bdf8, #0284c7)" }}
                                />
                              </div>
                            </div>
                            <span className="vision-leader-pct">100%</span>
                          </div>

                          {/* Item 2 */}
                          <div className="vision-leader-item">
                            <div className="vision-leader-avatar" style={{ background: "rgba(52, 211, 153, 0.2)", borderColor: "#34d399" }}>
                              B2
                            </div>
                            <div className="vision-leader-info">
                              <span className="vision-leader-name">Tầng hầm B2 - Khu B (Xe máy & Compact)</span>
                              <div className="vision-leader-bar-bg">
                                <div
                                  className="vision-leader-bar-fill"
                                  style={{ width: "84%", background: "linear-gradient(90deg, #34d399, #059669)" }}
                                />
                              </div>
                            </div>
                            <span className="vision-leader-pct">84%</span>
                          </div>

                          {/* Item 3 */}
                          <div className="vision-leader-item">
                            <div className="vision-leader-avatar" style={{ background: "rgba(192, 132, 252, 0.2)", borderColor: "#c084fc" }}>
                              OC
                            </div>
                            <div className="vision-leader-info">
                              <span className="vision-leader-name">Khu Ngoài trời C (Sạc điện & Bus)</span>
                              <div className="vision-leader-bar-bg">
                                <div
                                  className="vision-leader-bar-fill"
                                  style={{ width: "52%", background: "linear-gradient(90deg, #c084fc, #9333ea)" }}
                                />
                              </div>
                            </div>
                            <span className="vision-leader-pct">52%</span>
                          </div>
                        </div>
                      </motion.div>

                      {/* Right: Conversion Funnel (Traffic Stages) */}
                      <motion.div
                        className="vision-glass-panel"
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <div className="vision-panel-header">
                          <div className="vision-panel-title-wrap">
                            <h3 className="vision-panel-title">Conversion funnel</h3>
                            <p className="vision-panel-sub">Traffic Stages</p>
                          </div>
                        </div>

                        <div className="vision-funnel-list">
                          {/* Stage 1 */}
                          <div
                            className="vision-funnel-step"
                            style={{
                              background: "linear-gradient(90deg, rgba(56, 189, 248, 0.25) 0%, rgba(2, 132, 199, 0.35) 100%)",
                              borderColor: "rgba(56, 189, 248, 0.4)",
                            }}
                          >
                            <span className="vision-funnel-label">
                              <Car size={15} /> Xe quét biển số vào
                            </span>
                            <span className="vision-funnel-val">248</span>
                          </div>

                          {/* Stage 2 */}
                          <div
                            className="vision-funnel-step"
                            style={{
                              background: "linear-gradient(90deg, rgba(96, 165, 250, 0.25) 0%, rgba(37, 99, 235, 0.35) 100%)",
                              borderColor: "rgba(96, 165, 250, 0.4)",
                              width: "82%",
                              marginLeft: "auto",
                              marginRight: "auto",
                            }}
                          >
                            <span className="vision-funnel-label">
                              <Clock size={15} /> Đang đỗ trong bãi
                            </span>
                            <span className="vision-funnel-val">124</span>
                          </div>

                          {/* Stage 3 */}
                          <div
                            className="vision-funnel-step"
                            style={{
                              background: "linear-gradient(90deg, rgba(192, 132, 252, 0.25) 0%, rgba(147, 51, 234, 0.35) 100%)",
                              borderColor: "rgba(192, 132, 252, 0.4)",
                              width: "65%",
                              marginLeft: "auto",
                              marginRight: "auto",
                            }}
                          >
                            <span className="vision-funnel-label">
                              <CheckCircle2 size={15} /> Thanh toán & Ra bãi
                            </span>
                            <span className="vision-funnel-val">61</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              /* ── DETAILED SUBPAGE VIEW (Biểu phí, Sơ đồ 3D, Ca trực, v.v.) ── */
              <div className="vision-subpage-wrap">
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
                  <motion.button
                    type="button"
                    className="vision-export-btn"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      if (activeTab !== "overview" && activeTab !== "reports") {
                        setActiveTab("overview");
                        navigate(role === "admin" ? "/manager/dashboard" : "/staff/dashboard");
                      } else {
                        setShowDetailedSubpage(false);
                      }
                    }}
                    style={{ fontSize: 12 }}
                  >
                    ← Quay lại Dashboard Không Gian
                  </motion.button>
                </div>
                {children}
              </div>
            )}
          </section>
        </main>

        {/* ── 3 FLOATING COMPANION CARDS (RIGHT SIDE) ── */}
        <aside className="vision-right-stack">
          {/* Card 1: Sapphire Oceanic Blue Glass Card (Contacts 3,241) */}
          <motion.div
            className="vision-float-card blue-widget"
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div>
              <div className="vision-widget-header">
                <span className="vision-widget-title">Contacts</span>
                <span className="vision-widget-pill">Online</span>
              </div>
              <div className="vision-widget-val">{contactsCount.toLocaleString()}</div>
              <div className="vision-widget-sub">+2.8% so với hôm qua</div>
            </div>

            {/* Day of Week Vertical Capsule Bars (D, L, M, M, J, V, S) */}
            <div className="vision-blue-bars">
              {blueBarData.map((item, idx) => (
                <div
                  key={idx}
                  className={`vision-blue-bar-col ${item.isSpecial ? "highlight" : ""}`}
                >
                  <motion.div
                    className="vision-blue-bar-pill"
                    initial={{ height: 0 }}
                    animate={{ height: `${item.height}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                  />
                  <span className="vision-blue-bar-label">{item.day}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 2: Warm Smoky Caramel Bronze Glass Card (Credits $2,450) */}
          <motion.div
            className="vision-float-card amber-widget"
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="vision-widget-header">
              <span className="vision-widget-title">Credits</span>
              <motion.button
                type="button"
                className="vision-round-plus"
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCashCredits((prev) => prev + 100);
                }}
                title="Cộng thêm tín dụng điều hành"
              >
                +
              </motion.button>
            </div>
            <div>
              <div className="vision-widget-val">${cashCredits.toLocaleString()}</div>
              <div className="vision-widget-sub">Đối soát ca trực đã khớp</div>
            </div>
          </motion.div>

          {/* Card 3: Smoked Obsidian Dark Glass Card (Texts Sent 95,215) */}
          <motion.div
            className="vision-float-card dark-widget"
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div>
              <div className="vision-widget-header">
                <span className="vision-widget-title">Texts Sent</span>
                <span className="vision-widget-pill" style={{ cursor: "pointer" }}>
                  All time ▾
                </span>
              </div>
              <div className="vision-widget-val">{scanCount.toLocaleString()}</div>
              <div className="vision-widget-sub" style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowUpRight size={13} /> +7.8% quét biển số OCR
              </div>
            </div>

            {/* Glowing Smooth Spline Curve SVG */}
            <div style={{ height: 90, width: "100%", marginTop: 10, position: "relative" }}>
              <svg viewBox="0 0 240 80" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ffffff" floodOpacity="0.9" />
                  </filter>
                </defs>
                <path
                  d="M 0 22 Q 60 76 120 42 T 235 12 L 235 80 L 0 80 Z"
                  fill="url(#curveGradient)"
                />
                <path
                  d="M 0 22 Q 60 76 120 42 T 235 12"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                {/* Glowing Dot at Top Right */}
                <circle cx="235" cy="12" r="5" fill="#ffffff" filter="url(#glow)" />
              </svg>
            </div>
          </motion.div>
        </aside>
      </div>

      {/* ── EXPORT GLASS MODAL ── */}
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
                <h3 className="vision-export-modal-title">Kết Xuất Báo Cáo Định Kỳ</h3>
                <button
                  type="button"
                  className="vision-icon-btn"
                  onClick={() => setShowExportModal(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.7)", margin: 0 }}>
                Chọn định dạng kết xuất dữ liệu phục vụ đối soát, kiểm toán và báo cáo quản lý:
              </p>

              <div className="vision-export-grid">
                <div
                  className="vision-export-option-card"
                  onClick={() => handleExportSim("Báo Cáo Doanh Thu Ngày", "pdf")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <FileDown size={22} style={{ color: "#38bdf8" }} />
                    <div>
                      <strong style={{ fontSize: 14 }}>Báo Cáo Doanh Thu Ngày</strong>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        Phân tách tiền mặt vs VietQR, block 15m (PDF)
                      </div>
                    </div>
                  </div>
                  <span className="vision-widget-pill">PDF</span>
                </div>

                <div
                  className="vision-export-option-card"
                  onClick={() => handleExportSim("Lưu Lượng & Tỷ Lệ Lấp Đầy", "xlsx")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <FileSpreadsheet size={22} style={{ color: "#34d399" }} />
                    <div>
                      <strong style={{ fontSize: 14 }}>Lưu Lượng & Tỷ Lệ Lấp Đầy</strong>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        Phân tích giờ cao điểm, xe ra vào tuần (Excel XLSX)
                      </div>
                    </div>
                  </div>
                  <span className="vision-widget-pill" style={{ color: "#34d399" }}>XLSX</span>
                </div>

                <div
                  className="vision-export-option-card"
                  onClick={() => handleExportSim("Nhật Ký Kiểm Toán Bất Biến", "json")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ShieldCheck size={22} style={{ color: "#c084fc" }} />
                    <div>
                      <strong style={{ fontSize: 14 }}>Nhật Ký Kiểm Toán Bất Biến (Audit Trail)</strong>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        Bảo mật chữ ký số SHA-256 (JSON / CSV)
                      </div>
                    </div>
                  </div>
                  <span className="vision-widget-pill" style={{ color: "#c084fc" }}>JSON</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
