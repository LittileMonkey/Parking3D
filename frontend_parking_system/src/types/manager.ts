// ─── ParkMatrix Manager Dashboard Types ─────────────────────────────────────
// Baseline V4 Multi-Parking Platform (Manager Scope)

export type ReportingPeriod = "today" | "week" | "month" | "year";

export interface ManagerFacilitySummary {
  lotId: string;
  code: string;
  name: string;
  address: string;
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  heldCount: number;
  maintenanceCount: number;
  occupancyRate: number;
  todayRevenue: number;
  todayEntries: number;
  todayExits: number;
  operatingStatus: "Active" | "NearCapacity" | "Maintenance" | "Offline";
  lastUpdated: string;
}

export interface ManagerKpiData {
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  maintenanceCount: number;
  capacityTrend: string;

  occupancyRate: number;
  occupancyRateChange: number; // e.g. +4.2% vs previous period
  peakHour: string;
  peakRate: number;

  todayRevenue: number;
  todayRevenueChange: number; // e.g. +8.5%
  cashRevenue: number;
  digitalRevenue: number;
  dailyRevenueTarget: number;
  targetProgressPercent: number;

  parkedVehicles: number;
  todayEntries: number;
  todayExits: number;
  evVehiclesCount: number;
  motorcycleCount: number;
  carCount: number;
}

export interface OccupancyTimePoint {
  timeLabel: string;
  hour: number;
  occupied: number;
  available: number;
  capacity: number;
  carOccupied: number;
  motoOccupied: number;
  evOccupied: number;
}

export interface RevenueTimePoint {
  timeLabel: string;
  totalRevenue: number;
  cashAmount: number;
  digitalAmount: number;
  transactionCount: number;
}

export interface ManagerActivityEvent {
  id: string;
  type: "entry" | "exit" | "payment" | "reservation" | "incident" | "staff" | "gate";
  title: string;
  description: string;
  licensePlate?: string;
  amount?: number;
  slotCode?: string;
  lotName: string;
  timestamp: string;
  status: "success" | "pending" | "warning" | "error";
}

export interface ManagerOperationalAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  lotId: string;
  lotName: string;
  category: "capacity" | "incident" | "payment" | "session" | "hardware";
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
  isResolved?: boolean;
}

export interface StaffShiftRosterItem {
  id: string;
  staffName: string;
  staffCode: string;
  role: "Trưởng ca" | "Nhân viên cổng" | "Kỹ thuật bãi" | "Điều phối 3D";
  lotName: string;
  shiftName: "Ca Sáng (06:00 - 14:00)" | "Ca Chiều (14:00 - 22:00)" | "Ca Đêm (22:00 - 06:00)";
  status: "OnDuty" | "Break" | "Scheduled" | "Completed";
  avatarUrl?: string;
}

export interface ManagerDashboardData {
  facility: ManagerFacilitySummary;
  allFacilities: ManagerFacilitySummary[];
  kpi: ManagerKpiData;
  occupancyTrend: OccupancyTimePoint[];
  revenueTrend: RevenueTimePoint[];
  recentActivities: ManagerActivityEvent[];
  alerts: ManagerOperationalAlert[];
  staffRoster: StaffShiftRosterItem[];
  generatedAt: string;
}

// ─── Standard C# ApiResponse<T> Envelope ─────────────────────────────────────
export interface ApiResponse<T> {
  result: T;
  isSuccess: boolean;
  statusCode: number;
  message: string;
}

// ─── 1. Pricing & Policy Management Types ─────────────────────────────────────
export type PricingPlanStatus = "Active" | "Draft" | "Archived";
export type VehicleCategory = "Car" | "Motorcycle" | "EV" | "Truck";

export interface PricingRuleConfig {
  hourlyRate: number;
  billingUnitMinutes: number; // default 15
  dailyCap: number;
  peakMultiplier: number; // e.g. 1.2
  peakHoursStart: string; // "07:00"
  peakHoursEnd: string; // "19:00"
  freeGracePeriodMinutes: number; // e.g. 15 mins
  overnightSurcharge: number;
}

