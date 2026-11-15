import { useEffect, useRef, useState } from "react";
import { Download, QrCode, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, type BookingQrResponse } from "../../services/api";
import { bookingError } from "../../hooks/useBookingConfirmation";

export default function BookingQrTicket({ bookingId, bookingCode, enabled }: {
  bookingId: string;
  bookingCode: string;
  enabled: boolean;
}) {
  const [qr, setQr] = useState<(BookingQrResponse & { qrPayload: string; expiresAt: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const host = useRef<HTMLDivElement>(null);
  const requestRef = useRef<{ key: string; promise: Promise<BookingQrResponse> } | null>(null);

  useEffect(() => {
    let active = true;
    setQr(null); setError("");
    if (!enabled) { setLoading(false); requestRef.current = null; return; }
    const key = `${bookingId}:${revision}`;
    setLoading(true);
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, promise: api.issueBookingQr(bookingId) };
    }
    requestRef.current.promise.then(result => {
      if (!active) return;
      if (result.bookingId !== bookingId || !result.qrPayload || !result.expiresAt || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) {
        throw new Error("Chưa nhận được mã QR còn hiệu lực. Vui lòng kiểm tra lại.");
      }
      setNow(Date.now()); setQr({ ...result, qrPayload: result.qrPayload, expiresAt: result.expiresAt });
    }).catch(cause => { if (active) setError(bookingError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, enabled, revision]);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [qr]);

  function downloadQr() {
    const svg = host.current?.querySelector("svg");
    if (!svg || !qr || Date.parse(qr.expiresAt) <= Date.now()) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ParkMatrix-${bookingCode.replace(/[^a-z0-9_-]/gi, "_")}.svg`;
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const expired = qr && Date.parse(qr.expiresAt) <= now;

  return <section className="booking-qr" id="booking-entry-qr" aria-label="Mã QR vào bãi">
    <div className="booking-qr-title"><QrCode size={20} /><h2>Mã QR vào bãi</h2></div>
    {loading && <div className="booking-qr-placeholder" role="status">Đang cấp mã QR cho bạn…</div>}
    {qr && !expired && <>
      <div className="booking-qr-image" ref={host}><QRCodeSVG value={qr.qrPayload} size={208} level="M" marginSize={4} title={`QR vào bãi · ${bookingCode}`} /></div>
      <strong>{bookingCode}</strong>
      <p>Hiệu lực đến {new Date(qr.expiresAt).toLocaleString("vi-VN")}.</p>
      <button className="customer-button secondary" onClick={downloadQr}><Download size={16} />Tải mã QR</button>
      <p className="booking-qr-help">Xuất trình mã tại cổng vào đúng bãi và đúng phương tiện. Mã chỉ dùng một lần.</p>
    </>}
    {expired && <p role="status">QR đã hết hạn. Vui lòng kiểm tra lại trạng thái đặt chỗ hoặc liên hệ nhân viên tại bãi.</p>}
    {error && <div role="alert"><p>{error}</p><button className="customer-button secondary" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Thử cấp lại QR</button></div>}
  </section>;
}
