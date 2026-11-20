import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import CustomerLayout from "../components/customer/CustomerLayout";
import {
  ShieldCheck,
  Scale,
  Printer,
  ChevronRight,
  Database,
  Lock,
  Camera,
  CreditCard,
  UserCheck,
  Sparkles,
} from "lucide-react";
import "./LegalPages.css";

export default function PrivacyPolicyPage() {
  const { lang } = useLanguage();
  const isEn = lang === "en";

  return (
    <CustomerLayout>
      <div className="policy-page-wrapper">
        {/* ── Light Elevated Hero Banner ── */}
        <section className="policy-hero-light">
          <div className="policy-container">
            {/* Breadcrumb Navigation */}
            <nav className="policy-breadcrumb" aria-label="Breadcrumb">
              <Link to="/">{isEn ? "Home" : "Trang chủ"}</Link>
              <span className="crumb-sep">/</span>
              <span>{isEn ? "Legal & Compliance" : "Pháp lý & Quy định"}</span>
              <span className="crumb-sep">/</span>
              <span className="crumb-current">{isEn ? "Privacy Policy" : "Chính sách bảo mật"}</span>
            </nav>

            <div className="policy-hero-header">
              <div className="policy-badge-light">
                <ShieldCheck size={16} />
                <span>{isEn ? "DATA PROTECTION & PRIVACY" : "BẢO VỆ DỮ LIỆU & AN TOÀN THÔNG TIN"}</span>
              </div>
              <h1 className="policy-hero-title-light">
                {isEn ? "Privacy Policy" : "Chính Sách Bảo Mật"}
              </h1>
              <p className="policy-hero-desc-light">
                {isEn
                  ? "ParkMatrix is committed to protecting your personal data, vehicle telemetry, and payment safety in accordance with Vietnamese Personal Data Protection Decree (Decree 13/2023/ND-CP) and international data governance standards."
                  : "ParkMatrix cam kết tuyệt đối bảo vệ dữ liệu cá nhân, thông tin phương tiện và an toàn giao dịch của bạn theo Nghị định 13/2023/NĐ-CP và các quy chuẩn an toàn an ninh thông tin."}
              </p>

              {/* Metadata Pill Bar */}
              <div className="policy-meta-pill-bar">
                <span className="meta-pill">
                  <span className="meta-dot" />
                  {isEn ? "Effective: October 2026" : "Hiệu lực: Tháng 10/2026"}
                </span>
                <span className="meta-pill">
                  {isEn ? "Decree 13/2023/ND-CP" : "Nghị định 13/2023/NĐ-CP"}
                </span>
                <span className="meta-pill">
                  {isEn ? "Baseline V4 Multi-Facility" : "Phiên bản: 4.2 Multi-Facility"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main Content Grid ── */}
        <main className="policy-main-content">
          <div className="policy-container content-layout">
            {/* Quick Jump Sidebar */}
            <aside className="policy-sidebar">
              <div className="sidebar-card">
                {/* Quick Switch Tab Between Privacy and Terms */}
                <div className="sidebar-quick-switch" role="tablist">
                  <Link to="/privacy" className="quick-switch-btn is-active">
                    <ShieldCheck size={13} />
                    <span>{isEn ? "Privacy" : "Bảo mật"}</span>
                  </Link>
                  <Link to="/terms" className="quick-switch-btn">
                    <Scale size={13} />
                    <span>{isEn ? "Terms" : "Điều khoản"}</span>
                  </Link>
                </div>

                <h3 className="sidebar-title">{isEn ? "Table of Contents" : "Mục lục chính"}</h3>
                <ul className="sidebar-links">
                  <li><a href="#sec-1"><ChevronRight size={13} /> {isEn ? "1. Data Collection Scope" : "1. Dữ liệu thu thập"}</a></li>
                  <li><a href="#sec-2"><ChevronRight size={13} /> {isEn ? "2. Purpose of Processing" : "2. Mục đích sử dụng"}</a></li>
                  <li><a href="#sec-3"><ChevronRight size={13} /> {isEn ? "3. Camera ANPR & IoT Privacy" : "3. Camera ANPR & Cảm biến"}</a></li>
                  <li><a href="#sec-4"><ChevronRight size={13} /> {isEn ? "4. E-Receipt & Payment Security" : "4. Bảo mật Thanh toán"}</a></li>
                  <li><a href="#sec-5"><ChevronRight size={13} /> {isEn ? "5. Access Control & Scoped RBAC" : "5. Phân quyền truy cập cơ sở"}</a></li>
                  <li><a href="#sec-6"><ChevronRight size={13} /> {isEn ? "6. User Rights & Data Deletion" : "6. Quyền của khách hàng"}</a></li>
                  <li><a href="#sec-7"><ChevronRight size={13} /> {isEn ? "7. Contact Data Officer" : "7. Liên hệ Quản trị viên"}</a></li>
                </ul>

                <div className="sidebar-footer-actions">
                  <button type="button" onClick={() => window.print()} className="sidebar-action-btn">
                    <Printer size={14} />
                    <span>{isEn ? "Print Document" : "In tài liệu"}</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* Article Body */}
            <article className="policy-article">
              {/* Section 1 */}
              <section id="sec-1" className="policy-section">
                <div className="section-header">
                  <span className="section-num">01</span>
                  <h2>{isEn ? "Data Collection Scope" : "Phạm Vi Thu Thập Dữ Liệu"}</h2>
                </div>

                {/* Key Takeaway Callout Box */}
                <div className="policy-takeaway-box">
                  <Sparkles size={16} />
                  <div>
                    <strong>{isEn ? "Key Takeaway: " : "Tóm tắt nhanh: "}</strong>
                    {isEn
                      ? "We strictly collect your contact details, license plate, and check-in times solely to manage your parking reservation and barrier gate access. We never track your ongoing GPS journey."
                      : "Chúng tôi chỉ thu thập thông tin liên hệ, biển số xe và thời điểm vào/ra nhằm phục vụ việc giữ chỗ và mở thanh chắn barie. Tuyệt đối không theo dõi hành trình GPS ngoài phạm vi tìm bãi xe."}
                  </div>
                </div>

                <p>
                  {isEn
                    ? "When using the ParkMatrix platform (web, mobile app, or smart barrier gates), we only collect data essential for providing parking reservation services:"
                    : "Khi sử dụng nền tảng ParkMatrix (bao gồm cổng web, ứng dụng di động hoặc qua barrier kiểm soát tại bãi), chúng tôi chỉ thu thập các dữ liệu thực sự cần thiết nhằm phục vụ hoạt động gửi xe:"}
                </p>

                <div className="policy-card-grid">
                  <div className="highlight-mini-card">
                    <UserCheck size={18} />
                    <div>
                      <h4>{isEn ? "Account Details" : "Thông tin tài khoản"}</h4>
                      <p>{isEn ? "Full name, email, phone number, and encrypted login tokens." : "Họ và tên, email xác thực, số điện thoại liên hệ và token mã hóa."}</p>
                    </div>
                  </div>
                  <div className="highlight-mini-card">
                    <Database size={18} />
                    <div>
                      <h4>{isEn ? "Vehicle & Telemetry" : "Dữ liệu phương tiện"}</h4>
                      <p>{isEn ? "License plate string, vehicle category, and entry/exit timestamps." : "Biển số xe, phân loại xe (ô tô, xe máy), thời điểm xe vào/ra bãi."}</p>
                    </div>
                  </div>
                </div>

                <ul className="policy-bullet-list">
                  <li>
                    <strong>{isEn ? "GPS & Location Preferences: " : "Vị trí địa lý & GPS: "}</strong>
                    {isEn
                      ? "GPS coordinates when using 'Nearest Parking' search (calculated to find optimal facilities, never tracked persistently without consent)."
                      : "Tọa độ GPS khi sử dụng tính năng 'Gần tôi nhất' để tìm bãi tối ưu, không lưu vết hành trình ngoài phạm vi tìm kiếm."}
                  </li>
                </ul>
              </section>

              {/* Section 2 */}
              <section id="sec-2" className="policy-section">
                <div className="section-header">
                  <span className="section-num">02</span>
                  <h2>{isEn ? "Purpose of Data Processing" : "Mục Đích Sử Dụng Dữ Liệu"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Sparkles size={16} />
                  <div>
                    <strong>{isEn ? "Key Takeaway: " : "Tóm tắt nhanh: "}</strong>
                    {isEn
                      ? "Your information is used strictly to guarantee reserved slots, open entry gates automatically, and issue electronic receipts."
                      : "Dữ liệu được dùng duy nhất để khóa ô đỗ bạn đã chọn, mở thanh chắn tự động và xuất hóa đơn điện tử cho bạn."}
                  </div>
                </div>

                <p>
                  {isEn
                    ? "We strictly process your information for legitimate operational objectives:"
                    : "Mọi thông tin được thu thập đều được sử dụng cho các mục đích chính đáng và minh bạch:"}
                </p>

                <ul className="policy-bullet-list">
                  <li>
                    <strong>{isEn ? "Guaranteed Space Reservation: " : "Bảo lưu vị trí đỗ xe: "}</strong>
                    {isEn
                      ? "Preventing double-booking and locking reserved bays during your scheduled time."
                      : "Bảo đảm giữ đúng ô đỗ xe bạn đã đặt, tuyệt đối không bị trùng lặp thời gian gửi."}
                  </li>
                  <li>
                    <strong>{isEn ? "Automated Barrier Control: " : "Kiểm soát ra vào tự động: "}</strong>
                    {isEn
                      ? "Verifying digital QR passes and recognized plates for fast 1-second barrier opening."
                      : "Đối chiếu mã QR hoặc biển số xe tại cổng để thanh chắn barie tự động nâng hạ trong 1 giây."}
                  </li>
                  <li>
                    <strong>{isEn ? "Transparent Billing & Receipts: " : "Tính phí minh bạch & Hóa đơn: "}</strong>
                    {isEn
                      ? "Calculating exact parking durations according to published rate plans and issuing e-receipts."
                      : "Tính toán chính xác thời lượng gửi xe theo biểu giá niêm yết và xuất biên lai thanh toán điện tử."}
                  </li>
                </ul>
              </section>

              {/* Section 3 */}
              <section id="sec-3" className="policy-section">
                <div className="section-header">
                  <span className="section-num">03</span>
                  <h2>{isEn ? "Camera ANPR & Sensor Privacy" : "Quy Định Camera Nhận Diện & Cảm Biến IoT"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Camera size={16} />
                  <div>
                    <strong>{isEn ? "On-Site Monitoring: " : "Camera giám sát tại bãi: "}</strong>
                    {isEn
                      ? "Gate cameras strictly capture vehicle license plates for security and barrier automation. We do not use facial recognition on drivers or passengers."
                      : "Camera tại cổng chỉ ghi nhận hình ảnh biển số xe để mở barie và bảo đảm an ninh bãi xe. Hệ thống không thu thập hay nhận diện khuôn mặt người lái xe."}
                  </div>
                </div>

                <p>
                  {isEn
                    ? "Our facilities utilize intelligent edge cameras and IoT magnetic sensors under strict retention limits:"
                    : "Hệ thống bãi đỗ xe ParkMatrix triển khai camera nhận diện biển số và cảm biến hiện diện vị trí với các nguyên tắc:"}
                </p>

                <ul className="policy-bullet-list">
                  <li>{isEn ? "Plate capture snapshots are retained for operational verification and automatically purged after statutory accounting cycles." : "Hình ảnh chụp biển số xe tại cổng được lưu trữ bảo mật và tự động xóa định kỳ sau khi hoàn tất đối soát lượt gửi."}</li>
                  <li>{isEn ? "Slot ultrasonic/magnetic sensors only detect whether a space is occupied (binary state), without capturing personal identifiers." : "Cảm biến tại từng vị trí đỗ xe chỉ phát hiện trạng thái có xe hoặc trống, không ghi nhận bất kỳ dữ liệu cá nhân nào."}</li>
                </ul>
              </section>

              {/* Section 4 */}
              <section id="sec-4" className="policy-section">
                <div className="section-header">
                  <span className="section-num">04</span>
                  <h2>{isEn ? "Payment Security & Electronic Invoices" : "Bảo Mật Thanh Toán & Hóa Đơn Điện Tử"}</h2>
                </div>

                <div className="policy-card-grid">
                  <div className="highlight-mini-card">
                    <Lock size={18} />
                    <div>
                      <h4>{isEn ? "Encrypted Transactions" : "Mã hóa cổng thanh toán"}</h4>
                      <p>{isEn ? "Bank and e-wallet payments are processed via certified PCI-DSS gateway partners." : "Giao dịch thanh toán được mã hóa chuẩn quốc tế qua các đối tác cổng thanh toán uy tín."}</p>
                    </div>
                  </div>
                  <div className="highlight-mini-card">
                    <CreditCard size={18} />
                    <div>
                      <h4>{isEn ? "Zero Card Data Storage" : "Không lưu thông tin thẻ"}</h4>
                      <p>{isEn ? "ParkMatrix never stores full credit card numbers, CVV codes, or banking PINs." : "ParkMatrix không bao giờ lưu trữ số thẻ ngân hàng, mã CVV hay mật khẩu ngân hàng của bạn."}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 5 */}
              <section id="sec-5" className="policy-section">
                <div className="section-header">
                  <span className="section-num">05</span>
                  <h2>{isEn ? "Access Control & Scoped Privileges" : "Phân Quyền Truy Cập Nội Bộ Chặt Chẽ"}</h2>
                </div>

                <p>
                  {isEn
                    ? "ParkMatrix enforces facility-scoped role-based access control (RBAC). On-site staff members can only view operational check-in records for their assigned parking lot and have no access to full financial accounts or customer identity profiles."
                    : "Hệ thống áp dụng chính sách phân quyền theo phạm vi cơ sở. Nhân viên trực bãi chỉ có thể xem thông tin biển số và thời gian gửi xe của bãi xe được phân công phụ trách, hoàn toàn không có quyền truy cập thông tin tài khoản cá nhân của bạn."}
                </p>
              </section>

              {/* Section 6 */}
              <section id="sec-6" className="policy-section">
                <div className="section-header">
                  <span className="section-num">06</span>
                  <h2>{isEn ? "Your Rights Regarding Personal Data" : "Quyền Của Bạn Đối Với Dữ Liệu Cá Nhân"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Sparkles size={16} />
                  <div>
                    <strong>{isEn ? "Full User Control: " : "Toàn quyền kiểm soát: "}</strong>
                    {isEn
                      ? "Under Decree 13/2023/ND-CP, you have the right to inspect your parking history, update registered plates, and request complete account deletion at any time."
                      : "Theo Nghị định 13/2023/NĐ-CP, bạn có toàn quyền tra cứu lịch sử gửi xe, sửa đổi thông tin phương tiện hoặc yêu cầu xóa vĩnh viễn tài khoản của mình bất cứ lúc nào."}
                  </div>
                </div>

                <ul className="policy-bullet-list">
                  <li>{isEn ? "Right to review and download past booking histories and payment receipts." : "Quyền tra cứu, tải về toàn bộ lịch sử đặt chỗ và biên lai hóa đơn đã thanh toán."}</li>
                  <li>{isEn ? "Right to correct inaccurate vehicle license plates or contact telephone numbers." : "Quyền yêu cầu chỉnh sửa thông tin biển số xe hoặc số điện thoại trong hồ sơ cá nhân."}</li>
                  <li>{isEn ? "Right to request account deletion and removal of personal records." : "Quyền yêu cầu đóng tài khoản và xóa sạch dữ liệu cá nhân khỏi hệ thống."}</li>
                </ul>
              </section>

              {/* Section 7 */}
              <section id="sec-7" className="policy-section">
                <div className="section-header">
                  <span className="section-num">07</span>
                  <h2>{isEn ? "Contact & Data Protection Officer" : "Thông Tin Liên Hệ Bộ Phận Bảo Mật Dữ Liệu"}</h2>
                </div>

                <div className="policy-contact-box">
                  <p><strong>ParkMatrix Smart Parking Management System</strong></p>
                  <p>📍 {isEn ? "Headquarters: High-Tech Park, Thu Duc City, Ho Chi Minh City, Vietnam" : "Trụ sở: Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh"}</p>
                  <p>📧 {isEn ? "Data Protection Officer: privacy@parkmatrix.vn" : "Bộ phận Bảo vệ Dữ liệu: privacy@parkmatrix.vn"}</p>
                  <p>📞 {isEn ? "24/7 Driver Support Hotline: 1900 8888 (Toll-free)" : "Hotline tiếp nhận hỗ trợ 24/7: 1900 8888 (Miễn phí cước gọi)"}</p>
                </div>
              </section>
            </article>
          </div>
        </main>
      </div>
    </CustomerLayout>
  );
}
