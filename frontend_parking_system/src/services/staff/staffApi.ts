// ─── Staff Operations API Service ──────────────────────────────────────────
// Baseline V4 Multi-Parking Platform
// [REAL] Tích hợp các endpoints thực tế: /api/v1/parking-lots, /api/v1/parking-lots/{id}/availability
// [LOCAL / MOCK ADAPTER] Quản lý lưu trữ trạng thái phiên xe, ca trực, sự cố tại chỗ với localStorage

import { api, type ParkingLot, type LotAvailability, type PaymentReceiptDto, type BookingDetailDto } from "../api";
import type {
  ParkingLotSummary,
  ParkingSlotDetail,
  ParkingSession,
  CheckInPayload,
  CheckInResult,
  CheckOutFeeInfo,
  CheckOutPayload,
  Incident,
  CreateIncidentPayload,
  ShiftInfo,
  HandoverPayload,
  ActivityEvent,
  OperationalAlert,
  DashboardOverview,
  SlotStatus,
  CashConfirmationResult,
  PaymentStatusResult,
  OccupancyForecastResult,
  PlateRecognitionResult,
} from "../../types/staff";

// Storage keys for persisting local operational staff data
const STORAGE_PREFIX = "parking3d_staff_";
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;
const INCIDENTS_KEY = `${STORAGE_PREFIX}incidents`;
const SHIFTS_KEY = `${STORAGE_PREFIX}current_shift`;
const EVENTS_KEY = `${STORAGE_PREFIX}events`;
const ALERTS_KEY = `${STORAGE_PREFIX}alerts`;
const OVERRIDE_SLOTS_KEY = `${STORAGE_PREFIX}override_slots`;

// Helper: Local Storage fallback
function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Could not save to localStorage", err);
  }
}

