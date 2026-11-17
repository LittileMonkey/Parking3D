import { useEffect, useRef, useState } from "react";
import { request } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";

interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  status: string;
  reason: string;
  providerReference?: string;
  createdAt?: string;
}

interface Funds {
  eligible: boolean;
  payments: {
    id: string;
    amount: number;
    method: string;
    remaining: number;
  }[];
}

const formatMoney = (amount: number, isEn: boolean) =>
  new Intl.NumberFormat(isEn ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

const humanRefundStatus = (status: string, isEn: boolean) => {
  switch (status.toUpperCase()) {
    case "SUCCESS":
      return {
        text: isEn ? "Refund completed" : "Đã hoàn tiền thành công",
        color: "#15803d",
        bg: "#f0fdf4",
        border: "#bbf7d0",
      };
    case "PENDING_PROVIDER":
      return {
        text: isEn ? "Processing via VNPay (1-3 business days)" : "Đang xử lý qua VNPay (1-3 ngày làm việc)",
        color: "#0369a1",
        bg: "#f0f9ff",
        border: "#bae6fd",
      };
    case "AWAITING_CASH":
      return {
        text: isEn ? "Ready for cash pickup at counter" : "Chờ nhận tiền mặt tại quầy bãi xe",
        color: "#c2410c",
        bg: "#fff7ed",
        border: "#fed7aa",
      };
    case "RECONCILIATION_REQUIRED":
      return {
        text: isEn ? "Reconciliation in progress" : "Đang đối soát giao dịch",
        color: "#475569",
        bg: "#f8fafc",
        border: "#e2e8f0",
      };
    case "FAILED":
      return {
        text: isEn ? "Refund failed" : "Hoàn tiền không thành công",
        color: "#b91c1c",
        bg: "#fef2f2",
        border: "#fecaca",
      };
    default:
      return {
        text: status,
        color: "#475569",
        bg: "#f8fafc",
        border: "#e2e8f0",
      };
  }
};

export default function BookingRefunds({ bookingId }: { bookingId: string }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [funds, setFunds] = useState<Funds | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const keys = useRef<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const [f, r] = await Promise.all([
          request<Funds>(`/api/v1/payments/bookings/${bookingId}/refundable-payments`),
          request<Refund[]>(`/api/v1/payments/bookings/${bookingId}/refunds`),
        ]);
        if (live) {
          setFunds(f);
          setRefunds(r || []);
          setError("");
        }
      } catch {
        // Silently ignore if not applicable
      }
    }
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [bookingId, revision]);

  async function submit(paymentId: string, remaining: number) {
    setBusy(true);
    setError("");
    const identity = `${paymentId}:${remaining}`;
    keys.current[identity] ??= crypto.randomUUID();
    try {
      await request(`/api/v1/payments/${paymentId}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          amount: remaining,
          reason: "Yêu cầu hoàn tiền khi hủy đơn",
          idempotencyKey: keys.current[identity],
        }),
      });
      setRevision((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isEn
          ? "Unable to submit refund request."
          : "Chưa thể gửi yêu cầu hoàn tiền. Vui lòng thử lại sau."
      );
    } finally {
      setBusy(false);
    }
  }

  const refundablePayments = funds?.payments?.filter((p) => p.remaining > 0) || [];
  const hasRefunds = refunds.length > 0;
  const hasRefundableMoney = funds?.eligible && refundablePayments.length > 0;

  // Nếu không có khoản tiền nào để hoàn và cũng không có yêu cầu hoàn tiền nào -> Ẩn hoàn toàn để giao diện gọn gàng, tự nhiên!
  if (!hasRefunds && !hasRefundableMoney) {
    return null;
  }

  return (
    <div
      style={{
        borderTop: "1px solid #e2e8f0",
        paddingTop: 16,
        marginTop: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
          {isEn ? "Refund Information" : "Thông tin hoàn tiền"}
        </h4>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* ── Nút gửi yêu cầu hoàn tiền khi có số dư hoàn ── */}
      {hasRefundableMoney &&
        refundablePayments.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {isEn ? "Refundable amount:" : "Số tiền có thể hoàn trả:"}
              </div>
              <strong style={{ fontSize: 16, color: "#0f172a" }}>{formatMoney(p.remaining, isEn)}</strong>
              <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>
                ({p.method === "CASH" ? "Tiền mặt" : p.method})
              </span>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(p.id, p.remaining)}
              className="customer-button primary"
              style={{ padding: "8px 16px", fontSize: 13 }}
            >
              {busy ? (isEn ? "Submitting..." : "Đang xử lý...") : (isEn ? "Request Refund" : "Yêu cầu hoàn tiền")}
            </button>
          </div>
        ))}

      {/* ── Danh sách tiến độ hoàn tiền ── */}
      {hasRefunds && (
        <div style={{ display: "grid", gap: 8 }}>
          {refunds.map((r) => {
            const badge = humanRefundStatus(r.status, isEn);
            return (
              <div
                key={r.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 15, color: "#0f172a" }}>{formatMoney(r.amount, isEn)}</strong>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 6,
                        color: badge.color,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.text}
                    </span>
                  </div>
                  {r.providerReference && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Mã đối soát VNPay: <strong>{r.providerReference}</strong>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {r.createdAt && new Date(r.createdAt).toLocaleDateString("vi-VN")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
        {isEn
          ? "Refunds will be credited back to your original payment method in accordance with bank processing times."
          : "Tiền hoàn sẽ được chuyển về tài khoản thanh toán ban đầu theo thời gian xử lý của ngân hàng."}
      </p>
    </div>
  );
}
