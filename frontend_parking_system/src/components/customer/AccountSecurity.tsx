import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ShieldCheck, Smartphone, Check, ArrowRight, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, request } from "../../services/api";
import { AccountAlert, AccountPasswordField } from "./AccountUi";
export default function AccountSecurity({ onReauthenticate }: {
    onReauthenticate: (kind: "password" | "mfa") => Promise<void>;
}) {
    const [passwordOpen, setPasswordOpen] = useState(false), [passwordBusy, setPasswordBusy] = useState(false), [passwordError, setPasswordError] = useState("");
    const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState("");
    const [enabled, setEnabled] = useState<boolean | null>(null), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
    const [mfaError, setMfaError] = useState(""), [mfaBusy, setMfaBusy] = useState(false), [mfaForm, setMfaForm] = useState(false), [mfaPassword, setMfaPassword] = useState(""), [code, setCode] = useState("");
    const [setup, setSetup] = useState<{
        secret: string;
        uri: string;
        expiresAt: number;
    } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setMfaError("");
        setEnabled(null);
        request<{
            enabled: boolean;
        }>("/api/v1/auth/mfa", { signal: controller.signal }).then(value => { if (!controller.signal.aborted) {
            if (typeof value.enabled !== "boolean")
                throw new Error("Chưa xác định được trạng thái bảo mật. Hãy tải lại.");
            setEnabled(value.enabled);
        } })
            .catch(e => { if (!controller.signal.aborted)
            setMfaError(e.message || "Không tải được trạng thái bảo mật."); }).finally(() => { if (!controller.signal.aborted)
            setLoading(false); });
        return () => controller.abort();
    }, [revision]);
    useEffect(() => {
        if (!setup)
            return;
        const timer = setTimeout(() => { setSetup(null); setCode(""); setMfaPassword(""); setMfaError("Phiên thiết lập đã hết hạn. Vui lòng bắt đầu lại."); }, Math.max(0, setup.expiresAt - Date.now()));
        return () => clearTimeout(timer);
    }, [setup]);
    async function changePassword(event: FormEvent) {
        event.preventDefault();
        if (passwordBusy)
            return;
        setPasswordError("");
        if (next.length < 8) {
            setPasswordError("Mật khẩu mới cần ít nhất 8 ký tự.");
            return;
        }
        if (next !== confirm) {
            setPasswordError("Mật khẩu xác nhận chưa khớp.");
            return;
        }
        if (current === next) {
            setPasswordError("Mật khẩu mới cần khác mật khẩu hiện tại.");
            return;
        }
        setPasswordBusy(true);
        try {
            if (!await api.changePassword({ password: current, newPassword: next, confirmPassword: confirm }))
                throw new Error("Máy chủ chưa xác nhận đổi mật khẩu.");
            setCurrent("");
            setNext("");
            setConfirm("");
            setSetup(null);
            setMfaPassword("");
            setCode("");
            await onReauthenticate("password");
        }
        catch (e) {
            setPasswordError(e instanceof Error ? e.message : "Không đổi được mật khẩu.");
        }
        finally {
            setPasswordBusy(false);
        }
    }
    function cancelMfa() { setMfaForm(false); setSetup(null); setMfaPassword(""); setCode(""); setMfaError(""); }
    async function submitMfa(event: FormEvent) {
        event.preventDefault();
        if (mfaBusy || enabled === null || loading)
            return;
        setMfaBusy(true);
        setMfaError("");
        try {
            if (!enabled && !setup) {
                const result = await request<{
                    secret: string;
                    uri: string;
                }>("/api/v1/auth/mfa/setup", { method: "POST", body: JSON.stringify({ password: mfaPassword }) });
                if (!result.secret || !result.uri?.startsWith("otpauth://totp/"))
                    throw new Error("Chưa nhận được thông tin thiết lập hợp lệ. Hãy thử lại.");
                setSetup({ ...result, expiresAt: Date.now() + 590000 });
                setCode("");
            }
            else {
                if (!/^\d{6}$/.test(code)) {
                    setMfaError("Nhập mã gồm 6 chữ số từ ứng dụng xác thực.");
                    return;
                }
                const result = await request<{
                    enabled: boolean;
                }>(`/api/v1/auth/mfa/${enabled ? "disable" : "enable"}`, { method: "POST", body: JSON.stringify({ password: mfaPassword, code }) });
                if (result.enabled !== !enabled)
                    throw new Error("Chưa xác nhận được thay đổi bảo mật. Tải lại trạng thái trước khi tiếp tục.");
                cancelMfa();
                await onReauthenticate("mfa");
            }
        }
        catch (e) {
            setMfaError(e instanceof Error ? e.message : "Không cập nhật được xác thực hai bước.");
        }
        finally {
            setMfaBusy(false);
        }
    }
    return <div className="account-stack">
    <section className="account-panel"><div className="account-panel-heading"><span className="account-section-icon"><KeyRound size={22}/></span><div><h2>Mật khẩu</h2><p>Bảo vệ tài khoản bằng một mật khẩu riêng, đủ mạnh.</p></div></div><AccountAlert error={passwordError}/>
      {!passwordOpen ? <div className="account-security-row"><div><strong>Thay đổi mật khẩu đăng nhập</strong><p>Sau khi đổi, bạn cần đăng nhập lại bằng mật khẩu mới.</p></div><button className="account-button" onClick={() => setPasswordOpen(true)}>Đổi mật khẩu<ArrowRight size={15}/></button></div> : <form onSubmit={changePassword} className="account-form"><AccountPasswordField label="Mật khẩu hiện tại" value={current} onChange={setCurrent} autoComplete="current-password" disabled={passwordBusy}/><div className="account-form-grid"><AccountPasswordField label="Mật khẩu mới" value={next} onChange={setNext} autoComplete="new-password" minLength={8} disabled={passwordBusy}/><AccountPasswordField label="Xác nhận mật khẩu mới" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} disabled={passwordBusy}/></div><p className="account-muted">Dùng ít nhất 8 ký tự, kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt.</p><div className="account-row"><button className="account-primary" disabled={passwordBusy}>{passwordBusy ? "Đang cập nhật…" : "Lưu mật khẩu mới"}</button><button type="button" className="account-button" disabled={passwordBusy} onClick={() => { setPasswordOpen(false); setCurrent(""); setNext(""); setConfirm(""); setPasswordError(""); }}>Hủy</button></div></form>}
    </section>
    <section className="account-panel"><div className="account-panel-heading"><span className="account-section-icon"><ShieldCheck size={22}/></span><div><h2>Xác thực hai bước</h2><p>Thêm một lớp bảo vệ bằng mã từ ứng dụng xác thực.</p></div>{enabled !== null && <span className={`account-security-badge ${enabled ? "enabled" : ""}`}>{enabled ? <><Check size={13}/>Đang bật</> : "Chưa bật"}</span>}</div>
      <AccountAlert error={mfaError}/>{loading ? <div className="account-empty" role="status">Đang kiểm tra trạng thái bảo mật…</div> : enabled === null ? <button className="account-button" onClick={() => setRevision(n => n + 1)}><RefreshCw size={15}/>Tải lại trạng thái</button> : !mfaForm ? <div className="account-security-row"><div><strong>{enabled ? "Tài khoản đang được bảo vệ hai bước" : "Bảo vệ thêm cho mỗi lần đăng nhập"}</strong><p>Dùng Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương thích.</p></div><button className="account-button" onClick={() => setMfaForm(true)}>{enabled ? "Tắt xác thực hai bước" : "Thiết lập xác thực"}<Smartphone size={16}/></button></div> : <form className="account-form" onSubmit={submitMfa}>
        <p className="account-muted">{enabled ? "Nhập mật khẩu hiện tại và mã ứng dụng để tắt xác thực hai bước." : "Xác nhận mật khẩu, sau đó liên kết ứng dụng xác thực và nhập mã để hoàn tất."}</p>
        <AccountPasswordField label="Mật khẩu xác nhận bảo mật" value={mfaPassword} onChange={setMfaPassword} autoComplete="current-password" disabled={mfaBusy}/>
        {setup && <div className="account-mfa-setup"><div className="account-mfa-qr"><QRCodeSVG value={setup.uri} size={190} marginSize={4} title="QR thiết lập xác thực hai bước"/></div><div><h3>Quét mã bằng ứng dụng xác thực</h3><p>Hoàn tất trong 10 phút. Giữ riêng mã QR và khóa thiết lập này.</p><details><summary>Nhập khóa thủ công</summary><code>{setup.secret}</code></details></div></div>}
        {(enabled || setup) && <label className="account-field">Mã xác thực 6 số<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required value={code} disabled={mfaBusy} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}/></label>}
        <div className="account-row"><button className="account-primary" disabled={mfaBusy || !mfaPassword || ((enabled || Boolean(setup)) && code.length !== 6)}>{mfaBusy ? "Đang xử lý…" : enabled ? "Xác nhận tắt" : setup ? "Xác nhận bật" : "Tiếp tục thiết lập"}</button><button type="button" className="account-button" disabled={mfaBusy} onClick={cancelMfa}>Hủy thiết lập</button></div>
        <p className="account-footnote">Nếu đăng nhập Google và chưa có mật khẩu, hãy <Link to="/forgot-password">thiết lập mật khẩu</Link> trước khi bật xác thực hai bước.</p>
      </form>}
    </section>
  </div>;
}
