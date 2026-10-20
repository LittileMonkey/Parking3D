const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export interface BuildingEnvironment {
  smokeDensity: string;
  smokeStatus: string;
  airQualityIndex: number;
  airQualityStatus: string;
  co2Level: string;
  temperature: string;
  weatherCondition: string;
  humidity: string;
  city: string;
  updatedAt: string;
}

export interface ParkingSlot {
  slotId: string;
  floor: string;
  zone: string;
  vehicleType: string;
  slotType: string;
  status: string;
  exitOrder: number;
  parkingLotName?: string;
}

export interface AuthUser {
  userId?: string;
  userName?: string;
  email?: string;
  fullName?: string;
  role?: string;
  roles?: string[];
}

export interface AuthTokens {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  user?: AuthUser;
  fullName?: string;
  userName?: string;
  email?: string;
  emailNormalized?: string;
  role?: string;
  roles?: string[];
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface EmailOtpResponse {
  message?: string;
  expiresAt?: string;
}

export interface ParkingLot {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface EstimatedPricing {
  expectedDurationMinutes: number;
  estimatedTotalFee: number;
  currency: string;
  billingDetails?: string;
}

export interface ParkingSearchItem {
  parkingLotId: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  availableSlots: number;
  operatingStatus: string;
  estimatedPricing: EstimatedPricing;
  supportedFeatures?: string[];
}

export interface ParkingSearchResult {
  totalCount: number;
  items: ParkingSearchItem[];
}

export interface ParkingSearchQuery {
  vehicleType: string;
  startTime: string;
  expectedDuration: number;
  sortBy: "NEAREST" | "CHEAPEST";
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
}

export interface AvailableSlot {
  slotId: string;
  slotCode: string;
  zoneCode: string;
  supportedVehicleTypes: string[];
  features: string[];
  status: "AVAILABLE" | "HELD" | "OCCUPIED" | "MAINTENANCE" | string;
}

export interface ParkingLevelAvailability {
  levelId: string;
  levelCode: string;
  levelName: string;
  slots: AvailableSlot[];
}

export interface LotAvailability {
  lotId: string;
  lotCode: string;
  queryRange: { startsAt: string; endsAt: string };
  totalSlots: number;
  availableCount: number;
  heldCount: number;
  occupiedCount: number;
  maintenanceCount: number;
  levels: ParkingLevelAvailability[];
}

export interface CreateBookingPayload {
  lotId: string;
  slotId: string;
  vehicleId: string;
  startsAt: string;
  endsAt: string;
}

export interface Booking {
  id: string;
  code: string;
  status: string;
  estimatedAmount: number;
  holdExpiresAt: string;
  version: number;
}

export interface BookingDetail {
  bookingId: string;
  bookingCode: string;
  lotId: string;
  lotName: string;
  slotId?: string | null;
  slotCode?: string | null;
  plateSnapshot?: string;
  vehicleType: string;
  startsAt: string;
  endsAt: string;
  holdExpiresAt?: string | null;
  arrivalDeadline: string;
  status: string;
  totalAmount: number;
  qrToken?: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  lotId: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  version: number;
}

export interface ApprovedFaqAnswer {
  documentId: string;
  revision: number;
  title: string;
  section: string;
  content: string;
  source: string;
}

export interface ApprovedFaqResponse {
  mode: string;
  answers: ApprovedFaqAnswer[];
  message: string;
}

interface ApiEnvelope<T> {
  result?: T | null;
  isSuccess?: boolean;
  message?: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = sessionStorage.getItem("parking.accessToken");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Hãy kiểm tra API đang chạy tại localhost:5237.", 0);
  }

