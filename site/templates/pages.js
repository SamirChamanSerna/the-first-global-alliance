// PLANTILLAS de las 10 pantallas. Cada una = composición de bloques; sin HTML de estilo propio.
import {brand,t} from '../brand/brand.js';
import {hero,flag,teamLink,pip,box,boxes,kvr,dd,dt,matchList,matchRow,awardBlock,awardKey,scoreboard,breakdown,videoThumb,videoFallback} from './blocks.js';
import {seasons,T,codes,M,S,A,AL,AW} from '../mock/mock.js';
const Y=seasons.map(s=>s.y),L=Y[0],sn=y=>seasons.find(s=>s.y==y);
const bar=(h,x='')=>`<div class="bar"><h1>${h}</h1>${x}</div>`;
const sel=(cur,fn,ov)=>dd(cur,[...(ov?[ov]:[]),...Y.map(y=>[fn(y),y])]);
const tl=c=>teamLink(c,`${c} ${T[c][0]}`);
const tierOf=(a,i)=>a.ty=='a'?a.tier:a.ty=='p'?['gold','silver','bronze'][i]:'awarded';
const won=(y,c)=>A[y].flatMap(a=>a.w.map((k,i)=>k==c?{n:a.name,tr:tierOf(a,i)}:null).filter(Boolean));
const cnt=c=>{const o={gold:0,silver:0,bronze:0,honorable:0};Y.forEach(y=>won(y,c).forEach(x=>o[x.tr=='awarded'?'honorable':x.tr]++));return o};
const awList=(y,c)=>won(y,c).map(x=>kvr(x.n,pip(x.tr))).join('')||`<div class="muted">${t('noAwards')}</div>`;
const al=(y,c)=>{const i=AL[y].findIndex(g=>g.includes(c));return i<0?kvr(t('alliance'),t('noPlayoff')):kvr(`${t('alliance')} ${i+1}`,AL[y][i].map(k=>`<a href="/team/${k}/">${k}</a>`).join(' '))};
const R={gold:0,silver:1,bronze:2,honorable:3,awarded:4},nm=c=>teamLink(c,T[c][0]);
const cells=a=>a.ty=='a'?[[a.w.map(nm).join(', '),a.tier]]:a.w.map((c,i)=>[nm(c),tierOf(a,i)]);
const ovCells=name=>{const m={};Y.forEach(y=>{const a=A[y].find(x=>x.name==name);a.w.forEach((c,i)=>{const k=tierOf(a,i),z=m[c]||(m[c]={n:0,k});z.n++;if(R[k]<R[z.k])z.k=k})});return Object.entries(m).sort((a,b)=>R[a[1].k]-R[b[1].k]||b[1].n-a[1].n).map(([c,z])=>[nm(c)+(z.n>1?` ×${z.n}`:''),z.k])};
const awBlocks=y=>`<div class="aws">${(y?A[y]:AW.map(([name,desc])=>({name,desc}))).map(a=>awardBlock(a.name,a.desc,y?cells(a):ovCells(a.name))).join('')}</div>`;
const pips=o=>Object.entries(o).map(([k,n])=>`${pip(k)} ×${n}`).join(' ');
const av=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=av(a);return Math.sqrt(av(a.map(v=>(v-m)**2)))},pm=a=>`${av(a).toFixed(1)} <span class="muted">± ${sd(a).toFixed(1)}</span>`;
const best=ms=>ms.reduce((a,m)=>Math.max(m.rs,m.bs)>Math.max(a.rs,a.bs)?m:a);
const hi=m=>`<div>${matchRow(m)}</div><div class="sec">${m.video?videoThumb(m):videoFallback(m)}</div>`;
const sc=ms=>ms.flatMap(m=>[m.rs,m.bs]),mg=ms=>ms.map(m=>Math.abs(m.rs-m.bs));
const rankCols=[[t('rankingPoints'),z=>z.rp],[t('tb1'),z=>z.avg],[t('tb2'),z=>z.w],[t('tb3'),z=>z.pts]]; // columnas dinámicas por temporada
const rank=y=>dt([['#',1],[t('team')],...rankCols.map(c=>[c[0],1]),[t('wlt'),1]],S[y].map(z=>[z.rank,tl(z.code),...rankCols.map(c=>c[1](z)),`${z.w}–${z.l}–${z.t}`]),1);
const mine=(c,y)=>M[y].filter(m=>[...m.red,...m.blue].includes(c));

