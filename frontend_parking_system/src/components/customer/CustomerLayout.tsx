import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Navigation,
  ParkingCircle,
  Search,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

type CustomerLayoutProps = {
  children: ReactNode;
  topSlot?: ReactNode;
  onRequestLogout?: () => void;
};

export default function CustomerLayout({
  children,
  topSlot,
  onRequestLogout,
}: CustomerLayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false);
  const bookingMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (bookingMenuRef.current && !bookingMenuRef.current.contains(event.target as Node)) {
        setBookingMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBookingMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const closeMenus = () => {
    setBookingMenuOpen(false);
    setMobileMenuOpen(false);
  };
  const requestLogout = () => {
    closeMenus();
    if (onRequestLogout) {
      onRequestLogout();
    } else {
      void logout();
    }
  };

  const header = (
    <header className="site-header-pill-wrapper">
      <div className="site-header-pill">
        <Link className="brand-pill" to="/" aria-label="ParkMatrix trang chủ" onClick={closeMenus}>
          <span className="brand-pill-logo"><ParkingCircle size={22} /></span>
          <span className="brand-pill-text">
            <span className="brand-pill-title">Park<span className="brand-cyan">Matrix</span><span className="brand-pill-dot" /></span>
          </span>
        </Link>

        <nav
          id="customer-main-nav"
          className={`main-nav-pill ${mobileMenuOpen ? "is-open" : ""}`}
          aria-label="Điều hướng chính"
        >
          <div
            ref={bookingMenuRef}
            className="nav-dropdown-wrapper"
            onMouseEnter={() => setBookingMenuOpen(true)}
            onMouseLeave={() => setBookingMenuOpen(false)}
          >
            <button
              type="button"
              className={`nav-item-pill nav-dropdown-btn ${bookingMenuOpen ? "is-active" : ""}`}
              onClick={() => setBookingMenuOpen(open => !open)}
              aria-expanded={bookingMenuOpen}
              aria-controls="customer-booking-menu"
            >
              <span>{lang === "en" ? "Parking & Booking" : "Đặt Chỗ & Bãi Đỗ"}</span>
              <ChevronDown size={14} className={`dropdown-chevron ${bookingMenuOpen ? "rotate-up" : ""}`} />
            </button>
            {bookingMenuOpen && (
              <div id="customer-booking-menu" className="nav-dropdown-menu">
                <Link to="/search" onClick={closeMenus} className="dropdown-menu-item">
                  <span className="dropdown-item-icon bg-blue"><Search size={18} /></span>
                  <span className="dropdown-item-content">
                    <span className="dropdown-item-title">{lang === "en" ? "Smart Parking Search" : "Tìm Bãi Đỗ Thông Minh"}</span>
                    <span className="dropdown-item-desc">{lang === "en" ? "Find nearest & cheapest with GPS" : "So sánh khoảng cách & ước tính giá gửi"}</span>
                  </span>
                </Link>
                <a href="/#gis-section" onClick={closeMenus} className="dropdown-menu-item">
                  <span className="dropdown-item-icon bg-emerald"><Navigation size={18} /></span>
                  <span className="dropdown-item-content">
                    <span className="dropdown-item-title">{lang === "en" ? "Live GIS Map & Directory" : "Sơ Đồ & Vị Trí Bãi Xe"}</span>
                    <span className="dropdown-item-desc">{lang === "en" ? "Real-time citywide slot network" : "Bản đồ số GIS thời gian thực toàn thành phố"}</span>
                  </span>
                </a>
              </div>
            )}
          </div>
          <Link to="/faq" onClick={closeMenus} className="nav-item-pill">FAQ</Link>
          <a href="/#solutions" onClick={closeMenus} className="nav-item-pill">{t("nav.solutions")}</a>
          <a href="/#about" onClick={closeMenus} className="nav-item-pill">{t("nav.infrastructure")}</a>
          <div className="mobile-nav-account">
            {isAuthenticated ? (
              <>
                <span className="customer-nav-user">{user?.fullName || user?.userName}</span>
                <button type="button" className="nav-item-pill mobile-nav-account-action" onClick={requestLogout}>{t("nav.logout")}</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={closeMenus} className="nav-item-pill">{t("nav.login")}</Link>
                <Link to="/register" onClick={closeMenus} className="nav-item-pill">{t("nav.register")}</Link>
              </>
            )}
          </div>
        </nav>

        <div className="header-actions-pill">
          <div className="lang-switcher-pill" role="group" aria-label="Chọn ngôn ngữ">
            <button type="button" className={`lang-btn-pill ${lang === "vi" ? "active" : ""}`}
              onClick={() => setLang("vi")} title="Tiếng Việt">VN</button>
            <span className="lang-sep">|</span>
            <button type="button" className={`lang-btn-pill ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")} title="English">EN</button>
          </div>
          <button type="button" className="icon-btn-pill" aria-label="Thông báo"><Bell size={16} /></button>
          {isAuthenticated ? (
            <div className="user-profile-pill">
              <span className="avatar-circle-pill"><User size={15} /></span>
              <span className="user-info-pill">
                <span className="user-name-pill">{user?.fullName || user?.userName}</span>
                <span className="user-role-pill">{t("nav.vip")}</span>
              </span>
              <button type="button" className="logout-btn-pill" title={t("nav.logout")} aria-label={t("nav.logout")} onClick={requestLogout}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="auth-btns-pill">
              <Link className="auth-btn-pill-login" to="/login">{t("nav.login")}</Link>
              <Link className="auth-btn-pill-register" to="/register">
                <span>{t("nav.register")}</span><ArrowRight size={14} />
              </Link>
            </div>
          )}
          <button
            type="button"
            className="customer-mobile-menu-toggle"
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="customer-main-nav"
            onClick={() => setMobileMenuOpen(open => !open)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <div className="site-shell light-theme customer-public-shell">
      {topSlot}
      {header}
      {children}
      <footer className="site-footer-dark">
        <div className="page-width footer-grid-4">
          <div className="footer-brand-col">
            <Link className="brand footer-brand" to="/" aria-label="ParkMatrix trang chủ">
              <span className="brand-mark"><ParkingCircle size={22} /></span>
              <span className="brand-copy">
                <strong>Park<span>Matrix</span></strong>
                <small>SMART PARKING PLATFORM</small>
              </span>
            </Link>
            {/* <p className="footer-desc mt-4">{t("footer.desc")}</p> */}
            <p className="learning-product-notice">Đây là sản phẩm phục vụ học tập, không dùng cho hoạt động thực tế.</p>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">{t("footer.support")}</h4>
            <ul className="footer-links">
              <li><a href="/#gis-section">{lang === "en" ? "Booking Guide" : "Hướng dẫn đặt chỗ"}</a></li>
              <li><a href="/#solutions">{lang === "en" ? "Parking Rules" : "Quy định bãi đỗ"}</a></li>
              <li><a href="/#solutions">{lang === "en" ? "EV Charging Station" : "Trạm sạc EV"}</a></li>
              <li><a href="mailto:support@parkmatrix.vn">{lang === "en" ? "Report Incident 24/7" : "Báo sự cố 24/7"}</a></li>
              <li><a href="/#gis-section">API Integration Docs</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "Infrastructure Coverage" : "Độ Phủ Hạ Tầng"}</h4>
            <ul className="footer-links">
              <li><a href="/#gis-section">{lang === "en" ? "Ho Chi Minh City (62 hubs)" : "TP. Hồ Chí Minh (62 bãi)"}</a></li>
              <li><a href="/#gis-section">{lang === "en" ? "Hanoi (48 hubs)" : "Hà Nội (48 bãi)"}</a></li>
              <li><a href="/#gis-section">{lang === "en" ? "Da Nang (24 hubs)" : "Đà Nẵng (24 bãi)"}</a></li>
              <li><a href="/#gis-section">{lang === "en" ? "Binh Duong (18 hubs)" : "Bình Dương (18 bãi)"}</a></li>
              <li><a href="/#gis-section">{lang === "en" ? "Hai Phong (12 hubs)" : "Hải Phòng (12 bãi)"}</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "For Enterprise" : "Dành Cho Doanh Nghiệp"}</h4>
            <ul className="footer-links">
              <li><a href="/#solutions">{lang === "en" ? "Parking Lot Owners" : "Chủ bãi đỗ xe"}</a></li>
              <li><a href="/#solutions">{lang === "en" ? "VMS Platform Integration" : "Tích hợp VMS Platform"}</a></li>
              <li><a href="/#solutions">{lang === "en" ? "AI ANPR Camera Partner" : "Hợp tác Camera ANPR AI"}</a></li>
              <li><Link to="/register">{lang === "en" ? "Partner Registration" : "Đăng ký Đối tác"}</Link></li>
            </ul>
          </div>
        </div>
        <div className="page-width footer-bottom-dark">
          <span>{t("footer.rights")}</span>
          <div className="footer-bottom-links">
            <a href="/#privacy">{t("footer.privacy")}</a><span>•</span>
            <a href="/#terms">{t("footer.terms")}</a><span>•</span>
            <a href="mailto:support@parkmatrix.vn">Support: support@parkmatrix.vn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
