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
            <p>{answer.message}</p>
          ) : answer.answers.map((item) => (
            <article key={`${item.documentId}-${item.revision}-${item.section}`}>
              <h2>{item.title}</h2>
              {item.section && <p className="faq-section">{item.section}</p>}
              <p>{item.content}</p>
              <small>{item.source} · {isEn ? `Revision ${item.revision}` : `Phiên bản ${item.revision}`}</small>
            </article>
          ))}
          <p className="faq-disclaimer">{answer.message}</p>
        </section>
      )}
      </main>
    </CustomerLayout>
  );
}
