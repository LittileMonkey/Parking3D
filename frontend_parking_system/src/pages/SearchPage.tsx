import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api, type LotAvailability, type ParkingSearchItem, type ParkingLevelAvailability, type UserVehicle } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ParkingViewer, { type ModelSlot } from "../components/parking/ParkingViewer";
import { applySlotStatusChanges, type SlotStatusChange } from "../components/parking/parkingRealtime";
import { useParkingHub } from "../components/parking/useParkingHub";
import "./Booking.css";

type VehicleType = "Car" | "Motorbike";

function normalizeVehicleType(value: string): VehicleType | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("car")) return "Car";
  if (normalized.includes("motorbike") || normalized.includes("motorcycle")) return "Motorbike";
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

  if (error.status === 0) return "Không thể kết nối Gateway. Hãy kiểm tra API đang chạy rồi thử lại.";
  if (error.status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return error.message;
  if (error.status === 409) return "Chỗ đỗ vừa thay đổi hoặc không còn khả dụng. Hãy tải lại tình trạng chỗ.";
  if (error.status === 503) return "Dịch vụ hiện chưa sẵn sàng. Vui lòng thử lại sau.";
  return error.message;
}

function formatMoney(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function getBookingIdempotencyKey(signature: string) {
  const storageKey = "parking.booking-attempt";
  const cached = sessionStorage.getItem(storageKey);
  if (cached) {
    try {
      const attempt = JSON.parse(cached) as { signature?: string; key?: string };
      if (attempt.signature === signature && attempt.key) return attempt.key;
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  const key = crypto.randomUUID();
  sessionStorage.setItem(storageKey, JSON.stringify({ signature, key }));
  return key;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

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
  const initialSortBy: "NEAREST" | "CHEAPEST" = paramSortBy === "NEAREST" || (!paramSortBy && paramCriteria.includes("nearest") && !paramCriteria.includes("cheapest"))
    ? "NEAREST"
    : "CHEAPEST";

  const paramRadius = searchParams.get("radius") || searchParams.get("radiusKm");
  const initialRadius = paramRadius === "all"
    ? 20
    : (Number(paramRadius) >= 1 && Number(paramRadius) <= 50 ? Number(paramRadius) : 5);

  const [vehicleType, setVehicleType] = useState<VehicleType>(initialVehicle);
  const [startsAt, setStartsAt] = useState(() => toLocalDateTime(new Date(Date.now() + 30 * 60_000)));
  const [duration, setDuration] = useState(initialDuration);
  const [sortBy, setSortBy] = useState<"NEAREST" | "CHEAPEST">(initialSortBy);
  const [radiusKm, setRadiusKm] = useState(initialRadius);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
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

  const manualLocationEntered = manualLatitude.trim() !== "" || manualLongitude.trim() !== "";
  const parsedLatitude = Number(manualLatitude);
  const parsedLongitude = Number(manualLongitude);
  const searchPosition = manualLocationEntered
    ? Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)
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
  }, [searchParams]);

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
      const result = await api.getAvailability(lot.parkingLotId, start.toISOString(), end.toISOString(), vehicleType);
      if (requestId === availabilityRequestId.current) {
        setAvailability(result);
        setAvailabilitySnapshot(criteriaSignature);
        setAvailabilityVehicleType(vehicleType);
        setSelectedLevelCode(current => result.levels.some(level => level.levelCode === current)
          ? current
          : result.levels[0]?.levelCode ?? "");
        setSelectedSlotId(current => result.levels.some(level =>
          level.slots.some(slot => slot.slotId === current && slot.status.toUpperCase() === "AVAILABLE"
            && slot.supportedVehicleTypes.includes(vehicleType))) ? current : "");
      }
    } catch (cause) {
      if (requestId === availabilityRequestId.current) setAvailabilityError(getErrorMessage(cause));
    } finally {
      if (requestId === availabilityRequestId.current) {
        setIsLoadingAvailability(false);
        setIsRefreshingAvailability(false);
      }
    }
  }, [startsAt, duration, vehicleType, criteriaSignature]);

  const executeSearch = useCallback(async (
    targetVehicleType: VehicleType,
    targetStartsAt: string,
    targetDuration: number,
    targetSortBy: "NEAREST" | "CHEAPEST",
    targetRadiusKm: number,
    targetPosition: { latitude: number; longitude: number } | null,
    targetLotIdOrCode?: string | null
  ) => {
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
    if (new Date(targetStartsAt).getTime() <= Date.now()) {
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
      const items = result.items ?? [];
      setResults(items);
      setTotalCount(result.totalCount ?? items.length);
      setSearchSnapshot(sig);

      const lotTarget = targetLotIdOrCode || searchParams.get("lot");
      if (lotTarget && lotTarget !== "all" && items.length > 0) {
        const matched = items.find(i =>
          i.parkingLotId === lotTarget ||
          i.code?.toLowerCase().includes(lotTarget.toLowerCase()) ||
          i.name?.toLowerCase().includes(lotTarget.toLowerCase())
        );
        if (matched) {
          void loadAvailability(matched);
        }
      }
    } catch (cause) {
      setResults([]);
      setSearchSnapshot("");
      setSearchError(getErrorMessage(cause));
    } finally {
      setIsSearching(false);
    }
  }, [searchParams, loadAvailability]);

  const submitSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    await executeSearch(vehicleType, startsAt, duration, sortBy, radiusKm, searchPosition);
  };

  const initialSearchTriggered = useRef(false);
  useEffect(() => {
    if (initialSearchTriggered.current) return;
    const hasParams = searchParams.has("vehicle") || searchParams.has("duration") || searchParams.has("lot") || searchParams.has("radius") || searchParams.has("sortBy") || searchParams.has("criteria");
    if (hasParams) {
      initialSearchTriggered.current = true;
      const initialStart = toLocalDateTime(new Date(Date.now() + 30 * 60_000));
      void executeSearch(
        initialVehicle,
        initialStart,
        initialDuration,
        initialSortBy,
        initialRadius,
        null,
        searchParams.get("lot")
      );
    }
  }, [searchParams, executeSearch, initialVehicle, initialDuration, initialSortBy, initialRadius]);

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
    if (!selectedLot || !selectedSlotId || !selectedVehicle) {
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
        slotId: selectedSlotId,
        vehicleId: selectedVehicle.id,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
      };
      const signature = JSON.stringify(payload);
      const booking = await api.createBooking(payload, getBookingIdempotencyKey(signature));
      navigate(`/bookings/${encodeURIComponent(booking.id)}`);
    } catch (cause) {
      setBookingError(getErrorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409 && selectedLot) {
        setSelectedSlotId("");
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
    .filter(slot => slot.supportedVehicleTypes.includes(vehicleType))
    .map(slot => ({
      ...slot,
      floorCode: selectedLevel.levelCode,
      floorName: selectedLevel.levelName,
    })) ?? [], [selectedLevel, vehicleType]);
  const viewerSlots = useMemo<ModelSlot[]>(() => levelSlots.map(slot => ({
    slotId: slot.slotId,
    slotCode: slot.slotCode,
    floorCode: slot.floorCode,
    zoneCode: slot.zoneCode,
    supportedVehicleTypes: slot.supportedVehicleTypes,
    features: slot.features,
    status: slot.status,
  })), [levelSlots]);
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
        .filter(slot => slot.supportedVehicleTypes.includes(vehicleType));
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
    if (!selectedLot || !availabilityIsCurrent) return;
    const timer = window.setInterval(() => void loadAvailability(selectedLot, true), 10_000);
    return () => window.clearInterval(timer);
  }, [selectedLot, availabilityIsCurrent, startsAt, duration, vehicleType, criteriaSignature]);

  return (
    <main className="customer-page">
      <div className="customer-page-top">
        <Link to="/" className="customer-brand">Park<span>Matrix</span></Link>
        <nav aria-label="Điều hướng khách hàng">
          <Link to="/booking" aria-current="page">Tìm và đặt chỗ</Link>
          <Link to="/faq">FAQ</Link>
          {isAuthenticated
            ? <span className="customer-nav-user">{user?.fullName ?? "Đã đăng nhập"}</span>
            : <Link to="/login">Đăng nhập</Link>}
        </nav>
      </div>

      <header className="customer-page-heading">
        <p className="customer-eyebrow">HÀNH TRÌNH ĐẶT CHỖ</p>
        <h1>Tìm và đặt chỗ</h1>
        <p>Tìm bãi, xem tầng và tình trạng slot trực tiếp, chọn xe tài khoản rồi giữ chỗ và theo dõi booking.</p>
      </header>

      <form className="customer-panel search-panel" id="search-form" onSubmit={submitSearch}>
        <div className="customer-form-grid">
          <label className="customer-field">
            <span>Loại phương tiện</span>
            <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType)}>
              <option value="Car">Ô tô</option>
              <option value="Motorbike">Xe máy</option>
            </select>
          </label>
          <label className="customer-field">
            <span>Thời gian bắt đầu</span>
            <input type="datetime-local" value={startsAt} min={toLocalDateTime(new Date())}
              onChange={(event) => setStartsAt(event.target.value)} required />
          </label>
          <label className="customer-field">
            <span>Thời lượng (phút)</span>
            <input type="number" min={30} max={1440} step={15} value={duration}
              onChange={(event) => setDuration(Number(event.target.value))} required />
          </label>
          <label className="customer-field">
            <span>Sắp xếp kết quả</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "NEAREST" | "CHEAPEST")}>
              <option value="CHEAPEST">Giá thấp nhất</option>
              <option value="NEAREST">Gần nhất</option>
            </select>
          </label>
          <label className="customer-field">
            <span>Bán kính (km)</span>
            <input type="number" min={1} max={50} step={1} value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))} required />
          </label>
        </div>

        <div className="customer-search-actions">
          {sortBy === "NEAREST" && (
            <div className="booking-manual-location">
              <button className="customer-button secondary" type="button" onClick={useCurrentLocation}>
                Lấy vị trí GPS
              </button>
              <label className="customer-field">
                <span>Vĩ độ</span>
                <input type="number" min={-90} max={90} step="any" value={manualLatitude}
                  onChange={event => setManualLatitude(event.target.value)} placeholder="10.7769" />
              </label>
              <label className="customer-field">
                <span>Kinh độ</span>
                <input type="number" min={-180} max={180} step="any" value={manualLongitude}
                  onChange={event => setManualLongitude(event.target.value)} placeholder="106.7008" />
              </label>
              <span className="customer-help-text" aria-live="polite">
                {locationMessage || "Không cấp GPS? Nhập tọa độ địa điểm để tính khoảng cách đường chim bay."}
              </span>
            </div>
          )}
          <button className="customer-button primary" type="submit" disabled={isSearching}>
            {isSearching ? "Đang tìm..." : "Tìm bãi"}
          </button>
        </div>
        {searchError && (
          <div className="customer-alert error" role="alert">
            {searchError} {searchError.includes("đăng nhập") && <Link to="/login">Đăng nhập lại</Link>}
          </div>
        )}
      </form>

      <section className="customer-results">
        <div className="customer-section-heading">
          <div><h2>Kết quả tìm kiếm</h2><p>{isSearching ? "Đang tải dữ liệu từ hệ thống..." : hasSearched ? `${totalCount} bãi phù hợp` : "Chưa tìm kiếm"}</p></div>
          <span className="customer-source-label">Dữ liệu tìm kiếm từ API</span>
        </div>
        {!searchIsCurrent && results.length > 0 && (
          <div className="customer-alert warning" role="status">
            Tiêu chí đã thay đổi; kết quả, giá và chỗ bên dưới đã cũ. Hãy tìm lại để tiếp tục đặt.
          </div>
        )}

        {!isSearching && !searchError && results.length === 0 && (
          <div className="customer-empty">
            {hasSearched ? "Chưa có bãi phù hợp. Hãy chỉnh tiêu chí và thử lại." : "Chọn loại xe, thời gian gửi và tiêu chí sắp xếp rồi tìm bãi."}
          </div>
        )}

        <div className="customer-result-list">
          {results.map((lot) => (
            <article className={`customer-lot-card${selectedLot?.parkingLotId === lot.parkingLotId ? " selected" : ""}`} key={lot.parkingLotId}>
              <div className="customer-lot-copy">
                <span className="customer-lot-code">{lot.code || "BÃI ĐỖ"}</span>
                <h3>{lot.name}</h3>
                <p>{lot.address || "Địa chỉ chưa được cung cấp"}</p>
                <div className="customer-lot-facts">
                  {sortBy === "NEAREST" && <span>{Number(lot.distanceKm).toFixed(2)} km · đường chim bay</span>}
                  <span>{lot.availableSlots} chỗ đang khả dụng</span>
                  <span>{lot.operatingStatus}</span>
                </div>
                {lot.supportedFeatures?.length ? <p className="customer-features">{lot.supportedFeatures.join(" · ")}</p> : null}
              </div>
              <div className="customer-lot-price">
                <span>Ước tính · {duration} phút</span>
                <strong>{typeof lot.estimatedPricing?.estimatedTotalFee === "number"
                  && Number.isFinite(lot.estimatedPricing.estimatedTotalFee)
                  ? formatMoney(lot.estimatedPricing.estimatedTotalFee, lot.estimatedPricing.currency ?? "VND")
                  : "Chưa có giá"}</strong>
                <small>{lot.estimatedPricing?.billingDetails || "Giá ước tính; bãi xe xác nhận mức phí cuối cùng."}</small>
                <button className="customer-button secondary" type="button" onClick={() => void loadAvailability(lot)}
                  disabled={!searchIsCurrent || isSearching}>
                  {selectedLot?.parkingLotId === lot.parkingLotId ? "Tải lại chỗ trống" : "Chọn bãi"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedLot && (
        <section className="customer-panel availability-panel" aria-live="polite">
          <div className="customer-section-heading">
            <div><p className="customer-eyebrow">{selectedLot.code || "PARKING LOT"}</p><h2>{selectedLot.name}</h2></div>
            {availability && <span className="availability-count">{availability.availableCount} / {availability.totalSlots} chỗ trống</span>}
          </div>
          <div className="booking-live-status">
            <p className="customer-help-text">
              Availability được đồng bộ tự động mỗi 10 giây; máy chủ kiểm tra lại khi giữ chỗ.
              {isRefreshingAvailability ? " Đang đồng bộ..." : ""}
            </p>
            <button className="customer-button secondary" type="button"
              onClick={() => void loadAvailability(selectedLot)} disabled={isLoadingAvailability || !searchIsCurrent}>
              Làm mới chỗ
            </button>
          </div>
          {availability && !availabilityIsCurrent && (
            <div className="customer-alert warning" role="status">
              Tiêu chí hoặc khung giờ đã thay đổi. Hãy tìm lại bãi rồi tải availability trước khi chọn ô.
            </div>
          )}

          {isLoadingAvailability && <div className="customer-empty" role="status">Đang tải availability từ máy chủ...</div>}
          {availabilityError && (
            <div className="customer-alert error" role="alert">
              {availabilityError} {availabilityError.includes("đăng nhập") && <Link to="/login">Đăng nhập lại</Link>}
            </div>
          )}
          {availability && availabilityIsCurrent && availability.levels.length > 0 && (
            <label className="customer-field booking-level-picker">
              <span>Chọn tầng</span>
              <select value={selectedLevelCode} onChange={event => {
                setSelectedLevelCode(event.target.value);
                setSelectedSlotId("");
              }}>
                {availability.levels.map(level => (
                  <option value={level.levelCode} key={level.levelId}>{level.levelName} ({level.levelCode})</option>
                ))}
              </select>
            </label>
          )}
          {availability && availabilityIsCurrent && (
            <p className="booking-realtime-status" role="status" aria-live="polite">
              {parkingHubStatus === "connected" && "Cập nhật trạng thái ô theo thời gian thực."}
              {parkingHubStatus === "connecting" && "Đang kết nối cập nhật trạng thái thời gian thực..."}
              {parkingHubStatus === "reconnecting" && "Đang kết nối lại realtime; trạng thái vẫn được làm mới định kỳ."}
              {parkingHubStatus === "disconnected" && "Realtime chưa kết nối; trạng thái vẫn được làm mới định kỳ."}
            </p>
          )}
          {availability && availabilityIsCurrent && levelSlots.length === 0 && (
            <div className="customer-empty">Tầng này không có slot phù hợp với loại xe đã chọn.</div>
          )}
          {availability && availabilityIsCurrent && availability.availableCount === 0 && (
            <div className="customer-alert warning" role="status">
              Khung giờ này hiện đã hết chỗ khả dụng. Hãy chọn bãi hoặc thời gian khác.
            </div>
          )}
          {levelSlots.length > 0 && availabilityIsCurrent && (
            <div className="booking-map-layout">
              <section className="booking-map-card" aria-label="Sơ đồ slot bãi đỗ">
                <ParkingViewer slots={viewerSlots} selectedId={selectedSlotId || null}
                  onSelect={slot => {
                    setSelectedSlotId(slot.slotId);
                    setBookingError("");
                  }} />
                <div className="booking-legend" aria-label="Chú giải trạng thái slot">
                  <span><i className="available" />Còn chỗ</span>
                  <span><i className="held" />Đang giữ</span>
                  <span><i className="occupied" />Đang có xe</span>
                  <span><i className="maintenance" />Bảo trì</span>
                  <span><i className="selected" />Đang chọn</span>
                </div>
                <div className="customer-slot-grid booking-slot-grid" aria-label="Danh sách slot">
                  {levelSlots.map(slot => (
                    <button className={`slot-${slot.status.toLowerCase()}${selectedSlotId === slot.slotId ? " selected" : ""}`}
                      type="button" key={slot.slotId} aria-pressed={selectedSlotId === slot.slotId}
                        disabled={!availabilityIsCurrent || slot.status.toUpperCase() !== "AVAILABLE"}
                      onClick={() => {
                        setSelectedSlotId(slot.slotId);
                        setBookingError("");
                      }}>
                      <strong>{slot.slotCode}</strong>
                      <span>{slot.zoneCode} · {slotStatusLabel(slot.status)}</span>
                    </button>
                  ))}
                </div>
              </section>
              <aside className="booking-selection-card" aria-live="polite">
                <h3>Chi tiết slot</h3>
                {selectedSlot ? (
                  <>
                    <strong className="booking-selected-code">{selectedSlot.slotCode}</strong>
                    <p>{selectedSlot.floorName} · Khu {selectedSlot.zoneCode}</p>
                    <p className={`booking-status-text slot-${selectedSlot.status.toLowerCase()}`}>
                      {slotStatusLabel(selectedSlot.status)}
                    </p>
                    {selectedSlot.features.length > 0 && <p>{selectedSlot.features.join(" · ")}</p>}
                  </>
                ) : <p>Chọn một ô trên sơ đồ 3D hoặc danh sách để xem chi tiết.</p>}

                <label className="customer-field booking-vehicle-picker">
                  <span>Phương tiện trong tài khoản</span>
                  <select value={selectedVehicle?.id ?? ""} onChange={event => setVehicleId(event.target.value)}
                    disabled={!isAuthenticated || isLoadingVehicles || compatibleVehicles.length === 0}>
                    <option value="">
                      {isLoadingVehicles ? "Đang tải xe..." : "Chọn phương tiện"}
                    </option>
                    {compatibleVehicles.map(vehicle => (
                      <option value={vehicle.id} key={vehicle.id}>
                        {vehicle.isDefault ? "Mặc định · " : ""}{maskPlate(vehicle.licensePlate)}
                      </option>
                    ))}
                  </select>
                </label>
                {vehicleError && (
                  <div className="customer-alert error" role="alert">
                    {vehicleError} {vehicleError.includes("đăng nhập") && <Link to="/login">Đăng nhập lại</Link>}
                  </div>
                )}
                {!isAuthenticated && (
                  <p className="booking-vehicle-note">Đăng nhập để tải phương tiện tài khoản và giữ chỗ. <Link to="/login">Đăng nhập</Link></p>
                )}
                {isAuthenticated && !isLoadingVehicles && !vehicleError && compatibleVehicles.length === 0 && (
                  <p className="booking-vehicle-note">Tài khoản chưa có phương tiện phù hợp. Hãy thêm xe trong hồ sơ tài khoản rồi thử lại.</p>
                )}
                {selectedVehicle && <p className="booking-vehicle-note">Biển số được ẩn một phần để bảo vệ thông tin cá nhân.</p>}
                {bookingError && (
                  <div className="customer-alert error" role="alert">
                    {bookingError}
                    {bookingError.includes("Phiên đăng nhập") && <> <Link to="/login">Đăng nhập lại</Link></>}
                    {bookingError.includes("đăng nhập") && !bookingError.includes("Phiên đăng nhập") && <> <Link to="/login">Đăng nhập</Link></>}
                  </div>
                )}
                <button className="customer-button primary" type="button" onClick={() => void createBooking()}
                  disabled={!selectedSlot || selectedSlot.status.toUpperCase() !== "AVAILABLE" || !selectedVehicle
                    || !availabilityIsCurrent || isCreatingBooking}>
                  {isCreatingBooking ? "Đang giữ chỗ..." : "Giữ chỗ và tiếp tục thanh toán"}
                </button>
              </aside>
            </div>
          )}
          {availability && availabilityIsCurrent && availability.levels.length === 0 && (
            <div className="customer-empty">Bãi chưa có dữ liệu tầng và slot.</div>
          )}
        </section>
      )}
    </main>
  );
}
