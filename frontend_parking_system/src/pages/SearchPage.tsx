import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, LocateFixed, MapPin, ParkingCircle, Search, ShieldCheck } from "lucide-react";
import { ApiError, api, type LotAvailability, type LotLayout3DDto, type ParkingSearchItem, type ParkingLevelAvailability, type UserVehicle } from "../services/api";
import ParkingViewer, { type ModelLevel } from "../components/parking/ParkingViewer";
import { applySlotStatusChanges, type SlotStatusChange } from "../components/parking/parkingRealtime";
import { useParkingHub } from "../components/parking/useParkingHub";
import { useAuth } from "../context/AuthContext";
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

function slotStatusLabel(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "AVAILABLE") return "Còn chỗ";
  if (normalized === "HELD" || normalized === "RESERVED") return "Đang giữ";
  if (normalized === "OCCUPIED") return "Đang có xe";
  if (normalized === "MAINTENANCE") return "Bảo trì";
  return status || "Không rõ";
}

function toLocalDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Đã có lỗi không mong muốn. Vui lòng thử lại.";
  }

  if (error.status === 0) return "Chưa thể kết nối dịch vụ. Vui lòng kiểm tra kết nối và thử lại.";
  if (error.status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return error.message;
  if (error.status === 409) return "Chỗ đỗ vừa thay đổi hoặc không còn khả dụng. Hãy tải lại tình trạng chỗ.";
  if (error.status >= 500) return "Chưa thể tải dữ liệu bãi đỗ lúc này. Vui lòng thử lại sau.";
  return error.message;
}

