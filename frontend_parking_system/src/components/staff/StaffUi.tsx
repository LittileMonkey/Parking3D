import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
export function StaffDialog({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const id = useId();
    useEffect(() => { ref.current?.showModal(); }, []);
    return <dialog ref={ref} className="staff-dialog staff-app" aria-labelledby={id} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h2 id={id}>{title}</h2><button type="button" className="staff-icon-button" aria-label="Đóng hộp thoại" onClick={onClose}><X size={20}/></button></header><div className="staff-dialog-body">{children}</div>
  </dialog>;
}
export function StaffPagination({ page, total, size = 10, busy = false, onChange }: {
    page: number;
    total: number;
    size?: number;
    busy?: boolean;
    onChange: (page: number) => void;
}) {
    const pages = Math.max(1, Math.ceil(total / size));
    return <nav className="staff-pagination" aria-label="Phân trang"><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} / ${total}` : "0 kết quả"}</span><div><button type="button" aria-label="Trang trước" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={17}/></button><span>Trang {page} / {pages}</span><button type="button" aria-label="Trang sau" disabled={busy || page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={17}/></button></div></nav>;
}
export const incidentStatuses: Record<string, string> = { Open: "Mới tiếp nhận", InProgress: "Đang xử lý", Escalated: "Đã chuyển quản lý", Resolved: "Đã giải quyết", Cancelled: "Đã hủy" };
export const handoverStatuses: Record<string, string> = { PendingConfirmation: "Chờ xác nhận", Confirmed: "Đã xác nhận", Cancelled: "Đã hủy" };
export function StaffStatus({ status, labels = incidentStatuses }: {
    status: string;
    labels?: Record<string, string>;
}) { return <span className={`staff-status status-${status}`}>{labels[status] ?? status}</span>; }
export function staffDate(value?: string | null) { return value ? new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—"; }
export const historyActions: Record<string, string> = { Created: "Tạo mới", CREATED: "Tạo mới", StatusChanged: "Cập nhật trạng thái", STATUS_CHANGED: "Cập nhật trạng thái", Reopened: "Mở lại sự cố", REOPENED: "Mở lại sự cố", Cancelled: "Hủy báo cáo", CANCELLED: "Hủy báo cáo", Confirmed: "Xác nhận nhận ca", CONFIRMED: "Xác nhận nhận ca", ReceiverReassigned: "Đổi người nhận ca", RECEIVER_REASSIGNED: "Đổi người nhận ca", Escalated: "Chuyển quản lý", Resolved: "Giải quyết sự cố" };
