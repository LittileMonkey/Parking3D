import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, LocateFixed, MapPin, ParkingCircle, Search, ShieldCheck } from "lucide-react";
import { ApiError, api, type LotAvailability, type LotLayout3DDto, type ParkingSearchItem, type ParkingLevelAvailability, type UserVehicle } from "../services/api";
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
            {sortBy === "NEAREST" && <div className="booking-location-options">
              <div className="booking-location-row">
                <button className="customer-button secondary" type="button" onClick={useCurrentLocation}><LocateFixed size={17} />{isEn ? "Use current location" : "Dùng vị trí hiện tại"}</button>
                <label className="customer-field"><span>{isEn ? "Search radius (km)" : "Bán kính tìm kiếm (km)"}</span>
                  <input type="number" min={1} max={50} step={1} value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))} required />
                </label>
                <p className="customer-help-text" role="status">{locationMessage || (searchPosition ? (isEn ? "Search location set. Distance is straight-line." : "Đã có vị trí tìm kiếm. Khoảng cách tính theo đường chim bay.") : (isEn ? "Allow location access to find parking near you." : "Cho phép truy cập vị trí để tìm bãi gần bạn."))}</p>
              </div>
              <details className="booking-coordinate-options"><summary>{isEn ? "Enter custom coordinates" : "Nhập tọa độ địa điểm khác"}</summary>
                <div className="booking-coordinate-fields">
                  <label className="customer-field"><span>{isEn ? "Latitude" : "Vĩ độ"}</span><input type="number" min={-90} max={90} step="any" value={manualLatitude} onChange={event => setManualLatitude(event.target.value)} placeholder="10.7769" /></label>
                  <label className="customer-field"><span>{isEn ? "Longitude" : "Kinh độ"}</span><input type="number" min={-180} max={180} step="any" value={manualLongitude} onChange={event => setManualLongitude(event.target.value)} placeholder="106.7008" /></label>
                </div>
              </details>
            </div>}
            <div className="customer-search-actions">
              <p><Clock3 size={16} />{currentRange ? (isEn ? `Expected exit at ${dateLabel(currentRange.endsAt, true)}` : `Dự kiến rời bãi lúc ${dateLabel(currentRange.endsAt)}`) : (isEn ? "Select arrival time and duration." : "Chọn thời gian vào và thời lượng gửi xe.")}</p>
              <button className="customer-button primary" type="submit" disabled={isSearching}><Search size={17} />{isSearching ? (isEn ? "Searching…" : "Đang tìm bãi…") : (isEn ? "Find matching lots" : "Tìm bãi phù hợp")}</button>
            </div>
            {searchError && <div className="customer-alert error" role="alert">{searchError}</div>}
          </form>

          <section className="customer-results" aria-busy={isSearching}>
            <div className="customer-section-heading"><div><h2>{hasSearched ? (isEn ? "Parking lots for you" : "Bãi đỗ dành cho bạn") : (isEn ? "Start finding a parking spot" : "Bắt đầu tìm chỗ đỗ")}</h2><p role="status">{isSearching ? (isEn ? "Searching for matching parking lots…" : "Đang tìm bãi phù hợp…") : hasSearched ? (isEn ? `${totalCount} parking lots match your schedule` : `${totalCount} bãi phù hợp với thời gian gửi xe`) : (isEn ? "Results and estimated fees will appear here." : "Kết quả và tổng phí dự kiến sẽ hiển thị tại đây.")}</p></div></div>
            {!searchIsCurrent && results.length > 0 && <div className="customer-alert warning" role="status">{isEn ? "You changed the search criteria. Please search again to update pricing and availability." : "Bạn đã thay đổi tiêu chí. Hãy tìm lại để cập nhật giá và chỗ trống."}</div>}
            {isSearching && <div className="booking-result-skeletons" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} />)}</div>}
            {!isSearching && !searchError && results.length === 0 && <div className="customer-empty booking-empty-state"><ParkingCircle size={32} /><h3>{hasSearched ? (isEn ? "No matching parking lots found" : "Chưa tìm thấy bãi phù hợp") : (isEn ? "Your seamless journey starts here" : "Hành trình thuận tiện bắt đầu từ đây")}</h3><p>{hasSearched ? (isEn ? "Try changing arrival time, duration, or search radius." : "Thử thay đổi giờ vào, thời lượng hoặc phạm vi tìm kiếm.") : (isEn ? "Fill in the search details above to view suitable parking lots." : "Điền thông tin phía trên để xem những bãi đỗ phù hợp với bạn.")}</p></div>}
            {!isSearching && <div className="customer-result-list">
              {results.map(lot => <article className="customer-lot-card" key={lot.parkingLotId}>
                <div className="booking-lot-top"><span className="booking-lot-icon"><ParkingCircle size={24} /></span><span className="booking-operating-status">{operatingLabel(lot.operatingStatus, isEn)}</span></div>
                <div className="customer-lot-copy"><span className="customer-lot-code">{lot.code || (isEn ? "PARKING LOT" : "BÃI ĐỖ")}</span><h3>{lot.name}</h3>
                  <p className="booking-lot-address"><MapPin size={15} />{lot.address || (isEn ? "Address not provided" : "Địa chỉ chưa được cung cấp")}</p>
                  <div className="customer-lot-facts"><span>{isEn ? `${lot.availableSlots} spots available` : `${lot.availableSlots} chỗ khả dụng`}</span>{sortBy === "NEAREST" && <span>{Number(lot.distanceKm).toFixed(2)} km · {isEn ? "straight-line" : "đường chim bay"}</span>}</div>
                  {!!lot.supportedFeatures?.length && <p className="customer-features">{lot.supportedFeatures.map(f => featureLabel(f, isEn)).join(" · ")}</p>}
                </div>
                <div className="customer-lot-price"><span>{isEn ? `Estimated total · ${duration} mins` : `Tổng phí ước tính · ${duration} phút`}</span><strong>{typeof lot.estimatedPricing?.estimatedTotalFee === "number" && Number.isFinite(lot.estimatedPricing.estimatedTotalFee) ? formatMoney(lot.estimatedPricing.estimatedTotalFee, lot.estimatedPricing.currency ?? "VND", isEn) : (isEn ? "Price unavailable" : "Chưa có giá")}</strong>
                  <details className="booking-price-details"><summary>{isEn ? "Pricing breakdown" : "Chi tiết cách tính phí"}</summary><p>{lot.estimatedPricing?.billingDetails || (isEn ? "Final fee is determined by lot policy and actual parking duration." : "Phí cuối cùng được xác định theo chính sách bãi và thời gian gửi thực tế.")}</p></details>
                  <button className="customer-button primary" type="button" onClick={() => chooseLot(lot)} disabled={!searchIsCurrent}>{isEn ? "Select lot" : "Chọn bãi"}<ArrowRight size={17} /></button>
                </div>
              </article>)}
            </div>}
          </section>
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
                {isAuthenticated && !isLoadingVehicles && !vehicleError && compatibleVehicles.length === 0 && <p className="booking-vehicle-note">{isEn ? "You have no compatible vehicle registered." : "Bạn chưa có phương tiện phù hợp."} <Link to="/account">{isEn ? "Add a vehicle in your account" : "Thêm phương tiện trong tài khoản"}</Link> {isEn ? "then return to book." : "rồi quay lại đặt chỗ."}</p>}
                <div className="booking-summary-price"><span>{isEn ? "Estimated total fee" : "Tổng phí ước tính"}</span><strong>{estimatedPrice}</strong></div>
                <details className="booking-price-details"><summary>{isEn ? "How fee is calculated" : "Cách tính phí"}</summary><p>{selectedLot.estimatedPricing?.billingDetails || (isEn ? "Fee is estimated based on duration. Final fee follows the lot's pricing policy and actual parking time." : "Phí được ước tính theo thời lượng gửi xe. Mức phí cuối cùng theo chính sách của bãi và thời gian gửi thực tế.")}</p></details>
                {!isAuthenticated && <p className="booking-vehicle-note">{isEn ? "Log in to select your vehicle and continue. Your selected lot, time, and spot will be preserved." : "Đăng nhập để chọn phương tiện và tiếp tục. Bãi, thời gian và ô đang chọn sẽ được giữ lại trong lựa chọn của bạn."}</p>}
                {bookingError && <div className="customer-alert error" role="alert">{bookingError}{(bookingError.includes("đăng nhập") || bookingError.toLowerCase().includes("log in")) && <Link to={loginTo}>{isEn ? "Log in again" : "Đăng nhập lại"}</Link>}</div>}
                {isAuthenticated ? <button className="customer-button primary" type="button" onClick={() => void createBooking()} disabled={!canBook}>{isCreatingBooking ? (isEn ? "Reserving…" : "Đang giữ chỗ…") : (isEn ? "Hold spot & pay" : "Giữ chỗ & thanh toán")}<ArrowRight size={17} /></button> : <Link className="customer-button primary" to={loginTo}>{isEn ? "Log in to continue" : "Đăng nhập để tiếp tục"}<ArrowRight size={17} /></Link>}
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
