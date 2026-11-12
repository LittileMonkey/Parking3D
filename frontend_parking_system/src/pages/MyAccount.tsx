import { useEffect,useState,type FormEvent } from 'react';
import { Link,Navigate } from 'react-router-dom';
import CustomerLayout from '../components/customer/CustomerLayout';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/api';
type Visit={id:string;code:string;status:string;startsAt:string;estimatedAmount:number;lotName:string};
type Vehicle={id:string;licensePlate:string;vehicleType:string;isDefault:boolean};
export default function MyAccount(){
 const {isAuthenticated}=useAuth();const[bookings,setBookings]=useState<Visit[]>([]),[vehicles,setVehicles]=useState<Vehicle[]>([]),[plate,setPlate]=useState(''),[type,setType]=useState('Car'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;if(isAuthenticated)Promise.all([request<Visit[]>('/api/v1/bookings/mine'),request<Vehicle[]>('/api/v1/user-vehicles')]).then(([b,v])=>{if(active){setBookings(b);setVehicles(v);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[isAuthenticated,revision]);
 if(!isAuthenticated)return <Navigate to="/login" replace/>;
 async function add(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await request('/api/v1/user-vehicles',{method:'POST',body:JSON.stringify({licensePlate:plate.trim(),vehicleType:type,isDefault:vehicles.length===0})});setPlate('');setRevision(x=>x+1);}catch(e){setError(e instanceof Error?e.message:'Không lưu được xe.');}finally{setBusy(false);}}
 return <CustomerLayout><main className="customer-page"><h1>Xe và lịch sử đặt chỗ</h1>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">Đang tải dữ liệu…</p>}<section className="customer-panel"><h2>Xe của tôi</h2>{vehicles.map(v=><p key={v.id}>{v.licensePlate} · {v.vehicleType}{v.isDefault?' · Mặc định':''}</p>)}<form onSubmit={add}><label>Biển số xe<input required maxLength={16} value={plate} onChange={e=>setPlate(e.target.value)}/></label><label>Loại xe<select value={type} onChange={e=>setType(e.target.value)}><option value="Car">Ô tô</option><option value="Bike">Xe máy</option><option value="EV">Ô tô điện</option></select></label><button className="customer-button primary" disabled={busy}>Thêm xe</button></form></section><section className="customer-panel"><h2>Đặt chỗ gần đây</h2>{!loading&&!bookings.length&&<p>Chưa có đặt chỗ.</p>}{bookings.map(b=><article key={b.id}><h3><Link to={'/bookings/'+b.id}>{b.code} · {b.lotName}</Link></h3><p>{new Date(b.startsAt).toLocaleString('vi-VN')} · {b.status} · {b.estimatedAmount.toLocaleString('vi-VN')} VND</p></article>)}</section></main></CustomerLayout>;
}
