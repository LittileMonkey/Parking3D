import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, KeyRound, AlertCircle, Sparkles, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { request } from "../services/api";
import "./Auth.css";

export default function GuestLogin() {
  const { guestLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/v1/auth/guest/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setNotice("Mã OTP xác thực đã được gửi đến email của bạn (hiệu lực 5 phút).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được mã OTP. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await guestLogin(email.trim().toLowerCase(), code.trim());
      navigate("/booking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mã xác thực không đúng hoặc đã hết hạn.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pm-auth-page">
      <div className="pm-auth-ambient-glow" />

      <Link className="pm-auth-back-btn" to="/login">
        <ArrowLeft size={16} /> Quay lại đăng nhập mật khẩu
      </Link>

      <section className="pm-auth-card" aria-labelledby="guest-title">
        <header className="pm-auth-brand">
          <div className="pm-auth-logo-badge">
            <Sparkles size={26} />
          </div>
          <h1 id="guest-title" className="pm-auth-title">Đăng nhập Khách</h1>
          <p className="pm-auth-subtitle">
            Nhận mã OTP qua email để vào đặt chỗ đỗ xe nhanh chóng mà không cần nhớ mật khẩu
          </p>
        </header>

        {error && (
          <div className="pm-auth-alert" role="alert">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="pm-auth-notice" role="status" style={{ marginBottom: 14 }}>
            {notice}
          </div>
        )}

        <div className="pm-auth-form">
          <div className="pm-auth-field">
            <label className="pm-auth-label" htmlFor="guest-email">
              Địa chỉ Email nhận mã
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="pm-auth-input-wrapper" style={{ flex: 1 }}>
                <span className="pm-auth-input-icon">
                  <Mail size={17} />
                </span>
                <input
                  id="guest-email"
                  className="pm-auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                className="pm-auth-submit-btn"
                style={{ width: "auto", padding: "0 16px", marginTop: 0, whiteSpace: "nowrap" }}
                disabled={busy || !email.includes("@")}
                onClick={() => void send()}
              >
                <Send size={15} /> Gửi mã
              </button>
            </div>
          </div>

          <div className="pm-auth-field">
            <label className="pm-auth-label" htmlFor="guest-code">
              Mã xác thực OTP (6 chữ số)
            </label>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <KeyRound size={17} />
              </span>
              <input
                id="guest-code"
                className="pm-auth-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Nhập 6 số gửi về email"
                style={{ letterSpacing: "0.2em", fontFamily: "monospace" }}
                disabled={busy}
              />
            </div>
          </div>

          <button
            className="pm-auth-submit-btn"
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void verify()}
          >
            {busy ? "Đang xác thực..." : "Xác nhận & Đi đến đặt chỗ"}
          </button>
        </div>

        <p className="pm-auth-footer">
          Nhân viên hoặc Quản lý bãi xe?
          <Link to="/login">Đăng nhập tài khoản nội bộ</Link>
        </p>
      </section>
    </main>
  );
}
