import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ApiError, api, type BookingDetail, type Payment } from "../services/api";
import { remainingHoldSeconds } from "../services/bookingHold";
import { useAuth } from "../context/AuthContext";

function statusText(status: string) {
  const labels: Record<string, string> = {
    PENDING_PAYMENT: "Đang chờ thanh toán/xác nhận",
    CONFIRMED: "Đã xác nhận bởi hệ thống",
    CHECKED_IN: "Đã check-in",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
    EXPIRED: "Đã hết hạn",
    NO_SHOW: "Không đến",
  };
  return labels[status.toUpperCase()] ?? status;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Bạn không có quyền xem booking này. Chỉ chủ booking hoặc nhân viên được phân công mới có quyền truy cập.";
    if (error.status === 404) return "Không tìm thấy booking.";
    if (error.status === 409) return "Booking vừa thay đổi. Hãy tải lại trạng thái mới nhất.";
    if (error.status === 503) return "Dịch vụ booking/thanh toán chưa sẵn sàng. Hãy thử lại sau.";
    if (error.status === 0) return "Không kết nối được Gateway.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Không thể tải trạng thái booking.";
}

function holdTimeText(expiresAt: string | null | undefined, now: number) {
  const remainingSeconds = remainingHoldSeconds(expiresAt, now);
  if (remainingSeconds === null) return "Không có thời gian giữ chỗ.";
  if (remainingSeconds === 0) return "Đã qua thời hạn giữ chỗ; đang chờ trạng thái mới nhất từ máy chủ.";
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `Thời gian giữ chỗ còn ${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function BookingStatusPage() {
  const { bookingId = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [now, setNow] = useState(Date.now());

  const loadBooking = useCallback(async (initial = false) => {
    if (!bookingId || !isAuthenticated) return;
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const current = await api.getBooking(bookingId);
      setBooking(current);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId, isAuthenticated]);

  const pending = booking?.status.toUpperCase() === "PENDING_PAYMENT";
  const holdExpired = pending && remainingHoldSeconds(booking?.holdExpiresAt, now) === 0;

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    void loadBooking(true);
  }, [isAuthenticated, loadBooking]);

  useEffect(() => {
    if (!pending) return;
    const refreshTimer = window.setInterval(() => void loadBooking(false), 10_000);
    return () => window.clearInterval(refreshTimer);
  }, [pending, loadBooking]);

  useEffect(() => {
    if (!pending || !booking?.holdExpiresAt) return;
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clockTimer);
  }, [pending, booking?.holdExpiresAt]);

  const beginCashPayment = async () => {
    setPaymentError("");
    setPaymentLoading(true);
    try {
      const keyName = `parking.cash-payment-key.${bookingId}`;
      let key = sessionStorage.getItem(keyName);
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem(keyName, key);
      }
      const result = await api.createCashPayment(bookingId, key);
      setPayment(result);
      void loadBooking(false);
    } catch (cause) {
      setPaymentError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) void loadBooking(false);
    } finally {
      setPaymentLoading(false);
    }
  };

  const safeStatus = useMemo(() => booking?.status.toUpperCase() ?? "", [booking?.status]);

  if (!isAuthenticated) {
    return (
      <main className="customer-page">
        <div className="customer-panel customer-auth-needed">
          <h1>Đăng nhập để xem booking</h1>
          <p>Chi tiết booking chỉ hiển thị cho chủ booking hoặc nhân viên có quyền.</p>
          <Link className="customer-button primary" to="/login">Đăng nhập</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-page booking-status-page">
      <div className="customer-page-top">
        <Link to="/" className="customer-brand">Park<span>Matrix</span></Link>
        <nav aria-label="Điều hướng khách hàng"><Link to="/booking">Tìm và đặt chỗ</Link><Link to="/faq">FAQ</Link></nav>
      </div>
      <div className="customer-page-heading">
        <p className="customer-eyebrow">BOOKING CỦA BẠN</p>
        <h1>Trạng thái đặt chỗ</h1>
      </div>

      {loading && <div className="customer-panel customer-empty" role="status">Đang tải booking từ máy chủ...</div>}
      {error && (
        <div className="customer-alert error" role="alert">
          {error} {error.includes("đăng nhập") && <Link to="/login">Đăng nhập lại</Link>}
          <button type="button" onClick={() => void loadBooking(false)}>Thử lại</button>
        </div>
      )}

      {booking && (
        <section className="customer-panel booking-ticket">
          <div className="booking-status-heading">
            <div><p className="customer-eyebrow">{booking.bookingCode}</p><h2>{booking.lotName}</h2></div>
            <span className={`booking-status-badge ${safeStatus.toLowerCase()}`}>{statusText(booking.status)}</span>
          </div>
          <dl className="booking-facts">
            <div><dt>Ô đỗ</dt><dd>{booking.slotCode || "Chờ hệ thống xác nhận"}</dd></div>
            <div><dt>Loại xe</dt><dd>{booking.vehicleType}</dd></div>
            <div><dt>Bắt đầu</dt><dd>{new Date(booking.startsAt).toLocaleString("vi-VN")}</dd></div>
            <div><dt>Kết thúc</dt><dd>{new Date(booking.endsAt).toLocaleString("vi-VN")}</dd></div>
            <div><dt>Giá ước tính từ máy chủ</dt><dd>
              {typeof booking.totalAmount === "number" && Number.isFinite(booking.totalAmount)
                ? formatMoney(booking.totalAmount, "VND")
                : "Chưa có giá"}
            </dd></div>
          </dl>

          {pending && (
            <div className="booking-hold-note" role="status">
              {holdTimeText(booking.holdExpiresAt, now)}
              <span>Đồng hồ chỉ hiển thị thời hạn; máy chủ mới quyết định booking còn hiệu lực hay đã hết hạn.</span>
            </div>
          )}

          {pending && (
            <section className="cash-payment-panel">
              <div>
                <h3>Thanh toán tiền mặt (CASH)</h3>
                <p>Tạo yêu cầu thanh toán và thanh toán với nhân viên tại bãi. Nhân viên mới có quyền xác nhận đã thu tiền.</p>
              </div>
              <button className="customer-button primary" type="button" onClick={() => void beginCashPayment()}
                disabled={paymentLoading || holdExpired || payment?.status.toUpperCase() === "PENDING"}>
                {paymentLoading ? "Đang gửi yêu cầu..." : holdExpired ? "Thời gian giữ chỗ đã hết" : payment ? "Đã gửi yêu cầu CASH" : "Chọn thanh toán CASH"}
              </button>
              {payment && (
                <div className="cash-payment-result" role="status">
                  Yêu cầu thanh toán: {payment.status} · {
                    typeof payment.amount === "number" && Number.isFinite(payment.amount)
                      ? formatMoney(payment.amount, payment.currency)
                      : "Chưa có giá"
                  }. Trạng thái booking vẫn được đọc từ máy chủ.
                  <small>API tra cứu trạng thái payment riêng chưa có; trạng thái trên là phản hồi khởi tạo và có thể chưa cập nhật.</small>
                </div>
              )}
              {paymentError && (
                <div className="customer-alert error" role="alert">
                  {paymentError} {paymentError.includes("đăng nhập") && <Link to="/login">Đăng nhập lại</Link>}
                </div>
              )}
            </section>
          )}

          {safeStatus === "CONFIRMED" && booking.qrToken && (
            <section className="booking-qr">
              <h3>Mã QR booking</h3>
              <p>Mã được cấp bởi hệ thống sau khi xác nhận. Không chia sẻ ảnh chụp mã này.</p>
              <QRCodeSVG value={booking.qrToken} size={192} level="M" title={`QR booking ${booking.bookingCode}`} />
            </section>
          )}

          {safeStatus === "CONFIRMED" && !booking.qrToken && (
            <div className="customer-alert warning" role="status">
              Booking đã được backend xác nhận nhưng chưa có mã QR trong phản hồi. Không tạo mã thay thế ở trình duyệt.
            </div>
          )}
          {refreshing && <p className="customer-help-text" role="status">Đang đồng bộ trạng thái với máy chủ...</p>}
          <button className="customer-button secondary" type="button" onClick={() => void loadBooking(false)} disabled={refreshing}>
            Làm mới trạng thái
          </button>
        </section>
      )}
    </main>
  );
}
