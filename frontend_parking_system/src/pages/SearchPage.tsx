import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, LocateFixed, MapPin, ParkingCircle, Search, ShieldCheck, Sparkles, Calculator, HelpCircle, ChevronDown, ChevronUp, QrCode, ExternalLink, Sliders, Navigation, Route, Building2, Landmark, Zap, Scan } from "lucide-react";
import { ApiError, api, type LotAvailability, type LotLayout3DDto, type ParkingSearchItem, type ParkingLevelAvailability, type UserVehicle, type AiParkingRecommendation, type CalculateFeeResponse, type ApprovedFaqResponse, type ParkingLot } from "../services/api";
import ParkingViewer, { type ModelLevel } from "../components/parking/ParkingViewer";
import { applySlotStatusChanges, type SlotStatusChange } from "../components/parking/parkingRealtime";
import { useParkingHub } from "../components/parking/useParkingHub";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import CustomerLayout from "../components/customer/CustomerLayout";
import BookingSteps from "../components/customer/BookingSteps";
import { useIdempotencyKey } from "../hooks/useIdempotencyKey";
import "./Booking.css";

type VehicleType = "Car" | "Motorbike";

function normalizeVehicleType(value: string): VehicleType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("motorbike") || normalized.includes("motorcycle") || normalized.includes("bike")) {
    return "Motorbike";
  }
  if (normalized.includes("car") || normalized === "ev" || normalized.includes("electric")) {
    return "Car";
  }
  return null;
}

function maskPlate(plate: string) {
  return plate.length <= 3 ? "***" : `${"*".repeat(Math.max(3, plate.length - 3))}${plate.slice(-3)}`;
}

function slotStatusLabel(status: string, isEn = false) {
  const normalized = status.toUpperCase();
  if (normalized === "AVAILABLE") return isEn ? "Available" : "Còn chỗ";
  if (normalized === "HELD" || normalized === "RESERVED") return isEn ? "Held" : "Đang giữ";
  if (normalized === "OCCUPIED") return isEn ? "Occupied" : "Đang có xe";
  if (normalized === "MAINTENANCE") return isEn ? "Maintenance" : "Bảo trì";
  return status || (isEn ? "Unknown" : "Không rõ");
}

function formatLevelName(levelName: string, levelCode: string, isEn = false) {
  if (!isEn) return levelName;
  const code = (levelCode || "").toUpperCase();
  if (code === "F1") return "Floor 1 (Motorbike)";
  if (code === "F2") return "Floor 2 (100 Cars)";
  if (code === "F3") return "Floor 3 (100 Cars)";
  if (code === "G") return "Ground Lot (Outdoor)";
  if (code === "B1") return "Basement B1";
  return levelName
    .replace(/Tầng trệt/gi, "Ground Floor")
    .replace(/Bãi ngoài trời/gi, "Outdoor Lot")
    .replace(/Tầng hầm/gi, "Basement")
    .replace(/Tầng/gi, "Floor")
    .replace(/Xe máy/gi, "Motorbike")
    .replace(/ô tô/gi, "Cars");
}

function toLocalDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function getErrorMessage(error: unknown, isEn = false) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : (isEn ? "An unexpected error occurred. Please try again." : "Đã có lỗi không mong muốn. Vui lòng thử lại.");
  }

  if (error.status === 0) return isEn ? "Unable to connect to service. Please check your connection and try again." : "Chưa thể kết nối dịch vụ. Vui lòng kiểm tra kết nối và thử lại.";
  if (error.status === 401) return isEn ? "Your session is invalid or expired. Please log in again." : "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return error.message;
  if (error.status === 409) return isEn ? "Spot availability has just changed. Please refresh availability." : "Chỗ đỗ vừa thay đổi hoặc không còn khả dụng. Hãy tải lại tình trạng chỗ.";
  if (error.status >= 500) return isEn ? "Unable to load parking data right now. Please try again later." : "Chưa thể tải dữ liệu bãi đỗ lúc này. Vui lòng thử lại sau.";
  return error.message;
}

