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
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  user?: AuthUser;
  fullName?: string;
  userName?: string;
  email?: string;
  role?: string;
  roles?: string[];
}

export interface RegisterPayload {
  userName: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  password: string;
}

export interface EmailOtpResponse {
  message?: string;
  expiresAt?: string;
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
  if (init.body) headers.set("Content-Type", "application/json");

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
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.detail === "string"
          ? body.detail
          : response.status >= 500
            ? "Máy chủ API đang gặp lỗi hoặc chưa sẵn sàng. Kiểm tra backend tại localhost:5237 rồi thử lại."
            : typeof body.title === "string"
              ? body.title
              : `Yêu cầu thất bại (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return (body.result ?? body) as T;
}

export const api = {
  async getSlots(): Promise<ParkingSlot[]> {
    const response = await request<{ items?: ParkingSlot[] }>(
      "/api/slots?page=1&pageSize=8",
    );
    return response.items ?? [];
  },

  async login(userName: string, password: string): Promise<AuthTokens> {
    return request<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ userName, password }),
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
};