import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  QrCode,
  Clock,
  ShieldCheck,
  CreditCard,
  Banknote,
  ScanFace,
  CheckCircle2,
  MapPin,
  Building2,
  Trees,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { api, type ApprovedFaqResponse, type ParkingLot } from "../../services/api";

interface FaqItemData {
  title: string;
  section: string;
  paragraphs: string[];
  source: string;
}

function getDefaultAnswers(lotName: string, isEn: boolean, isOutdoor: boolean): FaqItemData[] {
  if (isEn) {
    if (isOutdoor) {
      return [
        {
          title: `How to reserve a space at ${lotName}`,
          section: "Open-air ground lot bay selection and gate entry pass",
          paragraphs: [
            "1. Select vehicle & duration: Choose your vehicle type (Car or Motorbike) and expected parking duration to review the hourly and daily rate.",
            "2. Choose an open bay on the ground map: Binh Thanh is an open-air ground lot featuring Zone A (10 car bays), Zone B (10 car bays), and Zone MOTO (20 motorbike spaces). Tap any available space directly on the layout.",
            "3. Receive your gate QR pass: Enter your license plate and confirm. An instant QR pass is generated. At the entrance boom barrier, scan this QR code or let the barrier camera scan your plate for entry.",
          ],
          source: "Ground Lot Driver Guide",
        },
        {
          title: "Temporary 5-minute hold policy",
          section: "Bay reservation hold window and automatic release",
          paragraphs: [
            "• 5-Minute Hold Window: After clicking confirm, the selected parking bay is temporarily locked for you for 5 minutes so you can complete payment.",
            "• Live Countdown Timer: A countdown timer is displayed on your payment screen to keep you informed of the remaining time.",
            "• Automatic Free Cancellation: If payment is not completed within 5 minutes, the slot is automatically released for other drivers with zero charge to your account. Once payment succeeds, your spot is guaranteed for your scheduled visit.",
          ],
          source: "Facility Service Policy",
        },
        {
          title: "Accepted payment methods",
          section: "Digital contactless and on-site cash options",
          paragraphs: [
            "1. Dynamic QR via Banking App: Scan the VNPAY-QR code with any Vietnamese mobile banking app or e-wallet (MoMo, ZaloPay). Digital receipts and VAT invoices are generated instantly.",
            "2. Cash at Exit Booth: Drivers can pay cash directly to the security guard on duty at the exit booth upon departure.",
            "3. Monthly Pass Plate Recognition: Monthly subscribers can drive straight through. The entrance camera recognizes your registered license plate and raises the barrier in 1 second.",
          ],
          source: "Payment Guide",
        },
      ];
    }

    return [
      {
        title: `How to reserve a space at ${lotName}`,
        section: "3-level facility floor selection and gate entry pass",
        paragraphs: [
          "1. Select vehicle & duration: Choose your vehicle type (Car or Motorbike) and parking duration to see upfront pricing.",
          "2. Pick a floor & bay on the 3D map: The building provides Level 1 (F1) for motorbikes, and Level 2 (F2) & Level 3 (F3) for 200 cars via an access ramp. Tap your preferred floor and space on the map.",
          "3. Receive your gate QR pass: Confirm your license plate to generate an instant entry pass. Scan the QR code at the barrier gate or drive up for automated camera recognition.",
        ],
        source: "Multi-Storey Facility Guide",
      },
      {
        title: "Temporary 5-minute hold policy",
        section: "Bay reservation hold window and automatic release",
        paragraphs: [
          "• 5-Minute Hold Window: After clicking confirm, the selected parking bay is temporarily locked for you for 5 minutes so you can complete payment.",
          "• Live Countdown Timer: A countdown timer is displayed on your payment screen to keep you informed of the remaining time.",
          "• Automatic Free Cancellation: If payment is not completed within 5 minutes, the slot is automatically released for other drivers with zero charge to your account. Once payment succeeds, your spot is guaranteed for your scheduled visit.",
        ],
        source: "Facility Service Policy",
      },
      {
        title: "Accepted payment methods",
        section: "Digital contactless and on-site cash options",
        paragraphs: [
          "1. Dynamic QR via Banking App: Scan the VNPAY-QR code with any Vietnamese mobile banking app or e-wallet (MoMo, ZaloPay). Digital receipts and VAT invoices are generated instantly.",
          "2. Cash at Exit Booth: Drivers can pay cash directly to the security guard on duty at the exit booth upon departure.",
          "3. Monthly Pass Plate Recognition: Monthly subscribers can drive straight through. The entrance camera recognizes your registered license plate and raises the barrier in 1 second.",
        ],
        source: "Payment Guide",
      },
    ];
  }

  // VIETNAMESE
  if (isOutdoor) {
    return [
      {
        title: `Quy trình đặt chỗ tại ${lotName}`,
        section: "Hướng dẫn chọn vị trí bãi ngoài trời và nhận vé vào cổng",
        paragraphs: [
          "1. Chọn loại xe & thời gian gửi: Chọn xe (Ô tô hoặc Xe máy) và thời gian bạn dự kiến gửi để xem trước mức phí minh bạch.",
          "2. Chọn vị trí trên sơ đồ mặt đất: Bãi Bình Thạnh là bãi ngoài trời tại mặt đất, gồm Khu A (10 ô tô), Khu B (10 ô tô) và Khu MOTO (20 xe máy). Bạn bấm trực tiếp vào ô đỗ còn trống trên sơ đồ.",
          "3. Nhận mã vé QR vào bãi: Nhập biển số xe và bấm xác nhận để nhận mã vé điện tử. Khi lái xe đến cổng, bạn quét mã QR tại barrier hoặc để camera quét biển số để thanh chắn tự động mở.",
        ],
        source: "Hướng dẫn gửi xe tại bãi ngoài trời",
      },
      {
        title: "Quy định thời gian giữ chỗ chờ thanh toán",
        section: "Chính sách bảo lưu vị trí và tự động hủy lượt đặt",
        paragraphs: [
          "• Thời gian giữ chỗ 5 phút: Sau khi bấm xác nhận đặt chỗ, vị trí đỗ được giữ tạm thời cho bạn trong vòng 5 phút để bạn thanh toán.",
          "• Đồng hồ đếm ngược: Trên màn hình thanh toán có đồng hồ đếm ngược rõ ràng giúp bạn theo dõi thời gian còn lại.",
          "• Tự động hủy nếu chưa thanh toán: Nếu quá 5 phút bạn chưa thanh toán, hệ thống sẽ tự động hủy lượt đặt để nhường chỗ cho tài xế khác. Bạn hoàn toàn không bị trừ bất kỳ khoản phí nào. Khi thanh toán thành công, chỗ đỗ được đảm bảo cho bạn suốt thời gian gửi.",
        ],
        source: "Quy chế bảo lưu chỗ đỗ ParkMatrix",
      },
      {
        title: "Các hình thức thanh toán được hỗ trợ",
        section: "Thanh toán không tiền mặt và thanh toán trực tiếp tại bãi",
        paragraphs: [
          "1. Quét mã QR qua ứng dụng ngân hàng: Quét mã VNPAY-QR bằng Mobile Banking của bất kỳ ngân hàng nào hoặc ví điện tử (MoMo, ZaloPay, Viettel Money). Hệ thống xuất biên lai điện tử ngay lập tức.",
          "2. Thanh toán tiền mặt tại cổng: Bạn có thể thanh toán tiền mặt trực tiếp cho nhân viên bảo vệ tại bốt kiểm soát cổng ra khi kết thúc lượt gửi.",
          "3. Nhận diện biển số tự động cho vé tháng: Khách hàng đăng ký gói vé tháng chỉ cần lái xe qua cổng, camera nhận diện biển số và tự động mở thanh chắn mà không cần dừng lại thao tác.",
        ],
        source: "Hướng dẫn thanh toán dịch vụ",
      },
    ];
  }

  return [
    {
      title: `Quy trình đặt chỗ tại ${lotName}`,
      section: "Hướng dẫn chọn tầng đỗ xe trong tòa nhà và nhận vé vào cổng",
      paragraphs: [
        "1. Chọn loại xe & thời gian gửi: Chọn xe (Ô tô hoặc Xe máy) và thời gian gửi để hệ thống hiển thị giá dự kiến rõ ràng.",
        "2. Chọn tầng & ô đỗ trên sơ đồ: Tòa nhà gồm Tầng 1 (F1) dành cho xe máy; Tầng 2 (F2) và Tầng 3 (F3) dành cho 200 ô tô. Xe ô tô di chuyển lên tầng qua ram dốc, bạn có thể tự chọn ô đỗ ưng ý trên sơ đồ tầng.",
        "3. Nhận mã vé QR vào bãi: Xác nhận biển số xe để nhận mã vé QR. Camera tại cổng vào sẽ tự động quét biển số xe hoặc mã vé để mở barie trong 1 giây.",
      ],
      source: "Hướng dẫn gửi xe tại tòa nhà cao tầng",
    },
    {
      title: "Quy định thời gian giữ chỗ chờ thanh toán",
      section: "Chính sách bảo lưu vị trí và tự động hủy lượt đặt",
      paragraphs: [
        "• Thời gian giữ chỗ 5 phút: Sau khi bấm xác nhận đặt chỗ, vị trí đỗ được giữ tạm thời cho bạn trong vòng 5 phút để bạn thanh toán.",
        "• Đồng hồ đếm ngược: Trên màn hình thanh toán có đồng hồ đếm ngược rõ ràng giúp bạn theo dõi thời gian còn lại.",
        "• Tự động hủy nếu chưa thanh toán: Nếu quá 5 phút bạn chưa thanh toán, hệ thống sẽ tự động hủy lượt đặt để nhường chỗ cho tài xế khác. Bạn hoàn toàn không bị trừ bất kỳ khoản phí nào. Khi thanh toán thành công, chỗ đỗ được đảm bảo cho bạn suốt thời gian gửi.",
      ],
      source: "Quy chế bảo lưu chỗ đỗ ParkMatrix",
    },
    {
      title: "Các hình thức thanh toán được hỗ trợ",
      section: "Thanh toán không tiền mặt và thanh toán trực tiếp tại bãi",
      paragraphs: [
        "1. Quét mã QR qua ứng dụng ngân hàng: Quét mã VNPAY-QR bằng Mobile Banking của bất kỳ ngân hàng nào hoặc ví điện tử (MoMo, ZaloPay, Viettel Money). Hệ thống xuất biên lai điện tử ngay lập tức.",
        "2. Thanh toán tiền mặt tại cổng: Bạn có thể thanh toán tiền mặt trực tiếp cho nhân viên bảo vệ tại bốt kiểm soát cổng ra khi kết thúc lượt gửi.",
        "3. Nhận diện biển số tự động cho vé tháng: Khách hàng đăng ký gói vé tháng chỉ cần lái xe qua cổng, camera nhận diện biển số và tự động mở thanh chắn mà không cần dừng lại thao tác.",
      ],
      source: "Hướng dẫn thanh toán dịch vụ",
    },
  ];
}

