import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, ArrowUpRight, RefreshCw, X } from "lucide-react";
import { request } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
type Notice = {
    id: string;
    bookingId?: string | null;
    kind: string;
    message: string;
    createdAt: string;
    readAt?: string | null;
};
function noticeTime(value: string) {
    const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
    if (!Number.isFinite(elapsed))
        return "";
    return elapsed < 1 ? "Vừa xong" : elapsed < 60 ? `${elapsed} phút trước` : elapsed < 1440 ? `${Math.floor(elapsed / 60)} giờ trước` : new Date(value).toLocaleDateString("vi-VN");
}
export default function NotificationBell({ open, onOpenChange }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { isAuthenticated, user } = useAuth();
    const [items, setItems] = useState<Notice[]>([]), [unread, setUnread] = useState(0);
    const [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [filter, setFilter] = useState<"all" | "unread">("all");
    const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const mutationVersion = useRef(0), busyRef = useRef(false), inFlight = useRef(false), mounted = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);
    const id = useId();
    const load = useCallback(async () => {
        if (inFlight.current || busyRef.current)
            return;
        const controller = controllerRef.current;
        if (!controller)
            return;
        inFlight.current = true;
        const version = mutationVersion.current;
        try {
            const data = await request<{
                items: Notice[];
                unreadCount: number;
            }>("/api/v1/notifications", { signal: controller.signal });
            if (controllerRef.current === controller && !controller.signal.aborted && version === mutationVersion.current) {
                setItems(data.items);
                setUnread(data.unreadCount);
                setError("");
            }
        }
        catch (e) {
            if (controllerRef.current === controller && !controller.signal.aborted)
                setError(e instanceof Error ? e.message : "Chưa thể tải thông báo.");
        }
        finally {
            if (controllerRef.current === controller) {
                inFlight.current = false;
                if (mounted.current)
                    setLoading(false);
            }
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        controllerRef.current = controller;
        mounted.current = true;
        inFlight.current = false;
        busyRef.current = false;
        mutationVersion.current++;
        setItems([]);
        setUnread(0);
        setError("");
        setLoading(true);
        setBusy(false);
        if (!isAuthenticated)
            return () => { mounted.current = false; controller.abort(); controllerRef.current = null; };
        void load();
        const timer = setInterval(() => void load(), 30000);
        return () => { mounted.current = false; controller.abort(); controllerRef.current = null; clearInterval(timer); };
    }, [isAuthenticated, user?.userId, load]);
    useEffect(() => {
        if (!open)
            return;
        const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node))
            onOpenChange(false); };
        const escape = (e: KeyboardEvent) => { if (e.key === "Escape") {
            onOpenChange(false);
            trigger.current?.focus();
        } };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
    }, [open, onOpenChange]);
    async function markRead(item?: Notice) {
        if (busyRef.current || item?.readAt)
            return;
        const controller = controllerRef.current;
        busyRef.current = true;
        mutationVersion.current++;
        setBusy(true);
        setError("");
        try {
            await request(item ? `/api/v1/notifications/${encodeURIComponent(item.id)}/read` : "/api/v1/notifications/read-all", { method: "POST" });
            if (!mounted.current || controllerRef.current !== controller)
                return;
            setItems(rows => rows.map(row => !item || row.id === item.id ? { ...row, readAt: row.readAt || new Date().toISOString() } : row));
            setUnread(count => item ? Math.max(0, count - 1) : 0);
        }
        catch (e) {
            if (mounted.current && controllerRef.current === controller)
                setError(e instanceof Error ? e.message : "Chưa lưu được trạng thái đã đọc. Hãy thử lại.");
        }
        finally {
            if (controllerRef.current === controller) {
                busyRef.current = false;
                if (mounted.current)
                    setBusy(false);
            }
        }
    }
    if (!isAuthenticated)
        return null;
    const visible = filter === "unread" ? items.filter(item => !item.readAt) : items;
    return <div className="customer-notifications" ref={root}>
    <button ref={trigger} className={`customer-notification-trigger ${open ? "is-open" : ""}`} type="button" aria-label={`Thông báo${unread > 0 ? `, ${unread} chưa đọc` : ""}`} aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}><Bell size={20}/>{unread > 0 && <span className="customer-notification-count">{unread > 99 ? "99+" : unread}</span>}</button>
    {open && <section id={id} className="customer-notification-panel" aria-label="Thông báo">
      <header><div><h2>Thông báo</h2><p>{unread ? `${unread} thông báo chưa đọc` : "Cập nhật mới cho hành trình của bạn"}</p></div><button className="customer-popover-close" aria-label="Đóng thông báo" onClick={() => onOpenChange(false)}><X size={18}/></button></header>
      <div className="customer-notification-toolbar"><div className="customer-notice-filters"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tất cả</button><button aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Chưa đọc</button></div><button className="customer-notice-read-all" disabled={busy || loading || !unread} onClick={() => void markRead()} title="Đánh dấu tất cả đã đọc" aria-label="Đánh dấu tất cả đã đọc"><CheckCheck size={18}/></button></div>
      {error && <div className="customer-notice-error" role="alert"><span>{error}</span><button onClick={() => void load()} disabled={busy} aria-label="Tải lại thông báo"><RefreshCw size={16}/></button></div>}
      <div className="customer-notice-list" aria-busy={loading}>
        {loading ? <div className="customer-notice-empty" role="status">Đang tải thông báo…</div> : !visible.length && !error ? <div className="customer-notice-empty"><Bell size={28}/><strong>{filter === "unread" ? "Bạn đã xem hết thông báo" : "Chưa có thông báo mới"}</strong><p>Thông tin về đặt chỗ và thanh toán sẽ xuất hiện tại đây.</p></div> : visible.map(item => <article key={item.id} className={`customer-notice-item ${item.readAt ? "is-read" : "is-unread"}`}><span className="customer-notice-icon"><Bell size={16}/></span><div><p>{item.message}</p><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString("vi-VN")}>{noticeTime(item.createdAt)}</time>{item.bookingId && <Link to={`/bookings/${encodeURIComponent(item.bookingId)}`} onClick={() => { if (!item.readAt)
            void markRead(item); onOpenChange(false); }}>Xem đặt chỗ<ArrowUpRight size={13}/></Link>}</div>{!item.readAt && <button className="customer-notice-mark" aria-label={`Đánh dấu đã đọc: ${item.message}`} disabled={busy} onClick={() => void markRead(item)}><Check size={15}/></button>}</article>)}
      </div><footer>Thông báo gần đây của tài khoản</footer>
    </section>}
  </div>;
}
