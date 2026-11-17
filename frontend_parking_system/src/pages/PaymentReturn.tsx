import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Clock3, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, type VnPayReturnResult } from "../services/api";
import { findPaymentReturn, type PaymentReturnContext } from "../services/paymentReturnContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import CustomerLayout from "../components/customer/CustomerLayout";
import BookingStatusPage from "./BookingStatusPage";
import "./Booking.css";

export default function PaymentReturn() {
  const { search } = useLocation();
  const { isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const isEn = lang === "en";
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
      setError(isEn ? "The link is missing the VNPay transaction reference. Open your booking history to check your ticket." : "Liên kết chưa có mã giao dịch VNPay. Mở lịch sử để kiểm tra đặt chỗ của bạn.");
      setChecking(false);
      window.clearTimeout(timeout);
      return;
    }
    api.verifyVnPayReturn(search, controller.signal).then(value => {
      if (active) setResult(value);
    }).catch(() => {
      if (active) setError(isEn ? "Unable to verify VNPay response. Please check your booking status before paying again." : "Chưa xác minh được phản hồi VNPay. Vui lòng kiểm tra trạng thái đặt chỗ trước khi thanh toán lại.");
    }).finally(() => { window.clearTimeout(timeout); if (active) setChecking(false); });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [search, revision, isEn]);

  if (!checking && context && isAuthenticated) {
    return <BookingStatusPage key={`${context.bookingId}:${search}`} bookingIdOverride={context.bookingId} returnResult={result ?? undefined} returnError={error || undefined} />;
  }
  const loginTo = `/login?${new URLSearchParams({ returnTo: `/payment-return${search}` })}`;
  return <CustomerLayout booking><main className="customer-page booking-flow-page booking-payment-return-page">
    <section className="customer-panel booking-return-card">
      <span className="booking-return-icon">{checking ? <Clock3 size={34} /> : error || result?.isSuccess === false ? <TriangleAlert size={34} /> : <ShieldCheck size={34} />}</span>
      <p className="customer-eyebrow">{isEn ? "VNPAY TRANSACTION RESULT" : "KẾT QUẢ GIAO DỊCH VNPAY"}</p>
      <h1>{checking ? (isEn ? "Checking payment" : "Đang kiểm tra thanh toán") : error ? (isEn ? "Unable to verify transaction" : "Chưa thể xác minh giao dịch") : result?.isSuccess ? (isEn ? "VNPay response received" : "Đã nhận phản hồi từ VNPay") : result?.responseCode === "24" ? (isEn ? "Payment cancelled" : "Bạn đã hủy thanh toán") : (isEn ? "Payment incomplete" : "Thanh toán chưa hoàn tất")}</h1>
      <p role="status">{checking ? (isEn ? "Please wait while we verify the result and update your ticket." : "Vui lòng chờ trong lúc chúng tôi kiểm tra kết quả và cập nhật vé của bạn.") : error || result?.message}</p>
      {result?.isSuccess && <dl className="booking-return-facts"><div><dt>{isEn ? "Amount reported by VNPay" : "Số tiền VNPay báo nhận"}</dt><dd>{new Intl.NumberFormat(isEn ? "en-US" : "vi-VN", { style: "currency", currency: "VND" }).format(result.amount)}</dd></div><div><dt>{isEn ? "Bank" : "Ngân hàng"}</dt><dd>{result.bankCode || (isEn ? "Updating" : "Đang cập nhật")}</dd></div><div><dt>{isEn ? "Transaction no." : "Mã giao dịch"}</dt><dd>{result.transactionNo || result.txnRef}</dd></div></dl>}
      {!checking && <>
        {!context && <p className="booking-return-help">{isEn ? "Booking session was not found in this window. Open your booking history to check the ticket; QR code will be issued once confirmed." : "Chưa tìm thấy liên kết đặt chỗ trong cửa sổ này. Mở lịch sử để kiểm tra đúng vé; QR sẽ được cấp khi đặt chỗ được xác nhận."}</p>}
        <p className="booking-return-help">{isEn ? "Please do not submit another payment while the previous transaction is being reconciled." : "Vui lòng không thanh toán lại khi giao dịch trước vẫn đang được đối soát."}</p>
        <div className="booking-return-actions"><Link className="customer-button primary" to={isAuthenticated ? "/account?tab=bookings" : loginTo}>{isAuthenticated ? (isEn ? "Open booking history" : "Mở lịch sử đặt chỗ") : (isEn ? "Log in & view ticket" : "Đăng nhập & xem vé")}<ArrowRight size={16} /></Link><button className="customer-button secondary" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />{isEn ? "Check again" : "Kiểm tra lại"}</button></div>
      </>}
    </section>
  </main></CustomerLayout>;
}
