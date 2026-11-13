import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { managerApi } from "../../services/manager/managerApi";
import type { ManagerFacilitySummary, ReportingPeriod } from "../../types/manager";
import VisionSpatialWorkspace from "../glass/VisionSpatialWorkspace";
import "./ManagerDashboard.css";

export default function ManagerLayout() {
  const location = useLocation();

  const [facilities, setFacilities] = useState<Pick<ManagerFacilitySummary, "lotId" | "code" | "name" | "address">[]>([]);
  const [facilityError, setFacilityError] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string>("all");
  const [period, setPeriod] = useState<ReportingPeriod>("today");
  const [refreshKey, setRefreshKey] = useState(0);

  // Load facility list
  useEffect(() => {
    async function loadFacilities() {
      try {
        const facs = await managerApi.getManagedFacilities();
        setFacilities(facs);
        setSelectedLotId(current => current === "all" && facs.length === 1 ? facs[0].lotId : current);
        setFacilityError("");
      } catch (err) {
        setFacilities([]);
        setFacilityError(err instanceof Error ? err.message : "Không tải được danh sách bãi.");
      }
    }
    loadFacilities();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const getActiveTab = () => {
    if (location.pathname.includes("/pricing")) return "pricing";
    if (location.pathname.includes("/facility-layout")) return "slots";
    if (location.pathname.includes("/staff-shifts")) return "staff";
    if (location.pathname.includes("/incidents-approvals")) return "incidents";
    if (location.pathname.includes("/reports-audit")) return "reports";
    return "overview";
  };

  return (
    <VisionSpatialWorkspace role="admin" currentTabId={getActiveTab()} onRefresh={handleRefresh}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          padding: "8px 16px",
          borderRadius: 12,
          background: "rgba(14, 165, 233, 0.12)",
          border: "1px solid rgba(14, 165, 233, 0.28)",
          width: "fit-content",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ffffff" }}>
          <span style={{ fontWeight: 700, color: "#7dd3fc" }}>Bãi xe:</span>
          <select
            className="pm-form-select"
            style={{
              width: "auto",
              height: 34,
              padding: "0 12px",
              background: "rgba(10, 15, 26, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 8,
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
            }}
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(e.target.value)}
            aria-label="Chọn cơ sở bãi xe"
          >
            <option value="all">Tất cả bãi được quản lý</option>
            {facilities.map((fac) => (
              <option key={fac.lotId} value={fac.lotId}>
                {fac.name} ({fac.code})
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ffffff" }}>
          <span style={{ fontWeight: 700, color: "#7dd3fc" }}>Kỳ báo cáo:</span>
          <select
            className="pm-form-select"
            style={{
              width: "auto",
              height: 34,
              padding: "0 12px",
              background: "rgba(10, 15, 26, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 8,
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
            }}
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportingPeriod)}
            aria-label="Chọn kỳ báo cáo"
          >
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày gần nhất</option>
            <option value="month">30 ngày gần nhất</option>
          </select>
        </label>
      </div>
      {facilityError && <p role="alert">{facilityError}</p>}
      <Outlet
        context={{
          selectedLotId,
          setSelectedLotId,
          period,
          setPeriod,
          refreshKey,
          handleRefresh,
          facilities,
        }}
      />
    </VisionSpatialWorkspace>
  );
}
