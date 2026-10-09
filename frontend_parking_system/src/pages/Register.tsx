import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../services/api";

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim();
      const response = await api.register({
        userName: normalizedEmail,
        email: normalizedEmail,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });
      const parsedExpiry = response.expiresAt ? Date.parse(response.expiresAt) : Number.NaN;
      const expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 60_000;
      sessionStorage.setItem("parking.pendingVerificationEmail", normalizedEmail);
      sessionStorage.setItem("parking.emailOtpExpiresAt", String(expiresAt));
      navigate("/verify-email", { state: { email: normalizedEmail } });
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend chưa hỗ trợ đăng ký và gửi mã xác thực email. Cần triển khai POST /api/v1/auth/register.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="simple-auth-page">
      <Link className="simple-auth-back" to="/">
        <ArrowLeft size={16} /> Quay về trang chủ
      </Link>

      <section className="simple-auth-card simple-register-card" aria-labelledby="register-title">
        <header className="simple-auth-heading">
          <h1 id="register-title">Tạo tài khoản</h1>
          <p>Điền thông tin để đăng ký ParkMatrix</p>
        </header>

        <form className="simple-auth-form simple-register-form" onSubmit={submit}>
          {error && <div className="simple-auth-alert" role="alert">{error}</div>}
          <label htmlFor="register-name">Họ và tên</label>
          <input
            id="register-name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn An"
            required
            disabled={loading}
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            disabled={loading}
          />

          <label htmlFor="register-phone">Số điện thoại</label>
          <input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            pattern="[+]?[0-9]{9,15}"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="0901234567"
            required
            disabled={loading}
          />

          <label htmlFor="register-password">Mật khẩu</label>
          <div className="simple-auth-password">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ít nhất 8 ký tự"
              required
              disabled={loading}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="register-confirm">Xác nhận mật khẩu</label>
          <input
            id="register-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Nhập lại mật khẩu"
            required
            disabled={loading}
          />

          <button className="simple-auth-submit" type="submit" disabled={loading}>
            {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </button>
        </form>

        <div className="simple-auth-divider"><span>hoặc</span></div>
        <button
          className="simple-auth-google"
          type="button"
          onClick={() => setGoogleNotice("Đăng ký Google chưa được kết nối. Cần cấu hình OAuth ở backend.")}
        >
          <span className="google-mark" aria-hidden="true">G</span>
          Đăng ký với Google
        </button>
        {googleNotice && <p className="simple-auth-notice" role="status">{googleNotice}</p>}

        <p className="simple-auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}
