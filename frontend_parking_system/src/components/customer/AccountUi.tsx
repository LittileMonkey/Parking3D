import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, X, CheckCircle2, AlertCircle } from "lucide-react";
export function AccountAlert({ error, notice }: {
    error?: string;
    notice?: string;
}) {
    return <>{error && <div className="account-alert error" role="alert"><AlertCircle size={18}/><span>{error}</span></div>}{notice && <div className="account-alert success" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}</>;
}
export function AccountDialog({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null), id = useId();
    useEffect(() => { ref.current?.showModal(); }, []);
    return <dialog ref={ref} className="account-dialog" aria-labelledby={id} onCancel={e => { e.preventDefault(); onClose(); }}><header><h2 id={id}>{title}</h2><button className="account-icon-button" aria-label="Đóng hộp thoại" onClick={onClose}><X size={20}/></button></header><div className="account-dialog-content">{children}</div></dialog>;
}
export function AccountPasswordField({ label, value, onChange, autoComplete, disabled = false, minLength }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: "current-password" | "new-password";
    disabled?: boolean;
    minLength?: number;
}) {
    const [show, setShow] = useState(false), id = useId();
    return <label className="account-field" htmlFor={id}>{label}<span className="account-password-input"><input id={id} type={show ? "text" : "password"} value={value} autoComplete={autoComplete} required minLength={minLength} maxLength={256} disabled={disabled} onChange={e => onChange(e.target.value)}/><button type="button" aria-label={`${show ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`} aria-pressed={show} aria-controls={id} onClick={() => setShow(!show)} disabled={disabled}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>;
}
export const bookingStatusLabels: Record<string, string> = { PENDING_PAYMENT: "Chờ thanh toán", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Đang gửi xe", COMPLETED: "Đã hoàn tất", EXPIRED: "Đã hết hạn", CANCELLED: "Đã hủy", NO_SHOW: "Quá hạn đến bãi" };
export function accountDate(value: string) { return new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }); }
