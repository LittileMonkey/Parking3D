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
