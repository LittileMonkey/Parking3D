import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowRight, Car, Check, ChevronDown, Clock3, CreditCard, LocateFixed, MapPin, ParkingCircle, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Bike, Layers3 } from "lucide-react";
import CustomerLayout from "../components/customer/CustomerLayout";
import HomeFaq from "../components/customer/HomeFaq";
import LandingParkingPreview from "../components/customer/LandingParkingPreview";
import { useLanguage } from "../context/LanguageContext";
import { api, type ParkingLot } from "../services/api";
import "./Home.css";

export default function Home() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const text = (vi: string, en: string) => lang === "en" ? en : vi;
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [lotId, setLotId] = useState("all");
  const [vehicle, setVehicle] = useState("Car");
  const [duration, setDuration] = useState("120");
  const [sortBy, setSortBy] = useState<"CHEAPEST" | "NEAREST">("CHEAPEST");
  const [radius, setRadius] = useState("5");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    let active = true;
    setCatalogState("loading");
    api.getParkingLots().then(items => {
      if (!active) return;
      setLots(items);
      setCatalogState("ready");
    }).catch(() => { if (active) setCatalogState("error"); });
    return () => { active = false; };
  }, [retry]);

  const bookingUrl = (targetLot = lotId, position?: GeolocationCoordinates, ranking = sortBy) => {
    const params = new URLSearchParams({ lot: targetLot, vehicle, duration, radius, sortBy: ranking });
    const start = new Date(Date.now() + 30 * 60_000);
    params.set("startsAt", new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    if (position) {
      params.set("latitude", String(position.latitude));
      params.set("longitude", String(position.longitude));
    }
    return `${targetLot === "all" ? "/booking" : `/booking/${encodeURIComponent(targetLot)}`}?${params}`;
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocationError("");
    if (sortBy === "CHEAPEST") { navigate(bookingUrl()); return; }
    if (!navigator.geolocation) {
      setLocationError(text("Trình duyệt chưa hỗ trợ GPS. Hãy chọn Giá phù hợp hoặc nhập tọa độ ở trang tìm kiếm.", "GPS is unavailable. Choose Best price or enter coordinates on the search page."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false);
      navigate(bookingUrl(lotId, position.coords));
    }, () => {
      setLocating(false);
      setLocationError(text("Chưa lấy được vị trí. Hãy cho phép GPS và thử lại, hoặc chọn Giá phù hợp.", "Location is unavailable. Allow GPS and try again, or choose Best price."));
    }, { timeout: 8000, maximumAge: 60000 });
  };

  const steps = [
    { icon: Search, title: text("Tìm bãi phù hợp", "Find your parking"), description: text("Chọn phương tiện, thời lượng và so sánh các bãi theo nhu cầu.", "Choose your vehicle and duration, then compare parking lots.") },
    { icon: Layers3, title: text("Chọn chỗ & thanh toán", "Choose a space & pay"), description: text("Xem sơ đồ bãi, chọn vị trí và hoàn tất thanh toán trong thời gian giữ chỗ.", "View the layout, choose a space and complete payment before your hold expires.") },
    { icon: ParkingCircle, title: text("Đến bãi, bắt đầu hành trình", "Arrive and get on with your day"), description: text("Theo dõi đặt chỗ trong tài khoản và dùng mã QR đã xác nhận khi đến bãi.", "Track your booking in your account and use your confirmed QR code on arrival.") },
  ];
  const benefits = [
    { icon: MapPin, title: text("Một nơi, nhiều lựa chọn", "One place, more choices"), description: text("Khám phá các bãi trong hệ thống, xem địa chỉ và chọn điểm đến phù hợp.", "Explore parking lots in the platform and find a location that works for you.") },
    { icon: CreditCard, title: text("Biết giá trước khi đặt", "Know the estimate before booking"), description: text("So sánh chi phí dự kiến cho đúng thời lượng gửi xe. Giá được tính theo biểu giá từng bãi.", "Compare estimates for your actual parking duration, using each lot’s pricing plan.") },
    { icon: ShieldCheck, title: text("Chủ động mỗi lượt đỗ", "Stay in control of your visit"), description: text("Quản lý phương tiện, theo dõi trạng thái và xem lại thông tin đặt chỗ trong tài khoản.", "Manage your vehicles, track status and find your bookings in your account.") },
  ];

  return (
    <CustomerLayout landing>
      <main className="lp-home">
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow"><span /> {text("MỖI HÀNH TRÌNH, MỘT CHỖ ĐỖ", "A SPACE FOR EVERY JOURNEY")}</p>
              <h1 id="lp-title">{text("Tìm chỗ đỗ phù hợp.", "Find your parking space.")}<br /><span>{text("Nhẹ nhàng mỗi hành trình.", "Make every journey easier.")}</span></h1>
              <p className="lp-hero-description">{text("Tìm bãi, xem giá dự kiến và đặt chỗ trước. Để việc đỗ xe trở thành phần đơn giản nhất trong ngày của bạn.", "Find parking, compare estimates and book ahead. Make parking the easiest part of your day.")}</p>
              <a className="lp-text-link" href="#how-it-works">{text("Khám phá cách đặt chỗ", "See how it works")} <ArrowDown size={16} /></a>
              <div className="lp-hero-points"><span><Check size={15} />{text("Ô tô & xe máy", "Cars & motorbikes")}</span><span><Check size={15} />{text("Giá theo thời lượng", "Duration-based estimates")}</span><span><Check size={15} />{text("Sơ đồ trực quan", "Visual lot layouts")}</span></div>
            </div>
            <LandingParkingPreview />
          </div>
          <div className="lp-container">
            <form className="lp-search" onSubmit={submitSearch} aria-label={text("Tìm bãi đỗ xe", "Find parking")}>
              <div className="lp-search-heading"><h2>{text("Bạn cần đỗ xe ở đâu?", "Where are you parking?")}</h2><span><LocateFixed size={14} />{text("Tìm theo nhu cầu của bạn", "Find what works for you")}</span></div>
              <div className="lp-search-grid">
                <label className="lp-field lp-location-field" htmlFor="search-location"><span><MapPin size={15} />{text("Bãi đỗ", "Parking lot")}</span><select id="search-location" value={lotId} onChange={event => setLotId(event.target.value)}><option value="all">{text("Tất cả bãi trong hệ thống", "All parking lots")}</option>{lots.map(lot => <option value={lot.id} key={lot.id}>{lot.name}</option>)}</select></label>
                <label className="lp-field" htmlFor="search-vehicle"><span>{vehicle === "Car" ? <Car size={15} /> : <Bike size={15} />}{text("Phương tiện", "Vehicle")}</span><select id="search-vehicle" value={vehicle} onChange={event => setVehicle(event.target.value)}><option value="Car">{text("Ô tô", "Car")}</option><option value="Motorbike">{text("Xe máy", "Motorbike")}</option></select></label>
                <label className="lp-field" htmlFor="search-duration"><span><Clock3 size={15} />{text("Thời lượng gửi", "Parking duration")}</span><select id="search-duration" value={duration} onChange={event => setDuration(event.target.value)}>{[30, 60, 120, 240, 480, 1440].map(minutes => <option value={minutes} key={minutes}>{minutes === 30 ? text("30 phút", "30 minutes") : text(`${minutes / 60} giờ`, `${minutes / 60} hours`)}</option>)}</select></label>
                <button className="lp-button lp-primary" type="submit" disabled={locating}><Search size={18} />{locating ? text("Đang lấy vị trí…", "Locating…") : text("Tìm bãi đỗ", "Find parking")}<ArrowRight size={17} /></button>
              </div>
              <details className="lp-advanced"><summary><SlidersHorizontal size={15} />{text("Tùy chọn tìm kiếm", "Search options")}<ChevronDown size={15} /></summary><div className="lp-options-grid"><fieldset><legend>{text("Sắp xếp theo", "Sort by")}</legend><label><input type="radio" name="home-sort" value="CHEAPEST" checked={sortBy === "CHEAPEST"} onChange={() => { setSortBy("CHEAPEST"); setLocationError(""); }} />{text("Giá phù hợp", "Best price")}</label><label><input type="radio" name="home-sort" value="NEAREST" checked={sortBy === "NEAREST"} onChange={() => setSortBy("NEAREST")} />{text("Gần tôi nhất · cần GPS", "Nearest to me · requires GPS")}</label></fieldset><label className="lp-field" htmlFor="search-radius"><span>{text("Bán kính khi dùng GPS", "Radius when using GPS")}</span><select id="search-radius" value={radius} onChange={event => setRadius(event.target.value)}>{[2, 5, 10, 20].map(km => <option key={km} value={km}>{km} km</option>)}</select></label></div></details>
              {locationError && <p className="lp-inline-error" role="alert">{locationError} <Link to="/booking">{text("Mở tìm kiếm", "Open search")}</Link></p>}
            </form>
          </div>
        </section>

        <section className="lp-section lp-container" id="parking-lots" aria-labelledby="lp-lots-title">
          <div className="lp-section-heading"><div><p className="lp-eyebrow">{text("KHÁM PHÁ ĐIỂM ĐẾN", "EXPLORE YOUR NEXT STOP")}</p><h2 id="lp-lots-title">{text("Một chỗ đỗ cho kế hoạch của bạn.", "A parking space for your plans.")}</h2><p>{text("Chọn bãi để xem sơ đồ, chỗ trống và giá dự kiến cho lượt gửi xe.", "Choose a lot to view its layout, availability and an estimate for your visit.")}</p></div><Link className="lp-text-link" to="/booking">{text("Xem tất cả bãi", "Explore all parking")}<ArrowRight size={17} /></Link></div>
          {catalogState === "loading" ? <div className="lp-lot-grid" role="status" aria-label={text("Đang tải bãi đỗ", "Loading parking lots")}>{[0, 1, 2].map(n => <div className="lp-lot-skeleton" key={n} aria-hidden="true" />)}</div>
            : catalogState === "error" ? <div className="lp-catalog-state" role="status"><MapPin size={30} /><div><h3>{text("Các điểm đến đang chờ bạn.", "Your next stop is waiting.")}</h3><p>{text("Chưa thể tải danh sách bãi đỗ lúc này. Bạn có thể thử lại hoặc mở trang tìm kiếm.", "We couldn't load parking lots right now. Try again or open the search page.")}</p></div><button type="button" className="lp-button lp-secondary" onClick={() => setRetry(n => n + 1)}><RefreshCw size={16} />{text("Thử lại", "Try again")}</button></div>
              : lots.length === 0 ? <div className="lp-catalog-state" role="status"><ParkingCircle size={30} /><p>{text("Chưa có bãi đỗ được công bố. Vui lòng quay lại sau.", "No parking lots have been published yet. Please check back later.")}</p></div>
                : <div className="lp-lot-grid">{lots.slice(0, 3).map((lot, index) => <article className="lp-lot-card" key={lot.id}><div className={`lp-lot-art lp-lot-art-${index}`} aria-hidden="true"><ParkingCircle size={46} strokeWidth={1.2} /><span>{lot.code}</span><div className="lp-lot-lines" /></div><div className="lp-lot-body"><h3>{lot.name}</h3><p><MapPin size={15} />{lot.address}</p><Link className="lp-text-link" to={bookingUrl(lot.id, undefined, "CHEAPEST")}>{text("Xem giá & chỗ trống", "View estimates & availability")}<ArrowRight size={16} /></Link></div></article>)}</div>}
        </section>

        <section className="lp-steps-section" id="how-it-works"><div className="lp-container lp-section"><div className="lp-section-heading"><div><p className="lp-eyebrow">{text("ĐƠN GIẢN TỪ BƯỚC ĐẦU", "SIMPLE FROM THE START")}</p><h2>{text("Ba bước. Một hành trình nhẹ nhàng.", "Three steps. An easier journey.")}</h2></div><p>{text("Từ tìm bãi đến khi đỗ xe, mọi thứ theo cùng một luồng.", "From finding a space to arrival, follow one simple flow.")}</p></div><ol className="lp-steps-grid">{steps.map((step, index) => <li key={index}><div className="lp-step-top"><span className="lp-step-number">0{index + 1}</span><step.icon size={24} strokeWidth={1.5} /></div><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol></div></section>

        <section className="lp-section lp-container" id="benefits"><div className="lp-section-heading"><div><p className="lp-eyebrow">{text("DÀNH CHO NHỮNG ĐIỀU QUAN TRỌNG HƠN", "MAKE TIME FOR WHAT MATTERS")}</p><h2>{text("Bớt lo chỗ đỗ. Thêm thời gian cho bạn.", "Less parking worry. More time for you.")}</h2></div></div><div className="lp-benefits-grid">{benefits.map(benefit => <article key={benefit.title}><span className="lp-benefit-icon"><benefit.icon size={24} strokeWidth={1.6} /></span><h3>{benefit.title}</h3><p>{benefit.description}</p></article>)}</div></section>

        <HomeFaq lots={lots} />

        <section className="lp-container lp-bottom-cta"><div><p className="lp-eyebrow">{text("SẴN SÀNG CHO ĐIỂM ĐẾN TIẾP THEO", "READY FOR YOUR NEXT STOP")}</p><h2>{text("Chọn điểm đến. Để ParkMatrix lo chỗ đỗ.", "Pick your destination. Find your space with ParkMatrix.")}</h2></div><Link className="lp-button lp-primary" to="/booking">{text("Tìm và đặt chỗ", "Find & book parking")}<ArrowRight size={18} /></Link></section>
      </main>
    </CustomerLayout>
  );
}