const nAw=ys=>ys.reduce((n,z)=>n+A[z].reduce((m,a)=>m+a.w.length,0),0);
const home=()=>hero()+`<div class="map">${t('mapPlaceholder')}</div>
<h3>${t('venues')}</h3>${dt([[t('year')],[t('venue')],[t('country')],[t('dates')]],seasons.map(s=>[`<a href="/insights/${s.y}/">${s.y}</a>`,s.city,`${flag(s.iso)} ${s.country}`,s.dates]))}
<h3>${t('overview')}</h3>${boxes([box(t('matches'),Y.reduce((n,y)=>n+M[y].length,0)),box(t('awards'),nAw(Y)),box(t('teams'),codes.length)],1)}`;

const ins=y=>{const ms=y?M[y]:Y.flatMap(z=>M[z]),q=ms.filter(m=>m.stage=='ranking'),p=ms.filter(m=>m.stage!='ranking'),s=y&&sn(y),kp=(l,a)=>box(l,av(a).toFixed(1),`± ${sd(a).toFixed(1)}`);
  const top=y?S[y].slice(0,10).map(z=>[z.rank,tl(z.code),z.rp]):codes.map(c=>[c,cnt(c)]).sort((a,b)=>tot(b[1])-tot(a[1])).slice(0,10).map(([c,o],i)=>[i+1,tl(c),pips(o)]);
  return bar(y?`${t('season')} ${y}`:t('overview'),dd(y||t('overview'),[['/insights/',t('overview')],...Y.map(z=>[`/insights/${z}/`,z])]))
  +`<p class="muted">${y?`${s.name} · ${s.city}, ${s.country} · `:''}<a href="${y?`https://first.global/archive/fgc-${y}/`:'https://first.global/about/'}">${t('officialSite')}</a></p>`
  +boxes([box(t('teams'),codes.length),box(t('matches'),ms.length),box(t('awards'),nAw(y?[y]:Y))],1)
  +`<h3>${t('reveal')}</h3><div class="thumb">${t('thumbnail')}</div>`
  +`<h3>${t('awards')}</h3>${awardKey()}${awBlocks(y)}`
  +`<h3>${t('highestMatch')}</h3>${hi(best(q))}<h3>${t('qualMetrics')}</h3>${boxes([kp(t('avgMatch'),sc(q)),kp(t('avgMargin'),mg(q))])}`
  +`<h3>${t('playoffs')}</h3>`+(y?`<div>${matchList(p)}</div>`:dt([[t('team')],[t('matches'),1]],codes.map(c=>[c,p.filter(m=>[...m.red,...m.blue].includes(c)).length]).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,n])=>[tl(c),n])))
  +`<h3>${t('highestPlayoff')}</h3>${hi(best(p))}${boxes([kp(t('avgMatch'),sc(p)),kp(t('avgMargin'),mg(p))])}`
  +`<h3>${y?t('topRank'):t('mostAwards')}</h3>`+dt([['#',1],[t('team')],[y?t('rankingPoints'):t('medals'),y?1:0]],top)+(y?`<p><a href="/rankings/${y}/">${t('fullRanking')}</a></p>`:'')};

const teams=()=>bar(t('teams'))+['Africa','Americas','Asia','Europe','Oceania'].map(k=>`<h3>${k}</h3>`+dt([[t('flagCol')],[t('iso')],[t('team')],[t('seasons'),1]],codes.filter(c=>T[c][1]==k).sort().map(c=>[flag(c),c,`<a href="/team/${c}/">${T[c][0]}</a>`,Y.length]))).join('');

const awards=()=>bar(t('awards'))+dt([[t('team')],...['gold','silver','bronze','honorable'].map(k=>[brand.medals[k].label,1]),[t('total'),1]],codes.map(c=>[c,cnt(c)]).sort((a,b)=>tot(b[1])-tot(a[1])).map(([c,o])=>[tl(c),o.gold,o.silver,o.bronze,o.honorable,tot(o)]),1);
const tot=o=>Object.values(o).reduce((x,y)=>x+y,0);

const rankings=y=>bar(`${t('topRank')} ${y}`,sel(y,z=>`/rankings/${z}/`))+rank(y);
const matches=y=>bar(`${t('matches')} ${y}`,sel(y,z=>`/matches/${z}/`))+`<div>${matchList(M[y])}</div>`;
const gameday=()=>bar('GameDay')+`<div class="map">${t('gamedaySoon')}</div>`;

