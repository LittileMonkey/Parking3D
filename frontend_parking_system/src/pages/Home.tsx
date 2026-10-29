import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Calendar,
  Car,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  CreditCard,
  Droplets,
  FileText,
  Filter,
  Flame,
  LogOut,
  MapPin,
  Navigation,
  ParkingCircle,
  Radio,
  Scan,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  User,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { api, type BuildingEnvironment, type ParkingSlot } from "../services/api";

const parkingPhotos = [
  {
    src: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    alt: "Bãi đỗ xe tầng hầm với hệ thống đèn dẫn hướng LED từng vị trí",
    tag: "TẦNG HẦM B1 - TÒA NHÀ MAIN",
    title: "Đèn dẫn hướng LED từng ô đỗ",
  },
  {
    src: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80",
    alt: "Cổng kiểm soát xe thông minh với camera ANPR AI mở Barie trong 0.3s",
    tag: "TRẠM TỐC ĐỘ XUẤT VIỆT",
    title: "ANPR AI mở Barie trong 0.3s",
  },
  {
    src: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80",
    alt: "Trạm sạc xe điện siêu nhanh DC cho phương tiện EV",
    tag: "KHU SẠC XE ĐIỆN",
    title: "Trạm sạc nhanh DC thế hệ mới",
  },
];

function slotStatus(status: string, lang: string = "vi") {
  const normalized = status.toLowerCase();
  if (normalized.includes("available")) return { className: "available", label: lang === "en" ? "Available" : "Còn chỗ" };
  if (normalized.includes("reserved") || normalized.includes("held")) return { className: "reserved", label: lang === "en" ? "Reserved" : "Đang giữ" };
  if (normalized.includes("occupied")) return { className: "occupied", label: lang === "en" ? "Occupied" : "Đang có xe" };
  if (normalized.includes("maintenance")) return { className: "maintenance", label: lang === "en" ? "Maintenance" : "Bảo trì" };
  return { className: "maintenance", label: status || (lang === "en" ? "Unknown" : "Không rõ") };
}

