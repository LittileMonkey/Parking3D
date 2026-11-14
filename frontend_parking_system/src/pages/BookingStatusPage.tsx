import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import BookingRefunds from "../components/customer/BookingRefunds";
import BookingQrTicket from "../components/customer/BookingQrTicket";
import BookingSteps from "../components/customer/BookingSteps";
import CustomerLayout from "../components/customer/CustomerLayout";
import { api, type Payment, type VnPayReturnResult } from "../services/api";
import { rememberPaymentReturn } from "../services/paymentReturnContext";
import { remainingHoldSeconds } from "../services/bookingHold";
import { useAuth } from "../context/AuthContext";
import { useIdempotencyKey } from "../hooks/useIdempotencyKey";
import { bookingError, useBookingConfirmation } from "../hooks/useBookingConfirmation";
import type { ConfirmationPreview } from "./bookingPreview";
import "./Booking.css";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Xe đã vào bãi",
  COMPLETED: "Đã hoàn tất", CANCELLED: "Đã hủy", EXPIRED: "Đã hết hạn", NO_SHOW: "Quá hạn đến bãi",
};
const money = (amount: number, currency = "VND") => new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const methodLabel = (method: string) => method.toUpperCase() === "CASH" ? "Tiền mặt tại bãi" : method.toUpperCase() === "VNPAY" ? "VNPay" : method;

