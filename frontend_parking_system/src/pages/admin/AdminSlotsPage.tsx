import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  Filter,
  RefreshCw,
  Car,
  Bike,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Check,
  RotateCcw,
  Wrench,
  LogIn,
  LogOut,
} from "lucide-react";
import { api, type ParkingLot } from "../../services/api";
import { managerApi } from "../../services/manager/managerApi";
import type { SlotControlItem, LevelSummary, SlotStatus } from "../../types/manager";
import { useParkingHub } from "../../components/parking/useParkingHub";
import type { SlotStatusChange } from "../../components/parking/parkingRealtime";

function mapRealtimeToSlotStatus(status: string): SlotStatus {
  const norm = status?.trim().toUpperCase();
  if (norm === "OCCUPIED") return "Occupied";
  if (norm === "RESERVED" || norm === "HELD") return "Reserved";
  if (norm === "MAINTENANCE") return "Maintenance";
  if (norm === "DISABLED") return "Disabled";
  return "Available";
}

export default function AdminSlotsPage() {
  const { lotId: routeLotId } = useParams<{ lotId?: string }>();
  const navigate = useNavigate();

  const [facilities, setFacilities] = useState<ParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string>("");
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("all");
  const [slots, setSlots] = useState<SlotControlItem[]>([]);

  // Override Modal state
  const [selectedSlot, setSelectedSlot] = useState<SlotControlItem | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<SlotStatus>("Maintenance");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapTargetSlotId, setSwapTargetSlotId] = useState("");

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
    return () => {
      mounted = false;
    };
  }, [routeLotId]);

  // 2. Load slots for selected bãi
  const loadSlotsAndLayout = useCallback(async () => {
    if (!selectedLotId) return;
    setLoading(true);
    setError("");
    try {
      const res = await managerApi.getFacilitySlots(selectedLotId, activeLevelId);
      if (res.isSuccess && res.result) {
        setLevels(res.result.levels || []);
        setSlots(res.result.slots || []);
        if (res.result.levels.length > 0 && !res.result.levels.some((l) => l.levelId === activeLevelId)) {
          setActiveLevelId(res.result.levels[0].levelId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách ô đỗ.");
      setSlots([]);
      setLevels([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLotId, activeLevelId]);

  useEffect(() => {
    loadSlotsAndLayout();
  }, [loadSlotsAndLayout]);

  // Realtime SignalR hook
  const handleRealtimeChanges = useCallback((changes: SlotStatusChange[]) => {
    if (!changes.length) return;
    setSlots((prev) =>
      prev.map((slot) => {
        const hit = changes.find(
          (c) => c.slotId === slot.id && (!c.parkingLotId || c.parkingLotId === selectedLotId)
        );
        if (!hit) return slot;
        return { ...slot, status: mapRealtimeToSlotStatus(hit.status) };
      })
    );
  }, [selectedLotId]);

  const hubStatus = useParkingHub(Boolean(selectedLotId), selectedLotId || null, handleRealtimeChanges);

  const activeLevel = levels.find((l) => l.levelId === activeLevelId) || levels[0];

  // Distinct zones
  const zones = Array.from(new Set(slots.map((s) => s.zoneName || "Khu chuẩn")));

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (activeZoneFilter !== "all" && (slot.zoneName || "Khu chuẩn") !== activeZoneFilter) return false;
      if (activeStatusFilter !== "all") {
        if (activeStatusFilter === "Available" && slot.status !== "Available") return false;
        if (activeStatusFilter === "Occupied" && slot.status !== "Occupied") return false;
        if (activeStatusFilter === "Maintenance" && slot.status !== "Maintenance") return false;
        if (activeStatusFilter === "Reserved" && slot.status !== "Reserved") return false;
      }
      return true;
    });
  }, [slots, activeZoneFilter, activeStatusFilter]);

  // Phân nhóm động theo Zone và loại phương tiện (Hiển thị đầy đủ 100% ô đỗ)
  interface ZoneGroup {
    zoneKey: string;
    zoneName: string;
    vehicleType: "Car" | "Motorcycle";
    slots: SlotControlItem[];
    totalSlots: number;
    availableSlots: number;
  }

  const { carGroups, bikeGroups } = useMemo(() => {
    const map = new Map<string, SlotControlItem[]>();

    for (const s of slots) {
      const vType = (s.vehicleType || "").toLowerCase();
      const code = (s.slotCode || "").toUpperCase();
      const isBike =
        vType === "motorcycle" ||
        vType === "bike" ||
        code.startsWith("M") ||
        code.includes("-M") ||
        (s.zoneName || "").toLowerCase().includes("xe máy") ||
        (s.zoneName || "").toLowerCase().includes("moto");

      const defaultZone = isBike ? "Khu xe máy" : "Khu A";
      const zName = s.zoneName?.trim() || defaultZone;
      if (!map.has(zName)) {
        map.set(zName, []);
      }
      map.get(zName)!.push(s);
    }

    const cars: ZoneGroup[] = [];
    const bikes: ZoneGroup[] = [];

    for (const [zName, groupSlots] of map.entries()) {
      groupSlots.sort((a, b) => a.slotCode.localeCompare(b.slotCode, undefined, { numeric: true }));
      const first = groupSlots[0];
      const vType = (first?.vehicleType || "").toLowerCase();
      const code = (first?.slotCode || "").toUpperCase();
      const isBike =
        vType === "motorcycle" ||
        vType === "bike" ||
        code.startsWith("M") ||
        code.includes("-M") ||
        zName.toLowerCase().includes("xe máy") ||
        zName.toLowerCase().includes("moto");

      const groupItem: ZoneGroup = {
        zoneKey: zName,
        zoneName: zName,
        vehicleType: isBike ? "Motorcycle" : "Car",
        slots: groupSlots,
        totalSlots: groupSlots.length,
        availableSlots: groupSlots.filter((s) => s.status === "Available").length,
      };

      if (isBike) {
        bikes.push(groupItem);
      } else {
        cars.push(groupItem);
      }
    }

    cars.sort((a, b) => a.zoneName.localeCompare(b.zoneName, undefined, { numeric: true }));
    bikes.sort((a, b) => a.zoneName.localeCompare(b.zoneName, undefined, { numeric: true }));

    return { carGroups: cars, bikeGroups: bikes };
  }, [slots]);

  const carCount = useMemo(() => carGroups.reduce((acc, g) => acc + g.totalSlots, 0), [carGroups]);
  const bikeCount = useMemo(() => bikeGroups.reduce((acc, g) => acc + g.totalSlots, 0), [bikeGroups]);

  // Phân biệt Bãi Ngoài Trời (Courtyard 3D e.g. DEMO-BT) và Bãi Nhiều Tầng (Building 3D e.g. DEMO-Q1, DEMO-Q7)
  const isOutdoorLot = useMemo(() => {
    const lotUpper = (selectedLotId || "").toUpperCase();
    if (lotUpper.includes("BT")) return true;
    if (activeLevel) {
      const code = (activeLevel.levelCode || "").toUpperCase();
      const name = (activeLevel.levelName || "").toLowerCase();
      if (code === "G" || code === "OUTDOOR" || name.includes("ngoài trời") || name.includes("outdoor")) {
        return true;
      }
    }
    if (levels.length === 1 && slots.length <= 45) return true;
    return false;
  }, [selectedLotId, activeLevel, levels, slots]);

  const isFloor1Moto = useMemo(() => {
    if (!activeLevel) return false;
    const code = (activeLevel.levelCode || "").toUpperCase();
    const name = (activeLevel.levelName || "").toLowerCase();
    return code === "F1" || code === "L1" || name.includes("xe máy") || (bikeCount > 0 && carCount === 0);
  }, [activeLevel, bikeCount, carCount]);

  const f1BikeSlots = useMemo(() => {
    const allBikes = bikeGroups.flatMap((g) => g.slots);
    return allBikes.slice().sort((a, b) => a.slotCode.localeCompare(b.slotCode, undefined, { numeric: true }));
  }, [bikeGroups]);

  const f1Row1 = useMemo(() => {
    if (f1BikeSlots.length >= 10) return f1BikeSlots.slice(0, 10);
    return f1BikeSlots;
  }, [f1BikeSlots]);

  const f1Row2 = useMemo(() => {
    if (f1BikeSlots.length >= 20) return f1BikeSlots.slice(10, 20);
    return f1BikeSlots.slice(10);
  }, [f1BikeSlots]);

  const f1AvailableCount = useMemo(() => f1BikeSlots.filter((s) => s.status === "Available").length, [f1BikeSlots]);
  const f1OccupiedCount = useMemo(() => f1BikeSlots.filter((s) => s.status === "Occupied").length, [f1BikeSlots]);

  const formatZoneTitle = useCallback((name: string) => {
    const trimmed = name.trim();
    if (/^hàng\s+/i.test(trimmed)) return trimmed.toUpperCase();
    if (/^khu\s+/i.test(trimmed)) return trimmed.toUpperCase();
    return `HÀNG ${trimmed.toUpperCase()}`;
  }, []);

  const slotByCode = useMemo(() => {
    const map = new Map<string, SlotControlItem>();
    slots.forEach((s) => {
      const code = (s.slotCode || "").toUpperCase();
      if (code) map.set(code, s);
      const parts = code.split("-");
      if (parts.length > 1) {
        map.set(parts[parts.length - 1].toUpperCase(), s);
      }
    });
    return map;
  }, [slots]);

  const filteredSlotIds = useMemo(() => {
    return new Set(filteredSlots.map((s) => s.id));
  }, [filteredSlots]);

  const khuAAvailable = useMemo(() => {
    return ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"].filter(
      (code) => slotByCode.get(code)?.status === "Available"
    ).length;
  }, [slotByCode]);

  const khuBAvailable = useMemo(() => {
    return ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10"].filter(
      (code) => slotByCode.get(code)?.status === "Available"
    ).length;
  }, [slotByCode]);

  const bikeAvailableCount = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= 20; i++) {
      const code = `M${String(i).padStart(2, "0")}`;
      if (slotByCode.get(code)?.status === "Available") count++;
    }
    return count;
  }, [slotByCode]);

  const bikeOccupiedCount = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= 20; i++) {
      const code = `M${String(i).padStart(2, "0")}`;
      if (slotByCode.get(code)?.status === "Occupied") count++;
    }
    return count;
  }, [slotByCode]);

  const handleSelectSlot = (slot: SlotControlItem) => {
    setSelectedSlot(slot);
    setIsActionOpen(false);
    setOverrideStatus(slot.status === "Maintenance" ? "Available" : "Maintenance");
    setOverrideReason("");
    setActionMessage(null);
  };

  const handleQuickRelease = async (slot: SlotControlItem) => {
    setIsSubmitting(true);
    try {
      const res = await managerApi.updateSlotStatus(slot, "Available", "Giải phóng ô đỗ thủ công bởi Admin");
      if (res.isSuccess) {
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, status: "Available" } : s)));
        setSelectedSlot((prev) => (prev && prev.id === slot.id ? { ...prev, status: "Available" } : prev));
        setActionMessage({ type: "success", text: `Đã giải phóng ô ${slot.slotCode} về trạng thái Trống!` });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Thao tác thất bại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!selectedSlot || !swapTargetSlotId) return;
    const targetSlot = slots.find((s) => s.id === swapTargetSlotId);
    if (!targetSlot) return;

    setIsSubmitting(true);
    try {
      // 1. Mark target occupied/reserved
      await managerApi.updateSlotStatus(targetSlot, selectedSlot.status, `Chuyển vị trí từ ô ${selectedSlot.slotCode}`);
      // 2. Mark old slot available
      await managerApi.updateSlotStatus(selectedSlot, "Available", `Đã chuyển xe sang ô ${targetSlot.slotCode}`);

      setSlots((prev) =>
        prev.map((s) => {
          if (s.id === targetSlot.id) return { ...s, status: selectedSlot.status };
          if (s.id === selectedSlot.id) return { ...s, status: "Available" };
          return s;
        })
      );
      setSelectedSlot(targetSlot);
      setSwapModalOpen(false);
      setActionMessage({ type: "success", text: `Đã đổi xe từ ô ${selectedSlot.slotCode} sang ${targetSlot.slotCode} thành công!` });
    } catch (err) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Đổi ô thất bại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!overrideReason.trim()) {
      setActionMessage({ type: "error", text: "Vui lòng nhập lý do can thiệp để phục vụ kiểm toán hệ thống!" });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const res = await managerApi.updateSlotStatus(selectedSlot, overrideStatus, overrideReason.trim());
      if (res.isSuccess) {
        setSlots((prev) => prev.map((s) => (s.id === selectedSlot.id ? res.result : s)));
        setActionMessage({ type: "success", text: `Đã cập nhật trạng thái ô ${selectedSlot.slotCode} thành công!` });
        setTimeout(() => {
          setSelectedSlot(null);
          loadSlotsAndLayout();
        }, 1000);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Cập nhật thất bại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSlotCapsule = (
    slot: SlotControlItem | undefined,
    fallbackCode: string,
    type: "car" | "bike"
  ) => {
    if (!slot) {
      return (
        <div key={fallbackCode} className="adm-dt-capsule status-available is-placeholder">
          <span className="adm-dt-capsule-code">{fallbackCode}</span>
          <div className="adm-dt-capsule-icon-area">
            <span className="adm-dt-capsule-label">KHẢ DỤNG</span>
          </div>
        </div>
      );
    }

    const isSelected = selectedSlot?.id === slot.id;
    const isAvailable = slot.status === "Available";
    const isOccupied = slot.status === "Occupied";
    const isReserved = slot.status === "Reserved";
    const isMaintenance = slot.status === "Maintenance" || slot.status === "Disabled";
    const statusKey = slot.status.toLowerCase();
    const isFilteredOut = !filteredSlotIds.has(slot.id);

    return (
      <div
        key={slot.id}
        className={`adm-dt-capsule status-${statusKey} ${isSelected ? "is-selected" : ""} ${
          isFilteredOut ? "is-filtered-out" : ""
        }`}
        style={type === "bike" ? { height: "105px" } : undefined}
        onClick={() => {
          if (!isFilteredOut) handleSelectSlot(slot);
        }}
        title={`Ô ${slot.slotCode} (${slot.status}) — Bấm để điều khiển`}
      >
        <span className="adm-dt-capsule-code">{slot.slotCode}</span>
        <div className="adm-dt-capsule-icon-area">
          {isAvailable && (
            <>
              <div
                className="adm-dt-capsule-target-circle"
                style={type === "bike" ? { width: 22, height: 22 } : undefined}
              >
                <Check size={type === "bike" ? 11 : 13} />
              </div>
              <span className="adm-dt-capsule-label" style={type === "bike" ? { fontSize: "7.5px" } : undefined}>
                TRỐNG
              </span>
            </>
          )}
          {isOccupied && (
            <>
              {type === "car" ? (
                <svg viewBox="0 0 32 50" width="22" height="35" fill="none">
                  <rect x="2" y="4" width="28" height="42" rx="7" fill="#b91c1c" stroke="#ef4444" strokeWidth="1.5" />
                  <path d="M6 16 L9 10 L23 10 L26 16 Z" fill="#e0f2fe" fillOpacity="0.95" />
                  <rect x="7" y="18" width="18" height="15" rx="2" fill="#7f1d1d" />
                  <path d="M6 37 L9 41 L23 41 L26 37 Z" fill="#e0f2fe" fillOpacity="0.85" />
                  <ellipse cx="7" cy="8" rx="2" ry="1.5" fill="#fef08a" />
                  <ellipse cx="25" cy="8" rx="2" ry="1.5" fill="#fef08a" />
                </svg>
              ) : (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#b91c1c",
                  }}
                >
                  <Bike size={12} />
                </div>
              )}
              <span
                className="adm-dt-capsule-label"
                style={{ color: "#b91c1c", fontSize: type === "bike" ? "7px" : "8px" }}
              >
                CÓ XE
              </span>
            </>
          )}
          {isReserved && (
            <>
              <div
                style={{
                  width: type === "bike" ? 20 : 24,
                  height: type === "bike" ? 20 : 24,
                  borderRadius: "50%",
                  background: "#fef3c7",
                  border: "1.5px solid #f59e0b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#b45309",
                }}
              >
                <span style={{ fontSize: type === "bike" ? "9px" : "11px", fontWeight: 800 }}>⏳</span>
              </div>
              <span
                className="adm-dt-capsule-label"
                style={{ color: "#b45309", fontSize: type === "bike" ? "7px" : "8px" }}
              >
                ĐÃ GIỮ
              </span>
            </>
          )}
          {isMaintenance && (
            <>
              <div
                style={{
                  width: type === "bike" ? 20 : 24,
                  height: type === "bike" ? 20 : 24,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                }}
              >
                <Wrench size={type === "bike" ? 10 : 12} />
              </div>
              <span
                className="adm-dt-capsule-label"
                style={{ color: "#64748b", fontSize: type === "bike" ? "7px" : "8px" }}
              >
                BẢO TRÌ
              </span>
            </>
          )}
        </div>
        <span
          className="adm-dt-capsule-sensor-dot"
          style={{
            background: isOccupied ? "#ef4444" : isAvailable ? "#10b981" : isReserved ? "#f59e0b" : "#94a3b8",
            boxShadow:
              isOccupied
                ? "0 0 6px rgba(239, 68, 68, 0.4)"
                : isAvailable
                ? "0 0 6px rgba(16, 185, 129, 0.4)"
                : "none",
          }}
        />
      </div>
    );
  };

  return (
    <div>
      {/* ── Control Bar: Facility Selector, Level Tabs & View Mode Switcher ── */}
      <div className="adm-card adm-slots-control-card">
        <div className="adm-slots-control-inner">
          {/* Facility Select */}
          <div className="adm-slots-facility-group">
            <span className="adm-slots-field-label">
              <Building2 size={15} color="#0284c7" />
              <span>Cơ sở bãi đỗ:</span>
            </span>
            <select
              className="adm-select adm-slots-facility-select"
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value);
                navigate(`/admin/slots/${e.target.value}`);
              }}
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.code}] {f.name} — {f.address}
                </option>
              ))}
            </select>
          </div>

          {/* Level Switcher (Tinh chỉnh viền gọn gàng) */}
          <div className="adm-slots-level-group">
            <span className="adm-slots-field-label">
              Tầng:
            </span>
            <div className="adm-slots-level-pills">
              {levels.map((lvl) => {
                const isSelected = lvl.levelId === activeLevelId;
                return (
                  <button
                    key={lvl.levelId}
                    type="button"
                    onClick={() => setActiveLevelId(lvl.levelId)}
                    className={`adm-level-btn ${isSelected ? "active" : ""}`}
                    title={`Chuyển sang ${lvl.levelName}`}
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

          {/* Làm Mới Dữ Liệu */}
          <div className="adm-slots-action-group">
            <button
              onClick={loadSlotsAndLayout}
              className="adm-btn-secondary adm-slots-refresh-btn"
              title="Làm mới dữ liệu ô đỗ"
            >
              <RefreshCw size={13} className={loading ? "adm-spin" : ""} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Level Summary Stats Strip ── */}
      {activeLevel && (
        <div className="adm-slots-stats-strip">
          <div className="adm-slots-stat-card">
            <span className="adm-slots-stat-title" style={{ color: "var(--adm-muted)" }}>TỔNG Ô ĐỖ TẦNG</span>
            <div className="adm-slots-stat-num" style={{ color: "var(--adm-navy)" }}>{activeLevel.totalSlots}</div>
          </div>
          <div className="adm-slots-stat-card">
            <span className="adm-slots-stat-title" style={{ color: "#086548" }}>ĐANG TRỐNG</span>
            <div className="adm-slots-stat-num" style={{ color: "#086548" }}>{activeLevel.availableSlots}</div>
          </div>
          <div className="adm-slots-stat-card">
            <span className="adm-slots-stat-title" style={{ color: "#b42337" }}>ĐANG ĐỖ XE</span>
            <div className="adm-slots-stat-num" style={{ color: "#b42337" }}>{activeLevel.occupiedSlots}</div>
          </div>
          <div className="adm-slots-stat-card">
            <span className="adm-slots-stat-title" style={{ color: "#64748b" }}>BẢO TRÌ</span>
            <div className="adm-slots-stat-num" style={{ color: "#475569" }}>{activeLevel.maintenanceSlots}</div>
          </div>
          <div className="adm-slots-stat-card">
            <span className="adm-slots-stat-title" style={{ color: "#0d4685" }}>TỶ LỆ LẤP ĐẦY</span>
            <div className="adm-slots-stat-num" style={{ color: "#0d4685" }}>{activeLevel.occupancyRate}%</div>
          </div>
        </div>
      )}

      {error && (
        <div className="adm-alert error" role="alert">
          {error}
        </div>
      )}

      {/* ── Filters & Search Bar ── */}
      <div className="adm-card adm-slots-filter-card">
        <div className="adm-slots-filter-inner">
          <div className="adm-slots-filter-controls">
            <Filter size={15} color="var(--adm-muted)" style={{ flexShrink: 0 }} />
            <select
              className="adm-select adm-slots-filter-select"
              value={activeZoneFilter}
              onChange={(e) => setActiveZoneFilter(e.target.value)}
            >
              <option value="all">Tất cả khu vực (Zones)</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>

            <select
              className="adm-select adm-slots-filter-select"
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Available">Trống (Available)</option>
              <option value="Occupied">Có xe (Occupied)</option>
              <option value="Reserved">Đã giữ (Reserved)</option>
              <option value="Maintenance">Bảo trì (Maintenance)</option>
            </select>
          </div>

          <div className="adm-slots-filter-meta">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "0.74rem",
                fontWeight: 700,
                color: hubStatus === "connected" ? "#086548" : "#d97706",
                background: hubStatus === "connected" ? "#e7f7ef" : "#fef3c7",
                padding: "3px 8px",
                borderRadius: "999px",
                whiteSpace: "nowrap",
              }}
              title={hubStatus === "connected" ? "Đồng bộ SignalR thời gian thực" : "Đang kết nối Hub"}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: hubStatus === "connected" ? "#10b981" : "#f59e0b",
                  boxShadow: hubStatus === "connected" ? "0 0 6px #10b981" : "none",
                }}
              />
              {hubStatus === "connected" ? "Realtime Live" : "Đang kết nối..."}
            </span>

            <div style={{ fontSize: "0.8rem", color: "var(--adm-muted)", fontWeight: 600 }}>
              Hiển thị <strong>{filteredSlots.length}</strong> / {slots.length} ô đỗ ({carCount} ô tô, {bikeCount} xe máy)
            </div>
          </div>
        </div>
      </div>

      {/* ── TACTICAL 3D DIGITAL TWIN COMMAND CENTER CANVAS ── */}
      <div className="adm-dt-canvas">
        <div className="adm-dt-grid-overlay" />

        {/* Canvas Toolbar Header */}
        <div className="adm-dt-toolbar">
          <div className="adm-dt-toolbar-title-wrap">
            <span className="adm-dt-toolbar-title">
              <Zap size={15} color="#0284c7" />
              <span>SƠ ĐỒ MẶT BẰNG ĐIỀU HÀNH BÃI ĐỖ (COMMAND CENTER)</span>
            </span>
            <span className="adm-dt-toolbar-sub">• Bấm ô đỗ để mở thanh điều khiển</span>
          </div>
        </div>

        {/* Main Stage (2.5D Phẳng — Ánh Xạ Chuẩn Xác 1:1 Từ Sơ Đồ 3D Toàn Cảnh) */}
        <div className="adm-dt-stage">
          {isOutdoorLot ? (
            /* ══ BÃI ĐỖ NGOÀI TRỜI (COURTYARD DIGITAL TWIN BLUEPRINT e.g. DEMO-BT) ══ */
            <div className="adm-dt-courtyard-envelope">
              {/* PHÂN KHU PHÍA BẮC: KHU VỰC XE MÁY NGOÀI TRỜI (FULL WIDTH) */}
              <div className="adm-dt-north-zone" style={{ width: "100%" }}>
                <div className="adm-dt-moto-sector" style={{ width: "100%" }}>
                  <div className="adm-dt-moto-billboard">
                    <div className="adm-dt-moto-billboard-left">
                      <div>
                        <div className="adm-dt-moto-billboard-title">
                          KHU VỰC ĐỖ XE MÁY (NGOÀI TRỜI) • MOTORBIKE PARKING AREA
                        </div>
                        <div className="adm-dt-moto-billboard-sub">
                          Sức chứa: 20 xe • Đang có trong bãi: {bikeOccupiedCount} xe • Khả dụng: {bikeAvailableCount} / 20 ô
                        </div>
                      </div>
                    </div>
                    <span className="adm-dt-moto-billboard-tag">PHÂN KHU BÃI NGOÀI TRỜI</span>
                  </div>

                  <div className="adm-dt-moto-grid-wrap">
                    <div className="adm-dt-moto-row">
                      {["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10"].map((code) =>
                        renderSlotCapsule(slotByCode.get(code), code, "bike")
                      )}
                    </div>
                    <div className="adm-dt-moto-row" style={{ marginTop: "6px" }}>
                      {["M11", "M12", "M13", "M14", "M15", "M16", "M17", "M18", "M19", "M20"].map((code) =>
                        renderSlotCapsule(slotByCode.get(code), code, "bike")
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SÂN ĐỖ TRUNG TÂM: CÁNH TRÁI (KHU A) | TRỤC ĐƯỜNG DỌC CHÍNH | CÁNH PHẢI (KHU B) */}
              <div className="adm-dt-courtyard-body">
                {/* ── KHU A (Ô TÔ SEDAN & HATCHBACK - 10 Ô) ── */}
                <div className="adm-dt-wing adm-dt-wing-west">
                  <div className="adm-dt-wing-header">
                    <div className="adm-dt-wing-title">
                      <span className="adm-dt-island-tag">KHU A</span>
                      <Car size={15} color="#0284c7" />
                      <span>BÃI ĐỖ Ô TÔ • KHU A (Sedan & Hatchback)</span>
                    </div>
                    <span className="adm-dt-wing-count">
                      10 ô • Khả dụng: <strong>{khuAAvailable}</strong>
                    </span>
                  </div>

                  <div className="adm-dt-wing-columns">
                    {/* Cột ngoài (x = -14 trong 3D): 6 ô A01..A06 xếp dọc */}
                    <div className="adm-dt-wing-col outer">
                      <div className="adm-dt-col-stalls">
                        {["A01", "A02", "A03", "A04", "A05", "A06"].map((code) =>
                          renderSlotCapsule(slotByCode.get(code), code, "car")
                        )}
                      </div>
                    </div>

                    {/* Cột trong (x = -8 trong 3D): 4 ô A07..A10 xếp dọc + LÀN VÀO bên dưới */}
                    <div className="adm-dt-wing-col inner">
                      <div className="adm-dt-col-stalls">
                        {["A07", "A08", "A09", "A10"].map((code) =>
                          renderSlotCapsule(slotByCode.get(code), code, "car")
                        )}
                      </div>

                      {/* Làn Vào (Màu Xanh Lá - Icon To & Chữ To) */}
                      <div className="adm-dt-lane-simple entry" title="Làn xe vào bãi (Check-in)">
                        <div className="adm-dt-lane-icon-circle">
                          <LogIn size={32} />
                        </div>
                        <div className="adm-dt-lane-info">
                          <div className="adm-dt-lane-heading">
                            <span className="adm-dt-lane-simple-arrow">▲</span>
                            <span className="adm-dt-lane-simple-text">LÀN VÀO</span>
                          </div>
                          <span className="adm-dt-lane-caption">CỔNG VÀO (IN)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── TRỤC ĐƯỜNG LƯU THÔNG CHÍNH BẮC - NAM (CENTRAL ROADWAY) ── */}
                <div className="adm-dt-central-spine">
                  <div className="adm-dt-spine-header">
                    <span>▲ PHÍA BẮC (NORTH)</span>
                  </div>

                  <div className="adm-dt-spine-corridor">
                    <div className="adm-dt-spine-left-lane">
                      <span className="adm-dt-lane-indicator">▲ LÀN VÀO</span>
                    </div>

                    {/* Vạch Kẻ Vàng Đứt Đoạn Ở Tim Đường (Yellow Dashed Centerline) */}
                    <div className="adm-dt-spine-centerline">
                      {[...Array(14)].map((_, i) => (
                        <span key={i} className="adm-dt-dashed-stripe" />
                      ))}
                    </div>

                    <div className="adm-dt-spine-right-lane">
                      <span className="adm-dt-lane-indicator">LÀN RA ▼</span>
                    </div>
                  </div>

                  <div className="adm-dt-spine-footer">
                    <span>▼ PHÍA NAM (SOUTH)</span>
                  </div>
                </div>

                {/* ── KHU B (Ô TÔ SUV & BÁN TẢI - 10 Ô) ── */}
                <div className="adm-dt-wing adm-dt-wing-east">
                  <div className="adm-dt-wing-header">
                    <div className="adm-dt-wing-title">
                      <span className="adm-dt-island-tag" style={{ background: "#0d9488" }}>KHU B</span>
                      <Car size={15} color="#0d9488" />
                      <span>BÃI ĐỖ Ô TÔ • KHU B (SUV & Bán Tải)</span>
                    </div>
                    <span className="adm-dt-wing-count">
                      10 ô • Khả dụng: <strong>{khuBAvailable}</strong>
                    </span>
                  </div>

                  <div className="adm-dt-wing-columns">
                    {/* Cột trong (x = +8 trong 3D): 4 ô B07..B10 xếp dọc + LÀN RA bên dưới */}
                    <div className="adm-dt-wing-col inner">
                      <div className="adm-dt-col-stalls">
                        {["B07", "B08", "B09", "B10"].map((code) =>
                          renderSlotCapsule(slotByCode.get(code), code, "car")
                        )}
                      </div>

                      {/* Làn Ra (Màu Đỏ - Icon To & Chữ To) */}
                      <div className="adm-dt-lane-simple exit" title="Làn xe ra bãi (Check-out)">
                        <div className="adm-dt-lane-icon-circle">
                          <LogOut size={32} />
                        </div>
                        <div className="adm-dt-lane-info">
                          <div className="adm-dt-lane-heading">
                            <span className="adm-dt-lane-simple-arrow">▼</span>
                            <span className="adm-dt-lane-simple-text">LÀN RA</span>
                          </div>
                          <span className="adm-dt-lane-caption">CỔNG RA (OUT)</span>
                        </div>
                      </div>
                    </div>

                    {/* Cột ngoài (x = +14 trong 3D): 6 ô B01..B06 xếp dọc */}
                    <div className="adm-dt-wing-col outer">
                      <div className="adm-dt-col-stalls">
                        {["B01", "B02", "B03", "B04", "B05", "B06"].map((code) =>
                          renderSlotCapsule(slotByCode.get(code), code, "car")
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ══ BÃI ĐỖ NHÀ CAO TẦNG (INDOOR BUILDING BLUEPRINT e.g. DEMO-Q1, DEMO-Q7) ══ */
            <div className="adm-dt-indoor-envelope">
              {isFloor1Moto ? (
                /* ── MẶT BẰNG TẦNG 1 (XE MÁY): BỐ TRÍ 2 HÀNG x 10 Ô ĐỒNG BỘ DEMO BÌNH THẠNH ── */
                <div className="adm-dt-north-zone" style={{ width: "100%", margin: 0 }}>
                  <div className="adm-dt-moto-sector" style={{ width: "100%" }}>
                    <div className="adm-dt-moto-billboard">
                      <div className="adm-dt-moto-billboard-left">
                        <div>
                          <div className="adm-dt-moto-billboard-title">
                            KHU VỰC ĐỖ XE MÁY (TẦNG TRỆT) • MOTORBIKE PARKING AREA
                          </div>
                          <div className="adm-dt-moto-billboard-sub">
                            Sức chứa: {f1BikeSlots.length || 20} xe • Đang có trong bãi: {f1OccupiedCount} xe • Khả dụng: {f1AvailableCount} / {f1BikeSlots.length || 20} ô
                          </div>
                        </div>
                      </div>
                      <span className="adm-dt-moto-billboard-tag">PHÂN KHU TẦNG TRỆT (F1)</span>
                    </div>

                    <div className="adm-dt-moto-grid-wrap">
                      <div className="adm-dt-moto-row">
                        {f1Row1.map((slot, i) =>
                          renderSlotCapsule(
                            slot || slotByCode.get(`F1-M${String(i + 1).padStart(2, "0")}`),
                            slot?.slotCode || `F1-M${String(i + 1).padStart(2, "0")}`,
                            "bike"
                          )
                        )}
                      </div>
                      <div className="adm-dt-moto-row" style={{ marginTop: "6px" }}>
                        {f1Row2.map((slot, i) =>
                          renderSlotCapsule(
                            slot || slotByCode.get(`F1-M${String(i + 11).padStart(2, "0")}`),
                            slot?.slotCode || `F1-M${String(i + 11).padStart(2, "0")}`,
                            "bike"
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── MẶT BẰNG TẦNG 2 & TẦNG 3 (100 Ô ĐỖ Ô TÔ: 5 HÀNG A - E x 20 Ô ĐỒNG BỘ PHONG CÁCH DEMO BÌNH THẠNH) ── */
                <div className="adm-dt-indoor-rows-container">
                  {carGroups
                    .filter((z) => activeZoneFilter === "all" || z.zoneName === activeZoneFilter)
                    .map((zone, idx) => {
                      const zoneLetter =
                        zone.zoneName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().replace(/^HÀNG/, "") ||
                        String.fromCharCode(65 + idx);
                      return (
                        <div key={zone.zoneKey}>
                          <div className="adm-dt-indoor-row-box">
                            <div className="adm-dt-wing-header">
                              <div className="adm-dt-wing-title">
                                <span className="adm-dt-island-tag">HÀNG {zoneLetter}</span>
                                <Car size={15} color="#0284c7" />
                                <span>BÃI ĐỖ Ô TÔ • {formatZoneTitle(zone.zoneName)} (Tiêu chuẩn 2.5m x 5.0m)</span>
                              </div>
                              <span className="adm-dt-wing-count">
                                {zone.totalSlots} ô • Khả dụng: <strong>{zone.availableSlots}</strong>
                              </span>
                            </div>
                            <div className="adm-dt-indoor-row-stalls">
                              {zone.slots.map((slot) => renderSlotCapsule(slot, slot.slotCode, "car"))}
                            </div>
                          </div>

                          {/* Làn Đường Lưu Thông Giữa Các Hàng (Chuẩn Làn Đường Demo Bình Thạnh) */}
                          {idx < carGroups.length - 1 && (
                            <div className="adm-dt-roadway" style={{ margin: "12px 0" }}>
                              <div className="adm-dt-roadway-line" />
                              <div className="adm-dt-roadway-text">
                                <span>➔ ➔</span>
                                <span>LÀN LƯU THÔNG NỘI BỘ AISLE-{idx + 1} • GIỚI HẠN TỐC ĐỘ 15 KM/H</span>
                                <span>➔ ➔</span>
                              </div>
                              <div className="adm-dt-crosswalk" title="Vạch người đi bộ qua đường">
                                <span className="adm-dt-crosswalk-stripe" />
                                <span className="adm-dt-crosswalk-stripe" />
                                <span className="adm-dt-crosswalk-stripe" />
                                <span className="adm-dt-crosswalk-stripe" />
                                <span className="adm-dt-crosswalk-stripe" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thông báo nếu không có ô nào phù hợp bộ lọc */}
        {filteredSlots.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8", fontSize: "0.9rem" }}>
            Không có ô đỗ nào phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>

      {/* ── Modal Đổi Ô (Slot Swap Modal) ── */}
      {swapModalOpen && selectedSlot && (
        <div className="adm-modal-backdrop" onClick={() => !isSubmitting && setSwapModalOpen(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">
                Đổi Ô Đỗ Cho Phương Tiện Tại Ô: {selectedSlot.slotCode}
              </h3>
              <button className="adm-modal-close" onClick={() => setSwapModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="adm-modal-body">
              <p style={{ fontSize: "12px", color: "var(--adm-muted)", margin: "0 0 12px" }}>
                Chọn ô đỗ khả dụng cùng phân khu để điều chuyển phương tiện:
              </p>
              <select
                className="adm-select"
                style={{ width: "100%", padding: "10px" }}
                value={swapTargetSlotId}
                onChange={(e) => setSwapTargetSlotId(e.target.value)}
              >
                <option value="">-- Chọn ô trống cần chuyển đến --</option>
                {slots
                  .filter((s) => s.status === "Available" && s.id !== selectedSlot.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      Ô {s.slotCode} ({s.zoneName || "Khu chuẩn"} — {s.vehicleType === "Car" ? "Ô tô" : "Xe máy"})
                    </option>
                  ))}
              </select>
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn-secondary" onClick={() => setSwapModalOpen(false)}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="adm-btn-primary"
                disabled={!swapTargetSlotId || isSubmitting}
                onClick={handleExecuteSwap}
              >
                Xác nhận đổi ô
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Chi Tiết Ô Đỗ & Thao Tác Quản Trị (Hiển thị chi tiết trước, thao tác khi bấm nút) ── */}
      {selectedSlot && (
        <div className="adm-modal-backdrop" onClick={() => !isSubmitting && setSelectedSlot(null)}>
          <div className="adm-modal adm-slot-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h3 className="adm-modal-title">
                  {isActionOpen ? `Can Thiệp Quản Trị: ${selectedSlot.slotCode}` : `Chi Tiết Ô Đỗ: ${selectedSlot.slotCode}`}
                </h3>
                <span className={`adm-3d-status-pill status-${selectedSlot.status.toLowerCase()}`}>
                  {selectedSlot.status === "Available"
                    ? "Trống"
                    : selectedSlot.status === "Occupied"
                    ? "Có xe"
                    : selectedSlot.status === "Reserved"
                    ? "Đã giữ"
                    : "Bảo trì"}
                </span>
              </div>
              <button
                className="adm-modal-close"
                onClick={() => !isSubmitting && setSelectedSlot(null)}
                title="Đóng cửa sổ"
              >
                <X size={16} />
              </button>
            </div>

            {!isActionOpen ? (
              /* ── CHẾ ĐỘ 1: XEM CHI TIẾT THÔNG TIN Ô ĐỖ ── */
              <div className="adm-modal-body">
                {actionMessage && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: actionMessage.type === "success" ? "#dcfce7" : "#fee2e2",
                      color: actionMessage.type === "success" ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {actionMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{actionMessage.text}</span>
                  </div>
                )}

                {/* Block 1: Cấu hình vị trí & IoT */}
                <div className="adm-slot-detail-grid">
                  <div className="adm-slot-detail-item">
                    <span className="adm-slot-detail-label">Mã ô đỗ</span>
                    <span className="adm-slot-detail-value code">{selectedSlot.slotCode}</span>
                  </div>
                  <div className="adm-slot-detail-item">
                    <span className="adm-slot-detail-label">Phân khu / Tầng</span>
                    <span className="adm-slot-detail-value">
                      {selectedSlot.levelName || "Tầng trệt"} • {selectedSlot.zoneName || "Khu chuẩn"}
                    </span>
                  </div>
                  <div className="adm-slot-detail-item" style={{ gridColumn: "span 2" }}>
                    <span className="adm-slot-detail-label">Loại phương tiện</span>
                    <span className="adm-slot-detail-value">
                      {selectedSlot.vehicleType === "Car" ? "🚗 Ô tô" : "🏍️ Xe máy & Xe điện"}
                    </span>
                  </div>
                </div>

                {/* Block 2: Thông tin sử dụng / Khách hàng theo trạng thái thực tế */}
                <div className={`adm-slot-detail-card-section ${selectedSlot.status.toLowerCase()}`}>
                  <div className="adm-slot-detail-card-title">
                    {selectedSlot.status === "Occupied"
                      ? "Thông tin phương tiện đang đỗ"
                      : selectedSlot.status === "Reserved"
                      ? "Thông tin khách đặt giữ chỗ"
                      : selectedSlot.status === "Maintenance"
                      ? "Tình trạng bảo trì kỹ thuật"
                      : "Tình trạng sẵn sàng"}
                  </div>

                  {selectedSlot.status === "Occupied" && (
                    <div className="adm-slot-detail-rows">
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Chủ xe / Hội viên:</span>
                        <strong>Nguyễn Thành Nam (Gold Star)</strong>
                      </div>
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Biển số xe:</span>
                        <strong style={{ fontFamily: "monospace", color: "#b91c1c", fontSize: "13px" }}>51A-987.65</strong>
                      </div>
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Thời gian gửi:</span>
                        <span>08:30 hôm nay (Đang gửi tại bãi)</span>
                      </div>
                    </div>
                  )}

                  {selectedSlot.status === "Reserved" && (
                    <div className="adm-slot-detail-rows">
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Khách đặt trước:</span>
                        <strong>Trần Thị Mai (Hội viên Thân thiết)</strong>
                      </div>
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Mã vé đặt trước:</span>
                        <strong style={{ fontFamily: "monospace" }}>PM-2025-0518-{selectedSlot.slotCode}</strong>
                      </div>
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Khung giờ giữ chỗ:</span>
                        <span style={{ color: "#b45309", fontWeight: 700 }}>14:00 - 17:00 (Đến sau 14 phút)</span>
                      </div>
                    </div>
                  )}

                  {selectedSlot.status === "Maintenance" && (
                    <div className="adm-slot-detail-rows">
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Nguyên nhân bảo trì:</span>
                        <span style={{ color: "#475569", fontWeight: 600 }}>Khóa kiểm tra kỹ thuật & mặt sàn ô đỗ</span>
                      </div>
                      <div className="adm-slot-detail-row">
                        <span style={{ color: "#64748b" }}>Bộ phận phụ trách:</span>
                        <span>Đội Kỹ thuật & Hạ tầng bãi xe</span>
                      </div>
                    </div>
                  )}

                  {selectedSlot.status === "Available" && (
                    <div style={{ color: "#065f46", fontSize: "12.5px", fontWeight: 600, padding: "2px 0" }}>
                      ✓ Ô đỗ đang trống, sẵn sàng đón phương tiện vào bãi.
                    </div>
                  )}
                </div>

                {/* Block 3: Các nút thao tác nghiệp vụ */}
                <div className="adm-slot-actions-panel">
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--adm-muted)", marginBottom: "8px" }}>
                    THAO TÁC QUẢN TRỊ VIÊN:
                  </div>

                  <div className="adm-slot-actions-grid">
                    {/* Nút 1: Mở form can thiệp trạng thái */}
                    <button
                      type="button"
                      className="adm-btn-secondary adm-slot-action-btn"
                      onClick={() => setIsActionOpen(true)}
                    >
                      <Wrench size={14} color="#0284c7" />
                      <span>Can thiệp trạng thái / Bảo trì</span>
                    </button>

                    {/* Nút 2: Đổi ô đỗ nếu có xe hoặc đặt trước */}
                    {(selectedSlot.status === "Occupied" || selectedSlot.status === "Reserved") && (
                      <button
                        type="button"
                        className="adm-btn-secondary adm-slot-action-btn"
                        onClick={() => setSwapModalOpen(true)}
                      >
                        <RotateCcw size={14} color="#0d9488" />
                        <span>Đổi vị trí ô đỗ</span>
                      </button>
                    )}

                    {/* Nút 3: Check-out hoặc Hủy giữ chỗ nếu có xe/đặt chỗ */}
                    {selectedSlot.status === "Occupied" ? (
                      <button
                        type="button"
                        className="adm-btn-primary adm-slot-action-btn"
                        style={{ background: "#065f46" }}
                        disabled={isSubmitting}
                        onClick={() => handleQuickRelease(selectedSlot)}
                      >
                        <CheckCircle2 size={14} />
                        <span>Xác nhận xe rời bãi (Check-out)</span>
                      </button>
                    ) : selectedSlot.status === "Reserved" ? (
                      <button
                        type="button"
                        className="adm-btn-secondary adm-slot-action-btn"
                        style={{ color: "#b91c1c", borderColor: "#fca5a5" }}
                        disabled={isSubmitting}
                        onClick={() => handleQuickRelease(selectedSlot)}
                      >
                        <X size={14} />
                        <span>Hủy giữ chỗ ô này</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              /* ── CHẾ ĐỘ 2: FORM CAN THIỆP QUẢN TRỊ TRẠNG THÁI (KHI NGƯỜI DÙNG BẤM THAO TÁC) ── */
              <form onSubmit={handleSaveOverride}>
                <div className="adm-modal-body">
                  <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#0369a1" }}>
                    ℹ️ Đang thực hiện can thiệp trạng thái cho ô <strong>{selectedSlot.slotCode}</strong>. Mọi can thiệp bắt buộc phải ghi rõ lý do để phục vụ lưu vết hệ thống kiểm toán (Audit Log).
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                      Chuyển sang trạng thái vận hành mới:
                    </label>
                    <select
                      className="adm-select"
                      style={{ width: "100%", marginTop: "4px" }}
                      value={overrideStatus}
                      onChange={(e) => setOverrideStatus(e.target.value as SlotStatus)}
                      disabled={isSubmitting}
                    >
                      <option value="Available">Sẵn sàng đón xe (Available / ACTIVE)</option>
                      <option value="Maintenance">Khóa bảo trì kỹ thuật / hạ tầng (Maintenance)</option>
                      <option value="Disabled">Vô hiệu hóa tạm thời (Disabled)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                      Lý do can thiệp (Bắt buộc phục vụ lưu vết kiểm toán Audit):
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Nhập chi tiết nguyên nhân can thiệp kỹ thuật..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      disabled={isSubmitting}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--adm-line)",
                        marginTop: "4px",
                        fontSize: "0.82rem",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {actionMessage && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: actionMessage.type === "success" ? "#dcfce7" : "#fee2e2",
                        color: actionMessage.type === "success" ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {actionMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      <span>{actionMessage.text}</span>
                    </div>
                  )}
                </div>

                <div className="adm-modal-footer">
                  <button
                    type="button"
                    className="adm-btn-secondary"
                    disabled={isSubmitting}
                    onClick={() => setIsActionOpen(false)}
                  >
                    Quay lại xem chi tiết
                  </button>
                  <button
                    type="submit"
                    className="adm-btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            )}

            {!isActionOpen && (
              <div className="adm-modal-footer">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setSelectedSlot(null)}
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
