import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { api, type ApprovedFaqResponse, type ParkingLot } from "../../services/api";

export default function HomeFaq({ lots }: { lots: ParkingLot[] }) {
  const { lang } = useLanguage();
  const text = (vi: string, en: string) => lang === "en" ? en : vi;
  const [lotId, setLotId] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [answer, setAnswer] = useState<ApprovedFaqResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const questions = lang === "en"
    ? ["How do I book a parking space?", "How long is a parking space held for payment?", "Which payment methods can I use?"]
    : ["Tôi đặt chỗ đỗ xe như thế nào?", "Chỗ đỗ được giữ bao lâu để thanh toán?", "Tôi có thể thanh toán bằng cách nào?"];

  useEffect(() => { setLotId(lots[0]?.id ?? ""); }, [lots]);
  useEffect(() => {
    requestId.current += 1;
    setOpen(null); setAnswer(null); setError(""); setLoading(false);
    return () => { requestId.current += 1; };
  }, [lotId, lang]);

  const toggle = async (index: number) => {
    const id = ++requestId.current;
    setAnswer(null); setError("");
    if (open === index) { setOpen(null); setLoading(false); return; }
    setOpen(index);
    if (!lotId) return;
    setLoading(true);
    try {
      const result = await api.askApprovedFaq(lotId, questions[index]);
      if (requestId.current === id) setAnswer(result);
    } catch {
      if (requestId.current === id) setError(text("Chưa thể tải câu trả lời. Bạn có thể thử lại hoặc đến trang trợ giúp.", "We couldn't load the answer. Try again or visit the help page."));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  };

  return (
    <section className="lp-faq-section" id="questions"><div className="lp-container lp-section lp-faq-grid">
      <div className="lp-faq-intro"><p className="lp-eyebrow">{text("GIẢI ĐÁP TRƯỚC HÀNH TRÌNH", "BEFORE YOU GO")}</p><h2>{text("Bạn hỏi, ParkMatrix giải đáp.", "A little help for your journey.")}</h2><p>{text("Chọn bãi để xem hướng dẫn đã được duyệt cho điểm đến của bạn.", "Choose a lot to read its approved parking guidance.")}</p><Link to="/faq" className="lp-text-link">{text("Đến trang trợ giúp", "Visit the help center")}<ArrowRight size={16} /></Link></div>
      <div className="lp-faq-list"><label className="lp-field" htmlFor="home-faq-lot"><span>{text("Hướng dẫn tại bãi", "Guidance for this lot")}</span><select id="home-faq-lot" value={lotId} onChange={event => setLotId(event.target.value)} disabled={!lots.length}>{!lots.length && <option value="">{text("Chưa tải được danh sách bãi", "Parking lots are unavailable")}</option>}{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></label>
        {questions.map((question, index) => <article className="lp-faq-item" key={question}><h3><button type="button" aria-expanded={open === index} aria-controls={`home-faq-answer-${index}`} onClick={() => void toggle(index)}>{question}<ChevronDown size={18} /></button></h3><div id={`home-faq-answer-${index}`} hidden={open !== index} className="lp-faq-answer" aria-live="polite">
          {!lotId ? <p>{text("Hướng dẫn sẽ hiển thị khi danh sách bãi khả dụng. Bạn có thể mở trang trợ giúp để thử lại.", "Guidance will be available once parking lots load. Visit the help page to try again.")}</p> : loading ? <p role="status">{text("Đang tìm câu trả lời…", "Finding your answer…")}</p> : error ? <p role="alert">{error}</p> : answer && <>{answer.answers.map(item => <div key={`${item.documentId}-${item.revision}-${item.section}`}><p>{item.content}</p><small>{item.source} · {text("Phiên bản", "Revision")} {item.revision}</small></div>)}{answer.message && <p>{answer.message}</p>}</>}
        </div></article>)}
      </div>
    </div></section>
  );
}
