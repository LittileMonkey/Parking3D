const fs = require('node:fs');
const root = 'frontend_parking_system/src/';
const slots = ['A','B','C','D'].flatMap((row,r)=>Array.from({length:15},(_,i)=>{
 const n=r*15+i;
 return {slotId:row+String(i+1).padStart(2,'0'),floor:1,type:'Car',status:n%19===3?'MAINTENANCE':n%7===4?'RESERVED':n%3===1?'OCCUPIED':'AVAILABLE',width:2.7,length:5.4,positionX:Math.round((-18.9+i*2.7)*100)/100,positionZ:[-15,-9,9,15][r],backDirection:r%2===0?1:-1};
}));
fs.writeFileSync(root+'components/parking/preview-layout.json',JSON.stringify({name:'Bãi ngoài trời · 60 ô minh họa',width:50,depth:46,slots},null,2)+'\n');
function edit(path,pairs){let s=fs.readFileSync(root+path,'utf8');for(const [a,b]of pairs)s=s.split(a).join(b);fs.writeFileSync(root+path,s);}
edit('components/parking/parking.js',[
 ['const scene = new THREE.Scene();','const gateZ = config.depth / 2;\n    const laneX = config.width / 2 - 2.5;\n    const scene = new THREE.Scene();'],
 ['slot.positionZ > 0','(slot.backDirection ?? Math.sign(slot.positionZ)) > 0'],['Math.sign(z)','(slot.backDirection ?? Math.sign(z))'],
 ['let x = -12; x <= 12','let x = -config.width / 2 + 4; x <= config.width / 2 - 4'],
 ['arrow(-11.8, 10, 0); arrow(11.8, 10, Math.PI);','for (const z of [-config.depth / 2 + 3, 0, config.depth / 2 - 3]) { arrow(-laneX, z, 0); arrow(laneX, z, Math.PI); }'],
 ['0, 0, 14, concrete','0, 0, gateZ, concrete'],['0, 1.25, 14, white','0, 1.25, gateZ, white'],['0, 1.65, 15.17, glass','0, 1.65, gateZ + 1.17, glass'],['-1.42, 1.65, 14, glass','-1.42, 1.65, gateZ, glass'],['0, 2.65, 14, ink','0, 2.65, gateZ, ink'],['0, 2.4, 15.2','0, 2.4, gateZ + 1.2'],['-11.8, 0.04, 16.3','-laneX, 0.04, gateZ + 2.3'],['11.8, 0.04, 16.3','laneX, 0.04, gateZ + 2.3'],['side * 11.8','side * laneX'],['0.5, 13, yellow','0.5, gateZ - 1, yellow'],['1, 13, white','1, gateZ - 1, white'],['1, 13, mat','1, gateZ - 1, mat'],['11 + i * 0.6','gateZ - 3 + i * 0.6'],
 ['[-15.7, 15.7]','[-config.width / 2 - 0.7, config.width / 2 + 0.7]'],['[-10, -2, 7]','[-config.depth / 2 + 4, -8, 5, config.depth / 2 - 5]'],['[-14, 14]','[-config.width / 2 + 0.8, config.width / 2 - 0.8]'],['[-12, 11]','[-config.depth / 2 + 2, config.depth / 2 - 3]'],['sun.position.set(-18, 32, 20)','sun.position.set(-30, 48, 32)'],['left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100','left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150']
]);
edit('pages/Booking.tsx',[
 ['const slots = layout.slots;',"const slots = layout.slots;\n  const rows = [...new Set(slots.map(slot => slot.slotId.charAt(0)))];"],['Khu A & B','4 khu · 60 ô'],["['A','B'].map(row",'rows.map(row'],["row === 'A'",'row !== rows[rows.length - 1]']
]);
edit('components/parking/parking.d.ts',[['positionZ: number;','positionZ: number; backDirection?: number;']]);
fs.appendFileSync(root+'pages/Booking.css','\n.booking-flat-row > div { grid-template-columns: repeat(15, minmax(44px, 1fr)); }\n.booking-flat { overflow-x: auto; }\n.booking-flat-row { min-width: 730px; }\n.booking-occupancy { display: grid; grid-template-columns: repeat(15, 1fr); }\n');
console.log('Expanded to',slots.length,'slots');
