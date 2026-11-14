import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';
type Notice = { id: string; bookingId?: string; kind: string; message: string; createdAt: string; readAt?: string };
export default function NotificationBell() {
 const { isAuthenticated }=useAuth();
 const [open,setOpen]=useState(false),[items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[error,setError]=useState('');
 useEffect(()=>{
  if(!isAuthenticated){setItems([]);setUnread(0);return;}
  let active=true;
  const load=()=>request<{items:Notice[];unreadCount:number}>('/api/v1/notifications').then(x=>{if(active){setItems(x.items);setUnread(x.unreadCount);setError('');}}).catch(e=>{if(active)setError(e.message);});
  void load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer);};
 },[isAuthenticated]);
 if(!isAuthenticated)return null;
 async function readAll(){try{await request('/api/v1/notifications/read-all',{method:'POST'});setUnread(0);setItems(rows=>rows.map(x=>({...x,readAt:x.readAt??new Date().toISOString()})));}catch(e){setError(e instanceof Error?e.message:'Không lưu được.');}}
 async function read(item:Notice){try{await request('/api/v1/notifications/'+item.id+'/read',{method:'POST'});setItems(rows=>rows.map(x=>x.id===item.id?{...x,readAt:new Date().toISOString()}:x));if(!item.readAt)setUnread(n=>Math.max(0,n-1));}catch(e){setError(e instanceof Error?e.message:'Không lưu được trạng thái đọc.');}}
 return <div className="customer-notifications" style={{position:'relative'}}><button className="customer-notification-trigger" type="button" aria-label={`Thông báo${unread > 0 ? `, ${unread} chưa đọc` : ''}`} aria-expanded={open} onClick={()=>setOpen(x=>!x)}><Bell size={18} /><span className="customer-notification-label">Thông báo</span>{unread>0&&<span className="customer-notification-count">{unread}</span>}</button>
 {open&&<section className="customer-notification-panel" aria-label="Thông báo" style={{position:'absolute',right:0,top:'100%',zIndex:1000,maxHeight:400,overflow:'auto',padding:16,background:'#072d59',color:'white',borderRadius:12}}>
 <button onClick={()=>void readAll()}>Đánh dấu tất cả đã đọc</button>
 {error&&<p role="alert">{error}</p>}{!error&&!items.length&&<p>Chưa có thông báo.</p>}
 {items.map(item=><article key={item.id} style={{padding:'8px 0',opacity:item.readAt?.length?0.7:1}}><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>{item.bookingId&&<p><Link to={'/bookings/'+item.bookingId} onClick={()=>{void read(item);setOpen(false);}}>Xem đặt chỗ</Link></p>}{!item.readAt&&<button onClick={()=>void read(item)}>Đánh dấu đã đọc</button>}</article>)}
 </section>}</div>;
}
