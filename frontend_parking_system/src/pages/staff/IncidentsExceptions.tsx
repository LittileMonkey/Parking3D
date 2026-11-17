import { useEffect, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw } from "lucide-react";
import { api, ApiError, type IncidentDto, type IncidentSummaryDto, type IncidentHistoryItemDto } from "../../services/api";
import type { StaffContext } from "../../components/staff/StaffLayout";
import { StaffDialog, StaffPagination, StaffStatus, incidentStatuses, staffDate, historyActions } from "../../components/staff/StaffUi";
const severityLabels = { Low: "Thấp", Medium: "Trung bình", High: "Cao", Critical: "Khẩn cấp" };
export default function IncidentsExceptions() {
    const { selectedLotId } = useOutletContext<StaffContext>();
    const [params] = useSearchParams();
    const [items, setItems] = useState<IncidentSummaryDto[]>([]);
    const [total, setTotal] = useState(0), [page, setPage] = useState(1), [status, setStatus] = useState("All"), [severity, setSeverity] = useState("All");
    const [search, setSearch] = useState(""), [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(Boolean(params.get("slot") || params.get("plate")));
    const emptyForm = { title: "", type: "Thiết bị cổng", severity: "Medium", description: "", relatedPlate: "", relatedSlotCode: "", relatedGate: "" };
    const [form, setForm] = useState({ ...emptyForm, relatedPlate: params.get("plate") || "", relatedSlotCode: params.get("slot") || "" });
    const [action, setAction] = useState<{
        item: IncidentSummaryDto;
        status: "InProgress" | "Escalated";
    } | null>(null);
    const [note, setNote] = useState(""), [detailId, setDetailId] = useState<string | null>(null);
    const attempt = useRef<{
        signature: string;
        key: string;
        detectedAt: string;
        expiresAt: number;
    } | null>(null);
    function operationKey(signature: string) {
        if (!attempt.current || attempt.current.signature !== signature || attempt.current.expiresAt <= Date.now())
            attempt.current = { signature, key: crypto.randomUUID(), detectedAt: new Date().toISOString(), expiresAt: Date.now() + 600000 };
        return attempt.current;
    }
    useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 300); return () => clearTimeout(timer); }, [search]);
    useEffect(() => {
        let current = true;
        setLoading(true);
        setError("");
        api.getIncidents(selectedLotId, status, severity, query, page, 10).then(data => { if (current) {
            setItems(data.items);
            setTotal(data.totalCount);
        } })
            .catch(err => { if (current) {
            setItems([]);
            setError(err.message || "Không tải được sự cố.");
        } }).finally(() => { if (current)
            setLoading(false); });
        return () => { current = false; };
    }, [selectedLotId, status, severity, query, page, revision]);
    async function create(event: React.FormEvent) {
        event.preventDefault();
        if (busy)
            return;
        const payload = { ...form, title: form.title.trim(), description: form.description.trim(), relatedPlate: form.relatedPlate.trim() || undefined, relatedSlotCode: form.relatedSlotCode.trim() || undefined, relatedGate: form.relatedGate.trim() || undefined };
        if (!payload.title || !payload.description) {
            setError("Nhập tiêu đề và mô tả sự cố.");
            return;
        }
        const op = operationKey(JSON.stringify({ selectedLotId, payload }));
        setBusy(true);
        setError("");
        try {
            await api.createIncident(selectedLotId, { ...payload, detectedAt: op.detectedAt }, op.key);
            attempt.current = null;
            setCreating(false);
            setForm(emptyForm);
            setNotice("Đã gửi báo cáo sự cố.");
            setPage(1);
            setRevision(n => n + 1);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Không gửi được báo cáo.");
        }
        finally {
            setBusy(false);
        }
    }
    async function update(event: React.FormEvent) {
        event.preventDefault();
        if (!action || busy)
            return;
        const payload = { status: action.status, notes: note.trim() || undefined, expectedVersion: action.item.version };
        const op = operationKey(JSON.stringify({ lotId: selectedLotId, id: action.item.incidentId, payload }));
        setBusy(true);
        setError("");
        try {
            await api.updateIncidentStatus(selectedLotId, action.item.incidentId, payload, op.key);
            attempt.current = null;
            setAction(null);
            setNote("");
            setNotice("Đã cập nhật sự cố.");
            setRevision(n => n + 1);
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                try {
                    const latest = await api.getIncidentById(selectedLotId, action.item.incidentId);
                    setItems(rows => rows.map(row => row.incidentId === latest.incidentId ? latest : row));
                    setAction(old => old ? { ...old, item: latest } : null);
                }
                catch {
                    setAction(null);
                }
                setError("Sự cố vừa được người khác cập nhật. Kiểm tra trạng thái mới và xác nhận lại; ghi chú vẫn được giữ.");
            }
            else
                setError(err instanceof Error ? err.message : "Không cập nhật được sự cố.");
        }
        finally {
            setBusy(false);
        }
    }
    const validAction = action && (action.status === "InProgress" ? action.item.status === "Open" : ["Open", "InProgress"].includes(action.item.status));
    return <div className="staff-page">
    <div className="staff-page-heading"><div><span className="staff-eyebrow">THEO DÕI & XỬ LÝ</span><h1>Sự cố trong ca</h1><p>Ghi nhận vấn đề tại bãi, theo dõi tiến độ và chuyển quản lý khi cần hỗ trợ.</p></div><button className="staff-primary" onClick={() => { setCreating(true); setError(""); }}><Plus size={18}/>Báo cáo sự cố</button></div>
    {error && !creating && !action && <div className="staff-alert error" role="alert">{error}</div>}{notice && <div className="staff-alert success" role="status">{notice}</div>}
    <section className="staff-panel"><div className="staff-filters">
      <label className="staff-field">Tìm sự cố<input type="search" placeholder="Tiêu đề, mã, biển số hoặc ô đỗ" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <label className="staff-field">Trạng thái<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="All">Tất cả trạng thái</option>{Object.entries(incidentStatuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="staff-field">Mức độ<select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}><option value="All">Tất cả mức độ</option>{Object.entries(severityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button className="staff-button" aria-label="Tải lại sự cố" disabled={loading} onClick={() => setRevision(n => n + 1)}><RotateCcw size={17}/></button>
    </div></section>
    <section className="staff-panel"><div className="staff-row between"><h2>Danh sách sự cố</h2><span className="staff-muted staff-small">{total} báo cáo</span></div>
      {loading ? <div className="staff-empty" role="status">Đang tải sự cố…</div> : !items.length ? <div className="staff-empty">Không có sự cố phù hợp với bộ lọc.</div> : <div className="staff-table-wrap" tabIndex={0} aria-label="Danh sách sự cố, cuộn ngang để xem thêm"><table className="staff-table"><thead><tr><th>Sự cố</th><th>Mức độ</th><th>Trạng thái</th><th>Ghi nhận</th><th>Thao tác</th></tr></thead><tbody>{items.map(item => <tr key={item.incidentId}><td><strong>{item.title}</strong><span className="staff-muted staff-small">{item.relatedPlate || item.relatedSlotCode || "Chưa gắn phương tiện / ô đỗ"}</span></td><td><span className={`staff-severity ${item.severity}`}>{severityLabels[item.severity]}</span></td><td><StaffStatus status={item.status}/></td><td className="staff-small">{staffDate(item.detectedAt || item.reportedAt || item.updatedAt)}</td><td><div className="staff-stack"><button className="staff-button" onClick={() => setDetailId(item.incidentId)}>Xem chi tiết</button>{item.status === "Open" && <button className="staff-button" onClick={() => { setAction({ item, status: "InProgress" }); setNote(""); setError(""); }}>Tiếp nhận</button>}{["Open", "InProgress"].includes(item.status) && <button className="staff-button" onClick={() => { setAction({ item, status: "Escalated" }); setNote(""); setError(""); }}>Chuyển quản lý</button>}</div></td></tr>)}</tbody></table></div>}
      <StaffPagination page={page} total={total} busy={loading} onChange={setPage}/>
    </section>
    {creating && <StaffDialog title="Báo cáo sự cố mới" onClose={() => { if (!busy) {
        setCreating(false);
        setError("");
    } }}><form className="staff-stack" onSubmit={create}>{error && <div className="staff-alert error" role="alert">{error}</div>}<label className="staff-field">Tiêu đề *<input required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><div className="staff-form-grid"><label className="staff-field">Phân loại<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{["Thiết bị cổng", "Lỗi biển số", "Đỗ sai vị trí", "Khác"].map(t => <option key={t}>{t}</option>)}</select></label><label className="staff-field">Mức độ<select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{Object.entries(severityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><label className="staff-field">Mô tả *<textarea required maxLength={2000} rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label><div className="staff-form-grid">{([['relatedPlate', 'Biển số liên quan'], ['relatedSlotCode', 'Ô đỗ liên quan'], ['relatedGate', 'Cổng liên quan']] as const).map(([key, label]) => <label className="staff-field" key={key}>{label}<input maxLength={100} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}</div><button className="staff-primary" disabled={busy}>{busy ? "Đang gửi…" : "Gửi báo cáo"}</button></form></StaffDialog>}
    {action && <StaffDialog title={action.status === "InProgress" ? "Tiếp nhận sự cố" : "Chuyển quản lý"} onClose={() => { if (!busy) {
        setAction(null);
        setError("");
    } }}><form className="staff-stack" onSubmit={update}><strong>{action.item.title}</strong><StaffStatus status={action.item.status}/>{error && <div className="staff-alert error" role="alert">{error}</div>}{!validAction && <div className="staff-alert">Trạng thái mới không còn cho phép thao tác này. Đóng hộp thoại để xem lại danh sách.</div>}<label className="staff-field">{action.status === "Escalated" ? "Lý do chuyển quản lý *" : "Ghi chú tiếp nhận"}<textarea required={action.status === "Escalated"} maxLength={2000} value={note} onChange={e => setNote(e.target.value)}/></label><button className="staff-primary" disabled={busy || !validAction}>{busy ? "Đang cập nhật…" : "Xác nhận"}</button></form></StaffDialog>}
    {detailId && <IncidentDetails lotId={selectedLotId} id={detailId} onClose={() => setDetailId(null)}/>}
  </div>;
}
function IncidentDetails({ lotId, id, onClose }: {
    lotId: string;
    id: string;
    onClose: () => void;
}) {
    const [detail, setDetail] = useState<IncidentDto | null>(null), [history, setHistory] = useState<IncidentHistoryItemDto[]>([]);
    const [page, setPage] = useState(1), [total, setTotal] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
    useEffect(() => { let current = true; setLoading(true); setError(""); Promise.all([api.getIncidentById(lotId, id), api.getIncidentHistory(lotId, id, page, 10)]).then(([record, log]) => { if (current) {
        setDetail(record);
        setHistory(log.items);
        setTotal(log.totalCount);
    } }).catch(err => { if (current)
        setError(err.message); }).finally(() => { if (current)
        setLoading(false); }); return () => { current = false; }; }, [lotId, id, page, retry]);
    return <StaffDialog title="Chi tiết sự cố" onClose={onClose}><div className="staff-stack">{error && <div className="staff-alert error" role="alert">{error}<button className="staff-button" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>}{detail && <><h3>{detail.title}</h3><StaffStatus status={detail.status}/><p style={{ whiteSpace: "pre-wrap" }}>{detail.description || "Chưa có mô tả."}</p><dl className="staff-detail-grid"><div><dt>Mã sự cố</dt><dd>{detail.incidentId}</dd></div><div><dt>Ghi nhận lúc</dt><dd>{staffDate(detail.detectedAt || detail.reportedAt)}</dd></div><div><dt>Biển số / Ô đỗ</dt><dd>{[detail.relatedPlate, detail.relatedSlotCode].filter(Boolean).join(" · ") || "—"}</dd></div><div><dt>Cổng liên quan</dt><dd>{detail.relatedGate || "—"}</dd></div></dl>{detail.notes && <div className="staff-alert">{detail.notes}</div>}{Boolean(detail.evidence?.length) && <details><summary>Bằng chứng ({detail.evidence?.length})</summary>{detail.evidence?.map((e, i) => <p key={i} className="staff-small" style={{ overflowWrap: "anywhere" }}>{e.kind}: {e.reference}</p>)}</details>}</>}<h3>Lịch sử xử lý</h3>{loading ? <p role="status">Đang tải lịch sử…</p> : !error && !history.length ? <p className="staff-muted">Chưa có lịch sử xử lý.</p> : <ol className="staff-timeline">{history.map((entry, i) => <li key={entry.id || i}><strong>{historyActions[entry.action] || entry.action}</strong><div className="staff-small staff-muted">{staffDate(entry.performedAt)} · Nhân viên #{entry.performedByUserId?.slice(0, 8) || "—"}</div>{entry.toStatus && <div className="staff-small">{incidentStatuses[entry.fromStatus || ""] || entry.fromStatus || "Mới"} → {incidentStatuses[entry.toStatus] || entry.toStatus}</div>}{entry.reason && <p>{entry.reason}</p>}</li>)}</ol>}<StaffPagination page={page} total={total} busy={loading} onChange={setPage}/></div></StaffDialog>;
}
