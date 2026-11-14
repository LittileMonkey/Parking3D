import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type BookingDetail, type BookingPaymentStatus, type PaymentReceiptDto } from "../services/api";

export function bookingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Bạn không có quyền xem đặt chỗ này.";
    if (error.status === 404) return "Không tìm thấy đặt chỗ.";
    if (error.status === 409) return "Đặt chỗ vừa thay đổi. Vui lòng kiểm tra trạng thái mới nhất.";
    if (error.status === 0 || error.status >= 500) return "Chưa thể kết nối dịch vụ. Vui lòng thử lại sau.";
  }
  return error instanceof Error ? error.message : "Không thể tải thông tin đặt chỗ.";
}

export function useBookingConfirmation(bookingId: string, enabled: boolean) {
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
        if (current.bookingId !== bookingId) throw new Error("Thông tin đặt chỗ không khớp yêu cầu.");
        nextStatus = current.status.toUpperCase();
        setBooking(current); setError("");
        try {
          const result = await api.getBookingPaymentStatus(bookingId, controller.signal);
          if (!active) return;
          if (result.bookingId !== bookingId) throw new Error("Thông tin thanh toán không khớp đặt chỗ.");
          setPayment(result); setPaymentError("");
          if (result.paymentStatus.toUpperCase() === "SUCCESS") {
            if (receiptId !== result.paymentId) {
              setReceipt(null);
              try {
                const receiptResult = await api.getPaymentReceipt(result.paymentId, controller.signal);
                if (!active) return;
                if (receiptResult.bookingId !== bookingId || receiptResult.paymentId !== result.paymentId) throw new Error("Biên lai không khớp đặt chỗ.");
                receiptId = result.paymentId;
                setReceipt(receiptResult);
              } catch (cause) {
                if (active) setPaymentError(`Biên lai chưa sẵn sàng. ${bookingError(cause)}`);
              }
            }
          } else { receiptId = null; setReceipt(null); }
        } catch (cause) {
          if (!active) return;
          if (cause instanceof ApiError && cause.status === 404) {
            setPayment(null); setPaymentError("");
          } else { setPaymentError(bookingError(cause)); }
        }
      } catch (cause) {
        if (!active) return;
        setError(bookingError(cause));
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
  }, [bookingId, enabled, revision]);

  return { booking, payment, receipt, error, paymentError, loading, refreshing, refresh, retry };
}
