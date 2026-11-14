import NotificationBell from "./NotificationBell";
import CustomerAccountMenu from "./CustomerAccountMenu";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Menu,
  Navigation,
  ParkingCircle,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

type CustomerLayoutProps = {
  children: ReactNode;
  topSlot?: ReactNode;
  onRequestLogout?: () => void;
  landing?: boolean;
  booking?: boolean;
};

export default function CustomerLayout({
  children,
  topSlot,
  onRequestLogout,
  landing = false,
  booking = false,
}: CustomerLayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false);
  const bookingMenuRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<"account" | "notifications" | null>(null);
  const location = useLocation();
  useEffect(() => { setPopover(null); setMobileMenuOpen(false); setBookingMenuOpen(false); }, [location.pathname, location.search]);

  const userRoles = (user?.roles ?? (user?.role ? [user.role] : [])).map((r) => r.toUpperCase());
  const isStaff = userRoles.some((r) => r.includes("STAFF"));
  const isAdminOrManager = userRoles.some((r) => r.includes("ADMIN") || r.includes("MANAGER"));
  const portalPath = isStaff ? "/staff/dashboard" : isAdminOrManager ? "/manager/dashboard" : null;
  const roleLabel = isStaff ? "Staff" : isAdminOrManager ? (userRoles.some((r) => r.includes("ADMIN")) ? "Admin" : "Manager") : "Khách hàng";

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
    setPopover(null);
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
            <span className="brand-pill-title">PARKMATRIX</span>
            <small className="brand-pill-caption">Smart 3D Parking</small>
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
                <a href="/#parking-lots" onClick={closeMenus} className="dropdown-menu-item">
                  <span className="dropdown-item-icon bg-emerald"><Navigation size={18} /></span>
                  <span className="dropdown-item-content">
                    <span className="dropdown-item-title">{lang === "en" ? "Explore Parking Lots" : "Khám phá bãi đỗ"}</span>
                    <span className="dropdown-item-desc">{lang === "en" ? "Find a location for your next visit" : "Chọn bãi phù hợp cho điểm đến của bạn"}</span>
                  </span>
                </a>
              </div>
            )}
          </div>
          <Link to="/faq" onClick={closeMenus} className="nav-item-pill">FAQ</Link>
          <a href="/#how-it-works" onClick={closeMenus} className="nav-item-pill">{lang === "en" ? "How it works" : "Cách đặt chỗ"}</a>
          <a href="/#benefits" onClick={closeMenus} className="nav-item-pill">{lang === "en" ? "Why ParkMatrix" : "Lợi ích"}</a>
          <div className="mobile-nav-account">
            {isAuthenticated ? (
              <>
                <span className="customer-nav-user">{user?.fullName || user?.userName} ({roleLabel})</span>
                <Link to="/account" onClick={closeMenus} className="nav-item-pill">{lang === "en" ? "My account" : "Trang cá nhân"}</Link>
                {portalPath && (
                  <Link to={portalPath} onClick={closeMenus} className="nav-item-pill mobile-nav-portal-link" style={{ color: "#0d4685", fontWeight: 700 }}>
                    {portalPath.includes("staff") ? "→ Vào Staff Portal" : "→ Vào Admin Dashboard"}
                  </Link>
                )}
                <button type="button" className="nav-item-pill mobile-nav-account-action" onClick={requestLogout}>{t("nav.logout")}</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={closeMenus} className="nav-item-pill">{t("nav.login")}</Link>
                <Link to="/register" onClick={closeMenus} className="nav-item-pill">{t("nav.register")}</Link>
              </>
            )}
          </div>
          <div className="customer-mobile-language"><span>Ngôn ngữ / Language</span><div className="lang-switcher-pill"><button type="button" className={`lang-btn-pill ${lang === "vi" ? "active" : ""}`} onClick={() => setLang("vi")}>VN</button><button type="button" className={`lang-btn-pill ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>EN</button></div></div>
        </nav>

        <div className="header-actions-pill">
          <div className="lang-switcher-pill" role="group" aria-label="Chọn ngôn ngữ">
            <button type="button" className={`lang-btn-pill ${lang === "vi" ? "active" : ""}`}
              onClick={() => setLang("vi")} title="Tiếng Việt">VN</button>
            <span className="lang-sep">|</span>
            <button type="button" className={`lang-btn-pill ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")} title="English">EN</button>
          </div>
          <NotificationBell open={popover === "notifications"} onOpenChange={open => setPopover(open ? "notifications" : null)} />
          {isAuthenticated ? (
            <CustomerAccountMenu open={popover === "account"} onOpenChange={open => setPopover(open ? "account" : null)} onLogout={requestLogout} portalPath={portalPath} />
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
            onClick={() => { setMobileMenuOpen(open => !open); setPopover(null); }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <div className={`site-shell light-theme customer-public-shell${landing ? " customer-landing-shell" : ""}${booking ? " customer-booking-shell" : ""}`}>
      {topSlot}
      {header}
      {children}
      <footer className="site-footer-dark">
        <div className="page-width footer-grid-4">
          <div className="footer-brand-col">
            <Link className="brand footer-brand" to="/" aria-label="ParkMatrix trang chủ">
              <span className="brand-mark"><ParkingCircle size={22} /></span>
              <span className="brand-copy">
                <strong>PARKMATRIX</strong>
                <small>SMART 3D PARKING</small>
              </span>
            </Link>
            <p className="learning-product-notice">{lang === "en" ? "A learning project, not intended for real-world operation." : "Đây là sản phẩm phục vụ học tập, không dùng cho hoạt động thực tế."}</p>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "Explore" : "Khám phá"}</h4>
            <ul className="footer-links">
              <li><Link to="/booking">{lang === "en" ? "Find parking" : "Tìm bãi đỗ"}</Link></li>
              <li><a href="/#parking-lots">{lang === "en" ? "Parking locations" : "Danh sách bãi đỗ"}</a></li>
              <li><a href="/#how-it-works">{lang === "en" ? "How to book" : "Hướng dẫn đặt chỗ"}</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "Your account" : "Tài khoản"}</h4>
            <ul className="footer-links">
              <li><Link to="/login">{t("nav.login")}</Link></li>
              <li><Link to="/register">{t("nav.register")}</Link></li>
              <li><Link to="/account">{lang === "en" ? "Vehicles & bookings" : "Xe & đặt chỗ"}</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">{lang === "en" ? "Help & information" : "Hỗ trợ & thông tin"}</h4>
            <ul className="footer-links">
              <li><Link to="/faq">{lang === "en" ? "Help center" : "Trung tâm trợ giúp"}</Link></li>
              <li><Link to="/terms">{t("footer.terms")}</Link></li>
              <li><Link to="/privacy">{t("footer.privacy")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="page-width footer-bottom-dark">
          <span>© ParkMatrix · {lang === "en" ? "A learning project" : "Dự án phục vụ học tập"}</span>
          <div className="footer-bottom-links">
            <Link to="/privacy">{t("footer.privacy")}</Link><span>•</span>
            <Link to="/terms">{t("footer.terms")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