function FaqVisualShowcase({
  activeIndex,
  isEn,
  isOutdoor,
  lotName,
}: {
  activeIndex: number | null;
  isEn: boolean;
  isOutdoor: boolean;
  lotName: string;
}) {
  // Câu 1: Quy trình đặt chỗ (Đồng bộ theo bãi ngoài trời vs tòa nhà 3 tầng)
  if (activeIndex === 0) {
    return (
      <div className="lp-faq-showcase-container" aria-live="polite">
        <div className="lp-faq-showcase-panel lp-showcase-booking" key={`booking-${isOutdoor ? "outdoor" : "bldg"}`}>
          <div className="lp-showcase-header">
            <span className="lp-showcase-badge lp-badge-green">
              {isOutdoor ? <Trees size={13} /> : <Building2 size={13} />}
              {isOutdoor
                ? isEn ? "Outdoor Ground Lot" : "Bãi ngoài trời mặt đất"
                : isEn ? "3-Storey Facility" : "Tòa nhà đỗ xe 3 tầng"}
            </span>
            <span className="lp-showcase-pill">
              {isOutdoor ? (isEn ? "40 Spaces" : "40 Vị trí") : (isEn ? "200 Spaces" : "200 Vị trí")}
            </span>
          </div>

          <h4 className="lp-showcase-title">
            {isOutdoor
              ? isEn ? "Ground Map & Entry Pass" : "Sơ đồ bãi mặt đất & Vé vào cổng"
              : isEn ? "Multi-Level Map & Entry Pass" : "Sơ đồ tòa nhà 3 tầng & Vé vào cổng"}
          </h4>

          {/* Sơ đồ phân khu thực tế */}
          <div className="lp-showcase-sectors">
            {isOutdoor ? (
              <>
                <div className="lp-sector-item">
                  <span className="lp-sector-badge car">Ô tô</span>
                  <div className="lp-sector-desc">
                    <strong>Khu A & Khu B</strong>
                    <span>20 ô đỗ ngoài trời mặt sân (A01–A10, B01–B10)</span>
                  </div>
                </div>
                <div className="lp-sector-item">
                  <span className="lp-sector-badge moto">Xe máy</span>
                  <div className="lp-sector-desc">
                    <strong>Khu MOTO</strong>
                    <span>20 vị trí xe máy liền kề cổng vào (M01–M20)</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="lp-sector-item">
                  <span className="lp-sector-badge moto">Tầng 1 (F1)</span>
                  <div className="lp-sector-desc">
                    <strong>Khu xe máy mặt đất</strong>
                    <span>Lối vào thông suốt, thuận tiện ra vào</span>
                  </div>
                </div>
                <div className="lp-sector-item">
                  <span className="lp-sector-badge car">Tầng 2 & 3 (F2–F3)</span>
                  <div className="lp-sector-desc">
                    <strong>200 ô tô trong nhà</strong>
                    <span>Lên tầng qua ram dốc, vạch sơn phân làn rộng</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mẫu vé vào cổng thực tế */}
          <div className="lp-showcase-specimen-ticket">
            <div className="lp-specimen-top">
              <span className="lp-specimen-status">
                <span className="lp-specimen-dot" />
                {isEn ? "VALID RESERVATION TICKET" : "VÉ VÀO CỔNG ĐÃ XÁC NHẬN"}
              </span>
              <span className="lp-specimen-lot">{isOutdoor ? "Bình Thạnh" : "Quận 1"}</span>
            </div>
            <div className="lp-specimen-body">
              <div className="lp-specimen-bay">
                <span>{isEn ? "Reserved Bay" : "Vị trí đỗ đã chọn"}</span>
                <strong>{isOutdoor ? "Khu A · Ô A-05" : "Tầng 2 (F2) · Ô B-08"}</strong>
                <small>{isOutdoor ? "Mặt đất ngoài trời" : "Trong nhà cao tầng"}</small>
              </div>
              <div className="lp-specimen-code">
                <QrCode size={36} />
              </div>
            </div>
            <div className="lp-specimen-footer">
              <span>{isEn ? "Scan at barrier gate for entry" : "Quét mã QR tại barrier cổng vào để mở thanh chắn"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Câu 2: Chính sách giữ chỗ 5 phút
  if (activeIndex === 1) {
    return (
      <div className="lp-faq-showcase-container" aria-live="polite">
        <div className="lp-faq-showcase-panel lp-showcase-hold" key="hold">
          <div className="lp-showcase-header">
            <span className="lp-showcase-badge lp-badge-orange">
              <Clock size={13} />
              {isEn ? "5-Minute Hold Policy" : "Chính sách giữ chỗ"}
            </span>
            <span className="lp-showcase-pill live-pill">{isEn ? "5 Minutes" : "5 phút giữ chỗ"}</span>
          </div>

          <h4 className="lp-showcase-title">
            {isEn ? "Temporary 5-Minute Hold Window" : "Bảo lưu vị trí trong 5 phút"}
          </h4>

          <div className="lp-showcase-timer-box">
            <div className="lp-timer-circle">
              <span className="lp-timer-value">05:00</span>
              <span className="lp-timer-sub">{isEn ? "COUNTDOWN" : "ĐẾM NGƯỢC"}</span>
            </div>
            <div className="lp-timer-info">
              <div className="lp-timer-info-row">
                <Clock size={14} className="text-blue" />
                <span>Khóa ô đỗ tạm thời cho riêng xe của bạn</span>
              </div>
              <div className="lp-timer-info-row">
                <ShieldCheck size={14} className="text-emerald" />
                <span>Hết 5 phút tự động hủy, không trừ tiền</span>
              </div>
              <div className="lp-timer-info-row">
                <CheckCircle2 size={14} className="text-emerald" />
                <span>Thanh toán xong vị trí được giữ suốt lịch đặt</span>
              </div>
            </div>
          </div>

          <div className="lp-showcase-policy-note">
            <p>
              {isEn
                ? "If you change your mind or do not pay, the spot is simply returned to the pool for other drivers."
                : "Nếu bạn đổi ý hoặc không thanh toán, hệ thống sẽ tự động hoàn trả chỗ đỗ mà không phát sinh bất kỳ khoản phí nào."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Câu 3: Phương thức thanh toán
  if (activeIndex === 2) {
    return (
      <div className="lp-faq-showcase-container" aria-live="polite">
        <div className="lp-faq-showcase-panel lp-showcase-payment" key="payment">
          <div className="lp-showcase-header">
            <span className="lp-showcase-badge lp-badge-blue">
              <CreditCard size={13} />
              {isEn ? "Payment Methods" : "Phương thức thanh toán"}
            </span>
            <span className="lp-showcase-pill">{isEn ? "Cashless & Cash" : "Tiền mặt & Chuyển khoản"}</span>
          </div>

          <h4 className="lp-showcase-title">
            {isEn ? "Accepted Payment Methods" : "Các hình thức thanh toán được hỗ trợ"}
          </h4>

          <div className="lp-showcase-payment-list">
            <div className="lp-payment-row">
              <QrCode size={18} className="chip-icon qr" />
              <div>
                <strong>Chuyển khoản QR qua Mobile Banking</strong>
                <span>Quét mã VNPAY-QR bằng app ngân hàng hoặc ví điện tử</span>
              </div>
            </div>
            <div className="lp-payment-row">
              <Banknote size={18} className="chip-icon cash" />
              <div>
                <strong>Tiền mặt tại cổng ra</strong>
                <span>Thanh toán trực tiếp cho nhân viên bảo vệ tại bốt kiểm soát</span>
              </div>
            </div>
            <div className="lp-payment-row">
              <ScanFace size={18} className="chip-icon ai" />
              <div>
                <strong>Nhận diện biển số (Vé tháng)</strong>
                <span>Camera tự động quét biển số xe để mở barie không cần dừng</span>
              </div>
            </div>
          </div>

          <div className="lp-showcase-receipt-strip">
            <CheckCircle2 size={15} />
            <span>Có xuất hóa đơn điện tử và biên lai lượt gửi xe đầy đủ</span>
          </div>
        </div>
      </div>
    );
  }

  // Trạng thái mặc định (khi chưa mở câu nào)
  return (
    <div className="lp-faq-showcase-container" aria-live="polite">
      <div className="lp-faq-showcase-panel lp-showcase-idle" key="idle">
        <div className="lp-showcase-header">
          <span className="lp-showcase-badge lp-badge-blue">
            <MapPin size={13} />
            {lotName}
          </span>
          <span className="lp-showcase-pill">
            {isOutdoor ? "Bãi ngoài trời" : "Tòa nhà 3 tầng"}
          </span>
        </div>

        <h4 className="lp-showcase-title">
          {isOutdoor
            ? "Thông tin gửi xe tại Bãi ngoài trời"
            : "Thông tin gửi xe tại Tòa nhà đỗ xe"}
        </h4>

        <p className="lp-showcase-desc">
          {isOutdoor
            ? "Bãi đỗ xe mặt đất gồm 20 ô tô (Khu A, Khu B) và 20 xe máy (Khu MOTO), lối vào cổng có rào chắn barie tự động."
            : "Tòa nhà 3 tầng với Tầng 1 dành cho xe máy, Tầng 2 và Tầng 3 dành cho 200 ô tô, lối lên xe qua ram dốc rộng rãi."}
        </p>

        <div className="lp-showcase-features">
          <div className="lp-showcase-feature-item">
            <Clock size={16} className="text-blue" />
            <div>
              <strong>Giờ vận hành</strong>
              <span>Mở cửa 24/7, có nhân viên an ninh trực bốt</span>
            </div>
          </div>
          <div className="lp-showcase-feature-item">
            <ShieldCheck size={16} className="text-emerald" />
            <div>
              <strong>Cam kết chỗ đỗ</strong>
              <span>Đặt chỗ trước được giữ đúng vị trí, không trùng xe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeFaq({ lots }: { lots: ParkingLot[] }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const text = (vi: string, en: string) => (isEn ? en : vi);
  const [lotId, setLotId] = useState("");
  const [open, setOpen] = useState<number | null>(0); // Mặc định mở câu 1
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
    setOpen(0);
    setAnswer(null);
    setLoading(false);
    return () => {
      requestId.current += 1;
    };
  }, [lotId, lang]);

  const selectedLot = lots.find((l) => l.id === lotId) || lots[0];
  const lotName = selectedLot?.name || (isEn ? "ParkMatrix Smart Facility" : "Bãi đỗ xe ParkMatrix");

  // Kiểm tra chính xác xem có phải bãi ngoài trời không
  const isOutdoorLot = Boolean(
    selectedLot?.code?.toUpperCase().includes("BT") ||
    selectedLot?.name?.toLowerCase().includes("bình thạnh")
  );

  const defaultAnswers = getDefaultAnswers(lotName, isEn, isOutdoorLot);

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
          <p>{text("Chọn bãi để xem hướng dẫn gửi xe thực tế tại điểm đến của bạn.", "Choose a lot to read its actual parking guidance.")}</p>
          <Link to="/faq" className="lp-text-link">
            {text("Đến trang trợ giúp", "Visit the help center")}
            <ArrowRight size={16} />
          </Link>

          {/* Khung minh họa trực quan đồng bộ ngữ cảnh với bãi và câu hỏi đang chọn */}
          <FaqVisualShowcase
            activeIndex={open}
            isEn={isEn}
            isOutdoor={isOutdoorLot}
            lotName={lotName}
          />
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
                      <span className="lp-faq-answer-badge">
                        <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                        {defaultItem.section}
                      </span>
                      <div className="lp-faq-answer-paragraphs">
                        {defaultItem.paragraphs.map((para, pIdx) => (
                          <p key={pIdx} className="lp-faq-answer-para">
                            {para}
                          </p>
                        ))}
                      </div>
                      <small className="lp-faq-answer-source">
                        ✓ {defaultItem.source}
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
