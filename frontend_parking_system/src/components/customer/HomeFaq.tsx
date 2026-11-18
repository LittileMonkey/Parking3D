import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { api, type ApprovedFaqResponse, type ParkingLot } from "../../services/api";

interface FaqItemData {
  title: string;
  section: string;
  paragraphs: string[];
  source: string;
  revision: number;
}

function getDefaultAnswers(lotName: string, isEn: boolean): FaqItemData[] {
  if (isEn) {
    return [
      {
        title: `Online 3-Step Parking Booking at ${lotName}`,
        section: "Guidance for Advance Space Reservation via 3D Digital Twin",
        paragraphs: [
          "1. Smart Search & Facility Filtering: Search by destination, select vehicle type (Car, Motorbike, or EV), and input your expected duration. You can sort by Nearest (GPS Haversine distance) or Cheapest with transparent estimated pricing calculation.",
          "2. Interactive 3D Digital Twin Map: View real-time spatial digital twin maps across levels (B1, B2, B3, Outdoor) and zones (Zone A, Zone B, EV Bays). Choose an exact slot (EXACT_SLOT) directly or enable auto-assignment (AUTO_SLOT) for the closest spot to entryways.",
          "3. Instant Confirmation & Concurrency Guard: Enter your vehicle license plate and confirm. Our strict Time-Window Overlap Guard (PostgreSQL Advisory Lock) prevents any double-booking or slot collision.",
        ],
        source: "ParkMatrix Core Platform Operations Manual (Baseline V4)",
        revision: 1,
      },
      {
        title: "Temporary Space Hold & Expiration Policy (Hold Window)",
        section: "Slot Reservation Lifespan & Auto-Release Mechanism",
        paragraphs: [
          "• Standard 5-Minute Hold Duration: Upon clicking 'Confirm Booking', your selected space is temporarily locked in HELD status for 5 minutes (standard policy across ParkMatrix facilities).",
          "• Real-Time Countdown: A prominent live countdown timer appears on your checkout screen. Please complete your payment before the 5-minute window expires.",
          "• Automatic Release & Guarantee: If payment is not completed within 5 minutes, the slot is automatically released back to AVAILABLE status for other drivers. Once successfully paid, your reservation is 100% guaranteed for the entirety of your reserved schedule.",
        ],
        source: "ParkMatrix Anti-Overbooking & Hold Slot Policy (SCRUM-100)",
        revision: 1,
      },
      {
        title: "Flexible & Secure Multi-Channel Payment Methods",
        section: "Online and On-Site Parking Payment Guidelines",
        paragraphs: [
          "1. Online Payment via VNPay / QR Code: Scan dynamic VNPAY-QR codes instantly using any Vietnamese Mobile Banking application or popular e-wallets (VNPay, MoMo, ZaloPay, Viettel Money) with immediate digital receipt generation.",
          "2. Cash Payment (CASH) On-Site: Drivers can pay cash directly to parking staff at entry/exit security booths upon arrival or departure.",
          "3. Prepaid Monthly Pass / Member Card: Regular commuters can register for monthly subscriptions paired with 4K AI LPR (ANPR) license plate recognition for automated barrier gate opening without stopping.",
        ],
        source: "ParkMatrix Payment Service Integration Manual",
        revision: 1,
      },
    ];
  }

  return [
    {
      title: `Quy trình đặt chỗ đỗ xe 3 bước tại ${lotName}`,
      section: "Hướng dẫn người dùng đặt trước vị trí đỗ xe qua Sơ đồ 3D",
      paragraphs: [
        "1. Tìm kiếm & Lọc bãi đỗ thông minh: Nhập điểm đến, chọn loại phương tiện (Ô tô, Xe máy, Xe điện EV) và thời lượng dự kiến. Hệ thống cho phép sắp xếp theo tiêu chí Gần nhất (GPS Haversine) hoặc Tiết kiệm nhất kèm bảng giá dự toán minh bạch.",
        "2. Chọn vị trí trực quan trên Sơ đồ số 3D (Digital Twin): Xem toàn cảnh mô hình bãi đỗ đa tầng thời gian thực (B1, B2, B3, Ngoài trời) và các phân khu (Zone A, Zone B, Trụ sạc EV). Bạn có thể tự chọn ô đỗ ưng ý (EXACT_SLOT) hoặc để hệ thống tự động gán vị trí tối ưu gần lối ra vào (AUTO_SLOT).",
        "3. Xác nhận & Giữ chỗ độc quyền: Nhập biển số xe và bấm 'Xác nhận đặt chỗ'. Hệ thống áp dụng khóa giao dịch độc quyền (Time-Window Overlap Guard & PostgreSQL Advisory Lock) cam kết giữ đúng chỗ của bạn, tuyệt đối không bị trùng lặp.",
      ],
      source: "Quy chế Vận hành Nền tảng Đa bãi đỗ ParkMatrix (Baseline V4)",
      revision: 1,
    },
    {
      title: "Quy định thời gian giữ chỗ chờ thanh toán (Hold Policy)",
      section: "Chính sách bảo lưu chỗ đỗ và giải phóng slot tự động",
      paragraphs: [
        "• Thời gian giữ chỗ mặc định 5 phút: Ngay sau khi bạn nhấn 'Xác nhận đặt chỗ', vị trí đỗ được chuyển sang trạng thái Tạm giữ (HELD) trong vòng 5 phút (chuẩn cấu hình nghiệp vụ toàn hệ thống ParkMatrix theo SCRUM-100).",
        "• Đồng hồ đếm ngược trực tiếp: Màn hình thanh toán sẽ hiển thị đồng hồ đếm ngược thời gian thực. Quý khách vui lòng hoàn tất giao dịch trước khi đồng hồ về 0.",
        "• Cơ chế giải phóng tự động: Nếu quá 5 phút mà chưa thanh toán, hệ thống sẽ tự động hủy lệnh giữ chỗ và đưa ô đỗ về trạng thái Sẵn sàng (AVAILABLE) để phục vụ khách hàng khác. Sau khi thanh toán thành công, vị trí đỗ được bảo lưu an toàn 100% cho toàn bộ khung giờ bạn đã đăng ký.",
      ],
      source: "Quy tắc Nghiệp vụ Chống Overbooking & Hold Slot (SCRUM-100)",
      revision: 1,
    },
    {
      title: "Phương thức thanh toán đa kênh tiện lợi và an toàn",
      section: "Hướng dẫn thanh toán trực tuyến và tại bãi đỗ xe",
      paragraphs: [
        "1. Cổng thanh toán trực tuyến VNPay / QR Code: Quét mã VNPAY-QR nhanh chóng qua ứng dụng ngân hàng di động (Mobile Banking) của tất cả ngân hàng hoặc ví điện tử liên kết (VNPay, MoMo, ZaloPay, Viettel Money), xử lý tức thì kèm biên lai điện tử.",
        "2. Thanh toán tiền mặt (CASH) tại bãi: Khách hàng có thể thanh toán trực tiếp bằng tiền mặt cho nhân viên kiểm soát tại bốt an ninh cổng vào/cổng ra khi phương tiện đến bãi.",
        "3. Thẻ thành viên / Vé tháng trả trước: Khách hàng đăng ký gói vé tháng được nhận diện biển số tự động bằng camera AI LPR (ANPR) 4K tại barrier, giúp xe lưu thông thông suốt mà không cần dừng lại thao tác.",
      ],
      source: "Chính sách Cổng Thanh toán Đa kênh ParkMatrix Payment Service",
      revision: 1,
    },
  ];
}

