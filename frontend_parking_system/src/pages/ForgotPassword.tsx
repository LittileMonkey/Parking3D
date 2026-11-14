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

type Step = "email" | "password" | "success";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        await api.forgetPassword(normalized);
        setEmail(normalized);
        setNotice("Nếu email đã được đăng ký, mã xác thực sẽ được gửi đến hộp thư. Mã có hiệu lực trong 5 phút.");
        setStep("password");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không gửi được mã OTP khôi phục.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!/^\d{6}$/.test(otp)) { setError("Mã xác thực phải gồm đúng 6 chữ số."); return; }

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
      setOtp(""); setPassword(""); setConfirmPassword("");
      setStep("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(/expired|no active verification/i.test(message) ? "Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới."
        : /maximum verification|locked/i.test(message) ? "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi yêu cầu mã mới."
        : /verification code is incorrect|otp.*invalid/i.test(message) ? "Mã xác thực chưa đúng. Vui lòng kiểm tra email."
        : "Không đặt lại được mật khẩu. Vui lòng kiểm tra mã xác thực và thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError("");
    setNotice("");
    setOtp(""); setPassword(""); setConfirmPassword(""); setStep("email");
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
                  {step === "password" && "Tạo mật khẩu mới"}
                </h2>
                <p className="auth-card-subtitle">
                  {step === "email" && "Nhập email đã đăng ký để nhận mã xác thực."}
                  {step === "password" && <>Nhập mã gửi tới <strong>{email}</strong> và mật khẩu mới.</>}
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

                {step === "password" && (
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
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          className="auth-input"
                          required
                          disabled={busy}
                        />
                        <button type="button" className="auth-password-toggle" aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"} onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={busy}>
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Primary Action Button (Deep Navy) */}
                <button className="auth-submit-btn" type="submit" disabled={busy}>
                  {busy
                    ? "Đang xử lý..."
                    : step === "email"
                    ? "Gửi mã khôi phục"
                    : "Đổi mật khẩu"}
                </button>
              </form>

              {step === "password" && (
                <div style={{ marginTop: "16px", textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={busy}
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
                    Gửi lại mã / đổi email
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