const th=c=>{const R2=Y.map(y=>S[y].find(z=>z.code==c)),b=R2.reduce((a,z,i)=>z.rank<a.rank?{rank:z.rank,y:Y[i]}:a,{rank:99}),W=R2.reduce((a,z)=>a+z.w,0),Lo=R2.reduce((a,z)=>a+z.l,0),Ti=R2.reduce((a,z)=>a+z.t,0),n=W+Lo+Ti;
  return `<div class="bar"><div class="title">${flag(c)}<h1>${T[c][0]}</h1></div>${sel(t('seasons'),z=>`/team/${c}/${z}/`)}</div><div class="kv"><div><span>${t('iso')}:</span> ${c}</div></div>`
  +boxes([box(t('matches'),n),box(t('awards'),tot(cnt(c))),box(t('record'),`${W}–${Lo}–${Ti}`,`${(100*W/n).toFixed(1)}%`),box(t('bestRank'),`#${b.rank}`,`${b.y} · ${t('of')} ${codes.length}`),box(t('medals'),'',pips(cnt(c)))],1)
  +`<h3>${t('timeline')}</h3>`+Y.map((y,i)=>{const z=R2[i],s=sn(y),ps=sc(mine(c,y));return `<section class="ev"><div><h2><a href="/team/${c}/${y}/">${s.name}</a></h2><div class="when">${s.city}, ${s.country} · ${s.dates}</div>${boxes([box(t('rank'),z.rank,`${t('of')} ${codes.length}`),box(t('record'),`${z.w}–${z.l}–${z.t}`)])}</div><div><div class="photo">${t('photo')}</div>${kvr(t('highestScore'),Math.max(...ps))}${kvr(t('avgScore'),z.avg)}${al(y,c)}<div class="lbl">${t('awards')}</div>${awList(y,c)}</div></section>`}).join('')};

const ts=(c,y)=>{const z=S[y].find(x=>x.code==c),s=sn(y);
  return `<div class="bar"><div class="title">${flag(c)}<h1>${T[c][0]} · ${y}</h1></div>${sel(y,k=>`/team/${c}/${k}/`)}</div><p><a href="/team/${c}/">← ${t('back')}</a></p>`
  +`<section class="ev"><div><h2>${s.name}</h2><div class="when">${s.city}, ${s.country} · ${s.dates}</div>${boxes([box(t('rank'),z.rank,`${t('of')} ${codes.length}`),box(t('record'),`${z.w}–${z.l}–${z.t}`)])}${al(y,c)}<div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div><div class="photo">${t('photo')}</div></div></section>`
  +`<h3>${t('matches')}</h3><div>${matchList(mine(c,y),c)}</div>`};

const mp=m=>`<div class="bar"><h1>${m.label} · ${sn(m.y).name}</h1></div><p class="when">${m.field} · ${m.time}</p><section class="ev"><div class="mh span-all"><div>${scoreboard(m)}<div class="sec">${breakdown(m)}</div></div><div class="vids">${videoThumb(m)}${videoFallback(m)}</div></div></section><h3>${t('players')}</h3><p>${[...m.red,...m.blue].map(tl).join(' · ')}</p>`;

export const pages=()=>{const P=[{path:'',title:brand.name,body:home()},{path:'insights/',title:t('overview'),active:'insights',body:ins()},{path:'teams/',title:t('teams'),active:'teams',body:teams()},{path:'awards/',title:t('awards'),active:'awards',body:awards()},{path:'gameday/',title:'GameDay',active:'gameday',body:gameday()}];
  Y.forEach(y=>P.push({path:`insights/${y}/`,title:`${t('season')} ${y}`,active:'insights',body:ins(y)},{path:`rankings/${y}/`,title:`${t('topRank')} ${y}`,active:'rankings',body:rankings(y)},{path:`matches/${y}/`,title:`${t('matches')} ${y}`,active:'matches',body:matches(y)},...M[y].map(m=>({path:`match/${m.id}/`,title:`${m.label} ${y}`,active:'matches',body:mp(m)}))));
  codes.forEach(c=>P.push({path:`team/${c}/`,title:T[c][0],active:'teams',body:th(c)},...Y.map(y=>({path:`team/${c}/${y}/`,title:`${T[c][0]} ${y}`,active:'teams',body:ts(c,y)}))));
  const sx=[...codes.map(c=>T[c][0]),...Y.map(String)];return P.map(p=>({latest:L,sx,...p}))};
