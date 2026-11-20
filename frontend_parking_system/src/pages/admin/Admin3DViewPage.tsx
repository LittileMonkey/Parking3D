import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  Sliders,
  RefreshCw,
  Layers,
  Car,
  Bike,
  Zap,
  X,
  Radio,
} from "lucide-react";
import { api, type ParkingLot, type LotLayout3DDto } from "../../services/api";
import { staffApi } from "../../services/staff/staffApi";
import type { ParkingSlotDetail, SlotStatus } from "../../types/staff";
import ParkingViewer, { type ModelLevel } from "../../components/parking/ParkingViewer";
import { useParkingHub } from "../../components/parking/useParkingHub";
import type { SlotStatusChange } from "../../components/parking/parkingRealtime";

function mapRealtimeStatusToSlotStatus(status: string): SlotStatus {
  const normalized = status.trim().toUpperCase();
  if (normalized === "OCCUPIED") return "Occupied";
  if (normalized === "HELD" || normalized === "RESERVED") return "Reserved";
  if (normalized === "MAINTENANCE") return "Maintenance";
  if (normalized === "DISABLED") return "Disabled";
  return "Available";
}

function mapSlotStatusToViewerStatus(status: SlotStatus): string {
  if (status === "Occupied") return "OCCUPIED";
  if (status === "Reserved") return "HELD";
  if (status === "Maintenance") return "MAINTENANCE";
  if (status === "Disabled") return "DISABLED";
  return "AVAILABLE";
}

