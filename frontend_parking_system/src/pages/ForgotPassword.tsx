import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import AuthShowcase from "../components/auth/AuthShowcase";
import "./Auth.css";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (step === "email") {
      const normalized = email.trim().toLowerCase();
      setBusy(true);
      try {
        const res = await api.forgetPassword(normalized);
        setEmail(normalized);
        setNotice(res?.message || "Đã gửi mã PIN khôi phục qua email. Vui lòng kiểm tra hộp thư.");
        setStep("otp");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không gửi được mã OTP khôi phục.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === "otp") {
      if (!/^\d{6}$/.test(otp)) {
        setError("Mã OTP phải gồm đúng 6 chữ số.");
        return;
      }
      setStep("password");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu mới cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp với mật khẩu mới.");
      return;
    }

    setBusy(true);
    try {
      await api.resetPassword(email, otp, password);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đặt lại được mật khẩu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError("");
    setNotice("");
    setStep(step === "password" ? "otp" : "email");
  };

  return (
    <div className="auth-split-layout">
      {/* Ambient Radial Lighting */}
      <div className="auth-ambient-glow top-left" aria-hidden="true" />
      <div className="auth-ambient-glow bottom-right" aria-hidden="true" />

      <AuthShowcase variant="recovery" />

      {/* RIGHT COLUMN: FORGOT FORM */}
      <main className="auth-form-wrapper">
        <nav className="auth-top-nav">
          <Link to="/login" className="auth-nav-link">
            <ArrowLeft size={15} /> Đăng nhập
          </Link>
        </nav>

        <section className="auth-card" aria-labelledby="forgot-heading">
          {step === "success" ? (
            <div className="auth-success-card">
              <div className="auth-success-icon-box">
                <CheckCircle2 size={38} />
              </div>
              <h2 id="forgot-heading" className="auth-card-title">Đổi mật khẩu thành công!</h2>
              <p className="auth-card-subtitle" style={{ marginBottom: "24px" }}>
                Mật khẩu của tài khoản <strong>{email}</strong> đã được cập nhật thành công.
              </p>
              <Link to="/login" className="auth-submit-btn" style={{ textDecoration: "none" }}>
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            <>
              <header className="auth-card-header">
                <h2 id="forgot-heading" className="auth-card-title">
                  {step === "email" && "Quên mật khẩu?"}
                  {step === "otp" && "Xác thực mã OTP"}
                  {step === "password" && "Tạo mật khẩu mới"}
                </h2>
                <p className="auth-card-subtitle">
                  {step === "email" && "Nhập email đã đăng ký để nhận mã PIN khôi phục."}
                  {step === "otp" && <>Nhập mã 6 chữ số đã gửi tới <strong>{email}</strong>.</>}
                  {step === "password" && "Thiết lập mật khẩu mới có ít nhất 8 ký tự."}
                </p>
              </header>

              {error && (
                <div className="auth-alert auth-alert-error" role="alert">
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{error}</div>
                </div>
              )}

              {notice && (
                <div className="auth-alert auth-alert-notice" role="status">
                  <div>{notice}</div>
                </div>
              )}

              <form className="auth-form" onSubmit={submit}>
                {step === "email" && (
                  <div className="auth-form-field">
                    <label htmlFor="forgot-email" className="auth-form-label">
                      <Mail size={14} /> Địa chỉ Email
                    </label>
                    <div className="auth-input-wrapper">
                      <Mail size={17} className="auth-input-icon" />
                      <input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="auth-input"
                        required
                        disabled={busy}
                      />
                    </div>
                  </div>
                )}

                {step === "otp" && (
                  <div className="auth-form-field">
                    <label htmlFor="forgot-otp" className="auth-form-label">
                      <KeyRound size={14} /> Mã xác thực (OTP 6 số)
                    </label>
                    <div className="auth-input-wrapper">
                      <KeyRound size={17} className="auth-input-icon" />
                      <input
                        id="forgot-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="auth-input"
                        required
                        disabled={busy}
                      />
                    </div>
                  </div>
                )}

                {step === "password" && (
                  <>
                    <div className="auth-form-field">
                      <label htmlFor="forgot-password" className="auth-form-label">
                        <Lock size={14} /> Mật khẩu mới
                      </label>
                      <div className="auth-input-wrapper">
                        <Lock size={17} className="auth-input-icon" />
                        <input
                          id="forgot-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Tối thiểu 8 ký tự"
                          className="auth-input"
                          required
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="auth-password-toggle"
                          aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={busy}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <div className="auth-form-field">
                      <label htmlFor="forgot-confirm" className="auth-form-label">
                        <ShieldCheck size={14} /> Xác nhận mật khẩu mới
                      </label>
                      <div className="auth-input-wrapper">
                        <ShieldCheck size={17} className="auth-input-icon" />
                        <input
                          id="forgot-confirm"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          className="auth-input"
                          required
                          disabled={busy}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Primary Action Button (Deep Navy) */}
                <button className="auth-submit-btn" type="submit" disabled={busy}>
                  {busy
                    ? "Đang xử lý..."
                    : step === "email"
                    ? "Gửi mã PIN khôi phục"
                    : step === "otp"
                    ? "Xác thực mã OTP"
                    : "Đổi mật khẩu"}
                </button>
              </form>

              {(step === "otp" || step === "password") && (
                <div style={{ marginTop: "16px", textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={goBack}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-navy)",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <ArrowLeft size={14} />
                    {step === "otp" ? "Quay lại nhập email" : "Quay lại nhập OTP"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
