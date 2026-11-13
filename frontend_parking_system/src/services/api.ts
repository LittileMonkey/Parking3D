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
  expectedDurationMinutes?: number | null;
  estimatedTotalFee?: number | null;
  currency?: string | null;
  billingDetails?: string;
}

export interface UserVehicle {
  id: string;
  licensePlate: string;
  vehicleType: string;
  isDefault: boolean;
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

export interface ParkingMapObject {
  levelId: string;
  objectType?: string | number;
  refEntityId?: string;
  slotId?: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
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
  mapObjects?: ParkingMapObject[];
}

export interface CreateBookingPayload {
  mode?: "EXACT_SLOT" | "AUTO_SLOT";
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
  estimatedAmount?: number | null;
  qrToken?: string | null;
  createdAt: string;
}

export interface Payment {
  paymentUrl?: string | null;
  id: string;
  lotId: string;
  bookingId: string;
  amount?: number | null;
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
  errorCode?: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const currentRefresh = sessionStorage.getItem("parking.refreshToken");
  if (!currentRefresh) return null;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefresh }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as ApiEnvelope<AuthTokens>;
      const tokens = body.result ?? (body as unknown as AuthTokens);
      const nextAccess = tokens?.accessToken ?? tokens?.token;
      if (!nextAccess) return null;
      sessionStorage.setItem("parking.accessToken", nextAccess);
      if (tokens?.refreshToken) {
        sessionStorage.setItem("parking.refreshToken", tokens.refreshToken);
      }
      return nextAccess;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = async (overrideToken?: string): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const token = overrideToken ?? sessionStorage.getItem("parking.accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    try {
      return await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    } catch {
      throw new ApiError("Không kết nối được máy chủ. Hãy kiểm tra API đang chạy tại localhost:8080.", 0);
    }
  };

  let response = await send();
  const skipRefreshPaths = ["/api/v1/auth/login", "/api/v1/auth/refresh-token", "/api/v1/auth/guest/verify"];
  if (response.status === 401 && !skipRefreshPaths.includes(path)) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      response = await send(refreshed);
    }
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
      401: path === "/api/v1/auth/login" ? "Email hoặc mật khẩu không đúng." : "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      403: "Tài khoản hiện tại không có quyền thực hiện thao tác này.",
      404: "API hoặc dữ liệu được yêu cầu hiện chưa có sẵn.",
      409: "Dữ liệu vừa thay đổi hoặc không còn khả dụng. Hãy tải lại và thử lại.",
      429: "Có quá nhiều yêu cầu trong thời gian ngắn. Vui lòng chờ rồi thử lại.",
    };
    const message = serverMessage
      ?? (response.status >= 500
        ? "Máy chủ API đang gặp lỗi hoặc chưa sẵn sàng. Kiểm tra backend tại localhost:8080 rồi thử lại."
        : fallbackMessages[response.status] ?? `Yêu cầu thất bại (${response.status}).`);
    const errorCode = typeof body.errorCode === "string" ? body.errorCode : null;
    throw new ApiError(message, response.status, errorCode);
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

  async getParkingLotById(lotId: string): Promise<ParkingLotDetail> {
    return request<ParkingLotDetail>(`/api/v1/parking-lots/${encodeURIComponent(lotId)}`);
  },

  async getLotLayout3D(lotId: string): Promise<LotLayout3DDto> {
    return request<LotLayout3DDto>(`/api/v1/parking-lots/${encodeURIComponent(lotId)}/layout`);
  },

  async getEntryGates(lotId: string): Promise<{ id: string; lotId: string; code: string }[]> {
    return request("/api/v1/parking-lots/" + encodeURIComponent(lotId) + "/entry-gates");
  },

  async getExitGates(lotId: string): Promise<{ id: string; lotId: string; code: string }[]> {
    return request("/api/v1/parking-lots/" + encodeURIComponent(lotId) + "/exit-gates");
  },

  async getStaffSessions(lotId: string): Promise<StaffSessionRow[]> {
    return request("/api/v1/parking-lots/" + encodeURIComponent(lotId) + "/sessions");
  },

  async getCheckoutQuote(
    lotId: string,
    gateId: string,
    detectedPlate: string,
    qrPayload?: string,
    sessionId?: string,
  ): Promise<CheckOutQuoteDto> {
    return request<CheckOutQuoteDto>("/api/v1/check-out/quote", {
      method: "POST",
      body: JSON.stringify({
        lotId,
        gateId,
        detectedPlate,
        ...(qrPayload ? { qrPayload } : {}),
        ...(sessionId ? { sessionId } : {}),
      }),
    });
  },

  async prepareCheckoutVnPay(quoteToken: string): Promise<{
    paymentId: string;
    amount: number;
    status: string;
    paymentUrl: string;
  }> {
    return request("/api/v1/payments/checkout/vnpay", {
      method: "POST",
      body: JSON.stringify({ quoteToken }),
    });
  },

  async authorizeCheckout(payload: CheckoutRequest, key: string) {
    return request<{ exitPermitToken: string }>("/api/v1/check-out/authorize-exit", {
      method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(payload),
    });
  },

  async confirmCheckout(payload: CheckoutRequest, exitPermitToken: string, key: string) {
    return request<{ sessionId: string; paymentId?: string }>("/api/v1/check-out", {
      method: "POST", headers: { "Idempotency-Key": key },
      body: JSON.stringify({ ...payload, exitPermitToken, staffObservedExit: true }),
    });
  },

  async getUserVehicles(): Promise<UserVehicle[]> {
    return request<UserVehicle[]>("/api/v1/user-vehicles");
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

  async cancelBooking(id: string, reason: string): Promise<{ refund_eligible: boolean; refund_status: string }> {
    return request('/api/v1/bookings/' + encodeURIComponent(id) + '/cancel', { method: 'POST', body: JSON.stringify({ reason }) });
  },
  async getBookingCancellation(id: string): Promise<{ refund_eligible: boolean; refund_status: string }> {
    return request('/api/v1/bookings/' + encodeURIComponent(id) + '/cancellation');
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

  async getBookingCashRequest(bookingId: string, lotId: string): Promise<Payment> {
    return request("/api/v1/payments/" + encodeURIComponent(bookingId) + "/cash-request?" + new URLSearchParams({ lotId }));
  },

  async confirmBookingCash(payment: Payment, reason: string): Promise<Payment> {
    const { id, lotId, version } = payment;
    return request("/api/v1/parking-lots/" + encodeURIComponent(lotId) + "/payments/" + encodeURIComponent(id) + "/cash-confirmation", {
      method: "POST", body: JSON.stringify({ version, reason }),
    });
  },

  async createCashPayment(bookingId: string, idempotencyKey: string): Promise<Payment> {
    return request<Payment>("/api/v1/payments", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ bookingId, method: "CASH" }),
    });
  },

  async createVnPayPayment(bookingId: string, idempotencyKey: string): Promise<Payment> {
    return request<Payment>("/api/v1/payments", {method:"POST",headers:{"Idempotency-Key":idempotencyKey},body:JSON.stringify({bookingId,method:"VNPAY"})});
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

  async guestLogin(email: string, code: string, mfaCode?: string): Promise<AuthTokens> {
    return request('/api/v1/auth/guest/verify',{method:'POST',body:JSON.stringify({email,code,mfaCode})});
  },
  async login(userName: string, password: string, mfaCode?: string): Promise<AuthTokens> {
    return request<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: userName, password, mfaCode }),
    });
  },

  async loginWithGoogle(idToken: string, mfaCode?: string): Promise<AuthTokens> {
    return request<AuthTokens>("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken, mfaCode }),
    });
  },

  async forgetPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>("/api/v1/auth/forget-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(email: string, otp: string, newPassword: string): Promise<boolean> {
    return request<boolean>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return request<AuthTokens>("/api/v1/auth/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
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
    const refreshToken = sessionStorage.getItem("parking.refreshToken");
    if (refreshToken) await request<void>("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
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
    return request<BuildingEnvironment>("/api/v1/telemetry/environment");
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

  /**
   * [REAL API PAYMENT] Tính toán phí đỗ xe chính xác (Block 15p, cao điểm, trần ngày)
   */
  async calculateFee(payload: CalculateFeeRequest): Promise<CalculateFeeResponse> {
    return request<CalculateFeeResponse>("/api/v1/payments/calculate-fee", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * [REAL API PARKING] Thực hiện Check-In vào bãi xe (Staff Barrier / Camera)
   */
  async checkIn(payload: BackendCheckInPayload, idempotencyKey: string): Promise<BackendCheckInResponse> {
    return request<BackendCheckInResponse>("/api/v1/check-in", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    });
  },

  /**
   * [REAL API PARKING] Upload ảnh chứng cứ PNG/JPEG (tối đa 4 MiB) theo bãi để lấy reference bền vững
   */
  async uploadLotEvidence(
    lotId: string,
    payload: UploadEvidencePayload,
    idempotencyKey: string,
  ): Promise<UploadedEvidenceMetadata> {
    return request<UploadedEvidenceMetadata>(`/api/v1/parking-lots/${encodeURIComponent(lotId)}/evidence`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    });
  },

  /**
   * [REAL API PARKING] Đọc ảnh chứng cứ theo bãi và evidenceId
   */
  async getLotEvidence(lotId: string, evidenceId: string): Promise<RetrievedEvidenceDto> {
    return request<RetrievedEvidenceDto>(
      `/api/v1/parking-lots/${encodeURIComponent(lotId)}/evidence/${encodeURIComponent(evidenceId)}`,
    );
  },

  /**
   * [REAL API PARKING] Phát hành mã QR Check-in bảo mật HMAC sau thanh toán (SCRUM-49)
   */
  async issueBookingQr(bookingId: string): Promise<BookingQrResponse> {
    return request<BookingQrResponse>(`/api/v1/bookings/${encodeURIComponent(bookingId)}/qr`, {
      method: "POST",
    });
  },

  /**
   * [REAL API IDENTITY] Lấy danh sách bãi xe mà nhân viên/quản lý được phân công (Facility RBAC)
   */
  async getStaffAssignmentsMe(): Promise<StaffAssignmentItem[]> {
    return request<StaffAssignmentItem[]>("/api/v1/staff-assignments/me");
  },

  /**
   * [REAL API IDENTITY] Gán nhân viên vào bãi xe (Manager/Admin)
   */
  async assignStaffToLot(payload: { staffUserId: string; lotId: string; roleCode: string; validFrom?: string; validUntil?: string }): Promise<StaffAssignmentItem> {
    return request<StaffAssignmentItem>("/api/v1/staff-assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * [REAL API IDENTITY] Thu hồi quyền nhân viên tại bãi xe (Manager/Admin)
   */
  async revokeStaffAssignment(assignmentId: string): Promise<{ success: boolean; message?: string }> {
    return request<{ success: boolean; message?: string }>(
      `/api/v1/staff-assignments/${encodeURIComponent(assignmentId)}/revoke`,
      { method: "POST" }
    );
  },

  /**
   * [REAL API AI] Soát xét và cập nhật biển số xe OCR thủ công (Staff Review)
   */
  async reviewPlateRecognition(
    lotId: string,
    recognitionId: string,
    correctedPlate: string,
    reviewNotes?: string
  ): Promise<{ id: string; status: string }> {
    return request<{ id: string; status: string }>(
      `/api/v1/parking-lots/${encodeURIComponent(lotId)}/plate-recognitions/${encodeURIComponent(recognitionId)}/review`,
      {
        method: "POST",
        body: JSON.stringify({ correctedPlate, reviewNotes }),
      }
    );
  },

  /**
   * [REAL API PAYMENT] Tra cứu biên lai điện tử (E-Receipt) sau thanh toán (SCRUM-72)
   */
  async getPaymentReceipt(paymentId: string): Promise<PaymentReceiptDto> {
    return request<PaymentReceiptDto>(`/api/v1/payments/${encodeURIComponent(paymentId)}/receipt`);
  },

  /**
   * [REAL API PARKING] Tra cứu chi tiết booking theo mã (SCRUM-48 - Facility RBAC Lookup)
   */
  async getBookingDetail(bookingId: string): Promise<BookingDetailDto> {
    return request<BookingDetailDto>(`/api/v1/bookings/${encodeURIComponent(bookingId)}`);
  },

  /**
   * [REAL API IDENTITY] Lấy thông tin tài khoản hiện tại từ token (GET /api/v1/account/information)
   */
  async getAccountInformation(): Promise<AccountUserDto> {
    return request<AccountUserDto>("/api/v1/account/information");
  },

  /**
   * [REAL API IDENTITY] Lấy danh sách tất cả tài khoản người dùng hệ thống (Admin/Manager)
   */
  async getAllAccounts(): Promise<AccountUserDto[]> {
    return request<AccountUserDto[]>("/api/v1/account");
  },

  /**
   * [REAL API IDENTITY] Tra cứu tài khoản người dùng theo email (Admin/Manager)
   */
  async getAccountByEmail(email: string): Promise<AccountUserDto> {
    return request<AccountUserDto>(`/api/v1/account/by-email?email=${encodeURIComponent(email)}`);
  },

  /**
   * [REAL API IDENTITY] Cập nhật vai trò người dùng (Admin/Manager Role Assignment)
   */
  async updateUserRole(userId: string, roleCode: string): Promise<AccountUserDto> {
    return request<AccountUserDto>("/api/v1/author/update-role", {
      method: "POST",
      body: JSON.stringify({ userId, roleCode }),
    });
  },

  // ─── [SCRUM-99] REAL INCIDENTS & EXCEPTIONS ENDPOINTS ───────────────────────
  async getIncidents(lotId: string, status?: string, severity?: string, query?: string, page = 1, pageSize = 25): Promise<{ items: IncidentSummaryDto[]; totalCount: number }> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status && status !== "All") params.set("status", status);
    if (severity && severity !== "All") params.set("severity", severity);
    if (query) params.set("query", query);
    return request<{ items: IncidentSummaryDto[]; totalCount: number }>(`/api/v1/parking-lots/${lotId}/incidents?${params.toString()}`);
  },

  async getIncidentById(lotId: string, incidentId: string): Promise<IncidentDto> {
    return request<IncidentDto>(`/api/v1/parking-lots/${lotId}/incidents/${incidentId}`);
  },

  async createIncident(lotId: string, payload: CreateIncidentApiPayload, idempotencyKey?: string): Promise<IncidentDto> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return request<IncidentDto>(`/api/v1/parking-lots/${lotId}/incidents`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async updateIncidentStatus(
    lotId: string,
    incidentId: string,
    payload: { status: string; notes?: string; expectedVersion: number },
    idempotencyKey?: string,
  ): Promise<IncidentDto> {
    return request<IncidentDto>(`/api/v1/parking-lots/${lotId}/incidents/${incidentId}/status`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
  },

  async reopenIncident(
    lotId: string,
    incidentId: string,
    payload: { reason: string; expectedVersion: number },
    idempotencyKey?: string,
  ): Promise<IncidentDto> {
    return request<IncidentDto>(`/api/v1/parking-lots/${lotId}/incidents/${incidentId}/reopen`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
  },

  async cancelIncident(
    lotId: string,
    incidentId: string,
    payload: { reason: string; expectedVersion: number },
    idempotencyKey?: string,
  ): Promise<IncidentDto> {
    return request<IncidentDto>(`/api/v1/parking-lots/${lotId}/incidents/${incidentId}/cancel`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
  },

  async createIncidentDecision(
    lotId: string,
    incidentId: string,
    payload: { decision: string; reason: string; evidence: IncidentEvidenceDto[]; expectedVersion: number },
    idempotencyKey?: string,
  ): Promise<IncidentDto> {
    return request<IncidentDto>(`/api/v1/parking-lots/${lotId}/incidents/${incidentId}/decisions`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
  },

  async getIncidentHistory(lotId: string, incidentId: string, page = 1, pageSize = 25): Promise<{ items: IncidentHistoryItemDto[]; totalCount: number }> {
    return request<{ items: IncidentHistoryItemDto[]; totalCount: number }>(`/api/v1/parking-lots/${lotId}/incidents/${incidentId}/history?page=${page}&pageSize=${pageSize}`);
  },

  // ─── [SCRUM-99] REAL SHIFT HANDOVER ENDPOINTS ──────────────────────────────
  async getShiftHandovers(lotId: string, status?: string, page = 1, pageSize = 25): Promise<{ items: ShiftHandoverSummaryDto[]; totalCount: number }> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status && status !== "All") params.set("status", status);
    return request<{ items: ShiftHandoverSummaryDto[]; totalCount: number }>(`/api/v1/parking-lots/${lotId}/shift-handovers?${params.toString()}`);
  },

  async getShiftHandoverById(lotId: string, handoverId: string): Promise<ShiftHandoverDto> {
    return request<ShiftHandoverDto>(`/api/v1/parking-lots/${lotId}/shift-handovers/${handoverId}`);
  },

  async createShiftHandover(lotId: string, payload: CreateShiftHandoverApiPayload, idempotencyKey?: string): Promise<ShiftHandoverDto> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return request<ShiftHandoverDto>(`/api/v1/parking-lots/${lotId}/shift-handovers`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async confirmShiftHandover(lotId: string, handoverId: string, payload: { expectedVersion: number }, idempotencyKey?: string): Promise<ShiftHandoverDto> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return request<ShiftHandoverDto>(`/api/v1/parking-lots/${lotId}/shift-handovers/${handoverId}/confirm`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async reassignShiftHandoverReceiver(
    lotId: string,
    handoverId: string,
    payload: { receiverUserId: string; reason: string; expectedVersion: number },
    idempotencyKey?: string,
  ): Promise<ShiftHandoverDto> {
    return request<ShiftHandoverDto>(`/api/v1/parking-lots/${lotId}/shift-handovers/${handoverId}/receiver`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
  },

  // ─── ACCOUNT, MEMBERSHIP, VEHICLES & CHECKOUT QR ──────────────────────────
  async updateAccountInformation(payload: {
    fullName: string;
    emailNormalized: string;
    phoneE164?: string | null;
  }): Promise<AccountUserDto> {
    return request<AccountUserDto>("/api/v1/account/update-information", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async changePassword(payload: {
    password: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<boolean> {
    return request<boolean>("/api/v1/account/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getMyMembership(): Promise<MembershipDto> {
    return request<MembershipDto>("/api/v1/membership/me");
  },

  async updateUserMembership(userId: string, tierCode: string): Promise<MembershipDto> {
    return request<MembershipDto>(`/api/v1/membership/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify({ tierCode }),
    });
  },

  async getUserVehicleById(vehicleId: string): Promise<UserVehicle> {
    return request<UserVehicle>(`/api/v1/user-vehicles/${encodeURIComponent(vehicleId)}`);
  },

  async updateUserVehicle(
    vehicleId: string,
    payload: { licensePlate: string; vehicleType: string; isDefault: boolean }
  ): Promise<UserVehicle> {
    return request<UserVehicle>(`/api/v1/user-vehicles/${encodeURIComponent(vehicleId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteUserVehicle(vehicleId: string): Promise<void> {
    await request<unknown>(`/api/v1/user-vehicles/${encodeURIComponent(vehicleId)}`, {
      method: "DELETE",
    });
  },

  async issueCheckOutQr(sessionId: string): Promise<BookingQrResponse> {
    return request<BookingQrResponse>(`/api/v1/check-out/${encodeURIComponent(sessionId)}/qr`, {
      method: "POST",
    });
  },

  // ─── AI DOCUMENTS, CONVERSATIONAL ASSISTANT & SMART SEARCH ────────────────
  async createAiDocument(payload: AiDocumentRequest): Promise<{ id: string }> {
    return request<{ id: string }>("/api/v1/ai/documents", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async publishAiDocument(
    id: string,
    version: number,
    confirmPublicContentReviewed: boolean
  ): Promise<{ id: string; status: string }> {
    return request<{ id: string; status: string }>(`/api/v1/ai/documents/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      body: JSON.stringify({ version, confirmPublicContentReviewed }),
    });
  },

  async chatWithAiAssistant(payload: {
    sessionId?: string;
    userId?: string;
    message: string;
    currentParkingLotId?: string;
  }): Promise<AiAssistantChatResponse> {
    return request<AiAssistantChatResponse>("/api/v1/ai/assistant/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async resetAiAssistantSession(sessionId: string): Promise<boolean> {
    return request<boolean>(`/api/v1/ai/assistant/session/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  },

  async smartSearchParking(payload: {
    naturalLanguagePrompt: string;
    userCurrentLatitude?: number;
    userCurrentLongitude?: number;
  }): Promise<AiParkingRecommendation> {
    return request<AiParkingRecommendation>("/api/v1/ai/parking/smart-search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async recommendParking(criteria: Record<string, unknown>): Promise<AiParkingRecommendation> {
    return request<AiParkingRecommendation>("/api/v1/ai/parking/recommend", {
      method: "POST",
      body: JSON.stringify(criteria),
    });
  },

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  async getNotifications(): Promise<{
    unreadCount: number;
    items: Array<{ id: string; bookingId?: string | null; kind: string; message: string; createdAt: string; readAt?: string | null }>;
  }> {
    return request("/api/v1/notifications");
  },

  async markAllNotificationsRead(): Promise<{ read: boolean }> {
    return request("/api/v1/notifications/read-all", { method: "POST" });
  },

  async markNotificationRead(id: string): Promise<{ id: string }> {
    return request(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
  },
};

export interface PaymentReceiptDto {
  receiptNumber: string;
  paymentId: string;
  bookingId: string;
  lotName: string;
  plateNumber: string;
  paymentMethod: string;
  totalAmount: number;
  currency: string;
  paidAt: string;
  collectedByStaff?: string | null;
  bankTransactionNo?: string | null;
  verificationHash: string;
}

export interface BookingDetailDto {
  bookingId: string;
  bookingCode: string;
  lotId: string;
  lotName: string;
  slotId?: string | null;
  slotCode?: string | null;
  plateSnapshot: string;
  vehicleType: string;
  startsAt: string;
  endsAt: string;
  holdExpiresAt?: string | null;
  arrivalDeadline: string;
  status: string;
  estimatedAmount: number;
  qrToken?: string | null;
  createdAt: string;
}

export interface AccountUserDto {
  id: string;
  emailNormalized?: string | null;
  phoneE164?: string | null;
  fullName: string;
  status: string;
  roles?: string[];
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

export interface CalculateFeeRequest {
  parkingLotId: string;
  entryTime: string;
  exitTime: string;
  isGoldStarMember?: boolean;
  vehicleType: string;
}

export interface CalculateFeeResponse {
  parkingLotId: string;
  entryTime: string;
  exitTime: string;
  totalMinutes: number;
  totalBillableBlocks: number;
  totalGrossAmountVnd: number;
  totalDailyCapDiscountVnd: number;
  subtotalAfterDailyCapVnd: number;
  isGoldStarMember: boolean;
  goldStarDiscountAmountVnd: number;
  finalNetAmountVnd: number;
  currency: string;
  dailyBreakdowns?: Array<{
    date: string;
    grossAmountVnd: number;
    dailyCapApplied: boolean;
    netAmountVnd: number;
  }>;
}

export interface IncidentEvidenceDto {
  kind: string;
  reference: string;
  capturedAt?: string | null;
}

export interface UploadEvidencePayload {
  contentType: "image/png" | "image/jpeg";
  imageBase64: string;
}

export interface UploadedEvidenceMetadata {
  evidenceId: string;
  lotId: string;
  contentType: string;
  reference: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
}

export interface RetrievedEvidenceDto {
  metadata: UploadedEvidenceMetadata;
  imageBase64: string;
}

export interface IncidentExitDecisionDto {
  decision: string;
  reason: string;
  decidedByUserId?: string;
  decidedAt?: string;
  evidence?: IncidentEvidenceDto[];
}

export interface IncidentSummaryDto {
  incidentId: string;
  lotId?: string;
  title: string;
  type: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "InProgress" | "Resolved" | "Escalated";
  description?: string;
  relatedPlate?: string | null;
  relatedSessionId?: string | null;
  relatedSlotCode?: string | null;
  relatedGate?: string | null;
  reportedByUserId?: string;
  detectedAt?: string;
  reportedAt?: string;
  updatedAt: string;
  resolvedAt?: string | null;
  version: number;
}

export interface IncidentDto extends IncidentSummaryDto {
  notes?: string | null;
  evidence?: IncidentEvidenceDto[];
  exitDecision?: IncidentExitDecisionDto | null;
}

export interface IncidentHistoryItemDto {
  id?: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  performedByUserId?: string;
  reason?: string | null;
  performedAt: string;
}

export interface CreateIncidentApiPayload {
  title: string;
  type: string;
  severity: string;
  description: string;
  detectedAt: string;
  relatedPlate?: string;
  relatedSlotCode?: string;
  relatedGate?: string;
  relatedSessionId?: string;
  evidence?: IncidentEvidenceDto[];
}

export interface ShiftHandoverSummaryDto {
  handoverId: string;
  lotId?: string;
  senderUserId: string;
  receiverUserId: string;
  status: string;
  createdAt: string;
  confirmedAt?: string | null;
  version: number;
}

export interface ShiftHandoverDto extends ShiftHandoverSummaryDto {
  senderShiftId: string;
  receiverShiftId: string;
  completedTasks: string;
  unresolvedIssues: string;
  pendingTransactions: string;
  equipmentStatus: string;
  notesForNext: string;
}

export interface CreateShiftHandoverApiPayload {
  senderShiftId: string;
  receiverShiftId: string;
  receiverUserId: string;
  completedTasks: string;
  unresolvedIssues: string;
  pendingTransactions: string;
  equipmentStatus: string;
  notesForNext: string;
}

export interface BackendCheckInPayload {
  lotId: string;
  gateId: string;
  qrPayload?: string;
  detectedPlate: string;
  vehicleType?: string;
  allowMismatchOverride?: boolean;
  overrideReason?: string;
  evidence?: IncidentEvidenceDto[];
}

export interface BackendCheckInResponse {
  sessionId: string;
  bookingId?: string | null;
  lotId: string;
  slotId: string;
  status: string;
  entryAt: string;
  slotCode?: string | null;
  vehicleType?: string | null;
  entryMethod?: "QR" | "WALK_IN" | string | null;
}

export interface CheckOutQuoteDto {
  sessionId: string;
  bookingId?: string | null;
  slotId: string;
  slotCode: string;
  entryPlate: string;
  exitPlate: string;
  isPlateMatched: boolean;
  entryAt: string;
  expectedExitAt: string;
  quoteAt: string;
  totalDurationMinutes: number;
  overdueMinutes: number;
  prepaidAmount: number;
  overtimeAmount: number;
  totalAmountDue: number;
  paymentRequired: boolean;
  incidentCode?: string | null;
  quoteToken?: string | null;
  validUntil?: string | null;
  checkoutCredit?: number;
}

export interface BookingQrResponse {
  bookingId: string;
  qrToken?: string;
  token?: string;
  qrPayload?: string;
  qrTokenPayload?: {
    bookingId: string;
    nonce: string;
    expiresAt: string;
    signature: string;
  };
  expiresAt?: string;
}

export interface StaffAssignmentItem {
  assignmentId: string;
  lotId: string;
  roleCode: string;
  validFrom: string;
  validUntil?: string | null;
  canManageStaffAssignments: boolean;
}
export interface CheckoutRequest {
  sessionId: string;
  gateId: string;
  detectedPlate: string;
  quoteToken: string;
  paymentMethod: 'NONE' | 'CASH' | 'VNPAY_QR';
  cashReceived: number;
  paymentReference?: string;
  staffNotes?: string;
}

export interface StaffSessionRow {
  sessionId: string;
  lotId: string;
  licensePlate: string;
  vehicleType: string;
  checkinAt: string;
  checkoutAt?: string;
  status: "ACTIVE" | "EXIT_PENDING" | "COMPLETED";
  slotCode: string;
  levelName: string;
}

export interface ParkingLotDetail extends ParkingLot {
  operatingStatus?: string;
  status?: string;
  description?: string | null;
}

export interface Vector3Dto {
  x: number;
  y: number;
  z: number;
}

export interface SlotSpatialDto {
  id: string;
  code: string;
  operationalStatus: string;
  widthM?: number | null;
  lengthM?: number | null;
  position?: Vector3Dto | null;
  rotationY?: number | null;
  size?: Vector3Dto | null;
}

export interface ZoneSpatialDto {
  id: string;
  code: string;
  name: string;
  slots: SlotSpatialDto[];
}

export interface LevelSpatialDto {
  id: string;
  code: string;
  name: string;
  levelKind?: string;
  elevationM?: number;
  displayOrder?: number;
  zones: ZoneSpatialDto[];
}

export interface LotLayout3DDto {
  lotId: string;
  code: string;
  name: string;
  levels: LevelSpatialDto[];
}

export interface MembershipDto {
  userId?: string;
  tierCode: string;
  status?: string;
  discountPercent?: number;
  validFrom?: string;
  validUntil?: string | null;
}

export interface AiDocumentRequest {
  lotId?: string | null;
  documentKey: string;
  revision: number;
  title: string;
  sourceReference: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  content: string;
}

export interface AiAssistantChatResponse {
  sessionId: string;
  replyMessage: string;
  suggestedActions?: string[];
  createdAt: string;
  isFallback?: boolean;
}

export interface AiParkingRecommendation {
  parsedCriteria?: Record<string, unknown>;
  recommendedLots?: Array<{
    parkingLotId: string;
    lotName: string;
    address: string;
    distanceMeters: number;
    estimatedTotalPrice: number;
    pricePerHour: number;
    availableSlots: number;
    totalCapacity: number;
    occupancyRatePercent: number;
    hasEvCharging?: boolean;
    hasRoofedShelter?: boolean;
    matchScore: number;
    recommendationReason: string;
  }>;
  summaryExplanation?: string;
  processingTimeMs?: number;
  isFallback?: boolean;
}