// Initial mock sessions if empty
function initializeDefaultData(lotId: string) {
  const existingSessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
  if (existingSessions.length === 0) {
    const now = Date.now();
    const defaults: ParkingSession[] = [
      {
        sessionId: "SES-20261013-001",
        slotCode: "B1-A01",
        slotId: "slot-b1-a01",
        levelName: "Tầng Hầm B1",
        zoneName: "Khu A - Ô tô",
        licensePlate: "51K-892.45",
        vehicleType: "Car",
        checkinAt: new Date(now - 3 * 3600 * 1000).toISOString(),
        durationMinutes: 180,
        status: "Active",
        paymentStatus: "Unpaid",
        estimatedFee: 45000,
        bookingCode: "BK-261013-091A",
        gateIn: "Cổng Vào G1",
      },
      {
        sessionId: "SES-20261013-002",
        slotCode: "B1-A05",
        slotId: "slot-b1-a05",
        levelName: "Tầng Hầm B1",
        zoneName: "Khu A - Ô tô",
        licensePlate: "29A-667.12",
        vehicleType: "Car",
        checkinAt: new Date(now - 1.5 * 3600 * 1000).toISOString(),
        durationMinutes: 90,
        status: "Active",
        paymentStatus: "Unpaid",
        estimatedFee: 30000,
        bookingCode: "BK-261013-088B",
        gateIn: "Cổng Vào G1",
      },
      {
        sessionId: "SES-20261013-003",
        slotCode: "B1-B03",
        slotId: "slot-b1-b03",
        levelName: "Tầng Hầm B1",
        zoneName: "Khu B - Xe máy",
        licensePlate: "59V2-345.89",
        vehicleType: "Motorcycle",
        checkinAt: new Date(now - 45 * 60 * 1000).toISOString(),
        durationMinutes: 45,
        status: "Active",
        paymentStatus: "Unpaid",
        estimatedFee: 10000,
        gateIn: "Cổng Vào G2",
      },
      {
        sessionId: "SES-20261013-004",
        slotCode: "B2-EV01",
        slotId: "slot-b2-ev01",
        levelName: "Tầng Hầm B2",
        zoneName: "Khu EV - Trụ sạc",
        licensePlate: "30H-998.77",
        vehicleType: "EV",
        checkinAt: new Date(now - 4 * 3600 * 1000).toISOString(),
        durationMinutes: 240,
        status: "Active",
        paymentStatus: "Unpaid",
        estimatedFee: 85000,
        gateIn: "Cổng Vào G1",
      },
      {
        sessionId: "SES-20261013-005",
        slotCode: "B1-A09",
        slotId: "slot-b1-a09",
        levelName: "Tầng Hầm B1",
        zoneName: "Khu A - Ô tô",
        licensePlate: "60A-112.33",
        vehicleType: "Car",
        checkinAt: new Date(now - 5 * 3600 * 1000).toISOString(),
        checkoutAt: new Date(now - 30 * 60 * 1000).toISOString(),
        durationMinutes: 270,
        status: "Completed",
        paymentStatus: "Paid",
        estimatedFee: 65000,
        gateIn: "Cổng Vào G1",
        gateOut: "Cổng Ra G3",
      },
    ];
    setStored(SESSIONS_KEY, defaults);
  }

  const existingIncidents = getStored<Incident[]>(INCIDENTS_KEY, []);
  if (existingIncidents.length === 0) {
    const defaults: Incident[] = [
      {
        incidentId: "INC-2026-001",
        title: "Barrier Cổng Vào G1 kẹt cảm biến an toàn",
        type: "Thiết bị cổng",
        severity: "Medium",
        status: "InProgress",
        description: "Cần gạt barrier không tự hạ sau khi xe 51K-892.45 đi qua. Đang dùng điều khiển tay.",
        relatedGate: "Cổng Vào G1",
        reportedBy: "Nguyễn Văn Hùng",
        assignedTo: "Kỹ thuật trực ca",
        detectedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        notes: "Đang chờ kỹ thuật viên kiểm tra motor giảm tốc.",
      },
      {
        incidentId: "INC-2026-002",
        title: "Xe đỗ lấn vạch ô B1-A12",
        type: "Sai quy định",
        severity: "Low",
        status: "Open",
        description: "Xe biển 51F-123.45 đỗ lệch 30cm làm ảnh hưởng ô bên cạnh.",
        relatedSlotCode: "B1-A12",
        relatedLicensePlate: "51F-123.45",
        reportedBy: "Nguyễn Văn Hùng",
        detectedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      },
    ];
    setStored(INCIDENTS_KEY, defaults);
  }

  const existingShift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
  if (!existingShift) {
    const defaultShift: ShiftInfo = {
      shiftId: `SHF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-01`,
      staffId: "STF-091",
      staffName: "Nguyễn Văn Hùng",
      lotId: lotId,
      lotName: "Bãi đỗ xe Trung tâm Quận 1",
      startTime: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
      status: "Active",
      totalEntries: 42,
      totalExits: 28,
      totalIncidents: 2,
      unresolvedIncidents: 2,
    };
    setStored(SHIFTS_KEY, defaultShift);
  }

  const existingAlerts = getStored<OperationalAlert[]>(ALERTS_KEY, []);
  if (existingAlerts.length === 0) {
    const defaults: OperationalAlert[] = [
      {
        alertId: "ALT-01",
        type: "Capacity",
        severity: "Warning",
        message: "Khu vực sạc xe điện Tầng B2 đạt 80% công suất.",
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        resolved: false,
      },
      {
        alertId: "ALT-02",
        type: "Equipment",
        severity: "Critical",
        message: "Cảm biến camera ANPR Cổng Vào G1 độ phản hồi chậm > 3s.",
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        resolved: false,
      },
    ];
    setStored(ALERTS_KEY, defaults);
  }

  const existingEvents = getStored<ActivityEvent[]>(EVENTS_KEY, []);
  if (existingEvents.length === 0) {
    const defaults: ActivityEvent[] = [
      {
        eventId: "EVT-01",
        type: "CheckIn",
        label: "Xe 51K-892.45 check-in thành công qua cổng G1",
        sessionId: "SES-20261013-001",
        relatedCode: "B1-A01",
        performedBy: "Nguyễn Văn Hùng",
        occurredAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        status: "Success",
      },
      {
        eventId: "EVT-02",
        type: "CheckOut",
        label: "Xe 60A-112.33 thanh toán tiền mặt 65.000đ & rời bãi",
        sessionId: "SES-20261013-005",
        relatedCode: "B1-A09",
        performedBy: "Nguyễn Văn Hùng",
        occurredAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: "Success",
      },
    ];
    setStored(EVENTS_KEY, defaults);
  }
}

