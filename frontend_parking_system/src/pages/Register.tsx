import GoogleSignIn from "../components/auth/GoogleSignIn";
import { useState, useMemo, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../services/api";
import AuthShowcase from "../components/auth/AuthShowcase";
import "./Auth.css";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);

  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tính toán độ mạnh mật khẩu theo thời gian thực (0 to 4)
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    if (password.length < 8) return 1;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1;
    return Math.min(score, 4);
  }, [password]);

  const strengthLabel = useMemo(() => {
    switch (passwordStrength) {
      case 1: return { text: "Yếu", level: "level-1" };
      case 2: return { text: "Trung bình", level: "level-2" };
      case 3: return { text: "Khá an toàn", level: "level-3" };
      case 4: return { text: "Rất mạnh", level: "level-4" };
      default: return { text: "Chưa đạt", level: "" };
    }
  }, [passwordStrength]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp với mật khẩu đã nhập.");
      return;
    }
    if (!agreedTerms) {
      setError("Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.");
      return;
    }

    setLoading(true);
    try {
      await api.register({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phoneE164: phone,
        password,
      });
      setComplete(true);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng ký. Màn hình sẵn sàng tại POST /api/v1/auth/register.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout auth-split-layout--register">
      {/* Ambient Radial Lighting */}
      <div className="auth-ambient-glow top-left" aria-hidden="true" />
      <div className="auth-ambient-glow bottom-right" aria-hidden="true" />

      <AuthShowcase variant="register" />

      {/* RIGHT COLUMN: REGISTER FORM */}
      <main className="auth-form-wrapper">
        <nav className="auth-top-nav">
          <Link to="/" className="auth-nav-link">
            <ArrowLeft size={15} /> Trang chủ
          </Link>
        </nav>

        <section className="auth-card" aria-labelledby="register-heading">
          {complete ? (
            /* REGISTRATION SUCCESS VIEW */
            <div className="auth-success-card">
              <div className="auth-success-icon-box">
                <CheckCircle2 size={38} />
              </div>
              <h2 id="register-heading" className="auth-card-title">Đăng ký thành công!</h2>
              <p className="auth-card-subtitle" style={{ marginBottom: "24px" }}>
                Chào mừng bạn đến với ParkMatrix. Tài khoản <strong>{email}</strong> đã sẵn sàng hoạt động.
              </p>
              <Link to="/login" className="auth-submit-btn" style={{ textDecoration: "none" }}>
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            /* REGISTRATION FORM VIEW */
            <>
              <header className="auth-card-header">
                <h2 id="register-heading" className="auth-card-title">Tạo tài khoản</h2>
                <p className="auth-card-subtitle">
                  Điền thông tin để bắt đầu trải nghiệm hệ thống đỗ xe thông minh.
                </p>
              </header>

              {error && (
                <div className="auth-alert auth-alert-error" role="alert">
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{error}</div>
                </div>
              )}

              <form className="auth-form auth-register-form" onSubmit={submit}>
                {/* Full Name Field */}
                <div className="auth-form-field">
                  <label htmlFor="register-name" className="auth-form-label">
                    <User size={14} /> Họ và tên
                  </label>
                  <div className="auth-input-wrapper">
                    <User size={17} className="auth-input-icon" />
                    <input
                      id="register-name"
                      type="text"
                      autoComplete="name"
                      maxLength={100}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn An"
                      className="auth-input"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="auth-form-field">
                  <label htmlFor="register-email" className="auth-form-label">
                    <Mail size={14} /> Địa chỉ Email
                  </label>
                  <div className="auth-input-wrapper">
                    <Mail size={17} className="auth-input-icon" />
                    <input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      maxLength={255}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="auth-input"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="auth-form-field">
                  <label htmlFor="register-phone" className="auth-form-label">
                    <Phone size={14} /> Số điện thoại
                  </label>
                  <div className="auth-input-wrapper">
                    <Phone size={17} className="auth-input-icon" />
                    <input
                      id="register-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 678 hoặc +84…"
                      maxLength={24}
                      className="auth-input"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="auth-form-field auth-password-field" data-strength={passwordStrength}>
                  <div className="auth-field-heading">
                    <label htmlFor="register-password" className="auth-form-label">
                      <Lock size={14} /> Mật khẩu
                    </label>
                    <span id="register-password-strength" className="auth-password-hint">
                      {password ? strengthLabel.text : "Tối thiểu 8 ký tự"}
                    </span>
                  </div>
                  <div className="auth-input-wrapper">
                    <Lock size={17} className="auth-input-icon" />
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      aria-describedby="register-password-strength"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      className="auth-input"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      aria-controls="register-password"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <span
                    className="auth-password-meter"
                    role="meter"
                    aria-label="Độ mạnh mật khẩu"
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-valuenow={passwordStrength}
                    aria-valuetext={password ? strengthLabel.text : "Chưa nhập mật khẩu"}
                  >
                    {[1, 2, 3, 4].map((segment) => (
                      <span key={segment} className={passwordStrength >= segment ? "is-filled" : ""} aria-hidden="true" />
                    ))}
                  </span>
                </div>

                {/* Confirm Password Field */}
                <div className="auth-form-field">
                  <div className="auth-field-heading">
                    <label htmlFor="register-confirm" className="auth-form-label">
                      <ShieldCheck size={14} /> Xác nhận mật khẩu
                    </label>
                    {confirmPassword && password === confirmPassword && (
                      <span className="auth-password-match"><Check size={14} /> Khớp</span>
                    )}
                  </div>
                  <div className="auth-input-wrapper">
                    <ShieldCheck size={17} className="auth-input-icon" />
                    <input
                      id="register-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="auth-input"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                      aria-controls="register-confirm"
                      aria-pressed={showConfirmPassword}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "4px" }}>
                  <input
                    id="register-terms"
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "var(--color-navy)", cursor: "pointer" }}
                  />
                  <label htmlFor="register-terms" style={{ fontSize: "12.5px", color: "var(--color-navy-muted)", cursor: "pointer", lineHeight: "1.5" }}>
                    Tôi đồng ý với{" "}
                    <Link to="/terms" style={{ color: "var(--color-navy)", fontWeight: 600, textDecoration: "underline" }} target="_blank">
                      Điều khoản
                    </Link>{" "}
                    và{" "}
                    <Link to="/privacy" style={{ color: "var(--color-navy)", fontWeight: 600, textDecoration: "underline" }} target="_blank">
                      Chính sách bảo mật
                    </Link>.
                  </label>
                </div>

                {/* Submit CTA (Deep Navy) */}
                <button className="auth-submit-btn" type="submit" disabled={loading}>
                  {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản ngay"}
                </button>
              </form>

              {/* Divider */}
              <div className="auth-divider">
                <span>hoặc</span>
              </div>

              {/* Google Signup Button */}
              <GoogleSignIn signup disabled={!agreedTerms || loading} />

              {/* Footer Switch */}
              <p className="auth-switch-text">
                Đã có tài khoản ParkMatrix?
                <Link to="/login">Đăng nhập</Link>
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
