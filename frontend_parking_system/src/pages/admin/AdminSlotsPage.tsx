import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  Filter,
  RefreshCw,
  Eye,
  Car,
  Bike,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { api, type ParkingLot } from "../../services/api";
import { managerApi } from "../../services/manager/managerApi";
import type { SlotControlItem, LevelSummary, SlotStatus } from "../../types/manager";

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
  const [overrideStatus, setOverrideStatus] = useState<SlotStatus>("Maintenance");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // 2. Load slots & levels for selected bãi
  const loadSlots = async () => {
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
  };

  useEffect(() => {
    loadSlots();
  }, [selectedLotId, activeLevelId]);

  const activeLevel = levels.find((l) => l.levelId === activeLevelId) || levels[0];

  // Distinct zones
  const zones = Array.from(new Set(slots.map((s) => s.zoneName || "Khu chuẩn")));

  const filteredSlots = slots.filter((slot) => {
    if (activeZoneFilter !== "all" && (slot.zoneName || "Khu chuẩn") !== activeZoneFilter) return false;
    if (activeStatusFilter !== "all") {
      if (activeStatusFilter === "Available" && slot.status !== "Available") return false;
      if (activeStatusFilter === "Occupied" && slot.status !== "Occupied") return false;
      if (activeStatusFilter === "Maintenance" && slot.status !== "Maintenance") return false;
      if (activeStatusFilter === "Reserved" && slot.status !== "Reserved") return false;
    }
    return true;
  });

  const handleOpenSlotModal = (slot: SlotControlItem) => {
    setSelectedSlot(slot);
    setOverrideStatus(slot.status === "Maintenance" ? "Available" : "Maintenance");
    setOverrideReason("");
    setActionMessage(null);
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
          loadSlots();
        }, 1000);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Cập nhật thất bại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* ── Control Bar: Facility Selector & Actions ── */}
      <div className="adm-card" style={{ padding: "12px 18px", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-navy)", display: "flex", alignItems: "center", gap: "5px" }}>
              <Building2 size={16} color="var(--adm-indigo)" />
              Cơ sở bãi đỗ:
            </span>
            <select
              className="adm-select"
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

          {/* Level Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-muted)", marginRight: "4px" }}>
              Tầng:
            </span>
            {levels.map((lvl) => {
              const isSelected = lvl.levelId === activeLevelId;
              return (
                <button
                  key={lvl.levelId}
                  onClick={() => setActiveLevelId(lvl.levelId)}
                  className={`adm-level-btn ${isSelected ? "active" : ""}`}
                >
                  {lvl.levelName} ({lvl.availableSlots}/{lvl.totalSlots})
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => navigate(`/admin/map-3d/${selectedLotId}`)}
              className="adm-btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              title="Mở sơ đồ 3D tương ứng của bãi này"
            >
              <Eye size={14} />
              <span>Xem Sơ Đồ 3D</span>
            </button>
            <button onClick={loadSlots} className="adm-btn-secondary" style={{ padding: "6px 10px" }} title="Làm mới">
              <RefreshCw size={13} className={loading ? "adm-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Level Summary Stats Strip ── */}
      {activeLevel && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--adm-border)" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--adm-muted)", fontWeight: 700 }}>TỔNG Ô ĐỖ TẦNG</span>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-navy)" }}>{activeLevel.totalSlots}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--adm-border)" }}>
            <span style={{ fontSize: "0.72rem", color: "#166534", fontWeight: 700 }}>ĐANG TRỐNG</span>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#15803d" }}>{activeLevel.availableSlots}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--adm-border)" }}>
            <span style={{ fontSize: "0.72rem", color: "#991b1b", fontWeight: 700 }}>ĐANG ĐỖ XE</span>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#b91c1c" }}>{activeLevel.occupiedSlots}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--adm-border)" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>BẢO TRÌ</span>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#475569" }}>{activeLevel.maintenanceSlots}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--adm-border)" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--adm-indigo)", fontWeight: 700 }}>TỶ LỆ LẤP ĐẦY</span>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-indigo)" }}>{activeLevel.occupancyRate}%</div>
          </div>
        </div>
      )}

      {/* ── Filters & Search Bar ── */}
      <div className="adm-card" style={{ padding: "12px 18px", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Filter size={15} color="var(--adm-muted)" />
            <select
              className="adm-select"
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
              className="adm-select"
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

          <div style={{ fontSize: "0.8rem", color: "var(--adm-muted)", fontWeight: 600 }}>
            Hiển thị <strong>{filteredSlots.length}</strong> / {slots.length} ô đỗ
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "14px" }}>
          {error}
        </div>
      )}

      {/* ── Slot Cards Grid ── */}
      <div className="adm-card">
        <div className="adm-slots-grid">
          {filteredSlots.map((slot) => {
            const isCar = slot.vehicleType === "Car";
            const statusCls =
              slot.status === "Available"
                ? "status-available"
                : slot.status === "Occupied"
                ? "status-occupied"
                : slot.status === "Reserved"
                ? "status-reserved"
                : slot.status === "Maintenance"
                ? "status-maintenance"
                : "status-disabled";

            return (
              <div
                key={slot.id}
                className={`adm-slot-card ${statusCls}`}
                onClick={() => handleOpenSlotModal(slot)}
                title="Bấm để can thiệp / khóa bảo trì ô đỗ này"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.95rem", color: "var(--adm-navy)" }}>{slot.slotCode}</strong>
                  {isCar ? <Car size={14} color="#0891b2" /> : <Bike size={14} color="#d97706" />}
                </div>

                <div style={{ fontSize: "0.7rem", color: "var(--adm-muted)" }}>
                  {slot.zoneName || "Khu chuẩn"}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color:
                        slot.status === "Available"
                          ? "#15803d"
                          : slot.status === "Occupied"
                          ? "#b91c1c"
                          : slot.status === "Reserved"
                          ? "#b45309"
                          : "#64748b",
                    }}
                  >
                    {slot.status}
                  </span>
                  <span style={{ fontSize: "0.65rem", padding: "1px 4px", borderRadius: "4px", background: "rgba(0,0,0,0.05)" }}>
                    {slot.operationalStatus || "ACTIVE"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSlots.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "36px", color: "var(--adm-muted)", fontSize: "0.85rem" }}>
            Không có ô đỗ nào phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>

      {/* ── Slot Override Modal ── */}
      {selectedSlot && (
        <div className="adm-modal-backdrop" onClick={() => !isSubmitting && setSelectedSlot(null)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">
                Can Thiệp Quản Trị Ô Đỗ: {selectedSlot.slotCode}
              </h3>
              <button
                className="adm-modal-close"
                onClick={() => !isSubmitting && setSelectedSlot(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveOverride}>
              <div className="adm-modal-body">
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                    Vị trí ô đỗ:
                  </label>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-navy)", marginTop: "2px" }}>
                    {selectedSlot.slotCode} ({selectedSlot.levelName} — {selectedSlot.zoneName || "Khu chuẩn"})
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                    Chuyển sang trạng thái vận hành:
                  </label>
                  <select
                    className="adm-select"
                    style={{ width: "100%", marginTop: "4px" }}
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value as SlotStatus)}
                    disabled={isSubmitting}
                  >
                    <option value="Available">Sẵn sàng đón xe (Available / ACTIVE)</option>
                    <option value="Maintenance">Khóa bảo trì cảm biến / hạ tầng (Maintenance)</option>
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
                      border: "1px solid var(--adm-border)",
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
                  onClick={() => setSelectedSlot(null)}
                  disabled={isSubmitting}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="adm-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang xử lý..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
