import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { FileCheck, Scale, Zap, Clock, ArrowLeft, ChevronRight } from "lucide-react";

export default function TermsOfServicePage() {
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
              <span className="brand-tag">LEGAL & TERMS</span>
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
            <Link to="/privacy" className="policy-nav-link">
              {lang === "en" ? "Privacy Policy" : "Chính sách bảo mật"}
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
            <Scale size={16} className="text-cyan" />
            <span>{lang === "en" ? "TERMS OF USE & SERVICE AGREEMENT" : "ĐIỀU KHOẢN SỬ DỤNG & THỎA THUẬN DỊCH VỤ"}</span>
          </div>
          <h1 className="policy-hero-title">
            {lang === "en" ? "Terms of Service" : "Điều Khoản Dịch Vụ"}
          </h1>
          <p className="policy-hero-subtitle">
            {lang === "en"
              ? "Welcome to ParkMatrix. By accessing or using our multi-parking reservation platform, automated barrier systems, and payment services, you agree to comply with and be bound by the following terms."
              : "Chào mừng bạn đến với ParkMatrix. Khi truy cập hoặc sử dụng nền tảng đặt chỗ bãi đỗ xe thông minh, hệ thống barrier tự động và các dịch vụ thanh toán của chúng tôi, bạn đồng ý tuân thủ toàn bộ các điều khoản dưới đây."}
          </p>
          <div className="policy-meta-bar">
            <span>📅 {lang === "en" ? "Effective Date: October 2026" : "Ngày hiệu lực: Tháng 10/2026"}</span>
            <span>•</span>
            <span>📋 {lang === "en" ? "Standard Baseline: V4 Multi-Parking Platform" : "Tiêu chuẩn: Baseline V4 Multi-Parking Platform"}</span>
          </div>
        </div>
      </section>

      {/* ── Main Content Grid ── */}
      <main className="policy-main-content">
        <div className="policy-container content-layout">
          {/* Quick Jump Sidebar */}
          <aside className="policy-sidebar">
            <div className="sidebar-card">
              <h3 className="sidebar-title">{lang === "en" ? "Table of Contents" : "Nội dung điều khoản"}</h3>
              <ul className="sidebar-links">
                <li><a href="#term-1"><ChevronRight size={14} /> {lang === "en" ? "1. Agreement & Platform Role" : "1. Thỏa thuận & Vai trò nền tảng"}</a></li>
                <li><a href="#term-2"><ChevronRight size={14} /> {lang === "en" ? "2. Hold Policy (5-Minute Window)" : "2. Cơ chế giữ chỗ (5 phút)"}</a></li>
                <li><a href="#term-3"><ChevronRight size={14} /> {lang === "en" ? "3. Entry/Exit & ANPR Rules" : "3. Quy định Ra/Vào & Biển số ANPR"}</a></li>
                <li><a href="#term-4"><ChevronRight size={14} /> {lang === "en" ? "4. Pricing & 15-Minute Blocks" : "4. Biểu giá & Block tính phí 15 phút"}</a></li>
                <li><a href="#term-5"><ChevronRight size={14} /> {lang === "en" ? "5. EV Charging Station Safety" : "5. An toàn Trạm sạc xe điện EV"}</a></li>
                <li><a href="#term-6"><ChevronRight size={14} /> {lang === "en" ? "6. Customer Responsibilities" : "6. Trách nhiệm người gửi xe"}</a></li>
                <li><a href="#term-7"><ChevronRight size={14} /> {lang === "en" ? "7. Limitation of Liability" : "7. Giới hạn trách nhiệm"}</a></li>
                <li><a href="#term-8"><ChevronRight size={14} /> {lang === "en" ? "8. Dispute Resolution & Law" : "8. Giải quyết tranh chấp & Luật"}</a></li>
              </ul>
            </div>
          </aside>

          {/* Article Body */}
          <article className="policy-article">
            {/* Term 1 */}
            <section id="term-1" className="policy-section">
              <div className="section-header">
                <span className="section-num">01</span>
                <h2>{lang === "en" ? "Agreement & Platform Scope" : "Thỏa Thuận Sử Dụng & Vai Trò Nền Tảng"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "ParkMatrix operates as a unified multi-facility smart parking platform managing multiple parking lots (ParkingLot), each with its own physical levels (ParkingLevel), zones (Zone), slots (ParkingSlot), and operating schedules."
                  : "ParkMatrix vận hành như một nền tảng quản lý bãi đỗ xe thông minh đa cơ sở. Mỗi bãi đỗ xe (ParkingLot) trực thuộc mạng lưới sở hữu cấu trúc tầng (ParkingLevel), phân khu (Zone), vị trí đỗ (ParkingSlot) và biểu giá vận hành độc lập theo chính sách của từng cơ sở."}
              </p>
              <p>
                {lang === "en"
                  ? "By using ParkMatrix, you agree that you are legally capable of entering into binding contracts and that you will follow all traffic regulations, facility safety guidelines, and staff directions within each parking premises."
                  : "Khi đặt chỗ hoặc sử dụng dịch vụ tại bãi, bạn cam kết có đủ năng lực hành vi dân sự, chấp hành nghiêm túc Luật Giao thông Đường bộ và các quy định an toàn, hướng dẫn của nhân viên quản lý tại cơ sở."}
              </p>
            </section>

            {/* Term 2 */}
            <section id="term-2" className="policy-section">
              <div className="section-header">
                <span className="section-num">02</span>
                <h2>{lang === "en" ? "Reservation Hold Policy (5-Minute Window)" : "Cơ Chế Giữ Chỗ & Thời Hạn Thanh Toán (5 Phút)"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "To prevent slot hogging and ensure fair availability for all motorists:"
                  : "Nhằm bảo đảm tính công bằng và tối ưu hóa diện tích đỗ xe trong đô thị:"}
              </p>
              <div className="policy-callout-box warning">
                <Clock size={20} className="callout-icon" />
                <div>
                  <strong>{lang === "en" ? "5-Minute Payment Window (SCRUM-100 Policy): " : "Quy định giữ chỗ 5 phút (Chính sách SCRUM-100): "}</strong>
                  {lang === "en"
                    ? "When you initiate a parking slot booking, the selected slot is temporarily locked for exactly 5 minutes (configured via lot_vehicle_policies.hold_minutes). If payment is not finalized within 5 minutes, the reservation automatically expires and the slot is instantly released back to the Available pool for other drivers."
                    : "Khi thực hiện đặt chỗ, vị trí đỗ được giữ chỗ tạm thời (Hold) trong đúng 5 phút (theo cấu hình lot_vehicle_policies.hold_minutes). Nếu không hoàn tất thanh toán trong 5 phút, lệnh giữ chỗ sẽ tự động hủy và vị trí lập tức được giải phóng về trạng thái Sẵn sàng (Available) cho người khác."}
                </div>
              </div>
            </section>

            {/* Term 3 */}
            <section id="term-3" className="policy-section">
              <div className="section-header">
                <span className="section-num">03</span>
                <h2>{lang === "en" ? "Entry, Exit & ANPR Verification" : "Quy Định Ra/Vào Bãi & Nhận Diện Biển Số ANPR"}</h2>
              </div>
              <ul className="policy-bullet-list">
                <li>
                  <strong>{lang === "en" ? "License Plate Accuracy: " : "Tính chính xác của biển số xe: "}</strong>
                  {lang === "en"
                    ? "Users must register the exact license plate string matching their vehicle. Camera ANPR checks compare incoming vehicles with active booking records."
                    : "Khách hàng có trách nhiệm nhập đúng biển số xe khi đặt chỗ. Camera AI ANPR tại cổng bãi sẽ tự động đối chiếu biển số thực tế với hồ sơ đặt chỗ trước khi nâng barrier."}
                </li>
                <li>
                  <strong>{lang === "en" ? "Physical Slot Release: " : "Xác nhận giải phóng slot thực tế: "}</strong>
                  {lang === "en"
                    ? "A slot is officially returned to Available only when physical departure is confirmed by the exit barrier camera sensor or authorized staff inspection."
                    : "Vị trí đỗ chỉ chính thức được ghi nhận là giải phóng (Available) khi xe vật lý đã thực sự rời khỏi bãi và được barrier xuất bãi hoặc nhân viên trực bãi xác nhận."}
                </li>
              </ul>
            </section>

            {/* Term 4 */}
            <section id="term-4" className="policy-section">
              <div className="section-header">
                <span className="section-num">04</span>
                <h2>{lang === "en" ? "Pricing Plans & 15-Minute Block Billing" : "Biểu Giá Dịch Vụ & Block Tính Phí 15 Phút"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "ParkMatrix calculates parking fees using dynamic pricing rules configured by each facility manager:"
                  : "Cước phí gửi xe được tính toán tự động và minh bạch theo cấu hình của từng bãi đỗ:"}
              </p>
              <div className="policy-card-grid">
                <div className="highlight-mini-card">
                  <Clock size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "15-Minute Standard Block" : "Block tính phí 15 phút"}</h4>
                    <p>{lang === "en" ? "Charges are computed incrementally in 15-minute intervals rather than rounding up full hours." : "Cước phí được tính chi tiết theo từng block 15 phút, tránh làm tròn cả giờ gây thiệt cho khách hàng."}</p>
                  </div>
                </div>
                <div className="highlight-mini-card">
                  <Zap size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Peak-Hour Multipliers" : "Hệ số giờ cao điểm"}</h4>
                    <p>{lang === "en" ? "During designated rush hours, a transparent peak surcharge multiplier may apply." : "Trong khung giờ cao điểm đã công bố, bãi đỗ có thể áp dụng hệ số phụ phí được thông báo trước."}</p>
                  </div>
                </div>
                <div className="highlight-mini-card">
                  <FileCheck size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Daily Maximum Cap" : "Mức trần cước ngày (Daily Cap)"}</h4>
                    <p>{lang === "en" ? "Vehicles parked continuously over 24 hours are protected by a capped daily ceiling." : "Khách gửi xe liên tục qua ngày được áp dụng mức trần chi phí tối đa (Daily Cap) để tiết kiệm chi phí."}</p>
                  </div>
                </div>
                <div className="highlight-mini-card">
                  <FileCheck size={18} className="text-cyan" />
                  <div>
                    <h4>{lang === "en" ? "Tamper-Proof E-Receipt" : "Biên lai điện tử có mã băm"}</h4>
                    <p>{lang === "en" ? "Every settled invoice produces an instant verifiable receipt with SHA-256 hash." : "Mọi thanh toán hoàn tất đều cấp biên lai điện tử có mã băm SHA-256 đối soát minh bạch."}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Term 5 */}
            <section id="term-5" className="policy-section">
              <div className="section-header">
                <span className="section-num">05</span>
                <h2>{lang === "en" ? "EV Charging Station Regulations" : "Quy Định Trạm Sạc Xe Điện (EV Charging)"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "For vehicles utilizing EV charging slots (designated with lightning badge):"
                  : "Khách hàng sử dụng ô tô điện hoặc xe máy điện tại các vị trí có trụ sạc EV:"}
              </p>
              <ul className="policy-bullet-list">
                <li>{lang === "en" ? "Non-EV vehicles are strictly prohibited from parking in EV-designated charging bays." : "Tuyệt đối không đỗ xe động cơ đốt trong (xăng/dầu) vào các vị trí quy định dành riêng cho sạc xe điện."}</li>
                <li>{lang === "en" ? "When charging completes (100% telemetry reached), owners must relocate their vehicle within 15 minutes of notification to avoid idle charging surcharges." : "Khi pin sạc đầy (đạt 100%), chủ phương tiện có trách nhiệm di chuyển xe khỏi trụ sạc trong vòng 15 phút kể từ thông báo để nhường vị trí cho xe khác."}</li>
                <li>{lang === "en" ? "Always ensure charging cables are properly seated. Any thermal/smoke sensors triggering alarms will instantly cut off power supply." : "Tuân thủ đúng thao tác cắm sạc. Hệ thống cảm biến nhiệt độ và khói tự động ngắt điện lập tức khi phát hiện bất thường."}</li>
              </ul>
            </section>

            {/* Term 6 */}
            <section id="term-6" className="policy-section">
              <div className="section-header">
                <span className="section-num">06</span>
                <h2>{lang === "en" ? "Customer Responsibilities & Prohibited Acts" : "Trách Nhiệm Của Khách Hàng & Hành Vi Bị Cấm"}</h2>
              </div>
              <ul className="policy-bullet-list">
                <li>{lang === "en" ? "Do not leave high-value cash, jewelry, or dangerous inflammable materials inside the parked vehicle." : "Không để tiền mặt có giá trị lớn, trang sức quý hoặc hàng hóa nguy hiểm, chất dễ cháy nổ trong xe."}</li>
                <li>{lang === "en" ? "Park strictly within the designated slot demarcation lines without obstructing driving aisles or adjacent bays." : "Đỗ xe đúng trong vạch kẻ giới hạn của ô đỗ, không đỗ chắn lối đi chung hoặc chiếm dụng 2 vị trí."}</li>
                <li>{lang === "en" ? "Turn off vehicle engines, headlights, and engage parking brakes before leaving the vehicle." : "Tắt máy, tắt đèn pha, kéo phanh tay và khóa cửa cẩn thận trước khi rời khỏi xe."}</li>
              </ul>
            </section>

            {/* Term 7 */}
            <section id="term-7" className="policy-section">
              <div className="section-header">
                <span className="section-num">07</span>
                <h2>{lang === "en" ? "Limitation of Liability" : "Giới Hạn Trách Nhiệm Của Nền Tảng"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "ParkMatrix provides the digital platform connecting drivers with parking facilities. Facility owners and operators maintain on-site bailment duties according to Vietnamese Civil Code. ParkMatrix shall not be held liable for personal belongings left unattended inside vehicles or force majeure events (e.g. natural disasters, acts of God)."
                  : "ParkMatrix cung cấp giải pháp công nghệ kết nối và quản lý. Trách nhiệm trông giữ phương tiện tại bãi thuộc về đơn vị quản lý vận hành cơ sở theo Bộ luật Dân sự Việt Nam. Nền tảng không chịu trách nhiệm với tư trang giá trị bị mất do khách hàng để quên trong xe hoặc các trường hợp bất khả kháng do thiên tai, hỏa hoạn khách quan."}
              </p>
            </section>

            {/* Term 8 */}
            <section id="term-8" className="policy-section">
              <div className="section-header">
                <span className="section-num">08</span>
                <h2>{lang === "en" ? "Dispute Resolution & Governing Law" : "Giải Quyết Tranh Chấp & Luật Điều Chỉnh"}</h2>
              </div>
              <p>
                {lang === "en"
                  ? "These Terms of Service are governed by and construed in accordance with the laws of the Socialist Republic of Vietnam. Any disputes arising shall first be negotiated amicably through the ParkMatrix Support Center, and if unresolved, submitted to the competent People's Court in Ho Chi Minh City."
                  : "Điều khoản này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh trước hết sẽ được giải quyết qua thương lượng hòa giải. Trường hợp không hòa giải được, vụ việc sẽ được đưa ra Tòa án Nhân dân có thẩm quyền tại TP. Hồ Chí Minh để giải quyết."}
              </p>
            </section>
          </article>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="policy-footer">
        <div className="policy-container footer-inner">
          <p>© 2026 ParkMatrix Platform. {lang === "en" ? "All rights reserved." : "Mọi quyền được bảo lưu."}</p>
          <div className="footer-links-row">
            <Link to="/privacy">{lang === "en" ? "Privacy Policy" : "Chính sách bảo mật"}</Link>
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
