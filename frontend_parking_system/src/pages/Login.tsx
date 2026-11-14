import GoogleSignIn from "../components/auth/GoogleSignIn";
import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  AlertCircle
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth, getRedirectPathForUser } from "../context/AuthContext";
import AuthShowcase from "../components/auth/AuthShowcase";
import "./Auth.css";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturn = searchParams.get("returnTo");
  // Only local booking/payment routes are accepted, including after VNPay returns.
  const returnTo = requestedReturn && /^\/(?:booking(?:\/[^/?#\\]+)?|bookings\/[^/?#\\]+|payment-return|account|security)(?:\?[^#\\]*)?$/.test(requestedReturn)
    ? requestedReturn : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Nếu tài khoản đã có phiên hợp lệ, tự động điều hướng vào dashboard
  useEffect(() => {
    if (user) {
      const rolePath = getRedirectPathForUser(user);
      const targetPath = rolePath === "/" ? returnTo ?? rolePath : rolePath;
      if (targetPath !== "/") {
        navigate(targetPath, { replace: true });
      }
    }
  }, [user, navigate, returnTo]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const authUser = await login(
        email.trim().toLowerCase(),
        password,
        mfaCode.trim() || undefined,
        rememberMe
      );

      // Điều hướng chính xác theo vai trò
      const rolePath = getRedirectPathForUser(authUser);
      const targetPath = rolePath === "/" ? returnTo ?? rolePath : rolePath;
      navigate(targetPath, { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && (cause.errorCode === "MFA_REQUIRED" || cause.message.startsWith("MFA_REQUIRED:"))) {
        setShowMfa(true);
        setError("Nhập mã 6 số từ ứng dụng xác thực để tiếp tục đăng nhập.");
      } else if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng nhập. Màn hình sẵn sàng tại POST /api/v1/auth/login.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng nhập chưa thành công. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      {/* Ambient Radial Lighting */}
      <div className="auth-ambient-glow top-left" aria-hidden="true" />
      <div className="auth-ambient-glow bottom-right" aria-hidden="true" />

      <AuthShowcase variant="login" />

      {/* RIGHT COLUMN: LOGIN FORM */}
      <main className="auth-form-wrapper">
        <nav className="auth-top-nav">
          <Link to="/" className="auth-nav-link">
            <ArrowLeft size={15} /> Trang chủ
          </Link>
        </nav>

        <section className="auth-card" aria-labelledby="login-heading">
          <header className="auth-card-header">
            <h2 id="login-heading" className="auth-card-title">Đăng nhập</h2>
            <p className="auth-card-subtitle">
              Chào mừng bạn quay lại. Nhập thông tin để tiếp tục trải nghiệm.
            </p>
          </header>

          {["password", "mfa"].includes(searchParams.get("updated") || "") && <div className="auth-alert auth-alert-notice" role="status">{searchParams.get("updated") === "password" ? "Mật khẩu đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu mới." : "Cài đặt xác thực hai bước đã được cập nhật. Hãy đăng nhập lại."}</div>}
          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            {/* Email Field */}
            <div className="auth-form-field">
              <label htmlFor="login-email" className="auth-form-label">
                <Mail size={14} /> Địa chỉ Email
              </label>
              <div className="auth-input-wrapper">
                <Mail size={17} className="auth-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="auth-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-form-field">
              <label htmlFor="login-password" className="auth-form-label">
                <Lock size={14} /> Mật khẩu
              </label>
              <div className="auth-input-wrapper">
                <Lock size={17} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="auth-input"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* QUÊN MẬT KHẨU NẰM DƯỚI DÒNG MẬT KHẨU */}
              <div className="auth-password-subrow">
                <Link to="/forgot-password" className="auth-forgot-link">
                  Quên mật khẩu?
                </Link>
              </div>
            </div>

            {showMfa && (
              <div className="auth-form-field">
                <label htmlFor="login-mfa" className="auth-form-label">
                  <KeyRound size={14} /> Mã xác thực
                </label>
                <div className="auth-input-wrapper">
                  <KeyRound size={17} className="auth-input-icon" />
                  <input
                    id="login-mfa"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Mã 6 số từ ứng dụng xác thực"
                    className="auth-input"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Remember Me Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--color-navy)", cursor: "pointer" }}
              />
              <label htmlFor="login-remember" style={{ fontSize: "13px", color: "var(--color-navy-muted)", cursor: "pointer" }}>
                Ghi nhớ đăng nhập
              </label>
            </div>

            {/* Primary Action Button (Deep Navy) */}
            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? "Đang xác thực..." : "Đăng nhập ngay"}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>hoặc</span>
          </div>

          {/* Google Login Button with official Google SVG Icon */}
          <GoogleSignIn remember={rememberMe} returnTo={returnTo ?? "/"} />

          {/* Footer to Register */}
          <p className="auth-switch-text">
            Chưa có tài khoản?
            <Link to="/register">Đăng ký thành viên</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
