import { StaffDialog } from "../../components/staff/StaffUi";
import ReservationRelocation from "../../components/parking/ReservationRelocation";
import ParkingViewer, { type ModelLevel } from "../../components/parking/ParkingViewer";
import { useParkingHub } from "../../components/parking/useParkingHub";
import type { SlotStatusChange } from "../../components/parking/parkingRealtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Grid3X3,
  Layers,
  Filter,
  Car,
  Bike,
  Zap,
  Wrench,
  X,
  CheckCircle2,
  ArrowUpRight,
  ShieldAlert,
  Info,
  Clock,
} from "lucide-react";
import { api, type LotLayout3DDto, type StaffSessionRow } from "../../services/api";
import { staffApi } from "../../services/staff/staffApi";
import type { ParkingSlotDetail, SlotStatus, VehicleType } from "../../types/staff";

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

export default function LiveParkingView() {
  const navigate = useNavigate();
  const { selectedLotId } = useOutletContext<{ selectedLotId?: string }>() || {};

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [levels, setLevels] = useState<Array<{ levelId: string; levelCode: string; levelName: string; totalSlots: number; availableSlots: number }>>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [slots, setSlots] = useState<ParkingSlotDetail[]>([]);
  const [sessions, setSessions] = useState<StaffSessionRow[]>([]);
  const [lotLayout, setLotLayout] = useState<LotLayout3DDto | null>(null);
  const layoutCacheRef = useRef<Record<string, LotLayout3DDto>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");

  // Selected slot for modal inspection
  const [activeSlot, setActiveSlot] = useState<ParkingSlotDetail | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      if (!selectedLotId) return;
      const lotId = selectedLotId;
      const cachedLayout = layoutCacheRef.current[lotId];
      const [data, sessionRows, layout] = await Promise.all([
        staffApi.getParkingLotLevels(lotId),
        api.getStaffSessions(lotId).catch(() => [] as StaffSessionRow[]),
        cachedLayout
          ? Promise.resolve(cachedLayout)
          : api.getLotLayout3D(lotId).catch(() => null),
      ]);
      if (layout) {
        layoutCacheRef.current[lotId] = layout;
        setLotLayout(layout);
      } else {
        setLotLayout(null);
      }
      setLevels(data.levels);
      setSlots(data.slots);
      setLoadError("");
      setSessions(sessionRows);
      if (data.levels.length > 0 && !data.levels.some(level => level.levelId === selectedLevelId)) {
        setSelectedLevelId(data.levels[0].levelId);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Không tải được sơ đồ bãi. Hãy thử lại.");
    } finally {
      setLoading(false);
    }
  }, [selectedLotId, selectedLevelId]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => { void loadData(); }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const applyRealtimeStatusChanges = useCallback((changes: SlotStatusChange[]) => {
    if (!changes.length) return;
    setSlots(prev => prev.map(slot => {
      const hit = changes.find(
        change => change.slotId === slot.slotId && (!change.parkingLotId || change.parkingLotId === selectedLotId),
      );
      if (!hit) return slot;
      return { ...slot, status: mapRealtimeStatusToSlotStatus(hit.status) };
    }));
  }, [selectedLotId]);

  const hubStatus = useParkingHub(Boolean(selectedLotId), selectedLotId ?? null, applyRealtimeStatusChanges);

  const selectedLevelCode = useMemo(() => {
    if (!selectedLevelId) return undefined;
    const fromLayout = lotLayout?.levels.find(l => l.id === selectedLevelId)?.code;
    if (fromLayout) return fromLayout;
    return levels.find(l => l.levelId === selectedLevelId)?.levelCode;
  }, [lotLayout, levels, selectedLevelId]);

  const viewerLevels = useMemo<ModelLevel[]>(() => {
    const slotById = new Map(slots.map(slot => [slot.slotId, slot] as const));
    if (lotLayout && lotLayout.lotId === selectedLotId && lotLayout.levels.length > 0) {
      const mapped = lotLayout.levels
        .slice()
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map(level => {
          const levelSlots = (level.zones ?? []).flatMap(zone =>
            (zone.slots ?? []).map(spatialSlot => {
              const live = slotById.get(spatialSlot.id);
              return {
                slotId: spatialSlot.id,
                slotCode: spatialSlot.code || live?.slotCode || spatialSlot.id,
                floorCode: level.code || live?.levelName || level.name,
                zoneCode: zone.code || live?.zoneName || "",
                supportedVehicleTypes: live ? [live.vehicleType] : ["Car"],
                features: live?.features ?? [],
                status: live ? mapSlotStatusToViewerStatus(live.status) : (spatialSlot.operationalStatus === "ACTIVE" ? "AVAILABLE" : spatialSlot.operationalStatus),
                position: spatialSlot.position ?? null,
                rotationY: spatialSlot.rotationY ?? null,
                widthM: spatialSlot.widthM ?? null,
                lengthM: spatialSlot.lengthM ?? null,
                size: spatialSlot.size ?? null,
              };
            })
          );
          return {
            levelId: level.id,
            levelCode: level.code,
            levelName: level.name,
            elevationM: level.elevationM ?? null,
            slots: levelSlots,
          };
        })
        .filter(level => level.slots.length > 0);
      if (mapped.length > 0) return mapped;
    }

    return levels.map(level => ({
      levelId: level.levelId,
      levelCode: level.levelCode,
      levelName: level.levelName,
      slots: slots
        .filter(slot => slot.levelId === level.levelId)
        .map(slot => ({
          slotId: slot.slotId,
          slotCode: slot.slotCode,
          floorCode: level.levelCode,
          zoneCode: slot.zoneName || "",
          supportedVehicleTypes: [slot.vehicleType],
          features: slot.features ?? [],
          status: mapSlotStatusToViewerStatus(slot.status),
        })),
    })).filter(level => level.slots.length > 0);
  }, [lotLayout, selectedLotId, levels, slots]);

  // Filtered Slots
  const currentLevelSlots = slots.filter((s) => !selectedLevelId || s.levelId === selectedLevelId);
  const filteredSlots = currentLevelSlots.filter((s) => {
    if (statusFilter !== "All" && s.status !== statusFilter) return false;
    if (vehicleFilter !== "All" && s.vehicleType !== vehicleFilter) return false;
    return true;
  });

  // Level statistics
  const totalCount = currentLevelSlots.length;
  const availableCount = currentLevelSlots.filter((s) => s.status === "Available").length;
  const occupiedCount = currentLevelSlots.filter((s) => s.status === "Occupied").length;
  const reservedCount = currentLevelSlots.filter((s) => s.status === "Reserved").length;
  const maintenanceCount = currentLevelSlots.filter((s) => s.status === "Maintenance").length;

  // Handle Staff Slot Operational Status Update (only Available / Maintenance / Disabled)
  const handleUpdateStatus = async (newStatus: "Available" | "Maintenance" | "Disabled") => {
    if (!activeSlot || !selectedLotId) return;
    if (!overrideReason.trim()) {
      setOverrideError("Vui lòng nhập lý do thay đổi trạng thái vận hành.");
      return;
    }
    setOverrideError("");
    setOverrideLoading(true);
    try {
      await staffApi.updateSlotStatus(selectedLotId, activeSlot, newStatus, overrideReason.trim());
      setActiveSlot({ ...activeSlot, status: newStatus });
      setOverrideReason("");
      await loadData();
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Lỗi cập nhật trạng thái ô.");
    } finally {
      setOverrideLoading(false);
    }
  };

  const activeSessionForSlot = useMemo(() => {
    if (!activeSlot) return null;
    return sessions.find(
      session => session.status !== "COMPLETED" && session.slotCode === activeSlot.slotCode,
    ) ?? null;
  }, [activeSlot, sessions]);

  const getVehicleIcon = (type: VehicleType) => {
    switch (type) {
      case "Motorcycle":
        return <Bike size={14} className="pm-slot-veh-icon" />;
      case "EV":
        return <Zap size={14} className="pm-slot-veh-icon ev" />;
      default:
        return <Car size={14} className="pm-slot-veh-icon" />;
    }
  };

  const getStatusText = (status: SlotStatus) => {
    switch (status) {
      case "Available":
        return "Trống";
      case "Occupied":
        return "Có xe";
      case "Reserved":
        return "Giữ chỗ";
      case "Maintenance":
        return "Bảo trì";
      default:
        return status;
    }
  };

  return (
    <div className="pm-layout-wrapper">
      {loadError && <div className="staff-alert error" role="alert">{loadError}<button className="staff-button" onClick={() => void loadData()}>Thử lại</button></div>}

      {/* ─── 1. Page Header & Theme Unification ───────────────────────────── */}
      <div className="pm-header-row">
        <div>
          <h1 className="pm-section-title pm-title-flex">
            <Grid3X3 size={26} color="var(--pm-teal)" />
            <span>Sơ đồ bãi đỗ</span>
          </h1>
          <p className="pm-section-subtitle">
            Theo dõi vị trí theo tầng, kiểm tra phiên đỗ và quản lý bảo trì tại bãi đang chọn.
          </p>
        </div>

        {/* Floor Selection Tabs */}
        <div className="pm-level-switcher">
          {levels.length > 0 ? (
            levels.map((lvl) => (
              <button
                key={lvl.levelId}
                type="button"
                onClick={() => setSelectedLevelId(lvl.levelId)}
                className={`pm-level-btn ${selectedLevelId === lvl.levelId ? "active" : ""}`}
              >
                <Layers size={15} />
                <span>{lvl.levelName.includes("(") ? lvl.levelName.split("(")[0].trim() : lvl.levelName}</span>
              </button>
            ))
          ) : (
            <span className="staff-muted staff-small">{loading ? "Đang tải tầng…" : "Chưa có tầng được cấu hình"}</span>
          )}
        </div>
      </div>

      {/* ─── 2. Top Summary Metric Cards (5 KPI Cards) ────────────────────── */}
      <div className="pm-summary-kpi-5">
        {/* Card 1: Tổng số chỗ tầng */}
        <div className="pm-kpi-card-dark">
          <div className="pm-kpi-header-sm">
            <span>TỔNG SỐ CHỖ TẦNG</span>
            <Layers size={16} className="pm-text-muted" />
          </div>
          <div className="pm-kpi-val-bold white">{totalCount}</div>
          <div className="pm-kpi-desc-sm">Công suất thiết kế tầng</div>
        </div>

        {/* Card 2: Còn trống */}
        <div className="pm-kpi-card-dark accent-green">
          <div className="pm-kpi-header-sm">
            <span>CÒN TRỐNG</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="pm-kpi-val-bold emerald">{availableCount}</div>
          <div className="pm-kpi-desc-sm green-text">Sẵn sàng tiếp nhận xe</div>
        </div>

        {/* Card 3: Đang đỗ (Xe thực) */}
        <div className="pm-kpi-card-dark accent-cyan">
          <div className="pm-kpi-header-sm">
            <span>ĐANG ĐỖ (XE THỰC)</span>
            <Car size={16} color="var(--pm-teal)" />
          </div>
          <div className="pm-kpi-val-bold cyan">{occupiedCount}</div>
          <div className="pm-kpi-desc-sm cyan-text">Theo phiên đỗ thực tế</div>
        </div>

        {/* Card 4: Đặt trước / Giữ chỗ */}
        <div className="pm-kpi-card-dark accent-amber">
          <div className="pm-kpi-header-sm">
            <span>ĐẶT TRƯỚC / GIỮ CHỖ</span>
            <Clock size={16} color="#fbbf24" />
          </div>
          <div className="pm-kpi-val-bold yellow">{reservedCount}</div>
          <div className="pm-kpi-desc-sm amber-text">Đang được giữ theo hệ thống</div>
        </div>

        {/* Card 5: Đang bảo trì */}
        <div className="pm-kpi-card-dark accent-red">
          <div className="pm-kpi-header-sm">
            <span>ĐANG BẢO TRÌ</span>
            <Wrench size={16} color="#f87171" />
          </div>
          <div className="pm-kpi-val-bold coral">{maintenanceCount}</div>
          <div className="pm-kpi-desc-sm red-text">Khóa can thiệp kỹ thuật</div>
        </div>
      </div>

      {/* ─── 3. Filter & Toolbar Panel ────────────────────────────────────── */}
      <div className="pm-toolbar-panel">
        <div className="pm-toolbar-left">
          <div className="pm-filter-title">
            <Filter size={15} color="var(--pm-teal)" />
            <span>Lọc trạng thái:</span>
          </div>

          <div className="pm-filter-pills">
            {[
              { id: "All", label: "Tất cả" },
              { id: "Available", label: "Trống" },
              { id: "Occupied", label: "Đang đỗ" },
              { id: "Reserved", label: "Giữ chỗ" },
              { id: "Maintenance", label: "Bảo trì" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`pm-filter-pill-btn ${statusFilter === st.id ? "active" : ""}`}
              >
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pm-toolbar-right">
          <div className="pm-select-group">
            <span className="pm-select-label">Phương tiện:</span>
            <select
              className="pm-toolbar-select"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              aria-label="Lọc theo loại phương tiện"
            >
              <option value="All">Tất cả xe</option>
              <option value="Car">Ô tô</option>
              <option value="Motorcycle">Xe máy</option>
              <option value="EV">Xe điện EV</option>
            </select>
          </div>

          <div className="pm-slot-counter-chip">
            <span>Hiển thị:</span>
            <strong>{filteredSlots.length} ô</strong>
          </div>
        </div>
      </div>

      {/* ─── 3.5 Interactive 3D Parking Viewer + SignalR Realtime Status ─── */}
      {viewerLevels.length > 0 && (
        <div className="pm-grid-card" style={{ marginBottom: 18 }}>
          <div className="pm-grid-card-header">
            <div className="pm-grid-title-group">
              <Layers size={18} color="var(--pm-teal)" />
              <h2 className="pm-grid-title">
                Mô hình 3D bãi đỗ · {hubStatus === "connected" ? "Đang nhận cập nhật trực tiếp" : "Đang tải lại định kỳ"}
              </h2>
            </div>
          </div>
          <div className="pm-grid-card-body">
            <ParkingViewer
              levels={viewerLevels}
              selectedLevelCode={selectedLevelCode || ""}
              selectedId={activeSlot?.slotId ?? null}
              onSelect={(slot) => {
                const matched = slots.find(item => item.slotId === slot.slotId);
                if (matched) {
                  setOverrideError("");
                  setActiveSlot(matched);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* ─── 4. Interactive Parking Grid Map (Sơ đồ Bố trí Ô đỗ) ───────────── */}
      <div className="pm-grid-card">
        <div className="pm-grid-card-header">
          <div className="pm-grid-title-group">
            <Layers size={18} color="var(--pm-teal)" />
            <h2 className="pm-grid-title">Sơ đồ Bố trí Ô đỗ • Nhấp vào từng ô để xem chi tiết hoặc can thiệp</h2>
          </div>

          <div className="pm-legend-row">
            <div className="pm-legend-item">
              <span className="pm-legend-dot available" />
              <span>Trống ({availableCount})</span>
            </div>
            <div className="pm-legend-item">
              <span className="pm-legend-dot occupied" />
              <span>Có xe ({occupiedCount})</span>
            </div>
            <div className="pm-legend-item">
              <span className="pm-legend-dot reserved" />
              <span>Giữ chỗ ({reservedCount})</span>
            </div>
            <div className="pm-legend-item">
              <span className="pm-legend-dot maintenance" />
              <span>Bảo trì ({maintenanceCount})</span>
            </div>
          </div>
        </div>

        <div className="pm-grid-card-body">
          {loading ? (
            <div className="pm-loading-container">
              <div className="pm-spinner" />
              <p>Đang tải sơ đồ mặt bằng ô đỗ...</p>
            </div>
          ) : (
            <div className="pm-parking-slots-grid">
              {filteredSlots.map((slot) => {
                const statusClass = slot.status.toLowerCase();
                const locationText = slot.zoneName
                  ? `${slot.zoneName} - ${slot.vehicleType === "Motorcycle" ? "Xe máy" : slot.vehicleType === "EV" ? "Xe điện" : "Ô tô"}`
                  : slot.slotCode.includes("A")
                  ? "Khu A - Ô tô"
                  : slot.slotCode.includes("B")
                  ? "Khu B - Xe máy"
                  : "Khu EV - Trụ sạc";

                return (
                  <div
                    key={slot.slotId || slot.slotCode}
                    className={`pm-slot-card ${statusClass}`}
                    onClick={() => setActiveSlot(slot)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="pm-slot-card-header">
                      <span className="pm-slot-name">{slot.slotCode}</span>
                      <div className="pm-slot-icon-wrap">
                        {getVehicleIcon(slot.vehicleType)}
                      </div>
                    </div>

                    <div className="pm-slot-badge-row">
                      <span className={`pm-slot-badge ${statusClass}`}>
                        {getStatusText(slot.status)}
                      </span>
                    </div>

                    <div className="pm-slot-location-sub">
                      {locationText}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── 5. Slot Detail Modal (Dark Theme Inspection) ──────────────────── */}
      <details className="staff-panel"><summary>Chuyển ô cho đặt chỗ bị ảnh hưởng</summary><ReservationRelocation key={selectedLotId} lotId={selectedLotId ?? ""} onMoved={() => void loadData()} /></details>
      {activeSlot && (
        <StaffDialog title={`Chi tiết ô đỗ ${activeSlot.slotCode}`} onClose={() => { if (!overrideLoading) setActiveSlot(null); }}>
            <div className="staff-modal-body">
              {/* Slot Meta Grid */}
              <div className="pm-slot-info-grid">
                <div className="pm-info-cell">
                  <span className="pm-cell-label">Mã vị trí:</span>
                  <strong className="pm-cell-val pm-text-teal">{activeSlot.slotCode}</strong>
                </div>
                <div className="pm-info-cell">
                  <span className="pm-cell-label">Tầng:</span>
                  <strong className="pm-cell-val">{activeSlot.levelName}</strong>
                </div>
                <div className="pm-info-cell">
                  <span className="pm-cell-label">Khu vực:</span>
                  <strong className="pm-cell-val">{activeSlot.zoneName || "Khu chuẩn"}</strong>
                </div>
                <div className="pm-info-cell">
                  <span className="pm-cell-label">Loại xe hỗ trợ:</span>
                  <strong className="pm-cell-val">{activeSlot.vehicleType}</strong>
                </div>
                <div className="pm-info-cell">
                  <span className="pm-cell-label">Trạng thái hiện tại:</span>
                  <span className={`pm-slot-badge ${activeSlot.status.toLowerCase()}`}>
                    {getStatusText(activeSlot.status)}
                  </span>
                </div>
                <div className="pm-info-cell">
                  <span className="pm-cell-label">Tính năng ô:</span>
                  <strong className="pm-cell-val">{activeSlot.slotType}</strong>
                </div>
              </div>

              {/* If Vehicle is Occupied */}
              {activeSlot.status === "Occupied" && (
                <div className="pm-occupied-vehicle-box">
                  <div className="pm-occupied-box-header">
                    <Info size={16} color="#f87171" />
                    <span>Thông tin Phương tiện Đang Đỗ</span>
                  </div>
                  <div className="pm-occupied-box-details">
                    <div>Mã phiên: <strong>{activeSessionForSlot?.sessionId || activeSlot.currentSessionId || "Đang đồng bộ"}</strong></div>
                    <div>Biển số xe: <strong>{activeSessionForSlot?.licensePlate || "Chưa tra được biển số"}</strong></div>
                  </div>
                  <div className="pm-occupied-actions">
                    <button
                      type="button"
                      className="pm-cta-btn-sm cyan"
                      disabled={!activeSessionForSlot?.licensePlate}
                      onClick={() => {
                        if (!activeSessionForSlot?.licensePlate) return;
                        navigate(`/staff/operations?tab=checkout&plate=${encodeURIComponent(activeSessionForSlot.licensePlate)}`);
                        setActiveSlot(null);
                      }}
                    >
                      <ArrowUpRight size={14} /> Đi tới Xuất bến
                    </button>
                    <button
                      type="button"
                      className="pm-cta-btn-sm red"
                      onClick={() => {
                        const params = new URLSearchParams({ slot: activeSlot.slotCode });
                        if (activeSessionForSlot?.licensePlate) params.set("plate", activeSessionForSlot.licensePlate);
                        navigate(`/staff/incidents?${params.toString()}`);
                        setActiveSlot(null);
                      }}
                    >
                      <ShieldAlert size={14} /> Báo cáo sự cố ô này
                    </button>
                  </div>
                </div>
              )}

              {/* Staff Manual Override (Only operational statuses: ACTIVE / MAINTENANCE / DISABLED) */}
              <div className="pm-override-section">
                <h4 className="pm-override-title">
                  Can thiệp Trạng thái Vận hành Ô đỗ
                </h4>
                {overrideError && <p role="alert" style={{ color: "#f87171", marginBottom: 8 }}>{overrideError}</p>}

                <div className="pm-form-field">
                  <label className="pm-form-label">Ghi chú / Lý do thay đổi trạng thái (*):</label>
                  <input
                    type="text"
                    className="pm-form-input"
                    placeholder="VD: Cảm biến hỏng, vạch sơn mờ, sửa chữa đường điện..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>

                <div className="pm-override-btn-group">
                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Available"}
                    onClick={() => handleUpdateStatus("Available")}
                    className="pm-override-btn green"
                  >
                    <CheckCircle2 size={15} /> Kích hoạt
                  </button>

                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Maintenance"}
                    onClick={() => handleUpdateStatus("Maintenance")}
                    className="pm-override-btn amber"
                  >
                    <Wrench size={15} /> Bảo trì
                  </button>

                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Disabled"}
                    onClick={() => handleUpdateStatus("Disabled")}
                    className="pm-override-btn red"
                  >
                    <X size={15} /> Tạm khóa
                  </button>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn-secondary"
                onClick={() => setActiveSlot(null)}
              >
                Đóng
              </button>
            </div>
        </StaffDialog>
      )}
    </div>
  );
}