const SOLUTIONS = [
  {
    icon: <Radio className="w-5 h-5 text-cyan-600" />,
    title: "Tình Trạng Chỗ Theo Thời Gian Thực",
    desc: "Cảm biến siêu âm gắn trực tiếp tại tầng ô đỗ xe truyền dữ liệu trực tuyến về gateway IoT kết nối 2 giây/lần qua mạng LoRaWAN/Mesh.",
    tag: "Cảm biến kép Dual-Sensor",
  },
  {
    icon: <Calendar className="w-5 h-5 text-cyan-600" />,
    title: "Đặt Trước Vị Trí Đỗ Xe",
    desc: "Khóa giữ chỗ tự động xem trước 60 phút trước khi đến nơi. Tự động nhận diện khoảng cách xe di chuyển và hoàn tiền linh hoạt nếu hủy chuyến.",
    tag: "Đảm bảo vị trí chuẩn xác",
  },
  {
    icon: <CreditCard className="w-5 h-5 text-cyan-600" />,
    title: "Thanh Toán Đa Phương Thức",
    desc: "Hỗ trợ quét nạp qua MoMo, VNPAY, Viettel Money, thẻ quốc tế Visa/MasterCard và ParkMatrix QuickPay tự động trừ tiền khi nhận diện biển số ra cổng.",
    tag: "Không dừng tốn một giây",
  },
  {
    icon: <Scan className="w-5 h-5 text-cyan-600" />,
    title: "Tự Động Nhận Diện Biển Số (ANPR)",
    desc: "Thuật toán Deep Learning nhận diện kể cả chuẩn biển số mờ/bẩn trong mọi điều kiện ánh sáng, góc nghiêng hay mưa gió. Barie mở tự động dưới 0.3s.",
    tag: "Edge AI Camera tốc độ cao",
  },
  {
    icon: <Zap className="w-5 h-5 text-cyan-600" />,
    title: "Quản Lý Đa Phương Tiện & EV",
    desc: "Định vị phân luồng riêng cho ô tô/xe điện/xe máy/trạm sạc AC/DC, và đồng bộ dòng xe đến/đi, điều hướng dễ dàng không lo tắc nghẽn.",
    tag: "Tích hợp trụ sạc nhanh",
  },
  {
    icon: <FileText className="w-5 h-5 text-cyan-600" />,
    title: "Lịch Sử & Hóa Đơn Điện Tử",
    desc: "Tự động xuất hóa đơn GTGT điện tử chuẩn Tổng cục Thuế ngay khi thanh toán, dễ dàng tra cứu lịch sử hành trình và xuất báo cáo đề xuất.",
    tag: "Chuẩn hóa hóa đơn điện tử",
  },
];

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [apiState, setApiState] = useState<"loading" | "online" | "offline">("loading");
  const [showLogout, setShowLogout] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mapTab, setMapTab] = useState<"map" | "satellite" | "3d">("map");

  // Navbar Dropdown State
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBookingDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Search Filter Criteria States
  const [searchVehicle, setSearchVehicle] = useState<"car" | "bike" | "ev">("car");
  const [searchLocation, setSearchLocation] = useState<string>("all");
  const [searchDuration, setSearchDuration] = useState<string>("120"); // 2 hours
  const [searchRadius, setSearchRadius] = useState<string>("5"); // 5 km
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["nearest", "cheapest"]);

  const toggleFilter = (filterKey: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterKey) ? prev.filter((k) => k !== filterKey) : [...prev, filterKey]
    );
  };

  const [envData, setEnvData] = useState<BuildingEnvironment>({
    smokeDensity: "0.014 mg/m³",
    smokeStatus: "AN TOÀN",
    airQualityIndex: 42,
    airQualityStatus: "TỐT (AQI)",
    co2Level: "415 ppm",
    temperature: "29°C",
    weatherCondition: "Nắng nhẹ • Gió 8 km/h",
    humidity: "65%",
    city: "TP. HỒ CHÍ MINH",
    updatedAt: "15:20",
  });

  useEffect(() => {
    let active = true;
    Promise.all([api.checkHealth(), api.getSlots(), api.getBuildingEnvironment()])
      .then(([healthy, items, env]) => {
        if (!active) return;
        setSlots(items);
        setApiState(healthy ? "online" : "offline");
        if (env) setEnvData(env);
      })
      .catch(() => {
        if (!active) return;
        setApiState("offline");
      });

    // định kỳ 15s cập nhật telemetry mock
    const timer = setInterval(() => {
      api.getBuildingEnvironment().then((env) => {
        if (active && env) setEnvData(env);
      });
    }, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowLogout(false);
  };

  const marqueeTelemetryItems = (
    <>
      <span className="telemetry-item">
        <span className="live-dot-green" /> <strong>{t("topbar.infra")}</strong> {t("topbar.active")}
      </span>
      <span className="bar-divider">•</span>

      <span className="telemetry-item smoke-item">
        <Flame size={14} className="text-amber-500 mr-1" />
        {t("topbar.smoke")} <strong className="val-highlight">{envData.smokeDensity}</strong> ({envData.smokeStatus === "AN TOÀN" ? t("topbar.safe") : t("topbar.warning")})
      </span>
      <span className="bar-divider">•</span>

      <span className="telemetry-item aqi-item">
        <Wind size={14} className="text-teal-600 mr-1" />
        {t("topbar.air")} <strong className="val-highlight">AQI {envData.airQualityIndex}</strong> - {envData.airQualityIndex <= 50 ? t("topbar.good") : t("topbar.moderate")} | CO₂: {envData.co2Level}
      </span>
      <span className="bar-divider">•</span>

      <span className="telemetry-item weather-item">
        <Sun size={14} className="text-yellow-500 mr-1" />
        {t("topbar.weather")} <strong>{lang === "en" ? t("topbar.city") : envData.city} {envData.temperature}</strong> ({lang === "en" ? t("topbar.weather_desc") : envData.weatherCondition})
      </span>
      <span className="bar-divider">•</span>

      <span className="telemetry-item humidity-item">
        <Droplets size={14} className="text-cyan-500 mr-1" />
        {t("topbar.humidity")} <strong>{envData.humidity}</strong>
      </span>
      <span className="bar-divider">•</span>
    </>
  );

  return (
    <div className="site-shell light-theme">
      {/* ── 1. Top Status Banner (Animated Ticker: Trượt từ phải sang trái liên tục) ── */}
      <div className="top-status-bar marquee-status-bar" aria-label="Bảng tin môi trường và cảm biến bãi đỗ xe trực tuyến">
        <div className="marquee-track">
          <div className="marquee-content">
            {marqueeTelemetryItems}
          </div>
          <div className="marquee-content" aria-hidden="true">
            {marqueeTelemetryItems}
          </div>
        </div>
      </div>

      {/* ── 2. Floating Island Pill Navbar (Ảnh 3 nadi. Style) ── */}
      <header className="site-header-pill-wrapper">
        <div className="site-header-pill">
          {/* Brand Logo */}
          <Link className="brand-pill" to="/" aria-label="ParkMatrix trang chủ">
            <span className="brand-pill-logo">
              <ParkingCircle size={22} className="text-cyan-600" />
            </span>
            <div className="brand-pill-text">
              <span className="brand-pill-title">
                Park<span className="brand-cyan">Matrix</span>
                <span className="brand-pill-dot" />
              </span>
            </div>
          </Link>

          {/* Center Navigation */}
          <nav className={`main-nav-pill ${mobileMenu ? "is-open" : ""}`} aria-label="Điều hướng chính">
            {/* 1. Combined Dropdown: Gom "Đặt Chỗ 3D", "Tìm Bãi Đỗ", "Sơ Đồ & Đặt Chỗ" */}
            <div
              ref={dropdownRef}
              className="nav-dropdown-wrapper"
              onMouseEnter={() => setBookingDropdownOpen(true)}
              onMouseLeave={() => setBookingDropdownOpen(false)}
            >
              <button
                type="button"
                className={`nav-item-pill nav-dropdown-btn ${bookingDropdownOpen ? "is-active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setBookingDropdownOpen((v) => !v);
                }}
                aria-expanded={bookingDropdownOpen}
              >
                <span>{lang === "en" ? "Parking & Booking" : "Đặt Chỗ & Bãi Đỗ"}</span>
                <ChevronDown size={14} className={`dropdown-chevron ${bookingDropdownOpen ? "rotate-up" : ""}`} />
              </button>

              {bookingDropdownOpen && (
                <div className="nav-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <Link
                    to="/booking"
                    onClick={() => {
                      setBookingDropdownOpen(false);
                      setMobileMenu(false);
                    }}
                    className="dropdown-menu-item"
                  >
                    <div className="dropdown-item-icon bg-cyan">
                      <Car size={18} />
                    </div>
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">{lang === "en" ? "3D Interactive Booking" : "Đặt Chỗ 3D Trực Quan"}</span>
                      <span className="dropdown-item-desc">{lang === "en" ? "Interactive 3D twin, reserve exact slot" : "Mô phỏng 3D bãi đỗ, chọn vị trí chính xác"}</span>
                    </div>
                  </Link>

                  <Link
                    to="/search"
                    onClick={() => {
                      setBookingDropdownOpen(false);
                      setMobileMenu(false);
                    }}
                    className="dropdown-menu-item"
                  >
                    <div className="dropdown-item-icon bg-blue">
                      <Search size={18} />
                    </div>
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">{lang === "en" ? "Smart Parking Search" : "Tìm Bãi Đỗ Thông Minh"}</span>
                      <span className="dropdown-item-desc">{lang === "en" ? "Find nearest & cheapest with GPS" : "So sánh khoảng cách & ước tính giá gửi"}</span>
                    </div>
                  </Link>

                  <a
                    href="#gis-section"
                    onClick={(e) => {
                      e.preventDefault();
                      setBookingDropdownOpen(false);
                      setMobileMenu(false);
                      document.getElementById("gis-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="dropdown-menu-item"
                  >
                    <div className="dropdown-item-icon bg-emerald">
                      <Navigation size={18} />
                    </div>
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">{lang === "en" ? "Live GIS Map & Directory" : "Sơ Đồ & Vị Trí Bãi Xe"}</span>
                      <span className="dropdown-item-desc">{lang === "en" ? "Real-time citywide slot network" : "Bản đồ số GIS thời gian thực toàn thành phố"}</span>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <Link to="/faq" onClick={() => setMobileMenu(false)} className="nav-item-pill">
              FAQ
            </Link>
            <a href="#solutions" onClick={() => setMobileMenu(false)} className="nav-item-pill">
              {t("nav.solutions")}
            </a>
            <a href="#about" onClick={() => setMobileMenu(false)} className="nav-item-pill">
              {t("nav.infrastructure")}
            </a>
          </nav>

          {/* Right Actions */}
          <div className="header-actions-pill">
            <div className="lang-switcher-pill" role="group" aria-label={lang === "vi" ? "Chọn ngôn ngữ" : "Select language"}>
              <button
                type="button"
                className={`lang-btn-pill ${lang === "vi" ? "active" : ""}`}
                onClick={() => setLang("vi")}
                title="Tiếng Việt"
                aria-pressed={lang === "vi"}
              >
                VN
              </button>
              <button
                type="button"
                className={`lang-btn-pill ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                title="English"
                aria-pressed={lang === "en"}
              >
                EN
              </button>
            </div>

            <button className="icon-btn-pill" aria-label="Thông báo">
              <Bell size={16} />
            </button>

            {isAuthenticated ? (
              <div className="user-profile-pill">
                <div className="avatar-circle-pill">
                  <User size={15} />
                </div>
                <div className="user-info-pill">
                  <span className="user-name-pill">{user?.fullName || user?.userName}</span>
                  <span className="user-role-pill">{t("nav.vip")}</span>
                </div>
                <button className="logout-btn-pill" title={t("nav.logout")} onClick={() => setShowLogout(true)}>
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="auth-btns-pill">
                <Link className="auth-btn-pill-login" to="/login">
                  {t("nav.login")}
                </Link>
                <Link className="auth-btn-pill-register" to="/register">
                  <span>{t("nav.register")}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── 3. Light Hero Section with Clarified Background & Animations ── */}
        <section className="hero-light-section hero-animated-parking-bg">
          {/* Clean High-Resolution Parking Background */}
          <div className="parking-motion-bg">
            <div className="hero-bg-overlay-glass" />
          </div>

          {/* Miniature Cruising Car Searching for Slot */}
          <div className="mini-car-track" aria-hidden="true">
            <div className="mini-car-vehicle">
              {/* Question Mark Thought Bubble */}
              <div className="mini-car-bubble">
                <span className="bubble-question">?</span>
              </div>

              {/* Headlight beam */}
              <div className="mini-car-beam" />

              {/* Compact Cyber Car SVG */}
              <svg className="mini-car-svg" viewBox="0 0 110 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="55" cy="42" rx="46" ry="4" fill="rgba(0,0,0,0.35)" />
                <path d="M12 28C10 28 8 26 8 23L14 17C16 15 20 14 26 14H66C72 14 78 17 84 21L96 23C99 24 101 26 101 29V34C101 35.5 100 36 98 36H12C10 36 9 35 9 33V28H12Z" fill="url(#carBodyGrad)" />
                <path d="M28 14L37 5C39 3 42 2 46 2H68C72 2 76 4 79 7L88 14H28Z" fill="#0f172a" />
                <path d="M38 6L32 13H54V4H45C42 4 40 4.8 38 6Z" fill="#38bdf8" fillOpacity="0.85" />
                <path d="M57 4V13H82L76 6C74 4.8 71.5 4 69 4H57Z" fill="#38bdf8" fillOpacity="0.85" />
                <line x1="39" y1="7" x2="34" y2="12" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                <circle cx="98" cy="27" r="3.5" fill="#fef08a" />
                <rect x="7" y="24" width="3" height="6" rx="1.5" fill="#ef4444" />
                <circle cx="82" cy="36" r="9" fill="#1e293b" />
                <circle cx="82" cy="36" r="5.5" fill="#64748b" />
                <circle cx="82" cy="36" r="2.5" fill="#0284c7" />
                <circle cx="26" cy="36" r="9" fill="#1e293b" />
                <circle cx="26" cy="36" r="5.5" fill="#64748b" />
                <circle cx="26" cy="36" r="2.5" fill="#0284c7" />
                <defs>
                  <linearGradient id="carBodyGrad" x1="8" y1="14" x2="101" y2="36" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" />
                    <stop offset="0.5" stopColor="#e2e8f0" />
                    <stop offset="1" stopColor="#0284c7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="page-width hero-light-content">
            <div className="hero-pill-badge">
              <span className="pill-dot" />
              {t("hero.badge")}
            </div>

            <h1 className="hero-light-title">
              {t("hero.title_part1")}
              <br />
              {t("hero.title_part2")} <span className="text-gradient-cyan">{t("hero.title_part3")}</span>
            </h1>

            <p className="hero-light-desc">
              {t("hero.desc")}
            </p>

            {/* Interactive Multi-Criteria Search Card */}
            <div className="search-interactive-card">
              {/* Vehicle Type Tabs */}
              <div className="search-vehicle-tabs">
                <button
                  type="button"
                  className={`vehicle-tab-btn ${searchVehicle === "car" ? "active" : ""}`}
                  onClick={() => setSearchVehicle("car")}
                >
                  <Car size={16} />
                  <span>{lang === "en" ? "Car 4 - 7 Seats" : "Ô tô 4 - 7 chỗ"}</span>
                </button>
                <button
                  type="button"
                  className={`vehicle-tab-btn ${searchVehicle === "bike" ? "active" : ""}`}
                  onClick={() => setSearchVehicle("bike")}
                >
                  <Navigation size={16} />
                  <span>{lang === "en" ? "Motorbike" : "Xe máy"}</span>
                </button>
                <button
                  type="button"
                  className={`vehicle-tab-btn ${searchVehicle === "ev" ? "active" : ""}`}
                  onClick={() => setSearchVehicle("ev")}
                >
                  <Zap size={16} />
                  <span>{lang === "en" ? "EV Charging Station" : "Trạm sạc xe điện EV"}</span>
                </button>
              </div>

              {/* Search Inputs Grid */}
              <div className="search-inputs-grid">
                {/* Location / Lot Selector */}
                <div className="search-field-group">
                  <label htmlFor="search-location">
                    <MapPin size={13} className="field-icon-muted" />
                    <span>{lang === "en" ? "LOCATION / PARKING LOT" : "KHU VỰC / BÃI ĐỖ XE"}</span>
                  </label>
                  <div className="search-select-wrapper">
                    <select
                      id="search-location"
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      className="search-field-select"
                    >
                      <option value="all">{lang === "en" ? "All Facilities (HCMC)" : "Tất cả bãi đỗ xe (TP. Hồ Chí Minh)"}</option>
                      <option value="landmark81">{lang === "en" ? "Landmark 81 Central Park" : "Landmark 81 Central Park (Bình Thạnh)"}</option>
                      <option value="bitexco">{lang === "en" ? "Bitexco Financial Tower" : "Bitexco Financial Tower (Quận 1)"}</option>
                      <option value="ftown3">{lang === "en" ? "F-Town 3 (Hi-Tech Park)" : "F-Town 3 (Khu Công Nghệ Cao)"}</option>
                      <option value="tan_son_nhat">{lang === "en" ? "Tan Son Nhat Airport - TCP" : "Sân bay Tân Sơn Nhất - Nhà xe TCP"}</option>
                    </select>
                    <ChevronDown size={14} className="select-arrow" />
                  </div>
                </div>

                {/* Duration Selector */}
                <div className="search-field-group">
                  <label htmlFor="search-duration">
                    <Clock size={13} className="field-icon-muted" />
                    <span>{lang === "en" ? "EXPECTED DURATION" : "THỜI LƯỢNG DỰ KIẾN"}</span>
                  </label>
                  <div className="search-select-wrapper">
                    <select
                      id="search-duration"
                      value={searchDuration}
                      onChange={(e) => setSearchDuration(e.target.value)}
                      className="search-field-select"
                    >
                      <option value="60">{lang === "en" ? "1 Hour (Short stay)" : "1 giờ (Tiêu chuẩn)"}</option>
                      <option value="120">{lang === "en" ? "2 - 4 Hours (Half-day)" : "2 - 4 giờ (Nửa ngày)"}</option>
                      <option value="480">{lang === "en" ? "4 - 8 Hours (Full-day)" : "4 - 8 giờ (Trong ngày)"}</option>
                      <option value="1440">{lang === "en" ? "Overnight (24h)" : "Gửi qua đêm (Overnight)"}</option>
                    </select>
                    <ChevronDown size={14} className="select-arrow" />
                  </div>
                </div>

                {/* Search Radius */}
                <div className="search-field-group">
                  <label htmlFor="search-radius">
                    <SlidersHorizontal size={13} className="field-icon-muted" />
                    <span>{lang === "en" ? "SEARCH RADIUS" : "PHẠM VI TÌM KIẾM"}</span>
                  </label>
                  <div className="search-select-wrapper">
                    <select
                      id="search-radius"
                      value={searchRadius}
                      onChange={(e) => setSearchRadius(e.target.value)}
                      className="search-field-select"
                    >
                      <option value="2">{lang === "en" ? "< 2 km (Walking)" : "Bán kính < 2 km (Đi bộ)"}</option>
                      <option value="5">{lang === "en" ? "< 5 km (Recommended)" : "Bán kính < 5 km (Tối ưu)"}</option>
                      <option value="10">{lang === "en" ? "< 10 km (Expanded)" : "Bán kính < 10 km (Mở rộng)"}</option>
                      <option value="all">{lang === "en" ? "Entire city" : "Toàn thành phố"}</option>
                    </select>
                    <ChevronDown size={14} className="select-arrow" />
                  </div>
                </div>

                {/* Submit Search Button */}
                <div className="search-btn-col">
                  <Link
                    to={`/search?lot=${searchLocation}&vehicle=${searchVehicle}&duration=${searchDuration}&radius=${searchRadius}&criteria=${selectedFilters.join(",")}`}
                    className="search-action-btn"
                  >
                    <Search size={18} />
                    <span>{lang === "en" ? "Find Parking" : "Tìm Bãi Đỗ"}</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

              {/* Priority Criteria Filter Row */}
              <div className="search-criteria-row">
                <span className="criteria-label">
                  <Filter size={13} className="field-icon-muted mr-1" />
                  {lang === "en" ? "Priority Criteria:" : "Tiêu chí ưu tiên:"}
                </span>
                <div className="criteria-chips-list">
                  <button
                    type="button"
                    className={`criteria-chip ${selectedFilters.includes("nearest") ? "is-selected" : ""}`}
                    onClick={() => toggleFilter("nearest")}
                  >
                    <Navigation size={12} className="chip-icon" />
                    <span>{lang === "en" ? "Nearest (GPS)" : "Gần tôi nhất (GPS)"}</span>
                  </button>
                  <button
                    type="button"
                    className={`criteria-chip ${selectedFilters.includes("cheapest") ? "is-selected" : ""}`}
                    onClick={() => toggleFilter("cheapest")}
                  >
                    <CreditCard size={12} className="chip-icon" />
                    <span>{lang === "en" ? "Cheapest Price" : "Giá thấp nhất"}</span>
                  </button>
                  <button
                    type="button"
                    className={`criteria-chip ${selectedFilters.includes("available") ? "is-selected" : ""}`}
                    onClick={() => toggleFilter("available")}
                  >
                    <Check size={12} className="chip-icon" />
                    <span>{lang === "en" ? "Most Slots Available" : "Nhiều chỗ trống nhất"}</span>
                  </button>
                  <button
                    type="button"
                    className={`criteria-chip ${selectedFilters.includes("ev_station") ? "is-selected" : ""}`}
                    onClick={() => toggleFilter("ev_station")}
                  >
                    <Zap size={12} className="chip-icon" />
                    <span>{lang === "en" ? "Fast EV Charger" : "Có trụ sạc EV"}</span>
                  </button>
                  <button
                    type="button"
                    className={`criteria-chip ${selectedFilters.includes("sheltered") ? "is-selected" : ""}`}
                    onClick={() => toggleFilter("sheltered")}
                  >
                    <ShieldCheck size={12} className="chip-icon" />
                    <span>{lang === "en" ? "Sheltered & Security" : "Có mái che & Camera AI"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* High-Contrast Luminous Trust Bar */}
            <div className="hero-trust-bar">
              <div className="trust-item">
                <BadgeCheck size={16} className="trust-icon" />
                <span>{t("hero.trust_1")}</span>
              </div>
              <div className="trust-item">
                <ShieldCheck size={16} className="trust-icon" />
                <span>{t("hero.trust_2")}</span>
              </div>
              <div className="trust-item">
                <Zap size={16} className="trust-icon" />
                <span>{t("hero.trust_3")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Stats Bar (4 White Cards) ── */}
        <section className="stats-light-section">
          <div className="page-width stats-grid-4">
            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">{t("stat.facilities")}</span>
                <div className="stat-icon-box bg-cyan-light">
                  <ParkingCircle size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">1,450+</div>
              <div className="stat-subtitle">{t("stat.facilities_sub")}</div>
              <div className="stat-card-footer">
                <span>{t("stat.facilities_desc")}</span>
                <a href="#gis-section" className="stat-link">
                  {t("stat.facilities_link")}
                </a>
              </div>
            </div>

            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">{t("stat.accuracy")}</span>
                <div className="stat-icon-box bg-cyan-light">
                  <Scan size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">99.4%</div>
              <div className="stat-subtitle">{t("stat.accuracy_sub")}</div>
              <div className="stat-card-footer">
                <span>{t("stat.accuracy_desc")}</span>
                <a href="#gis-section" className="stat-link">
                  {t("stat.accuracy_link")}
                </a>
              </div>
            </div>

            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">{t("stat.traffic")}</span>
                <div className="stat-icon-box bg-cyan-light">
                  <Car size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">32,000+</div>
              <div className="stat-subtitle">{t("stat.traffic_sub")}</div>
              <div className="stat-card-footer">
                <span>{t("stat.traffic_desc")}</span>
                <a href="#gis-section" className="stat-link">
                  {t("stat.traffic_link")}
                </a>
              </div>
            </div>

            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">{t("stat.auto")}</span>
                <div className="stat-icon-box bg-cyan-light">
                  <Cpu size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">100%</div>
              <div className="stat-subtitle">{t("stat.auto_sub")}</div>
              <div className="stat-card-footer">
                <span>{t("stat.auto_desc")}</span>
                <a href="#gis-section" className="stat-link">
                  {t("stat.auto_link")}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. GIS Map Center ── */}
        <section className="gis-light-section" id="gis-section">
          <div className="page-width">
            <div className="gis-top-header">
              <div>
                <span className="section-pill-tag">{t("gis.hub")}</span>
                <h2 className="section-title-light">{t("gis.title")}</h2>
                <p className="section-sub-light">
                  {t("gis.desc")}
                </p>
              </div>

              <div className="map-controls-group">
                <button
                  className={`map-tab ${mapTab === "map" ? "active" : ""}`}
                  onClick={() => setMapTab("map")}
                >
                  {t("gis.map")}
                </button>
                <button
                  className={`map-tab ${mapTab === "satellite" ? "active" : ""}`}
                  onClick={() => setMapTab("satellite")}
                >
                  {t("gis.satellite")}
                </button>
                <button
                  className={`map-tab ${mapTab === "3d" ? "active" : ""}`}
                  onClick={() => setMapTab("3d")}
                >
                  {t("gis.3d")}
                </button>
                <button className="map-icon-btn" title="Chế độ xem lưới">
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            </div>
            <p className="customer-home-map-note">
              {lang === "en"
                ? "The homepage map is illustrative. Use live lot search for current availability and duration-based price estimates."
                : "Bản đồ trang chủ mang tính minh họa. Dùng tìm kiếm bãi để xem chỗ trống và giá ước tính từ API."}
              {" "}<Link to="/booking">{lang === "en" ? "Search lots" : "Tìm và đặt chỗ"}</Link>
            </p>

            {/* Interactive Vector GIS Canvas */}
            <div className="gis-canvas-card">
              {/* Map Background Grid Simulation */}
              <div className="vector-map-bg">
                <svg className="map-vector-svg" viewBox="0 0 1000 500">
                  <path
                    d="M 50 100 Q 250 50 450 180 T 950 300"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="12"
                    opacity="0.5"
                  />
                  <path
                    d="M 100 450 Q 300 250 600 200 T 900 50"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="8"
                    opacity="0.4"
                  />
                  <path
                    d="M 200 150 Q 500 350 800 120"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3"
                    strokeDasharray="6,6"
                  />
                </svg>

                {/* Left Live Overlay Widget */}
                <div className="gis-overlay-widget">
                  <div className="widget-header">
                    <span className="dot-live" /> {t("gis.hub_title")}
                    <span className="live-hub-tag">DEMO VIEW</span>
                  </div>
                  <div className="widget-stat-row">
                    <span>{t("gis.hub_open")}</span>
                    <strong>{t("gis.hub_open_val")}</strong>
                  </div>
                  <div className="widget-stat-row">
                    <span>{t("gis.hub_avail")}</span>
                    <strong className="text-emerald-600">{t("gis.hub_avail_val")}</strong>
                  </div>
                  <div className="widget-stat-row">
                    <span>{t("gis.hub_fill")}</span>
                    <strong>84.2%</strong>
                  </div>
                  <div className="mini-chart">
                    <svg viewBox="0 0 100 20" className="w-full h-5 text-cyan-600 stroke-current">
                      <path d="M0 15 Q 25 5 50 12 T 100 2" fill="none" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                {/* Map Pins / Callouts */}
                <div className="map-pin-badge pin-1" style={{ top: "25%", left: "32%" }}>
                  <div className="pin-badge-header">
                    <span className="badge-status-dot green" /> {t("gis.pin1_name")}
                    <span className="badge-tag-green">{t("gis.pin1_tag")}</span>
                  </div>
                  <div className="pin-badge-body">
                    <strong>35.000đ/h</strong> · 0.8 km · <a href="#gis-section">{t("gis.view_detail")}</a>
                  </div>
                </div>

                <div className="map-pin-badge pin-2" style={{ top: "18%", left: "55%" }}>
                  <div className="pin-badge-header">
                    <span className="badge-status-dot green" /> {t("gis.pin2_name")}
                    <span className="badge-tag-green">{t("gis.pin2_tag")}</span>
                  </div>
                  <div className="pin-badge-body">
                    <strong>20.000đ/h</strong> · 1.2 km · <a href="#gis-section">{t("gis.view_detail")}</a>
                  </div>
                </div>

                <div className="map-pin-badge pin-3 offline-pin" style={{ top: "52%", left: "62%" }}>
                  <div className="pin-badge-header">
                    <span className="badge-status-dot red" /> {t("gis.pin3_name")}
                    <span className="badge-tag-red">{t("gis.pin3_tag")}</span>
                  </div>
                  <div className="pin-badge-body">
                    {lang === "en" ? (
                      <><strong>100% Load</strong> · Suspended · <span>15 slots holding</span></>
                    ) : (
                      <><strong>100% Tải trọng</strong> · Tạm ngừng nhận · <span>15 chỗ trống chờ xe</span></>
                    )}
                  </div>
                </div>

                <div className="map-pin-user" style={{ top: "72%", left: "24%" }}>
                  <div className="user-pin-bubble">
                    <Navigation size={14} className="text-white fill-current" /> {t("gis.user_pos")}
                  </div>
                </div>

                {/* Slot popup integration (API Data) */}
                <div className="gis-popup-card-light">
                  <div className="popup-card-title">
                    <MapPin size={13} className="text-cyan-600" /> {slots[0]?.parkingLotName || "BÃI ĐỖ XE"}
                    <span className={`api-live-tag ${apiState}`}>
                      {apiState === "online" ? "API" : apiState === "loading" ? "..." : "OFF"}
                    </span>
                  </div>
                  {apiState === "online" && slots.length > 0 ? (
                    <div className="popup-slots-mini">
                      {slots.slice(0, 4).map((slot) => {
                        const st = slotStatus(slot.status, lang);
                        return (
                          <div className="slot-mini-row" key={slot.slotId}>
                            <span className={`slot-dot ${st.className}`} />
                            <span className="slot-code">{slot.slotId}</span>
                            <span className="slot-loc">
                              {lang === "en" ? `Floor ${slot.floor} - ${slot.zone}` : `Tầng ${slot.floor} - ${slot.zone}`}
                            </span>
                            <span className={`slot-st-text ${st.className}`}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="popup-empty-state">
                      {apiState === "loading" ? t("gis.api_syncing") : t("gis.api_empty")}
                    </div>
                  )}
                </div>
              </div>

              {/* Map Legend Footer */}
              <div className="gis-legend-bar">
                <span className="legend-label">{t("gis.legend")}</span>
                <div className="legend-items">
                  <span className="legend-item">
                    <span className="dot green" /> {t("gis.legend_green")}
                  </span>
                  <span className="legend-item">
                    <span className="dot yellow" /> {t("gis.legend_yellow")}
                  </span>
                  <span className="legend-item">
                    <span className="dot red" /> {t("gis.legend_red")}
                  </span>
                  <span className="legend-item">
                    <span className="dot cyan" /> {t("gis.legend_cyan")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Solutions Section ── */}
        <section className="solutions-light-section" id="solutions">
          <div className="page-width">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="section-pill-tag">{t("sol.tag")}</span>
              <h2 className="section-title-light mt-2">{t("sol.title")}</h2>
              <p className="section-sub-light mt-2">
                {t("sol.desc")}
              </p>
            </div>

            <div className="solutions-cards-grid">
              {SOLUTIONS.map((s, i) => (
                <div className="solution-card-white" key={i}>
                  <div className="solution-icon-wrap">{s.icon}</div>
                  <h3 className="solution-card-title">{t(`sol.s${i + 1}_title`)}</h3>
                  <p className="solution-card-desc">{t(`sol.s${i + 1}_desc`)}</p>
                  <div className="solution-card-footer">
                    <span className="tag-pill">{t(`sol.s${i + 1}_tag`)}</span>
                    <ArrowRight size={14} className="text-cyan-600 hover-arrow" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. Photo Showcase Section ── */}
        <section className="photos-light-section" id="about">
          <div className="page-width">
            <div className="photos-grid-3">
              {parkingPhotos.map((photo, i) => (
                <div className="photo-card" key={i}>
                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                  <div className="photo-card-overlay">
                    <span className="photo-tag">{photo.tag}</span>
                    <h3 className="photo-title">{photo.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. Dark CTA Banner ── */}
        <section className="cta-dark-section">
          <div className="page-width">
            <div className="cta-dark-card">
              <div className="cta-card-content">
                <div className="cta-badge">
                  <span className="live-dot-green" /> {t("cta.badge")}
                </div>
                <h2 className="cta-dark-title">
                  {t("cta.title")}
                </h2>
                <p className="cta-dark-desc">
                  {t("cta.desc")}
                </p>

                <div className="cta-metrics-row">
                  <span>
                    <span className="dot-green" /> {t("cta.metric_latency")} <strong>28.4ms</strong>
                  </span>
                  <span className="sep">•</span>
                  <span>
                    <span className="dot-green" /> {t("cta.metric_uptime")} <strong>99.98% / 30d</strong>
                  </span>
                  <span className="sep">•</span>
                  <span>
                    <span className="dot-green" /> {t("cta.metric_interval")} <strong>1.2s</strong>
                  </span>
                </div>
              </div>

              <div className="cta-card-actions">
                <Link className="button button-cyan-solid" to="/register">
                  {t("cta.btn_book")}
                </Link>
                <a className="button button-glass-outline" href="#gis-section">
                  {t("cta.btn_gis")}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── 9. Multi-Column Footer ── */}
      <footer className="site-footer-dark">
        <div className="page-width footer-grid-4">
          <div className="footer-brand-col">
            <Link className="brand footer-brand" to="/">
              <span className="brand-logo-icon">
                <ParkingCircle size={22} className="text-cyan-400" />
              </span>
              <div className="brand-text">
                <span className="brand-title text-white">
                  Park<span className="brand-cyan">Matrix</span>
                </span>
                <span className="brand-sub text-gray-400">SMART PARKING PLATFORM</span>
              </div>
            </Link>
            <p className="footer-desc mt-4">
              {t("footer.desc")}
            </p>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">{t("footer.support")}</h4>
            <ul className="footer-links">
              <li><a href="#gis-section">{lang === "en" ? "Booking Guide" : "Hướng dẫn đặt chỗ"}</a></li>
              <li><Link to="/terms">{lang === "en" ? "Parking Rules" : "Quy định bãi đỗ"}</Link></li>
              <li><a href="#solutions">{lang === "en" ? "EV Charging Station" : "Trạm sạc EV"}</a></li>
              <li><a href="mailto:support@parkmatrix.vn">{lang === "en" ? "Report Incident 24/7" : "Báo sự cố 24/7"}</a></li>
              <li><a href="#gis-section">API Integration Docs</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "Infrastructure Coverage" : "Độ Phủ Hạ Tầng"}</h4>
            <ul className="footer-links">
              <li><a href="#gis-section">{lang === "en" ? "Ho Chi Minh City (62 hubs)" : "TP. Hồ Chí Minh (62 bãi)"}</a></li>
              <li><a href="#gis-section">{lang === "en" ? "Hanoi (48 hubs)" : "Hà Nội (48 bãi)"}</a></li>
              <li><a href="#gis-section">{lang === "en" ? "Da Nang (24 hubs)" : "Đà Nẵng (24 bãi)"}</a></li>
              <li><a href="#gis-section">{lang === "en" ? "Binh Duong (18 hubs)" : "Bình Dương (18 bãi)"}</a></li>
              <li><a href="#gis-section">{lang === "en" ? "Hai Phong (12 hubs)" : "Hải Phòng (12 bãi)"}</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "For Enterprise" : "Dành Cho Doanh Nghiệp"}</h4>
            <ul className="footer-links">
              <li><a href="#solutions">{lang === "en" ? "Parking Lot Owners" : "Chủ bãi đỗ xe"}</a></li>
              <li><a href="#solutions">{lang === "en" ? "VMS Platform Integration" : "Tích hợp VMS Platform"}</a></li>
              <li><a href="#solutions">{lang === "en" ? "AI ANPR Camera Partner" : "Hợp tác Camera ANPR AI"}</a></li>
              <li><a href="/register">{lang === "en" ? "Partner Registration" : "Đăng ký Đối tác"}</a></li>
            </ul>
          </div>
        </div>

        <div className="page-width footer-bottom-dark">
          <span>{t("footer.rights")}</span>
          <div className="footer-bottom-links">
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <span>•</span>
            <Link to="/terms">{t("footer.terms")}</Link>
            <span>•</span>
            <a href="mailto:support@parkmatrix.vn">Support: support@parkmatrix.vn</a>
          </div>
        </div>
      </footer>

      {/* Logout Modal */}
      {showLogout && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowLogout(false);
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <button
              className="modal-close"
              aria-label={lang === "en" ? "Close" : "Đóng"}
              onClick={() => setShowLogout(false)}
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <LogOut size={20} />
            </span>
            <h2 id="logout-title">
              {lang === "en" ? "Log out of your account?" : "Đăng xuất khỏi tài khoản?"}
            </h2>
            <p>
              {lang === "en"
                ? "Your active session on this device will be terminated."
                : "Phiên đăng nhập trên thiết bị này sẽ được kết thúc."}
            </p>
            <div className="modal-actions">
              <button className="button button-light" onClick={() => setShowLogout(false)}>
                {lang === "en" ? "Stay" : "Ở lại"}
              </button>
              <button className="button button-dark" onClick={handleLogout}>
                <Check size={16} /> {lang === "en" ? "Log Out" : "Đăng xuất"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