export default function BookingStatusPage({ bookingIdOverride, returnResult, returnError }: {
  bookingIdOverride?: string;
  returnResult?: VnPayReturnResult;
  returnError?: string;
}) {
  const { bookingId: routeId = "" } = useParams();
  const [params] = useSearchParams();
  const previewKind = import.meta.env.DEV && routeId === "preview" && ["success", "cash", "processing", "failed", "expired"].includes(params.get("preview") ?? "") ? params.get("preview") : null;
  const preview = Boolean(previewKind);
  const [previewData, setPreviewData] = useState<ConfirmationPreview | null>(null);
  useEffect(() => {
    let active = true;
    setPreviewData(null);
    if (previewKind) void import("./bookingPreview").then(module => { if (active) setPreviewData(module.getPreviewConfirmation(previewKind, params)); });
    return () => { active = false; };
  }, [previewKind, params]);
  const bookingId = bookingIdOverride ?? routeId;
  const { isAuthenticated } = useAuth();
  const live = useBookingConfirmation(bookingId, isAuthenticated && !preview);
  const booking = preview ? previewData?.booking ?? null : live.booking;
  const payment = preview ? previewData?.payment ?? null : live.payment;
  const receivedReceipt = preview ? previewData?.receipt ?? null : live.receipt;
  const receipt = receivedReceipt?.paymentId === payment?.paymentId ? receivedReceipt : null;
  const { error, paymentError: statusError, refreshing, refresh, retry } = live;
  const loading = preview ? !previewData : live.loading;
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

  useEffect(() => {
    window.scrollTo(0, 0);
    setCreatedPayment(null); setPaymentError(""); setCancellation(null); setCancelError(""); setCancelReason("");
    failedPaymentRef.current = "";
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
    if (!preview && status === "CANCELLED") {
      api.getBookingCancellation(bookingId).then(value => { if (active) setCancellation(value); })
        .catch(cause => { if (active) setCancelError(bookingError(cause)); });
    }
    return () => { active = false; };
  }, [bookingId, status, preview]);

  async function beginPayment(method: "CASH" | "VNPAY") {
    if (preview || paymentInFlight.current || !pending || holdExpired || paid || awaitingPayment || refreshing || statusError) return;
    paymentInFlight.current = true; setCreating(method); setPaymentError("");
    try {
      const result = method === "CASH" ? await api.createCashPayment(bookingId, paymentKey) : await api.createVnPayPayment(bookingId, `${paymentKey}-vnpay`);
      if (method === "VNPAY") {
        if (!result.paymentUrl) throw new Error("Chưa có liên kết thanh toán. Kiểm tra trạng thái trước khi thử lại.");
        // VNPay's transaction reference is an attempt ID, not a booking ID.
        // Retain only short-lived identifiers to reopen the correct owner-scoped ticket.
        rememberPaymentReturn(result.paymentUrl, bookingId, result.id, sessionStorage);
        setCreatedPayment(result);
        window.location.assign(new URL(result.paymentUrl).href);
      } else { setCreatedPayment(result); await refresh(); }
    } catch (cause) {
      setPaymentError(bookingError(cause));
      // A lost response can still mean a payment was created. Re-read before
      // permitting another click; retries retain the same idempotency key.
      await refresh();
    } finally { paymentInFlight.current = false; setCreating(null); }
  }
  async function cancelBooking() {
    if (preview || cancelling || !cancelReason.trim()) return;
    setCancelling(true); setCancelError("");
    try { setCancellation(await api.cancelBooking(bookingId, cancelReason.trim())); await refresh(); }
    catch (cause) { setCancelError(bookingError(cause)); }
    finally { setCancelling(false); }
  }

  const loginTo = `/login?${new URLSearchParams({ returnTo: `/bookings/${encodeURIComponent(bookingId)}` })}`;
  if (!isAuthenticated && !preview) return <CustomerLayout booking><main className="customer-page booking-flow-page"><section className="customer-panel booking-auth-needed"><ShieldCheck size={36} /><h1>Đăng nhập để xem vé của bạn</h1><p>Thông tin đặt chỗ, biên lai và mã QR chỉ hiển thị cho tài khoản có quyền.</p><Link className="customer-button primary" to={loginTo}>Đăng nhập & xem vé<ArrowRight size={16} /></Link></section></main></CustomerLayout>;

  const amount = receipt?.totalAmount ?? payment?.totalAmount;
  const currency = receipt?.currency ?? payment?.currency ?? "VND";
  const paymentMethod = receipt?.paymentMethod ?? payment?.paymentMethod ?? createdPayment?.method;

  return <CustomerLayout booking preview={preview}><main className="customer-page booking-flow-page booking-status-page">
    {preview && <><div className="booking-preview-banner" role="note"><div><strong>Xem thử kết quả thanh toán</strong><p>Thông tin, thanh toán và QR đều là minh họa. QR này không sử dụng tại cổng và không tạo giao dịch thật.</p></div><Link className="booking-preview-exit" to="/booking?preview=1">Quay về chọn bãi mẫu</Link></div><nav className="booking-preview-scenarios" aria-label="Trạng thái xem thử">{[["success", "Thành công"], ["cash", "Tiền mặt đã xác nhận"], ["processing", "Đang đồng bộ"], ["failed", "Thất bại"], ["expired", "Hết hạn"]].map(([value, label]) => { const query = new URLSearchParams(params); query.set("preview", value); return <Link key={value} aria-current={previewKind === value ? "page" : undefined} to={`/bookings/preview?${query}`}>{label}</Link>; })}</nav></>}
    <Link className="booking-back-link" to="/account"><ArrowLeft size={16} />Xe & đặt chỗ của tôi</Link>
    <BookingSteps current={3} />
    {loading && <div className="customer-panel customer-empty" role="status">Đang kiểm tra đặt chỗ và thanh toán…</div>}
    {error && <div className="customer-alert error" role="alert">{error}<button className="customer-button secondary" onClick={retry}>Thử lại</button>{error.includes("đăng nhập") && <Link to={loginTo}>Đăng nhập lại</Link>}</div>}
    {booking && <>
      {confirmed ? <section className="booking-success-panel" aria-live="polite"><span className="booking-outcome-icon"><CheckCircle2 size={34} /></span><div><p className="customer-eyebrow">HẸN GẶP BẠN TẠI BÃI ĐỖ</p><h1>{paid ? "Thanh toán thành công!" : "Đặt chỗ đã được xác nhận"}</h1><p>Chỗ đỗ của bạn đã được xác nhận. Kiểm tra thông tin và xuất trình mã QR khi đến bãi.</p></div></section>
        : reconciling ? <section className="booking-reconciling-panel" role="status"><Clock3 size={30} /><div><h1>Đang xác nhận đặt chỗ</h1><p>{paid ? "Đã nhận thanh toán." : "VNPay đã phản hồi giao dịch thành công."} Chúng tôi đang đồng bộ chỗ đỗ và sẽ hiển thị QR sau khi hoàn tất. Vui lòng không thanh toán lại.</p></div></section>
        : terminal ? <section className="booking-terminal-panel" role="status"><TriangleAlert size={30} /><div><h1>{statusLabels[status]}</h1><p>{paid ? "Giao dịch đã được ghi nhận nhưng đặt chỗ không còn hiệu lực. Kiểm tra biên lai và điều kiện hoàn tiền bên dưới." : "Đặt chỗ này không thể dùng để vào bãi. Bạn có thể chọn khung giờ hoặc bãi đỗ khác."}</p><Link to="/booking">Tìm chỗ đỗ khác<ArrowRight size={15} /></Link></div></section>
        : <header className="customer-page-heading"><p className="customer-eyebrow">{pending ? "HOÀN TẤT ĐẶT CHỖ" : "VÉ ĐỖ XE CỦA BẠN"}</p><h1>{pending ? "Thanh toán đặt chỗ" : statusLabels[status] ?? "Thông tin đặt chỗ"}</h1><p>{pending ? "Chỗ đang được giữ tạm. Hoàn tất thanh toán trước thời hạn để nhận mã QR vào bãi." : "Thông tin được cập nhật theo trạng thái lượt đỗ xe."}</p></header>}
      {returnError && <div className="customer-alert warning" role="alert">{returnError} Thông tin bên dưới được kiểm tra lại theo đặt chỗ của bạn.</div>}
      {returnResult?.isSuccess === false && !paid && <div className="customer-alert error" role="alert">{returnResult.message}</div>}
      <div className={`booking-confirmation-layout${confirmed ? " has-qr" : ""}`}>
        <section className="customer-panel booking-ticket">
          <div className="booking-status-heading"><div><p className="customer-eyebrow">MÃ ĐẶT CHỖ · {booking.bookingCode}</p><h2>{booking.lotName}</h2></div><span className={`booking-status-badge ${status.toLowerCase()}`}>{statusLabels[status] ?? status}</span></div>
          <dl className="booking-facts">
            <div><dt>Ô đỗ</dt><dd>{booking.slotCode || "Đang xác nhận vị trí"}</dd></div><div><dt>Phương tiện</dt><dd>{booking.vehicleType.toUpperCase() === "CAR" ? "Ô tô" : booking.vehicleType.toUpperCase() === "MOTORBIKE" ? "Xe máy" : booking.vehicleType}{booking.plateSnapshot && <small>{booking.plateSnapshot}</small>}</dd></div>
            <div><dt>Vào bãi</dt><dd>{date(booking.startsAt)}</dd></div><div><dt>Rời bãi dự kiến</dt><dd>{date(booking.endsAt)}</dd></div>
            <div><dt>Thời lượng dự kiến</dt><dd>{Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60000)} phút</dd></div><div><dt>Hạn đến check-in</dt><dd>{booking.arrivalDeadline ? date(booking.arrivalDeadline) : "Theo quy định của bãi"}</dd></div>
          </dl>
          <section className={`booking-payment-summary${paid ? " is-paid" : ""}`}>
            <div><span>{paid ? "Số tiền đã thanh toán" : "Tổng phí ước tính"}</span><strong className={paid ? "booking-paid-amount" : ""}>{paid ? typeof amount === "number" && Number.isFinite(amount) ? money(amount, currency) : "Đang cập nhật" : typeof booking.estimatedAmount === "number" ? money(booking.estimatedAmount) : "Chưa có giá"}</strong></div>
            {paid && <span className="booking-paid-badge"><Check size={14} />Đã thanh toán</span>}
          </section>
          {(payment || receipt) && <dl className="booking-transaction-facts"><div><dt>Phương thức</dt><dd>{paymentMethod ? methodLabel(paymentMethod) : "Đang cập nhật"}</dd></div>{receipt && <><div><dt>Mã biên lai</dt><dd>{receipt.receiptNumber}</dd></div><div><dt>Thanh toán lúc</dt><dd>{date(receipt.paidAt)}</dd></div></>}{(receipt?.bankTransactionNo || (returnResult?.isSuccess && returnResult.transactionNo)) && <div><dt>Mã giao dịch ngân hàng</dt><dd>{receipt?.bankTransactionNo || returnResult?.transactionNo}</dd></div>}</dl>}
          {statusError && <p className="customer-help-text" role="status">Chưa tải được đầy đủ thông tin thanh toán/biên lai. {statusError}</p>}
          {pending && !paid && <div className="booking-hold-note" role="status"><Clock3 size={18} /><div>{remaining === null ? "Đang kiểm tra thời hạn giữ chỗ" : remaining === 0 ? "Đã qua thời hạn giữ chỗ" : `Giữ chỗ còn ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}<span>{remaining === 0 ? "Đang kiểm tra trạng thái cuối cùng. Vui lòng không thanh toán lại." : "Hoàn tất thanh toán trong thời gian này để nhận vé vào bãi."}</span></div></div>}
          {pending && !reconciling && !holdExpired && <section className="booking-payment-options">
            <h3>{paymentFailed ? "Thanh toán chưa hoàn tất" : "Chọn cách thanh toán"}</h3>
            {awaitingPayment ? <p role="status">{(payment?.paymentMethod ?? createdPayment?.method) === "CASH" ? "Đã gửi yêu cầu thu tiền. Nhân viên tại bãi cần xác nhận đã nhận thanh toán; vé và QR sẽ tự cập nhật sau đó." : "Giao dịch VNPay đang chờ xác nhận. Đừng tạo giao dịch khác khi kết quả chưa rõ."}</p> : <><p>{paymentFailed ? "Giao dịch trước chưa thành công. Bạn có thể chọn phương thức và thử lại trong thời hạn giữ chỗ." : "Thanh toán trực tuyến bằng VNPay hoặc thanh toán với nhân viên tại bãi."}</p><button className="customer-button primary" disabled={preview || creating !== null || refreshing || Boolean(statusError)} onClick={() => void beginPayment("VNPAY")}><CreditCard size={17} />{creating === "VNPAY" ? "Đang mở VNPay…" : "Thanh toán qua VNPay"}<ArrowRight size={16} /></button><button className="customer-button secondary" disabled={preview || creating !== null || refreshing || Boolean(statusError)} onClick={() => void beginPayment("CASH")}>{creating === "CASH" ? "Đang gửi yêu cầu…" : "Thanh toán với nhân viên"}</button></>}
          </section>}
          {paymentError && <div className="customer-alert error" role="alert">{paymentError}</div>}
          {(pending || confirmed) && <details className="booking-cancel-section"><summary>Hủy đặt chỗ</summary><p>Điều kiện hoàn tiền phụ thuộc chính sách bãi và thời điểm hủy. Hủy đặt chỗ không đồng nghĩa đã nhận tiền hoàn.</p><label>Lý do hủy<textarea value={cancelReason} maxLength={2000} onChange={event => setCancelReason(event.target.value)} disabled={preview || cancelling} /></label><button className="customer-button secondary" disabled={preview || cancelling || !cancelReason.trim()} onClick={() => void cancelBooking()}>{cancelling ? "Đang hủy…" : "Xác nhận hủy đặt chỗ"}</button></details>}
          {cancellation && <p role="status">{cancellation.refund_eligible ? "Đủ điều kiện xét hoàn tiền. Gửi yêu cầu trong phần hoàn tiền bên dưới." : "Đặt chỗ không đủ điều kiện hoàn tiền theo chính sách hiện tại."}</p>}
          {!preview && ["CANCELLED", "EXPIRED"].includes(status) && <BookingRefunds key={bookingId} bookingId={bookingId} />}
          {cancelError && <p role="alert">{cancelError}</p>}
          <div className="booking-ticket-actions"><button className="customer-button secondary booking-refresh-button" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={15} />{refreshing ? "Đang cập nhật…" : "Kiểm tra trạng thái"}</button><Link to="/account">Xem lịch sử đặt chỗ<ArrowRight size={15} /></Link></div>
        </section>
        {confirmed && <BookingQrTicket key={bookingId} bookingId={bookingId} bookingCode={booking.bookingCode} enabled={!error} sample={preview ? previewData?.qr : undefined} />}
      </div>
    </>}
  </main></CustomerLayout>;
}
