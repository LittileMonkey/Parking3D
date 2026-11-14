import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Clock3, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, type VnPayReturnResult } from "../services/api";
import { findPaymentReturn, type PaymentReturnContext } from "../services/paymentReturnContext";
import { useAuth } from "../context/AuthContext";
import CustomerLayout from "../components/customer/CustomerLayout";
import BookingStatusPage from "./BookingStatusPage";
import "./Booking.css";

export default function PaymentReturn() {
  const { search } = useLocation();
  const { isAuthenticated } = useAuth();
  const [result, setResult] = useState<VnPayReturnResult | null>(null);
  const [context, setContext] = useState<PaymentReturnContext | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setChecking(true); setResult(null); setError("");
    // This mapping only identifies the ticket. It never proves payment success.
    const txnRef = new URLSearchParams(search).get("vnp_TxnRef") ?? "";
    setContext(findPaymentReturn(txnRef, sessionStorage));
    if (!txnRef) {
      setError("Liên kết chưa có mã giao dịch VNPay. Mở lịch sử để kiểm tra đặt chỗ của bạn.");
      setChecking(false);
      window.clearTimeout(timeout);
      return;
    }
    api.verifyVnPayReturn(search, controller.signal).then(value => {
      if (active) setResult(value);
    }).catch(() => {
      if (active) setError("Chưa xác minh được phản hồi VNPay. Vui lòng kiểm tra trạng thái đặt chỗ trước khi thanh toán lại.");
    }).finally(() => { window.clearTimeout(timeout); if (active) setChecking(false); });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [search, revision]);

  if (!checking && context && isAuthenticated) {
    return <BookingStatusPage key={`${context.bookingId}:${search}`} bookingIdOverride={context.bookingId} returnResult={result ?? undefined} returnError={error || undefined} />;
  }
  const loginTo = `/login?${new URLSearchParams({ returnTo: `/payment-return${search}` })}`;
  return <CustomerLayout booking><main className="customer-page booking-flow-page booking-payment-return-page">
    <section className="customer-panel booking-return-card">
      <span className="booking-return-icon">{checking ? <Clock3 size={34} /> : error || result?.isSuccess === false ? <TriangleAlert size={34} /> : <ShieldCheck size={34} />}</span>
      <p className="customer-eyebrow">KẾT QUẢ GIAO DỊCH VNPAY</p>
      <h1>{checking ? "Đang kiểm tra thanh toán" : error ? "Chưa thể xác minh giao dịch" : result?.isSuccess ? "Đã nhận phản hồi từ VNPay" : result?.responseCode === "24" ? "Bạn đã hủy thanh toán" : "Thanh toán chưa hoàn tất"}</h1>
      <p role="status">{checking ? "Vui lòng chờ trong lúc chúng tôi kiểm tra kết quả và cập nhật vé của bạn." : error || result?.message}</p>
      {result?.isSuccess && <dl className="booking-return-facts"><div><dt>Số tiền VNPay báo nhận</dt><dd>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(result.amount)}</dd></div><div><dt>Ngân hàng</dt><dd>{result.bankCode || "Đang cập nhật"}</dd></div><div><dt>Mã giao dịch</dt><dd>{result.transactionNo || result.txnRef}</dd></div></dl>}
      {!checking && <>
        {!context && <p className="booking-return-help">Chưa tìm thấy liên kết đặt chỗ trong cửa sổ này. Mở lịch sử để kiểm tra đúng vé; QR sẽ được cấp khi đặt chỗ được xác nhận.</p>}
        <p className="booking-return-help">Vui lòng không thanh toán lại khi giao dịch trước vẫn đang được đối soát.</p>
        <div className="booking-return-actions"><Link className="customer-button primary" to={isAuthenticated ? "/account" : loginTo}>{isAuthenticated ? "Mở lịch sử đặt chỗ" : "Đăng nhập & xem vé"}<ArrowRight size={16} /></Link><button className="customer-button secondary" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Kiểm tra lại</button></div>
      </>}
    </section>
  </main></CustomerLayout>;
}
