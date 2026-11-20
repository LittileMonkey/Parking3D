import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck, TriangleAlert, QrCode, ExternalLink, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import BookingRefunds from "../components/customer/BookingRefunds";
import BookingQrTicket from "../components/customer/BookingQrTicket";
import BookingSteps from "../components/customer/BookingSteps";
import CustomerLayout from "../components/customer/CustomerLayout";
import { api, type Payment, type VnPayReturnResult, type PaymentQrResult } from "../services/api";
import { rememberPaymentReturn } from "../services/paymentReturnContext";
import { remainingHoldSeconds } from "../services/bookingHold";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useIdempotencyKey } from "../hooks/useIdempotencyKey";
import { bookingError, useBookingConfirmation } from "../hooks/useBookingConfirmation";
import "./Booking.css";

const statusLabelsVi: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Xe đã vào bãi",
  COMPLETED: "Đã hoàn tất", CANCELLED: "Đã hủy", EXPIRED: "Đã hết hạn", NO_SHOW: "Quá hạn đến bãi",
};
const statusLabelsEn: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment", CONFIRMED: "Confirmed", CHECKED_IN: "Checked in",
  COMPLETED: "Completed", CANCELLED: "Cancelled", EXPIRED: "Expired", NO_SHOW: "No-show",
};
const money = (amount: number, currency = "VND", isEn = false) => new Intl.NumberFormat(isEn ? "en-US" : "vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const date = (value: string, isEn = false) => new Date(value).toLocaleString(isEn ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const methodLabel = (method: string, isEn = false) => method.toUpperCase() === "CASH" ? (isEn ? "Cash at parking lot" : "Tiền mặt tại bãi") : method.toUpperCase() === "VNPAY" ? "VNPay" : method;

export default function BookingStatusPage({ bookingIdOverride, returnResult, returnError }: {
  bookingIdOverride?: string;
  returnResult?: VnPayReturnResult;
  returnError?: string;
}) {
  const { bookingId: routeId = "" } = useParams();
  const bookingId = bookingIdOverride ?? routeId;
  const { isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const statusLabels = isEn ? statusLabelsEn : statusLabelsVi;
  const live = useBookingConfirmation(bookingId, isAuthenticated);
  const booking = live.booking;
  const payment = live.payment;
  const receivedReceipt = live.receipt;
  const receipt = receivedReceipt?.paymentId === payment?.paymentId ? receivedReceipt : null;
  const { error, paymentError: statusError, refreshing, refresh, retry } = live;
  const loading = live.loading;
  const { key: paymentKey, renewKey: renewPaymentKey } = useIdempotencyKey(`pay-${bookingId}`);
  const [creating, setCreating] = useState<"CASH" | "VNPAY" | null>(null);
  const paymentInFlight = useRef(false);
  const [createdPayment, setCreatedPayment] = useState<Payment | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const failedPaymentRef = useRef("");
  const [now, setNow] = useState(Date.now());
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancellation, setCancellation] = useState<{ refund_eligible: boolean; refund_status: string } | null>(null);
  const [cachedQr, setCachedQr] = useState<PaymentQrResult | null>(() => {
    try {
      const stored = sessionStorage.getItem(`vnpay_qr_${bookingId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as PaymentQrResult;
        if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now()) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [qrModalData, setQrModalData] = useState<PaymentQrResult | null>(null);
  const [qrCreating, setQrCreating] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setCreatedPayment(null); setPaymentError(""); setCancellation(null); setCancelError(""); setCancelReason(""); setQrModalData(null);
    failedPaymentRef.current = "";
    try {
      const stored = sessionStorage.getItem(`vnpay_qr_${bookingId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as PaymentQrResult;
        if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now()) {
          setCachedQr(parsed);
        } else {
          setCachedQr(null);
        }
      }
    } catch {}
  }, [bookingId]);
  const status = booking?.status.toUpperCase() ?? "";
  const paymentStatus = payment?.paymentStatus.toUpperCase() ?? "";
  const pending = status === "PENDING_PAYMENT";
  const confirmed = status === "CONFIRMED";
  const paid = paymentStatus === "SUCCESS";
  const reconciling = pending && (paid || returnResult?.isSuccess === true);
  const paymentFailed = ["FAILED", "CANCELLED"].includes(paymentStatus) || (returnResult?.isSuccess === false && returnResult.responseCode !== "97");
  const terminal = ["EXPIRED", "CANCELLED", "NO_SHOW"].includes(status);
  const remaining = remainingHoldSeconds(booking?.holdExpiresAt, now);
  const holdExpired = pending && remaining === 0;
  const awaitingPayment = paymentStatus === "PENDING" || createdPayment?.status.toUpperCase() === "PENDING";

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);
  useEffect(() => {
    if (!payment || !["FAILED", "CANCELLED"].includes(paymentStatus) || failedPaymentRef.current === payment.paymentId) return;
    failedPaymentRef.current = payment.paymentId;
    renewPaymentKey(); setCreatedPayment(null);
  }, [payment, paymentStatus, renewPaymentKey]);
  useEffect(() => {
    let active = true;
    if (status === "CANCELLED") {
      api.getBookingCancellation(bookingId).then(value => { if (active) setCancellation(value); })
        .catch(cause => { if (active) setCancelError(bookingError(cause, isEn)); });
    }
    return () => { active = false; };
  }, [bookingId, status, isEn]);

  async function beginPayment(method: "CASH" | "VNPAY") {
    if (paymentInFlight.current || !pending || holdExpired || paid || awaitingPayment || refreshing || statusError) return;
    paymentInFlight.current = true; setCreating(method); setPaymentError("");
    try {
      const result = method === "CASH" ? await api.createCashPayment(bookingId, paymentKey) : await api.createVnPayPayment(bookingId, `${paymentKey}-vnpay`);
      if (method === "VNPAY") {
        if (!result.paymentUrl) throw new Error(isEn ? "Payment link is not available yet. Please check status before retrying." : "Chưa có liên kết thanh toán. Kiểm tra trạng thái trước khi thử lại.");
        // VNPay's transaction reference is an attempt ID, not a booking ID.
        // Retain only short-lived identifiers to reopen the correct owner-scoped ticket.
        rememberPaymentReturn(result.paymentUrl, bookingId, result.id, sessionStorage);
        setCreatedPayment(result);
        window.location.assign(new URL(result.paymentUrl).href);
      } else { setCreatedPayment(result); await refresh(); }
    } catch (cause) {
      setPaymentError(bookingError(cause, isEn));
      // A lost response can still mean a payment was created. Re-read before
      // permitting another click; retries retain the same idempotency key.
      await refresh();
    } finally { paymentInFlight.current = false; setCreating(null); }
  }

  async function handlePayWithQr() {
    if (cachedQr && (!cachedQr.expiresAt || new Date(cachedQr.expiresAt).getTime() > Date.now())) {
      setQrModalData(cachedQr);
      return;
    }
    if (paymentInFlight.current || !pending || holdExpired || paid || refreshing || statusError) return;
    paymentInFlight.current = true;
    setQrCreating(true);
    setPaymentError("");
    try {
      const res = await api.createVnPayPaymentQr(bookingId, `${paymentKey}-vnpay-qr`);
      setQrModalData(res);
      setCachedQr(res);
      try {
        sessionStorage.setItem(`vnpay_qr_${bookingId}`, JSON.stringify(res));
      } catch {}
    } catch (cause) {
      setPaymentError(bookingError(cause, isEn));
    } finally {
      paymentInFlight.current = false;
      setQrCreating(false);
    }
  }
  async function cancelBooking() {
    if (cancelling || !cancelReason.trim()) return;
    setCancelling(true); setCancelError("");
    try { setCancellation(await api.cancelBooking(bookingId, cancelReason.trim())); await refresh(); }
    catch (cause) { setCancelError(bookingError(cause, isEn)); }
    finally { setCancelling(false); }
  }

  const loginTo = `/login?${new URLSearchParams({ returnTo: `/bookings/${encodeURIComponent(bookingId)}` })}`;
  if (!isAuthenticated) return <CustomerLayout booking><main className="customer-page booking-flow-page"><section className="customer-panel booking-auth-needed"><ShieldCheck size={36} /><h1>{isEn ? "Log in to view your ticket" : "Đăng nhập để xem vé của bạn"}</h1><p>{isEn ? "Booking details, receipts, and QR entry codes are only visible to authorized accounts." : "Thông tin đặt chỗ, biên lai và mã QR chỉ hiển thị cho tài khoản có quyền."}</p><Link className="customer-button primary" to={loginTo}>{isEn ? "Log in & view ticket" : "Đăng nhập & xem vé"}<ArrowRight size={16} /></Link></section></main></CustomerLayout>;

  const amount = receipt?.totalAmount ?? payment?.totalAmount;
  const currency = receipt?.currency ?? payment?.currency ?? "VND";
  const paymentMethod = receipt?.paymentMethod ?? payment?.paymentMethod ?? createdPayment?.method;

  return <CustomerLayout booking><main className="customer-page booking-flow-page booking-status-page">
    <Link className="booking-back-link" to="/account?tab=bookings"><ArrowLeft size={16} />{isEn ? "My bookings" : "Lịch sử đặt chỗ"}</Link>
    <BookingSteps current={3} />
    {loading && <div className="customer-panel customer-empty" role="status">{isEn ? "Checking booking and payment status…" : "Đang kiểm tra đặt chỗ và thanh toán…"}</div>}
    {error && <div className="customer-alert error" role="alert">{error}<button className="customer-button secondary" onClick={retry}>{isEn ? "Retry" : "Thử lại"}</button>{(error.includes("đăng nhập") || error.toLowerCase().includes("log in")) && <Link to={loginTo}>{isEn ? "Log in again" : "Đăng nhập lại"}</Link>}</div>}
    {booking && <>
      {confirmed ? <section className="booking-success-panel" aria-live="polite"><span className="booking-outcome-icon"><CheckCircle2 size={34} /></span><div><p className="customer-eyebrow">{isEn ? "SEE YOU AT THE PARKING LOT" : "HẸN GẶP BẠN TẠI BÃI ĐỖ"}</p><h1>{paid ? (isEn ? "Payment successful!" : "Thanh toán thành công!") : (isEn ? "Booking confirmed" : "Đặt chỗ đã được xác nhận")}</h1><p>{isEn ? "Your parking spot is confirmed. Review your details and present the QR code upon arrival." : "Chỗ đỗ của bạn đã được xác nhận. Kiểm tra thông tin và xuất trình mã QR khi đến bãi."}</p></div></section>
        : reconciling ? <section className="booking-reconciling-panel" role="status"><Clock3 size={30} /><div><h1>{isEn ? "Confirming your booking" : "Đang xác nhận đặt chỗ"}</h1><p>{paid ? (isEn ? "Payment received." : "Đã nhận thanh toán.") : (isEn ? "VNPay reported a successful transaction." : "VNPay đã phản hồi giao dịch thành công.")} {isEn ? "We are syncing your spot and will display your QR code shortly. Please do not pay again." : "Chúng tôi đang đồng bộ chỗ đỗ và sẽ hiển thị QR sau khi hoàn tất. Vui lòng không thanh toán lại."}</p></div></section>
        : terminal ? <section className="booking-terminal-panel" role="status"><TriangleAlert size={30} /><div><h1>{statusLabels[status]}</h1><p>{paid ? (isEn ? "Payment was recorded, but the booking is no longer active. Check your receipt and refund eligibility below." : "Giao dịch đã được ghi nhận nhưng đặt chỗ không còn hiệu lực. Kiểm tra biên lai và điều kiện hoàn tiền bên dưới.") : (isEn ? "This booking can no longer be used for entry. You can choose another time window or parking lot." : "Đặt chỗ này không thể dùng để vào bãi. Bạn có thể chọn khung giờ hoặc bãi đỗ khác.")}</p><Link to="/booking">{isEn ? "Find another parking spot" : "Tìm chỗ đỗ khác"}<ArrowRight size={15} /></Link></div></section>
        : <header className="customer-page-heading"><p className="customer-eyebrow">{pending ? (isEn ? "COMPLETE YOUR BOOKING" : "HOÀN TẤT ĐẶT CHỖ") : (isEn ? "YOUR PARKING TICKET" : "VÉ ĐỖ XE CỦA BẠN")}</p><h1>{pending ? (isEn ? "Booking payment" : "Thanh toán đặt chỗ") : statusLabels[status] ?? (isEn ? "Booking details" : "Thông tin đặt chỗ")}</h1><p>{pending ? (isEn ? "Your spot is temporarily held. Complete payment before the timer expires to receive your entry QR code." : "Chỗ đang được giữ tạm. Hoàn tất thanh toán trước thời hạn để nhận mã QR vào bãi.") : (isEn ? "Details are updated live according to your parking session status." : "Thông tin được cập nhật theo trạng thái lượt đỗ xe.")}</p></header>}
      {returnError && <div className="customer-alert warning" role="alert">{returnError} {isEn ? "The information below is verified directly against your booking." : "Thông tin bên dưới được kiểm tra lại theo đặt chỗ của bạn."}</div>}
      {returnResult?.isSuccess === false && !paid && <div className="customer-alert error" role="alert">{returnResult.message}</div>}
      <div className={`booking-confirmation-layout${confirmed ? " has-qr" : ""}`}>
        <section className="customer-panel booking-ticket">
          <div className="booking-status-heading"><div><p className="customer-eyebrow">{isEn ? `BOOKING CODE · ${booking.bookingCode}` : `MÃ ĐẶT CHỖ · ${booking.bookingCode}`}</p><h2>{booking.lotName}</h2></div><span className={`booking-status-badge ${status.toLowerCase()}`}>{statusLabels[status] ?? status}</span></div>
          <dl className="booking-facts">
            <div><dt>{isEn ? "Parking spot" : "Ô đỗ"}</dt><dd>{booking.slotCode || (isEn ? "Confirming spot" : "Đang xác nhận vị trí")}</dd></div><div><dt>{isEn ? "Vehicle" : "Phương tiện"}</dt><dd>{booking.vehicleType.toUpperCase() === "CAR" ? (isEn ? "Car" : "Ô tô") : booking.vehicleType.toUpperCase() === "EV" ? (isEn ? "Electric Car (EV)" : "Ô tô điện (EV)") : booking.vehicleType.toUpperCase() === "MOTORBIKE" ? (isEn ? "Motorbike" : "Xe máy") : booking.vehicleType}{booking.plateSnapshot && <small>{booking.plateSnapshot}</small>}</dd></div>
            <div><dt>{isEn ? "Check-in" : "Vào bãi"}</dt><dd>{date(booking.startsAt, isEn)}</dd></div><div><dt>{isEn ? "Expected exit" : "Rời bãi dự kiến"}</dt><dd>{date(booking.endsAt, isEn)}</dd></div>
            <div><dt>{isEn ? "Expected duration" : "Thời lượng dự kiến"}</dt><dd>{Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60000)} {isEn ? "mins" : "phút"}</dd></div><div><dt>{isEn ? "Check-in deadline" : "Hạn đến check-in"}</dt><dd>{booking.arrivalDeadline ? date(booking.arrivalDeadline, isEn) : (isEn ? "Per lot policy" : "Theo quy định của bãi")}</dd></div>
          </dl>
          <section className={`booking-payment-summary${paid ? " is-paid" : ""}`}>
            <div><span>{paid ? (isEn ? "Amount paid" : "Số tiền đã thanh toán") : (isEn ? "Estimated total fee" : "Tổng phí ước tính")}</span><strong className={paid ? "booking-paid-amount" : ""}>{paid ? typeof amount === "number" && Number.isFinite(amount) ? money(amount, currency, isEn) : (isEn ? "Updating" : "Đang cập nhật") : typeof booking.estimatedAmount === "number" ? money(booking.estimatedAmount, "VND", isEn) : (isEn ? "Price unavailable" : "Chưa có giá")}</strong></div>
            {paid && <span className="booking-paid-badge"><Check size={14} />{isEn ? "Paid" : "Đã thanh toán"}</span>}
          </section>
          {(payment || receipt) && <dl className="booking-transaction-facts"><div><dt>{isEn ? "Method" : "Phương thức"}</dt><dd>{paymentMethod ? methodLabel(paymentMethod, isEn) : (isEn ? "Updating" : "Đang cập nhật")}</dd></div>{receipt && <><div><dt>{isEn ? "Receipt no." : "Mã biên lai"}</dt><dd>{receipt.receiptNumber}</dd></div><div><dt>{isEn ? "Paid at" : "Thanh toán lúc"}</dt><dd>{date(receipt.paidAt, isEn)}</dd></div></>}{(receipt?.bankTransactionNo || (returnResult?.isSuccess && returnResult.transactionNo)) && <div><dt>{isEn ? "Bank transaction no." : "Mã giao dịch ngân hàng"}</dt><dd>{receipt?.bankTransactionNo || returnResult?.transactionNo}</dd></div>}</dl>}
          {statusError && <p className="customer-help-text" role="status">{isEn ? "Could not load full payment/receipt details." : "Chưa tải được đầy đủ thông tin thanh toán/biên lai."} {statusError}</p>}
          {pending && !paid && <div className="booking-hold-note" role="status"><Clock3 size={18} /><div>{remaining === null ? (isEn ? "Checking hold expiration" : "Đang kiểm tra thời hạn giữ chỗ") : remaining === 0 ? (isEn ? "Hold time expired" : "Đã qua thời hạn giữ chỗ") : (isEn ? `Hold remaining ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : `Giữ chỗ còn ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`)}<span>{remaining === 0 ? (isEn ? "Checking final status. Please do not pay again." : "Đang kiểm tra trạng thái cuối cùng. Vui lòng không thanh toán lại.") : (isEn ? "Complete payment within this window to receive your entry ticket." : "Hoàn tất thanh toán trong thời gian này để nhận vé vào bãi.")}</span></div></div>}
          {pending && !reconciling && !holdExpired && <section className="booking-payment-options">
            <h3>{paymentFailed ? (isEn ? "Payment incomplete" : "Thanh toán chưa hoàn tất") : (isEn ? "Choose payment method" : "Chọn cách thanh toán")}</h3>
            {awaitingPayment ? (
              <div style={{ background: "#f0f9ff", border: "1.5px solid #0284c7", borderRadius: 12, padding: "14px 16px", display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0369a1", fontWeight: 700, fontSize: 14 }}>
                  <Clock3 size={18} />
                  <span>{isEn ? "Payment in progress" : "Đơn hàng đang chờ thanh toán"}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                  {(payment?.paymentMethod ?? createdPayment?.method) === "CASH"
                    ? (isEn ? "Cash collection request sent. Parking staff will confirm payment at the counter." : "Đã gửi yêu cầu thu tiền mặt. Vui lòng thanh toán trực tiếp với nhân viên tại bãi xe.")
                    : (isEn ? "VietQR / VNPay code has been generated. You can reopen the QR code to scan, open the portal, or check payment status below." : "Mã VietQR / VNPay đã được tạo. Bạn có thể mở lại mã QR để quét thanh toán, mở cổng VNPay hoặc kiểm tra trạng thái vé.")}
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  <button
                    type="button"
                    className="customer-button primary"
                    style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}
                    disabled={qrCreating || refreshing}
                    onClick={() => void handlePayWithQr()}
                  >
                    <QrCode size={18} />
                    {qrCreating ? (isEn ? "Loading QR…" : "Đang mở mã...") : (isEn ? "⚡ Re-open VietQR / VNPay-QR" : "⚡ Mở lại mã VietQR / VNPay-QR")}
                  </button>

                  {(createdPayment?.paymentUrl || cachedQr?.paymentUrl) && (
                    <a
                      href={createdPayment?.paymentUrl || cachedQr?.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="customer-button secondary"
                      style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                    >
                      <ExternalLink size={15} />
                      {isEn ? "Open VNPay Portal" : "Mở cổng VNPay"}
                    </a>
                  )}

                  <button
                    type="button"
                    className="customer-button secondary"
                    disabled={refreshing}
                    onClick={() => void refresh()}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={15} />
                    {refreshing ? (isEn ? "Checking…" : "Đang kiểm tra…") : (isEn ? "Check status" : "Kiểm tra vé")}
                  </button>

                  <button
                    type="button"
                    className="customer-button secondary"
                    disabled={creating !== null}
                    onClick={() => void beginPayment("CASH")}
                    style={{ fontSize: 12 }}
                  >
                    {isEn ? "Pay cash instead" : "Đổi sang tiền mặt"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{paymentFailed ? (isEn ? "Previous transaction did not complete. You can choose a payment method and try again within the hold window." : "Giao dịch trước chưa thành công. Bạn có thể chọn phương thức và thử lại trong thời hạn giữ chỗ.") : (isEn ? "Pay online via VietQR, VNPay gateway, or pay with staff at the parking lot." : "Quét mã VietQR / VNPay-QR động (5 phút), cổng thanh toán VNPay hoặc thanh toán tiền mặt.")}</p>
                <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                  <button
                    className="customer-button primary"
                    style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    disabled={creating !== null || qrCreating || refreshing || Boolean(statusError)}
                    onClick={() => void handlePayWithQr()}
                  >
                    <QrCode size={18} />
                    {qrCreating
                      ? (isEn ? "Generating VietQR…" : "Đang tạo mã VietQR…")
                      : cachedQr
                        ? (isEn ? "View VietQR / VNPay-QR (5 mins)" : "⚡ Xem lại mã VietQR / VNPay-QR (5 phút)")
                        : (isEn ? "Pay via VietQR / VNPay-QR (5 mins)" : "⚡ Quét mã VietQR / VNPay-QR (Thanh toán 5 phút)")}
                    <ArrowRight size={16} />
                  </button>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="customer-button secondary"
                      style={{ flex: 1, minWidth: 160 }}
                      disabled={creating !== null || qrCreating || refreshing || Boolean(statusError)}
                      onClick={() => void beginPayment("VNPAY")}
                    >
                      <CreditCard size={16} />
                      {creating === "VNPAY" ? (isEn ? "Opening VNPay…" : "Đang mở VNPay…") : (isEn ? "VNPay Gateway" : "Cổng VNPay")}
                    </button>
                    <button
                      className="customer-button secondary"
                      style={{ flex: 1, minWidth: 160 }}
                      disabled={creating !== null || qrCreating || refreshing || Boolean(statusError)}
                      onClick={() => void beginPayment("CASH")}
                    >
                      {creating === "CASH" ? (isEn ? "Sending request…" : "Đang gửi…") : (isEn ? "Pay Cash at lot" : "Tiền mặt tại bãi")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>}
          {paymentError && <div className="customer-alert error" role="alert">{paymentError}</div>}
          {(pending || confirmed) && <details className="booking-cancel-section"><summary>{isEn ? "Cancel booking" : "Hủy đặt chỗ"}</summary><p>{isEn ? "Refund eligibility depends on lot policy and cancellation time. Cancelling a booking does not mean a refund has already been issued." : "Điều kiện hoàn tiền phụ thuộc chính sách bãi và thời điểm hủy. Hủy đặt chỗ không đồng nghĩa đã nhận tiền hoàn."}</p><label>{isEn ? "Cancellation reason" : "Lý do hủy"}<textarea value={cancelReason} maxLength={2000} onChange={event => setCancelReason(event.target.value)} disabled={cancelling} /></label><button className="customer-button secondary" disabled={cancelling || !cancelReason.trim()} onClick={() => void cancelBooking()}>{cancelling ? (isEn ? "Cancelling…" : "Đang hủy…") : (isEn ? "Confirm cancellation" : "Xác nhận hủy đặt chỗ")}</button></details>}
          {cancellation && paid && <p role="status" style={{ fontSize: 13, color: "#64748b", margin: "8px 0" }}>{cancellation.refund_eligible ? (isEn ? "Eligible for refund review. See details below." : "Đơn đủ điều kiện xét hoàn tiền theo chính sách bãi đỗ.") : (isEn ? "This booking is not eligible for a refund." : "Đơn không đủ điều kiện hoàn tiền theo quy định bãi.")}</p>}
          {["CANCELLED", "EXPIRED"].includes(status) && <BookingRefunds key={bookingId} bookingId={bookingId} />}
          {cancelError && <p role="alert">{cancelError}</p>}
          <div className="booking-ticket-actions"><button className="customer-button secondary booking-refresh-button" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={15} />{refreshing ? (isEn ? "Updating…" : "Đang cập nhật…") : (isEn ? "Check status" : "Kiểm tra trạng thái")}</button><Link to="/account?tab=bookings">{isEn ? "View booking history" : "Xem lịch sử đặt chỗ"}<ArrowRight size={15} /></Link></div>
        </section>
        {confirmed && <BookingQrTicket key={bookingId} bookingId={bookingId} bookingCode={booking.bookingCode} enabled={!error} />}
      </div>
    </>}

    {/* ─── VIETQR / VNPAY-QR DYNAMIC MODAL (POST /api/v1/payments/vnpay/create-qr) ─── */}
    {qrModalData && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán VietQR"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            maxWidth: 440,
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            overflow: "hidden",
            display: "grid",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <QrCode size={22} />
              <strong style={{ fontSize: 16 }}>Mã VietQR / VNPay-QR Động</strong>
            </div>
            <button
              type="button"
              onClick={() => setQrModalData(null)}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
              title="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: "20px", textAlign: "center", display: "grid", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Mở ứng dụng Mobile Banking hoặc ví VNPay để quét mã thanh toán. Mã có thời hạn hiệu lực <strong>5 phút</strong> theo chính sách giữ chỗ.
            </p>

            <div
              style={{
                display: "inline-flex",
                justifyContent: "center",
                padding: 14,
                background: "#f8fafc",
                borderRadius: 12,
                border: "2px dashed #0284c7",
                margin: "0 auto",
              }}
            >
              <QRCodeSVG
                value={qrModalData.qrPayload || qrModalData.paymentUrl}
                size={210}
                marginSize={2}
                title="Mã VietQR thanh toán"
              />
            </div>

            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "12px 16px", fontSize: 13, textAlign: "left", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Số tiền:</span>
                <strong style={{ color: "#0284c7", fontSize: 15 }}>{money(qrModalData.amount, qrModalData.currency, isEn)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Mã tham chiếu:</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{qrModalData.merchantTxnRef}</span>
              </div>
              {qrModalData.expiresAt && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Thời hạn:</span>
                  <span style={{ color: "#e11d48", fontWeight: 600 }}>{new Date(qrModalData.expiresAt).toLocaleTimeString("vi-VN")}</span>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
              {qrModalData.paymentUrl && (
                <a
                  href={qrModalData.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="customer-button primary"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <ExternalLink size={15} />
                  Mở cổng VNPay trong tab mới
                </a>
              )}
              <button
                type="button"
                className="customer-button secondary"
                onClick={async () => {
                  setQrModalData(null);
                  await refresh();
                }}
              >
                Tôi đã chuyển khoản xong (Kiểm tra vé)
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </main></CustomerLayout>;
}