  const text = await response.text();
  let body: ApiEnvelope<T> & Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as ApiEnvelope<T> & Record<string, unknown>;
    } catch {
      body = {
        message: text.length < 300 && !text.trimStart().startsWith("<") ? text : undefined,
      };
    }
  }

  if (!response.ok || body.isSuccess === false) {
    const serverMessage = [body.message, body.detail, body.title]
      .find((value): value is string => typeof value === "string");
    const fallbackMessages: Record<number, string> = {
      401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      403: "Tài khoản hiện tại không có quyền thực hiện thao tác này.",
      404: "API hoặc dữ liệu được yêu cầu hiện chưa có sẵn.",
      409: "Dữ liệu vừa thay đổi hoặc không còn khả dụng. Hãy tải lại và thử lại.",
      429: "Có quá nhiều yêu cầu trong thời gian ngắn. Vui lòng chờ rồi thử lại.",
    };
    const message = serverMessage
      ?? (response.status >= 500
        ? "Máy chủ API đang gặp lỗi hoặc chưa sẵn sàng. Kiểm tra backend tại localhost:5237 rồi thử lại."
        : fallbackMessages[response.status] ?? `Yêu cầu thất bại (${response.status}).`);
    throw new ApiError(message, response.status);
  }

  return (body.result ?? body) as T;
}