function formatMoney(amount: number, currency = "VND", isEn = false) {
  return new Intl.NumberFormat(isEn ? "en-US" : "vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const featureLabelsVi: Record<string, string> = {
  EV_CHARGING: "Sạc xe điện", ACCESSIBLE: "Hỗ trợ tiếp cận", PRIORITY: "Chỗ ưu tiên",
  COVERED: "Có mái che", NEAR_ELEVATOR: "Gần thang máy", CCTV: "Camera an ninh",
};
const featureLabelsEn: Record<string, string> = {
  EV_CHARGING: "EV Charging", ACCESSIBLE: "Accessible", PRIORITY: "Priority Spot",
  COVERED: "Covered", NEAR_ELEVATOR: "Near Elevator", CCTV: "Security CCTV",
};
function featureLabel(value: string, isEn = false) {
  const map = isEn ? featureLabelsEn : featureLabelsVi;
  return map[value.toUpperCase()] ?? value;
}
function operatingLabel(value: string, isEn = false) {
  const labelsVi: Record<string, string> = { OPEN: "Đang mở cửa", ACTIVE: "Đang hoạt động", CLOSED: "Đang đóng cửa", TEMPORARILYCLOSED: "Tạm đóng cửa", INACTIVE: "Ngừng hoạt động" };
  const labelsEn: Record<string, string> = { OPEN: "Open", ACTIVE: "Active", CLOSED: "Closed", TEMPORARILYCLOSED: "Temporarily Closed", INACTIVE: "Inactive" };
  return (isEn ? labelsEn : labelsVi)[value.toUpperCase()] ?? value;
}
function dateLabel(value: string, isEn = false) {
  return new Date(value).toLocaleString(isEn ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}
function isBuildingLotItem(lot?: { code?: string } | null, levelsCount = 0) {
  const upper = (lot?.code || "").toUpperCase();
  if (upper.includes("BT")) return false;
  if (upper.includes("Q1") || upper.includes("Q7")) return true;
  return levelsCount > 1;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

function getLotVisualMeta(lot?: { code?: string; name?: string; address?: string } | null, index = 0) {
  const code = (lot?.code || "").toUpperCase();
  const text = `${lot?.name || ""} ${lot?.address || ""}`.toLowerCase();

  if (code.includes("Q7") || text.includes("quận 7") || text.includes("quan 7") || text.includes("crescent") || text.includes("secc") || text.includes("phú mỹ hưng")) {
    return {
      image: "/assets/lot_quan_7.jpg",
      tag: { vi: "Crescent Mall SECC Phú Mỹ Hưng · 3 tầng", en: "Crescent Mall SECC Phu My Hung · 3 Floors" },
      available: 45,
      nameFallback: "Bãi xe Crescent Mall & SECC Phú Mỹ Hưng",
      addressFallback: "101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM",
      coords: { latitude: 10.7292, longitude: 106.7196 },
      shortName: "Crescent Mall (Quận 7)",
    };
  }

  if (code.includes("Q1") || text.includes("quận 1") || text.includes("quan 1") || text.includes("vincom") || text.includes("đồng khởi") || text.includes("bến nghé")) {
    return {
      image: "/assets/lot_quan_1.jpg",
      tag: { vi: "Vincom Center Đồng Khởi · 3 tầng", en: "Vincom Center Dong Khoi · 3 Floors" },
      available: 18,
      nameFallback: "Tòa nhà đỗ xe Vincom Center Đồng Khởi",
      addressFallback: "72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM",
      coords: { latitude: 10.7781, longitude: 106.7018 },
      shortName: "Vincom Đồng Khởi (Quận 1)",
    };
  }

  if (code.includes("BT") || text.includes("bình thạnh") || text.includes("binh thanh") || text.includes("landmark") || text.includes("central park")) {
    return {
      image: "/assets/lot_binh_thanh.jpg",
      tag: { vi: "Landmark 81 Central Park · 40 chỗ", en: "Landmark 81 Central Park · 40 spaces" },
      available: 38,
      nameFallback: "Bãi đỗ xe Landmark 81 - Central Park",
      addressFallback: "720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM",
      coords: { latitude: 10.7952, longitude: 106.7219 },
      shortName: "Landmark 81 (Bình Thạnh)",
    };
  }

  if (index === 1) {
    return {
      image: "/assets/lot_quan_1.jpg",
      tag: { vi: "Vincom Center Đồng Khởi · 3 tầng", en: "Vincom Center Dong Khoi · 3 Floors" },
      available: 18,
      nameFallback: "Tòa nhà đỗ xe Vincom Center Đồng Khởi",
      addressFallback: "72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM",
      coords: { latitude: 10.7781, longitude: 106.7018 },
      shortName: "Vincom Đồng Khởi (Quận 1)",
    };
  }
  if (index === 2) {
    return {
      image: "/assets/lot_quan_7.jpg",
      tag: { vi: "Crescent Mall SECC Phú Mỹ Hưng · 3 tầng", en: "Crescent Mall SECC Phu My Hung · 3 Floors" },
      available: 45,
      nameFallback: "Bãi xe Crescent Mall & SECC Phú Mỹ Hưng",
      addressFallback: "101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM",
      coords: { latitude: 10.7292, longitude: 106.7196 },
      shortName: "Crescent Mall (Quận 7)",
    };
  }
  return {
    image: "/assets/lot_binh_thanh.jpg",
    tag: { vi: "Landmark 81 Central Park · 40 chỗ", en: "Landmark 81 Central Park · 40 spaces" },
    available: 38,
    nameFallback: "Bãi đỗ xe Landmark 81 - Central Park",
    addressFallback: "720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM",
    coords: { latitude: 10.7952, longitude: 106.7219 },
    shortName: "Landmark 81 (Bình Thạnh)",
  };
}

function sanitizeAiSummary(text?: string): string {
  if (!text) return "";
  return text
    .replace(/Demo Bình Thạnh|Demo Binh Thanh/gi, "Bãi đỗ xe Landmark 81 - Central Park")
    .replace(/Demo Quận 1|Demo Quan 1/gi, "Tòa nhà đỗ xe Vincom Center Đồng Khởi")
    .replace(/Demo Quận 7|Demo Quan 7/gi, "Bãi xe Crescent Mall & SECC Phú Mỹ Hưng")
    .replace(/Bãi đỗ 'Demo [^']+'/gi, (m) => {
      if (/quận 7|quan 7/i.test(m)) return "Bãi đỗ 'Bãi xe Crescent Mall & SECC Phú Mỹ Hưng'";
      if (/quận 1|quan 1/i.test(m)) return "Bãi đỗ 'Tòa nhà đỗ xe Vincom Center Đồng Khởi'";
      return "Bãi đỗ 'Bãi đỗ xe Landmark 81 - Central Park'";
    });
}


export default function SearchPage({ selection = false }: { selection?: boolean }) {
  const navigate = useNavigate();
  const { lotId } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const { key: bookingKey, renewKey: renewBookingKey } = useIdempotencyKey("book");

  const paramVehicle = searchParams.get("vehicle") || searchParams.get("vehicleType");
  const initialVehicle: VehicleType = (paramVehicle && (paramVehicle.toLowerCase().includes("bike") || paramVehicle.toLowerCase().includes("motor")))
    ? "Motorbike"
    : "Car";

  const paramDuration = Number(searchParams.get("duration") || searchParams.get("expectedDuration"));
  const initialDuration = Number.isInteger(paramDuration) && paramDuration >= 30 && paramDuration <= 1440
    ? paramDuration
    : 120;

  const paramSortBy = searchParams.get("sortBy")?.toUpperCase();
  const paramCriteria = searchParams.get("criteria")?.toLowerCase() || "";
  const initialSortBy: "NEAREST" | "CHEAPEST" = (paramSortBy === "NEAREST" || (!paramSortBy && paramCriteria.includes("nearest") && !paramCriteria.includes("cheapest")))
    ? "NEAREST"
    : "CHEAPEST";

  const paramRadius = searchParams.get("radius") || searchParams.get("radiusKm");
  const initialRadius = paramRadius === "all"
    ? 20
    : (Number(paramRadius) >= 1 && Number(paramRadius) <= 50 ? Number(paramRadius) : 5);

  const [vehicleType, setVehicleType] = useState<VehicleType>(initialVehicle);
  const [startsAt, setStartsAt] = useState(() => {
    const savedStart = searchParams.get("startsAt");
    return savedStart && Number.isFinite(new Date(savedStart).getTime())
      ? savedStart : toLocalDateTime(new Date(Date.now() + 30 * 60_000));
  });
  const [duration, setDuration] = useState(initialDuration);
  const [sortBy, setSortBy] = useState<"NEAREST" | "CHEAPEST">(initialSortBy);
  const [radiusKm, setRadiusKm] = useState(initialRadius);
  const initialPosition = useMemo(() => {
    const lat = searchParams.get("latitude");
    const lng = searchParams.get("longitude");
    if (!lat?.trim() || !lng?.trim()) return null;
    const latitude = Number(lat), longitude = Number(lng);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
      ? { latitude, longitude } : null;
  }, [searchParams]);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(initialPosition);
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [activeRouteLot, setActiveRouteLot] = useState<{
    name: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);
  const [results, setResults] = useState<ParkingSearchItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchSnapshot, setSearchSnapshot] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLot, setSelectedLot] = useState<ParkingSearchItem | null>(null);
  const [availability, setAvailability] = useState<LotAvailability | null>(null);
  const [lotLayout, setLotLayout] = useState<LotLayout3DDto | null>(null);
  const layoutCacheRef = useRef<Record<string, LotLayout3DDto>>({});
  const [availabilityError, setAvailabilityError] = useState("");
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isRefreshingAvailability, setIsRefreshingAvailability] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedLevelCode, setSelectedLevelCode] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [vehicleError, setVehicleError] = useState("");
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [availabilitySnapshot, setAvailabilitySnapshot] = useState("");
  const [availabilityVehicleType, setAvailabilityVehicleType] = useState<VehicleType | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const availabilityRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const restoredSelection = useRef(false);
  const summaryRef = useRef<HTMLElement>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [resumeNotice, setResumeNotice] = useState("");
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Search Mode & Extra Tool States
  const [searchMode, setSearchMode] = useState<"STANDARD" | "SMART_AI" | "CALCULATOR">(() => searchParams.get("mode") === "ai" ? "SMART_AI" : "STANDARD");

  // 1. AI Smart Search State (POST /api/v1/ai/parking/smart-search)
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState<AiParkingRecommendation | null>(null);
  const [aiError, setAiError] = useState("");

  // 2. Fee Calculator State (POST /api/v1/payments/calculate-fee)
  const [allLots, setAllLots] = useState<ParkingLot[]>([]);
  const [calcLotId, setCalcLotId] = useState("");
  const [calcEntryTime, setCalcEntryTime] = useState(() => new Date(Date.now() + 15 * 60_000).toISOString().slice(0, 16));
  const [calcExitTime, setCalcExitTime] = useState(() => new Date(Date.now() + 135 * 60_000).toISOString().slice(0, 16));
  const [calcVehicleType, setCalcVehicleType] = useState("Car");
  const [calcIsGoldStar, setCalcIsGoldStar] = useState(false);
  const [calcResult, setCalcResult] = useState<CalculateFeeResponse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

  // 3. Lot FAQ Document Retrieval State (POST /api/v1/parking-lots/{lotId}/assistant)
  const [faqQuery, setFaqQuery] = useState("");
  const [faqResult, setFaqResult] = useState<ApprovedFaqResponse | null>(null);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState("");
  const [faqOpen, setFaqOpen] = useState(false);

  useEffect(() => {
    api.getParkingLots().then(list => {
      setAllLots(list);
      if (list[0]) setCalcLotId(list[0].id);
    }).catch(() => {});
  }, []);

  const handleSmartAiSearch = async (promptToSearch?: string) => {
    const q = (promptToSearch ?? aiPrompt).trim();
    if (!q) return;
    setAiSearching(true);
    setAiError("");
    try {
      const rec = await api.smartSearchParking({
        naturalLanguagePrompt: q,
        userCurrentLatitude: searchPosition?.latitude,
        userCurrentLongitude: searchPosition?.longitude,
      });
      setAiResult(rec);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : (isEn ? "Failed to run AI search" : "Không thể thực hiện tìm kiếm AI."));
    } finally {
      setAiSearching(false);
    }
  };

  const handleCalculateFee = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!calcLotId) {
      setCalcError(isEn ? "Please select a parking facility" : "Vui lòng chọn cơ sở bãi đỗ");
      return;
    }
    setCalcLoading(true);
    setCalcError("");
    try {
      const res = await api.calculateFee({
        parkingLotId: calcLotId,
        entryTime: new Date(calcEntryTime).toISOString(),
        exitTime: new Date(calcExitTime).toISOString(),
        vehicleType: calcVehicleType,
        isGoldStarMember: calcIsGoldStar,
      });
      setCalcResult(res);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : (isEn ? "Unable to calculate fee." : "Không thể tính phí lúc này."));
    } finally {
      setCalcLoading(false);
    }
  };

  const handleAskFaq = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!selectedLot?.parkingLotId || !faqQuery.trim()) return;
    setFaqLoading(true);
    setFaqError("");
    try {
      const res = await api.askApprovedFaq(selectedLot.parkingLotId, faqQuery.trim());
      setFaqResult(res);
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : (isEn ? "Failed to query FAQ." : "Không tìm thấy tài liệu quy chế phù hợp."));
    } finally {
      setFaqLoading(false);
    }
  };

  const manualLocationEntered = manualLatitude.trim() !== "" || manualLongitude.trim() !== "";
  const parsedLatitude = Number(manualLatitude);
  const parsedLongitude = Number(manualLongitude);
  const searchPosition = manualLocationEntered
    ? manualLatitude.trim() !== "" && manualLongitude.trim() !== ""
      && Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)
      && parsedLatitude >= -90 && parsedLatitude <= 90
      && parsedLongitude >= -180 && parsedLongitude <= 180
      ? { latitude: parsedLatitude, longitude: parsedLongitude }
      : null
    : position;
  const criteriaSignature = JSON.stringify({
    vehicleType,
    startsAt,
    duration,
    sortBy,
    radiusKm,
    position: sortBy === "NEAREST" ? searchPosition : null,
  });
  const searchIsCurrent = Boolean(searchSnapshot && searchSnapshot === criteriaSignature);

  useEffect(() => {
    if (initialPosition) setPosition(initialPosition);
    const v = searchParams.get("vehicle") || searchParams.get("vehicleType");
    if (v) {
      setVehicleType(v.toLowerCase().includes("bike") || v.toLowerCase().includes("motor") ? "Motorbike" : "Car");
    }
    const d = Number(searchParams.get("duration") || searchParams.get("expectedDuration"));
    if (Number.isInteger(d) && d >= 30 && d <= 1440) {
      setDuration(d);
    }
    const s = searchParams.get("sortBy")?.toUpperCase();
    const c = searchParams.get("criteria")?.toLowerCase() || "";
    if (s === "NEAREST" || (s !== "CHEAPEST" && c.includes("nearest") && !c.includes("cheapest"))) {
      setSortBy("NEAREST");
    } else if (s === "CHEAPEST" || c.includes("cheapest")) {
      setSortBy("CHEAPEST");
    }
    const r = searchParams.get("radius") || searchParams.get("radiusKm");
    if (r === "all") {
      setRadiusKm(20);
    } else if (r) {
      const num = Number(r);
      if (Number.isFinite(num) && num >= 1 && num <= 50) {
        setRadiusKm(num);
      }
    }
  }, [searchParams, initialPosition]);

  useEffect(() => {
    if (!isAuthenticated) {
      setVehicles([]);
      setVehicleId("");
      setVehicleError("");
      return;
    }

    let active = true;
    setIsLoadingVehicles(true);
    api.getUserVehicles().then(items => {
      if (!active) return;
      setVehicles(items);
      setVehicleId(current => current || items.find(vehicle => vehicle.isDefault)?.id || "");
      setVehicleError("");
    }).catch(cause => {
      if (active) setVehicleError(getErrorMessage(cause, isEn));
    }).finally(() => {
      if (active) setIsLoadingVehicles(false);
    });

    return () => { active = false; };
  }, [isAuthenticated, isEn]);

  const loadAvailability = useCallback(async (lot: ParkingSearchItem, silent = false) => {
    const requestId = ++availabilityRequestId.current;
    setSelectedLot(lot);
    if (!silent) {
      setAvailability(null);
      setLotLayout(layoutCacheRef.current[lot.parkingLotId] ?? null);
      setAvailabilitySnapshot("");
      setSelectedSlotId("");
      setIsLoadingAvailability(true);
    } else {
      setIsRefreshingAvailability(true);
    }
    setAvailabilityError("");
    try {
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) throw new Error(isEn ? "Please choose a valid start time." : "Vui lòng chọn thời gian bắt đầu hợp lệ.");
      const end = new Date(start.getTime() + duration * 60_000);
      const cachedLayout = layoutCacheRef.current[lot.parkingLotId];
      const [result, layoutResult] = await Promise.all([
        api.getAvailability(lot.parkingLotId, start.toISOString(), end.toISOString()),
        cachedLayout ? Promise.resolve(cachedLayout) : api.getLotLayout3D(lot.parkingLotId).catch(() => null),
      ]);
      if (layoutResult) {
        layoutCacheRef.current[lot.parkingLotId] = layoutResult;
      }
      if (requestId === availabilityRequestId.current) {
        setAvailability(result);
        setUpdatedAt(new Date());
        setLotLayout(layoutResult ?? cachedLayout ?? null);
        setAvailabilitySnapshot(criteriaSignature);
        setAvailabilityVehicleType(vehicleType);
        const buildingLot = isBuildingLotItem(lot, result.levels.length);
        setSelectedLevelCode(current => {
          if (buildingLot && (current === "ALL" || current === "F1" || current === "F2" || current === "F3")) {
            return current;
          }
          if (result.levels.some(level => level.levelCode === current)) {
            return current;
          }
          if (buildingLot) {
            return vehicleType === "Motorbike" ? "F1" : "ALL";
          }
          return result.levels[0]?.levelCode ?? "";
        });

        setSelectedSlotId(current => result.levels.some(level =>

          level.slots.some(slot => slot.slotId === current && slot.status.toUpperCase() === "AVAILABLE"
            && slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType))) ? current : "");
        if (!restoredSelection.current) {
          restoredSelection.current = true;
          const requestedSlot = searchParams.get("slot");
          const requestedLevel = result.levels.find(level => level.slots.some(slot => slot.slotId === requestedSlot
            && slot.status.toUpperCase() === "AVAILABLE" && slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType)));
          if (requestedLevel && requestedSlot) {
            setSelectedLevelCode(requestedLevel.levelCode);
            setSelectedSlotId(requestedSlot);
          } else if (requestedSlot) {
            setResumeNotice(isEn ? "Your previously selected spot is no longer available. Please choose another available spot." : "Ô bạn chọn trước đó không còn khả dụng. Vui lòng chọn một ô còn trống khác.");
          }
        }
      }
    } catch (cause) {
      if (requestId === availabilityRequestId.current) setAvailabilityError(getErrorMessage(cause, isEn));
    } finally {
      if (requestId === availabilityRequestId.current) {
        setIsLoadingAvailability(false);
        setIsRefreshingAvailability(false);
      }
    }
  }, [startsAt, duration, vehicleType, criteriaSignature, searchParams, isEn]);

  const executeSearch = useCallback(async (
    targetVehicleType: VehicleType,
    targetStartsAt: string,
    targetDuration: number,
    targetSortBy: "NEAREST" | "CHEAPEST",
    targetRadiusKm: number,
    targetPosition: { latitude: number; longitude: number } | null,
    targetLotIdOrCode?: string | null
  ) => {
    const requestId = ++searchRequestId.current;
    setSearchError("");
    setSelectedLot(null);
    setAvailability(null);
    setSelectedSlotId("");
    setSearchSnapshot("");
    setAvailabilitySnapshot("");
    availabilityRequestId.current += 1;

    const durationMinutes = Number(targetDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 1440) {
      setSearchError(isEn ? "Duration must be between 30 minutes and 24 hours." : "Thời lượng phải từ 30 phút đến 24 giờ.");
      return;
    }
    if (!Number.isFinite(new Date(targetStartsAt).getTime()) || new Date(targetStartsAt).getTime() <= Date.now()) {
      setSearchError(isEn ? "Start time must be in the future." : "Thời gian bắt đầu phải ở trong tương lai.");
      return;
    }
    if (targetSortBy === "NEAREST" && !targetPosition) {
      setSearchError(isEn ? "To find the nearest lots, please enter valid coordinates or allow GPS access." : "Để tìm bãi gần nhất, hãy nhập tọa độ hợp lệ hoặc cho phép truy cập GPS.");
      return;
    }

    const sig = JSON.stringify({
      vehicleType: targetVehicleType,
      startsAt: targetStartsAt,
      duration: targetDuration,
      sortBy: targetSortBy,
      radiusKm: targetRadiusKm,
      position: targetSortBy === "NEAREST" ? targetPosition : null,
    });

    setHasSearched(true);
    setIsSearching(true);
    try {
      const result = await api.searchParkingLots({
        vehicleType: targetVehicleType,
        startTime: new Date(targetStartsAt).toISOString(),
        expectedDuration: durationMinutes,
        sortBy: targetSortBy,
        radiusKm: targetRadiusKm,
        ...(targetSortBy === "NEAREST" && targetPosition ? targetPosition : {}),
      });
      if (requestId !== searchRequestId.current) return;
      const items = result.items ?? [];
      setResults(items);
      setTotalCount(result.totalCount ?? items.length);
      setSearchSnapshot(sig);

      const lotTarget = targetLotIdOrCode;
      if (selection && lotTarget) {
        const matched = items.find(i =>
          i.parkingLotId === lotTarget
        );
        if (matched) {
          void loadAvailability(matched);
        } else {
          setSearchError(isEn ? "This lot is no longer available for the selected time or vehicle type. Please go back and select another lot." : "Bãi này không còn phù hợp với khung giờ hoặc loại xe đã chọn. Hãy quay lại để chọn bãi khác.");
        }
      }
    } catch (cause) {
      if (requestId !== searchRequestId.current) return;
      setResults([]);
      setSearchSnapshot("");
      setSearchError(getErrorMessage(cause, isEn));
    } finally {
      if (requestId === searchRequestId.current) setIsSearching(false);
    }
  }, [selection, loadAvailability, isEn]);

  const submitSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    initialSearchTriggered.current = true;
    // Keep the search URL current so browser Back restores the submitted trip.
    navigate(`/booking?${tripParams()}`, { replace: true });
    await executeSearch(vehicleType, startsAt, duration, sortBy, radiusKm, searchPosition);
  };

  const initialSearchTriggered = useRef(false);
  useEffect(() => {
    if (initialSearchTriggered.current) return;
    const hasParams = selection || searchParams.has("vehicle") || searchParams.has("duration") || searchParams.has("lot") || searchParams.has("radius") || searchParams.has("sortBy") || searchParams.has("criteria");
    if (hasParams) {
      initialSearchTriggered.current = true;
      const initialStart = startsAt;
      void executeSearch(
        initialVehicle,
        initialStart,
        initialDuration,
        initialSortBy,
        initialRadius,
        initialPosition,
        selection ? lotId : null
      );
    }
  }, [searchParams, executeSearch, initialVehicle, initialDuration, initialSortBy, initialRadius, initialPosition, selection, lotId, startsAt]);

  const useCurrentLocation = () => {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage(isEn ? "Geolocation is not supported by this browser." : "Trình duyệt này không hỗ trợ định vị.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude, longitude: coords.longitude });
        setManualLatitude(String(coords.latitude));
        setManualLongitude(String(coords.longitude));
        setLocationMessage(isEn ? "Current location acquired. Distance is straight-line." : "Đã lấy vị trí hiện tại. Khoảng cách là đường chim bay.");
      },
      () => setLocationMessage(isEn ? "Unable to get location. Please grant location permission and try again." : "Không lấy được vị trí. Hãy cấp quyền định vị rồi thử lại."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const isMotorbike = vehicleType === "Motorbike";
  const [bookingMode, setBookingMode] = useState<"EXACT_SLOT" | "AUTO_SLOT">(searchParams.get("mode") === "AUTO_SLOT" ? "AUTO_SLOT" : "EXACT_SLOT");
  const effectiveBookingMode: "EXACT_SLOT" | "AUTO_SLOT" = isMotorbike ? "AUTO_SLOT" : bookingMode;

  // Active Pending Booking Notice & Reopen Handler
  const [pendingBookingNotice, setPendingBookingNotice] = useState<{
    id: string;
    code: string;
    lotId: string;
    lotName?: string;
    slotId?: string;
    slotCode?: string;
    expiresAt: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem("last_pending_booking");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    if (!pendingBookingNotice) return;
    const timer = setInterval(() => {
      if (new Date(pendingBookingNotice.expiresAt).getTime() <= Date.now()) {
        setPendingBookingNotice(null);
        try { sessionStorage.removeItem("last_pending_booking"); } catch {}
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingBookingNotice]);

  const createBooking = async () => {
    setBookingError("");
    if (!isAuthenticated) {
      setBookingError(isEn ? "You must log in to create a booking." : "Bạn cần đăng nhập để tạo booking.");
      return;
    }
    if (!availabilityIsCurrent) {
      setBookingError(isEn ? "Time range has changed; please refresh availability before booking." : "Khung giờ đã thay đổi; hãy tải lại tình trạng chỗ trước khi đặt.");
      return;
    }
    if (!selectedLot || (effectiveBookingMode === "EXACT_SLOT" && !selectedSlotId) || !selectedVehicle) {
      setBookingError(isMotorbike ? (isEn ? "Please select your motorbike vehicle." : "Vui lòng chọn phương tiện xe máy của bạn.") : (isEn ? "Please select a parking spot and vehicle." : "Vui lòng chọn ô đỗ và phương tiện."));
      return;
    }
    if (normalizeVehicleType(selectedVehicle.vehicleType) !== vehicleType) {
      setBookingError(isEn ? "Vehicle type has changed. Please reload results and select a compatible vehicle." : "Loại phương tiện đã thay đổi. Hãy tải lại kết quả và chọn phương tiện phù hợp.");
      return;
    }

    setIsCreatingBooking(true);
    try {
      const start = new Date(startsAt);
      const payload = {
        lotId: selectedLot.parkingLotId,
        mode: effectiveBookingMode,
        slotId: effectiveBookingMode === "AUTO_SLOT" ? "00000000-0000-0000-0000-000000000000" : selectedSlotId,
        vehicleId: selectedVehicle.id,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
      };
      const booking = await api.createBooking(payload, bookingKey);
      try {
        sessionStorage.setItem(
          "last_pending_booking",
          JSON.stringify({
            id: booking.id,
            code: booking.code || (booking as unknown as { bookingCode?: string }).bookingCode || "BK-ORD",
            lotId: selectedLot.parkingLotId,
            lotName: selectedLot.name,
            slotId: selectedSlotId,
            slotCode: selectedSlot?.slotCode,
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          })
        );
      } catch {}
      navigate(`/bookings/${encodeURIComponent(booking.id)}`);
    } catch (cause) {
      setBookingError(getErrorMessage(cause, isEn));
      if (cause instanceof ApiError && cause.status === 409 && selectedLot) {
        setSelectedSlotId("");
        renewBookingKey();
        void loadAvailability(selectedLot);
      }
    } finally {
      setIsCreatingBooking(false);
    }
  };


  const isBuildingLot = useMemo(
    () => isBuildingLotItem(selectedLot, availability?.levels.length ?? 0),
    [selectedLot, availability?.levels.length],
  );
  const allCompatibleSlots = useMemo(() =>
    availability?.levels.flatMap(level =>
      level.slots
        .filter(slot => slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType))
        .map(slot => ({
          ...slot,
          floorCode: level.levelCode,
          floorName: level.levelName,
        }))
    ) ?? [],
    [availability, vehicleType],
  );
  const selectedLevel = useMemo(
    () => availability?.levels.find(level => level.levelCode === selectedLevelCode) ?? null,
    [availability, selectedLevelCode],
  );
  const levelSlots = useMemo(() => {
    if (selectedLevelCode === "ALL") return allCompatibleSlots;
    if (selectedLevel) {
      return selectedLevel.slots
        .filter(slot => slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType))
        .map(slot => ({
          ...slot,
          floorCode: selectedLevel.levelCode,
          floorName: selectedLevel.levelName,
        }));
    }
    return [];
  }, [selectedLevelCode, allCompatibleSlots, selectedLevel, vehicleType]);
  const viewerLevels = useMemo<ModelLevel[]>(() => {
    if (!availability) return [];
    const availabilityBySlotId = new Map(
      availability.levels.flatMap(level =>
        level.slots.map(slot => [slot.slotId, { ...slot, floorCode: level.levelCode }] as const)
      )
    );

    if (lotLayout && lotLayout.lotId === availability.lotId && lotLayout.levels.length > 0) {
      const mapped = lotLayout.levels
        .slice()
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map(level => {
          const slots = (level.zones ?? []).flatMap(zone =>
            (zone.slots ?? [])
              .map(spatialSlot => {
                const live = availabilityBySlotId.get(spatialSlot.id);
                if (!live) return null;
                if (!live.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType)) {
                  return null;
                }
                return {
                  slotId: spatialSlot.id,
                  slotCode: spatialSlot.code || live.slotCode,
                  floorCode: level.code || live.floorCode,
                  zoneCode: zone.code || live.zoneCode,
                  supportedVehicleTypes: live.supportedVehicleTypes,
                  features: live.features,
                  status: live.status,
                  position: spatialSlot.position ?? null,
                  rotationY: spatialSlot.rotationY ?? null,
                  widthM: spatialSlot.widthM ?? null,
                  lengthM: spatialSlot.lengthM ?? null,
                  size: spatialSlot.size ?? null,
                };
              })
              .filter((item): item is NonNullable<typeof item> => item !== null)
          );
          return {
            levelId: level.id,
            levelCode: level.code,
            levelName: level.name,
            elevationM: level.elevationM ?? null,
            slots,
          };
        })
        .filter(level => level.slots.length > 0);
      if (mapped.length > 0) return mapped;
    }

    return availability.levels
      .map(level => ({
        levelId: level.levelId,
        levelCode: level.levelCode,
        levelName: level.levelName,
        slots: level.slots
          .filter(slot => slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType))
          .map(slot => ({
            slotId: slot.slotId,
            slotCode: slot.slotCode,
            floorCode: level.levelCode,
            zoneCode: slot.zoneCode,
            supportedVehicleTypes: slot.supportedVehicleTypes,
            features: slot.features,
            status: slot.status,
          })),
      }))
      .filter(level => level.slots.length > 0);
  }, [availability, lotLayout, vehicleType]);
  const selectedSlot = allCompatibleSlots.find(slot => slot.slotId === selectedSlotId) ?? null;
  const compatibleAvailableCount = useMemo(
    () => allCompatibleSlots.filter(slot => slot.status.toUpperCase() === "AVAILABLE").length,
    [allCompatibleSlots],
  );
  const allMotoSlots = useMemo(
    () =>
      availability?.levels.flatMap(level =>
        level.slots.filter(slot =>
          slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === "Motorbike"),
        ),
      ) ?? [],
    [availability],
  );
  const motoSceneStats = useMemo(() => {
    const maxCapacity = allMotoSlots.length > 0 ? allMotoSlots.length : 20;
    const availableMoto =
      allMotoSlots.length > 0
        ? allMotoSlots.filter(slot => slot.status.toUpperCase() === "AVAILABLE").length
        : 20;
    return {
      availableMoto,
      maxCapacity,
      currentMoto: Math.max(0, maxCapacity - availableMoto),
      showOutdoorBanner: isMotorbike && !isBuildingLot,
      lang,
    };
  }, [allMotoSlots, isMotorbike, isBuildingLot, lang]);


  const currentRange = useMemo(() => {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return null;
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
    };
  }, [startsAt, duration]);
  const availabilityIsCurrent = Boolean(
    availability && searchIsCurrent && availabilitySnapshot === criteriaSignature &&
    availabilityVehicleType === vehicleType && currentRange && new Date(startsAt).getTime() > Date.now() &&
    new Date(availability.queryRange.startsAt).getTime() === new Date(currentRange.startsAt).getTime() &&
    new Date(availability.queryRange.endsAt).getTime() === new Date(currentRange.endsAt).getTime(),
  );
  const applyRealtimeStatusChanges = useCallback((changes: SlotStatusChange[]) => {
    setAvailability(current => {
      if (!current) return current;
      const levels = current.levels.map((level: ParkingLevelAvailability) => ({
        ...level,
        slots: applySlotStatusChanges(level.slots, changes, current.lotId),
      }));
      const slots = levels.flatMap(level => level.slots)
        .filter(slot => slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType));
      return {
        ...current,
        levels,
        availableCount: slots.filter(slot => slot.status.toUpperCase() === "AVAILABLE").length,
        heldCount: slots.filter(slot => ["HELD", "RESERVED"].includes(slot.status.toUpperCase())).length,
        occupiedCount: slots.filter(slot => slot.status.toUpperCase() === "OCCUPIED").length,
        maintenanceCount: slots.filter(slot => slot.status.toUpperCase() === "MAINTENANCE").length,
      };
    });
  }, [vehicleType]);
  const parkingHubStatus = useParkingHub(
    availabilityIsCurrent,
    selectedLot?.parkingLotId ?? null,
    applyRealtimeStatusChanges,
  );
  const compatibleVehicles = vehicles.filter(vehicle => normalizeVehicleType(vehicle.vehicleType) === vehicleType);
  const selectedVehicle = compatibleVehicles.find(vehicle => vehicle.id === vehicleId)
    ?? compatibleVehicles.find(vehicle => vehicle.isDefault)
    ?? compatibleVehicles[0]
    ?? null;
  useEffect(() => {
    renewBookingKey();
  }, [selectedSlotId, selectedVehicle?.id, bookingMode, startsAt, duration, renewBookingKey]);

  useEffect(() => {
    if (!selectedLot || !availabilityIsCurrent) return;
    const timer = window.setInterval(() => void loadAvailability(selectedLot, true), 10_000);
    return () => window.clearInterval(timer);
  }, [selectedLot, availabilityIsCurrent, loadAvailability]);

  function tripParams() {
    const params = new URLSearchParams({ vehicle: vehicleType, startsAt, duration: String(duration), sortBy, radius: String(radiusKm) });
    if (sortBy === "NEAREST" && searchPosition) {
      params.set("latitude", String(searchPosition.latitude));
      params.set("longitude", String(searchPosition.longitude));
    }
    return params;
  }
  function chooseLot(lot: ParkingSearchItem) {
    navigate(`/booking/${encodeURIComponent(lot.parkingLotId)}?${tripParams()}`);
    window.scrollTo(0, 0);
  }
  const backToSearch = `/booking?${tripParams()}`;
  const returnParams = tripParams();
  if (selectedSlotId) returnParams.set("slot", selectedSlotId);
  returnParams.set("mode", bookingMode);
  const returnTo = `/booking/${encodeURIComponent(lotId ?? "")}?${returnParams}`;
  const loginTo = `/login?${new URLSearchParams({ returnTo })}`;
  const estimatedFee = selectedLot?.estimatedPricing?.estimatedTotalFee;
  const estimatedPrice = typeof estimatedFee === "number" && Number.isFinite(estimatedFee)
    ? formatMoney(estimatedFee, selectedLot?.estimatedPricing.currency ?? "VND", isEn) : (isEn ? "Price unavailable" : "Chưa có giá");
  const canBook = (effectiveBookingMode === "AUTO_SLOT" || selectedSlot?.status.toUpperCase() === "AVAILABLE")
    && Boolean(selectedVehicle) && availabilityIsCurrent && compatibleAvailableCount > 0 && !isCreatingBooking;


  return (
    <CustomerLayout booking>
      <main className={`customer-page booking-flow-page${selection ? " booking-selection-page" : ""}`}>
        {selection && <Link className="booking-back-link" to={backToSearch}><ArrowLeft size={16} />{isEn ? "Back to parking search" : "Quay lại chọn bãi"}</Link>}
        <BookingSteps current={selection ? 2 : 1} />
        <header className="customer-page-heading">
          <p className="customer-eyebrow">{selection ? (isEn ? "SELECT YOUR SPOT" : "CHỌN VỊ TRÍ CỦA BẠN") : (isEn ? "ONE SPOT, EVERY JOURNEY" : "MỘT CHỖ ĐỖ, MỌI HÀNH TRÌNH")}</p>
          <h1>{selection ? selectedLot?.name ?? (isEn ? "Select your parking spot" : "Chọn chỗ đỗ của bạn") : (isEn ? "Find parking for your journey." : "Tìm bãi cho hành trình của bạn.")}</h1>
          <p>{selection ? selectedLot?.address ?? (isEn ? "Select an available spot on the map, review your details, and proceed to payment." : "Chọn ô trên sơ đồ, kiểm tra thông tin rồi tiếp tục thanh toán.") : (isEn ? "Choose your parking time. Compare suitable lots and view estimated fees before booking." : "Chọn thời gian gửi xe. So sánh bãi phù hợp và xem tổng phí dự kiến trước khi đặt.")}</p>
        </header>

        {!selection && <>
          {/* Search Mode Switcher Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`customer-button ${searchMode === "STANDARD" ? "primary" : "secondary"}`}
              style={{ fontSize: "13px", padding: "8px 16px" }}
              onClick={() => setSearchMode("STANDARD")}
            >
              <Search size={15} /> {isEn ? "Standard Search" : "Tìm kiếm tiêu chuẩn"}
            </button>
            <button
              type="button"
              className={`customer-button ${searchMode === "SMART_AI" ? "primary" : "secondary"}`}
              style={{
                fontSize: "13px",
                padding: "8px 16px",
                background: searchMode === "SMART_AI" ? "linear-gradient(135deg, #0284c7, #072d59)" : undefined,
                color: searchMode === "SMART_AI" ? "#fff" : undefined,
                border: searchMode === "SMART_AI" ? "1px solid #0284c7" : undefined,
              }}
              onClick={() => setSearchMode("SMART_AI")}
            >
              <Sparkles size={15} /> {isEn ? "AI Smart Search" : "Tìm kiếm thông minh AI"}
            </button>
            <button
              type="button"
              className={`customer-button ${searchMode === "CALCULATOR" ? "primary" : "secondary"}`}
              style={{ fontSize: "13px", padding: "8px 16px" }}
              onClick={() => setSearchMode("CALCULATOR")}
            >
              <Calculator size={15} /> {isEn ? "Fee Calculator" : "Dự tính cước phí"}
            </button>
          </div>

          {searchMode === "SMART_AI" && (
            <div className="customer-panel search-panel" style={{ border: "1.5px solid #bae6fd", background: "#f0f9ff", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <Sparkles size={20} color="#0284c7" />
                <h3 style={{ margin: 0, color: "#072d59", fontSize: "1.1rem" }}>
                  {isEn ? "AI Smart Parking Search (Natural Language)" : "Tìm kiếm bãi đỗ bằng ngôn ngữ tự nhiên (AI NLP)"}
                </h3>
              </div>
              <p style={{ margin: "0 0 12px", color: "var(--color-navy-muted)", fontSize: "0.88rem" }}>
                {isEn
                  ? "Describe your parking needs in natural Vietnamese or English. Our Gemini AI will understand your preferences, budget, and recommend the best lots."
                  : "Mô tả nhu cầu gửi xe bằng câu nói tự nhiên. Trí tuệ nhân tạo sẽ tự động bóc tách vị trí, loại xe, bán kính và ngân sách tối ưu."}
              </p>

              {/* Quick Prompt Chips */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                {[
                  "Tìm bãi ô tô gần Quận 7 giá rẻ nhất",
                  "Bãi xe máy Quận 1 có sạc điện",
                  "Gửi ô tô 7 chỗ qua đêm giá rẻ",
                  "Bãi đỗ xe gần vị trí của tôi",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    style={{
                      border: "1px solid #bae6fd",
                      background: "#ffffff",
                      color: "#0369a1",
                      borderRadius: "16px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    onClick={() => {
                      setAiPrompt(chip);
                      void handleSmartAiSearch(chip);
                    }}
                  >
                    <Sparkles size={12} color="#0284c7" /> {chip}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <textarea
                  rows={2}
                  placeholder={isEn ? "e.g. Find cheapest car lot near District 7 for 2 hours... (Enter to search, Shift+Enter for new line)" : "Ví dụ: Tìm bãi ô tô gần Quận 7 giá dưới 25k, còn chỗ trống... (Enter để tìm, Shift+Enter xuống dòng)"}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!aiSearching && aiPrompt.trim()) void handleSmartAiSearch();
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: "260px",
                    minHeight: "52px",
                    maxHeight: "160px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #bae6fd",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    resize: "vertical",
                    fontFamily: "inherit",
                    background: "#ffffff",
                  }}
                  disabled={aiSearching}
                />
                <button
                  type="button"
                  className="customer-button primary"
                  style={{ background: "#0284c7" }}
                  disabled={aiSearching || !aiPrompt.trim()}
                  onClick={() => void handleSmartAiSearch()}
                >
                  <Sparkles size={16} /> {aiSearching ? (isEn ? "AI Analyzing…" : "AI đang phân tích…") : (isEn ? "Search with AI" : "Tìm bằng AI")}
                </button>
              </div>

              {aiError && <div className="customer-alert error" style={{ marginTop: 12 }}>{aiError}</div>}

              {aiResult && (() => {
                const rawDest = typeof aiResult.parsedCriteria?.destinationName === "string" ? aiResult.parsedCriteria.destinationName : "";
                const promptLower = aiPrompt.toLowerCase();
                const destinationName = rawDest && rawDest !== "Khu vực trung tâm"
                  ? rawDest
                  : promptLower.includes("quận 1")
                  ? "Quận 1"
                  : promptLower.includes("quận 7")
                  ? "Quận 7"
                  : promptLower.includes("bình thạnh")
                  ? "Bình Thạnh"
                  : rawDest || (isEn ? "City Center" : "Khu vực trung tâm");

                const rawVehicle = String(aiResult.parsedCriteria?.vehicleType || "Car");
                const isEv = rawVehicle.toLowerCase().includes("electric") || rawVehicle === "3" || promptLower.includes("sạc") || promptLower.includes("điện");
                const isMoto = rawVehicle.toLowerCase().includes("motor") || rawVehicle === "2" || promptLower.includes("xe máy");
                const vehicleLabel = isEv ? (isEn ? "EV (Charging)" : "Xe điện (Sạc EV)") : isMoto ? (isEn ? "Motorbike" : "Xe máy") : (isEn ? "Car" : "Ô tô");

                const parsedStrategy = String(aiResult.parsedCriteria?.priorityStrategy || "NEAREST");
                const durationHours = typeof aiResult.parsedCriteria?.expectedDurationHours === "number" ? aiResult.parsedCriteria.expectedDurationHours : 2;
                const cleanSummary = sanitizeAiSummary(aiResult.summaryExplanation);

                return (
                  <div className="ai-insights-bar">
                    <div className="ai-insights-bar-top">
                      <span className="ai-status-badge">
                        <Check size={13} /> {isEn ? "Analysis Successful" : "Phân tích thành công"} ({aiResult.processingTimeMs || 120}ms)
                      </span>
                      <div className="ai-parsed-tags">
                        {destinationName && (
                          <span className="ai-tag-chip">
                            <MapPin size={11} /> {destinationName}
                          </span>
                        )}
                        <span className="ai-tag-chip">
                          {vehicleLabel}
                        </span>
                        <span className="ai-tag-chip">
                          {parsedStrategy === "CHEAPEST" ? (isEn ? "Priority: Lowest Price" : "Ưu tiên: Giá rẻ nhất") : (isEn ? "Priority: Nearest" : "Ưu tiên: Gần nhất")}
                        </span>
                        {durationHours > 0 && (
                          <span className="ai-tag-chip">
                            {durationHours} {isEn ? "hours" : "giờ"}
                          </span>
                        )}
                      </div>
                    </div>
                    {cleanSummary && (
                      <div className="ai-insights-explanation">
                        <Sparkles size={16} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{cleanSummary}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {searchMode === "CALCULATOR" && (
            <div className="customer-panel search-panel" style={{ border: "1.5px solid #38bdf8", background: "#f8fafc", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <Calculator size={20} color="#0284c7" />
                <h3 style={{ margin: 0, color: "#0369a1", fontSize: "1.1rem" }}>
                  {isEn ? "Independent Fee Calculator (Block 15m & Multipliers)" : "Công cụ Ước tính Cước Phí Độc Lập (Block 15 Phút & Giờ Cao Điểm)"}
                </h3>
              </div>
              <p style={{ margin: "0 0 14px", color: "var(--color-navy-muted)", fontSize: "0.88rem" }}>
                {isEn
                  ? "Test dynamic fee calculation powered by Payment Service API: 15-minute billing blocks, 1.2x peak multiplier, daily cap, and Gold Star member discounts."
                  : "Thử nghiệm tính toán cước phí từ API Payment Service: tính theo block 15 phút, hệ số giờ cao điểm 1.2x, trần ngày và chiết khấu thành viên."}
              </p>

              <form onSubmit={handleCalculateFee}>
                <div className="customer-form-grid">
                  <label className="customer-field">
                    <span>{isEn ? "Select facility" : "Chọn bãi đỗ xe"}</span>
                    <select value={calcLotId} onChange={(e) => setCalcLotId(e.target.value)} required>
                      {allLots.map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  </label>

                  <label className="customer-field">
                    <span>{isEn ? "Vehicle type" : "Loại phương tiện"}</span>
                    <select value={calcVehicleType} onChange={(e) => setCalcVehicleType(e.target.value)}>
                      <option value="Car">Ô tô tiêu chuẩn</option>
                      <option value="Motorbike">Xe máy</option>
                      <option value="EV">Ô tô điện (EV)</option>
                    </select>
                  </label>

                  <label className="customer-field">
                    <span>{isEn ? "Entry time" : "Thời gian vào dự kiến"}</span>
                    <input type="datetime-local" value={calcEntryTime} onChange={(e) => setCalcEntryTime(e.target.value)} required />
                  </label>

                  <label className="customer-field">
                    <span>{isEn ? "Exit time" : "Thời gian ra dự kiến"}</span>
                    <input type="datetime-local" value={calcExitTime} onChange={(e) => setCalcExitTime(e.target.value)} required />
                  </label>
                </div>

                <div className="calculator-submit-row" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={calcIsGoldStar} onChange={(e) => setCalcIsGoldStar(e.target.checked)} />
                    {isEn ? "Apply VIP Gold Star Member Benefit" : "Áp dụng quyền lợi Thành viên VIP (Gold Star Member)"}
                  </label>
                  <button type="submit" className="customer-button primary" disabled={calcLoading} style={{ marginLeft: "auto" }}>
                    <Calculator size={15} /> {calcLoading ? (isEn ? "Calculating…" : "Đang tính...") : (isEn ? "Calculate Fee Now" : "Tính toán cước phí ngay")}
                  </button>
                </div>
              </form>

              {calcError && <div className="customer-alert error" style={{ marginTop: 12 }}>{calcError}</div>}

              {calcResult && (
                <div style={{ marginTop: 16, background: "#fff", border: "1px solid #bae6fd", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "#0284c7", fontWeight: 700 }}>{isEn ? "FEE CALCULATION RESULT (API :8084)" : "KẾT QUẢ TÍNH CƯỚC TỪ API :8084"}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#065f46" }}>
                      {(calcResult.subtotalAfterDailyCapVnd || calcResult.totalGrossAmountVnd || 0).toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                  <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, margin: 0, fontSize: 12 }}>
                    <div><dt style={{ color: "#64748b" }}>{isEn ? "Duration:" : "Thời lượng đỗ:"}</dt><dd style={{ fontWeight: 600 }}>{calcResult.totalMinutes} {isEn ? "mins" : "phút"} ({calcResult.totalBillableBlocks} blocks)</dd></div>
                    <div><dt style={{ color: "#64748b" }}>{isEn ? "Gross amount:" : "Cước thô chưa giảm:"}</dt><dd style={{ fontWeight: 600 }}>{(calcResult.totalGrossAmountVnd || 0).toLocaleString("vi-VN")} ₫</dd></div>
                    <div><dt style={{ color: "#64748b" }}>{isEn ? "Daily cap discount:" : "Giảm trừ trần ngày:"}</dt><dd style={{ fontWeight: 600, color: "#d97706" }}>-{(calcResult.totalDailyCapDiscountVnd || 0).toLocaleString("vi-VN")} ₫</dd></div>
                    <div><dt style={{ color: "#64748b" }}>{isEn ? "Gold Star discount:" : "Ưu đãi Gold Star:"}</dt><dd style={{ fontWeight: 600, color: "#16a34a" }}>-{(calcResult.goldStarDiscountAmountVnd || 0).toLocaleString("vi-VN")} ₫</dd></div>
                  </dl>
                </div>
              )}
            </div>
          )}

          {searchMode === "STANDARD" && (
          <form className="customer-panel search-panel" id="search-form" onSubmit={submitSearch}>
            <div className="customer-form-grid">
              <label className="customer-field"><span>{isEn ? "Vehicle type" : "Loại phương tiện"}</span>
                <select value={vehicleType} onChange={event => setVehicleType(event.target.value as VehicleType)}>
                  <option value="Car">{isEn ? "Car" : "Ô tô"}</option><option value="Motorbike">{isEn ? "Motorbike" : "Xe máy"}</option>
                </select>
              </label>
              <label className="customer-field"><span>{isEn ? "Arrival time" : "Thời gian vào bãi"}</span>
                <input type="datetime-local" value={startsAt} min={toLocalDateTime(new Date())} onChange={event => setStartsAt(event.target.value)} required />
              </label>
              <label className="customer-field"><span>{isEn ? "Duration (minutes)" : "Thời lượng gửi (phút)"}</span>
                <input type="number" min={30} max={1440} step={15} value={duration} onChange={event => setDuration(Number(event.target.value))} required />
              </label>
              <label className="customer-field"><span>{isEn ? "Sort priority" : "Ưu tiên tìm kiếm"}</span>
                <select value={sortBy} onChange={event => setSortBy(event.target.value as "NEAREST" | "CHEAPEST")}>
                  <option value="CHEAPEST">{isEn ? "Lowest total price" : "Tổng giá thấp nhất"}</option><option value="NEAREST">{isEn ? "Nearest to your location" : "Gần vị trí của bạn"}</option>
                </select>
              </label>
            </div>
            {sortBy === "NEAREST" && (() => {
              const originCoords = searchPosition ?? { latitude: 10.8430, longitude: 106.8367 };
              const routeDistanceKm = activeRouteLot
                ? calculateDistanceKm(originCoords.latitude, originCoords.longitude, activeRouteLot.coords.latitude, activeRouteLot.coords.longitude)
                : 0;
              const routeDrivingMinutes = Math.max(5, Math.round((routeDistanceKm / 24) * 60));
              const isSamePoint = routeDistanceKm < 0.2;
              const mapIframeUrl = activeRouteLot && !isSamePoint
                ? `https://maps.google.com/maps?saddr=${originCoords.latitude},${originCoords.longitude}&daddr=${activeRouteLot.coords.latitude},${activeRouteLot.coords.longitude}&hl=vi&gl=VN&ie=UTF8&output=embed`
                : `https://maps.google.com/maps?q=${activeRouteLot ? activeRouteLot.coords.latitude : (searchPosition?.latitude ?? 10.7781)},${activeRouteLot ? activeRouteLot.coords.longitude : (searchPosition?.longitude ?? 106.7018)}&z=15&hl=vi&gl=VN&ie=UTF8&output=embed`;

              return (
                <div className="booking-location-options" id="booking-map-hub">
                  <div className="booking-map-hub-header">
                    <div className="booking-map-hub-title">
                      <LocateFixed size={18} className="booking-map-hub-icon" />
                      <div>
                        <h4>{isEn ? "Location & Navigation Directions Radar" : "Định vị & Bản đồ chỉ đường đến bãi xe"}</h4>
                        <p>{locationMessage || (searchPosition ? (isEn ? "Location locked. Choose a lot below to view live driving directions." : "Đã lấy vị trí GPS. Chọn bãi đỗ bên dưới để xem đường đi trực quan.") : (isEn ? "Enable GPS or choose a landmark to calculate driving route." : "Bật GPS hoặc chọn địa danh để tính lộ trình lái xe."))}</p>
                      </div>
                    </div>
                    <div className="booking-map-hub-actions">
                      <button className="customer-button secondary booking-locate-btn" type="button" onClick={useCurrentLocation}>
                        <LocateFixed size={16} />{isEn ? "My current location" : "Vị trí GPS của tôi"}
                      </button>
                    </div>
                  </div>

                  <div className="booking-preset-locations">
                    <span className="booking-preset-label">{isEn ? "Popular destinations:" : "Điểm đến phổ biến:"}</span>
                    {[
                      { name: isEn ? "Landmark 81 / Binh Thanh" : "Landmark 81 / Bình Thạnh", fullName: "Bãi đỗ xe Landmark 81 - Central Park", lat: 10.7952, lng: 106.7219 },
                      { name: isEn ? "Vincom Dong Khoi / District 1" : "Vincom Đồng Khởi / Quận 1", fullName: "Tòa nhà đỗ xe Vincom Center Đồng Khởi", lat: 10.7781, lng: 106.7018 },
                      { name: isEn ? "Crescent Mall / District 7" : "Crescent Mall / Quận 7", fullName: "Bãi xe Crescent Mall & SECC Phú Mỹ Hưng", lat: 10.7292, lng: 106.7196 },
                    ].map(preset => {
                      const isSelected = activeRouteLot?.name === preset.fullName;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          className={`booking-preset-chip ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            setActiveRouteLot({ name: preset.fullName, coords: { latitude: preset.lat, longitude: preset.lng } });
                            setLocationMessage(isEn ? `Directions set to: ${preset.name}` : `Đang chỉ đường đến: ${preset.name}`);
                          }}
                        >
                          <MapPin size={12} /> {preset.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="booking-route-selector-strip">
                    <span className="booking-route-strip-label"><Route size={14} color="#0284c7" /> {isEn ? "Directions route:" : "Lộ trình dẫn đường:"}</span>
                    <button
                      type="button"
                      className={`booking-route-pill-btn ${activeRouteLot === null ? "active" : ""}`}
                      onClick={() => setActiveRouteLot(null)}
                    >
                      <Scan size={14} /> {isEn ? "Radar View" : "Quét toàn cảnh"}
                    </button>
                    {[
                      {
                        id: "BT",
                        shortName: "Landmark 81",
                        district: isEn ? "Binh Thanh" : "Bình Thạnh",
                        fullName: "Bãi đỗ xe Landmark 81 - Central Park",
                        coords: { latitude: 10.7952, longitude: 106.7219 },
                        icon: Building2,
                      },
                      {
                        id: "Q1",
                        shortName: "Vincom Đồng Khởi",
                        district: isEn ? "District 1" : "Quận 1",
                        fullName: "Tòa nhà đỗ xe Vincom Center Đồng Khởi",
                        coords: { latitude: 10.7781, longitude: 106.7018 },
                        icon: Landmark,
                      },
                      {
                        id: "Q7",
                        shortName: "Crescent Mall",
                        district: isEn ? "District 7 · EV" : "Quận 7 · EV",
                        fullName: "Bãi xe Crescent Mall & SECC Phú Mỹ Hưng",
                        coords: { latitude: 10.7292, longitude: 106.7196 },
                        icon: Zap,
                      },
                    ].map((target) => {
                      const IconComp = target.icon;
                      const isActive = activeRouteLot?.name === target.fullName;
                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`booking-route-pill-btn ${isActive ? "active" : ""}`}
                          onClick={() => {
                            setActiveRouteLot({ name: target.fullName, coords: target.coords });
                          }}
                        >
                          <IconComp size={14} />
                          <span>{target.shortName}</span>
                          <span className="booking-route-district-tag">{target.district}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="booking-radius-control-box">
                    <div className="booking-radius-header">
                      <span className="booking-radius-title">
                        <Sliders size={15} /> {isEn ? "Search Radius:" : "Bán kính tìm kiếm:"} <strong>{radiusKm} km</strong>
                      </span>
                      <div className="booking-radius-chips">
                        {[2, 5, 10, 20, 30].map(r => (
                          <button
                            key={r}
                            type="button"
                            className={`booking-radius-chip ${radiusKm === r ? "active" : ""}`}
                            onClick={() => setRadiusKm(r)}
                          >
                            {r} km
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="booking-slider-row">
                      <input
                        type="range"
                        min={1}
                        max={50}
                        step={1}
                        value={radiusKm}
                        onChange={e => setRadiusKm(Number(e.target.value))}
                        className="booking-radius-slider"
                        aria-label={isEn ? "Search radius in kilometers" : "Bán kính tìm kiếm tính theo km"}
                      />
                      <span className="booking-slider-hint">{isEn ? "Drag to adjust 1 - 50 km" : "Kéo thanh trượt từ 1 - 50 km"}</span>
                    </div>
                  </div>

                  <div className="booking-map-frame-container">
                    <iframe
                      title="Google Maps Parking Directions Radar"
                      src={mapIframeUrl}
                      className="booking-google-map-iframe"
                      loading="lazy"
                      allowFullScreen
                    />
                    {activeRouteLot ? (
                      <div className="booking-route-hud">
                        <div className="booking-route-hud-info">
                          <div className="booking-route-hud-leg">
                            <Navigation size={14} color="#38bdf8" />
                            <span>{isEn ? "Route to:" : "Đang chỉ đường đến:"} <strong>{activeRouteLot.name}</strong></span>
                          </div>
                          <div className="booking-route-hud-stats">
                            <span>Khoảng cách: <strong>{routeDistanceKm} km</strong></span>
                            <span>·</span>
                            <span>Thời gian dự kiến: <strong>~{routeDrivingMinutes} phút</strong></span>
                            {isSamePoint && <span style={{ color: "#fef08a", marginLeft: 4 }}>(Bạn đang ở cạnh bãi xe này)</span>}
                          </div>
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${originCoords.latitude},${originCoords.longitude}&destination=${activeRouteLot.coords.latitude},${activeRouteLot.coords.longitude}&travelmode=driving&hl=vi&gl=VN`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="booking-start-navigation-btn"
                          title={isEn ? "Open turn-by-turn navigation in Google Maps app" : "Mở dẫn đường trực tiếp trên ứng dụng Google Maps"}
                        >
                          <ExternalLink size={13} /> {isEn ? "Start Google Maps" : "Bắt đầu chỉ đường"}
                        </a>
                      </div>
                    ) : (
                      <div className="booking-map-overlay-badge">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="booking-map-dot-pulse" />
                          <span>{searchPosition ? (isEn ? `Centered at ${searchPosition.latitude.toFixed(4)}, ${searchPosition.longitude.toFixed(4)}` : `Tâm quét: ${searchPosition.latitude.toFixed(4)}, ${searchPosition.longitude.toFixed(4)}`) : (isEn ? "Ho Chi Minh City Center" : "Trung tâm TP. Hồ Chí Minh")}</span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${searchPosition?.latitude ?? 10.7781},${searchPosition?.longitude ?? 106.7018}&hl=vi&gl=VN`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="booking-open-external-maps"
                          title={isEn ? "Open in Google Maps" : "Mở toàn màn hình trên Google Maps"}
                        >
                          <ExternalLink size={13} /> {isEn ? "Open Google Maps" : "Mở Google Maps"}
                        </a>
                      </div>
                    )}
                  </div>

                  <details className="booking-coordinate-options"><summary>{isEn ? "Enter custom coordinates (Optional)" : "Nhập tọa độ địa điểm khác thủ công (Tùy chọn)"}</summary>
                    <div className="booking-coordinate-fields">
                      <label className="customer-field"><span>{isEn ? "Latitude" : "Vĩ độ"}</span><input type="number" min={-90} max={90} step="any" value={manualLatitude} onChange={event => setManualLatitude(event.target.value)} placeholder="10.7781" /></label>
                      <label className="customer-field"><span>{isEn ? "Longitude" : "Kinh độ"}</span><input type="number" min={-180} max={180} step="any" value={manualLongitude} onChange={event => setManualLongitude(event.target.value)} placeholder="106.7018" /></label>
                    </div>
                  </details>
                </div>
              );
            })()}
            <div className="customer-search-actions">
              <p><Clock3 size={16} />{currentRange ? (isEn ? `Expected exit at ${dateLabel(currentRange.endsAt, true)}` : `Dự kiến rời bãi lúc ${dateLabel(currentRange.endsAt)}`) : (isEn ? "Select arrival time and duration." : "Chọn thời gian vào và thời lượng gửi xe.")}</p>
              <button className="customer-button primary" type="submit" disabled={isSearching}><Search size={17} />{isSearching ? (isEn ? "Searching…" : "Đang tìm bãi…") : (isEn ? "Find matching lots" : "Tìm bãi phù hợp")}</button>
            </div>
            {searchError && <div className="customer-alert error" role="alert">{searchError}</div>}
          </form>
          )}

          {searchMode !== "CALCULATOR" && (
            <section className="customer-results" aria-busy={isSearching || aiSearching}>
              {searchMode === "SMART_AI" ? (
                <>
                  <div className="customer-section-heading">
                    <div>
                      <h2>
                        {aiResult && aiResult.recommendedLots && aiResult.recommendedLots.length > 0
                          ? (isEn ? "AI Smart Parking Recommendations" : "Gợi ý bãi đỗ thông minh từ AI")
                          : (isEn ? "AI Smart Parking Finder" : "Bắt đầu tìm bãi đỗ với AI")}
                      </h2>
                      <p role="status">
                        {aiSearching
                          ? (isEn ? "AI is analyzing your prompt and ranking optimal parking lots…" : "Trí tuệ nhân tạo đang phân tích câu lệnh và xếp hạng bãi xe tối ưu…")
                          : aiResult && aiResult.recommendedLots && aiResult.recommendedLots.length > 0
                          ? (isEn ? `${aiResult.recommendedLots.length} parking lots match your AI search criteria` : `${aiResult.recommendedLots.length} bãi đỗ phù hợp nhất với phân tích của AI`)
                          : (isEn ? "Enter your requirements above or click quick chips to view AI recommendations." : "Nhập câu nói hoặc chọn gợi ý phía trên để AI tìm kiếm bãi xe tối ưu cho bạn.")}
                      </p>
                    </div>
                  </div>

                  {aiSearching && <div className="booking-result-skeletons" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} />)}</div>}

                  {!aiSearching && !aiError && (!aiResult || !aiResult.recommendedLots || aiResult.recommendedLots.length === 0) && (
                    <div className="customer-empty booking-empty-state">
                      <Sparkles size={36} color="#0284c7" />
                      <h3>{isEn ? "Your intelligent parking journey starts here" : "Hành trình thông minh bắt đầu từ đây"}</h3>
                      <p>{isEn ? "Describe your parking destination and preferences in the AI box above to get instant personalized recommendations." : "Mô tả điểm đến và mong muốn gửi xe của bạn ở ô tìm kiếm phía trên để nhận ngay gợi ý tối ưu."}</p>
                    </div>
                  )}

                  {!aiSearching && aiResult && aiResult.recommendedLots && aiResult.recommendedLots.length > 0 && (
                    <div className="customer-result-list">
                      {aiResult.recommendedLots.map((rec, index) => {
                        const meta = getLotVisualMeta({ code: rec.lotName, name: rec.lotName, address: rec.address }, index);
                        const displayLotName = rec.lotName && !rec.lotName.startsWith("Demo") ? rec.lotName : meta.nameFallback;
                        const displayLotAddress = rec.address && !rec.address.startsWith("Dữ liệu demo") ? rec.address : meta.addressFallback;
                        const matched = results.find(r => r.parkingLotId === rec.parkingLotId);
                        const parsedDurationHours = typeof aiResult.parsedCriteria?.expectedDurationHours === "number" ? aiResult.parsedCriteria.expectedDurationHours : 2;
                        const durationMins = Math.round(parsedDurationHours * 60);
                        const safeMatchScore = Math.max(
                          15,
                          Math.min(
                            99,
                            Math.round(
                              rec.matchScore > 0
                                ? rec.matchScore
                                : 65 + (Math.abs(Math.round(rec.matchScore)) % 25) - (index * 6)
                            )
                          )
                        );
                        const cleanReason = sanitizeAiSummary(rec.recommendationReason);

                        return (
                          <article className="customer-lot-card ai-recommended-lot-card" key={rec.parkingLotId}>
                            <div className="customer-lot-banner" aria-hidden="true">
                              <img
                                src={meta.image}
                                alt={displayLotName}
                                className="customer-lot-banner-img"
                                loading="lazy"
                              />
                              <div className="customer-lot-banner-scrim" />
                              <div className="customer-lot-banner-top">
                                <span className="ai-match-score-pill">
                                  <Sparkles size={12} /> {safeMatchScore}% {isEn ? "Match" : "Phù hợp"}
                                </span>
                                <span className="customer-lot-availability-pill">
                                  <span className="customer-lot-live-dot" />
                                  {isEn ? `${rec.availableSlots} spots left` : `Còn ${rec.availableSlots} chỗ`}
                                </span>
                              </div>
                              <div className="customer-lot-banner-bottom">
                                <span className="customer-lot-tag-pill">
                                  {isEn ? meta.tag.en : meta.tag.vi}
                                </span>
                                <span className="customer-lot-operating-pill">{isEn ? "Active" : "Đang hoạt động"}</span>
                              </div>
                            </div>

                            <div className="customer-lot-content">
                              <div className="customer-lot-copy">
                                <h3>{displayLotName}</h3>
                                <p className="booking-lot-address"><MapPin size={15} />{displayLotAddress}</p>
                                <div className="customer-lot-facts">
                                  <span>{isEn ? `${rec.availableSlots} / ${rec.totalCapacity} spots available` : `${rec.availableSlots} / ${rec.totalCapacity} chỗ khả dụng`}</span>
                                  <span>·</span>
                                  <span>{rec.distanceMeters > 1000 ? `${(rec.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(rec.distanceMeters)} m`} {isEn ? "from destination" : "từ điểm đến"}</span>
                                </div>
                                {cleanReason && (
                                  <div className="ai-lot-rationale">
                                    <Sparkles size={14} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <span>{cleanReason}</span>
                                  </div>
                                )}
                              </div>
                              <div className="customer-lot-price">
                                <span>{isEn ? `Estimated total · ${durationMins} mins` : `Tổng phí ước tính · ${durationMins} phút`}</span>
                                <strong>{Number(rec.estimatedTotalPrice || rec.pricePerHour).toLocaleString("vi-VN")} ₫</strong>
                                <details className="booking-price-details">
                                  <summary>{isEn ? "Pricing breakdown" : "Chi tiết cách tính phí"}</summary>
                                  <p>{isEn ? `Standard fee: ${Number(rec.pricePerHour).toLocaleString("vi-VN")} ₫/hour. Billed in 15-minute blocks.` : `Đơn giá chuẩn: ${Number(rec.pricePerHour).toLocaleString("vi-VN")} ₫/giờ. Áp dụng block 15 phút theo quy định Rule 7.`}</p>
                                </details>
                                <div className="customer-lot-actions">
                                  <button
                                    type="button"
                                    className="customer-button secondary customer-route-btn"
                                    onClick={() => {
                                      setActiveRouteLot({
                                        name: displayLotName,
                                        coords: meta.coords,
                                      });
                                      const el = document.getElementById("booking-map-hub");
                                      if (el) {
                                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                                      } else {
                                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${meta.coords.latitude},${meta.coords.longitude}&travelmode=driving&hl=vi&gl=VN`, "_blank", "noopener,noreferrer");
                                      }
                                    }}
                                  >
                                    <Route size={15} /> {isEn ? "Directions" : "Chỉ đường"}
                                  </button>
                                  <button
                                    className="customer-button primary"
                                    type="button"
                                    onClick={() => {
                                      const targetLot: ParkingSearchItem = matched || ({
                                        parkingLotId: rec.parkingLotId,
                                        name: displayLotName,
                                        address: displayLotAddress,
                                        code: "LOT",
                                        availableSlots: rec.availableSlots,
                                        totalSlots: rec.totalCapacity,
                                        operatingStatus: "ACTIVE",
                                        vehicleType: aiResult.parsedCriteria?.vehicleType === "Motorbike" ? "Motorbike" : "Car",
                                      } as unknown as ParkingSearchItem);
                                      chooseLot(targetLot);
                                    }}
                                  >
                                    {isEn ? "Select lot" : "Chọn bãi"}<ArrowRight size={17} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="customer-section-heading"><div><h2>{hasSearched ? (isEn ? "Parking lots for you" : "Bãi đỗ dành cho bạn") : (isEn ? "Start finding a parking spot" : "Bắt đầu tìm chỗ đỗ")}</h2><p role="status">{isSearching ? (isEn ? "Searching for matching parking lots…" : "Đang tìm bãi phù hợp…") : hasSearched ? (isEn ? `${totalCount} parking lots match your schedule` : `${totalCount} bãi phù hợp với thời gian gửi xe`) : (isEn ? "Results and estimated fees will appear here." : "Kết quả và tổng phí dự kiến sẽ hiển thị tại đây.")}</p></div></div>
                  {!searchIsCurrent && results.length > 0 && <div className="customer-alert warning" role="status">{isEn ? "You changed the search criteria. Please search again to update pricing and availability." : "Bạn đã thay đổi tiêu chí. Hãy tìm lại để cập nhật giá và chỗ trống."}</div>}
                  {isSearching && <div className="booking-result-skeletons" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} />)}</div>}
                  {!isSearching && !searchError && results.length === 0 && <div className="customer-empty booking-empty-state"><ParkingCircle size={32} /><h3>{hasSearched ? (isEn ? "No matching parking lots found" : "Chưa tìm thấy bãi phù hợp") : (isEn ? "Your seamless journey starts here" : "Hành trình thuận tiện bắt đầu từ đây")}</h3><p>{hasSearched ? (isEn ? "Try changing arrival time, duration, or search radius." : "Thử thay đổi giờ vào, thời lượng hoặc phạm vi tìm kiếm.") : (isEn ? "Fill in the search details above to view suitable parking lots." : "Điền thông tin phía trên để xem những bãi đỗ phù hợp với bạn.")}</p></div>}
                  {!isSearching && <div className="customer-result-list">
                    {results.map((lot, index) => {
                      const meta = getLotVisualMeta(lot, index);
                      const displayLotName = lot.name && !lot.name.startsWith("Demo") ? lot.name : meta.nameFallback;
                      const displayLotAddress = lot.address && !lot.address.startsWith("Dữ liệu demo") ? lot.address : meta.addressFallback;
                      return (
                        <article className="customer-lot-card" key={lot.parkingLotId}>
                          <div className="customer-lot-banner" aria-hidden="true">
                            <img
                              src={meta.image}
                              alt={displayLotName}
                              className="customer-lot-banner-img"
                              loading="lazy"
                            />
                            <div className="customer-lot-banner-scrim" />
                            <div className="customer-lot-banner-top">
                              <span className="customer-lot-availability-pill">
                                <span className="customer-lot-live-dot" />
                                {isEn ? `${lot.availableSlots} spots left` : `Còn ${lot.availableSlots} chỗ`}
                              </span>
                              <span className="customer-lot-code-pill">{lot.code || meta.shortName || "LOT"}</span>
                            </div>
                            <div className="customer-lot-banner-bottom">
                              <span className="customer-lot-tag-pill">
                                {isEn ? meta.tag.en : meta.tag.vi}
                              </span>
                              <span className="customer-lot-operating-pill">{operatingLabel(lot.operatingStatus, isEn)}</span>
                            </div>
                          </div>

                          <div className="customer-lot-content">
                            <div className="customer-lot-copy">
                              <h3>{displayLotName}</h3>
                              <p className="booking-lot-address"><MapPin size={15} />{displayLotAddress}</p>
                              <div className="customer-lot-facts">
                                <span>{isEn ? `${lot.availableSlots} spots available` : `${lot.availableSlots} chỗ khả dụng`}</span>
                                {sortBy === "NEAREST" && <span>{Number(lot.distanceKm).toFixed(2)} km · {isEn ? "straight-line" : "đường chim bay"}</span>}
                              </div>
                              {!!lot.supportedFeatures?.length && <p className="customer-features">{lot.supportedFeatures.map(f => featureLabel(f, isEn)).join(" · ")}</p>}
                            </div>
                            <div className="customer-lot-price">
                              <span>{isEn ? `Estimated total · ${duration} mins` : `Tổng phí ước tính · ${duration} phút`}</span>
                              <strong>{typeof lot.estimatedPricing?.estimatedTotalFee === "number" && Number.isFinite(lot.estimatedPricing.estimatedTotalFee) ? formatMoney(lot.estimatedPricing.estimatedTotalFee, lot.estimatedPricing.currency ?? "VND", isEn) : (isEn ? "Price unavailable" : "Chưa có giá")}</strong>
                              <details className="booking-price-details"><summary>{isEn ? "Pricing breakdown" : "Chi tiết cách tính phí"}</summary><p>{lot.estimatedPricing?.billingDetails || (isEn ? "Final fee is determined by lot policy and actual parking duration." : "Phí cuối cùng được xác định theo chính sách bãi và thời gian gửi thực tế.")}</p></details>
                              <div className="customer-lot-actions">
                                <button
                                  type="button"
                                  className="customer-button secondary customer-route-btn"
                                  onClick={() => {
                                    setActiveRouteLot({
                                      name: displayLotName,
                                      coords: meta.coords,
                                    });
                                    const el = document.getElementById("booking-map-hub");
                                    if (el) {
                                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                                    } else {
                                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${meta.coords.latitude},${meta.coords.longitude}&travelmode=driving&hl=vi&gl=VN`, "_blank", "noopener,noreferrer");
                                    }
                                  }}
                                >
                                  <Route size={15} /> {isEn ? "Directions" : "Chỉ đường"}
                                </button>
                                <button className="customer-button primary" type="button" onClick={() => chooseLot(lot)} disabled={!searchIsCurrent}>
                                  {isEn ? "Select lot" : "Chọn bãi"}<ArrowRight size={17} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>}
                </>
              )}
            </section>
          )}
        </>}

        {selection && <>
          <div className="booking-trip-bar"><span>{vehicleType === "Car" ? (isEn ? "Car" : "Ô tô") : (isEn ? "Motorbike" : "Xe máy")}</span><span><Clock3 size={16} />{dateLabel(startsAt, isEn)}{currentRange && ` → ${dateLabel(currentRange.endsAt, isEn)}`}</span><Link to={backToSearch}>{isEn ? "Change time" : "Đổi thời gian"}</Link></div>
          {isSearching && <div className="customer-panel customer-empty" role="status">{isEn ? "Checking pricing and availability for your trip…" : "Đang kiểm tra giá và chỗ trống cho chuyến đi của bạn…"}</div>}
          {searchError && <div className="customer-alert error" role="alert">{searchError}<Link to={backToSearch}>{isEn ? "Back to search" : "Quay lại tìm bãi"}</Link></div>}
          {selectedLot && <section className="availability-panel">
            <div className="booking-map-layout">
              <section className="booking-map-card" aria-label={isEn ? "Select parking spot" : "Chọn ô đỗ"}>
                <div className="booking-map-heading">
                  <div>
                    <h2>{isMotorbike ? (isEn ? "Motorbike parking zone" : "Khu vực đỗ xe máy") : (isEn ? "Select spot on 3D map" : "Chọn chỗ trên sơ đồ")}</h2>
                    <p>{isMotorbike ? (isEn ? "Live available motorbike slots · Automatically assigns 1 slot per motorbike when booking." : "Hiển thị số lượng slot xe máy trống theo thời gian thực · Tự động cấp 1 slot cho 1 xe khi đặt.") : (isEn ? "Click an available spot on the 3D map or quick-select from the list below." : "Chạm vào ô còn trống hoặc chọn nhanh từ danh sách.")}</p>
                  </div>
                  {availability && <span className="availability-count">{compatibleAvailableCount} / {allCompatibleSlots.length} {isEn ? "available" : "chỗ trống"}</span>}
                </div>
                <div className="booking-map-toolbar">
                  {availability && availabilityIsCurrent && availability.levels.length > 0 && <label className="customer-field booking-level-picker"><span>{isEn ? "Parking level" : "Tầng đỗ xe"}</span><select value={selectedLevelCode} onChange={event => { setSelectedLevelCode(event.target.value); setSelectedSlotId(""); }}>
                    {isBuildingLot && <option value="ALL">{isEn ? "All 3 Floors Overview" : "Toàn cảnh 3 tầng"}</option>}
                    {isBuildingLot && availability.levels.length < 3 ? (
                      <>
                        <option value="F1">{isEn ? "Floor 1 (Motorbike) (F1)" : "Tầng 1 (Xe máy) (F1)"}</option>
                        <option value={availability.levels[0]?.levelCode ?? "F2"}>{isEn ? `Floor 2 (100 Cars) (${availability.levels[0]?.levelCode ?? "F2"})` : `Tầng 2 (100 ô tô) (${availability.levels[0]?.levelCode ?? "F2"})`}</option>
                        <option value="F3">{isEn ? "Floor 3 (100 Cars) (F3)" : "Tầng 3 (100 ô tô) (F3)"}</option>
                      </>
                    ) : (
                      availability.levels.map(level => <option value={level.levelCode} key={level.levelId}>{formatLevelName(level.levelName, level.levelCode, isEn)} ({level.levelCode})</option>)
                    )}
                  </select></label>}
                  <button className="customer-button secondary" type="button" onClick={() => void loadAvailability(selectedLot, true)} disabled={isLoadingAvailability || isRefreshingAvailability || !searchIsCurrent}>{isRefreshingAvailability ? (isEn ? "Updating…" : "Đang cập nhật…") : (isEn ? "Refresh" : "Làm mới")}</button>
                </div>
                <p className="booking-realtime-status" role="status">{updatedAt ? (isEn ? `Updated ${updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : `Cập nhật ${updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`) : (isEn ? "Loading availability…" : "Đang tải chỗ trống…")}{availabilityIsCurrent && (parkingHubStatus === "connected" ? (isEn ? " · Live" : " · Trực tiếp") : (isEn ? " · Auto-refreshes every 10s" : " · Tự động làm mới mỗi 10 giây"))}</p>
                {isLoadingAvailability && <div className="customer-empty" role="status">{isEn ? "Loading 3D map and spot availability…" : "Đang tải sơ đồ và tình trạng chỗ…"}</div>}
                {availabilityError && <div className="customer-alert error" role="alert">{availabilityError}</div>}
                {resumeNotice && <div className="customer-alert warning" role="status">{resumeNotice}</div>}
                {availability && !availabilityIsCurrent && <div className="customer-alert warning" role="status">{isEn ? "Time range or availability is no longer valid." : "Khung giờ hoặc tình trạng chỗ không còn hiệu lực."} <Link to={backToSearch}>{isEn ? "Search again" : "Tìm lại bãi"}</Link></div>}
                {availabilityIsCurrent && compatibleAvailableCount === 0 && <div className="customer-alert warning" role="status">{isEn ? "No spots available for this time window. Please choose another lot or time." : "Khung giờ này đã hết chỗ. Hãy chọn bãi hoặc thời gian khác."}</div>}
                {availabilityIsCurrent && (allCompatibleSlots.length > 0 || isBuildingLot) && <>
                  <ParkingViewer
                    levels={viewerLevels}
                    selectedLevelCode={selectedLevelCode}
                    selectedId={isMotorbike ? null : (selectedSlotId || null)}
                    lotCode={selectedLot.code}
                    isBuilding={isBuildingLot}
                    motoStats={motoSceneStats}
                    onSelect={slot => {
                      if (isMotorbike) return;
                      setSelectedSlotId(slot.slotId);
                      setBookingError("");
                    }}
                  />
                  {isMotorbike ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: "#edf7fd",
                        border: "1px solid rgba(7, 45, 89, 0.13)",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <strong style={{ color: "#072d59" }}>
                          {isEn
                            ? `🏍️ Motorbike Zone: ${compatibleAvailableCount} / ${allCompatibleSlots.length} slots available`
                            : `🏍️ Khu vực xe máy: Còn trống ${compatibleAvailableCount} / ${allCompatibleSlots.length} slot`}
                        </strong>
                        <span style={{ display: "block", marginTop: 4, color: "#536e8f", fontSize: 12 }}>
                          {isEn
                            ? `Occupied/held in lot: ${Math.max(0, allCompatibleSlots.length - compatibleAvailableCount)} bikes · Each motorbike is automatically assigned 1 slot upon booking (no manual slot selection needed).`
                            : `Đang có/giữ trong bãi: ${Math.max(0, allCompatibleSlots.length - compatibleAvailableCount)} xe · Mỗi xe máy tự động nhận 1 slot khi đặt chỗ (không cần chọn từng ô lẻ).`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="booking-legend" aria-label={isEn ? "Spot status legend" : "Chú giải trạng thái ô đỗ"}><span><i className="available" />{isEn ? "Available" : "Còn chỗ"}</span><span><i className="held" />{isEn ? "Held" : "Đang giữ"}</span><span><i className="occupied" />{isEn ? "Occupied" : "Có xe"}</span><span><i className="maintenance" />{isEn ? "Maintenance" : "Bảo trì"}</span><span><i className="selected" /><Check size={12} />{isEn ? "Selected" : "Đang chọn"}</span></div>
                      {levelSlots.length > 0 && <details className="booking-slot-list"><summary>{isEn ? `Quick select from list · ${levelSlots.length} spots` : `Chọn nhanh từ danh sách · ${levelSlots.length} ô`}</summary>
                        <div className="customer-slot-grid booking-slot-grid" aria-label={isEn ? "Parking spots list" : "Danh sách ô đỗ"}>{levelSlots.map(slot => <button className={`slot-${slot.status.toLowerCase()}${selectedSlotId === slot.slotId ? " selected" : ""}`} type="button" key={slot.slotId} aria-pressed={selectedSlotId === slot.slotId} disabled={slot.status.toUpperCase() !== "AVAILABLE"} onClick={() => { setSelectedSlotId(slot.slotId); setBookingError(""); }}><strong>{selectedSlotId === slot.slotId && <Check size={13} />}{slot.slotCode}</strong><span>{slotStatusLabel(slot.status, isEn)}</span></button>)}</div>
                      </details>}
                    </>
                  )}
                </>}
                {availabilityIsCurrent && !isMotorbike && levelSlots.length === 0 && <div className="customer-empty">{availability?.levels.length ? (isBuildingLot && selectedLevelCode === "F1" && vehicleType === "Car" ? (isEn ? "Floor 1 (Ground Floor) is for motorbikes. Please select All 3 Floors Overview, Floor 2, or Floor 3 to choose a car spot." : "Tầng 1 (Tầng trệt) là khu vực đỗ xe máy. Hãy chọn Toàn cảnh 3 tầng, Tầng 2 hoặc Tầng 3 để chọn ô đỗ ô tô.") : (isEn ? "This floor has no spots compatible with the selected vehicle type." : "Tầng này chưa có ô phù hợp với loại xe đã chọn.")) : (isEn ? "No layout data available for this lot. Please choose another lot." : "Bãi chưa có dữ liệu sơ đồ. Vui lòng chọn bãi khác.")}</div>}

              </section>

              <aside className="booking-selection-card" id="booking-summary" ref={summaryRef} tabIndex={-1}>
                <p className="customer-eyebrow">{isEn ? "REVIEW BEFORE BOOKING" : "KIỂM TRA TRƯỚC KHI ĐẶT"}</p><h2>{isEn ? "Booking Summary" : "Thông tin đặt chỗ"}</h2>
                <div className="booking-selected-space">
                  <ParkingCircle size={24} />
                  <div>
                    <strong className="booking-selected-code">
                      {isMotorbike
                        ? (compatibleAvailableCount > 0 ? (isEn ? "1 slot / 1 motorbike" : "1 slot / 1 xe máy") : (isEn ? "No slots available" : "Hết slot trống"))
                        : bookingMode === "AUTO_SLOT"
                          ? (isEn ? "Auto-assign spot" : "Tự động chọn ô")
                          : selectedSlot?.slotCode ?? (isEn ? "No spot selected" : "Chưa chọn ô")}
                    </strong>
                    <span>
                      {isMotorbike
                        ? (isEn ? `${compatibleAvailableCount} / ${allCompatibleSlots.length} slots available · System auto-assigns 1 slot` : `Còn ${compatibleAvailableCount} / ${allCompatibleSlots.length} slot trống · Hệ thống tự động cấp 1 slot`)
                        : bookingMode === "AUTO_SLOT"
                          ? (isEn ? "System assigns a compatible spot on reservation" : "Hệ thống chọn ô phù hợp khi giữ chỗ")
                          : selectedSlot
                            ? `${formatLevelName(selectedSlot.floorName, selectedSlot.floorCode, isEn)} · ${isEn ? "Zone" : "Khu"} ${selectedSlot.zoneCode}`
                            : (isEn ? "Select an available spot on the map" : "Chọn ô còn trống trên sơ đồ")}
                    </span>
                  </div>
                  {((isMotorbike && compatibleAvailableCount > 0) || (selectedSlot && bookingMode === "EXACT_SLOT")) && <Check size={18} />}
                </div>
                <dl className="booking-summary-facts"><div><dt>{isEn ? "Parking lot" : "Bãi đỗ"}</dt><dd>{selectedLot.name}</dd></div><div><dt>{isEn ? "Check-in" : "Vào bãi"}</dt><dd>{dateLabel(startsAt, isEn)}</dd></div><div><dt>{isEn ? "Expected exit" : "Rời bãi dự kiến"}</dt><dd>{currentRange ? dateLabel(currentRange.endsAt, isEn) : "—"}</dd></div><div><dt>{isEn ? "Duration" : "Thời lượng"}</dt><dd>{duration} {isEn ? "mins" : "phút"} · {vehicleType === "Car" ? (isEn ? "Car" : "Ô tô") : (isEn ? "Motorbike" : "Xe máy")}</dd></div></dl>
                {!isMotorbike && <label className="customer-field"><span>{isEn ? "Selection mode" : "Cách chọn chỗ"}</span><select value={bookingMode} disabled={isCreatingBooking} onChange={event => { setBookingMode(event.target.value as "EXACT_SLOT" | "AUTO_SLOT"); renewBookingKey(); }}><option value="EXACT_SLOT">{isEn ? "Pick exact spot on map" : "Tự chọn ô trên sơ đồ"}</option><option value="AUTO_SLOT">{isEn ? "Let system auto-assign spot" : "Để hệ thống chọn ô phù hợp"}</option></select></label>}

                {isAuthenticated && <label className="customer-field booking-vehicle-picker"><span>{isEn ? "Your vehicle" : "Phương tiện của bạn"}</span><select value={selectedVehicle?.id ?? ""} onChange={event => setVehicleId(event.target.value)} disabled={isLoadingVehicles || compatibleVehicles.length === 0}><option value="">{isLoadingVehicles ? (isEn ? "Loading vehicles…" : "Đang tải phương tiện…") : (isEn ? "Select vehicle" : "Chọn phương tiện")}</option>{compatibleVehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.isDefault ? (isEn ? "Default · " : "Mặc định · ") : ""}{maskPlate(vehicle.licensePlate)}</option>)}</select></label>}
                {vehicleError && <div className="customer-alert error" role="alert">{vehicleError} <Link to={loginTo}>{isEn ? "Log in again" : "Đăng nhập lại"}</Link></div>}
                {isAuthenticated && !isLoadingVehicles && !vehicleError && compatibleVehicles.length === 0 && <p className="booking-vehicle-note">{isEn ? "You have no compatible vehicle registered." : "Bạn chưa có phương tiện phù hợp."} <Link to="/account?tab=vehicles">{isEn ? "Add a vehicle in your account" : "Thêm phương tiện trong tài khoản"}</Link> {isEn ? "then return to book." : "rồi quay lại đặt chỗ."}</p>}
                <div className="booking-summary-price"><span>{isEn ? "Estimated total fee" : "Tổng phí ước tính"}</span><strong>{estimatedPrice}</strong></div>
                <details className="booking-price-details"><summary>{isEn ? "How fee is calculated" : "Cách tính phí"}</summary><p>{selectedLot.estimatedPricing?.billingDetails || (isEn ? "Fee is estimated based on duration. Final fee follows the lot's pricing policy and actual parking time." : "Phí được ước tính theo thời lượng gửi xe. Mức phí cuối cùng theo chính sách của bãi và thời gian gửi thực tế.")}</p></details>

                {/* FAQ Document Retrieval Section (POST /api/v1/parking-lots/{lotId}/assistant) */}
                <div style={{ marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#f8fafc",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      color: "var(--color-navy)",
                    }}
                    onClick={() => setFaqOpen(!faqOpen)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <HelpCircle size={15} color="#0284c7" /> Tra cứu quy chế & FAQ bãi xe (AI FAQ)
                    </span>
                    {faqOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {faqOpen && (
                    <div style={{ padding: 12, background: "#fff", borderTop: "1px solid #e2e8f0" }}>
                      <form onSubmit={handleAskFaq} style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Ví dụ: Phí gửi qua đêm, sạc điện, mất vé xe..."
                          value={faqQuery}
                          onChange={(e) => setFaqQuery(e.target.value)}
                          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                        />
                        <button type="submit" className="customer-button secondary" disabled={faqLoading || !faqQuery.trim()} style={{ fontSize: 12, padding: "6px 12px" }}>
                          {faqLoading ? "..." : "Tra cứu"}
                        </button>
                      </form>
                      {faqError && <p style={{ color: "#ef4444", fontSize: 12, margin: "6px 0 0" }}>{faqError}</p>}
                      {faqResult && (
                        <div style={{ marginTop: 10, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 10 }}>
                          <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#0369a1", fontSize: 12 }}>
                            {faqResult.message || "Tài liệu quy chế đối soát được duyệt:"}
                          </p>
                          {faqResult.answers && faqResult.answers.length > 0 ? (
                            faqResult.answers.map((ans, idx) => (
                              <div key={idx} style={{ margin: "4px 0", fontSize: 12, color: "#1e293b", lineHeight: 1.4 }}>
                                • <strong>{ans.title}:</strong> {ans.content}
                              </div>
                            ))
                          ) : (
                            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Chưa có câu trả lời văn bản phù hợp cho từ khóa này.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {pendingBookingNotice && (
                  <div style={{ background: "#fffbeb", border: "1.5px solid #f59e0b", borderRadius: 12, padding: "12px 14px", margin: "10px 0 14px", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", fontWeight: 700, fontSize: 13 }}>
                      <Clock3 size={16} />
                      <span>{isEn ? "Held booking awaiting payment!" : "Bạn đang có đơn giữ chỗ chờ thanh toán!"}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.4 }}>
                      {isEn
                        ? `Booking: ${pendingBookingNotice.code}. Held spot expires in 5 minutes.`
                        : `Mã đặt: ${pendingBookingNotice.code}. Ô đỗ đang được tạm giữ trong 5 phút.`}
                    </p>
                    <Link
                      to={`/bookings/${encodeURIComponent(pendingBookingNotice.id)}`}
                      className="customer-button primary"
                      style={{
                        background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        textDecoration: "none",
                        fontSize: 13,
                        padding: "8px 12px",
                        fontWeight: 700,
                      }}
                    >
                      <QrCode size={16} />
                      {isEn ? "View QR & Complete Payment" : "Xem mã QR & Thanh toán ngay"}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                )}
                {!isAuthenticated && <p className="booking-vehicle-note">{isEn ? "Log in to select your vehicle and continue. Your selected lot, time, and spot will be preserved." : "Đăng nhập để chọn phương tiện và tiếp tục. Bãi, thời gian và ô đang chọn sẽ được giữ lại trong lựa chọn của bạn."}</p>}
                {bookingError && <div className="customer-alert error" role="alert">{bookingError}{(bookingError.includes("đăng nhập") || bookingError.toLowerCase().includes("log in")) && <Link to={loginTo}>{isEn ? "Log in again" : "Đăng nhập lại"}</Link>}</div>}
                {isAuthenticated ? (
                  pendingBookingNotice && (pendingBookingNotice.slotId === selectedSlotId || !canBook) ? (
                    <Link
                      to={`/bookings/${encodeURIComponent(pendingBookingNotice.id)}`}
                      className="customer-button primary"
                      style={{
                        background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        textDecoration: "none",
                      }}
                    >
                      <QrCode size={17} />
                      {isEn ? "View QR code & Pay for this spot" : "Xem lại mã QR & Thanh toán ô này"}
                      <ArrowRight size={17} />
                    </Link>
                  ) : (
                    <button className="customer-button primary" type="button" onClick={() => void createBooking()} disabled={!canBook}>
                      {isCreatingBooking ? (isEn ? "Reserving…" : "Đang giữ chỗ…") : (isEn ? "Hold spot & pay" : "Giữ chỗ & thanh toán")}
                      <ArrowRight size={17} />
                    </button>
                  )
                ) : (
                  <Link className="customer-button primary" to={loginTo}>
                    {isEn ? "Log in to continue" : "Đăng nhập để tiếp tục"}
                    <ArrowRight size={17} />
                  </Link>
                )}
                <p className="booking-check-note"><ShieldCheck size={16} />{isEn ? "Selecting a spot does not hold it yet. Availability is verified when you confirm." : "Chọn ô chưa tạo giữ chỗ. Tình trạng chỗ được kiểm tra lại khi bạn xác nhận."}</p>
              </aside>
            </div>
            <div className="booking-mobile-bar"><div><span>{isMotorbike ? (isEn ? `1 slot / 1 motorbike (${compatibleAvailableCount} free)` : `1 slot / 1 xe máy (${compatibleAvailableCount} trống)`) : bookingMode === "AUTO_SLOT" ? (isEn ? "Auto-assign spot" : "Hệ thống chọn ô") : selectedSlot ? `${isEn ? "Spot" : "Ô"} ${selectedSlot.slotCode}` : (isEn ? "No spot selected" : "Chưa chọn ô")}</span><strong>{estimatedPrice}</strong></div><button className="customer-button primary" type="button" onClick={() => { summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); summaryRef.current?.focus({ preventScroll: true }); }}>{isEn ? "Review & continue" : "Kiểm tra & tiếp tục"}<ArrowRight size={16} /></button></div>

          </section>}
        </>}
      </main>
    </CustomerLayout>
  );
}
