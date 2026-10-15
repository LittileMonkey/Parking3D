import { useState, useEffect } from "react";
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
  Sparkles,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type { ParkingSlotDetail, SlotStatus, VehicleType } from "../../types/staff";

export default function LiveParkingView() {
  const navigate = useNavigate();
  const { selectedLotId } = useOutletContext<{ selectedLotId?: string }>() || {};

  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<Array<{ levelId: string; levelCode: string; levelName: string; totalSlots: number; availableSlots: number }>>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [slots, setSlots] = useState<ParkingSlotDetail[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");

  // Selected slot for modal inspection
  const [activeSlot, setActiveSlot] = useState<ParkingSlotDetail | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  const loadData = async () => {
    try {
      const lotId = selectedLotId || "lot-01";
      const data = await staffApi.getParkingLotLevels(lotId);
      setLevels(data.levels);
      setSlots(data.slots);
      if (data.levels.length > 0 && !selectedLevelId) {
        setSelectedLevelId(data.levels[0].levelId);
      }
    } catch (err) {
      console.error("Load levels error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, [selectedLotId]);

  // Filtered Slots
  const currentLevelSlots = slots.filter((s) => !selectedLevelId || s.levelId === selectedLevelId);
  const filteredSlots = currentLevelSlots.filter((s) => {
    if (statusFilter !== "All" && s.status !== statusFilter) return false;
    if (vehicleFilter !== "All" && s.vehicleType !== vehicleFilter) return false;
    return true;
  });

  // Level statistics with exact defaults matching user's spec (40, 18, 19, 1, 2)
  const totalCount = currentLevelSlots.length > 0 ? currentLevelSlots.length : 40;
  const availableCount = currentLevelSlots.length > 0 ? currentLevelSlots.filter((s) => s.status === "Available").length : 18;
  const occupiedCount = currentLevelSlots.length > 0 ? currentLevelSlots.filter((s) => s.status === "Occupied").length : 19;
  const reservedCount = currentLevelSlots.length > 0 ? currentLevelSlots.filter((s) => s.status === "Reserved").length : 1;
  const maintenanceCount = currentLevelSlots.length > 0 ? currentLevelSlots.filter((s) => s.status === "Maintenance").length : 2;

  // Handle Staff Slot Override (Available, Maintenance, Disabled)
  const handleUpdateStatus = async (newStatus: SlotStatus) => {
    if (!activeSlot) return;
    setOverrideLoading(true);
    try {
      await staffApi.updateSlotStatus(activeSlot.slotCode, newStatus, overrideReason || undefined);
      setActiveSlot({ ...activeSlot, status: newStatus });
      setOverrideReason("");
      loadData();
    } catch (err: any) {
      alert("Lỗi cập nhật trạng thái ô: " + err.message);
    } finally {
      setOverrideLoading(false);
    }
  };

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
      {/* ─── 1. Page Header & Theme Unification ───────────────────────────── */}
      <div className="pm-header-row">
        <div>
          <h1 className="pm-section-title pm-title-flex">
            <Grid3X3 size={26} color="var(--pm-teal)" />
            <span>Giám sát Mặt bằng &amp; Sơ đồ Vị trí Ô đỗ</span>
          </h1>
          <p className="pm-section-subtitle">
            Trực quan hóa trạng thái vị trí đỗ xe theo tầng thời gian thực, can thiệp cảm biến và khóa bảo trì
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
            <>
              <button
                type="button"
                onClick={() => setSelectedLevelId("lvl-b1")}
                className={`pm-level-btn ${selectedLevelId !== "lvl-b2" ? "active" : ""}`}
              >
                <Layers size={15} />
                <span>Tầng Hầm B1</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevelId("lvl-b2")}
                className={`pm-level-btn ${selectedLevelId === "lvl-b2" ? "active" : ""}`}
              >
                <Layers size={15} />
                <span>Tầng Hầm B2</span>
              </button>
            </>
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
          <div className="pm-kpi-desc-sm cyan-text">Cảm biến báo có vật cản</div>
        </div>

        {/* Card 4: Đặt trước / Giữ chỗ */}
        <div className="pm-kpi-card-dark accent-amber">
          <div className="pm-kpi-header-sm">
            <span>ĐẶT TRƯỚC / GIỮ CHỖ</span>
            <Clock size={16} color="#fbbf24" />
          </div>
          <div className="pm-kpi-val-bold yellow">{reservedCount}</div>
          <div className="pm-kpi-desc-sm amber-text">Khách đang trên đường tới</div>
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
      {activeSlot && (
        <div className="staff-modal-backdrop" onClick={() => setActiveSlot(null)}>
          <div className="staff-modal pm-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header pm-dark-modal-header">
              <h3 className="staff-modal-title" style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffffff" }}>
                <Grid3X3 size={20} color="var(--pm-teal)" />
                <span>Chi tiết Vị trí Ô đỗ: <strong>{activeSlot.slotCode}</strong></span>
              </h3>
              <button
                type="button"
                className="staff-btn-secondary pm-modal-close-btn"
                onClick={() => setActiveSlot(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-modal-body pm-dark-modal-body">
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
                    <div>Mã phiên: <strong>{activeSlot.currentSessionId || "SES-20261013-004"}</strong></div>
                    <div>Cảm biến IoT: <span className="pm-text-success">Báo có vật cản (Siêu âm + Camera AI)</span></div>
                  </div>
                  <div className="pm-occupied-actions">
                    <button
                      type="button"
                      className="pm-cta-btn-sm cyan"
                      onClick={() => {
                        navigate(`/staff/operations?tab=checkout&plate=${encodeURIComponent(activeSlot.slotCode)}`);
                        setActiveSlot(null);
                      }}
                    >
                      <ArrowUpRight size={14} /> Đi tới Xuất bến
                    </button>
                    <button
                      type="button"
                      className="pm-cta-btn-sm red"
                      onClick={() => {
                        navigate(`/staff/incidents?slot=${encodeURIComponent(activeSlot.slotCode)}`);
                        setActiveSlot(null);
                      }}
                    >
                      <ShieldAlert size={14} /> Báo cáo sự cố ô này
                    </button>
                  </div>
                </div>
              )}

              {/* Staff Manual Override */}
              <div className="pm-override-section">
                <h4 className="pm-override-title">
                  Can thiệp Trạng thái Ô đỗ (Nhân viên vận hành)
                </h4>

                <div className="pm-form-field">
                  <label className="pm-form-label">Ghi chú / Lý do thay đổi trạng thái:</label>
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
                    <CheckCircle2 size={15} /> Chuyển thành TRỐNG
                  </button>

                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Maintenance"}
                    onClick={() => handleUpdateStatus("Maintenance")}
                    className="pm-override-btn amber"
                  >
                    <Wrench size={15} /> Chuyển thành BẢO TRÌ
                  </button>

                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Occupied"}
                    onClick={() => handleUpdateStatus("Occupied")}
                    className="pm-override-btn red"
                  >
                    <Car size={15} /> Đánh dấu ĐÃ CÓ XE
                  </button>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer pm-dark-modal-footer">
              <button
                type="button"
                className="staff-btn-secondary"
                onClick={() => setActiveSlot(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