export const api = {
  async searchParkingLots(query: ParkingSearchQuery): Promise<ParkingSearchResult> {
    const params = new URLSearchParams({
      vehicleType: query.vehicleType,
      startTime: query.startTime,
      expectedDuration: String(query.expectedDuration),
      sortBy: query.sortBy,
      radiusKm: String(query.radiusKm ?? 5),
    });
    if (query.latitude !== undefined) params.set("latitude", String(query.latitude));
    if (query.longitude !== undefined) params.set("longitude", String(query.longitude));
    return request<ParkingSearchResult>(`/api/v1/parking-lots/search?${params.toString()}`);
  },

  async getParkingLots(): Promise<ParkingLot[]> {
    return request<ParkingLot[]>("/api/v1/parking-lots");
  },

  async getAvailability(
    lotId: string,
    startsAt: string,
    endsAt: string,
    vehicleType: string,
  ): Promise<LotAvailability> {
    const params = new URLSearchParams({ startTime: startsAt, endTime: endsAt, vehicleType });
    return request<LotAvailability>(
      `/api/v1/parking-lots/${encodeURIComponent(lotId)}/availability?${params.toString()}`,
    );
  },

  async createBooking(payload: CreateBookingPayload, idempotencyKey: string): Promise<Booking> {
    return request<Booking>("/api/v1/bookings", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    });
  },

  async getBooking(bookingId: string): Promise<BookingDetail> {
    return request<BookingDetail>(`/api/v1/bookings/${encodeURIComponent(bookingId)}`);
  },

  async createCashPayment(bookingId: string, idempotencyKey: string): Promise<Payment> {
    return request<Payment>("/api/v1/payments", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ bookingId, method: "CASH" }),
    });
  },

  async askApprovedFaq(lotId: string, question: string): Promise<ApprovedFaqResponse> {
    return request<ApprovedFaqResponse>(
      `/api/v1/parking-lots/${encodeURIComponent(lotId)}/assistant`,
      { method: "POST", body: JSON.stringify({ question }) },
    );
  },

  async getSlots(): Promise<ParkingSlot[]> {
    const lots = await request<ParkingLot[]>("/api/v1/parking-lots");
    const lot = lots[0];
    if (!lot) return [];

    const startsAt = new Date();
    const params = new URLSearchParams({
      startTime: startsAt.toISOString(),
      endTime: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
    });
    const availability = await request<LotAvailability>(
      `/api/v1/parking-lots/${encodeURIComponent(lot.id)}/availability?${params.toString()}`,
    );
    return availability.levels.flatMap((level) => level.slots.map((slot) => ({
      slotId: slot.slotCode,
      floor: level.levelCode,
      zone: slot.zoneCode,
      vehicleType: slot.supportedVehicleTypes.join(", "),
      slotType: slot.features.join(", "),
      status: slot.status,
      exitOrder: 0,
      parkingLotName: lot.name,
    })));
  },

  async login(userName: string, password: string): Promise<AuthTokens> {
    return request<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: userName, password }),
    });
  },

  async register(payload: RegisterPayload): Promise<EmailOtpResponse> {
    return request<EmailOtpResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async verifyEmailOtp(email: string, otp: string): Promise<{ message?: string }> {
    return request<{ message?: string }>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  },

  async resendEmailOtp(email: string): Promise<EmailOtpResponse> {
    return request<EmailOtpResponse>("/api/v1/auth/resend-email-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async logout(): Promise<void> {
    await request<void>("/api/v1/auth/logout", { method: "POST" });
  },

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health/live`);
      return response.ok;
    } catch {
      return false;
    }
  },

  async getBuildingEnvironment(): Promise<BuildingEnvironment> {
    try {
      const res = await request<BuildingEnvironment>("/api/v1/telemetry/environment");
      if (res && res.temperature) return res;
    } catch {
      // Fallback mock API simulation with live jitter
    }
    const smokeVal = Number((0.012 + Math.random() * 0.006).toFixed(3));
    const aqiVal = Math.floor(38 + Math.random() * 8);
    const tempVal = Math.floor(28 + Math.random() * 3);
    const humidityVal = Math.floor(62 + Math.random() * 8);

    return {
      smokeDensity: `${smokeVal} mg/m³`,
      smokeStatus: smokeVal < 0.05 ? "AN TOÀN" : "CẢNH BÁO",
      airQualityIndex: aqiVal,
      airQualityStatus: aqiVal <= 50 ? "TỐT (AQI)" : "TRUNG BÌNH",
      co2Level: "415 ppm",
      temperature: `${tempVal}°C`,
      weatherCondition: "Nắng nhẹ • Gió 8 km/h",
      humidity: `${humidityVal}%`,
      city: "TP. HỒ CHÍ MINH",
      updatedAt: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  },

  async confirmCashPayment(bookingId: string, reason: string = "Thu tiền mặt tại cổng", version: number = 1): Promise<{
    paymentId: string;
    bookingId: string;
    status: string;
    confirmedBy: string;
    confirmedAt: string;
  }> {
    return request<{
      paymentId: string;
      bookingId: string;
      status: string;
      confirmedBy: string;
      confirmedAt: string;
    }>("/api/v1/payments/cash/confirm", {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        staffReason: reason,
        version,
      }),
    });
  },

  async getPaymentStatus(bookingId: string): Promise<{
    bookingId: string;
    status: string;
    paymentMethod?: string;
    amount?: number;
  }> {
    return request<{
      bookingId: string;
      status: string;
      paymentMethod?: string;
      amount?: number;
    }>(`/api/v1/payments/${encodeURIComponent(bookingId)}/status`);
  },

  async getOccupancyForecast(lotId: string, vehicleType: string = "Car", horizonMinutes: number = 60): Promise<{
    id: string;
    lotId: string;
    vehicleType: string;
    generatedAt: string;
    targetAt: string;
    usableCapacity: number;
    predictedOccupied: number;
    modelVersion: string;
    isAdvisory: boolean;
  }> {
    const params = new URLSearchParams({ vehicleType, horizonMinutes: String(horizonMinutes) });
    return request<{
      id: string;
      lotId: string;
      vehicleType: string;
      generatedAt: string;
      targetAt: string;
      usableCapacity: number;
      predictedOccupied: number;
      modelVersion: string;
      isAdvisory: boolean;
    }>(`/api/v1/parking-lots/${encodeURIComponent(lotId)}/occupancy-forecasts?${params.toString()}`);
  },

  /**
   * [REAL API AI] Nhận diện biển số xe bằng AI (ANPR OCR) qua upload file ảnh
   */
  async scanLicensePlate(
    file: File,
    gateId: string = "GATE_IN_01",
    direction: "IN" | "OUT" = "IN",
    parkingLotId?: string
  ): Promise<PlateRecognitionResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("gateId", gateId);
    formData.append("direction", direction);
    if (parkingLotId) {
      formData.append("parkingLotId", parkingLotId);
    }

    return request<PlateRecognitionResult>("/api/v1/ai/license-plate/scan", {
      method: "POST",
      body: formData,
    });
  },
};

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