import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api, type LotAvailability, type ParkingSearchItem } from "../services/api";
import { useAuth } from "../context/AuthContext";

type VehicleType = "Car" | "Motorbike";

const demoVehicles: { id: string; label: string; type: VehicleType }[] = [
  { id: "11111111-1111-4111-8111-111111111111", label: "Ô tô mẫu (DEMO)", type: "Car" },
  { id: "22222222-2222-4222-8222-222222222222", label: "Xe máy mẫu (DEMO)", type: "Motorbike" },
];

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
  if (error.status === 403) {
    return error.message.toLowerCase().includes("verified vehicle")
      ? "Xe mẫu chưa được xác minh cho tài khoản hiện tại. Chọn xe đã xác minh khi Vehicle API sẵn sàng."
      : error.message;
  }
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
  const { user, isAuthenticated } = useAuth();
  const [vehicleType, setVehicleType] = useState<VehicleType>("Car");
  const [startsAt, setStartsAt] = useState(() => toLocalDateTime(new Date(Date.now() + 30 * 60_000)));
  const [duration, setDuration] = useState(120);
  const [sortBy, setSortBy] = useState<"NEAREST" | "CHEAPEST">("CHEAPEST");
  const [radiusKm, setRadiusKm] = useState(5);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [results, setResults] = useState<ParkingSearchItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLot, setSelectedLot] = useState<ParkingSearchItem | null>(null);
  const [availability, setAvailability] = useState<LotAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const availabilityRequestId = useRef(0);

  const loadAvailability = async (lot: ParkingSearchItem) => {
    const requestId = ++availabilityRequestId.current;
    setSelectedLot(lot);
    setAvailability(null);
    setAvailabilityError("");
    setSelectedSlotId("");
    setIsLoadingAvailability(true);
    try {
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) throw new Error("Vui lòng chọn thời gian bắt đầu hợp lệ.");
      const end = new Date(start.getTime() + duration * 60_000);
      const result = await api.getAvailability(lot.parkingLotId, start.toISOString(), end.toISOString(), vehicleType);
      if (requestId === availabilityRequestId.current) setAvailability(result);
    } catch (cause) {
      if (requestId === availabilityRequestId.current) setAvailabilityError(getErrorMessage(cause));
    } finally {
      if (requestId === availabilityRequestId.current) setIsLoadingAvailability(false);
    }
  };

  const submitSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setSearchError("");
    setSelectedLot(null);
    setAvailability(null);
    setSelectedSlotId("");
    availabilityRequestId.current += 1;

    const durationMinutes = Number(duration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 1440) {
      setSearchError("Thời lượng phải từ 30 phút đến 24 giờ.");
      return;
    }
    if (new Date(startsAt).getTime() <= Date.now()) {
      setSearchError("Thời gian bắt đầu phải ở trong tương lai.");
      return;
    }
    if (sortBy === "NEAREST" && !position) {
      setSearchError("Để tìm bãi gần nhất, vui lòng cho phép truy cập vị trí hiện tại.");
      return;
    }

    setHasSearched(true);
    setIsSearching(true);
    try {
      const result = await api.searchParkingLots({
        vehicleType,
        startTime: new Date(startsAt).toISOString(),
        expectedDuration: durationMinutes,
        sortBy,
        radiusKm,
        ...(sortBy === "NEAREST" && position ? position : {}),
      });
      setResults(result.items ?? []);
      setTotalCount(result.totalCount ?? result.items?.length ?? 0);
    } catch (cause) {
      setResults([]);
      setSearchError(getErrorMessage(cause));
    } finally {
      setIsSearching(false);
    }
  };

  const useCurrentLocation = () => {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt này không hỗ trợ định vị.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude, longitude: coords.longitude });
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
    if (!selectedLot || !selectedSlotId || !vehicleId) {
      setBookingError("Vui lòng chọn ô đỗ và phương tiện.");
      return;
    }

    setIsCreatingBooking(true);
    try {
      const start = new Date(startsAt);
      const payload = {
        lotId: selectedLot.parkingLotId,
        slotId: selectedSlotId,
        vehicleId,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
      };
      const signature = JSON.stringify(payload);
      const booking = await api.createBooking(payload, getBookingIdempotencyKey(signature));
      navigate(`/bookings/${encodeURIComponent(booking.id)}`);
    } catch (cause) {
      setBookingError(getErrorMessage(cause));
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const availableSlots = availability?.levels?.flatMap((level) =>
    level.slots
      .filter((slot) => slot.status === "AVAILABLE" && slot.supportedVehicleTypes.includes(vehicleType))
      .map((slot) => ({ ...slot, levelCode: level.levelCode, levelName: level.levelName })),
  ) ?? [];
  const currentRange = useMemo(() => {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return null;
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
    };
  }, [startsAt, duration]);
  const availabilityIsCurrent = Boolean(
    availability && currentRange &&
    new Date(availability.queryRange.startsAt).getTime() === new Date(currentRange.startsAt).getTime() &&
    new Date(availability.queryRange.endsAt).getTime() === new Date(currentRange.endsAt).getTime(),
  );

  return (
    <main className="customer-page">
      <div className="customer-page-top">
        <Link to="/" className="customer-brand">Park<span>Matrix</span></Link>
        <nav aria-label="Điều hướng khách hàng">
          <Link to="/search" aria-current="page">Tìm bãi</Link>
          <Link to="/faq">FAQ</Link>
          {isAuthenticated
            ? <span className="customer-nav-user">{user?.fullName ?? "Đã đăng nhập"}</span>
            : <Link to="/login">Đăng nhập</Link>}
        </nav>
      </div>

      <header className="customer-page-heading">
        <p className="customer-eyebrow">TÌM KIẾM BÃI ĐỖ XE</p>
        <h1>Tìm chỗ đỗ phù hợp</h1>
        <p>So sánh khoảng cách hoặc giá ước tính cho toàn bộ thời gian gửi xe.</p>
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
          <button className="customer-button secondary" type="button" onClick={useCurrentLocation}>
            {position ? "Cập nhật vị trí" : "Dùng vị trí hiện tại"}
          </button>
          <span className="customer-help-text" aria-live="polite">
            {locationMessage || (position ? `Vị trí đã chọn · ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}` : "Vị trí chỉ dùng khi tìm bãi gần nhất.")}
          </span>
          <button className="customer-button primary" type="submit" disabled={isSearching}>
            {isSearching ? "Đang tìm..." : "Tìm bãi"}
          </button>
        </div>
        {searchError && <div className="customer-alert error" role="alert">{searchError}</div>}
      </form>

      <section className="customer-results">
        <div className="customer-section-heading">
          <div><h2>Kết quả tìm kiếm</h2><p>{isSearching ? "Đang tải dữ liệu từ hệ thống..." : hasSearched ? `${totalCount} bãi phù hợp` : "Chưa tìm kiếm"}</p></div>
          <span className="customer-source-label">API kết quả · backend demo</span>
        </div>
        <p className="customer-api-note">
          Search API hiện dùng dữ liệu/giá mẫu. Tình trạng chỗ và mọi thao tác booking vẫn được kiểm tra lại bởi backend thật.
        </p>

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
                <strong>{formatMoney(lot.estimatedPricing?.estimatedTotalFee ?? 0, lot.estimatedPricing?.currency ?? "VND")}</strong>
                <small>{lot.estimatedPricing?.billingDetails || "Giá ước tính; bãi xe xác nhận mức phí cuối cùng."}</small>
                <button className="customer-button secondary" type="button" onClick={() => void loadAvailability(lot)}>
                  {selectedLot?.parkingLotId === lot.parkingLotId ? "Tải lại chỗ trống" : "Xem chỗ trống"}
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
          <p className="customer-help-text">Tình trạng hiển thị là ảnh chụp tại thời điểm tra cứu; máy chủ kiểm tra lại khi tạo booking.</p>
          {availability && !availabilityIsCurrent && (
            <div className="customer-alert warning" role="status">
              Khung giờ tìm kiếm đã thay đổi. Hãy tải lại tình trạng chỗ trước khi chọn ô.
            </div>
          )}

          {isLoadingAvailability && <div className="customer-empty">Đang tải danh sách chỗ trống...</div>}
          {availabilityError && <div className="customer-alert error" role="alert">{availabilityError}</div>}
          {availability && availableSlots.length === 0 && (
            <div className="customer-empty">Không có ô phù hợp cho loại xe và khung giờ này.</div>
          )}
          {availableSlots.length > 0 && (
            <>
              <div className={`customer-slot-grid${availabilityIsCurrent ? "" : " is-stale"}`} aria-label="Các ô còn trống">
                {availableSlots.map((slot) => (
                  <button className={selectedSlotId === slot.slotId ? "selected" : ""} type="button"
                    key={slot.slotId} aria-pressed={selectedSlotId === slot.slotId}
                    onClick={() => { setSelectedSlotId(slot.slotId); setBookingError(""); }}>
                    <strong>{slot.slotCode}</strong><span>{slot.levelCode} · {slot.zoneCode}</span>
                  </button>
                ))}
              </div>
              <div className="customer-demo-vehicle">
                <label className="customer-field">
                  <span>Chọn phương tiện đã xác minh</span>
                  <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                    <option value="">Chọn xe mẫu</option>
                    {demoVehicles.filter((vehicle) => vehicle.type === vehicleType).map((vehicle) => (
                      <option value={vehicle.id} key={vehicle.id}>{vehicle.label}</option>
                    ))}
                  </select>
                </label>
                <p>DEMO: API danh sách xe chưa có. Xe mẫu không được xác minh và booking thật có thể bị máy chủ từ chối; không nhập hoặc hiển thị biển số tại đây.</p>
                {bookingError && (
                  <div className="customer-alert error" role="alert">
                    {bookingError}
                    {bookingError.includes("đăng nhập") && <Link to="/login">Đăng nhập</Link>}
                  </div>
                )}
                <button className="customer-button primary" type="button" onClick={() => void createBooking()}
                  disabled={!selectedSlotId || !vehicleId || !availabilityIsCurrent || isCreatingBooking}>
                  {isCreatingBooking ? "Đang gửi booking..." : "Tạo booking ExactSlot"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
