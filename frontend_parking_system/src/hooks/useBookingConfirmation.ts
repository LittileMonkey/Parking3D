import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type BookingDetail, type BookingPaymentStatus, type PaymentReceiptDto } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

export function bookingError(error: unknown, isEn = false): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return isEn ? "Your session has expired. Please log in again." : "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return isEn ? "You do not have permission to view this booking." : "Bạn không có quyền xem đặt chỗ này.";
    if (error.status === 404) return isEn ? "Booking not found." : "Không tìm thấy đặt chỗ.";
    if (error.status === 409) return isEn ? "Booking state just changed. Please check the latest status." : "Đặt chỗ vừa thay đổi. Vui lòng kiểm tra trạng thái mới nhất.";
    if (error.status === 0 || error.status >= 500) return isEn ? "Unable to connect to service. Please try again later." : "Chưa thể kết nối dịch vụ. Vui lòng thử lại sau.";
  }
  return error instanceof Error ? error.message : (isEn ? "Unable to load booking information." : "Không thể tải thông tin đặt chỗ.");
}

export function useBookingConfirmation(bookingId: string, enabled: boolean) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [payment, setPayment] = useState<BookingPaymentStatus | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceiptDto | null>(null);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let timer: number | undefined;
    let receiptId: string | null = null;
    const controller = new AbortController();
    setBooking(null); setPayment(null); setReceipt(null); setError(""); setPaymentError("");
    setLoading(enabled); setRefreshing(false);
    if (!enabled || !bookingId) return;

    async function load(initial = false) {
      if (!active || inFlight) return;
      inFlight = true;
      window.clearTimeout(timer);
      if (!initial) setRefreshing(true);
      let nextStatus = "";
      try {
        // Read the owner/facility-scoped booking before requesting payment details.
        const current = await api.getBooking(bookingId, controller.signal);
        if (!active) return;
        if (current.bookingId !== bookingId) throw new Error(isEn ? "Booking details do not match request." : "Thông tin đặt chỗ không khớp yêu cầu.");
        nextStatus = current.status.toUpperCase();
        setBooking(current); setError("");
        try {
          const result = await api.getBookingPaymentStatus(bookingId, controller.signal);
          if (!active) return;
          if (result.bookingId !== bookingId) throw new Error(isEn ? "Payment details do not match booking." : "Thông tin thanh toán không khớp đặt chỗ.");
          setPayment(result); setPaymentError("");
          if (result.paymentStatus.toUpperCase() === "SUCCESS") {
            if (receiptId !== result.paymentId) {
              setReceipt(null);
              try {
                const receiptResult = await api.getPaymentReceipt(result.paymentId, controller.signal);
                if (!active) return;
                if (receiptResult.bookingId !== bookingId || receiptResult.paymentId !== result.paymentId) throw new Error(isEn ? "Receipt does not match booking." : "Biên lai không khớp đặt chỗ.");
                receiptId = result.paymentId;
                setReceipt(receiptResult);
              } catch (cause) {
                if (active) setPaymentError(`${isEn ? "Receipt not ready yet." : "Biên lai chưa sẵn sàng."} ${bookingError(cause, isEn)}`);
              }
            }
          } else { receiptId = null; setReceipt(null); }
        } catch (cause) {
          if (!active) return;
          if (cause instanceof ApiError && cause.status === 404) {
            setPayment(null); setPaymentError("");
          } else { setPaymentError(bookingError(cause, isEn)); }
        }
      } catch (cause) {
        if (!active) return;
        setError(bookingError(cause, isEn));
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
          setBooking(null); setPayment(null); setReceipt(null);
        } else { nextStatus = "PENDING_PAYMENT"; }
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false); setRefreshing(false);
          if (["PENDING_PAYMENT", "CONFIRMED"].includes(nextStatus)) {
            timer = window.setTimeout(() => void load(), nextStatus === "CONFIRMED" ? 15_000 : 5_000);
          }
        }
      }
    }
    refreshRef.current = () => load();
    void load(true);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); refreshRef.current = async () => {}; };
  }, [bookingId, enabled, revision, isEn]);

  return { booking, payment, receipt, error, paymentError, loading, refreshing, refresh, retry };
}
