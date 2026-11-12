import { operations } from "../operations";
import { api, type IncidentSummaryDto, type PaymentReceiptDto } from "../api";
import type { ParkingLotSummary, ParkingSlotDetail, SlotStatus, CheckInPayload, CheckInResult, Incident, CreateIncidentPayload, CashConfirmationResult, PlateRecognitionResult } from "../../types/staff";

function mapCheckInVehicleType(vehicleType?: string): string {
  const normalized = (vehicleType ?? "Car").trim().toUpperCase();
  if (normalized === "MOTORCYCLE" || normalized === "BIKE" || normalized === "MOTORBIKE") return "MOTORBIKE";
  if (normalized === "CAR") return "CAR";
  if (normalized === "EV") return "EV";
  if (normalized === "TRUCK") return "TRUCK";
  if (normalized === "BICYCLE") return "BICYCLE";
  return normalized || "CAR";
}

function mapIncident(item: IncidentSummaryDto & { notes?: string | null }): Incident {
  return {
    incidentId: item.incidentId, title: item.title, type: item.type,
    severity: item.severity, status: item.status, description: item.description ?? "",
    relatedLicensePlate: item.relatedPlate ?? undefined, relatedSessionId: item.relatedSessionId ?? undefined,
    relatedSlotCode: item.relatedSlotCode ?? undefined, relatedGate: item.relatedGate ?? undefined,
    reportedBy: item.reportedByUserId ?? "", detectedAt: item.detectedAt ?? item.reportedAt ?? item.updatedAt,
    updatedAt: item.updatedAt, resolvedAt: item.resolvedAt ?? undefined, notes: item.notes ?? undefined,
    version: typeof item.version === "number" ? item.version : 1,
  };
}

export const staffApi = {
  async getParkingLots(): Promise<ParkingLotSummary[]> {
    const [lots, assignments] = await Promise.all([api.getParkingLots(), api.getStaffAssignmentsMe()]);
    const assigned = new Set(assignments.map(item => item.lotId));
    return Promise.all(lots.filter(lot => assigned.has(lot.id)).map(async lot => {
      const slots = await operations.slots(lot.id);
      const count = (status: string) => slots.filter(slot => slot.status === status).length;
      return { lotId: lot.id, name: lot.name, address: lot.address, totalCapacity: slots.length,
        availableCount: count("AVAILABLE"), occupiedCount: count("OCCUPIED"), reservedCount: count("HELD"),
        maintenanceCount: count("MAINTENANCE"), disabledCount: count("DISABLED"), isActive: true };
    }));
  },
  async getParkingLotLevels(lotId: string): Promise<{
    levels: Array<{ levelId: string; levelCode: string; levelName: string; totalSlots: number; availableSlots: number }>;
    slots: ParkingSlotDetail[];
  }> {
    const rows = await operations.slots(lotId);
    const levels = [...new Set(rows.map(row => row.levelId))].map(id => {
      const items = rows.filter(row => row.levelId === id);
      return { levelId: id, levelCode: items[0].levelName, levelName: items[0].levelName,
        totalSlots: items.length, availableSlots: items.filter(row => row.status === "AVAILABLE").length };
    });
    const slots: ParkingSlotDetail[] = rows.map(row => ({ slotId: row.id, slotCode: row.slotCode,
      levelId: row.levelId, levelName: row.levelName, zoneId: row.zoneId, zoneName: row.zoneName,
      operationalStatus: row.operationalStatus, vehicleType: row.vehicleTypes.includes("CAR") ? "Car" : "Motorcycle",
      slotType: "Standard", status: row.status === "OCCUPIED" ? "Occupied" : row.status === "HELD" ? "Reserved" : row.status === "MAINTENANCE" ? "Maintenance" : row.status === "DISABLED" ? "Disabled" : "Available" }));
    return { levels, slots };
  },
  async updateSlotStatus(lotId: string, slot: ParkingSlotDetail, newStatus: SlotStatus, reason: string): Promise<boolean> {
    const state = newStatus === "Available" ? "ACTIVE" : newStatus === "Maintenance" ? "MAINTENANCE" : newStatus === "Disabled" ? "DISABLED" : null;
    if (!state) throw new Error("Trạng thái có xe/giữ chỗ phải xử lý qua nghiệp vụ vào, ra, đặt chỗ.");
    await operations.changeSlot(lotId, slot.slotId, state, slot.operationalStatus!, reason);
    return true;
  },
  async checkInVehicle(payload: CheckInPayload): Promise<CheckInResult> {
    const { lotId, gateId, licensePlate, qrToken, vehicleType, allowMismatchOverride, overrideReason, evidence, idempotencyKey } = payload;
    const plate = licensePlate?.trim().toUpperCase();
    if (!lotId || !gateId || !plate) throw new Error("Chọn cổng vào và nhập biển số.");
    const mappedType = mapCheckInVehicleType(vehicleType);
    const result = await api.checkIn(
      {
        lotId,
        gateId,
        qrPayload: qrToken,
        detectedPlate: plate,
        vehicleType: mappedType,
        ...(allowMismatchOverride ? { allowMismatchOverride: true, overrideReason, evidence } : {}),
      },
      idempotencyKey ?? crypto.randomUUID(),
    );
    const resolvedType = (result.vehicleType ?? mappedType).toUpperCase();
    return {
      sessionId: result.sessionId,
      bookingId: result.bookingId ?? null,
      slotId: result.slotId,
      slotCode: result.slotCode || result.slotId,
      levelName: "",
      licensePlate: plate,
      vehicleType: resolvedType === "MOTORBIKE" ? "Motorcycle" : resolvedType === "EV" ? "EV" : "Car",
      entryMethod: result.entryMethod ?? (result.bookingId ? "PRE_BOOKING" : "AUTO_SLOT"),
      checkinAt: result.entryAt,
      bookingCode: payload.bookingCode,
      message: "Đã ghi nhận xe vào bãi.",
    };
  },
  async getIncidents(lotId: string): Promise<Incident[]> {
    const response = await api.getIncidents(lotId);
    return response.items.map(mapIncident);
  },
  async createIncident(payload: CreateIncidentPayload, lotId: string): Promise<Incident> {
    return mapIncident(await api.createIncident(lotId, {
      title: payload.title, type: payload.type, severity: payload.severity,
      description: payload.description, detectedAt: payload.detectedAt,
      relatedPlate: payload.relatedLicensePlate, relatedSlotCode: payload.relatedSlotCode,
      relatedGate: payload.relatedGate, relatedSessionId: payload.relatedSessionId,
    }, payload.idempotencyKey ?? crypto.randomUUID()));
  },
  async updateIncidentStatus(incidentId: string, status: "InProgress" | "Resolved" | "Escalated", notes: string | undefined, lotId: string, expectedVersion: number): Promise<Incident> {
    return mapIncident(await api.updateIncidentStatus(lotId, incidentId, { status, notes, expectedVersion }));
  },
  async confirmCashPayment(bookingId: string, reason?: string, version?: number): Promise<CashConfirmationResult> {
    return api.confirmCashPayment(bookingId, reason, version);
  },
  async scanLicensePlate(
    file: File,
    gateId: string,
    direction: "IN" | "OUT" = "IN",
    parkingLotId?: string
  ): Promise<PlateRecognitionResult> {
    return api.scanLicensePlate(file, gateId, direction, parkingLotId);
  },
  async getPaymentReceipt(paymentId: string): Promise<PaymentReceiptDto> {
    return api.getPaymentReceipt(paymentId);
  },
};