export const staffApi = {
  /**
   * [REAL API] Lấy danh sách bãi đỗ xe thuộc phạm vi quản lý từ backend
   */
  async getParkingLots(): Promise<ParkingLotSummary[]> {
    try {
      // 1. Thử lấy danh sách bãi được phân công cho Staff/Manager (Facility-Scoped RBAC)
      let assignedLotIds: string[] = [];
      try {
        const assignments = await api.getStaffAssignmentsMe();
        if (assignments && assignments.length > 0) {
          assignedLotIds = assignments.map((a) => a.lotId);
        }
      } catch {
        // Nếu chưa đăng nhập hoặc token không có quyền staff-assignment, tiếp tục lấy tất cả bãi
      }

      const lots: ParkingLot[] = await api.getParkingLots();
      if (lots && lots.length > 0) {
        const filteredLots = assignedLotIds.length > 0
          ? lots.filter((l) => assignedLotIds.includes(l.id))
          : lots;

        const resultLots = filteredLots.length > 0 ? filteredLots : lots;
        initializeDefaultData(resultLots[0].id);

        return resultLots.map((l) => ({
          lotId: l.id,
          name: l.name,
          address: l.address,
          totalCapacity: 120, // Baseline V4 chuẩn
          availableCount: 45,
          occupiedCount: 68,
          reservedCount: 4,
          maintenanceCount: 3,
          disabledCount: 0,
          isActive: true,
        }));
      }
    } catch (err) {
      console.warn("Backend API not reachable, using baseline multi-parking fallback:", err);
    }

    // Fallback chuẩn nếu backend chưa chạy
    const fallbackLots: ParkingLotSummary[] = [
      {
        lotId: "b1e2a3c4-5678-90ab-cdef-111122223333",
        name: "Bãi đỗ xe Trung tâm Quận 1 (LOT-Q1-01)",
        address: "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
        totalCapacity: 150,
        availableCount: 52,
        occupiedCount: 88,
        reservedCount: 7,
        maintenanceCount: 3,
        disabledCount: 0,
        isActive: true,
      },
      {
        lotId: "c2f3b4d5-6789-01bc-def0-222233334444",
        name: "Bãi đỗ xe Bitexco Financial (LOT-Q1-02)",
        address: "02 Hải Triều, Phường Bến Nghé, Quận 1, TP.HCM",
        totalCapacity: 200,
        availableCount: 74,
        occupiedCount: 115,
        reservedCount: 8,
        maintenanceCount: 3,
        disabledCount: 0,
        isActive: true,
      },
    ];
    initializeDefaultData(fallbackLots[0].lotId);
    return fallbackLots;
  },

  /**
   * [REAL API + LOCAL] Lấy số liệu tổng quan ca trực và vận hành
   */
  async getDashboardOverview(lotId: string): Promise<DashboardOverview> {
    initializeDefaultData(lotId);
    const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
    const activeSessions = sessions.filter((s) => s.status === "Active");
    const incidents = getStored<Incident[]>(INCIDENTS_KEY, []);
    const openIncidents = incidents.filter((i) => i.status === "Open" || i.status === "InProgress");
    const shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);

    // Tính toán từ real sessions
    const totalCapacity = 150;
    const occupiedCount = activeSessions.length + 65; // Kết hợp với các xe khác
    const availableCount = Math.max(0, totalCapacity - occupiedCount - 5);

    return {
      totalCapacity,
      occupiedCount,
      availableCount,
      maintenanceCount: 3,
      disabledCount: 2,
      totalVehiclesInLot: occupiedCount,
      openIncidents: openIncidents.length,
      shiftStatus: shift?.status ?? "Active",
      todayEntries: shift?.totalEntries ?? 42,
      todayExits: shift?.totalExits ?? 28,
      pendingCheckouts: activeSessions.length,
      pendingVerifications: 2,
    };
  },

  /**
   * [REAL API + FALLBACK] Lấy thông tin mặt bằng đỗ xe theo tầng
   */
  async getParkingLotLevels(lotId: string): Promise<{
    levels: Array<{ levelId: string; levelCode: string; levelName: string; totalSlots: number; availableSlots: number }>;
    slots: ParkingSlotDetail[];
  }> {
    initializeDefaultData(lotId);
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 3600 * 1000);
      const availability: LotAvailability = await api.getAvailability(
        lotId,
        now.toISOString(),
        oneHourLater.toISOString(),
        "Car",
      );

      if (availability && availability.levels) {
        const levels = availability.levels.map((lvl) => ({
          levelId: lvl.levelId,
          levelCode: lvl.levelCode,
          levelName: `Tầng ${lvl.levelCode}`,
          totalSlots: lvl.slots.length,
          availableSlots: lvl.slots.filter((s) => s.status === "AVAILABLE").length,
        }));

        const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
        const activeBySlot = new Map(sessions.filter((s) => s.status === "Active").map((s) => [s.slotCode, s]));
        const overrides = getStored<Record<string, SlotStatus>>(OVERRIDE_SLOTS_KEY, {});

        const slots: ParkingSlotDetail[] = availability.levels.flatMap((lvl) =>
          lvl.slots.map((s) => {
            const activeSession = activeBySlot.get(s.slotCode);
            let finalStatus: SlotStatus = s.status as SlotStatus;
            if (overrides[s.slotCode]) {
              finalStatus = overrides[s.slotCode];
            } else if (activeSession) {
              finalStatus = "Occupied";
            }

            return {
              slotId: s.slotCode,
              slotCode: s.slotCode,
              levelId: lvl.levelId,
              levelName: `Tầng ${lvl.levelCode}`,
              zoneName: s.zoneCode,
              vehicleType: (s.supportedVehicleTypes?.[0] as any) ?? "Car",
              slotType: s.features?.join(", ") || "Standard",
              status: finalStatus,
              features: s.features,
              currentSessionId: activeSession?.sessionId,
              lastUpdatedAt: new Date().toISOString(),
            };
          }),
        );

        return { levels, slots };
      }
    } catch (err) {
      console.warn("Could not load availability from API, using realistic fallback:", err);
    }

    // Generated realistic slot layout for levels B1, B2
    const levels = [
      { levelId: "lvl-b1", levelCode: "B1", levelName: "Tầng Hầm B1 (Khu A & B)", totalSlots: 40, availableSlots: 16 },
      { levelId: "lvl-b2", levelCode: "B2", levelName: "Tầng Hầm B2 (Khu EV & Xe lớn)", totalSlots: 30, availableSlots: 12 },
    ];

    const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
    const activeBySlot = new Map(sessions.filter((s) => s.status === "Active").map((s) => [s.slotCode, s]));
    const overrides = getStored<Record<string, SlotStatus>>(OVERRIDE_SLOTS_KEY, {});

    const mockSlots: ParkingSlotDetail[] = [];

    // Tầng B1 slots (A01 - A20, B01 - B20)
    for (let i = 1; i <= 20; i++) {
      const code = `B1-A${i < 10 ? "0" + i : i}`;
      const active = activeBySlot.get(code);
      let status: SlotStatus = i % 3 === 0 ? "Occupied" : i === 7 ? "Reserved" : i === 13 ? "Maintenance" : "Available";
      if (active) status = "Occupied";
      if (overrides[code]) status = overrides[code];

      mockSlots.push({
        slotId: `slot-${code.toLowerCase()}`,
        slotCode: code,
        levelId: "lvl-b1",
        levelName: "Tầng Hầm B1",
        zoneName: "Khu A - Ô tô",
        vehicleType: "Car",
        slotType: "Standard",
        status,
        features: ["COVERED", "CCTV"],
        currentSessionId: active?.sessionId,
        lastUpdatedAt: new Date().toISOString(),
      });
    }

    for (let i = 1; i <= 20; i++) {
      const code = `B1-B${i < 10 ? "0" + i : i}`;
      const active = activeBySlot.get(code);
      let status: SlotStatus = i % 2 === 0 ? "Occupied" : i === 15 ? "Maintenance" : "Available";
      if (active) status = "Occupied";
      if (overrides[code]) status = overrides[code];

      mockSlots.push({
        slotId: `slot-${code.toLowerCase()}`,
        slotCode: code,
        levelId: "lvl-b1",
        levelName: "Tầng Hầm B1",
        zoneName: "Khu B - Xe máy",
        vehicleType: "Motorcycle",
        slotType: "Compact",
        status,
        features: ["COVERED"],
        currentSessionId: active?.sessionId,
        lastUpdatedAt: new Date().toISOString(),
      });
    }

    // Tầng B2 slots (EV01 - EV10, C01 - C20)
    for (let i = 1; i <= 10; i++) {
      const code = `B2-EV${i < 10 ? "0" + i : i}`;
      const active = activeBySlot.get(code);
      let status: SlotStatus = i === 1 || i === 4 ? "Occupied" : i === 6 ? "Reserved" : "Available";
      if (active) status = "Occupied";
      if (overrides[code]) status = overrides[code];

      mockSlots.push({
        slotId: `slot-${code.toLowerCase()}`,
        slotCode: code,
        levelId: "lvl-b2",
        levelName: "Tầng Hầm B2",
        zoneName: "Khu EV - Trụ sạc điện",
        vehicleType: "EV",
        slotType: "EV_FastCharge",
        status,
        features: ["EV_CHARGING", "COVERED", "FAST_CHARGE"],
        currentSessionId: active?.sessionId,
        lastUpdatedAt: new Date().toISOString(),
      });
    }

    return { levels, slots: mockSlots };
  },

  /**
   * Cập nhật trạng thái Slot thủ công từ Staff (Bảo trì, Khóa khẩn cấp, Giải phóng)
   */
  async updateSlotStatus(slotCode: string, newStatus: SlotStatus, reason?: string): Promise<boolean> {
    const overrides = getStored<Record<string, SlotStatus>>(OVERRIDE_SLOTS_KEY, {});
    overrides[slotCode] = newStatus;
    setStored(OVERRIDE_SLOTS_KEY, overrides);

    // Ghi nhật ký event
    const events = getStored<ActivityEvent[]>(EVENTS_KEY, []);
    events.unshift({
      eventId: `EVT-${Date.now()}`,
      type: "Manual",
      label: `Nhân viên đổi trạng thái ô ${slotCode} thành [${newStatus}]${reason ? ` - Lý do: ${reason}` : ""}`,
      relatedCode: slotCode,
      performedBy: "Nguyễn Văn Hùng",
      occurredAt: new Date().toISOString(),
      status: "Success",
    });
    setStored(EVENTS_KEY, events.slice(0, 50));
    return true;
  },

  /**
   * Lấy danh sách lượt xe (Sessions) gần đây kèm bộ lọc
   */
  async getSessions(options?: { status?: string; query?: string }): Promise<ParkingSession[]> {
    const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
    let filtered = sessions;

    if (options?.status && options.status !== "All") {
      filtered = filtered.filter((s) => s.status.toLowerCase() === options.status?.toLowerCase());
    }

    if (options?.query) {
      const q = options.query.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          s.licensePlate.toLowerCase().includes(q) ||
          s.slotCode.toLowerCase().includes(q) ||
          (s.bookingCode && s.bookingCode.toLowerCase().includes(q)),
      );
    }

    return filtered;
  },

  /**
   * [CHECK-IN WORKFLOW] Tiếp nhận xe vào bãi
   * Hỗ trợ: Mã đặt chỗ QR, biển số xe, quét camera ANPR
   */
  async checkInVehicle(payload: CheckInPayload): Promise<CheckInResult> {
    const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
    const plate = (payload.licensePlate || "51H-" + Math.floor(100 + Math.random() * 899) + "." + Math.floor(10 + Math.random() * 89)).toUpperCase();
    const isCar = !plate.includes("V") && !plate.includes("M");

    // Chọn slot trống tự động nếu không chỉ định
    let slotCode = isCar ? `B1-A${Math.floor(1 + Math.random() * 18)}` : `B1-B${Math.floor(1 + Math.random() * 18)}`;
    let sessionId = `SES-${Date.now()}`;
    let slotId = `slot-${slotCode.toLowerCase()}`;
    let entryAt = new Date().toISOString();

    // [REAL API CHECK-IN] Gọi API Backend nếu có đủ thông tin
    const lotId = payload.lotId || "b1e2a3c4-5678-90ab-cdef-111122223333";
    const gateId = payload.gateId || "00000000-0000-0000-0000-000000000001";
    const qrPayload = payload.qrToken || payload.bookingCode || "SAMPLE_QR";
    const idempotencyKey = crypto.randomUUID();

    try {
      const realCheckIn = await api.checkIn(
        {
          lotId,
          gateId,
          qrPayload,
          detectedPlate: plate,
        },
        idempotencyKey
      );
      if (realCheckIn && realCheckIn.sessionId) {
        sessionId = realCheckIn.sessionId;
        slotId = realCheckIn.slotId;
        slotCode = realCheckIn.slotId.substring(0, 8);
        entryAt = realCheckIn.entryAt;
      }
    } catch (err) {
      console.warn("Backend real check-in failed, proceeding with operational fallback:", err);
    }

    const newSession: ParkingSession = {
      sessionId,
      slotCode,
      slotId,
      levelName: "Tầng Hầm B1",
      zoneName: isCar ? "Khu A - Ô tô" : "Khu B - Xe máy",
      licensePlate: plate,
      vehicleType: isCar ? "Car" : "Motorcycle",
      checkinAt: entryAt,
      durationMinutes: 0,
      status: "Active",
      paymentStatus: "Unpaid",
      estimatedFee: isCar ? 15000 : 5000,
      bookingCode: payload.bookingCode,
      gateIn: payload.gateId || "Cổng Vào G1",
    };

    sessions.unshift(newSession);
    setStored(SESSIONS_KEY, sessions);

    // Cập nhật thống kê ca
    const shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
    if (shift) {
      shift.totalEntries += 1;
      setStored(SHIFTS_KEY, shift);
    }

    // Ghi nhận sự kiện
    const events = getStored<ActivityEvent[]>(EVENTS_KEY, []);
    events.unshift({
      eventId: `EVT-${Date.now()}`,
      type: "CheckIn",
      label: `Xe ${plate} check-in thành công tại ${newSession.gateIn} -> Vị trí ${slotCode}`,
      sessionId: newSession.sessionId,
      relatedCode: slotCode,
      performedBy: "Nguyễn Văn Hùng",
      occurredAt: new Date().toISOString(),
      status: "Success",
    });
    setStored(EVENTS_KEY, events.slice(0, 50));

    return {
      sessionId: newSession.sessionId,
      slotCode,
      slotId: newSession.slotId,
      levelName: newSession.levelName,
      licensePlate: plate,
      vehicleType: newSession.vehicleType,
      checkinAt: newSession.checkinAt,
      bookingCode: payload.bookingCode,
      message: "Check-in thành công! Barrier đã mở.",
    };
  },

  /**
   * Tính toán phí gửi xe trước khi Check-Out
   */
  async calculateCheckOutFee(query: string, parkingLotId?: string): Promise<CheckOutFeeInfo | null> {
    const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
    const cleanQ = query.toUpperCase().trim();

    const session = sessions.find(
      (s) =>
        s.status === "Active" &&
        (s.licensePlate.replace(/[^A-Z0-9]/g, "") === cleanQ.replace(/[^A-Z0-9]/g, "") ||
          s.sessionId === query ||
          s.bookingCode === query),
    );

    if (!session) {
      try {
        const realBooking = await api.getBookingDetail(query);
        if (realBooking) {
          const isCar = realBooking.vehicleType.toUpperCase() === "CAR";
          const checkinTime = new Date(realBooking.startsAt).getTime();
          const now = Date.now();
          const durationMinutes = Math.max(15, Math.round((now - checkinTime) / 60000));
          let fee = Number(realBooking.estimatedAmount) || (isCar ? 25000 : 10000);
          let planName = isCar ? "Ô tô tiêu chuẩn" : "Xe máy lượt ngày";
          try {
            const realFee = await api.calculateFee({
              parkingLotId: realBooking.lotId,
              entryTime: realBooking.startsAt,
              exitTime: new Date().toISOString(),
              vehicleType: isCar ? "CAR" : "MOTORCYCLE",
              isGoldStarMember: false,
            });
            if (realFee && typeof realFee.finalNetAmountVnd === "number") {
              fee = realFee.finalNetAmountVnd;
              planName = `Biểu phí động Baseline V4 (${realFee.totalBillableBlocks} block)`;
            }
          } catch {
            // keep default
          }
          return {
            sessionId: `SES-${realBooking.bookingCode}`,
            licensePlate: realBooking.plateSnapshot,
            slotCode: realBooking.slotCode || "Chờ xếp",
            checkinAt: realBooking.startsAt,
            durationMinutes,
            estimatedFee: fee,
            currency: "VND",
            pricingPlanName: planName,
            paymentStatus: realBooking.status === "CONFIRMED" ? "Paid" : "Unpaid",
            bookingId: realBooking.bookingId,
            bookingCode: realBooking.bookingCode,
          };
        }
      } catch (err) {
        console.warn("Backend getBookingDetail lookup fallback:", err);
      }
      return null;
    }

    const checkinTime = new Date(session.checkinAt).getTime();
    const now = Date.now();
    const durationMinutes = Math.max(15, Math.round((now - checkinTime) / 60000));

    // Biểu giá mặc định: Ô tô 15.000đ/block 60p, Xe máy 5.000đ/lượt
    const isCar = session.vehicleType === "Car" || session.vehicleType === "EV";
    const hours = Math.ceil(durationMinutes / 60);
    let fee = isCar ? Math.max(15000, hours * 15000) : 5000;
    let planName = isCar ? "Ô tô tiêu chuẩn (Block 1h)" : "Xe máy lượt ngày";

    // [REAL API CALCULATE-FEE] Gọi Payment Service backend để tính phí chuẩn xác theo Block 15p, Giờ cao điểm và Trần ngày
    const lotId = parkingLotId || "b1e2a3c4-5678-90ab-cdef-111122223333";
    try {
      const realFee = await api.calculateFee({
        parkingLotId: lotId,
        entryTime: session.checkinAt,
        exitTime: new Date().toISOString(),
        vehicleType: isCar ? "CAR" : "MOTORCYCLE",
        isGoldStarMember: false,
      });
      if (realFee && typeof realFee.finalNetAmountVnd === "number") {
        fee = realFee.finalNetAmountVnd;
        planName = `Biểu phí động Baseline V4 (${realFee.totalBillableBlocks} block)`;
      }
    } catch (err) {
      console.warn("Could not calculate fee via backend Payment API, using local fallback:", err);
    }

    return {
      sessionId: session.sessionId,
      licensePlate: session.licensePlate,
      slotCode: session.slotCode,
      checkinAt: session.checkinAt,
      durationMinutes,
      estimatedFee: fee,
      currency: "VND",
      pricingPlanName: planName,
      paymentStatus: session.paymentStatus,
      bookingId: session.bookingCode,
    };
  },

  /**
   * [CHECK-OUT WORKFLOW] Xử lý xe ra & Thu tiền
   */
  async checkOutVehicle(payload: CheckOutPayload): Promise<{ success: boolean; message: string; receiptNumber: string; paymentId?: string }> {
    const sessions = getStored<ParkingSession[]>(SESSIONS_KEY, []);
    const index = sessions.findIndex((s) => s.sessionId === payload.sessionId);
    if (index === -1) {
      throw new Error("Không tìm thấy phiên đỗ xe tương ứng.");
    }

    const session = sessions[index];
    session.status = "Completed";
    session.checkoutAt = new Date().toISOString();
    session.paymentStatus = "Paid";
    session.gateOut = payload.gateId || "Cổng Ra G3";
    sessions[index] = session;
    setStored(SESSIONS_KEY, sessions);

    // Giải phóng slot override nếu có
    const overrides = getStored<Record<string, SlotStatus>>(OVERRIDE_SLOTS_KEY, {});
    delete overrides[session.slotCode];
    setStored(OVERRIDE_SLOTS_KEY, overrides);

    // Cập nhật thống kê ca
    const shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
    if (shift) {
      shift.totalExits += 1;
      setStored(SHIFTS_KEY, shift);
    }

    const receiptNumber = `REC-${Date.now().toString().slice(-8)}`;

    // Ghi nhận sự kiện
    const events = getStored<ActivityEvent[]>(EVENTS_KEY, []);
    events.unshift({
      eventId: `EVT-${Date.now()}`,
      type: "CheckOut",
      label: `Xe ${session.licensePlate} hoàn tất check-out tại ${session.gateOut} - Thu phí: ${session.estimatedFee?.toLocaleString("vi-VN")}đ (${payload.paymentMethod || "Tiền mặt"})`,
      sessionId: session.sessionId,
      relatedCode: session.slotCode,
      performedBy: "Nguyễn Văn Hùng",
      occurredAt: new Date().toISOString(),
      status: "Success",
    });
    setStored(EVENTS_KEY, events.slice(0, 50));

    return {
      success: true,
      message: "Check-out hoàn tất. Barrier đã mở cho xe xuất bến.",
      receiptNumber,
      paymentId: payload.paymentId,
    };
  },

  /**
   * Danh sách sự cố & Ngoại lệ
   */
  async getIncidents(): Promise<Incident[]> {
    return getStored<Incident[]>(INCIDENTS_KEY, []);
  },

  /**
   * Tạo báo cáo sự cố mới
   */
  async createIncident(payload: CreateIncidentPayload): Promise<Incident> {
    const incidents = getStored<Incident[]>(INCIDENTS_KEY, []);
    const newInc: Incident = {
      incidentId: `INC-2026-${String(incidents.length + 1).padStart(3, "0")}`,
      title: payload.title,
      type: payload.type,
      severity: payload.severity,
      status: "Open",
      description: payload.description,
      relatedLicensePlate: payload.relatedLicensePlate,
      relatedSessionId: payload.relatedSessionId,
      relatedSlotCode: payload.relatedSlotCode,
      relatedGate: payload.relatedGate,
      reportedBy: "Nguyễn Văn Hùng",
      detectedAt: payload.detectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    incidents.unshift(newInc);
    setStored(INCIDENTS_KEY, incidents);

    // Cập nhật thống kê ca
    const shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
    if (shift) {
      shift.totalIncidents += 1;
      shift.unresolvedIncidents += 1;
      setStored(SHIFTS_KEY, shift);
    }

    return newInc;
  },

  /**
   * Cập nhật trạng thái sự cố (Tiếp nhận / Giải quyết)
   */
  async updateIncidentStatus(incidentId: string, status: "InProgress" | "Resolved" | "Escalated", notes?: string): Promise<Incident> {
    const incidents = getStored<Incident[]>(INCIDENTS_KEY, []);
    const index = incidents.findIndex((i) => i.incidentId === incidentId);
    if (index === -1) throw new Error("Không tìm thấy sự cố");

    incidents[index].status = status;
    incidents[index].updatedAt = new Date().toISOString();
    if (status === "Resolved") {
      incidents[index].resolvedAt = new Date().toISOString();
    }
    if (notes) {
      incidents[index].notes = (incidents[index].notes ? incidents[index].notes + " | " : "") + notes;
    }
    setStored(INCIDENTS_KEY, incidents);

    const shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
    if (shift && status === "Resolved" && shift.unresolvedIncidents > 0) {
      shift.unresolvedIncidents -= 1;
      setStored(SHIFTS_KEY, shift);
    }

    return incidents[index];
  },

  /**
   * Lấy thông tin ca trực hiện tại
   */
  async getCurrentShift(lotId: string): Promise<ShiftInfo> {
    initializeDefaultData(lotId);
    let shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
    if (!shift) {
      shift = {
        shiftId: `SHF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-01`,
        staffId: "STF-091",
        staffName: "Nguyễn Văn Hùng",
        lotId,
        lotName: "Bãi đỗ xe Trung tâm Quận 1",
        startTime: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
        status: "Active",
        totalEntries: 42,
        totalExits: 28,
        totalIncidents: 2,
        unresolvedIncidents: 1,
      };
      setStored(SHIFTS_KEY, shift);
    }
    return shift;
  },

  /**
   * Bàn giao ca trực
   */
  async submitHandover(payload: HandoverPayload): Promise<boolean> {
    const shift = getStored<ShiftInfo | null>(SHIFTS_KEY, null);
    if (shift) {
      shift.status = "Handover";
      shift.endTime = new Date().toISOString();
      shift.handoverNote = `${payload.completedTasks}\nChưa xử lý: ${payload.unresolvedIssues}\nLưu ý: ${payload.notesForNext}`;
      shift.handoveredTo = payload.handoverToStaffId || "Lê Thị Mai (STF-092)";
      setStored(SHIFTS_KEY, shift);
    }

    // Ghi nhật ký sự kiện
    const events = getStored<ActivityEvent[]>(EVENTS_KEY, []);
    events.unshift({
      eventId: `EVT-${Date.now()}`,
      type: "Handover",
      label: `Bàn giao ca thành công cho nhân viên ${payload.handoverToStaffId || "Lê Thị Mai (STF-092)"}`,
      performedBy: "Nguyễn Văn Hùng",
      occurredAt: new Date().toISOString(),
      status: "Success",
    });
    setStored(EVENTS_KEY, events.slice(0, 50));
    return true;
  },

  /**
   * Lấy danh sách thông báo vận hành & Hoạt động gần đây
   */
  async getOperationalAlerts(): Promise<OperationalAlert[]> {
    return getStored<OperationalAlert[]>(ALERTS_KEY, []);
  },

  async getActivityEvents(): Promise<ActivityEvent[]> {
    return getStored<ActivityEvent[]>(EVENTS_KEY, []);
  },

  /**
   * [REAL API S2-06] Nhân viên xác nhận thu tiền mặt cho lượt đặt chỗ
   */
  async confirmCashPayment(bookingId: string, reason?: string, version?: number): Promise<CashConfirmationResult> {
    try {
      const res = await api.confirmCashPayment(bookingId, reason, version);
      return res;
    } catch (err: any) {
      console.warn("Backend confirmCashPayment call fallback to local state:", err);
      return {
        paymentId: `PAY-${Date.now().toString().slice(-6)}`,
        bookingId,
        status: "COMPLETED",
        confirmedBy: "Nguyễn Văn Hùng",
        confirmedAt: new Date().toISOString(),
      };
    }
  },

  /**
   * [REAL API S2-06] Tra cứu trạng thái thanh toán theo Booking ID
   */
  async getPaymentStatus(bookingId: string): Promise<PaymentStatusResult | null> {
    try {
      const res = await api.getPaymentStatus(bookingId);
      return res;
    } catch (err: any) {
      console.warn("Backend getPaymentStatus call fallback:", err);
      return null;
    }
  },

  /**
   * [REAL API AI] Dự báo tỷ lệ lấp đầy trong 30/60/120 phút tới bằng AI
   */
  async getOccupancyForecast(lotId: string, vehicleType: string = "Car", horizonMinutes: number = 60): Promise<OccupancyForecastResult | null> {
    try {
      const res = await api.getOccupancyForecast(lotId, vehicleType, horizonMinutes);
      return res;
    } catch (err: any) {
      console.warn("AI Occupancy forecast not yet available or insufficient snapshot:", err);
      return null;
    }
  },

  /**
   * [REAL API AI ANPR OCR] Quét và nhận diện biển số xe bằng AI từ file ảnh tải lên
   * Tự động fallback giả lập an toàn nếu Backend (localhost:5237) chưa khởi động
   */
  async scanLicensePlate(
    file: File,
    gateId: string = "GATE_IN_01",
    direction: "IN" | "OUT" = "IN",
    parkingLotId?: string
  ): Promise<PlateRecognitionResult> {
    try {
      return await api.scanLicensePlate(file, gateId, direction, parkingLotId);
    } catch (err: any) {
      console.warn("Backend API tại localhost:5237 chưa kết nối được, tự động chuyển sang cơ chế giả lập ANPR cục bộ:", err);

      // Phân loại xe theo tên file hoặc cổng quét
      const fileNameLower = file.name.toLowerCase();
      const isMotoFile = fileNameLower.includes("moto") || fileNameLower.includes("bike") || fileNameLower.includes("xe_may") || gateId.includes("G2");

      const carPlates = ["51K - 892.45", "30H - 998.77", "43A - 123.45", "60A - 112.33", "51H - 776.89"];
      const motoPlates = ["59-P1 982.14", "29-B1 678.90", "59-V2 345.89", "72-C1 567.89"];

      const chosenPlate = isMotoFile
        ? motoPlates[Math.floor(Math.random() * motoPlates.length)]
        : carPlates[Math.floor(Math.random() * carPlates.length)];

      return {
        recognitionId: "mock-" + Date.now(),
        displayPlate: chosenPlate,
        plateNumber: chosenPlate.replace(/[^A-Z0-9]/g, ""),
        confidence: 0.985,
        plateType: isMotoFile ? "TwoLine" : "OneLine",
        status: "HighConfidence",
        vehicleTypeSuggestion: isMotoFile ? "Motorcycle" : "Car",
        processingTimeMs: 45,
        isFallback: true,
      };
    }
  },

  /**
   * [REAL API AI] Nhân viên soát xét và cập nhật biển số xe OCR thủ công
   */
  async reviewPlateRecognition(
    lotId: string,
    recognitionId: string,
    correctedPlate: string,
    reviewNotes?: string
  ): Promise<{ id: string; status: string }> {
    return api.reviewPlateRecognition(lotId, recognitionId, correctedPlate, reviewNotes);
  },

  /**
   * [REAL API PAYMENT] Tra cứu biên lai điện tử (E-Receipt) kèm mã xác thực số (SCRUM-72)
   */
  async getPaymentReceipt(paymentId: string): Promise<PaymentReceiptDto> {
    return api.getPaymentReceipt(paymentId);
  },

  /**
   * [REAL API PARKING] Tra cứu chi tiết đơn đặt chỗ từ Backend (Facility RBAC Lookup)
   */
  async getBookingDetail(bookingId: string): Promise<BookingDetailDto | null> {
    try {
      return await api.getBookingDetail(bookingId);
    } catch (err) {
      console.warn("Backend getBookingDetail failed:", err);
      return null;
    }
  },
};


