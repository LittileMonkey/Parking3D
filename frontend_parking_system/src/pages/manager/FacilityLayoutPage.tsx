import ReservationRelocation from "../../components/parking/ReservationRelocation";
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
  const [revision, setRevision] = useState(0);
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
        const res = await managerApi.getFacilitySlots(selectedLotId, activeLevelId);
        if (res.isSuccess && res.result) {
          setLevels(res.result.levels);
          setSlots(res.result.slots);
        }
      } catch (err) {
        setSlots([]);
        setLevels([]);
        setStatusMessage(err instanceof Error ? err.message : "Không tải được mặt bằng.");
      } finally {
        setLoading(false);
      }
    }
    loadSlots();
  }, [selectedLotId, activeLevelId, revision]);

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
      const res = await managerApi.updateSlotStatus(selectedSlot, overrideStatus, overrideReason.trim());
      if (res.isSuccess) {
        setSlots((prev) =>
          prev.map((s) => (s.id === selectedSlot.id ? res.result : s))
        );
        setStatusMessage(res.message);
        setModalOpen(false);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không cập nhật được ô đỗ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* 1. Chuyển ô cho đặt chỗ bị ảnh hưởng */}
      <ReservationRelocation
        key={selectedLotId}
        lotId={selectedLotId}
        onMoved={() => setRevision((value) => value + 1)}
      />

      {/* 2. RBAC Strip */}
      <FacilityRbacStrip
        parkingLotId={selectedLotId}
        facilityName="Cơ sở bãi đang chọn"
        facilityCode={selectedLotId}
        moduleTitle="Sơ Đồ Vị Trí & Khóa Ô Bảo Trì"
        moduleDescription="Kiểm soát trạng thái thời gian thực ô đỗ, chuyển đặt chỗ và bảo trì cảm biến"
      />

      {statusMessage && (
        <div
          style={{
            background: "#d1fae5",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: 12,
            padding: "12px 18px",
            color: "#065f46",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 3. Level Summary Metrics & Interactive Tabs */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="pm-card-title-group">
            <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
              <Layers size={18} />
            </div>
            <div>
              <h3 className="pm-card-h3">Chọn Tầng Hầm & Khu Vực Vận Hành</h3>
              <span className="pm-card-sub">
                {activeLevel ? `${activeLevel.levelName} • Tỷ lệ lấp đầy ${activeLevel.occupancyRate}%` : "Chọn tầng để xem ma trận ô đỗ"}
              </span>
            </div>
          </div>

          {activeLevel && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ color: "var(--pm-muted)" }}>Trống:</span>
                <strong style={{ color: "#065f46" }}>{activeLevel.availableSlots}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ color: "var(--pm-muted)" }}>Có xe:</span>
                <strong style={{ color: "#991b1b" }}>{activeLevel.occupiedSlots}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                <span style={{ color: "var(--pm-muted)" }}>Bảo trì:</span>
                <strong style={{ color: "#475569" }}>{activeLevel.maintenanceSlots}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--pm-muted)" }}>Tổng:</span>
                <strong style={{ color: "var(--pm-navy)" }}>{activeLevel.totalSlots} chỗ</strong>
              </div>
            </div>
          )}
        </div>

        {/* Level Switcher Buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {levels.map((lvl) => {
            const isActive = activeLevelId === lvl.levelId;
            return (
              <button
                key={lvl.levelId}
                type="button"
                className={`pm-btn ${isActive ? "pm-btn-primary" : "pm-btn-secondary"}`}
                style={{ height: 38, padding: "0 16px", fontSize: 12.5 }}
                onClick={() => setActiveLevelId(lvl.levelId)}
              >
                <Layers size={14} />
                <span>{lvl.levelName}</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>({lvl.occupiedSlots}/{lvl.totalSlots})</span>
              </button>
            );
          })}
        </div>

        {/* Zone Filter Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--pm-border-subtle)", paddingTop: 14 }}>
          <button
            type="button"
            className={`pm-badge ${activeZoneFilter === "all" ? "info" : "success"}`}
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12, border: activeZoneFilter === "all" ? "2px solid var(--pm-blue)" : "1px solid var(--pm-border)" }}
            onClick={() => setActiveZoneFilter("all")}
          >
            Tất cả khu vực ({slots.length})
          </button>
          <button
            type="button"
            className="pm-badge info"
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12, border: activeZoneFilter === "zone-a" ? "2px solid var(--pm-blue)" : "1px solid var(--pm-border)" }}
            onClick={() => setActiveZoneFilter("zone-a")}
          >
            <Car size={13} style={{ marginRight: 4 }} /> Khu A - Tiêu Chuẩn
          </button>
          <button
            type="button"
            className="pm-badge warning"
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12, border: activeZoneFilter === "zone-vip" ? "2px solid var(--pm-blue)" : "1px solid var(--pm-border)" }}
            onClick={() => setActiveZoneFilter("zone-vip")}
          >
            <Crown size={13} style={{ marginRight: 4 }} /> Khu VIP
          </button>
          <button
            type="button"
            className="pm-badge success"
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12, border: activeZoneFilter === "zone-ev" ? "2px solid var(--pm-blue)" : "1px solid var(--pm-border)" }}
            onClick={() => setActiveZoneFilter("zone-ev")}
          >
            <Zap size={13} style={{ marginRight: 4 }} /> Trạm Sạc EV
          </button>
          <button
            type="button"
            className="pm-badge info"
            style={{ cursor: "pointer", padding: "6px 14px", fontSize: 12, border: activeZoneFilter === "zone-moto" ? "2px solid var(--pm-blue)" : "1px solid var(--pm-border)" }}
            onClick={() => setActiveZoneFilter("zone-moto")}
          >
            <Bike size={13} style={{ marginRight: 4 }} /> Khu Xe Máy
          </button>
        </div>
      </div>

      {/* 4. Interactive Slot Grid */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="pm-card-title-group">
            <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="pm-card-h3">Ma Trận Vị Trí Ô Đỗ Thời Gian Thực</h3>
              <span className="pm-card-sub">Nhấp vào từng ô để xem chi tiết thông số hoặc can thiệp khóa bảo trì</span>
            </div>
          </div>

          {/* Color Legend */}
          <div style={{ display: "flex", gap: 14, fontSize: 11.5, flexWrap: "wrap", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#065f46" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#10b981" }} /> Sẵn Sàng
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#991b1b" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444" }} /> Đang Đỗ
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#92400e" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#f59e0b" }} /> Đã Giữ Chỗ
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#475569" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#94a3b8" }} /> Bảo Trì / Khóa
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--pm-muted)" }}>
            Đang tải ma trận ô đỗ tầng {activeLevelId}…
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
              gap: 12,
              marginTop: 10,
            }}
          >
            {filteredSlots.map((slot) => {
              const isAvailable = slot.status === "Available";
              const isOccupied = slot.status === "Occupied";
              const isReserved = slot.status === "Reserved";

              const cardBg = isAvailable
                ? "#d1fae5"
                : isOccupied
                ? "#fee2e2"
                : isReserved
                ? "#fef3c7"
                : "#f1f5f9";

              const borderColor = isAvailable
                ? "rgba(16, 185, 129, 0.4)"
                : isOccupied
                ? "rgba(239, 68, 68, 0.4)"
                : isReserved
                ? "rgba(245, 158, 11, 0.4)"
                : "rgba(100, 116, 139, 0.3)";

              return (
                <div
                  key={slot.id}
                  onClick={() => handleOpenSlotModal(slot)}
                  title={`Nhấp để kiểm soát ô ${slot.slotCode}`}
                  style={{
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "var(--pm-navy)" }}>{slot.slotCode}</span>
                    {slot.vehicleType === "EV" ? (
                      <Zap size={14} style={{ color: "#059669" }} aria-label="Cổng sạc EV" />
                    ) : slot.zoneId === "zone-vip" ? (
                      <Crown size={14} style={{ color: "#d97706" }} aria-label="Ô VIP" />
                    ) : slot.vehicleType === "Motorcycle" ? (
                      <Bike size={14} style={{ color: "var(--pm-blue)" }} />
                    ) : (
                      <Car size={14} style={{ color: "var(--pm-muted)" }} />
                    )}
                  </div>

                  <div style={{ minHeight: 20, display: "flex", alignItems: "center" }}>
                    {isOccupied && slot.currentPlate ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: "#ffffff",
                          padding: "2px 6px",
                          borderRadius: 6,
                          color: "#991b1b",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        {slot.currentPlate}
                      </span>
                    ) : isAvailable ? (
                      <span style={{ fontSize: 11.5, color: "#065f46", fontWeight: 700 }}>Trống</span>
                    ) : isReserved ? (
                      <span style={{ fontSize: 11.5, color: "#92400e", fontWeight: 700 }}>Đã Đặt</span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: "#475569", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Wrench size={11} /> Khóa
                      </span>
                    )}
                  </div>

                  {slot.parkedSince && (
                    <span style={{ fontSize: 10, color: "var(--pm-muted)" }}>{slot.parkedSince}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Modal: Override Slot Status */}
      {modalOpen && selectedSlot && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(7, 45, 89, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 50px rgba(7, 45, 89, 0.25)",
              border: "1px solid var(--pm-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--pm-navy)" }}>
                    Kiểm Soát Ô: <span style={{ color: "var(--pm-blue)" }}>{selectedSlot.slotCode}</span>
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--pm-muted)" }}>
                    {selectedSlot.levelName} • {selectedSlot.zoneName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--pm-muted)", cursor: "pointer" }}
                onClick={() => setModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid var(--pm-border)", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
                <div>Trạng thái hiện tại: <strong>{selectedSlot.status}</strong></div>
                {selectedSlot.currentPlate && (
                  <div>Biển số xe: <strong style={{ color: "var(--pm-rose)" }}>{selectedSlot.currentPlate}</strong> (Đã đỗ {selectedSlot.parkedSince})</div>
                )}
                <div>Cảm biến IoT: <strong style={{ color: selectedSlot.sensorStatus === "Online" ? "#10b981" : "#f59e0b" }}>{selectedSlot.sensorStatus}</strong></div>
                {selectedSlot.overrideReason && (
                  <div style={{ color: "#b45309" }}>Lý do trước đó: {selectedSlot.overrideReason} ({selectedSlot.lastOverriddenBy})</div>
                )}
              </div>

              <div className="pm-form-group" style={{ marginBottom: 0 }}>
                <label className="pm-label">Trạng thái ghi đè mới:</label>
                <select
                  className="pm-select-light"
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as SlotStatus)}
                >
                  <option value="Maintenance">Khóa bảo trì (Maintenance)</option>
                  <option value="Available">Mở hoạt động (Available)</option>
                </select>
              </div>

              <div className="pm-form-group" style={{ marginBottom: 0 }}>
                <label className="pm-label">Lý do can thiệp (Bắt buộc lưu kiểm toán):</label>
                <textarea
                  className="pm-textarea"
                  rows={3}
                  required
                  placeholder="VD: Cảm biến siêu âm báo tín hiệu ảo, khóa để nhân viên kỹ thuật thay thế pin."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className="pm-btn pm-btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="pm-btn pm-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang lưu…" : "Xác Nhận Can Thiệp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
