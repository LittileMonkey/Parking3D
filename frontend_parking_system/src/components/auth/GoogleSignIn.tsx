import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectPathForUser, useAuth } from "../../context/AuthContext";
import { ApiError } from "../../services/api";

type Identity = {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
};
declare global { interface Window { google?: { accounts: { id: Identity } } } }
let loading: Promise<Identity> | null = null;
function loadIdentity(): Promise<Identity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error("Chưa tải được đăng nhập Google. Vui lòng thử lại.")); };
    const timer = setTimeout(fail, 15000);
    script.src = "https://accounts.google.com/gsi/client?hl=vi";
    script.async = true;
    script.onload = () => { clearTimeout(timer); if (window.google?.accounts.id) resolve(window.google.accounts.id); else fail(); };
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}

export default function GoogleSignIn({ remember = false, returnTo = "/", disabled = false, signup = false }: { remember?: boolean; returnTo?: string; disabled?: boolean; signup?: boolean }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const credential = useRef("");
  const locked = useRef(false);
  const [mfa, setMfa] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const latest = useRef({ remember, returnTo, disabled, loginWithGoogle });
  latest.current = { remember, returnTo, disabled, loginWithGoogle };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; credential.current = ""; }; }, []);
  useEffect(() => {
    if (!mfa) return;
    const timer = setTimeout(() => { credential.current = ""; setCode(""); setMfa(false); setError("Phiên Google đã hết hạn. Vui lòng chọn tài khoản lại."); }, 5 * 60000);
    return () => clearTimeout(timer);
  }, [mfa]);
  async function accept(token: string, mfaCode?: string) {
    if (locked.current || latest.current.disabled || !token) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const user = await latest.current.loginWithGoogle(token, mfaCode, latest.current.remember);
      credential.current = "";
      if (mounted.current) { const path = getRedirectPathForUser(user); navigate(path === "/" ? latest.current.returnTo : path, { replace: true }); }
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && (cause.errorCode === "MFA_REQUIRED" || cause.message.startsWith("MFA_REQUIRED:"))) {
        credential.current = token; setMfa(true); setError("Nhập mã từ ứng dụng xác thực để tiếp tục.");
      } else setError(cause instanceof Error ? cause.message : "Đăng nhập Google chưa thành công.");
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) { setError("Đăng nhập Google hiện chưa khả dụng. Vui lòng dùng email và mật khẩu."); return; }
    setError("");
    void loadIdentity().then(id => {
      if (!active || !host.current) return;
      id.initialize({ client_id: clientId, callback: response => { if (active) void accept(response.credential); } });
      host.current.replaceChildren();
      id.renderButton(host.current, { type: "standard", theme: "outline", size: "large", shape: "pill", text: signup ? "signup_with" : "signin_with", locale: "vi", width: Math.min(400, host.current.clientWidth) });
    }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [retry, signup]);
  return <div className="auth-google-section">
    <div ref={host} style={{ display: mfa ? "none" : "flex", justifyContent: "center", minHeight: 40, pointerEvents: busy || disabled ? "none" : "auto", opacity: disabled ? .5 : 1 }} inert={busy || disabled} />
    {disabled && <p className="auth-password-hint">Đồng ý với điều khoản để tiếp tục.</p>}
    {error && <p role="alert" className="auth-alert auth-alert-notice">{error}</p>}
    {busy && <p role="status">Đang xác thực…</p>}
    {mfa && <form className="auth-form" onSubmit={e => { e.preventDefault(); void accept(credential.current, code); }}>
      <label className="auth-form-label" htmlFor="google-mfa">Mã xác thực Google</label>
      <input id="google-mfa" className="auth-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required disabled={busy} />
      <button className="auth-submit-btn" disabled={busy}>Xác nhận đăng nhập</button>
      <button type="button" className="auth-google-btn" disabled={busy} onClick={() => { credential.current = ""; setMfa(false); setCode(""); setError(""); }}>Chọn tài khoản khác</button>
    </form>}
    {!mfa && error && <button type="button" className="auth-google-btn" onClick={() => setRetry(n => n + 1)}>Thử lại Google</button>}
  </div>;
}
