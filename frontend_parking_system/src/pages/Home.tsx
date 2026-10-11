import { useEffect, useState } from "react";
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
  if (normalized.includes("reserved")) return { className: "reserved", label: lang === "en" ? "Reserved" : "Đã giữ" };
  if (normalized.includes("occupied")) return { className: "occupied", label: lang === "en" ? "Occupied" : "Đang có xe" };
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
  const [activeFilter, setActiveFilter] = useState("filter.near");
  const [mapTab, setMapTab] = useState<"map" | "satellite" | "3d">("map");

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

  const filterPills = [
    { key: "filter.near", fallback: "Gần tôi" },
    { key: "filter.available", fallback: "Còn chỗ trống" },
    { key: "filter.best_price", fallback: "Giá tốt nhất" },
    { key: "filter.has_charge", fallback: "Có chỗ sạc" },
    { key: "filter.ev", fallback: "Trạm sạc EV" },
    { key: "filter.open_247", fallback: "Mở cửa 24/7" },
    { key: "filter.car_type", fallback: "Ô tô 4-7 chỗ" },
  ];

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

      {/* ── 2. Header / Navbar ── */}
      <header className="site-header-light">
        <div className="page-width header-inner">
          <Link className="brand" to="/" aria-label="ParkMatrix trang chủ">
            <span className="brand-logo-icon">
              <ParkingCircle size={24} className="text-cyan-600" />
            </span>
            <div className="brand-text">
              <span className="brand-title">
                Park<span className="brand-cyan">Matrix</span>
              </span>
              <span className="brand-sub">SMART PARKING PLATFORM</span>
            </div>
          </Link>

          <nav className={`main-nav-light ${mobileMenu ? "is-open" : ""}`} aria-label="Điều hướng chính">
            <a href="#gis-section" onClick={() => setMobileMenu(false)} className="nav-item">
              {t("nav.find")}
            </a>
            <a href="#gis-section" onClick={() => setMobileMenu(false)} className="nav-item">
              {t("nav.map")}
            </a>
            <a href="#solutions" onClick={() => setMobileMenu(false)} className="nav-item">
              {t("nav.solutions")}
            </a>
            <a href="#about" onClick={() => setMobileMenu(false)} className="nav-item">
              {t("nav.infrastructure")}
            </a>
          </nav>

          <div className="header-actions-light">
            <div className="lang-switcher" role="group" aria-label="Chọn ngôn ngữ">
              <button
                type="button"
                className={`lang-btn ${lang === "vi" ? "active" : ""}`}
                onClick={() => setLang("vi")}
                title="Tiếng Việt"
              >
                VN
              </button>
              <span className="lang-sep">|</span>
              <button
                type="button"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                title="English"
              >
                EN
              </button>
            </div>

            <button className="icon-btn" aria-label="Thông báo">
              <Bell size={18} />
            </button>

            {isAuthenticated ? (
              <div className="user-profile-badge">
                <div className="avatar-circle">
                  <User size={16} />
                </div>
                <div className="user-info-text">
                  <span className="user-name">{user?.fullName || user?.userName}</span>
                  <span className="user-role">{t("nav.vip")}</span>
                </div>
                <button className="logout-icon-btn" title={t("nav.logout")} onClick={() => setShowLogout(true)}>
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="auth-btns">
                <Link className="login-btn-black header-auth-btn" to="/login">
                  {t("nav.login")}
                </Link>
                <Link className="register-btn-cyan header-auth-btn" to="/register">
                  {t("nav.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── 3. Light Hero Section ── */}
        <section className="hero-light-section hero-animated-parking-bg">
          {/* Animated Parking Layer */}
          <div className="parking-motion-bg">
            <div className="parking-neon-grid" />
            <div className="parking-laser-scanner" />
            <div className="parking-traffic-stream">
              <span className="car-pulse car-pulse-1" />
              <span className="car-pulse car-pulse-2" />
              <span className="car-pulse car-pulse-3" />
            </div>
            <div className="hero-bg-overlay-glass" />
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

            {/* Floating Glass Search Container */}
            <div className="search-floating-card">
              <div className="search-grid-inputs">
                <div className="search-input-col">
                  <label>
                    <MapPin size={14} className="input-icon text-cyan-600" /> {t("search.destination")}
                  </label>
                  <div className="select-box">
                    <span>{t("search.destination_val")}</span>
                    <ChevronDown size={15} className="text-gray-400" />
                  </div>
                </div>

                <div className="search-input-col">
                  <label>
                    <Clock size={14} className="input-icon text-cyan-600" /> {t("search.time")}
                  </label>
                  <div className="select-box">
                    <span>{t("search.time_val")}</span>
                    <ChevronDown size={15} className="text-gray-400" />
                  </div>
                </div>

                <div className="search-input-col">
                  <label>
                    <Car size={14} className="input-icon text-cyan-600" /> {t("search.vehicle")}
                  </label>
                  <div className="select-box">
                    <span>{t("search.vehicle_val")}</span>
                    <ChevronDown size={15} className="text-gray-400" />
                  </div>
                </div>

                <button className="search-submit-btn">
                  <Search size={18} /> {t("search.submit")}
                </button>
              </div>

              {/* Quick Filters Row */}
              <div className="search-filter-row">
                <span className="filter-title">{t("search.filter_label")}</span>
                <div className="filter-chips">
                  {filterPills.map((pill) => (
                    <button
                      key={pill.key}
                      className={`chip ${activeFilter === pill.key ? "active" : ""}`}
                      onClick={() => setActiveFilter(pill.key)}
                    >
                      {t(pill.key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Under Search Badges */}
            <div className="hero-trust-bar">
              <div className="trust-item">
                <BadgeCheck size={16} className="text-cyan-600" /> {t("hero.trust_1")}
              </div>
              <div className="trust-item">
                <ShieldCheck size={16} className="text-cyan-600" /> {t("hero.trust_2")}
              </div>
              <div className="trust-item">
                <Zap size={16} className="text-cyan-600" /> {t("hero.trust_3")}
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
                    <span className="live-hub-tag">LIVE HUB</span>
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
                    <MapPin size={13} className="text-cyan-600" /> PARKMATRIX CENTRAL HUB
                    <span className={`api-live-tag ${apiState}`}>
                      {apiState === "online" ? "LIVE" : apiState === "loading" ? "..." : "OFF"}
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
              <li><a href="#solutions">{lang === "en" ? "Parking Rules" : "Quy định bãi đỗ"}</a></li>
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
            <a href="#">{t("footer.privacy")}</a>
            <span>•</span>
            <a href="#">{t("footer.terms")}</a>
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