import type { BookingDetail, BookingPaymentStatus, BookingQrResponse, LotAvailability, ParkingSearchResult, PaymentReceiptDto } from "../services/api";

// Development-only visual fixtures, loaded explicitly by ?preview=1.
// These identifiers and estimates must never be sent to a booking API.
const sampleLots = [
  { id: "preview-central", code: "MAU-01", name: "Bãi mẫu · Trung tâm", levels: ["B1", "B2", "G"], hourlyRate: 10000, features: ["COVERED", "CCTV", "EV_CHARGING"] },
  { id: "preview-riverside", code: "MAU-02", name: "Bãi mẫu · Bờ sông", levels: ["G"], hourlyRate: 15000, features: ["CCTV", "ACCESSIBLE"] },
  { id: "preview-office", code: "MAU-03", name: "Bãi mẫu · Văn phòng", levels: ["L1", "L2"], hourlyRate: 20000, features: ["COVERED", "NEAR_ELEVATOR"] },
];

export function getPreviewSearch(duration: number, vehicleType: string): ParkingSearchResult {
  return {
    totalCount: sampleLots.length,
    items: sampleLots.map(lot => ({
      parkingLotId: lot.id,
      code: lot.code,
      name: lot.name,
      address: "Địa chỉ minh họa · Không phải địa điểm đặt chỗ thực tế",
      latitude: 0,
      longitude: 0,
      distanceKm: 0,
      availableSlots: lot.levels.length * 14,
      operatingStatus: "OPEN",
      estimatedPricing: {
        expectedDurationMinutes: duration,
        estimatedTotalFee: Math.ceil(duration / 60) * lot.hourlyRate * (vehicleType === "Motorbike" ? 0.3 : 1),
        currency: "VND",
        billingDetails: "Giá minh họa để xem bố cục, không phải báo giá. Bảng giá thực tế chỉ có khi kết nối backend.",
      },
      supportedFeatures: lot.features,
    })),
  };
}

export function getPreviewAvailability(lotId: string, startsAt: string, endsAt: string, vehicleType: string): LotAvailability {
  const lot = sampleLots.find(item => item.id === lotId);
  if (!lot) throw new Error("Bãi này không thuộc dữ liệu xem thử. Hãy quay lại chọn một bãi mẫu.");
  return {
    lotId,
    lotCode: lot.code,
    queryRange: { startsAt, endsAt },
    totalSlots: lot.levels.length * 18,
    availableCount: lot.levels.length * 14,
    heldCount: lot.levels.length,
    occupiedCount: lot.levels.length * 2,
    maintenanceCount: lot.levels.length,
    levels: lot.levels.map((code, levelIndex) => ({
      levelId: `${lotId}-${code}`,
      levelCode: code,
      levelName: code === "G" ? "Tầng trệt" : `Tầng ${code}`,
      slots: Array.from({ length: 18 }, (_, index) => ({
        slotId: `${lotId}-${code}-${index + 1}`,
        slotCode: `${String.fromCharCode(65 + levelIndex)}${String(index + 1).padStart(2, "0")}`,
        zoneCode: index < 9 ? "A" : "B",
        supportedVehicleTypes: [vehicleType],
        features: index === 0 ? ["NEAR_ELEVATOR"] : [],
        status: index < 14 ? "AVAILABLE" : index === 14 ? "HELD" : index < 17 ? "OCCUPIED" : "MAINTENANCE",
      })),
    })),
  };
}

export type ConfirmationPreview = { booking: BookingDetail; payment: BookingPaymentStatus; receipt: PaymentReceiptDto | null; qr: BookingQrResponse };

export function getPreviewConfirmation(kind: string, params: URLSearchParams): ConfirmationPreview {
  const durationParam = Number(params.get("duration"));
  const duration = durationParam >= 30 && durationParam <= 1440 ? durationParam : 120;
  const vehicleType = params.get("vehicle") === "Motorbike" ? "Motorbike" : "Car";
  const lot = getPreviewSearch(duration, vehicleType).items.find(item => item.parkingLotId === params.get("lot")) ?? getPreviewSearch(duration, vehicleType).items[0];
  const startsAtParam = Date.parse(params.get("startsAt") ?? "");
  const startsAt = Number.isFinite(startsAtParam) && startsAtParam > Date.now() ? startsAtParam : Date.now() + 30 * 60_000;
  const success = kind === "success" || kind === "cash";
  const paid = success || kind === "processing";
  const amount = lot.estimatedPricing.estimatedTotalFee ?? 20000;
  const booking: BookingDetail = {
    bookingId: "preview", bookingCode: "PM-MAU-0123", lotId: lot.parkingLotId, lotName: lot.name,
    slotCode: params.get("slot") ?? "A01", plateSnapshot: "XE-MAU-001", vehicleType,
    startsAt: new Date(startsAt).toISOString(), endsAt: new Date(startsAt + duration * 60_000).toISOString(),
    arrivalDeadline: new Date(startsAt + 15 * 60_000).toISOString(),
    holdExpiresAt: new Date(Date.now() + (kind === "expired" ? -60_000 : 300_000)).toISOString(),
    status: success ? "CONFIRMED" : kind === "expired" ? "EXPIRED" : "PENDING_PAYMENT",
    estimatedAmount: amount, createdAt: new Date().toISOString(),
  };
  const payment: BookingPaymentStatus = {
    bookingId: "preview", paymentId: "preview-payment", paymentMethod: kind === "cash" ? "CASH" : "VNPAY",
    paymentStatus: paid ? "SUCCESS" : kind === "failed" || kind === "expired" ? "FAILED" : "PENDING",
    bookingStatus: booking.status, sessionStatus: "NOT_CHECKED_IN", totalAmount: amount, currency: "VND", lastUpdatedAt: new Date().toISOString(),
  };
  return {
    booking, payment,
    receipt: paid ? { receiptNumber: "REC-MAU-0123", paymentId: payment.paymentId, bookingId: "preview", lotName: lot.name, plateNumber: "XE-MAU-001", paymentMethod: payment.paymentMethod, totalAmount: amount, currency: "VND", paidAt: new Date().toISOString(), bankTransactionNo: kind === "cash" ? null : "VNPAY-MAU-0123", verificationHash: "preview-only" } : null,
    qr: { bookingId: "preview", qrPayload: "PARKMATRIX-UI-PREVIEW-NOT-VALID-FOR-ENTRY", expiresAt: booking.arrivalDeadline },
  };
}
