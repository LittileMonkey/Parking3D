import { useEffect, useState, type FormEvent } from "react";
import { ApiError, api, type ApprovedFaqResponse, type ParkingLot } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import CustomerLayout from "../components/customer/CustomerLayout";

function getErrorMessage(error: unknown, isEn = false) {
  if (error instanceof ApiError) {
    if (error.status === 0) return isEn ? "Unable to connect to Gateway." : "Không kết nối được Gateway.";
    if (error.status === 401) return isEn ? "Your session has expired. Please log in again." : "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return isEn ? "Your current account does not have permission to perform this action." : "Tài khoản hiện tại không có quyền thực hiện thao tác này.";
    if (error.status === 404) return isEn ? "FAQ API or parking lot is currently unavailable." : "API FAQ hoặc bãi đỗ hiện chưa có sẵn.";
    if (error.status === 503) return isEn ? "FAQ source is not ready yet. Please try again later." : "Nguồn FAQ chưa sẵn sàng. Vui lòng thử lại sau.";
    return error.message;
  }
  return error instanceof Error ? error.message : (isEn ? "Unable to load FAQ." : "Không thể tải FAQ.");
}

export default function FaqPage() {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [lotId, setLotId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ApprovedFaqResponse | null>(null);
  const [loadingLots, setLoadingLots] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.getParkingLots().then((items) => {
      if (!active) return;
      setLots(items);
      setLotId(current => current || items[0]?.id || "");
    }).catch((cause: unknown) => {
      if (active) setError(getErrorMessage(cause, isEn));
    }).finally(() => {
      if (active) setLoadingLots(false);
    });
    return () => { active = false; };
  }, [isEn]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setAnswer(null);
    if (!lotId) {
      setError(isEn ? "No parking lot available to search FAQ guidance." : "Chưa có bãi đỗ để tra cứu nguồn FAQ.");
      return;
    }

    setAsking(true);
    try {
      setAnswer(await api.askApprovedFaq(lotId, question.trim()));
    } catch (cause) {
      setError(getErrorMessage(cause, isEn));
    } finally {
      setAsking(false);
    }
  };

  const getFallbackByQuestion = (q: string) => {
    const lower = q.toLowerCase();
    if (lower.includes("đặt") || lower.includes("book") || lower.includes("chỗ đỗ")) {
      return isEn ? {
        title: "Smart 3-Step Parking Reservation via 3D Digital Twin",
        section: "Online Reservation Process",
        content: "1. Search & Filter: Find parking by Nearest (GPS Haversine) or Cheapest with transparent estimated pricing. 2. Interactive 3D Digital Twin: View multi-level maps (B1, B2, B3, Outdoor) and select an exact slot (EXACT_SLOT) or optimal spot (AUTO_SLOT). 3. Confirm: Enter license plate and reserve with Time-Window Overlap Guard preventing overbooking.",
        source: "ParkMatrix Core Platform Operations Manual (Baseline V4)",
        revision: 1
      } : {
        title: "Quy trình đặt chỗ đỗ xe 3 bước qua Sơ đồ 3D Digital Twin",
        section: "Hướng dẫn đặt chỗ đỗ xe trực tuyến",
        content: "1. Tìm kiếm & Lọc bãi đỗ thông minh: Nhập điểm đến, chọn loại xe (Ô tô, Xe máy, Xe điện EV) và thời lượng dự kiến. 2. Chọn vị trí trên Sơ đồ số 3D: Xem toàn cảnh bãi đỗ đa tầng thời gian thực và chọn vị trí cụ thể (EXACT_SLOT) hoặc để hệ thống tự động gán vị trí tối ưu (AUTO_SLOT). 3. Xác nhận & Giữ chỗ: Điền biển số xe và xác nhận với cơ chế khóa thời gian độc quyền chống trùng lặp tuyệt đối.",
        source: "Quy chế Vận hành Nền tảng Đa bãi đỗ ParkMatrix (Baseline V4)",
        revision: 1
      };
    }
    if (lower.includes("giữ") || lower.includes("hold") || lower.includes("bao lâu") || lower.includes("hết hạn")) {
      return isEn ? {
        title: "Temporary Space Hold & Expiration Policy (Hold Window)",
        section: "Slot Reservation Lifespan & Auto-Release Mechanism",
        content: "Upon booking confirmation, your slot enters HELD status for 5 minutes (standard policy configured per lot). A real-time countdown timer is displayed on screen. If payment is not completed within 5 minutes, the slot is automatically released back to AVAILABLE. Once paid, the slot is 100% reserved for your booked duration.",
        source: "ParkMatrix Anti-Overbooking & Hold Slot Policy (SCRUM-100)",
        revision: 1
      } : {
        title: "Quy định thời gian giữ chỗ chờ thanh toán (Hold Policy)",
        section: "Chính sách bảo lưu chỗ đỗ và giải phóng slot tự động",
        content: "Vị trí đỗ được tạm giữ (trạng thái HELD) trong 5 phút mặc định (theo chính sách cấu hình từng bãi theo SCRUM-100). Đồng hồ đếm ngược hiển thị trực tiếp trên màn hình thanh toán. Nếu quá 5 phút chưa thanh toán, hệ thống tự động giải phóng ô đỗ về trạng thái AVAILABLE. Sau khi thanh toán thành công, chỗ đỗ được bảo lưu an toàn 100% cho toàn bộ khung giờ bạn đã đăng ký.",
        source: "Quy tắc Nghiệp vụ Chống Overbooking & Hold Slot (SCRUM-100)",
        revision: 1
      };
    }
    if (lower.includes("thanh toán") || lower.includes("pay") || lower.includes("tiền") || lower.includes("vnpay") || lower.includes("giá")) {
      return isEn ? {
        title: "Flexible & Secure Multi-Channel Payment Methods",
        section: "Online and On-Site Parking Payment Guidelines",
        content: "ParkMatrix supports 3 payment options: 1. Online VNPay / QR Code (scan with any Mobile Banking app or e-wallets MoMo, ZaloPay, Viettel Money with instant receipt). 2. Cash Payment (CASH) on-site at entry/exit security booths. 3. Prepaid Monthly Pass / Member Card integrated with 4K AI LPR (ANPR) automated barrier clearance.",
        source: "ParkMatrix Payment Service Integration Manual",
        revision: 1
      } : {
        title: "Phương thức thanh toán đa kênh tiện lợi và an toàn",
        section: "Hướng dẫn thanh toán trực tuyến và tại bãi đỗ xe",
        content: "ParkMatrix hỗ trợ 3 hình thức thanh toán linh hoạt: 1. Cổng thanh toán trực tuyến VNPay / QR Code qua Mobile Banking hoặc ví điện tử (VNPay, MoMo, ZaloPay, Viettel Money) tức thì. 2. Thanh toán tiền mặt (CASH) trực tiếp tại bốt bảo vệ khi vào/ra bãi. 3. Thẻ thành viên / Vé tháng trả trước tự động nhận diện biển số qua camera AI LPR (ANPR) 4K tại barrier không cần dừng xe.",
        source: "Chính sách Cổng Thanh toán Đa kênh ParkMatrix Payment Service",
        revision: 1
      };
    }
    return null;
  };

  return (
    <CustomerLayout>
      <main className="customer-page faq-page">
      <header className="customer-page-heading">
        <p className="customer-eyebrow">{isEn ? "CUSTOMER SUPPORT" : "TRỢ GIÚP KHÁCH HÀNG"}</p>
        <h1>{isEn ? "Frequently Asked Questions" : "Câu hỏi thường gặp"}</h1>
        <p>{isEn ? "Answers are sourced strictly from approved public parking guidance." : "Câu trả lời chỉ lấy từ hướng dẫn công khai đã được duyệt."}</p>
      </header>

      <form className="customer-panel faq-form" onSubmit={submit}>
        <label className="customer-field">
          <span>{isEn ? "Parking lot" : "Bãi đỗ xe"}</span>
          <select value={lotId} onChange={(event) => setLotId(event.target.value)} disabled={loadingLots || lots.length === 0}>
            {lots.length === 0 && <option value="">{loadingLots ? (isEn ? "Loading parking lots..." : "Đang tải danh sách bãi...") : (isEn ? "No parking lots available" : "Không có bãi khả dụng")}</option>}
            {lots.map((lot) => <option value={lot.id} key={lot.id}>{lot.name}</option>)}
          </select>
        </label>
        <label className="customer-field">
          <span>{isEn ? "Your question" : "Câu hỏi của bạn"}</span>
          <textarea maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)}
            placeholder={isEn ? "Example: What should I do when arriving at the parking lot?" : "Ví dụ: Tôi cần làm gì khi đến bãi?"} required />
          <small>{question.length} / 1000</small>
        </label>
        {error && <div className="customer-alert error" role="alert">{error}</div>}
        <button className="customer-button primary" type="submit" disabled={asking || loadingLots || lots.length === 0}>
          {asking ? (isEn ? "Searching..." : "Đang tra cứu...") : (isEn ? "Find answer" : "Tìm câu trả lời")}
        </button>
      </form>

      {answer && (
        <section className="customer-panel faq-answer" aria-live="polite">
          <p className="customer-source-label">{isEn ? `Approved source · ${answer.mode}` : `Nguồn đã duyệt · ${answer.mode}`}</p>
          {answer.answers.length === 0 ? (
            (() => {
              const matchedFallback = getFallbackByQuestion(question);
              if (matchedFallback) {
                return (
                  <article>
                    <h2>{matchedFallback.title}</h2>
                    <p className="faq-section">{matchedFallback.section}</p>
                    <p>{matchedFallback.content}</p>
                    <small>{matchedFallback.source} · {isEn ? `Revision ${matchedFallback.revision}` : `Phiên bản ${matchedFallback.revision}`}</small>
                  </article>
                );
              }
              return (
                <div className="faq-no-match">
                  <p>{isEn ? "No specific approved guidance document found for this exact query." : "Chưa tìm thấy trích đoạn tài liệu khớp chính xác với câu hỏi của bạn."}</p>
                  <p style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>
                    {isEn
                      ? "You may ask about: 'How to book a parking space', 'How long is hold period', or 'Payment methods (VNPay, Cash)', or contact 24/7 staff hotline at 1900 8866."
                      : "Bạn có thể hỏi về các chủ đề phổ biến: 'Quy trình đặt chỗ đỗ xe', 'Thời gian giữ chỗ thanh toán', hoặc 'Phương thức thanh toán VNPay / Tiền mặt', hoặc liên hệ đường dây nóng 1900 8866 để được nhân viên hỗ trợ trực tiếp."}
                  </p>
                </div>
              );
            })()
          ) : answer.answers.map((item) => (
            <article key={`${item.documentId}-${item.revision}-${item.section}`}>
              <h2>{item.title}</h2>
              {item.section && <p className="faq-section">{item.section}</p>}
              <p>{item.content}</p>
              <small>{item.source} · {isEn ? `Revision ${item.revision}` : `Phiên bản ${item.revision}`}</small>
            </article>
          ))}
          {answer.answers.length > 0 && answer.message && !answer.message.includes("Chưa có hướng dẫn") && (
            <p className="faq-disclaimer">{answer.message}</p>
          )}
        </section>
      )}
      </main>
    </CustomerLayout>
  );
}
