// DATOS FICTICIOS. Reemplazar por el pipeline real.
export const T={MEX:['Mexico','Americas'],USA:['United States','Americas'],BRA:['Brazil','Americas'],FRA:['France','Europe'],GER:['Germany','Europe'],ITA:['Italy','Europe'],NGA:['Nigeria','Africa'],EGY:['Egypt','Africa'],JPN:['Japan','Asia'],AUS:['Australia','Oceania'],KEN:['Kenya','Africa'],CAN:['Canada','Americas']};
export const codes=Object.keys(T);
// Fotos: una por equipo Y temporada, con la misma forma que data/processed/photos.json
// ("{año: {CÓDIGO: url}}"). En el fixture la URL es un SVG en línea para que el marco
// se vea de verdad sin depender de una imagen remota ni dejar un <img> roto; los datos
// reales solo admiten http(s) (lo valida scripts/normalize.js).
export const PH={2025:{MEX:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%204%203%22%3E%3Crect%20width=%224%22%20height=%223%22%20fill=%22%23d8d8d8%22/%3E%3Crect%20y=%221.8%22%20width=%224%22%20height=%221.2%22%20fill=%22%238a8a8a%22/%3E%3C/svg%3E'}};
export const seasons=[{y:2025,city:'Panama City',iso:'PAN',country:'Panama',dates:'Oct 29 – Nov 1, 2025'},{y:2024,city:'Athens',iso:'GRC',country:'Greece',dates:'Sep 25–28, 2024'},{y:2023,city:'Singapore',iso:'SGP',country:'Singapore',dates:'Oct 10–13, 2023'},{y:2022,city:'Geneva',iso:'CHE',country:'Switzerland',dates:'Oct 13–16, 2022'}].map(s=>({...s,name:`Mock Challenge ${s.y}`}));
let seed=11;const rnd=n=>(seed=seed*48271%2147483647)%n;
const shuffle=a=>a.map(x=>[rnd(1e6),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);
export const M={},S={},A={},AL={};
export const AW=[['FIRST Global Winning Alliance Award - Gold','Awarded to the teams in the winning alliance in the final match.','a','gold'],['FIRST Global Finalist Alliance - Silver','Awarded to the teams in the finalist alliance.','a','silver'],['FIRST Global Finalist Alliance - Bronze','Awarded to the teams in the third-place alliance.','a','bronze'],['Albert Einstein Award for FIRST Global International Excellence','Awarded to teams whose robots performed the best and exemplified all tenets of the FIRST Global community.','p'],['FIRST Global Grand Challenge Award','Awarded to teams that accrue the most cumulative points over the course of the competition.','p'],['FIRST Global Innovator Award','Awarded to teams who developed their own innovative solutions.','p'],['New Technology Experience Research Posters','Recognizes the teams who created outstanding research posters.','n'],['Zhang Heng Award for Engineering Design','Awarded to teams whose robot exhibits excellent engineering.','p'],['Judges Award','The judging panel may decide a team\u2019s unique efforts merit recognition.','n']];
for(const{y}of seasons){
  const ms=[],add=(stage,pre,n,pick)=>{for(let i=1;i<=n;i++){const rb=pick?pick(i):(q=>[q.slice(0,3),q.slice(3)])(shuffle(codes).slice(0,6)),bd=[rnd(50)+20,rnd(20),rnd(50)+20,rnd(20)];
    ms.push({id:`${y}_${pre}${i}`,href:`/match/${y}_${pre}${i}/`,y,stage,label:pre.toUpperCase()+i,field:'Field '+(1+i%3),time:`${9+(i>>2)}:${['00','15','30','45'][i&3]}`,red:rb[0],blue:rb[1],rs:bd[0]+bd[1],bs:bd[2]+bd[3],bd,video:i%2==0})}};
  add('ranking','q',16);M[y]=ms;   // clasificatorias: 3 equipos por alianza
  const st={};codes.forEach(c=>st[c]={code:c,w:0,l:0,t:0,pts:0,n:0});
  ms.filter(m=>m.stage=='ranking').forEach(m=>[[m.red,m.rs,m.bs],[m.blue,m.bs,m.rs]].forEach(([tm,a,b])=>tm.forEach(c=>{const z=st[c];z.n++;z.pts+=a;a>b?z.w++:a<b?z.l++:z.t++})));
  S[y]=Object.values(st).map(z=>({...z,rp:z.w*2+z.t,avg:z.n?+(z.pts/z.n).toFixed(1):0})).sort((a,b)=>b.rp-a.rp||b.pts-a.pts).map((z,i)=>({...z,rank:i+1,cols:[['Ranking score',z.rp],['Avg score',z.avg],['Points',z.pts]]}));   // cols = criterios por temporada, como en los datos reales
  AL[y]=[0,1,2].map(k=>S[y].slice(k*4,k*4+4).map(z=>z.code));   // alianzas de playoffs: 4 equipos
  add('round_robin','rr',4,i=>[[0,1],[0,2],[1,2],[0,1]][i-1].map(k=>AL[y][k]));add('finals','f',2,()=>[AL[y][0],AL[y][1]]);
  A[y]=AW.map(([name,desc,ty,tier])=>({name,desc,ty,tier,w:ty=='a'?AL[y]['gold silver bronze'.split(' ').indexOf(tier)]:shuffle(codes).slice(0,3)}));
}
