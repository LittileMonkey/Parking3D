import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ParkingCircle, Phone, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../services/api";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
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
      await api.register({
        userName: email.trim(),
        email: email.trim(),
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });
      setComplete(true);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng ký. Màn hình đã sẵn sàng tích hợp tại POST /api/v1/auth/register.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (complete) {
    return <main className="auth-page register-page"><section className="auth-visual-panel register-visual"><Link className="brand auth-brand" to="/"><span className="brand-mark"><ParkingCircle size={23} /><i /></span><span className="brand-copy"><strong>Park<span>Matrix</span></strong><small>SMART PARKING PLATFORM</small></span></Link><div className="auth-visual-content"><span className="eyebrow"><span className="eyebrow-rule" /> BẮT ĐẦU HÀNH TRÌNH</span><h1>Không gian đỗ xe,<br />gần bạn hơn.</h1><p>Tài khoản của bạn đã được gửi đến hệ thống để xử lý.</p></div><div className="auth-visual-photo" /><Link className="auth-back-link" to="/"><ArrowLeft size={16} /> Quay về trang chủ</Link></section><section className="auth-form-panel"><div className="auth-form-wrap completion-wrap"><span className="completion-icon"><Check size={25} /></span><span className="auth-step">YÊU CẦU ĐÃ GỬI</span><h2>Kiểm tra email của bạn</h2><p>Hệ thống đã nhận thông tin đăng ký cho <strong>{email}</strong>. Nếu backend yêu cầu xác minh, hãy làm theo hướng dẫn được gửi qua email.</p><Link className="button button-dark auth-submit" to="/login">Đi đến đăng nhập <ArrowRight size={17} /></Link></div><Link className="auth-mobile-back" to="/"><ArrowLeft size={15} /> Trang chủ</Link></section></main>;
  }

  return (
    <main className="auth-page register-page">
      <section className="auth-visual-panel register-visual">
        <Link className="brand auth-brand" to="/"><span className="brand-mark"><ParkingCircle size={23} /><i /></span><span className="brand-copy"><strong>Park<span>Matrix</span></strong><small>SMART PARKING PLATFORM</small></span></Link>
        <div className="auth-visual-content"><span className="eyebrow"><span className="eyebrow-rule" /> BẮT ĐẦU HÀNH TRÌNH</span><h1>Đỗ xe gọn hơn,<br />mỗi ngày.</h1><p>Tạo tài khoản để kết nối với các tiện ích đỗ xe trên nền tảng.</p><div className="auth-visual-meta"><span><Check size={15} /> Đăng ký tài khoản khách hàng</span><span>02 <i>/ 02</i></span></div></div>
        <div className="auth-visual-photo" />
        <Link className="auth-back-link" to="/"><ArrowLeft size={16} /> Quay về trang chủ</Link>
      </section>
      <section className="auth-form-panel register-form-panel">
        <div className="auth-form-wrap">
          <div className="mobile-auth-brand"><Link className="brand" to="/"><span className="brand-mark"><ParkingCircle size={22} /><i /></span><span className="brand-copy"><strong>Park<span>Matrix</span></strong><small>SMART PARKING PLATFORM</small></span></Link></div>
          <div className="auth-heading"><span className="auth-step">TÀI KHOẢN KHÁCH HÀNG <span>02 / 02</span></span><h2>Tạo tài khoản</h2><p>Điền thông tin cơ bản để đăng ký tham gia.</p></div>
          <form className="auth-form register-form" onSubmit={submit}>
            {error && <div className="form-alert" role="alert">{error}</div>}
            <label className="field-label" htmlFor="register-name">Họ và tên</label>
            <div className="input-wrap"><UserRound size={17} /><input id="register-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn An" required disabled={loading} /></div>
            <label className="field-label" htmlFor="register-email">Email</label>
            <div className="input-wrap"><Mail size={17} /><input id="register-email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" required disabled={loading} /></div>
            <label className="field-label" htmlFor="register-phone">Số điện thoại</label>
            <div className="input-wrap"><Phone size={17} /><input id="register-phone" autoComplete="tel" type="tel" inputMode="tel" pattern="[+]?[0-9]{9,15}" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="0901234567" required disabled={loading} /></div>
            <div className="register-password-grid">
              <div><label className="field-label" htmlFor="register-password">Mật khẩu</label><div className="input-wrap"><LockKeyhole size={17} /><input id="register-password" autoComplete="new-password" type={showPassword ? "text" : "password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 8 ký tự" required disabled={loading} /><button className="input-action" type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
              <div><label className="field-label" htmlFor="register-confirm">Xác nhận mật khẩu</label><div className="input-wrap"><LockKeyhole size={17} /><input id="register-confirm" autoComplete="new-password" type={showPassword ? "text" : "password"} minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" required disabled={loading} /></div></div>
            </div>
            <button className="button button-dark auth-submit" type="submit" disabled={loading}>{loading ? "Đang gửi yêu cầu…" : <>Tạo tài khoản <ArrowRight size={17} /></>}</button>
          </form>
          <p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
          <div className="auth-security"><LockKeyhole size={14} /> Thông tin được gửi trực tiếp đến máy chủ xác thực.</div>
        </div>
        <Link className="auth-mobile-back" to="/"><ArrowLeft size={15} /> Trang chủ</Link>
      </section>
    </main>
  );
}