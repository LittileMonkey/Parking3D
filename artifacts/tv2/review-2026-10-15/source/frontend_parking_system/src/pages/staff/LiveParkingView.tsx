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

  // Level statistics
  const totalCount = currentLevelSlots.length;
  const availableCount = currentLevelSlots.filter((s) => s.status === "Available").length;
  const occupiedCount = currentLevelSlots.filter((s) => s.status === "Occupied").length;
  const reservedCount = currentLevelSlots.filter((s) => s.status === "Reserved").length;
  const maintenanceCount = currentLevelSlots.filter((s) => s.status === "Maintenance").length;

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
        return <Bike size={14} />;
      case "EV":
        return <Zap size={14} color="#087f8c" />;
      default:
        return <Car size={14} />;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="staff-page-header">
        <div>
          <h1 className="staff-page-title">
            <Grid3X3 size={24} color="var(--teal)" />
            Giám sát Mặt bằng & Sơ đồ Vị trí Ô đỗ
          </h1>
          <p className="staff-page-desc">
            Trực quan hóa trạng thái vị trí đỗ xe theo tầng, can thiệp trạng thái cảm biến và khóa bảo trì
          </p>
        </div>

        {/* Level Switcher */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {levels.map((lvl) => (
            <button
              key={lvl.levelId}
              type="button"
              onClick={() => setSelectedLevelId(lvl.levelId)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: selectedLevelId === lvl.levelId ? "var(--teal)" : "var(--line)",
                background: selectedLevelId === lvl.levelId ? "var(--teal)" : "white",
                color: selectedLevelId === lvl.levelId ? "white" : "var(--ink)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <Layers size={14} />
              <span>{lvl.levelName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Level Summary Statistics */}
      <div className="staff-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="staff-kpi-card" style={{ padding: 14 }}>
          <div className="staff-kpi-header"><span>TỔNG SỐ CHỖ TẦNG</span></div>
          <div className="staff-kpi-value" style={{ fontSize: 22 }}>{totalCount}</div>
        </div>

        <div className="staff-kpi-card success" style={{ padding: 14 }}>
          <div className="staff-kpi-header"><span>CÒN TRỐNG</span></div>
          <div className="staff-kpi-value" style={{ fontSize: 22, color: "var(--green)" }}>{availableCount}</div>
        </div>

        <div className="staff-kpi-card" style={{ padding: 14 }}>
          <div className="staff-kpi-header"><span>ĐANG ĐỖ (XE THỰC)</span></div>
          <div className="staff-kpi-value" style={{ fontSize: 22 }}>{occupiedCount}</div>
        </div>

        <div className="staff-kpi-card warning" style={{ padding: 14 }}>
          <div className="staff-kpi-header"><span>ĐẶT TRƯỚC / GIỮ CHỖ</span></div>
          <div className="staff-kpi-value" style={{ fontSize: 22, color: "var(--amber)" }}>{reservedCount}</div>
        </div>

        <div className="staff-kpi-card" style={{ padding: 14 }}>
          <div className="staff-kpi-header"><span>ĐANG BẢO TRÌ</span></div>
          <div className="staff-kpi-value" style={{ fontSize: 22, color: "var(--muted)" }}>{maintenanceCount}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="staff-card" style={{ marginBottom: 16 }}>
        <div className="staff-card-body" style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={15} /> Lọc trạng thái:
            </span>
            {["All", "Available", "Occupied", "Reserved", "Maintenance"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  border: "1px solid",
                  borderColor: statusFilter === st ? "var(--teal)" : "var(--line)",
                  background: statusFilter === st ? "#eff9f7" : "white",
                  color: statusFilter === st ? "var(--teal)" : "var(--muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {st === "All" ? "Tất cả" : st === "Available" ? "Trống" : st === "Occupied" ? "Đang đỗ" : st === "Reserved" ? "Giữ chỗ" : "Bảo trì"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Phương tiện:</span>
            <select
              className="staff-select"
              style={{ fontSize: 12, padding: "4px 8px" }}
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
            >
              <option value="All">Tất cả xe</option>
              <option value="Car">Ô tô</option>
              <option value="Motorcycle">Xe máy</option>
              <option value="EV">Xe điện EV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visual Slot Grid */}
      <div className="staff-card">
        <div className="staff-card-header">
          <h2 className="staff-card-title">
            <Layers size={16} color="var(--teal)" />
            Sơ đồ Bố trí Ô đỗ • Nhấp vào ô để xem chi tiết hoặc can thiệp
          </h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Hiển thị {filteredSlots.length} ô
          </span>
        </div>

        <div className="staff-card-body">
          {loading ? (
            <p style={{ textAlign: "center", color: "var(--muted)" }}>Đang tải sơ đồ ô đỗ...</p>
          ) : (
            <div className="staff-slot-grid">
              {filteredSlots.map((slot) => (
                <div
                  key={slot.slotId}
                  className={`staff-slot-item status-${slot.status}`}
                  onClick={() => setActiveSlot(slot)}
                >
                  <div className="staff-slot-code">
                    <span>{slot.slotCode}</span>
                    {getVehicleIcon(slot.vehicleType)}
                  </div>
                  <div className="staff-slot-meta">
                    <span
                      className={`staff-badge ${
                        slot.status === "Available"
                          ? "badge-available"
                          : slot.status === "Occupied"
                          ? "badge-occupied"
                          : slot.status === "Reserved"
                          ? "badge-reserved"
                          : "badge-maintenance"
                      }`}
                    >
                      {slot.status === "Available"
                        ? "Trống"
                        : slot.status === "Occupied"
                        ? "Có xe"
                        : slot.status === "Reserved"
                        ? "Giữ chỗ"
                        : "Bảo trì"}
                    </span>
                  </div>
                  {slot.zoneName && (
                    <div style={{ fontSize: 9.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slot.zoneName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slot Detail Modal */}
      {activeSlot && (
        <div className="staff-modal-backdrop" onClick={() => setActiveSlot(null)}>
          <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header">
              <h3 className="staff-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Grid3X3 size={20} color="var(--teal)" />
                Chi tiết Vị trí Ô đỗ: {activeSlot.slotCode}
              </h3>
              <button
                type="button"
                className="staff-btn-secondary"
                style={{ padding: 4 }}
                onClick={() => setActiveSlot(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <div>Mã vị trí: <strong>{activeSlot.slotCode}</strong></div>
                <div>Tầng: <strong>{activeSlot.levelName}</strong></div>
                <div>Khu vực: <strong>{activeSlot.zoneName || "Khu chuẩn"}</strong></div>
                <div>Loại xe hỗ trợ: <strong>{activeSlot.vehicleType}</strong></div>
                <div>
                  Trạng thái hiện tại:{" "}
                  <span
                    className={`staff-badge ${
                      activeSlot.status === "Available"
                        ? "badge-available"
                        : activeSlot.status === "Occupied"
                        ? "badge-occupied"
                        : activeSlot.status === "Reserved"
                        ? "badge-reserved"
                        : "badge-maintenance"
                    }`}
                  >
                    {activeSlot.status}
                  </span>
                </div>
                <div>Loại ô: <strong>{activeSlot.slotType}</strong></div>
              </div>

              {/* Nếu có xe đang đỗ */}
              {activeSlot.status === "Occupied" && (
                <div style={{ padding: 12, background: "#fff5f5", borderRadius: 8, border: "1px solid #fca5a5" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>
                    Thông tin Phương tiện Đang Đỗ
                  </div>
                  <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div>Mã phiên: <strong>{activeSlot.currentSessionId || "SES-ACTIVE"}</strong></div>
                    <div>Cảm biến IoT: <strong>Báo có vật cản (Siêu âm + Camera)</strong></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="staff-quick-btn staff-btn-primary"
                      style={{ fontSize: 12 }}
                      onClick={() => {
                        navigate(`/staff/operations?tab=checkout&plate=${encodeURIComponent(activeSlot.slotCode)}`);
                        setActiveSlot(null);
                      }}
                    >
                      <ArrowUpRight size={14} /> Đi tới Xuất bến
                    </button>
                    <button
                      type="button"
                      className="staff-quick-btn staff-btn-secondary"
                      style={{ fontSize: 12 }}
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

              {/* Can thiệp thủ công từ Staff */}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  Can thiệp Trạng thái Ô đỗ (Nhân viên vận hành)
                </h4>

                <div className="staff-form-group" style={{ marginBottom: 12 }}>
                  <label className="staff-label">Ghi chú / Lý do thay đổi trạng thái:</label>
                  <input
                    type="text"
                    className="staff-input"
                    placeholder="VD: Cảm biến hỏng, đang sơn lại vạch, sửa chữa đường điện..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Available"}
                    onClick={() => handleUpdateStatus("Available")}
                    className="staff-quick-btn staff-btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    <CheckCircle2 size={14} color="var(--green)" /> Chuyển thành TRỐNG
                  </button>

                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Maintenance"}
                    onClick={() => handleUpdateStatus("Maintenance")}
                    className="staff-quick-btn staff-btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    <Wrench size={14} color="var(--amber)" /> Chuyển thành BẢO TRÌ
                  </button>

                  <button
                    type="button"
                    disabled={overrideLoading || activeSlot.status === "Occupied"}
                    onClick={() => handleUpdateStatus("Occupied")}
                    className="staff-quick-btn staff-btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    <Car size={14} color="var(--red)" /> Đánh dấu ĐÃ CÓ XE
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
          </div>
        </div>
      )}
    </div>
  );
}
