import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { ShieldCheck, Eye, ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";

export default function PrivacyPolicyPage() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="policy-page-wrapper">
      {/* ── Top Header Navigation ── */}
      <header className="policy-header">
        <div className="policy-container header-inner">
          <Link to="/" className="policy-brand">
            <span className="brand-logo-badge">P</span>
            <div className="brand-text">
              <span className="brand-name">Park<span className="text-cyan">Matrix</span></span>
              <span className="brand-tag">LEGAL & PRIVACY</span>
            </div>
          </Link>

          <nav className="policy-nav">
            <Link to="/" className="policy-nav-link">
              <ArrowLeft size={16} />
              <span>{lang === "en" ? "Back to Home" : "Trang chủ"}</span>
            </Link>
            <Link to="/booking" className="policy-nav-link">
              {lang === "en" ? "Find Parking" : "Đặt chỗ"}
            </Link>
            <Link to="/terms" className="policy-nav-link">
              {lang === "en" ? "Terms of Service" : "Điều khoản dịch vụ"}
            </Link>
            <Link to="/faq" className="policy-nav-link">
              FAQ
            </Link>

            {/* Language Switcher Pill */}
            <div className="lang-switcher-pill" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`lang-btn-pill ${lang === "vi" ? "active" : ""}`}
                onClick={() => setLang("vi")}
                aria-pressed={lang === "vi"}
              >
                VN
              </button>
              <button
                type="button"
                className={`lang-btn-pill ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
              >
                EN
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <section className="policy-hero-banner">
        <div className="policy-container">
          <div className="policy-badge">
            <ShieldCheck size={16} className="text-cyan" />
            <span>{lang === "en" ? "DATA PROTECTION & COMPLIANCE" : "BẢO VỆ DỮ LIỆU & AN TOÀN THÔNG TIN"}</span>
          </div>
          <h1 className="policy-hero-title">
            {lang === "en" ? "Privacy Policy" : "Chính Sách Bảo Mật"}
          </h1>
          <p className="policy-hero-subtitle">
            {lang === "en"
              ? "ParkMatrix is committed to protecting your personal data, vehicle telemetry, and payment security in accordance with Vietnamese Data Protection Law (Decree 13/2023/ND-CP) and international privacy standards."
              : "ParkMatrix cam kết tuyệt đối bảo vệ dữ liệu cá nhân, thông tin phương tiện và an toàn giao dịch của bạn theo Nghị định 13/2023/NĐ-CP và các quy chuẩn an ninh thông tin quốc tế."}
          </p>
          <div className="policy-meta-bar">
            <span>📅 {lang === "en" ? "Last updated: October 2026" : "Cập nhật lần cuối: Tháng 10/2026"}</span>
            <span>•</span>
            <span>🔒 {lang === "en" ? "Version: 4.2 Multi-Facility Enterprise" : "Phiên bản: 4.2 Multi-Facility Enterprise"}</span>
            <span>•</span>
            <span>🏛️ {lang === "en" ? "Jurisdiction: Vietnam" : "Khu vực áp dụng: Nước CHXHCN Việt Nam"}</span>
          </div>
        </div>
      </section>

      {/* ── Main Content Grid ── */}
      <main className="policy-main-content">
        <div className="policy-container content-layout">
          {/* Quick Jump Sidebar */}
          <aside className="policy-sidebar">
            <div className="sidebar-card">
              <h3 className="sidebar-title">{lang === "en" ? "Table of Contents" : "Mục lục chính"}</h3>
              <ul className="sidebar-links">
                <li><a href="#sec-1"><ChevronRight size={14} /> {lang === "en" ? "1. Data Collection Scope" : "1. Dữ liệu thu thập"}</a></li>
                <li><a href="#sec-2"><ChevronRight size={14} /> {lang === "en" ? "2. Purpose of Processing" : "2. Mục đích sử dụng"}</a></li>
                <li><a href="#sec-3"><ChevronRight size={14} /> {lang === "en" ? "3. Camera ANPR & IoT Privacy" : "3. Camera ANPR & Cảm biến IoT"}</a></li>
                <li><a href="#sec-4"><ChevronRight size={14} /> {lang === "en" ? "4. E-Receipt & Payment Security" : "4. Bảo mật Thanh toán & E-Receipt"}</a></li>
                <li><a href="#sec-5"><ChevronRight size={14} /> {lang === "en" ? "5. Access Control & Scoped RBAC" : "5. Phân quyền truy cập cơ sở"}</a></li>
                <li><a href="#sec-6"><ChevronRight size={14} /> {lang === "en" ? "6. User Rights & Data Deletion" : "6. Quyền của khách hàng"}</a></li>
                <li><a href="#sec-7"><ChevronRight size={14} /> {lang === "en" ? "7. Contact Data Protection Officer" : "7. Liên hệ Quản trị viên"}</a></li>
              </ul>
            </div>
          </aside>

          {/* Article Body */}
          <article className="policy-article">
            {/* Section 1 */}
            <section id="sec-1" className="policy-section">
              <div className="section-header">
                <span className="section-num">01</span>
                <h2>{lang === "en" ? "Data Collection Scope" : "Phạm Vi Thu Thập Dữ Liệu"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "When using ParkMatrix platform (web, mobile app, or smart barrier gates), we only collect data essential for providing seamless multi-parking services:"
                  : "Khi sử dụng nền tảng ParkMatrix (bao gồm cổng web, ứng dụng di động hoặc qua barrier kiểm soát tại bãi), chúng tôi chỉ thu thập các dữ liệu thực sự cần thiết nhằm phục vụ hoạt động gửi xe:"}
              </p>
              <ul className="policy-bullet-list">
                <li>
                  <strong>{lang === "en" ? "Account Credentials: " : "Thông tin tài khoản: "}</strong>
                  {lang === "en"
                    ? "Full name, verified email address, phone number, and hashed authentication tokens."
                    : "Họ và tên, địa chỉ email xác thực, số điện thoại liên hệ và mã token đăng nhập được mã hóa."}
                </li>
                <li>
                  <strong>{lang === "en" ? "Vehicle & Telemetry Data: " : "Dữ liệu phương tiện: "}</strong>
                  {lang === "en"
                    ? "License plate string, vehicle category (4-7 seats, motorbike, EV), and timestamped entry/exit telemetry."
                    : "Biển số xe, phân loại phương tiện (ô tô 4 - 7 chỗ, xe máy, xe điện sạc EV), thời điểm xe vào/ra bãi."}
                </li>
                <li>
                  <strong>{lang === "en" ? "Location & GPS Preferences: " : "Vị trí địa lý & GPS: "}</strong>
                  {lang === "en"
                    ? "GPS coordinates when using 'Nearest Parking' search (calculated via Haversine formula on client/backend, never sold or tracked persistently without consent)."
                    : "Tọa độ GPS khi sử dụng tính năng 'Gần tôi nhất' (tính toán bằng thuật toán Haversine để tìm bãi tối ưu, không theo dõi hành trình ngoài phạm vi tìm kiếm)."}
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section id="sec-2" className="policy-section">
              <div className="section-header">
                <span className="section-num">02</span>
                <h2>{lang === "en" ? "Purpose of Data Processing" : "Mục Đích Sử Dụng Dữ Liệu"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "We strictly process your information for legitimate operational objectives:"
                  : "Mọi thông tin được thu thập đều được sử dụng cho các mục đích chính đáng và minh bạch:"}
              </p>
              <div className="policy-card-grid">
                <div className="highlight-mini-card">
                  <CheckCircle2 size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Smart Reservation & Hold" : "Giữ chỗ & Đặt trước thông minh"}</h4>
                    <p>{lang === "en" ? "Protecting booked slots using PostgreSQL Advisory Locks to eliminate overbooking." : "Khóa vị trí đỗ thời gian thực với PostgreSQL Advisory Lock để chống overbooking."}</p>
                  </div>
                </div>
                <div className="highlight-mini-card">
                  <CheckCircle2 size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Automated Barrier Entry" : "Tự động hóa Barrier & Check-in"}</h4>
                    <p>{lang === "en" ? "Matching license plates via AI ANPR for frictionless gate opening." : "Nhận diện biển số tự động qua Camera AI ANPR giúp mở thanh chắn nhanh chóng."}</p>
                  </div>
                </div>
                <div className="highlight-mini-card">
                  <CheckCircle2 size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Billing & Dynamic Pricing" : "Tính cước & Biểu giá minh bạch"}</h4>
                    <p>{lang === "en" ? "Applying 15-minute block billing, peak-hour multipliers, and daily caps per lot policy." : "Áp dụng biểu giá block 15 phút, hệ số cao điểm và mức trần ngày rõ ràng cho từng bãi."}</p>
                  </div>
                </div>
                <div className="highlight-mini-card">
                  <CheckCircle2 size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Safety & Security" : "An ninh trật tự & Giám sát sự cố"}</h4>
                    <p>{lang === "en" ? "Investigating abnormal stays, EV overheating telemetry, or lost ticket verifications." : "Xử lý sự cố quá hạn, cảnh báo an toàn cảm biến khói nhiệt EV và hỗ trợ mất thẻ."}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="sec-3" className="policy-section">
              <div className="section-header">
                <span className="section-num">03</span>
                <h2>{lang === "en" ? "Camera ANPR & IoT Sensor Privacy" : "Quy Định Camera ANPR & Dữ Liệu Cảm Biến IoT"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "All cameras deployed at ParkMatrix affiliated parking hubs operate under strict access control:"
                  : "Các thiết bị camera và cảm biến thông minh lắp đặt tại các cơ sở bãi đỗ của ParkMatrix tuân thủ các quy tắc bảo mật nghiêm ngặt:"}
              </p>
              <div className="policy-callout-box info">
                <Eye size={20} className="callout-icon" />
                <div>
                  <strong>{lang === "en" ? "Privacy Protection on Public APIs: " : "Bảo vệ thông tin trên API công khai: "}</strong>
                  {lang === "en"
                    ? "In accordance with Core Invariant 9, full phone numbers, complete license plates, and sensitive staff audit logs are never exposed through public guest endpoints. License plates are masked (e.g. 51G-***.89) to prevent unauthorized profiling."
                    : "Tuân thủ nguyên tắc cốt lõi của nền tảng, số điện thoại, biển số xe đầy đủ và nhật ký kiểm toán không bao giờ được trả qua các API công khai cho khách vãng lai. Biển số xe được hiển thị dưới dạng che giấu (vd: 51G-***.89) để bảo vệ đời tư chủ xe."}
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="sec-4" className="policy-section">
              <div className="section-header">
                <span className="section-num">04</span>
                <h2>{lang === "en" ? "E-Receipt & Payment Security" : "Bảo Mật Thanh Toán & Biên Lai Điện Tử (E-Receipt)"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "Every payment on ParkMatrix (Cash at booth or online Gateway) produces a tamper-proof digital receipt (SCRUM-72):"
                  : "Mọi giao dịch thanh toán gửi xe trên ParkMatrix (tiền mặt tại quầy hoặc thanh toán trực tuyến) đều tạo ra hóa đơn điện tử chống giả mạo (SCRUM-72):"}
              </p>
              <ul className="policy-bullet-list">
                <li>
                  <strong>{lang === "en" ? "Cryptographic Verification Hash: " : "Mã băm xác thực toàn vẹn: "}</strong>
                  {lang === "en"
                    ? "Each E-Receipt includes a SHA-256 cryptographic verification hash computed from payment ID, amount, and timestamp, guaranteeing that receipt data cannot be altered retroactively."
                    : "Mỗi hóa đơn điện tử được cấp một chuỗi mã băm bảo mật SHA-256 tạo từ mã thanh toán, số tiền và thời gian, bảo đảm hóa đơn không thể bị chỉnh sửa hay làm giả."}
                </li>
                <li>
                  <strong>{lang === "en" ? "Payment Card Security: " : "An toàn thẻ thanh toán: "}</strong>
                  {lang === "en"
                    ? "ParkMatrix does NOT store raw credit card numbers or CVV codes. All card processing is handled via certified PCI-DSS compliant payment gateways."
                    : "ParkMatrix KHÔNG BAO GIỜ lưu trữ số thẻ tín dụng hoặc mã CVV. Toàn bộ thanh toán thẻ được điều hướng qua cổng thanh toán đạt chuẩn bảo mật quốc tế PCI-DSS."}
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="sec-5" className="policy-section">
              <div className="section-header">
                <span className="section-num">05</span>
                <h2>{lang === "en" ? "Facility-Scoped Access Control (RBAC)" : "Phân Quyền Cơ Sở (Facility-Scoped RBAC)"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "ParkMatrix enforces strict role-based access control. Parking Staff and Facility Managers can ONLY view vehicle movements and shift reconciliations for parking facilities explicitly assigned to them via FacilityStaffAssignment contracts."
                  : "Hệ thống áp dụng cơ chế phân quyền đa cấp. Nhân viên trực bãi (PARKING_STAFF) và Quản lý cơ sở (PARKING_MANAGER) chỉ có quyền truy cập dữ liệu xe ra vào và đối soát ca trực tại đúng bãi đỗ xe được phân công phân nhiệm cụ thể."}
              </p>
            </section>

            {/* Section 6 */}
            <section id="sec-6" className="policy-section">
              <div className="section-header">
                <span className="section-num">06</span>
                <h2>{lang === "en" ? "Your Rights & Data Portability" : "Quyền Của Khách Hàng Với Dữ Liệu Cá Nhân"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "In compliance with Decree 13/2023/ND-CP, you hold full legal rights regarding your personal records:"
                  : "Theo quy định pháp luật Việt Nam, bạn có đầy đủ quyền hạn đối với thông tin cá nhân của mình:"}
              </p>
              <ul className="policy-bullet-list">
                <li>{lang === "en" ? "Right to inspect and review your vehicle parking history and paid receipts." : "Quyền tra cứu, xem lại toàn bộ lịch sử gửi xe và các hóa đơn đã thanh toán."}</li>
                <li>{lang === "en" ? "Right to correct inaccurate profile or registered vehicle license plates." : "Quyền yêu cầu chỉnh sửa, cập nhật thông tin cá nhân hoặc biển số xe đã đăng ký."}</li>
                <li>{lang === "en" ? "Right to request account deletion and removal of non-mandatory historical logs." : "Quyền yêu cầu xóa tài khoản và xóa dữ liệu cá nhân không thuộc diện bắt buộc lưu trữ kiểm toán theo luật thuế."}</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="sec-7" className="policy-section">
              <div className="section-header">
                <span className="section-num">07</span>
                <h2>{lang === "en" ? "Data Protection Contact" : "Thông Tin Liên Hệ Cơ Quan Quản Trị"}</h2>
              </div>
              <div className="policy-contact-box">
                <p><strong>ParkMatrix Smart Parking Management System</strong></p>
                <p>📍 {lang === "en" ? "Headquarters: High-Tech Park, Thu Duc City, Ho Chi Minh City, Vietnam" : "Trụ sở: Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh"}</p>
                <p>📧 {lang === "en" ? "Data Protection Officer: privacy@parkmatrix.vn" : "Bộ phận An toàn Dữ liệu: privacy@parkmatrix.vn"}</p>
                <p>📞 {lang === "en" ? "Hotline: 1900 6868 (Operating 24/7)" : "Hotline tiếp nhận hỗ trợ: 1900 6868 (Hoạt động 24/7)"}</p>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="policy-footer">
        <div className="policy-container footer-inner">
          <p>© 2026 ParkMatrix Platform. {lang === "en" ? "All rights reserved." : "Mọi quyền được bảo lưu."}</p>
          <div className="footer-links-row">
            <Link to="/terms">{lang === "en" ? "Terms of Service" : "Điều khoản dịch vụ"}</Link>
            <span>•</span>
            <Link to="/faq">FAQ</Link>
            <span>•</span>
            <Link to="/">{lang === "en" ? "Homepage" : "Trang chủ"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
