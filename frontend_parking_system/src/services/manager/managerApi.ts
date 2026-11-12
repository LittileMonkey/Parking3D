import { api } from "../api";
import { operations } from "../operations";
import type { ManagerFacilitySummary, ApiResponse, LevelSummary, SlotControlItem, SlotStatus } from "../../types/manager";

export const managerApi = {
  async getManagedFacilities(): Promise<Pick<ManagerFacilitySummary, "lotId" | "code" | "name" | "address">[]> {
    const [lots, assignments] = await Promise.all([api.getParkingLots(), api.getStaffAssignmentsMe()]);
    const allowed = new Set(assignments.filter(item => item.roleCode === "PARKING_MANAGER").map(item => item.lotId));
    return lots.filter(lot => allowed.has(lot.id)).map(lot => ({ lotId: lot.id, code: lot.code, name: lot.name, address: lot.address }));
  },
  async getFacilitySlots(lotId: string, levelId = ""): Promise<ApiResponse<{ levels: LevelSummary[]; slots: SlotControlItem[] }>> {
    const rows = await operations.slots(lotId);
    const levels: LevelSummary[] = [...new Set(rows.map(row => row.levelId))].map(id => {
      const group = rows.filter(row => row.levelId === id);
      const occupied = group.filter(row => row.status === "OCCUPIED").length;
      return { levelId: id, levelName: group[0].levelName, totalSlots: group.length,
        occupiedSlots: occupied, availableSlots: group.filter(row => row.status === "AVAILABLE").length,
        maintenanceSlots: group.filter(row => row.operationalStatus === "MAINTENANCE").length,
        occupancyRate: group.length ? Math.round(occupied * 100 / group.length) : 0 };
    });
    const chosen = levels.some(level => level.levelId === levelId) ? levelId : levels[0]?.levelId;
    const slots: SlotControlItem[] = rows.filter(row => row.levelId === chosen).map(row => ({
      id: row.id, parkingLotId: lotId, slotCode: row.slotCode, levelId: row.levelId, levelName: row.levelName,
      zoneId: row.zoneId, zoneName: row.zoneName, operationalStatus: row.operationalStatus,
      status: row.status === "OCCUPIED" ? "Occupied" : row.status === "HELD" ? "Reserved" : row.status === "MAINTENANCE" ? "Maintenance" : row.status === "DISABLED" ? "Disabled" : "Available",
      vehicleType: row.vehicleTypes.includes("CAR") ? "Car" : "Motorcycle", sensorStatus: "Unknown",
    }));
    return { result: { levels, slots }, isSuccess: true, statusCode: 200, message: "Dữ liệu từ máy chủ." };
  },
  async updateSlotStatus(slot: SlotControlItem, newStatus: SlotStatus, reason: string): Promise<ApiResponse<SlotControlItem>> {
    const state = newStatus === "Available" ? "ACTIVE" : newStatus === "Maintenance" ? "MAINTENANCE" : newStatus === "Disabled" ? "DISABLED" : null;
    if (!state) throw new Error("Trạng thái có xe/giữ chỗ chỉ thay đổi qua nghiệp vụ vào, ra và đặt chỗ.");
    await operations.changeSlot(slot.parkingLotId, slot.id, state, slot.operationalStatus!, reason);
    return { result: { ...slot, status: newStatus, operationalStatus: state as "ACTIVE" | "MAINTENANCE" | "DISABLED" }, isSuccess: true, statusCode: 200, message: "Đã lưu trạng thái và nhật ký thay đổi." };
  },
};
