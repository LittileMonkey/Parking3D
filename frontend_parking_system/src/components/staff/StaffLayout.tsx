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
    <VisionSpatialWorkspace
      role="staff"
      showRightStack={false}
      currentTabId={getStaffActiveTab()}
      openIncidentCount={openIncidentCount}
    >
      {lots.length > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            padding: "8px 16px",
            borderRadius: 12,
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontSize: 13,
            color: "#ffffff",
          }}
        >
          <span style={{ fontWeight: 700, color: "#6ee7b7" }}>Cơ sở bãi trực:</span>
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