export default function HomeFaq({ lots }: { lots: ParkingLot[] }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const text = (vi: string, en: string) => isEn ? en : vi;
  const [lotId, setLotId] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [answer, setAnswer] = useState<ApprovedFaqResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const questions = isEn
    ? ["How do I book a parking space?", "How long is a parking space held for payment?", "Which payment methods can I use?"]
    : ["Tôi đặt chỗ đỗ xe như thế nào?", "Chỗ đỗ được giữ bao lâu để thanh toán?", "Tôi có thể thanh toán bằng cách nào?"];

  useEffect(() => {
    setLotId(lots[0]?.id ?? "");
  }, [lots]);

  useEffect(() => {
    requestId.current += 1;
    setOpen(null);
    setAnswer(null);
    setLoading(false);
    return () => { requestId.current += 1; };
  }, [lotId, lang]);

  const selectedLot = lots.find((l) => l.id === lotId) || lots[0];
  const lotName = selectedLot?.name || (isEn ? "ParkMatrix Smart Facility" : "Bãi đỗ xe ParkMatrix");
  const defaultAnswers = getDefaultAnswers(lotName, isEn);

  const toggle = async (index: number) => {
    const id = ++requestId.current;
    if (open === index) {
      setOpen(null);
      setAnswer(null);
      setLoading(false);
      return;
    }
    setOpen(index);
    setAnswer(null);

    if (!lotId) return;
    setLoading(true);

    try {
      const result = await api.askApprovedFaq(lotId, questions[index]);
      if (requestId.current === id) {
        // If API returns actual approved documents, show them;
        // if empty or returns generic fallback, fall back to our rich project answers
        if (result && result.answers && result.answers.length > 0) {
          setAnswer(result);
        } else {
          setAnswer(null);
        }
      }
    } catch {
      if (requestId.current === id) {
        setAnswer(null);
      }
    } finally {
      if (requestId.current === id) {
        setLoading(false);
      }
    }
  };

  return (
    <section className="lp-faq-section" id="questions">
      <div className="lp-container lp-section lp-faq-grid">
        <div className="lp-faq-intro">
          <p className="lp-eyebrow">{text("GIẢI ĐÁP TRƯỚC HÀNH TRÌNH", "BEFORE YOU GO")}</p>
          <h2>{text("Bạn hỏi, ParkMatrix giải đáp.", "A little help for your journey.")}</h2>
          <p>{text("Chọn bãi để xem hướng dẫn đã được duyệt cho điểm đến của bạn.", "Choose a lot to read its approved parking guidance.")}</p>
          <Link to="/faq" className="lp-text-link">
            {text("Đến trang trợ giúp", "Visit the help center")}
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="lp-faq-list">
          <label className="lp-field" htmlFor="home-faq-lot">
            <span>{text("Hướng dẫn tại bãi", "Guidance for this lot")}</span>
            <select
              id="home-faq-lot"
              value={lotId}
              onChange={(event) => setLotId(event.target.value)}
              disabled={!lots.length}
            >
              {!lots.length && <option value="">{text("Chưa tải được danh sách bãi", "Parking lots are unavailable")}</option>}
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
          </label>

          {questions.map((question, index) => {
            const defaultItem = defaultAnswers[index];
            return (
              <article className="lp-faq-item" key={question}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={open === index}
                    aria-controls={`home-faq-answer-${index}`}
                    onClick={() => void toggle(index)}
                  >
                    <span>{question}</span>
                    <ChevronDown size={18} />
                  </button>
                </h3>

                <div
                  id={`home-faq-answer-${index}`}
                  hidden={open !== index}
                  className="lp-faq-answer"
                  aria-live="polite"
                >
                  {loading && !answer ? (
                    <p role="status" className="lp-faq-loading">
                      {text("Đang tải dữ liệu hướng dẫn…", "Loading guidance…")}
                    </p>
                  ) : answer && answer.answers.length > 0 ? (
                    <div className="lp-faq-answer-block">
                      {answer.answers.map((item) => (
                        <div key={`${item.documentId}-${item.revision}-${item.section}`} className="lp-faq-answer-item">
                          {item.section && <h4 className="lp-faq-answer-subtitle">{item.section}</h4>}
                          <p className="lp-faq-answer-para">{item.content}</p>
                          <small className="lp-faq-answer-source">
                            ✓ {item.source} · {text("Phiên bản", "Revision")} {item.revision}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : defaultItem ? (
                    <div className="lp-faq-answer-block">
                      <h4 className="lp-faq-answer-title">{defaultItem.title}</h4>
                      <span className="lp-faq-answer-badge">📋 {defaultItem.section}</span>
                      <div className="lp-faq-answer-paragraphs">
                        {defaultItem.paragraphs.map((para, pIdx) => (
                          <p key={pIdx} className="lp-faq-answer-para">
                            {para}
                          </p>
                        ))}
                      </div>
                      <small className="lp-faq-answer-source">
                        ✓ {defaultItem.source} · {text("Tài liệu chính thức", "Official Platform Document")} (v{defaultItem.revision})
                      </small>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
