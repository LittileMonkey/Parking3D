import { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/api';
export default function GuestLogin(){
 const {guestLogin}=useAuth(),navigate=useNavigate();const[email,setEmail]=useState(''),[code,setCode]=useState(''),[mfaCode,setMfaCode]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function send(){setBusy(true);setError('');try{await request('/api/v1/auth/guest/request-otp',{method:'POST',body:JSON.stringify({email})});setNotice('Kiểm tra email. Mã có hạn 5 phút; gửi lại sau ít nhất 60 giây.');}catch(e){setError(e instanceof Error?e.message:'Không gửi được mã.');}finally{setBusy(false);}}
 async function verify(){setBusy(true);setError('');try{await guestLogin(email,code,mfaCode||undefined);navigate('/booking');}catch(e){setError(e instanceof Error?e.message:'Không xác thực được.');}finally{setBusy(false);}}
 return <main style={{maxWidth:480,margin:'60px auto',padding:24}}><h1>Đăng nhập khách bằng email</h1><p>Khi xác minh email mới, hệ thống tạo tài khoản khách hàng để lưu đặt chỗ. Tài khoản nhân viên dùng trang đăng nhập nội bộ.</p>
 <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy||!email} onClick={()=>void send()}>Gửi mã</button>
 <label>Mã email<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label>
 <label>Mã ứng dụng MFA (nếu đã bật)<input inputMode="numeric" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value)}/></label><button disabled={busy||code.length!==6} onClick={()=>void verify()}>Xác minh và tiếp tục</button>
 {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<Link to="/login">Đăng nhập mật khẩu</Link></main>;
}
