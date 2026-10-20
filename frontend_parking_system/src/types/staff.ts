// ─── Staff Portal Domain Types ───────────────────────────────────────────────
// Dựa trên Baseline V4 schema & API design

export type SlotStatus = "Available" | "Occupied" | "Reserved" | "Maintenance" | "Disabled";
export type VehicleType = "Car" | "Motorcycle" | "Truck" | "EV" | "Bicycle";
export type IncidentStatus = "Open" | "InProgress" | "Resolved" | "Escalated";
export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";
export type PaymentStatus = "Unpaid" | "Paid" | "Pending" | "Waived";
export type SessionStatus = "Active" | "Completed" | "Expired" | "Cancelled";
export type ShiftStatus = "Active" | "Completed" | "Handover";

export interface ParkingLotSummary {
  lotId: string;
  name: string;
  address: string;
  totalCapacity: number;
  availableCount: number;
  occupiedCount: number;
  reservedCount: number;
  maintenanceCount: number;
  disabledCount: number;
  isActive: boolean;
}

export interface ParkingLevel {
  levelId: string;
  lotId: string;
  levelName: string;
  levelOrder: number;
  totalSlots: number;
  availableSlots: number;
}

export interface ParkingSlotDetail {
  slotId: string;
  slotCode: string;
  levelId: string;
  levelName: string;
  zoneId?: string;
  zoneName?: string;
  vehicleType: VehicleType;
  slotType: string;
  status: SlotStatus;
  features?: string[];
  currentSessionId?: string;
  lastUpdatedAt?: string;
}

export interface ParkingSession {
  sessionId: string;
  slotCode: string;
  slotId: string;
  levelName: string;
  zoneName?: string;
  licensePlate: string;
  vehicleType: VehicleType;
  checkinAt: string;
  checkoutAt?: string;
  durationMinutes: number;
  status: SessionStatus;
  paymentStatus: PaymentStatus;
  estimatedFee?: number;
  bookingCode?: string;
  gateIn?: string;
  gateOut?: string;
}

export interface CheckInPayload {
  bookingCode?: string;
  licensePlate?: string;
  qrCode?: string;
  gateId?: string;
}

export interface CheckInResult {
  sessionId: string;
  slotCode: string;
  slotId: string;
  levelName: string;
  licensePlate: string;
  vehicleType: VehicleType;
  checkinAt: string;
  bookingCode?: string;
  message?: string;
}

export interface CheckOutFeeInfo {
  sessionId: string;
  licensePlate: string;
  slotCode: string;
  checkinAt: string;
  durationMinutes: number;
  estimatedFee: number;
  currency: string;
  pricingPlanName: string;
  paymentStatus: PaymentStatus;
  bookingId?: string;
  bookingCode?: string;
}

export interface CheckOutPayload {
  sessionId: string;
  paymentMethod?: "Cash" | "Card" | "Wallet";
  gateId?: string;
}

export interface Incident {
  incidentId: string;
  title: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  relatedLicensePlate?: string;
  relatedSessionId?: string;
  relatedSlotCode?: string;
  relatedGate?: string;
  reportedBy: string;
  assignedTo?: string;
  detectedAt: string;
  resolvedAt?: string;
  notes?: string;
  updatedAt: string;
}

export interface IncidentLog {
  logId: string;
  incidentId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  notes?: string;
}

export interface CreateIncidentPayload {
  title: string;
  type: string;
  severity: IncidentSeverity;
  description: string;
  relatedLicensePlate?: string;
  relatedSessionId?: string;
  relatedSlotCode?: string;
  relatedGate?: string;
  detectedAt: string;
}

export interface ShiftInfo {
  shiftId: string;
  staffId: string;
  staffName: string;
  lotId: string;
  lotName: string;
  startTime: string;
  endTime?: string;
  status: ShiftStatus;
  totalEntries: number;
  totalExits: number;
  totalIncidents: number;
  unresolvedIncidents: number;
  handoverNote?: string;
  handoveredTo?: string;
}

export interface HandoverPayload {
  completedTasks: string;
  unresolvedIssues: string;
  pendingTransactions: string;
  equipmentStatus?: string;
  notesForNext: string;
  handoverToStaffId?: string;
  confirmed: boolean;
}

export interface ActivityEvent {
  eventId: string;
  type: "CheckIn" | "CheckOut" | "Incident" | "Handover" | "Manual";
  label: string;
  sessionId?: string;
  incidentId?: string;
  relatedCode?: string;
  performedBy: string;
  occurredAt: string;
  status: "Success" | "Failed" | "Pending";
}

export interface OperationalAlert {
  alertId: string;
  type: "Capacity" | "Equipment" | "Incident" | "Shift" | "Transaction";
  severity: "Info" | "Warning" | "Critical";
  message: string;
  createdAt: string;
  resolved: boolean;
}

export interface DashboardOverview {
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  maintenanceCount: number;
  disabledCount: number;
  totalVehiclesInLot: number;
  openIncidents: number;
  shiftStatus: ShiftStatus | null;
  todayEntries: number;
  todayExits: number;
  pendingCheckouts: number;
  pendingVerifications: number;
}

export interface CashConfirmationResult {
  paymentId: string;
  bookingId: string;
  status: string;
  confirmedBy: string;
  confirmedAt: string;
}

export interface PaymentStatusResult {
  bookingId: string;
  status: string;
  paymentMethod?: string;
  amount?: number;
}

export interface OccupancyForecastResult {
  id: string;
  lotId: string;
  vehicleType: string;
  generatedAt: string;
  targetAt: string;
  usableCapacity: number;
  predictedOccupied: number;
  modelVersion: string;
  isAdvisory: boolean;
}

export interface PlateRecognitionResult {
  recognitionId?: string;
  displayPlate: string;
  plateNumber: string;
  normalizedPlate?: string;
  rawPlate?: string;
  confidence: number;
  plateType?: string;
  croppedPlateBase64?: string;
  status?: string | number;
  vehicleTypeSuggestion?: string | number;
  processingTimeMs?: number;
  isFallback?: boolean;
}

