import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { request } from '../services/api';
import CustomerLayout from '../components/customer/CustomerLayout';
export default function PaymentReturn(){
 const {search}=useLocation();const [message,setMessage]=useState('Đang xác minh kết quả từ VNPay…');
 useEffect(()=>{let active=true;request<{message:string}>('/api/v1/payments/vnpay/return'+search,{headers:{Accept:'application/json'}}).then(r=>{if(active)setMessage(r.message);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[search]);
 return <CustomerLayout><main style={{maxWidth:640,margin:'48px auto',padding:24}}><h1>Kết quả thanh toán</h1><p role="status">{message}</p><p>Kiểm tra trạng thái đặt chỗ trước khi dùng mã QR. Không thanh toán lại khi giao dịch trước còn đang đối soát.</p><Link to="/account">Quay lại đặt chỗ và lịch sử</Link></main></CustomerLayout>;
}
