import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ParkingCircle, UserRound, ShieldCheck, Sparkles, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(userName.trim(), password);
      navigate("/");
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng nhập. Màn hình đã sẵn sàng tích hợp tại POST /api/v1/auth/login.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng nhập chưa thành công. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-page">
      {/* LEFT BANNER: 50% Split */}
      <div className="login-banner">
        {/* Background photo & overlay */}
        <div className="login-banner-bg" style={{ backgroundImage: `url(/assets/smart_parking_banner.jpg)` }} />
        <div className="login-banner-overlay" />
        
        {/* Top Header */}
        <div className="login-banner-top">
          <Link className="login-brand" to="/">
            <span className="brand-mark-glow">
              <ParkingCircle size={24} />
              <i className="pulse-dot" />
            </span>
            <div className="brand-text">
              <strong>Park<span>Matrix</span></strong>
              <small>SMART 3D PARKING</small>
            </div>
          </Link>
          <Link className="back-home-pill" to="/">
            <ArrowLeft size={15} /> Trang chủ
          </Link>
        </div>

        {/* Center Content & Slogan */}
        <div className="login-banner-body">
          <div className="slogan-badge">
            <Sparkles size={14} />
            <span>NỀN TẢNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH</span>
          </div>
          <h1 className="slogan-title">
            Tối ưu vị trí,<br />
            <span className="gradient-teal">nâng tầm giá trị.</span>
          </h1>
          <p className="slogan-sub">
            Hệ thống giám sát không gian đỗ xe 3D đa cơ sở theo thời gian thực, điều phối thông minh và bảo mật tuyệt đối.
          </p>

          {/* Dynamic LED Slot Status Overlay Widgets */}
          <div className="live-slots-widget">
            <div className="widget-header">
              <div className="live-tag">
                <span className="live-led-dot" />
                <span>LIVE SYSTEM STATUS</span>
              </div>
              <Activity size={16} className="widget-icon" />
            </div>
            <div className="slot-grid-preview">
              <div className="slot-item available">
                <span className="slot-code">A-01</span>
                <span className="slot-status-dot" />
                <span className="slot-label">Trống</span>
              </div>
              <div className="slot-item occupied">
                <span className="slot-code">A-02</span>
                <span className="slot-status-dot" />
                <span className="slot-label">Đang đỗ</span>
              </div>
              <div className="slot-item available">
                <span className="slot-code">A-03</span>
                <span className="slot-status-dot" />
                <span className="slot-label">Trống</span>
              </div>
              <div className="slot-item occupied">
                <span className="slot-code">B-12</span>
                <span className="slot-status-dot" />
                <span className="slot-label">Đang đỗ</span>
              </div>
            </div>
            <div className="widget-footer">
              <span><strong className="text-teal">142</strong> / 180 Ô trống khả dụng</span>
              <span className="widget-facility">Cơ sở: Tòa nhà Central Hub</span>
            </div>
          </div>
        </div>

        {/* Bottom Security Info */}
        <div className="login-banner-bottom">
          <div className="security-tag">
            <ShieldCheck size={16} />
            <span>PostgreSQL Advisory Lock Protocol Guard Enabled</span>
          </div>
        </div>
      </div>

      {/* RIGHT FORM: 50% Split */}
      <div className="login-form-container">
        <div className="login-form-card">
          <div className="login-header">
            <h2>Đăng nhập hệ thống</h2>
            <p>Nhập thông tin tài khoản của bạn để tiếp tục truy cập ParkMatrix.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            {error && (
              <div className="login-error-alert" role="alert">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login-username">Tên đăng nhập hoặc Email</label>
              <div className="input-field-wrapper">
                <UserRound size={18} className="field-icon" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Nhập tên đăng nhập hoặc email"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="login-password">Mật khẩu</label>
              </div>
              <div className="input-field-wrapper">
                <LockKeyhole size={18} className="field-icon" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? (
                "Đang xác thực..."
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Chưa có tài khoản? <Link to="/register" className="register-link">Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}