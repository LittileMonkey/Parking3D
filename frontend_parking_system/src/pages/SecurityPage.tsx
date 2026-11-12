import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/api';
import CustomerLayout from '../components/customer/CustomerLayout';
export default function SecurityPage(){
 const {isAuthenticated,logout}=useAuth();const [enabled,setEnabled]=useState(false),[password,setPassword]=useState(''),[code,setCode]=useState(''),[setup,setSetup]=useState<{secret:string;uri:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(isAuthenticated)request<{enabled:boolean}>('/api/v1/auth/mfa').then(x=>setEnabled(x.enabled)).catch(e=>setError(e.message));},[isAuthenticated]);
 if(!isAuthenticated)return <Navigate to="/login" replace/>;
 async function action(kind:'setup'|'enable'|'disable') {setBusy(true);setError('');try{if(kind==='setup')setSetup(await request('/api/v1/auth/mfa/setup',{method:'POST',body:JSON.stringify({password})}));else{await request('/api/v1/auth/mfa/'+kind,{method:'POST',body:JSON.stringify({password,code})});setSetup(null);setPassword('');setCode('');logout();}}catch(e){setError(e instanceof Error?e.message:'Không cập nhật được MFA.');}finally{setBusy(false);}}
 return <CustomerLayout><main style={{maxWidth:600,margin:'40px auto',padding:24}}><h1>Bảo mật tài khoản</h1><p>MFA: {enabled?'Đang bật':'Chưa bật'}. Dùng ứng dụng xác thực hỗ trợ TOTP. Sau khi thay đổi, hãy đăng nhập lại.</p><p>Tài khoản Google chưa có mật khẩu cần đặt mật khẩu qua luồng quên mật khẩu trước khi cấu hình MFA.</p>
 <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
 {!enabled&&!setup&&<button disabled={busy||!password} onClick={()=>void action('setup')}>Thiết lập MFA</button>}
 {setup&&<section><p>Quét bằng ứng dụng xác thực. Không chia sẻ mã QR hoặc khóa này.</p><QRCodeSVG value={setup.uri}/><details><summary>Nhập khóa thủ công</summary><code>{setup.secret}</code></details></section>}
 {(enabled||setup)&&<><label>Mã 6 số<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label><button disabled={busy||!password||code.length!==6} onClick={()=>void action(enabled?'disable':'enable')}>{enabled?'Tắt MFA':'Xác nhận bật MFA'}</button></>}
 {error&&<p role="alert">{error}</p>}</main></CustomerLayout>;
}
