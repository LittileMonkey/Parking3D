import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Clock, Plus, RotateCcw, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import { api, ApiError, type ShiftHandoverDto, type ShiftHandoverSummaryDto, type ShiftHandoverHistoryItemDto } from "../../services/api";
import { operations } from "../../services/operations";
import { StaffDialog, StaffPagination, StaffStatus, handoverStatuses, historyActions, staffDate } from "../../components/staff/StaffUi";
import type { StaffContext } from "../../components/staff/StaffLayout";
type Shift = {
    id: string;
    lotId: string;
    staffUserId: string;
    startedAt: string;
};
const fields = [["completedTasks", "Công việc đã hoàn thành"], ["unresolvedIssues", "Sự cố chưa xử lý"], ["pendingTransactions", "Giao dịch chờ xác nhận"], ["equipmentStatus", "Tình trạng thiết bị"], ["notesForNext", "Lưu ý cho ca tiếp theo"]] as const;
const emptyForm = { completedTasks: "", unresolvedIssues: "", pendingTransactions: "", equipmentStatus: "", notesForNext: "" };
export default function ShiftManagement() {
    const { selectedLotId } = useOutletContext<StaffContext>();
    const { user } = useAuth();
    const [shifts, setShifts] = useState<Shift[]>([]), [items, setItems] = useState<ShiftHandoverSummaryDto[]>([]);
    const [page, setPage] = useState(1), [total, setTotal] = useState(0), [filter, setFilter] = useState("All"), [revision, setRevision] = useState(0);
    const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false), [receiver, setReceiver] = useState(""), [detailId, setDetailId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const mine = shifts.find(s => s.staffUserId === user?.userId);
    const { key, renewKey } = useIdempotencyKey("handover");
    const staffName = (id: string) => id === user?.userId ? user.fullName || "Bạn" : `Nhân viên #${id.slice(0, 8)}`;
    useEffect(() => {
        let current = true;
        setLoading(true);
        setError("");
        Promise.all([operations.shifts(selectedLotId), api.getShiftHandovers(selectedLotId, filter, page, 10)]).then(([active, list]) => {
            if (current) {
                setShifts(active);
                setItems(list.items);
                setTotal(list.totalCount);
            }
        }).catch(err => { if (current)
            setError(err.message || "Không tải được ca trực."); }).finally(() => { if (current)
            setLoading(false); });
        return () => { current = false; };
    }, [selectedLotId, filter, page, revision]);
    async function start() {
        if (busy)
            return;
        setBusy(true);
        setError("");
        try {
            await operations.startShift(selectedLotId);
            setNotice("Đã bắt đầu ca trực.");
            setRevision(n => n + 1);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Không mở được ca trực.");
        }
        finally {
            setBusy(false);
        }
    }
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (busy)
            return;
        const next = shifts.find(s => s.id === receiver);
        if (!mine || !next || next.staffUserId === user?.userId || mine.lotId !== selectedLotId || next.lotId !== selectedLotId) {
            setError("Người giao và người nhận phải có ca đang mở tại cùng bãi.");
            return;
        }
        if (Object.values(form).some(v => !v.trim())) {
            setError("Điền nội dung cụ thể; nhập ‘Không có’ nếu không có việc tồn.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await api.createShiftHandover(selectedLotId, { ...form, senderShiftId: mine.id, receiverShiftId: next.id, receiverUserId: next.staffUserId }, key);
            setForm(emptyForm);
            setReceiver("");
            renewKey();
            setCreating(false);
            setNotice("Đã gửi biên bản. Ca của bạn kết thúc khi người nhận xác nhận.");
            setPage(1);
            setRevision(n => n + 1);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Không gửi được bàn giao.");
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="staff-page">
    <div className="staff-page-heading"><div><span className="staff-eyebrow">TIẾP NỐI CÔNG VIỆC</span><h1>Bàn giao ca trực</h1><p>Ghi lại công việc, đối soát các khoản chờ và chuyển giao rõ ràng cho người nhận ca.</p></div><button className="staff-button" disabled={loading || busy} onClick={() => setRevision(n => n + 1)}><RotateCcw size={16}/>Tải lại</button></div>
    {error && !creating && <div className="staff-alert error" role="alert">{error}</div>}{notice && <div className="staff-alert success" role="status">{notice}</div>}
    <section className="staff-panel staff-shift-banner"><div className="staff-row"><Clock size={25}/><div><strong>{mine ? "Bạn đang trong ca trực" : "Bạn chưa bắt đầu ca trực"}</strong><div className="staff-small staff-muted">{mine ? `Bắt đầu ${staffDate(mine.startedAt)}` : "Bắt đầu ca để tiếp nhận và bàn giao công việc tại bãi này."}</div></div></div>{mine ? <button className="staff-primary" onClick={() => { setCreating(true); setError(""); }}><Plus size={17}/>Tạo biên bản</button> : <button className="staff-primary" disabled={busy || loading} onClick={() => void start()}>Bắt đầu ca trực</button>}</section>
    <section className="staff-panel staff-stack"><div className="staff-row between"><h2>Biên bản liên quan đến bạn</h2><label className="staff-field">Lọc trạng thái bàn giao<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="All">Tất cả trạng thái</option>{Object.entries(handoverStatuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      {loading ? <div className="staff-empty" role="status">Đang tải biên bản…</div> : !items.length ? <div className="staff-empty">Chưa có biên bản phù hợp với bộ lọc.</div> : <div className="staff-handover-list">{items.map(item => <article className="staff-handover-card staff-stack" key={item.handoverId}><div className="staff-row between"><StaffStatus status={item.status} labels={handoverStatuses}/><span className="staff-muted staff-small">{staffDate(item.createdAt)}</span></div><div><strong>{staffName(item.senderUserId)} → {staffName(item.receiverUserId)}</strong><div className="staff-small staff-muted">{item.confirmedAt ? `Đã xác nhận ${staffDate(item.confirmedAt)}` : item.receiverUserId === user?.userId ? "Bạn là người nhận biên bản này." : "Theo dõi phản hồi từ người nhận ca."}</div></div><div><button className="staff-button" onClick={() => setDetailId(item.handoverId)}>Xem biên bản & lịch sử</button></div></article>)}</div>}
      <StaffPagination page={page} total={total} busy={loading} onChange={setPage}/>
    </section>
    {creating && <StaffDialog title="Tạo biên bản bàn giao" onClose={() => { if (!busy) {
        setCreating(false);
        setError("");
    } }}><form className="staff-stack" onSubmit={submit}>{error && <div className="staff-alert error" role="alert">{error}</div>}<p className="staff-muted staff-small">Người nhận cần có ca đang mở tại cùng bãi. Ca của bạn vẫn hoạt động tới khi biên bản được xác nhận.</p><label className="staff-field">Người nhận ca *<select required value={receiver} onChange={e => { setReceiver(e.target.value); renewKey(); }}><option value="">Chọn người nhận đang trong ca</option>{shifts.filter(s => s.staffUserId !== user?.userId).map(s => <option key={s.id} value={s.id}>{staffName(s.staffUserId)} · {staffDate(s.startedAt)}</option>)}</select></label>{shifts.filter(s => s.staffUserId !== user?.userId).length === 0 && <div className="staff-alert">Chưa có nhân viên khác đang mở ca tại bãi này.</div>}<div className="staff-form-grid">{fields.map(([id, label]) => <label className={`staff-field ${id === "notesForNext" ? "full" : ""}`} key={id}>{label} *<textarea required maxLength={2000} rows={3} placeholder="Ghi nội dung hoặc ‘Không có’." value={form[id]} onChange={e => { setForm({ ...form, [id]: e.target.value }); renewKey(); }}/></label>)}</div><button className="staff-primary" disabled={busy || !mine || !receiver}>{busy ? "Đang gửi…" : "Gửi biên bản bàn giao"}</button></form></StaffDialog>}
    {detailId && <HandoverDetails lotId={selectedLotId} id={detailId} userId={user?.userId || ""} staffName={staffName} onClose={() => setDetailId(null)} onConfirmed={() => { setNotice("Đã xác nhận nhận ca."); setRevision(n => n + 1); }}/>}
  </div>;
}
function HandoverDetails({ lotId, id, userId, staffName, onClose, onConfirmed }: {
    lotId: string;
    id: string;
    userId: string;
    staffName: (id: string) => string;
    onClose: () => void;
    onConfirmed: () => void;
}) {
    const [item, setItem] = useState<ShiftHandoverDto | null>(null), [history, setHistory] = useState<ShiftHandoverHistoryItemDto[]>([]);
    const [page, setPage] = useState(1), [total, setTotal] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
    const attempt = useRef<{
        signature: string;
        key: string;
        expiresAt: number;
    } | null>(null);
    useEffect(() => { let current = true; setLoading(true); setError(""); Promise.all([api.getShiftHandoverById(lotId, id), api.getShiftHandoverHistory(lotId, id, page, 10)]).then(([record, log]) => { if (current) {
        setItem(record);
        setHistory(log.items);
        setTotal(log.totalCount);
    } }).catch(err => { if (current)
        setError(err.message); }).finally(() => { if (current)
        setLoading(false); }); return () => { current = false; }; }, [lotId, id, page, revision]);
    async function confirm() {
        if (!item || busy || loading || item.receiverUserId !== userId || item.status !== "PendingConfirmation")
            return;
        const signature = `${id}:${item.version}`;
        if (!attempt.current || attempt.current.signature !== signature || attempt.current.expiresAt < Date.now())
            attempt.current = { signature, key: crypto.randomUUID(), expiresAt: Date.now() + 600000 };
        setBusy(true);
        setError("");
        try {
            const updated = await api.confirmShiftHandover(lotId, id, { expectedVersion: item.version }, attempt.current.key);
            setItem(updated);
            onConfirmed();
            setRevision(n => n + 1);
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                try {
                    setItem(await api.getShiftHandoverById(lotId, id));
                }
                catch {
                    setItem(null);
                }
                setError("Biên bản vừa thay đổi. Kiểm tra nội dung mới trước khi xác nhận lại.");
            }
            else
                setError(err instanceof Error ? err.message : "Không xác nhận được biên bản.");
        }
        finally {
            setBusy(false);
        }
    }
    return <StaffDialog title="Biên bản bàn giao" onClose={() => { if (!busy)
        onClose(); }}><div className="staff-stack">{error && <div className="staff-alert error" role="alert">{error}<button className="staff-button" disabled={busy} onClick={() => setRevision(n => n + 1)}>Tải lại</button></div>}{loading && <p role="status">Đang tải biên bản…</p>}{item && <><StaffStatus status={item.status} labels={handoverStatuses}/><dl className="staff-detail-grid"><div><dt>Người giao</dt><dd>{staffName(item.senderUserId)}</dd></div><div><dt>Người nhận</dt><dd>{staffName(item.receiverUserId)}</dd></div>{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{item[key] || "Không có"}</dd></div>)}</dl>{item.receiverUserId === userId && item.status === "PendingConfirmation" && <button className="staff-primary" disabled={busy || loading} onClick={() => void confirm()}><CheckCircle2 size={17}/>{busy ? "Đang xác nhận…" : "Xác nhận nhận ca"}</button>}</>}<h3>Lịch sử bàn giao</h3>{!loading && !error && !history.length && <p className="staff-muted">Chưa có lịch sử thao tác.</p>}<ol className="staff-timeline">{history.map(entry => <li key={entry.id}><strong>{historyActions[entry.action] || entry.action}</strong><div className="staff-small staff-muted">{staffDate(entry.performedAt)} · {staffName(entry.performedByUserId)}</div>{entry.newReceiverUserId && <p>Người nhận: {staffName(entry.newReceiverUserId)}</p>}{entry.reason && <p>{entry.reason}</p>}</li>)}</ol><StaffPagination page={page} total={total} busy={loading || busy} onChange={setPage}/></div></StaffDialog>;
}