function formatMoney(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const featureLabels: Record<string, string> = {
  EV_CHARGING: "Sạc xe điện", ACCESSIBLE: "Hỗ trợ tiếp cận", PRIORITY: "Chỗ ưu tiên",
  COVERED: "Có mái che", NEAR_ELEVATOR: "Gần thang máy", CCTV: "Camera an ninh",
};
function featureLabel(value: string) { return featureLabels[value.toUpperCase()] ?? value; }
function operatingLabel(value: string) {
  const labels: Record<string, string> = { OPEN: "Đang mở cửa", ACTIVE: "Đang hoạt động", CLOSED: "Đang đóng cửa", TEMPORARILYCLOSED: "Tạm đóng cửa", INACTIVE: "Ngừng hoạt động" };
  return labels[value.toUpperCase()] ?? value;
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function SearchPage({ selection = false }: { selection?: boolean }) {
  const navigate = useNavigate();
  const { lotId } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
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
      if (active) setVehicleError(getErrorMessage(cause));
    }).finally(() => {
      if (active) setIsLoadingVehicles(false);
    });

    return () => { active = false; };
  }, [isAuthenticated]);

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
      if (Number.isNaN(start.getTime())) throw new Error("Vui lòng chọn thời gian bắt đầu hợp lệ.");
      const end = new Date(start.getTime() + duration * 60_000);
      const cachedLayout = layoutCacheRef.current[lot.parkingLotId];
      const [result, layoutResult] = await Promise.all([
        api.getAvailability(lot.parkingLotId, start.toISOString(), end.toISOString(), vehicleType),
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
        setSelectedLevelCode(current => result.levels.some(level => level.levelCode === current)
          ? current
          : result.levels[0]?.levelCode ?? "");
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
            setResumeNotice("Ô bạn chọn trước đó không còn khả dụng. Vui lòng chọn một ô còn trống khác.");
          }
        }
      }
    } catch (cause) {
      if (requestId === availabilityRequestId.current) setAvailabilityError(getErrorMessage(cause));
    } finally {
      if (requestId === availabilityRequestId.current) {
        setIsLoadingAvailability(false);
        setIsRefreshingAvailability(false);
      }
    }
  }, [startsAt, duration, vehicleType, criteriaSignature, searchParams]);

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
      setSearchError("Thời lượng phải từ 30 phút đến 24 giờ.");
      return;
    }
    if (!Number.isFinite(new Date(targetStartsAt).getTime()) || new Date(targetStartsAt).getTime() <= Date.now()) {
      setSearchError("Thời gian bắt đầu phải ở trong tương lai.");
      return;
    }
    if (targetSortBy === "NEAREST" && !targetPosition) {
      setSearchError("Để tìm bãi gần nhất, hãy nhập tọa độ hợp lệ hoặc cho phép truy cập GPS.");
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
          setSearchError("Bãi này không còn phù hợp với khung giờ hoặc loại xe đã chọn. Hãy quay lại để chọn bãi khác.");
        }
      }
    } catch (cause) {
      if (requestId !== searchRequestId.current) return;
      setResults([]);
      setSearchSnapshot("");
      setSearchError(getErrorMessage(cause));
    } finally {
      if (requestId === searchRequestId.current) setIsSearching(false);
    }
  }, [selection, loadAvailability]);

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
      setLocationMessage("Trình duyệt này không hỗ trợ định vị.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude, longitude: coords.longitude });
        setManualLatitude(String(coords.latitude));
        setManualLongitude(String(coords.longitude));
        setLocationMessage("Đã lấy vị trí hiện tại. Khoảng cách là đường chim bay.");
      },
      () => setLocationMessage("Không lấy được vị trí. Hãy cấp quyền định vị rồi thử lại."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const [bookingMode, setBookingMode] = useState<"EXACT_SLOT" | "AUTO_SLOT">(searchParams.get("mode") === "AUTO_SLOT" ? "AUTO_SLOT" : "EXACT_SLOT");

  const createBooking = async () => {
    setBookingError("");
    if (!isAuthenticated) {
      setBookingError("Bạn cần đăng nhập để tạo booking.");
      return;
    }
    if (!availabilityIsCurrent) {
      setBookingError("Khung giờ đã thay đổi; hãy tải lại tình trạng chỗ trước khi đặt.");
      return;
    }
    if (!selectedLot || (bookingMode === "EXACT_SLOT" && !selectedSlotId) || !selectedVehicle) {
      setBookingError("Vui lòng chọn ô đỗ và phương tiện.");
      return;
    }
    if (normalizeVehicleType(selectedVehicle.vehicleType) !== vehicleType) {
      setBookingError("Loại phương tiện đã thay đổi. Hãy tải lại kết quả và chọn phương tiện phù hợp.");
      return;
    }

    setIsCreatingBooking(true);
    try {
      const start = new Date(startsAt);
      const payload = {
        lotId: selectedLot.parkingLotId,
        mode: bookingMode,
        slotId: bookingMode === "AUTO_SLOT" ? "00000000-0000-0000-0000-000000000000" : selectedSlotId,
        vehicleId: selectedVehicle.id,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
      };
      const booking = await api.createBooking(payload, bookingKey);
      navigate(`/bookings/${encodeURIComponent(booking.id)}`);
    } catch (cause) {
      setBookingError(getErrorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409 && selectedLot) {
        setSelectedSlotId("");
        renewBookingKey();
        void loadAvailability(selectedLot);
      }
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const selectedLevel = useMemo(
    () => availability?.levels.find(level => level.levelCode === selectedLevelCode) ?? null,
    [availability, selectedLevelCode],
  );
  const levelSlots = useMemo(() => selectedLevel?.slots
    .filter(slot => slot.supportedVehicleTypes.some(type => normalizeVehicleType(type) === vehicleType))
    .map(slot => ({
      ...slot,
      floorCode: selectedLevel.levelCode,
      floorName: selectedLevel.levelName,
    })) ?? [], [selectedLevel, vehicleType]);
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
  const selectedSlot = levelSlots.find(slot => slot.slotId === selectedSlotId) ?? null;
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
    ? formatMoney(estimatedFee, selectedLot?.estimatedPricing.currency ?? "VND") : "Chưa có giá";
  const canBook = (bookingMode === "AUTO_SLOT" || selectedSlot?.status.toUpperCase() === "AVAILABLE")
    && Boolean(selectedVehicle) && availabilityIsCurrent && (availability?.availableCount ?? 0) > 0 && !isCreatingBooking;

  return (
    <CustomerLayout booking>
      <main className={`customer-page booking-flow-page${selection ? " booking-selection-page" : ""}`}>
        {selection && <Link className="booking-back-link" to={backToSearch}><ArrowLeft size={16} />Quay lại chọn bãi</Link>}
        <BookingSteps current={selection ? 2 : 1} />
        <header className="customer-page-heading">
          <p className="customer-eyebrow">{selection ? "CHỌN VỊ TRÍ CỦA BẠN" : "MỘT CHỖ ĐỖ, MỌI HÀNH TRÌNH"}</p>
          <h1>{selection ? selectedLot?.name ?? "Chọn chỗ đỗ của bạn" : "Tìm bãi cho hành trình của bạn."}</h1>
          <p>{selection ? selectedLot?.address ?? "Chọn ô trên sơ đồ, kiểm tra thông tin rồi tiếp tục thanh toán." : "Chọn thời gian gửi xe. So sánh bãi phù hợp và xem tổng phí dự kiến trước khi đặt."}</p>
        </header>

        {!selection && <>
          <form className="customer-panel search-panel" id="search-form" onSubmit={submitSearch}>
            <div className="customer-form-grid">
              <label className="customer-field"><span>Loại phương tiện</span>
                <select value={vehicleType} onChange={event => setVehicleType(event.target.value as VehicleType)}>
                  <option value="Car">Ô tô</option><option value="Motorbike">Xe máy</option>
                </select>
              </label>
              <label className="customer-field"><span>Thời gian vào bãi</span>
                <input type="datetime-local" value={startsAt} min={toLocalDateTime(new Date())} onChange={event => setStartsAt(event.target.value)} required />
              </label>
              <label className="customer-field"><span>Thời lượng gửi (phút)</span>
                <input type="number" min={30} max={1440} step={15} value={duration} onChange={event => setDuration(Number(event.target.value))} required />
              </label>
              <label className="customer-field"><span>Ưu tiên tìm kiếm</span>
                <select value={sortBy} onChange={event => setSortBy(event.target.value as "NEAREST" | "CHEAPEST")}>
                  <option value="CHEAPEST">Tổng giá thấp nhất</option><option value="NEAREST">Gần vị trí của bạn</option>
                </select>
              </label>
            </div>
            {sortBy === "NEAREST" && <div className="booking-location-options">
              <div className="booking-location-row">
                <button className="customer-button secondary" type="button" onClick={useCurrentLocation}><LocateFixed size={17} />Dùng vị trí hiện tại</button>
                <label className="customer-field"><span>Bán kính tìm kiếm (km)</span>
                  <input type="number" min={1} max={50} step={1} value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))} required />
                </label>
                <p className="customer-help-text" role="status">{locationMessage || (searchPosition ? "Đã có vị trí tìm kiếm. Khoảng cách tính theo đường chim bay." : "Cho phép truy cập vị trí để tìm bãi gần bạn.")}</p>
              </div>
              <details className="booking-coordinate-options"><summary>Nhập tọa độ địa điểm khác</summary>
                <div className="booking-coordinate-fields">
                  <label className="customer-field"><span>Vĩ độ</span><input type="number" min={-90} max={90} step="any" value={manualLatitude} onChange={event => setManualLatitude(event.target.value)} placeholder="10.7769" /></label>
                  <label className="customer-field"><span>Kinh độ</span><input type="number" min={-180} max={180} step="any" value={manualLongitude} onChange={event => setManualLongitude(event.target.value)} placeholder="106.7008" /></label>
                </div>
              </details>
            </div>}
            <div className="customer-search-actions">
              <p><Clock3 size={16} />{currentRange ? `Dự kiến rời bãi lúc ${dateLabel(currentRange.endsAt)}` : "Chọn thời gian vào và thời lượng gửi xe."}</p>
              <button className="customer-button primary" type="submit" disabled={isSearching}><Search size={17} />{isSearching ? "Đang tìm bãi…" : "Tìm bãi phù hợp"}</button>
            </div>
            {searchError && <div className="customer-alert error" role="alert">{searchError}</div>}
          </form>

          <section className="customer-results" aria-busy={isSearching}>
            <div className="customer-section-heading"><div><h2>{hasSearched ? "Bãi đỗ dành cho bạn" : "Bắt đầu tìm chỗ đỗ"}</h2><p role="status">{isSearching ? "Đang tìm bãi phù hợp…" : hasSearched ? `${totalCount} bãi phù hợp với thời gian gửi xe` : "Kết quả và tổng phí dự kiến sẽ hiển thị tại đây."}</p></div></div>
            {!searchIsCurrent && results.length > 0 && <div className="customer-alert warning" role="status">Bạn đã thay đổi tiêu chí. Hãy tìm lại để cập nhật giá và chỗ trống.</div>}
            {isSearching && <div className="booking-result-skeletons" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} />)}</div>}
            {!isSearching && !searchError && results.length === 0 && <div className="customer-empty booking-empty-state"><ParkingCircle size={32} /><h3>{hasSearched ? "Chưa tìm thấy bãi phù hợp" : "Hành trình thuận tiện bắt đầu từ đây"}</h3><p>{hasSearched ? "Thử thay đổi giờ vào, thời lượng hoặc phạm vi tìm kiếm." : "Điền thông tin phía trên để xem những bãi đỗ phù hợp với bạn."}</p></div>}
            {!isSearching && <div className="customer-result-list">
              {results.map(lot => <article className="customer-lot-card" key={lot.parkingLotId}>
                <div className="booking-lot-top"><span className="booking-lot-icon"><ParkingCircle size={24} /></span><span className="booking-operating-status">{operatingLabel(lot.operatingStatus)}</span></div>
                <div className="customer-lot-copy"><span className="customer-lot-code">{lot.code || "BÃI ĐỖ"}</span><h3>{lot.name}</h3>
                  <p className="booking-lot-address"><MapPin size={15} />{lot.address || "Địa chỉ chưa được cung cấp"}</p>
                  <div className="customer-lot-facts"><span>{lot.availableSlots} chỗ khả dụng</span>{sortBy === "NEAREST" && <span>{Number(lot.distanceKm).toFixed(2)} km · đường chim bay</span>}</div>
                  {!!lot.supportedFeatures?.length && <p className="customer-features">{lot.supportedFeatures.map(featureLabel).join(" · ")}</p>}
                </div>
                <div className="customer-lot-price"><span>Tổng phí ước tính · {duration} phút</span><strong>{typeof lot.estimatedPricing?.estimatedTotalFee === "number" && Number.isFinite(lot.estimatedPricing.estimatedTotalFee) ? formatMoney(lot.estimatedPricing.estimatedTotalFee, lot.estimatedPricing.currency ?? "VND") : "Chưa có giá"}</strong>
                  <details className="booking-price-details"><summary>Chi tiết cách tính phí</summary><p>{lot.estimatedPricing?.billingDetails || "Phí cuối cùng được xác định theo chính sách bãi và thời gian gửi thực tế."}</p></details>
                  <button className="customer-button primary" type="button" onClick={() => chooseLot(lot)} disabled={!searchIsCurrent}>Chọn bãi<ArrowRight size={17} /></button>
                </div>
              </article>)}
            </div>}
          </section>
        </>}

        {selection && <>
          <div className="booking-trip-bar"><span>{vehicleType === "Car" ? "Ô tô" : "Xe máy"}</span><span><Clock3 size={16} />{dateLabel(startsAt)}{currentRange && ` → ${dateLabel(currentRange.endsAt)}`}</span><Link to={backToSearch}>Đổi thời gian</Link></div>
          {isSearching && <div className="customer-panel customer-empty" role="status">Đang kiểm tra giá và chỗ trống cho chuyến đi của bạn…</div>}
          {searchError && <div className="customer-alert error" role="alert">{searchError}<Link to={backToSearch}>Quay lại tìm bãi</Link></div>}
          {selectedLot && <section className="availability-panel">
            <div className="booking-map-layout">
              <section className="booking-map-card" aria-label="Chọn ô đỗ">
                <div className="booking-map-heading"><div><h2>Chọn chỗ trên sơ đồ</h2><p>Chạm vào ô còn trống hoặc chọn nhanh từ danh sách.</p></div>{availability && <span className="availability-count">{availability.availableCount} chỗ trống</span>}</div>
                <div className="booking-map-toolbar">
                  {availability && availabilityIsCurrent && availability.levels.length > 0 && <label className="customer-field booking-level-picker"><span>Tầng đỗ xe</span><select value={selectedLevelCode} onChange={event => { setSelectedLevelCode(event.target.value); setSelectedSlotId(""); }}>
                    {availability.levels.map(level => <option value={level.levelCode} key={level.levelId}>{level.levelName} ({level.levelCode})</option>)}
                  </select></label>}
                  <button className="customer-button secondary" type="button" onClick={() => void loadAvailability(selectedLot, true)} disabled={isLoadingAvailability || isRefreshingAvailability || !searchIsCurrent}>{isRefreshingAvailability ? "Đang cập nhật…" : "Làm mới"}</button>
                </div>
                <p className="booking-realtime-status" role="status">{updatedAt ? `Cập nhật ${updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Đang tải chỗ trống…"}{availabilityIsCurrent && (parkingHubStatus === "connected" ? " · Trực tiếp" : " · Tự động làm mới mỗi 10 giây")}</p>
                {isLoadingAvailability && <div className="customer-empty" role="status">Đang tải sơ đồ và tình trạng chỗ…</div>}
                {availabilityError && <div className="customer-alert error" role="alert">{availabilityError}</div>}
                {resumeNotice && <div className="customer-alert warning" role="status">{resumeNotice}</div>}
                {availability && !availabilityIsCurrent && <div className="customer-alert warning" role="status">Khung giờ hoặc tình trạng chỗ không còn hiệu lực. <Link to={backToSearch}>Tìm lại bãi</Link></div>}
                {availabilityIsCurrent && availability?.availableCount === 0 && <div className="customer-alert warning" role="status">Khung giờ này đã hết chỗ. Hãy chọn bãi hoặc thời gian khác.</div>}
                {availabilityIsCurrent && levelSlots.length > 0 && <>
                  <ParkingViewer levels={viewerLevels} selectedLevelCode={selectedLevelCode} selectedId={selectedSlotId || null} onSelect={slot => { setSelectedSlotId(slot.slotId); setBookingError(""); }} />
                  <div className="booking-legend" aria-label="Chú giải trạng thái ô đỗ"><span><i className="available" />Còn chỗ</span><span><i className="held" />Đang giữ</span><span><i className="occupied" />Có xe</span><span><i className="maintenance" />Bảo trì</span><span><i className="selected" /><Check size={12} />Đang chọn</span></div>
                  <details className="booking-slot-list"><summary>Chọn nhanh từ danh sách · {levelSlots.length} ô</summary>
                    <div className="customer-slot-grid booking-slot-grid" aria-label="Danh sách ô đỗ">{levelSlots.map(slot => <button className={`slot-${slot.status.toLowerCase()}${selectedSlotId === slot.slotId ? " selected" : ""}`} type="button" key={slot.slotId} aria-pressed={selectedSlotId === slot.slotId} disabled={slot.status.toUpperCase() !== "AVAILABLE"} onClick={() => { setSelectedSlotId(slot.slotId); setBookingError(""); }}><strong>{selectedSlotId === slot.slotId && <Check size={13} />}{slot.slotCode}</strong><span>{slotStatusLabel(slot.status)}</span></button>)}</div>
                  </details>
                </>}
                {availabilityIsCurrent && levelSlots.length === 0 && <div className="customer-empty">{availability?.levels.length ? "Tầng này chưa có ô phù hợp với loại xe đã chọn." : "Bãi chưa có dữ liệu sơ đồ. Vui lòng chọn bãi khác."}</div>}
              </section>

              <aside className="booking-selection-card" id="booking-summary" ref={summaryRef} tabIndex={-1}>
                <p className="customer-eyebrow">KIỂM TRA TRƯỚC KHI ĐẶT</p><h2>Thông tin đặt chỗ</h2>
                <div className="booking-selected-space"><ParkingCircle size={24} /><div><strong className="booking-selected-code">{bookingMode === "AUTO_SLOT" ? "Tự động chọn ô" : selectedSlot?.slotCode ?? "Chưa chọn ô"}</strong><span>{bookingMode === "AUTO_SLOT" ? "Hệ thống chọn ô phù hợp khi giữ chỗ" : selectedSlot ? `${selectedSlot.floorName} · Khu ${selectedSlot.zoneCode}` : "Chọn ô còn trống trên sơ đồ"}</span></div>{selectedSlot && bookingMode === "EXACT_SLOT" && <Check size={18} />}</div>
                <dl className="booking-summary-facts"><div><dt>Bãi đỗ</dt><dd>{selectedLot.name}</dd></div><div><dt>Vào bãi</dt><dd>{dateLabel(startsAt)}</dd></div><div><dt>Rời bãi dự kiến</dt><dd>{currentRange ? dateLabel(currentRange.endsAt) : "—"}</dd></div><div><dt>Thời lượng</dt><dd>{duration} phút · {vehicleType === "Car" ? "Ô tô" : "Xe máy"}</dd></div></dl>
                <label className="customer-field"><span>Cách chọn chỗ</span><select value={bookingMode} disabled={isCreatingBooking} onChange={event => { setBookingMode(event.target.value as "EXACT_SLOT" | "AUTO_SLOT"); renewBookingKey(); }}><option value="EXACT_SLOT">Tự chọn ô trên sơ đồ</option><option value="AUTO_SLOT">Để hệ thống chọn ô phù hợp</option></select></label>
                {isAuthenticated && <label className="customer-field booking-vehicle-picker"><span>Phương tiện của bạn</span><select value={selectedVehicle?.id ?? ""} onChange={event => setVehicleId(event.target.value)} disabled={isLoadingVehicles || compatibleVehicles.length === 0}><option value="">{isLoadingVehicles ? "Đang tải phương tiện…" : "Chọn phương tiện"}</option>{compatibleVehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.isDefault ? "Mặc định · " : ""}{maskPlate(vehicle.licensePlate)}</option>)}</select></label>}
                {vehicleError && <div className="customer-alert error" role="alert">{vehicleError} <Link to={loginTo}>Đăng nhập lại</Link></div>}
                {isAuthenticated && !isLoadingVehicles && !vehicleError && compatibleVehicles.length === 0 && <p className="booking-vehicle-note">Bạn chưa có phương tiện phù hợp. <Link to="/account">Thêm phương tiện trong tài khoản</Link> rồi quay lại đặt chỗ.</p>}
                <div className="booking-summary-price"><span>Tổng phí ước tính</span><strong>{estimatedPrice}</strong></div>
                <details className="booking-price-details"><summary>Cách tính phí</summary><p>{selectedLot.estimatedPricing?.billingDetails || "Phí được ước tính theo thời lượng gửi xe. Mức phí cuối cùng theo chính sách của bãi và thời gian gửi thực tế."}</p></details>
                {!isAuthenticated && <p className="booking-vehicle-note">Đăng nhập để chọn phương tiện và tiếp tục. Bãi, thời gian và ô đang chọn sẽ được giữ lại trong lựa chọn của bạn.</p>}
                {bookingError && <div className="customer-alert error" role="alert">{bookingError}{bookingError.includes("đăng nhập") && <Link to={loginTo}>Đăng nhập lại</Link>}</div>}
                {isAuthenticated ? <button className="customer-button primary" type="button" onClick={() => void createBooking()} disabled={!canBook}>{isCreatingBooking ? "Đang giữ chỗ…" : "Giữ chỗ & thanh toán"}<ArrowRight size={17} /></button> : <Link className="customer-button primary" to={loginTo}>Đăng nhập để tiếp tục<ArrowRight size={17} /></Link>}
                <p className="booking-check-note"><ShieldCheck size={16} />Chọn ô chưa tạo giữ chỗ. Tình trạng chỗ được kiểm tra lại khi bạn xác nhận.</p>
              </aside>
            </div>
            <div className="booking-mobile-bar"><div><span>{bookingMode === "AUTO_SLOT" ? "Hệ thống chọn ô" : selectedSlot ? `Ô ${selectedSlot.slotCode}` : "Chưa chọn ô"}</span><strong>{estimatedPrice}</strong></div><button className="customer-button primary" type="button" onClick={() => { summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); summaryRef.current?.focus({ preventScroll: true }); }}>Kiểm tra & tiếp tục<ArrowRight size={16} /></button></div>
          </section>}
        </>}
      </main>
    </CustomerLayout>
  );
}
