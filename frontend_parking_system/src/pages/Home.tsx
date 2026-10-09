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
  FileText,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  ParkingCircle,
  Radio,
  Scan,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  User,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, type ParkingSlot } from "../services/api";

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

function slotStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("available")) return { className: "available", label: "Còn chỗ" };
  if (normalized.includes("reserved")) return { className: "reserved", label: "Đã giữ" };
  if (normalized.includes("occupied")) return { className: "occupied", label: "Đang có xe" };
  return { className: "maintenance", label: status || "Không rõ" };
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
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [apiState, setApiState] = useState<"loading" | "online" | "offline">("loading");
  const [showLogout, setShowLogout] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Gần tôi");
  const [mapTab, setMapTab] = useState<"map" | "satellite" | "3d">("map");

  useEffect(() => {
    let active = true;
    Promise.all([api.checkHealth(), api.getSlots()])
      .then(([healthy, items]) => {
        if (!active) return;
        setSlots(items);
        setApiState(healthy ? "online" : "offline");
      })
      .catch(() => {
        if (!active) return;
        setApiState("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowLogout(false);
  };

  const filterPills = [
    "Gần tôi",
    "Còn chỗ trống",
    "Giá tốt nhất",
    "Có chỗ sạc",
    "Trạm sạc EV",
    "Mở cửa 24/7",
    "Ô tô 4-7 chỗ",
  ];

  return (
    <div className="site-shell light-theme">
      {/* ── 1. Top Status Banner ── */}
      <div className="top-status-bar">
        <div className="page-width status-bar-inner">
          <div className="status-left">
            <span className="live-status-pill">
              <span className="live-dot-green" /> HẠ TẦNG GIÁO SÁT QUỐC GIA: 100% HOẠT ĐỘNG
            </span>
            <span className="bar-divider">|</span>

            <span className="bar-divider">|</span>
          </div>
          <div className="status-right">

            <span className="bar-divider">|</span>
            <span className="location-weather">TP. HỒ CHÍ MINH • 29°C</span>
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
              Tìm Bãi Đỗ
            </a>
            <a href="#gis-section" onClick={() => setMobileMenu(false)} className="nav-item">
              Sơ Đồ &amp; Đặt Chỗ
            </a>
            <a href="#solutions" onClick={() => setMobileMenu(false)} className="nav-item">
              Giải Pháp
            </a>
            <a href="#about" onClick={() => setMobileMenu(false)} className="nav-item">
              Hạ Tầng
            </a>
          </nav>

          <div className="header-actions-light">
            <div className="lang-switcher">
              <span className="active-lang">VN</span>
              <span className="lang-sep">|</span>
              <span className="inactive-lang">EN</span>
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
                  <span className="user-role">Khách hàng VIP</span>
                </div>
                <button className="logout-icon-btn" title="Đăng xuất" onClick={() => setShowLogout(true)}>
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="auth-btns">
                <Link className="login-link-light" to="/login">
                  Đăng Nhập
                </Link>
                <Link className="button button-primary-cyan" to="/register">
                  Đăng Ký Nhanh
                </Link>
              </div>
            )}

            <button
              className="menu-toggle-light"
              aria-label={mobileMenu ? "Đóng menu" : "Mở menu"}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── 3. Light Hero Section ── */}
        <section className="hero-light-section">
          <div className="hero-bg-gradient" />
          <div className="page-width hero-light-content">
            <div className="hero-pill-badge">
              <span className="pill-dot" />
              MẠNG LƯỚI HẠ TẦNG GIÁO SÁT QUỐC GIA • LIVE TELEMETRY V4 URBAN MOBILITY ENGINE
            </div>

            <h1 className="hero-light-title">
              Tìm Chỗ Đỗ Xe Thông Minh,
              <br />
              Nhanh <span className="text-gradient-cyan">Chóng &amp; Chuẩn Xác</span>
            </h1>

            <p className="hero-light-desc">
              Khám phá các bãi đỗ xe gần bạn, kiểm tra tình trạng chỗ trống theo thời gian thực và đặt
              trước vị trí với công nghệ IoT, GIS và ANPR.
            </p>

            {/* Floating Glass Search Container */}
            <div className="search-floating-card">
              <div className="search-grid-inputs">
                <div className="search-input-col">
                  <label>
                    <MapPin size={14} className="input-icon text-cyan-600" /> CỬA ĐIỂM CẦN ĐẾN
                  </label>
                  <div className="select-box">
                    <span>Quận 1, TP. Hồ Chí Minh</span>
                    <ChevronDown size={15} className="text-gray-400" />
                  </div>
                </div>

                <div className="search-input-col">
                  <label>
                    <Clock size={14} className="input-icon text-cyan-600" /> THỜI GIAN ĐẾN
                  </label>
                  <div className="select-box">
                    <span>Hôm nay, 14:00 - 17:00</span>
                    <ChevronDown size={15} className="text-gray-400" />
                  </div>
                </div>

                <div className="search-input-col">
                  <label>
                    <Car size={14} className="input-icon text-cyan-600" /> LOẠI PHƯƠNG TIỆN
                  </label>
                  <div className="select-box">
                    <span>Ô tô 4 - 7 chỗ</span>
                    <ChevronDown size={15} className="text-gray-400" />
                  </div>
                </div>

                <button className="search-submit-btn">
                  <Search size={18} /> Tìm Bãi Đỗ Xe
                </button>
              </div>

              {/* Quick Filters Row */}
              <div className="search-filter-row">
                <span className="filter-title">Bộ lọc nhanh:</span>
                <div className="filter-chips">
                  {filterPills.map((pill) => (
                    <button
                      key={pill}
                      className={`chip ${activeFilter === pill ? "active" : ""}`}
                      onClick={() => setActiveFilter(pill)}
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Under Search Badges */}
            <div className="hero-trust-bar">
              <div className="trust-item">
                <BadgeCheck size={16} className="text-cyan-600" /> Chứng nhận ANPR chuẩn Quốc gia
              </div>
              <div className="trust-item">
                <ShieldCheck size={16} className="text-cyan-600" /> Bàn giao lưới thời gian thực GiST/Spatial
              </div>
              <div className="trust-item">
                <Zap size={16} className="text-cyan-600" /> Tự động thanh toán chạm &amp; đi Mobile
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Stats Bar (4 White Cards) ── */}
        <section className="stats-light-section">
          <div className="page-width stats-grid-4">
            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">TỔNG CƠ SỞ</span>
                <div className="stat-icon-box bg-cyan-light">
                  <ParkingCircle size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">1,450+</div>
              <div className="stat-subtitle">Bãi đỗ xe đối tác</div>
              <div className="stat-card-footer">
                <span>Đồng bộ liên tục qua mạng IoT GIS</span>
                <a href="#gis-section" className="stat-link">
                  Phủ khắp 63 tỉnh thành | TOÀN QUỐC →
                </a>
              </div>
            </div>

            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">ĐỘ CHÍNH XÁC</span>
                <div className="stat-icon-box bg-cyan-light">
                  <Scan size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">99.4%</div>
              <div className="stat-subtitle">Độ chính xác cảm biến</div>
              <div className="stat-card-footer">
                <span>Cảm biến kép Siêu âm &amp; Từ trường</span>
                <a href="#gis-section" className="stat-link">
                  Xác minh độ rộng | ĐỘ RỘNG →
                </a>
              </div>
            </div>

            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">LƯU LƯỢNG NGÀY</span>
                <div className="stat-icon-box bg-cyan-light">
                  <Car size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">32,000+</div>
              <div className="stat-subtitle">Lượt gửi xe / ngày</div>
              <div className="stat-card-footer">
                <span>Lưu lượng phương tiện gửi/rút</span>
                <a href="#gis-section" className="stat-link">
                  Giám sát 450 Trung tâm thương mại | HIỆN TẠI →
                </a>
              </div>
            </div>

            <div className="stat-card-white">
              <div className="stat-card-header">
                <span className="stat-label">QUY TRÌNH TỰ ĐỘNG</span>
                <div className="stat-icon-box bg-cyan-light">
                  <Cpu size={20} className="text-cyan-600" />
                </div>
              </div>
              <div className="stat-number">100%</div>
              <div className="stat-subtitle">Tự động hóa số</div>
              <div className="stat-card-footer">
                <span>Không dừng ANPR Barie mở &lt;0.3s</span>
                <a href="#gis-section" className="stat-link">
                  AI Edge xử lý tại chỗ 50ms | TỰ ĐỘNG XỨ LÝ →
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
                <span className="section-pill-tag">SPATIAL TELEMETRY HUB</span>
                <h2 className="section-title-light">Trung Tâm Bản Đồ Không Gian GIS</h2>
                <p className="section-sub-light">
                  Mạng lưới định vị vệ tinh và vận hành toàn bãi xe thời gian thực TP. Hồ Chí Minh
                </p>
              </div>

              <div className="map-controls-group">
                <button
                  className={`map-tab ${mapTab === "map" ? "active" : ""}`}
                  onClick={() => setMapTab("map")}
                >
                  Bản đồ
                </button>
                <button
                  className={`map-tab ${mapTab === "satellite" ? "active" : ""}`}
                  onClick={() => setMapTab("satellite")}
                >
                  Vệ tinh
                </button>
                <button
                  className={`map-tab ${mapTab === "3d" ? "active" : ""}`}
                  onClick={() => setMapTab("3d")}
                >
                  Lớp 3D
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
                    <span className="dot-live" /> Khu Vực 1 Quận 1
                    <span className="live-hub-tag">LIVE HUB</span>
                  </div>
                  <div className="widget-stat-row">
                    <span>Tổng số chỗ đang mở:</span>
                    <strong>62 điểm</strong>
                  </div>
                  <div className="widget-stat-row">
                    <span>Chỗ trống thực tế:</span>
                    <strong className="text-emerald-600">887 chỗ</strong>
                  </div>
                  <div className="widget-stat-row">
                    <span>Mức độ lấp đầy:</span>
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
                    <span className="badge-status-dot green" /> SAIGON CENTRE
                    <span className="badge-tag-green">125 chỗ trống</span>
                  </div>
                  <div className="pin-badge-body">
                    <strong>35.000đ/h</strong> · 0.8 km · <a href="#gis-section">Chi tiết →</a>
                  </div>
                </div>

                <div className="map-pin-badge pin-2" style={{ top: "18%", left: "55%" }}>
                  <div className="pin-badge-header">
                    <span className="badge-status-dot green" /> SKYVIEW GRAND TOWER
                    <span className="badge-tag-green">64 chỗ trống</span>
                  </div>
                  <div className="pin-badge-body">
                    <strong>20.000đ/h</strong> · 1.2 km · <a href="#gis-section">Chi tiết →</a>
                  </div>
                </div>

                <div className="map-pin-badge pin-3 offline-pin" style={{ top: "52%", left: "62%" }}>
                  <div className="pin-badge-header">
                    <span className="badge-status-dot red" /> NHÀ BÈ ĐỒNG DIỄN
                    <span className="badge-tag-red">Mất kết nối</span>
                  </div>
                  <div className="pin-badge-body">
                    <strong>100% Tải trọng</strong> · Tạm ngừng nhận · <span>15 chỗ trống chờ xe</span>
                  </div>
                </div>

                <div className="map-pin-user" style={{ top: "72%", left: "24%" }}>
                  <div className="user-pin-bubble">
                    <Navigation size={14} className="text-white fill-current" /> Vị trí của bạn
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
                        const st = slotStatus(slot.status);
                        return (
                          <div className="slot-mini-row" key={slot.slotId}>
                            <span className={`slot-dot ${st.className}`} />
                            <span className="slot-code">{slot.slotId}</span>
                            <span className="slot-loc">
                              Tầng {slot.floor} - {slot.zone}
                            </span>
                            <span className={`slot-st-text ${st.className}`}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="popup-empty-state">
                      {apiState === "loading" ? "Đang đồng bộ dữ liệu bãi đỗ..." : "Dữ liệu API chưa khả dụng"}
                    </div>
                  )}
                </div>
              </div>

              {/* Map Legend Footer */}
              <div className="gis-legend-bar">
                <span className="legend-label">Hiển thị nhanh:</span>
                <div className="legend-items">
                  <span className="legend-item">
                    <span className="dot green" /> Còn chỗ (&gt;20)
                  </span>
                  <span className="legend-item">
                    <span className="dot yellow" /> Sắp đầy (1-19)
                  </span>
                  <span className="legend-item">
                    <span className="dot red" /> Hết chỗ (0)
                  </span>
                  <span className="legend-item">
                    <span className="dot cyan" /> Trạm EV
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
              <span className="section-pill-tag">CÔNG NGHỆ ĐIỀU PHỐI ĐÔ THỊ</span>
              <h2 className="section-title-light mt-2">Giải Pháp Toàn Diện Cho Đô Thị Thông Minh</h2>
              <p className="section-sub-light mt-2">
                Số hóa toàn bộ quy trình gửi xe từ tìm kiếm, dẫn đường, giữ chỗ cho tới nhận diện biển số
                tự động và thanh toán không tiền mặt.
              </p>
            </div>

            <div className="solutions-cards-grid">
              {SOLUTIONS.map((s, i) => (
                <div className="solution-card-white" key={i}>
                  <div className="solution-icon-wrap">{s.icon}</div>
                  <h3 className="solution-card-title">{s.title}</h3>
                  <p className="solution-card-desc">{s.desc}</p>
                  <div className="solution-card-footer">
                    <span className="tag-pill">{s.tag}</span>
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
                  <span className="live-dot-green" /> HỆ THỐNG ĐIỀU PHỐI SỐ THÔNG MINH
                </div>
                <h2 className="cta-dark-title">
                  Sẵn sàng nâng tầm trải nghiệm đỗ xe thông minh cùng ParkMatrix?
                </h2>
                <p className="cta-dark-desc">
                  Kết nối trực tiếp vào mạng lưới hạ tầng điều phối thông minh, loại bỏ hoàn toàn nỗi
                  lo kẹt xe tìm chỗ tại các khu trung tâm thương mại và đô thị phức hợp.
                </p>

                <div className="cta-metrics-row">
                  <span>
                    <span className="dot-green" /> Độ trễ lệnh: <strong>28.4ms</strong>
                  </span>
                  <span className="sep">•</span>
                  <span>
                    <span className="dot-green" /> Thời gian Uptime: <strong>99.98% / 30 ngày</strong>
                  </span>
                  <span className="sep">•</span>
                  <span>
                    <span className="dot-green" /> Định kỳ cập nhật: <strong>1.2s</strong>
                  </span>
                </div>
              </div>

              <div className="cta-card-actions">
                <Link className="button button-cyan-solid" to="/register">
                  📱 Đặt Chỗ Ngay
                </Link>
                <a className="button button-glass-outline" href="#gis-section">
                  🛠 Tìm Hiểu Công Nghệ GIS
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
              Nền tảng quản lý bãi đỗ xe thông minh, đa cơ sở hàng đầu Việt Nam. Tích hợp IoT, AI ANPR
              và bản đồ số GIS thời gian thực.
            </p>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Trung Tâm Hỗ Trợ</h4>
            <ul className="footer-links">
              <li><a href="#gis-section">Hướng dẫn đặt chỗ</a></li>
              <li><a href="#solutions">Quy định bãi đỗ</a></li>
              <li><a href="#solutions">Trạm sạc EV</a></li>
              <li><a href="mailto:support@parkmatrix.vn">Báo sự cố 24/7</a></li>
              <li><a href="#gis-section">API Integration Docs</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Độ Phủ Hạ Tầng</h4>
            <ul className="footer-links">
              <li><a href="#gis-section">TP. Hồ Chí Minh (62 bãi)</a></li>
              <li><a href="#gis-section">Hà Nội (48 bãi)</a></li>
              <li><a href="#gis-section">Đà Nẵng (24 bãi)</a></li>
              <li><a href="#gis-section">Bình Dương (18 bãi)</a></li>
              <li><a href="#gis-section">Hải Phòng (12 bãi)</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Dành Cho Doanh Nghiệp</h4>
            <ul className="footer-links">
              <li><a href="#solutions">Chủ bãi đỗ xe</a></li>
              <li><a href="#solutions">Tích hợp VMS Platform</a></li>
              <li><a href="#solutions">Hợp tác Camera ANPR AI</a></li>
              <li><a href="/register">Đăng ký Đối tác</a></li>
            </ul>
          </div>
        </div>

        <div className="page-width footer-bottom-dark">
          <span>© 2026 ParkMatrix System. All rights reserved.</span>
          <div className="footer-bottom-links">
            <a href="#">Bảo mật thông tin</a>
            <span>•</span>
            <a href="#">Điều khoản sử dụng</a>
            <span>•</span>
            <a href="mailto:supporttotrieutien@gmail.com">totrieutien@gmail.com</a>
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
              aria-label="Đóng"
              onClick={() => setShowLogout(false)}
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <LogOut size={20} />
            </span>
            <h2 id="logout-title">Đăng xuất khỏi tài khoản?</h2>
            <p>Phiên đăng nhập trên thiết bị này sẽ được kết thúc.</p>
            <div className="modal-actions">
              <button className="button button-light" onClick={() => setShowLogout(false)}>
                Ở lại
              </button>
              <button className="button button-dark" onClick={handleLogout}>
                <Check size={16} /> Đăng xuất
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}