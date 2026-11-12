import { request } from './api';
export interface BlockPricing {
  blockMinutes: number; rateVnd: number; dailyCapVnd: number; multiplier: number;
  peakStart: string | null; peakEnd: string | null;
}
export interface PricingVersion {
  id: string; lotId: string; vehicleType: string; version: number; name: string; status: string;
  effectiveFrom: string; effectiveUntil?: string; createdBy: string; createdAt: string; rules: BlockPricing;
}
export interface OperationalSlot {
  id: string; lotId: string; slotCode: string; levelId: string; levelName: string; zoneId: string; zoneName: string;
  status: string; operationalStatus: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED'; vehicleTypes: string[];
}
export interface OperationAudit {
  id: string; timestampUtc: string; operatorId?: string; operatorRole: string; actionType: string;
  targetEntity: string; justificationNote?: string;
}
export interface UsageReport { lotId: string; capacity: number; occupied: number; entries: number; exits: number; averageDurationMinutes: number; carEntries: number; motorbikeEntries: number }
export interface RevenueReport { lotId: string; currency: string; gross: number; cash: number; digital: number; transactions: number; refunds: number; net: number }
function route(lot: string) {
  if (!lot || lot === 'all') throw new Error('Hãy chọn một bãi cụ thể.');
  return `/api/v1/parking-lots/${encodeURIComponent(lot)}`;
}
export const operations = {
  reservations: (lot: string) => request<{ bookingId: string; code: string; version: number; vehicleType: string; slotId: string; slotCode: string; startsAt: string; endsAt: string; status: string }[]>(`${route(lot)}/active-reservations`),
  reallocate: (lot: string, booking: string, targetSlotId: string, expectedVersion: number, reason: string) => request(`${route(lot)}/bookings/${encodeURIComponent(booking)}/reallocate`, { method: 'POST', body: JSON.stringify({ targetSlotId, expectedVersion, reason }) }),
  cancellations: (lot: string) => request<{ bookingId: string; bookingCode: string; requestedAt: string; reason: string; refundEligible: boolean; refundStatus: string; recordedPaidAmount: number }[]>(`${route(lot)}/booking-cancellations`),
  shifts: (lot: string) => request<{ id: string; lotId: string; staffUserId: string; startedAt: string }[]>(`${route(lot)}/staff-shifts`),
  startShift: (lot: string) => request<{ id: string }>(`${route(lot)}/staff-shifts`, { method: 'POST' }),
  summary: (lot: string, from: string, until: string) => request<UsageReport>(`${route(lot)}/operations-summary?${new URLSearchParams({ from, until })}`),
  usage: (lot: string, from: string, until: string) => request<UsageReport>(`${route(lot)}/usage-report?${new URLSearchParams({ from, until })}`),
  revenue: (lot: string, from: string, until: string) => request<RevenueReport>(`/api/v1/payments/reports/${encodeURIComponent(lot)}?${new URLSearchParams({ from, until })}`),
  pricing: (lot: string, type: string) => request<PricingVersion[]>(`${route(lot)}/pricing-plans?vehicleType=${encodeURIComponent(type)}`),
  publish: (lot: string, body: { vehicleType: string; name: string; expectedVersion: number; rules: BlockPricing; reason: string }) =>
    request<PricingVersion[]>(`${route(lot)}/pricing-plans`, { method: 'POST', body: JSON.stringify(body) }),
  slots: (lot: string) => request<OperationalSlot[]>(`${route(lot)}/operational-slots`),
  changeSlot: (lot: string, slot: string, status: string, expectedStatus: string, reason: string) =>
    request(`${route(lot)}/slots/${encodeURIComponent(slot)}/operation`, { method: 'PATCH', body: JSON.stringify({ status, expectedStatus, reason }) }),
  audit: (lot: string, from: string, until: string) => request<OperationAudit[]>(`${route(lot)}/audit-logs?${new URLSearchParams({ from, until })}`),
};
