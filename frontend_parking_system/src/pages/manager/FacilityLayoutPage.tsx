import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Layers,
  Zap,
  Crown,
  Car,
  Bike,
  Wrench,
  CheckCircle2,
  Sliders,
  X,
  ShieldAlert,
} from "lucide-react";
import FacilityRbacStrip from "../../components/manager/FacilityRbacStrip";
import { managerApi } from "../../services/manager/managerApi";
import type {
  SlotControlItem,
  LevelSummary,
  SlotStatus,
} from "../../types/manager";

interface OutletContextType {
  selectedLotId: string;
}

export default function FacilityLayoutPage() {
  const { selectedLotId } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<LevelSummary[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string>("B1");
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>("all");
  const [slots, setSlots] = useState<SlotControlItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotControlItem | null>(null);

  // Modal override states
  const [modalOpen, setModalOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<SlotStatus>("Maintenance");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSlots() {
      setLoading(true);
      try {
        const res = await managerApi.getFacilitySlots(selectedLotId || "PKM-METRO-01", activeLevelId);
        if (res.isSuccess && res.result) {
          setLevels(res.result.levels);
          setSlots(res.result.slots);
        }
      } catch (err) {
        console.error("Failed to load facility slots", err);
      } finally {
        setLoading(false);
      }
    }
    loadSlots();
  }, [selectedLotId, activeLevelId]);

  const activeLevel = levels.find((l) => l.levelId === activeLevelId) || levels[0];

  const filteredSlots = slots.filter((slot) => {
    if (activeZoneFilter === "all") return true;
    return slot.zoneId === activeZoneFilter;
  });

  const handleOpenSlotModal = (slot: SlotControlItem) => {
    setSelectedSlot(slot);
    setOverrideStatus(slot.status === "Maintenance" ? "Available" : "Maintenance");
    setOverrideReason(slot.overrideReason || "");
    setModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!overrideReason.trim()) {
      alert("Vui lòng nhập lý do can thiệp bắt buộc để phục vụ lưu vết kiểm toán!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await managerApi.updateSlotStatus(selectedSlot.id, overrideStatus, overrideReason.trim());
      if (res.isSuccess) {
        // Update local slot list
        setSlots((prev) =>
          prev.map((s) => (s.id === selectedSlot.id ? res.result : s))
        );
        setStatusMessage(res.message);
        setModalOpen(false);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err) {
      console.error("Override slot error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pm-module-page">
      <FacilityRbacStrip
        parkingLotId={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        facilityName="Metropolis Central Hub"
        facilityCode={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        moduleTitle="Facility Layout & Slot Control"
        moduleDescription="Kiểm soát trạng thái ô đỗ, điều phối cảm biến IoT và can thiệp bảo trì khẩn cấp"
      />

      {statusMessage && (
        <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", borderRadius: 12, padding: "12px 18px", color: "#34d399", display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={18} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Level Summary Metrics & Interactive Tabs */}
      <div className="pm-glass-card" style={{ paddingBottom: 16 }}>
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Chọn Tầng Hầm & Khu Vực Vận Hành</h2>
              <span className="pm-card-subtitle">
                {activeLevel ? `${activeLevel.levelName} • Tỷ lệ lấp đầy ${activeLevel.occupancyRate}%` : ""}
              </span>
            </div>
          </div>

          {/* Quick Metrics of Active Level */}
          {activeLevel && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ color: "#94a3b8" }}>Trống:</span>
                <strong style={{ color: "#34d399" }}>{activeLevel.availableSlots}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ color: "#94a3b8" }}>Có xe:</span>
                <strong style={{ color: "#f87171" }}>{activeLevel.occupiedSlots}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                <span style={{ color: "#94a3b8" }}>Bảo trì:</span>
                <strong style={{ color: "#cbd5e1" }}>{activeLevel.maintenanceSlots}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "#94a3b8" }}>Tổng:</span>
                <strong style={{ color: "#ffffff" }}>{activeLevel.totalSlots} chỗ</strong>
              </div>
            </div>
          )}
        </div>

        {/* Level Switcher Buttons */}
        <div className="pm-level-switcher">
          {levels.map((lvl) => (
            <button
              key={lvl.levelId}
              type="button"
              className={`pm-level-tab-btn ${activeLevelId === lvl.levelId ? "active" : ""}`}
              onClick={() => setActiveLevelId(lvl.levelId)}
            >
              <Layers size={15} />
              <span>{lvl.levelName}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>({lvl.occupiedSlots}/{lvl.totalSlots})</span>
            </button>
          ))}
        </div>

        {/* Zone Filter Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button
            type="button"
            className={`pm-badge ${activeZoneFilter === "all" ? "pm-badge-info" : "pm-badge-neutral"}`}
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
            onClick={() => setActiveZoneFilter("all")}
          >
            Tất cả khu vực ({slots.length})
          </button>
          <button
            type="button"
            className={`pm-badge ${activeZoneFilter === "zone-a" ? "pm-badge-info" : "pm-badge-neutral"}`}
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
            onClick={() => setActiveZoneFilter("zone-a")}
          >
            <Car size={13} style={{ marginRight: 4 }} /> Khu A - Tiêu Chuẩn
          </button>
          <button
            type="button"
            className={`pm-badge ${activeZoneFilter === "zone-vip" ? "pm-badge-warning" : "pm-badge-neutral"}`}
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
            onClick={() => setActiveZoneFilter("zone-vip")}
          >
            <Crown size={13} style={{ marginRight: 4 }} /> Khu VIP
          </button>
          <button
            type="button"
            className={`pm-badge ${activeZoneFilter === "zone-ev" ? "pm-badge-success" : "pm-badge-neutral"}`}
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
            onClick={() => setActiveZoneFilter("zone-ev")}
          >
            <Zap size={13} style={{ marginRight: 4 }} /> Trạm Sạc EV
          </button>
          <button
            type="button"
            className={`pm-badge ${activeZoneFilter === "zone-moto" ? "pm-badge-info" : "pm-badge-neutral"}`}
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12 }}
            onClick={() => setActiveZoneFilter("zone-moto")}
          >
            <Bike size={13} style={{ marginRight: 4 }} /> Khu Xe Máy
          </button>
        </div>
      </div>

      {/* Interactive Slot Grid */}
      <div className="pm-glass-card">
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Ma Trận Vị Trí Ô Đỗ Thời Gian Thực</h2>
              <span className="pm-card-subtitle">Nhấp vào từng ô để xem chi tiết hoặc ghi đè trạng thái bảo trì</span>
            </div>
          </div>

          {/* Color Legend */}
          <div style={{ display: "flex", gap: 14, fontSize: 11, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#10b981" }} /> Sẵn Sàng
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444" }} /> Đang Đỗ
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#f59e0b" }} /> Đã Giữ Chỗ
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#64748b" }} /> Bảo Trì / Khóa
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Đang tải ma trận ô đỗ tầng {activeLevelId}…</div>
        ) : (
          <div className="pm-slot-grid">
            {filteredSlots.map((slot) => {
              const statusClass =
                slot.status === "Available"
                  ? "status-available"
                  : slot.status === "Occupied"
                  ? "status-occupied"
                  : slot.status === "Reserved"
                  ? "status-reserved"
                  : "status-maintenance";

              return (
                <div
                  key={slot.id}
                  className={`pm-slot-cell ${statusClass}`}
                  onClick={() => handleOpenSlotModal(slot)}
                  title={`Nhấp để kiểm soát ô ${slot.slotCode}`}
                >
                  <div className="pm-slot-top-row">
                    <span className="pm-slot-code">{slot.slotCode}</span>
                    {slot.vehicleType === "EV" ? (
                      <Zap size={14} style={{ color: "#34d399" }} aria-label="Cổng sạc EV" />
                    ) : slot.zoneId === "zone-vip" ? (
                      <Crown size={14} style={{ color: "#fbbf24" }} aria-label="Ô VIP" />
                    ) : slot.vehicleType === "Motorcycle" ? (
                      <Bike size={14} style={{ color: "#38bdf8" }} />
                    ) : (
                      <Car size={14} style={{ color: "#94a3b8" }} />
                    )}
                  </div>

                  <div style={{ minHeight: 22, display: "flex", alignItems: "center" }}>
                    {slot.status === "Occupied" && slot.currentPlate ? (
                      <span className="pm-slot-plate">{slot.currentPlate}</span>
                    ) : slot.status === "Available" ? (
                      <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>Trống</span>
                    ) : slot.status === "Reserved" ? (
                      <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>Đã Đặt</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#cbd5e1", display: "flex", alignItems: "center", gap: 3 }}>
                        <Wrench size={11} /> Khóa
                      </span>
                    )}
                  </div>

                  {slot.parkedSince && (
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>{slot.parkedSince}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Override Slot Status with Mandatory Reason */}
      {modalOpen && selectedSlot && (
        <div className="pm-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="pm-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="pm-header-icon-box">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    Kiểm Soát Vị Trí Ô Đỗ: <span style={{ color: "#00f2fe" }}>{selectedSlot.slotCode}</span>
                  </h3>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    {selectedSlot.levelName} • {selectedSlot.zoneName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                onClick={() => setModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Current Details */}
              <div style={{ background: "rgba(17, 24, 39, 0.6)", padding: 12, borderRadius: 10, fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div>Trạng thái hiện tại: <strong>{selectedSlot.status}</strong></div>
                {selectedSlot.currentPlate && (
                  <div>Biển số xe đang đỗ: <strong style={{ color: "#f87171" }}>{selectedSlot.currentPlate}</strong> (Đã đỗ {selectedSlot.parkedSince})</div>
                )}
                <div>Cảm biến IoT: <strong style={{ color: selectedSlot.sensorStatus === "Online" ? "#34d399" : "#fbbf24" }}>{selectedSlot.sensorStatus}</strong></div>
                {selectedSlot.overrideReason && (
                  <div style={{ color: "#fbbf24" }}>Lý do can thiệp trước đó: {selectedSlot.overrideReason} ({selectedSlot.lastOverriddenBy})</div>
                )}
              </div>

              {/* Action Selection */}
              <div className="pm-form-group">
                <label className="pm-form-label">Chuyển sang trạng thái mới:</label>
                <select
                  className="pm-form-select"
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as SlotStatus)}
                >
                  <option value="Available">Sẵn Sàng (Mở khóa cho khách đỗ)</option>
                  <option value="Maintenance">Bảo Trì Khẩn Cấp (Khóa vị trí ô đỗ)</option>
                  <option value="Disabled">Vô Hiệu Hóa (Sự cố kết cấu / cảm biến)</option>
                  <option value="Reserved">Giữ Chỗ Thủ Công (Sự kiện / Xe ưu tiên)</option>
                </select>
              </div>

              {/* Mandatory Reason */}
              <div className="pm-form-group">
                <label className="pm-form-label" style={{ color: "#f87171" }}>
                  <ShieldAlert size={14} /> Lý Do Can Thiệp / Phê Duyệt Ghi Đè (BẮT BUỘC):
                </label>
                <textarea
                  className="pm-form-textarea"
                  rows={3}
                  placeholder="Ví dụ: Vệ sinh vết dầu máy xe đỗ trước, thay cảm biến siêu âm vị trí A12..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  required
                />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>
                  * Mọi thay đổi trạng thái đều được ký điện tử và lưu vĩnh viễn vào Append-only Audit Log.
                </span>
              </div>

              <div className="pm-modal-footer">
                <button
                  type="button"
                  className="pm-btn-outline"
                  onClick={() => setModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="pm-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang cập nhật..." : "Xác nhận & Ghi nhật ký"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
