export interface PaymentReturnContext {
  txnRef: string;
  bookingId: string;
  paymentId: string;
  expiresAt: number;
}

const storageKey = "parking.payment-return-contexts";
const ttl = 2 * 60 * 60_000;
type ContextStorage = Pick<Storage, "getItem" | "setItem">;

function readContexts(storage: ContextStorage, now: number): PaymentReturnContext[] {
  try {
    const items: unknown = JSON.parse(storage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is PaymentReturnContext => item && typeof item.txnRef === "string"
      && typeof item.bookingId === "string" && typeof item.paymentId === "string"
      && typeof item.expiresAt === "number" && item.expiresAt > now).slice(-10);
  } catch { return []; }
}

export function rememberPaymentReturn(paymentUrl: string, bookingId: string, paymentId: string, storage: ContextStorage, now = Date.now()): void {
  const url = new URL(paymentUrl);
  const txnRef = url.searchParams.get("vnp_TxnRef");
  if (url.protocol !== "https:" || !txnRef || txnRef.length > 128) throw new Error("Liên kết VNPay thiếu mã giao dịch hợp lệ.");
  const contexts = readContexts(storage, now).filter(item => item.txnRef !== txnRef);
  contexts.push({ txnRef, bookingId, paymentId, expiresAt: now + ttl });
  storage.setItem(storageKey, JSON.stringify(contexts.slice(-10)));
}

export function findPaymentReturn(txnRef: string, storage: ContextStorage, now = Date.now()): PaymentReturnContext | null {
  return readContexts(storage, now).find(item => item.txnRef === txnRef) ?? null;
}
