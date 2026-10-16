import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type ApprovedFaqResponse, type ParkingLot } from "../services/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Không kết nối được Gateway.";
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Tài khoản hiện tại không có quyền thực hiện thao tác này.";
    if (error.status === 404) return "API FAQ hoặc bãi đỗ hiện chưa có sẵn.";
    if (error.status === 503) return "Nguồn FAQ chưa sẵn sàng. Vui lòng thử lại sau.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Không thể tải FAQ.";
}

export default function FaqPage() {
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
      setLotId(items[0]?.id ?? "");
    }).catch((cause: unknown) => {
      if (active) setError(getErrorMessage(cause));
    }).finally(() => {
      if (active) setLoadingLots(false);
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setAnswer(null);
    if (!lotId) {
      setError("Chưa có bãi đỗ để tra cứu nguồn FAQ.");
      return;
    }

    setAsking(true);
    try {
      setAnswer(await api.askApprovedFaq(lotId, question.trim()));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setAsking(false);
    }
  };

  return (
    <main className="customer-page faq-page">
      <div className="customer-page-top">
        <Link to="/" className="customer-brand">Park<span>Matrix</span></Link>
        <nav aria-label="Điều hướng khách hàng"><Link to="/search">Tìm bãi</Link><Link to="/faq" aria-current="page">FAQ</Link><Link to="/login">Đăng nhập</Link></nav>
      </div>
      <header className="customer-page-heading">
        <p className="customer-eyebrow">TRỢ GIÚP KHÁCH HÀNG</p>
        <h1>Câu hỏi thường gặp</h1>
        <p>Câu trả lời chỉ lấy từ hướng dẫn công khai đã được duyệt.</p>
      </header>

      <form className="customer-panel faq-form" onSubmit={submit}>
        <label className="customer-field">
          <span>Bãi đỗ xe</span>
          <select value={lotId} onChange={(event) => setLotId(event.target.value)} disabled={loadingLots || lots.length === 0}>
            {lots.length === 0 && <option value="">{loadingLots ? "Đang tải danh sách bãi..." : "Không có bãi khả dụng"}</option>}
            {lots.map((lot) => <option value={lot.id} key={lot.id}>{lot.name}</option>)}
          </select>
        </label>
        <label className="customer-field">
          <span>Câu hỏi của bạn</span>
          <textarea maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ví dụ: Tôi cần làm gì khi đến bãi?" required />
          <small>{question.length} / 1000</small>
        </label>
        {error && <div className="customer-alert error" role="alert">{error}</div>}
        <button className="customer-button primary" type="submit" disabled={asking || loadingLots || lots.length === 0}>
          {asking ? "Đang tra cứu..." : "Tìm câu trả lời"}
        </button>
      </form>

      {answer && (
        <section className="customer-panel faq-answer" aria-live="polite">
          <p className="customer-source-label">Nguồn đã duyệt · {answer.mode}</p>
          {answer.answers.length === 0 ? (
            <p>{answer.message}</p>
          ) : answer.answers.map((item) => (
            <article key={`${item.documentId}-${item.revision}-${item.section}`}>
              <h2>{item.title}</h2>
              {item.section && <p className="faq-section">{item.section}</p>}
              <p>{item.content}</p>
              <small>{item.source} · Phiên bản {item.revision}</small>
            </article>
          ))}
          <p className="faq-disclaimer">{answer.message}</p>
        </section>
      )}
    </main>
  );
}
