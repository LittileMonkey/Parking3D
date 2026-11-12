import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { staffApi } from "../../services/staff/staffApi";
import type { ParkingLotSummary, Incident } from "../../types/staff";
import VisionSpatialWorkspace from "../glass/VisionSpatialWorkspace";
import "./StaffPortal.css";

export default function StaffLayout() {
  const location = useLocation();

  const [lots, setLots] = useState<ParkingLotSummary[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [openIncidentCount, setOpenIncidentCount] = useState<number>(0);

  // Load facilities & active incidents count
  useEffect(() => {
    async function loadInitial() {
      try {
        const facilityList = await staffApi.getParkingLots();
        setLots(facilityList);
        if (facilityList.length > 0 && !selectedLotId) {
          setSelectedLotId(facilityList[0].lotId);
        }
        const incidents: Incident[] = selectedLotId || facilityList[0]?.lotId ? await staffApi.getIncidents(selectedLotId || facilityList[0].lotId) : [];
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

  const getStaffActiveTab = () => {
    if (location.pathname.includes("/operations")) return "operations";
    if (location.pathname.includes("/parking")) return "parking";
    if (location.pathname.includes("/incidents")) return "incidents";
    if (location.pathname.includes("/shifts")) return "shifts";
    return "overview";
  };

  return (
    <VisionSpatialWorkspace role="staff" currentTabId={getStaffActiveTab()}>
      <Outlet
        context={{
          selectedLotId,
          setSelectedLotId,
          lots,
          openIncidentCount,
        }}
      />
    </VisionSpatialWorkspace>
  );
}