export default function Admin3DViewPage() {
  const { lotId: routeLotId } = useParams<{ lotId?: string }>();
  const navigate = useNavigate();

  const [facilities, setFacilities] = useState<ParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [levels, setLevels] = useState<Array<{ levelId: string; levelCode: string; levelName: string; totalSlots: number; availableSlots: number }>>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [slots, setSlots] = useState<ParkingSlotDetail[]>([]);
  const [lotLayout, setLotLayout] = useState<LotLayout3DDto | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlotDetail | null>(null);

  const layoutCacheRef = useRef<Record<string, LotLayout3DDto>>({});

  // 1. Load facility list
  useEffect(() => {
    let mounted = true;
    async function loadLots() {
      try {
        const facs = await api.getParkingLots();
        if (!mounted) return;
        setFacilities(facs || []);
        if (routeLotId && facs.some((f) => f.id === routeLotId)) {
          setSelectedLotId(routeLotId);
        } else if (facs.length > 0) {
          setSelectedLotId(facs[0].id);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Không tải được danh mục bãi xe.");
      }
    }
    loadLots();
    return () => { mounted = false; };
  }, [routeLotId]);

  // 2. Load 3D layout & slots for selected bãi
  const loadLotData = useCallback(async () => {
    if (!selectedLotId) return;
    setLoading(true);
    setError("");
    try {
      const cached = layoutCacheRef.current[selectedLotId];
      const [levelData, layout] = await Promise.all([
        staffApi.getParkingLotLevels(selectedLotId),
        cached ? Promise.resolve(cached) : api.getLotLayout3D(selectedLotId).catch(() => null),
      ]);
      if (layout) {
        layoutCacheRef.current[selectedLotId] = layout;
        setLotLayout(layout);
      } else {
        setLotLayout(null);
      }
      setLevels(levelData.levels);
      setSlots(levelData.slots);
      if (levelData.levels.length > 0 && selectedLevelId !== "ALL" && !levelData.levels.some((l) => l.levelId === selectedLevelId)) {
        setSelectedLevelId(levelData.levels.length > 1 ? "ALL" : levelData.levels[0].levelId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sơ đồ 3D của bãi đỗ.");
    } finally {
      setLoading(false);
    }
  }, [selectedLotId, selectedLevelId]);

  useEffect(() => {
    loadLotData();
  }, [loadLotData]);

  // Realtime SignalR hook
  const handleRealtimeChanges = useCallback((changes: SlotStatusChange[]) => {
    if (!changes.length) return;
    setSlots((prev) =>
      prev.map((slot) => {
        const hit = changes.find(
          (c) => c.slotId === slot.slotId && (!c.parkingLotId || c.parkingLotId === selectedLotId)
        );
        if (!hit) return slot;
        return { ...slot, status: mapRealtimeStatusToSlotStatus(hit.status) };
      })
    );
  }, [selectedLotId]);

  const hubStatus = useParkingHub(Boolean(selectedLotId), selectedLotId || null, handleRealtimeChanges);

  // Selected level code
  const selectedLevelCode = useMemo(() => {
    if (!selectedLevelId || selectedLevelId === "ALL") return "ALL";
    const fromLayout = lotLayout?.levels.find((l) => l.id === selectedLevelId)?.code;
    if (fromLayout) return fromLayout;
    return levels.find((l) => l.levelId === selectedLevelId)?.levelCode || "";
  }, [lotLayout, levels, selectedLevelId]);

  const motoSceneStats = useMemo(() => {
    const motoSlots = slots.filter((s) => s.vehicleType === "Motorcycle");
    const maxCapacity = motoSlots.length;
    if (maxCapacity === 0) return null;
    const availableMoto = motoSlots.filter((s) => s.status === "Available").length;
    return {
      availableMoto,
      maxCapacity,
      currentMoto: Math.max(0, maxCapacity - availableMoto),
      lang: "vi" as const,
    };
  }, [slots]);

  // Map to ModelLevel for 3D Viewer
  const viewerLevels = useMemo<ModelLevel[]>(() => {
    const slotById = new Map(slots.map((s) => [s.slotId, s] as const));
    if (lotLayout && lotLayout.lotId === selectedLotId && lotLayout.levels.length > 0) {
      const mapped = lotLayout.levels
        .slice()
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((lvl) => {
          const lvlSlots = (lvl.zones ?? []).flatMap((z) =>
            (z.slots ?? []).map((spatial) => {
              const live = slotById.get(spatial.id);
              return {
                slotId: spatial.id,
                slotCode: spatial.code || live?.slotCode || spatial.id,
                floorCode: lvl.code || lvl.name,
                zoneCode: z.code || live?.zoneName || "",
                supportedVehicleTypes: live ? [live.vehicleType] : ["Car"],
                features: live?.features ?? [],
                status: live ? mapSlotStatusToViewerStatus(live.status) : (spatial.operationalStatus === "ACTIVE" ? "AVAILABLE" : spatial.operationalStatus),
                position: spatial.position ?? null,
                rotationY: spatial.rotationY ?? null,
                widthM: spatial.widthM ?? null,
                lengthM: spatial.lengthM ?? null,
                size: spatial.size ?? null,
              };
            })
          );
          return {
            levelId: lvl.id,
            levelCode: lvl.code,
            levelName: lvl.name,
            elevationM: lvl.elevationM ?? null,
            slots: lvlSlots,
          };
        })
        .filter((l) => l.slots.length > 0);
      if (mapped.length > 0) return mapped;
    }

    return levels.map((lvl) => ({
      levelId: lvl.levelId,
      levelCode: lvl.levelCode,
      levelName: lvl.levelName,
      slots: slots
        .filter((s) => s.levelId === lvl.levelId)
        .map((s) => ({
          slotId: s.slotId,
          slotCode: s.slotCode,
          floorCode: lvl.levelCode,
          zoneCode: s.zoneName || "",
          supportedVehicleTypes: [s.vehicleType],
          features: s.features ?? [],
          status: mapSlotStatusToViewerStatus(s.status),
        })),
    })).filter((l) => l.slots.length > 0);
  }, [lotLayout, selectedLotId, levels, slots]);

  const activeFacility = facilities.find((f) => f.id === selectedLotId);

  // Compute live stats for this facility
  const totalSlotsCount = slots.length;
  const availableCount = slots.filter((s) => s.status === "Available").length;
  const availableEvCount = slots.filter((s) => s.status === "Available" && s.vehicleType === "EV").length;
  const occupiedCount = slots.filter((s) => s.status === "Occupied").length;
  const reservedCount = slots.filter((s) => s.status === "Reserved").length;
  const maintenanceCount = slots.filter((s) => s.status === "Maintenance" || s.operationalStatus === "MAINTENANCE").length;

  return (
    <div>
      {/* ── Control Bar: Facility Selector & Level Tabs ── */}
      <div className="adm-card" style={{ padding: "10px 16px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          {/* Facility Select */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-navy)", display: "flex", alignItems: "center", gap: "5px" }}>
              <Building2 size={15} color="#0284c7" />
              Cơ sở bãi đỗ:
            </span>
            <select
              className="adm-select"
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value);
                navigate(`/admin/map-3d/${e.target.value}`);
              }}
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.code}] {f.name} — {f.address}
                </option>
              ))}
            </select>
          </div>

          {/* Level Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-muted)", marginRight: "2px" }}>
              Tầng:
            </span>
            <div style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
              {levels.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedLevelId("ALL")}
                  className={`adm-level-btn ${selectedLevelId === "ALL" ? "active" : ""}`}
                  title="Xem toàn cảnh 3D toàn bãi"
                >
                  <span>Toàn cảnh</span>
                </button>
              )}
              {levels.map((lvl) => {
                const isSelected = lvl.levelId === selectedLevelId;
                return (
                  <button
                    key={lvl.levelId}
                    type="button"
                    onClick={() => setSelectedLevelId(lvl.levelId)}
                    className={`adm-level-btn ${isSelected ? "active" : ""}`}
                    title={`Chuyển góc nhìn mặt cắt ${lvl.levelName}`}
                  >
                    <span>{lvl.levelName}</span>
                    <span style={{ opacity: 0.85, fontSize: "10.5px", fontWeight: 500 }}>
                      ({lvl.availableSlots}/{lvl.totalSlots})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action: Switch to Slot Management */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => navigate(`/admin/slots/${selectedLotId}`)}
              className="adm-btn-primary"
              style={{ padding: "5px 12px", fontSize: "0.75rem" }}
            >
              <Sliders size={13} />
              <span>Quản lý Slot bãi này</span>
            </button>
            <button onClick={loadLotData} className="adm-btn-secondary" style={{ padding: "5px 8px" }} title="Làm mới sơ đồ 3D">
              <RefreshCw size={12} className={loading ? "adm-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="adm-alert error" role="alert" style={{ marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {/* ── 3D Canvas Container ── */}
      <div className="adm-viewer-container">
        {/* HUD Overlay Stats */}
        <div className="adm-viewer-hud">
          <div className="adm-viewer-badge">
            <Radio size={11} color={hubStatus === "connected" ? "#10b981" : "#f59e0b"} />
            <span>{hubStatus === "connected" ? "SignalR Realtime Connected" : "Connecting Hub..."}</span>
          </div>
          <div className="adm-viewer-badge">
            <Layers size={12} color="#38bdf8" />
            <span>{activeFacility ? activeFacility.name : "3D Digital Twin"}</span>
          </div>
          <div className="adm-viewer-badge">
            <span>Tổng: <strong>{totalSlotsCount}</strong> ô</span>
          </div>
        </div>

        {/* 3D Canvas */}
        <ParkingViewer
          levels={viewerLevels}
          mapObjects={[]}
          lotCode={activeFacility?.code}
          motoStats={motoSceneStats}
          selectedLevelCode={selectedLevelCode}
          selectedId={selectedSlot?.slotId || null}
          onSelect={(modelSlot) => {
            const found = slots.find((s) => s.slotId === modelSlot.slotId);
            if (found) setSelectedSlot(found);
          }}
        />

        {/* Legend */}
        <div className="adm-viewer-legend">
          <div className="adm-legend-item">
            <span className="adm-legend-dot" style={{ background: "#16a34a" }} />
            <span>Trống ({availableCount})</span>
          </div>
          {availableEvCount > 0 && (
            <div className="adm-legend-item">
              <span className="adm-legend-dot" style={{ background: "#0284c7" }} />
              <span>Ô tô điện trống ({availableEvCount})</span>
            </div>
          )}
          <div className="adm-legend-item">
            <span className="adm-legend-dot" style={{ background: "#888e96" }} />
            <span>Có xe ({occupiedCount})</span>
          </div>
          <div className="adm-legend-item">
            <span className="adm-legend-dot" style={{ background: "#f59e0b" }} />
            <span>Đã đặt ({reservedCount})</span>
          </div>
          <div className="adm-legend-item">
            <span className="adm-legend-dot" style={{ background: "#eab308" }} />
            <span>Bảo trì ({maintenanceCount})</span>
          </div>
        </div>
      </div>

      {/* ── Selected Slot Inspector Drawer / Modal ── */}
      {selectedSlot && (
        <div className="adm-modal-backdrop" onClick={() => setSelectedSlot(null)}>
          <div className="adm-modal" style={{ maxWidth: "380px" }} onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header" style={{ padding: "10px 14px" }}>
              <h3 className="adm-modal-title" style={{ fontSize: "0.92rem" }}>Chi Tiết Ô Đỗ: {selectedSlot.slotCode}</h3>
              <button className="adm-modal-close" onClick={() => setSelectedSlot(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="adm-modal-body" style={{ gap: "8px", fontSize: "0.78rem", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--adm-border-subtle)" }}>
                <span style={{ color: "var(--adm-muted)" }}>Mã ô đỗ:</span>
                <strong style={{ color: "var(--adm-navy)" }}>{selectedSlot.slotCode}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--adm-border-subtle)" }}>
                <span style={{ color: "var(--adm-muted)" }}>Tầng & Khu vực:</span>
                <span>{selectedSlot.levelName} — {selectedSlot.zoneName || "Khu chuẩn"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--adm-border-subtle)" }}>
                <span style={{ color: "var(--adm-muted)" }}>Loại xe:</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {selectedSlot.vehicleType === "EV" ? (
                    <>
                      <Zap size={13} color="#0284c7" />
                      Ô tô điện (EV)
                    </>
                  ) : selectedSlot.vehicleType === "Car" ? (
                    <>
                      <Car size={13} color="#0891b2" />
                      Ô tô thường
                    </>
                  ) : (
                    <>
                      <Bike size={13} color="#d97706" />
                      Xe máy
                    </>
                  )}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--adm-border-subtle)" }}>
                <span style={{ color: "var(--adm-muted)" }}>Trạng thái:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      selectedSlot.status === "Available"
                        ? "#15803d"
                        : selectedSlot.status === "Occupied"
                        ? "#b91c1c"
                        : selectedSlot.status === "Reserved"
                        ? "#b45309"
                        : "#64748b",
                  }}
                >
                  ● {selectedSlot.status} ({selectedSlot.operationalStatus || "ACTIVE"})
                </span>
              </div>
            </div>
            <div className="adm-modal-footer" style={{ padding: "10px 14px" }}>
              <button
                type="button"
                className="adm-btn-secondary"
                onClick={() => setSelectedSlot(null)}
                style={{ padding: "5px 10px", fontSize: "0.75rem" }}
              >
                Đóng
              </button>
              <button
                type="button"
                className="adm-btn-primary"
                onClick={() => {
                  navigate(`/admin/slots/${selectedLotId}`);
                }}
                style={{ padding: "5px 12px", fontSize: "0.75rem" }}
              >
                <Sliders size={12} />
                <span>Mở can thiệp Slot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
