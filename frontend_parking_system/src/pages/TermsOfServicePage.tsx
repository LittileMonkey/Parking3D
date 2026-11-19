import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import CustomerLayout from "../components/customer/CustomerLayout";
import {
  Scale,
  ShieldCheck,
  Printer,
  ChevronRight,
  Clock,
  Zap,
  CheckCircle2,
  Building2,
  Sparkles,
} from "lucide-react";
import "./LegalPages.css";

export default function TermsOfServicePage() {
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
              <span className="crumb-current">{isEn ? "Terms of Service" : "Điều khoản dịch vụ"}</span>
            </nav>

            <div className="policy-hero-header">
              <div className="policy-badge-light">
                <Scale size={16} />
                <span>{isEn ? "TERMS OF USE & SERVICE AGREEMENT" : "ĐIỀU KHOẢN SỬ DỤNG & THỎA THUẬN DỊCH VỤ"}</span>
              </div>
              <h1 className="policy-hero-title-light">
                {isEn ? "Terms of Service" : "Điều Khoản Dịch Vụ"}
              </h1>
              <p className="policy-hero-desc-light">
                {isEn
                  ? "Welcome to ParkMatrix. By accessing or using our multi-parking reservation platform, automated barrier systems, and payment services, you agree to comply with and be bound by the following terms."
                  : "Chào mừng bạn đến với ParkMatrix. Khi truy cập hoặc sử dụng nền tảng đặt chỗ bãi đỗ xe thông minh, hệ thống barrier tự động và các dịch vụ thanh toán của chúng tôi, bạn đồng ý tuân thủ toàn bộ các điều khoản dưới đây."}
              </p>

              {/* Metadata Pill Bar */}
              <div className="policy-meta-pill-bar">
                <span className="meta-pill">
                  <span className="meta-dot" />
                  {isEn ? "Effective: October 2026" : "Hiệu lực: Tháng 10/2026"}
                </span>
                <span className="meta-pill">
                  {isEn ? "Applicable: Nationwide (VN)" : "Phạm vi: Toàn hệ thống ParkMatrix"}
                </span>
                <span className="meta-pill">
                  {isEn ? "Standard: Baseline V4" : "Tiêu chuẩn: Baseline V4 Multi-Facility"}
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
                  <Link to="/privacy" className="quick-switch-btn">
                    <ShieldCheck size={13} />
                    <span>{isEn ? "Privacy" : "Bảo mật"}</span>
                  </Link>
                  <Link to="/terms" className="quick-switch-btn is-active">
                    <Scale size={13} />
                    <span>{isEn ? "Terms" : "Điều khoản"}</span>
                  </Link>
                </div>

                <h3 className="sidebar-title">{isEn ? "Table of Contents" : "Nội dung điều khoản"}</h3>
                <ul className="sidebar-links">
                  <li><a href="#term-1"><ChevronRight size={13} /> {isEn ? "1. Agreement & Platform Role" : "1. Thỏa thuận & Vai trò nền tảng"}</a></li>
                  <li><a href="#term-2"><ChevronRight size={13} /> {isEn ? "2. Hold Policy (5-Minute Window)" : "2. Cơ chế giữ chỗ (5 phút)"}</a></li>
                  <li><a href="#term-3"><ChevronRight size={13} /> {isEn ? "3. Entry/Exit & ANPR Rules" : "3. Quy định Ra/Vào & Biển số"}</a></li>
                  <li><a href="#term-4"><ChevronRight size={13} /> {isEn ? "4. Pricing & 15-Minute Blocks" : "4. Biểu giá & Block 15 phút"}</a></li>
                  <li><a href="#term-5"><ChevronRight size={13} /> {isEn ? "5. EV Charging Station Safety" : "5. Trạm sạc xe điện EV"}</a></li>
                  <li><a href="#term-6"><ChevronRight size={13} /> {isEn ? "6. Customer Responsibilities" : "6. Trách nhiệm người gửi xe"}</a></li>
                  <li><a href="#term-7"><ChevronRight size={13} /> {isEn ? "7. Limitation of Liability" : "7. Giới hạn trách nhiệm"}</a></li>
                  <li><a href="#term-8"><ChevronRight size={13} /> {isEn ? "8. Dispute Resolution & Law" : "8. Giải quyết tranh chấp"}</a></li>
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
              {/* Term 1 */}
              <section id="term-1" className="policy-section">
                <div className="section-header">
                  <span className="section-num">01</span>
                  <h2>{isEn ? "Agreement & Platform Scope" : "Thỏa Thuận Sử Dụng & Vai Trò Nền Tảng"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Sparkles size={16} />
                  <div>
                    <strong>{isEn ? "Key Takeaway: " : "Tóm tắt nhanh: "}</strong>
                    {isEn
                      ? "ParkMatrix connects drivers with independent smart parking facilities. By booking, you agree to comply with road traffic laws and on-site facility rules."
                      : "ParkMatrix là nền tảng công nghệ kết nối tài xế với các bãi đỗ xe thông minh. Bằng việc đặt chỗ, bạn đồng ý tuân thủ Luật Giao thông Đường bộ và nội quy bãi xe."}
                  </div>
                </div>

                <p>
                  {isEn
                    ? "ParkMatrix operates as a unified multi-facility smart parking platform managing multiple parking lots (ParkingLot), each with its own physical levels (ParkingLevel), zones (Zone), slots (ParkingSlot), and operating schedules."
                    : "ParkMatrix vận hành như một nền tảng quản lý bãi đỗ xe thông minh đa cơ sở. Mỗi bãi đỗ xe (ParkingLot) trực thuộc mạng lưới sở hữu cấu trúc tầng (ParkingLevel), phân khu (Zone), vị trí đỗ (ParkingSlot) và biểu giá vận hành độc lập theo chính sách của từng cơ sở."}
                </p>
                <p>
                  {isEn
                    ? "By using ParkMatrix, you agree that you are legally capable of entering into binding contracts and that you will follow all traffic regulations, facility safety guidelines, and staff directions within each parking premises."
                    : "Khi đặt chỗ hoặc sử dụng dịch vụ tại bãi, bạn cam kết có đủ năng lực hành vi dân sự, chấp hành nghiêm túc Luật Giao thông Đường bộ và các quy định an toàn, hướng dẫn của nhân viên quản lý tại cơ sở."}
                </p>
              </section>

              {/* Term 2 */}
              <section id="term-2" className="policy-section">
                <div className="section-header">
                  <span className="section-num">02</span>
                  <h2>{isEn ? "Reservation Hold Policy (5-Minute Window)" : "Cơ Chế Giữ Chỗ & Thời Hạn Thanh Toán (5 Phút)"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Clock size={16} />
                  <div>
                    <strong>{isEn ? "5-Minute Free Hold Window: " : "Thời hạn thanh toán 5 phút: "}</strong>
                    {isEn
                      ? "Your selected bay is held for exactly 5 minutes. If unpaid within 5 minutes, it is released automatically with zero fees charged to you."
                      : "Vị trí đỗ bạn chọn được giữ trong đúng 5 phút để thanh toán. Nếu quá 5 phút chưa thanh toán, lệnh đặt sẽ tự động hủy mà không trừ bất kỳ khoản tiền nào."}
                  </div>
                </div>

                <p>
                  {isEn
                    ? "To ensure fair availability for all motorists in congested urban centers, the 5-minute hold rule applies universally across all facilities:"
                    : "Nhằm bảo đảm tính công bằng và tối ưu hóa diện tích đỗ xe trong đô thị, quy chế giữ chỗ 5 phút được áp dụng đồng bộ trên toàn mạng lưới:"}
                </p>

                <ul className="policy-bullet-list">
                  <li>{isEn ? "A real-time countdown timer is displayed during checkout." : "Đồng hồ đếm ngược hiển thị thời gian thực trên màn hình thanh toán để bạn theo dõi."}</li>
                  <li>{isEn ? "Once payment is confirmed, your space is 100% reserved for your scheduled duration." : "Sau khi thanh toán thành công, vị trí đỗ được khóa riêng cho phương tiện của bạn trong toàn bộ khung giờ đã đặt."}</li>
                </ul>
              </section>

              {/* Term 3 */}
              <section id="term-3" className="policy-section">
                <div className="section-header">
                  <span className="section-num">03</span>
                  <h2>{isEn ? "Entry, Exit & Plate Verification" : "Quy Định Ra/Vào Bãi & Nhận Diện Biển Số"}</h2>
                </div>

                <div className="policy-card-grid">
                  <div className="highlight-mini-card">
                    <CheckCircle2 size={18} />
                    <div>
                      <h4>{isEn ? "Accurate License Plate" : "Nhập chính xác biển số xe"}</h4>
                      <p>{isEn ? "Camera ANPR systems verify matching plate records at entrance gates." : "Camera đối chiếu biển số thực tế với lượt đặt chỗ để nâng barie tự động."}</p>
                    </div>
                  </div>
                  <div className="highlight-mini-card">
                    <Building2 size={18} />
                    <div>
                      <h4>{isEn ? "Physical Slot Release" : "Xác nhận rời bãi thực tế"}</h4>
                      <p>{isEn ? "Slots are marked Available only after the vehicle physically clears the exit gate." : "Vị trí chỉ được giải phóng khi xe vật lý đã thực sự qua khỏi barie cổng ra."}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Term 4 */}
              <section id="term-4" className="policy-section">
                <div className="section-header">
                  <span className="section-num">04</span>
                  <h2>{isEn ? "Pricing Plans & 15-Minute Block Billing" : "Biểu Giá Dịch Vụ & Block Tính Phí 15 Phút"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Sparkles size={16} />
                  <div>
                    <strong>{isEn ? "Fair Incremental Billing: " : "Tính phí công bằng & minh bạch: "}</strong>
                    {isEn
                      ? "Parking charges are calculated in granular 15-minute intervals instead of full-hour rounding, capped by a maximum daily ceiling."
                      : "Cước phí được tính chi tiết theo từng block 15 phút, không làm tròn cả giờ gây thiệt hại cho khách hàng, kèm mức trần cước ngày (Daily Cap) tiết kiệm."}
                  </div>
                </div>

                <div className="policy-card-grid">
                  <div className="highlight-mini-card">
                    <Clock size={18} />
                    <div>
                      <h4>{isEn ? "15-Minute Block" : "Block tính phí 15 phút"}</h4>
                      <p>{isEn ? "Fees computed per 15-minute block based on vehicle category." : "Tính phí theo mỗi 15 phút, phù hợp cho cả gửi nhanh và gửi lâu."}</p>
                    </div>
                  </div>
                  <div className="highlight-mini-card">
                    <Zap size={18} />
                    <div>
                      <h4>{isEn ? "Daily Price Cap" : "Trần cước ngày (Daily Cap)"}</h4>
                      <p>{isEn ? "Guarantees a capped maximum rate for continuous 24-hour stays." : "Mức trần chi phí tối đa trong ngày giúp tài xế hoàn toàn an tâm về ngân sách."}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Term 5 */}
              <section id="term-5" className="policy-section">
                <div className="section-header">
                  <span className="section-num">05</span>
                  <h2>{isEn ? "EV Charging Station Regulations" : "Quy Định Vị Trí Sạc Xe Điện (EV Charging)"}</h2>
                </div>

                <div className="policy-takeaway-box">
                  <Zap size={16} />
                  <div>
                    <strong>{isEn ? "EV Charging Etiquette: " : "Quy tắc sạc xe điện: "}</strong>
                    {isEn
                      ? "Non-EV vehicles must not park in EV bays. When fully charged, owners should relocate vehicles within 15 minutes to share chargers with other drivers."
                      : "Tuyệt đối không đỗ xe xăng/dầu vào vị trí trụ sạc xe điện. Khi pin sạc đầy 100%, chủ xe vui lòng di chuyển xe trong vòng 15 phút để nhường chỗ sạc cho người khác."}
                  </div>
                </div>

                <ul className="policy-bullet-list">
                  <li>{isEn ? "Only plug in compatible charging standards. Thermal safety sensors automatically cut power if abnormalities occur." : "Chỉ sử dụng cáp và chuẩn sạc tương thích. Hệ thống cảm biến nhiệt tự động ngắt điện khi phát hiện bất thường."}</li>
                </ul>
              </section>

              {/* Term 6 */}
              <section id="term-6" className="policy-section">
                <div className="section-header">
                  <span className="section-num">06</span>
                  <h2>{isEn ? "Customer Responsibilities & Prohibited Acts" : "Trách Nhiệm Của Khách Hàng & Quy Định An Toàn"}</h2>
                </div>

                <ul className="policy-bullet-list">
                  <li>{isEn ? "Do not leave high-value valuables, cash, or hazardous inflammable goods inside the vehicle." : "Không để tiền mặt có giá trị lớn, trang sức quý hoặc hàng hóa nguy hiểm, chất dễ cháy nổ trong xe."}</li>
                  <li>{isEn ? "Park neatly within marked bay boundaries without encroaching on driving aisles." : "Đỗ xe ngay ngắn trong vạch kẻ giới hạn của ô đỗ, không đỗ chắn lối đi chung hoặc lấn sang ô bên cạnh."}</li>
                  <li>{isEn ? "Turn off vehicle engines, turn off headlights, and engage parking brakes before leaving." : "Tắt máy, tắt đèn pha, kéo phanh tay và khóa xe cẩn thận trước khi rời khỏi phương tiện."}</li>
                </ul>
              </section>

              {/* Term 7 */}
              <section id="term-7" className="policy-section">
                <div className="section-header">
                  <span className="section-num">07</span>
                  <h2>{isEn ? "Limitation of Liability" : "Giới Hạn Trách Nhiệm"}</h2>
                </div>

                <p>
                  {isEn
                    ? "ParkMatrix provides the digital platform connecting drivers with parking facilities. Facility owners and operators maintain on-site vehicle bailment duties according to Vietnamese Civil Code. The platform shall not be held liable for personal belongings left unattended inside vehicles or force majeure events (e.g. natural disasters, acts of God)."
                    : "ParkMatrix cung cấp giải pháp công nghệ kết nối và quản lý. Trách nhiệm trông giữ phương tiện tại bãi thuộc về đơn vị quản lý vận hành cơ sở theo Bộ luật Dân sự Việt Nam. Nền tảng không chịu trách nhiệm với tư trang giá trị bị mất do khách hàng để quên trong xe hoặc các trường hợp bất khả kháng do thiên tai, hỏa hoạn khách quan."}
                </p>
              </section>

              {/* Term 8 */}
              <section id="term-8" className="policy-section">
                <div className="section-header">
                  <span className="section-num">08</span>
                  <h2>{isEn ? "Dispute Resolution & Governing Law" : "Giải Quyết Tranh Chấp & Luật Điều Chỉnh"}</h2>
                </div>

                <p>
                  {isEn
                    ? "These Terms of Service are governed by and construed in accordance with the laws of the Socialist Republic of Vietnam. Any disputes arising shall first be negotiated amicably through the ParkMatrix Support Center, and if unresolved, submitted to the competent People's Court in Ho Chi Minh City."
                    : "Điều khoản này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh trước hết sẽ được giải quyết qua thương lượng hòa giải thông qua Trung tâm Hỗ trợ ParkMatrix. Trường hợp không hòa giải được, vụ việc sẽ được đưa ra Tòa án Nhân dân có thẩm quyền tại TP. Hồ Chí Minh để giải quyết."}
                </p>
              </section>
            </article>
          </div>
        </main>
      </div>
    </CustomerLayout>
  );
}