export interface PricingPlan {
  id: string;
  parkingLotId: string;
  name: string;
  version: string;
  status: PricingPlanStatus;
  vehicleCategory: VehicleCategory;
  effectiveFrom: string;
  effectiveTo?: string;
  rules: PricingRuleConfig;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface PricingPlanHistoryItem {
  id: string;
  planId: string;
  version: string;
  status: PricingPlanStatus;
  effectiveDate: string;
  changedBy: string;
  changeSummary: string;
  hourlyRate: number;
  dailyCap: number;
  peakMultiplier: number;
}

// ─── 2. Facility Layout & Slot Control Types ──────────────────────────────────
export type SlotStatus = "Available" | "Occupied" | "Reserved" | "Maintenance" | "Disabled";

export interface SlotControlItem {
  id: string;
  parkingLotId: string;
  slotCode: string; // e.g. "B1-A01"
  levelId: string; // "B1" | "B2" | "B3"
  levelName: string; // "Tầng hầm B1"
  zoneId: string; // "zone-a" | "zone-vip" | "zone-ev" | "zone-moto"
  zoneName: string; // "Khu A - Tiêu Chuẩn" | "Khu VIP" | "Trạm sạc EV" | "Khu Xe Máy"
  status: SlotStatus;
  vehicleType: VehicleCategory;
  currentPlate?: string;
  parkedSince?: string;
  sensorStatus: "Online" | "Offline" | "Degraded";
  overrideReason?: string;
  lastOverriddenBy?: string;
  lastOverriddenAt?: string;
}

export interface LevelSummary {
  levelId: string;
  levelName: string;
  totalSlots: number;
  occupiedSlots: number;
  availableSlots: number;
  maintenanceSlots: number;
  occupancyRate: number;
}

// ─── 3. Staff & Shift Reconciliation Types ────────────────────────────────────
export type StaffGateAssignment =
  | "Cổng Vào A1 (Barrier Tự Động)"
  | "Cổng Vào A2 (Làn Xe Máy)"
  | "Cổng Ra B1 (Thu Phí Tiền Mặt)"
  | "Cổng Ra B2 (Thu Phí VietQR/Số)"
  | "Tuần Tra An Ninh & Kỹ Thuật";

export interface OnDutyStaff {
  id: string;
  staffName: string;
  staffCode: string;
  role: string;
  assignedGate: StaffGateAssignment;
  shiftType: "Morning" | "Afternoon" | "Night";
  shiftHours: string;
  checkInTime: string;
  status: "Active" | "Break" | "HandoverPending";
  avatarInitials: string;
  phone: string;
}

export interface CashReconciliationRecord {
  id: string;
  parkingLotId: string;
  shiftId: string;
  gateName: string;
  cashierName: string;
  cashierCode: string;
  shiftType: "Morning" | "Afternoon" | "Night";
  shiftDate: string;
  expectedCash: number;
  actualCash: number;
  difference: number;
  digitalPaymentsTotal: number;
  totalTransactions: number;
  matchStatus: "Matched 100%" | "Mismatch Deficit" | "Mismatch Surplus";
  approvalStatus: "Pending" | "Approved" | "Flagged";
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ─── 4. Incident & Exception Approvals Types ──────────────────────────────────
export type ExceptionType = "Refund" | "PlateMismatch" | "EmergencyBarrierOpen" | "LostTicket";

export interface ExceptionRequest {
  id: string;
  parkingLotId: string;
  exceptionType: ExceptionType;
  title: string;
  description: string;
  requesterStaffName: string;
  requesterStaffCode: string;
  gateOrLocation: string;
  licensePlate?: string;
  detectedPlate?: string; // for plate mismatch
  requestedAmount?: number;
  evidenceImageUrl?: string;
  severity: "High" | "Medium" | "Low";
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
}

// ─── 5. Reports & Audit Log Types ─────────────────────────────────────────────
export type AuditActionType =
  | "PRICE_UPDATE"
  | "SLOT_OVERRIDE"
  | "SHIFT_APPROVAL"
  | "BARRIER_OVERRIDE"
  | "REFUND_APPROVED"
  | "DISCREPANCY_FLAGGED"
  | "MAINTENANCE_TOGGLE";

export interface AuditLogEntry {
  id: string;
  parkingLotId: string;
  timestampUtc: string;
  operatorName: string;
  operatorRole: string;
  actionType: AuditActionType;
  targetEntity: string;
  justificationNote: string;
  ipAddress: string;
  status: "SUCCESS" | "WARNING" | "CRITICAL";
}

export interface ReportExportRequest {
  reportType: "daily_revenue" | "weekly_traffic" | "cash_reconciliation" | "audit_trail";
  format: "pdf" | "excel" | "csv";
  dateRange: "today" | "week" | "month";
  parkingLotId: string;
}

