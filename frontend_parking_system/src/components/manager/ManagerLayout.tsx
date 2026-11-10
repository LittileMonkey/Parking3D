import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { managerApi } from "../../services/manager/managerApi";
import type { ManagerFacilitySummary, ReportingPeriod } from "../../types/manager";
import VisionSpatialWorkspace from "../glass/VisionSpatialWorkspace";
import "./ManagerDashboard.css";

export default function ManagerLayout() {
  const location = useLocation();

  const [facilities, setFacilities] = useState<ManagerFacilitySummary[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("all");
  const [period, setPeriod] = useState<ReportingPeriod>("today");
  const [refreshKey, setRefreshKey] = useState(0);

  // Load facility list
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
    <VisionSpatialWorkspace role="admin" currentTabId={getActiveTab()}>
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
