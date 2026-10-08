// BLOQUES COMPARTIDOS. Markup copiado del demo (docs/web-style-guide/demo-team-match.html).
import {brand,t} from '../brand/brand.js';
import {urls} from './urls.js';
import {T} from './data.js';
import {STREAMS_2026} from '../brand/streams.js';
export const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Sin ISO no hay imagen: marco gris (.fl.none), nunca un <img> roto.
export const flag=i=>i?`<img class="fl" src="${urls.flag(i)}" alt="" width="16" height="11" loading="lazy">`:`<span class="fl none"></span>`;
export const teamCell=(c,me)=>`<a class="t${me?' me':''}" href="${urls.team(c)}" title="${e(T[c]?.[0]||c)}">${flag(c)}${c}</a>`;
export const teamLink=(c,n)=>`<a href="${urls.team(c)}">${flag(c)} ${e(n)}</a>`;
export const pip=k=>{const m=brand.medals[k];return `<span class="pip">${m.emoji?m.emoji+' ':''}${m.label}</span>`};
export const box=(l,v,s)=>`<div class="box"><small>${l}</small><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
export const boxes=(a,c3)=>`<div class="boxes${c3?' c3':''}">${a.join('')}</div>`;
export const kvr=(l,v,tot)=>`<div class="kvr${tot?' tot':''}"><span>${l}</span><span>${v}</span></div>`;
export const dd=(label,items)=>`<details class="dd"><summary>${label}</summary><div>${items.map(([h,l])=>`<a href="${h}">${l}</a>`).join('')}</div></details>`;
// head: [[etiqueta, numérica?]…]; rows: arrays de HTML. sort=true → ordenable con JS (el orden inicial ya viene en el HTML)
export const dt=(head,rows,sort)=>`<div class="scroll"><table class="dt${sort?' s':''}"><thead><tr>${head.map(h=>`<th${h[1]?' class="n"':''}>${h[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${head[i][1]?' class="n"':''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const awardKey=()=>`<div class="key"><b>${t('key')}</b><span class="t-gold">${t('tierGold')}</span><span class="t-silver">${t('tierSilver')}</span><span class="t-bronze">${t('tierBronze')}</span><span class="t-awarded">${t('tierNone')}</span></div>`;
// cells: [[html, gold|silver|bronze|awarded]…]  — módulo reutilizable para Insights (temporada y overview)
export const awardBlock=(name,desc,cells)=>`<div class="aw"><b>${e(name)}</b><i>${e(desc)}</i><div class="aw-r">${cells.map(([h,k])=>`<span class="t-${k}">${h}</span>`).join('')}</div></div>`;
// Empate y "sin jugar" NO son lo mismo:
//   sin jugar → 'neu', gris neutro (el marcador va como «–»)
//   empate    → 'lose' en ambos lados, que es el tono tenue: cada alianza conserva
//               su rojo/azul sin que ninguna quede resaltada como ganadora.
const tone=(a,b)=>a==null||b==null?'neu':a===b?'lose':a>b?'win':'lose';
// Un partido sin jugar no vale 0: es el hueco, y se pinta «–», igual que en matchRow.
// `tone` ya devuelve 'neu' cuando falta alguno de los dos marcadores.
const dash=v=>v==null?'–':v;
const sc=(s,k)=>dash(k=='win'?`<b class="w">${s}</b>`:s);
export const matchRow=(m,me)=>{const p=m.rs!=null,r=p?tone(m.rs,m.bs):'neu',b=p?tone(m.bs,m.rs):'neu',cells=a=>a.map(c=>teamCell(c,c==me)).join('');
  const tm=m.scheduledTime?`~${m.time} KST · ${m.field}`:`~${m.time} · ${m.field}`;
  const allTeams=[...m.red,...m.blue].map(c=>`${c} ${T[c]?.[0]||''}`).join(' ');
  const vidHref=(m.y==2026&&m.field&&STREAMS_2026.fields[m.field])?`${urls.gameday()}?stream=${encodeURIComponent(m.field)}`:m.video?urls.match(m.id):null;
  return `<div class="m" data-match="${m.id}"${m.scheduledTime?` data-time="${m.scheduledTime}"`:''}${m.field?` data-field="${m.field}"`:''}${m.time?` data-clock="${m.time}"`:''} data-teams="${e(allTeams)}"><span class="c-pl">${vidHref?`<a class="pl" href="${vidHref}" aria-label="${t('watch')}"></a>`:''}</span><a class="lb" href="${urls.match(m.id)}">${m.label}${p?'':`<small>${tm}</small>`}</a><div class="ra ${r}">${cells(m.red)}</div><div class="ba ${b}">${cells(m.blue)}</div><span class="rs ${r}">${p?sc(m.rs,r):'–'}</span><span class="bs ${b}">${p?sc(m.bs,b):'–'}</span></div>`};
const ST=[['finals','stageFinals'],['round_robin','stageRoundRobin'],['ranking','stageRanking']]; // última fase primero
export const matchList=(ms,me)=>ST.map(([k,l])=>{const a=ms.filter(m=>m.stage==k);return a.length?`<div class="stg"><i></i><b>${t(l)}</b><i></i></div>`+a.map(m=>matchRow(m,me)).join(''):''}).join('');
export const scoreboard=m=>{const r=tone(m.rs,m.bs),b=tone(m.bs,m.rs);return `<div class="sb" data-match="${m.id}"><div class="hd2">${t('teams')}</div><div class="hd2">${t('score')}</div><div class="ra ${r}">${m.red.map(c=>teamCell(c)).join('')}</div><span class="rs ${r}">${sc(m.rs,r)}</span><div class="ba ${b}">${m.blue.map(c=>teamCell(c)).join('')}</div><span class="bs ${b}">${sc(m.bs,b)}</span></div>`};
const bdr=(tot,l,a,b)=>`<tr><td class="${tot?'rw':'rl'}">${dash(a)}</td><td class="lb${tot?' tot':''}"><span class="ar">${a>b?'←':''}</span><span>${l}</span><span class="ar">${b>a?'→':''}</span></td><td class="${tot?'bw':'bl'}">${dash(b)}</td></tr>`;
// Filas del desglose, que es específico de cada juego:
//   datos reales → m.breakdown = [{label, red, blue}]  (mapa por temporada, ver docs/discovery/03)
//   fixture      → m.bd = [redWater, redParking, blueWater, blueParking]  (forma de la maqueta)
// Sin filas de detalle solo queda la fila de total.
const bdRows=m=>m.breakdown??[[t('water'),m.bd?.[0],m.bd?.[2]],[t('parking'),m.bd?.[1],m.bd?.[3]]];
// `data-match` para que el overlay en vivo la encuentre: la fila de total lleva las mismas
// cifras que el marcador, y sin el atributo se quedaba con el «–» del build para siempre.
export const breakdown=m=>`<table class="bd" data-match="${m.id}"><tbody>${bdRows(m).map(([l,a,b])=>bdr(0,l,a,b)).join('')}${bdr(1,t('final'),m.rs,m.bs)}</tbody></table>`;
export const videoThumb=m=>`<div><a class="thumb" href="${urls.match(m.id)}" aria-label="${e(m.label)}">${t('thumbnail')}</a><div class="cap"><span>${e(m.label)}</span><small>${e(m.y)} · ${e(m.field)}</small></div></div>`;
// Miniatura de un vídeo de YouTube. `mqdefault.jpg` son 320×180, justo la medida que fija
// 02-guia-de-estilos.md §3.15 para las miniaturas (≤ 40 KB), y es una URL determinista del
// CDN: no necesita API, clave ni JS. Con una URL que no sea de YouTube se deja el marcador
// de texto de la maqueta. `alt=""` a propósito: la miniatura es decorativa y el enlace de
// al lado ya dice de qué vídeo se trata (mismo criterio que las banderas).
const ytId=u=>{const m=/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(u||'');return m?m[1]:null};
// Misma forma que video-thumb del demo, pero con un enlace externo y sin depender de
// un partido. Se usa para el video de revelación de la temporada. La miniatura ES el
// enlace (02-guia-de-estilos.md §3.16: «toda la miniatura es el enlace»); el pie es texto,
// no un segundo enlace al mismo sitio.
export const videoCard=(href,label,sub)=>{const id=ytId(href);
  return `<div><a class="thumb" href="${e(href)}" rel="noopener" aria-label="${e(label)}">${id?`<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" width="320" height="180" loading="lazy" decoding="async">`:t('thumbnail')}</a><div class="cap"><span>${e(label)}</span><small>${e(sub)}</small></div></div>`};
export const videoFallback=m=>{const r=m.rs>m.bs;return `<div class="vb"><small class="when">${m.label}</small><div class="sc"><div class="tn-r${r?'w':'l'}"><b>${m.rs}</b><small>${m.red.join(' · ')}</small></div><div class="tn-b${r?'l':'w'}"><b>${m.bs}</b><small>${m.blue.join(' · ')}</small></div></div><a class="go" href="${urls.match(m.id)}">${t('watch')}</a></div>`};
const SORT=`document.querySelectorAll('table.dt.s th').forEach((h,i)=>h.onclick=()=>{const b=h.closest('table').tBodies[0],d=h.dataset.d=h.dataset.d=='1'?-1:1;[...b.rows].sort((x,y)=>{const a=x.cells[i].textContent.trim(),c=y.cells[i].textContent.trim(),n=parseFloat(a)-parseFloat(c);return d*(isNaN(n)?a.localeCompare(c):n)}).forEach(r=>b.append(r))});document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{document.documentElement.dataset.theme=b.dataset.t;try{localStorage.setItem('th',b.dataset.t)}catch(e){}})`;
// Página completa. Enlaces internos absolutos → se convierten a relativos (+index.html) para abrir sin servidor.
export const layout=({title,path,active,body,latest,sx=[]})=>{
  const nv=brand.nav.map(n=>`<a href="${n.href.replace('{season}',latest)}"${n.key==active?' aria-current="page"':''}>${n.label}</a>`).join('');
  const h=`<!doctype html><html lang="${brand.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="${brand.themeColor}"><title>${e(title)} · ${brand.name}</title><link rel="icon" href="${urls.favicon()}"><link rel="stylesheet" href="${urls.css()}"><script>try{var s=localStorage.getItem("th");if(s)document.documentElement.dataset.theme=s}catch(e){}</script></head><body>
<header class="nav"><a class="brand" href="${urls.home()}">${brand.logoSvg}<span>${brand.name}</span></a><nav class="links">${nv}</nav><form action="${urls.search()}"><input type="search" name="q" list="sx" placeholder="${t('search')}" aria-label="${t('search')}"><datalist id="sx">${sx.map(o=>`<option value="${e(o)}">`).join('')}</datalist></form><details class="menu"><summary>${t('menu')}</summary><div>${nv}</div></details></header>
<div class="wrap one"><main>${body}</main></div>
<footer><div class="row"><span>${brand.footerLinks.map(l=>`<a href="${l.href}">${l.label}</a>`).join('')}</span><span class="seg"><button data-t="light">${t('light')}</button><button data-t="dark">${t('dark')}</button></span></div><p>${brand.attribution}</p></footer>
<script>${SORT}</script><script src="/live.js" defer></script></body></html>`;
  const pre='../'.repeat(path.split('/').filter(Boolean).length)||'./';
  return h.replace(/(href|src|action)="\/([^"]*)"/g,(m,a,p)=>`${a}="${pre}${p===''||p.endsWith('/')?p+'index.html':p}"`);
};

export const hero=()=>`<div class="hero">${brand.logoSvg}<h1>${brand.name}</h1><p class="muted">${brand.tagline}</p></div>`;
