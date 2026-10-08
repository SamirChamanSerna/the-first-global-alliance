// PLANTILLAS de las 10 pantallas. Cada una = composición de bloques; sin HTML de estilo propio.
import {brand,t} from '../brand/brand.js';
import {e,hero,flag,teamLink,pip,box,boxes,kvr,dd,dt,matchList,matchRow,awardBlock,awardKey,scoreboard,breakdown,videoThumb,videoFallback,videoCard} from './blocks.js';
import {urls,outPath} from './urls.js';
import {seasons,T,codes,M,S,A,AL,AW,PH} from './data.js';
import {STREAMS_2026} from '../brand/streams.js';
const Y=seasons.map(s=>s.y),L=Y[0],sn=y=>seasons.find(s=>s.y==y);
// YC = temporadas con competencia. Las de solo premios (2020, 2021) no tienen partidos,
// rankings ni alianzas: no generan páginas de temporada ni entran en las métricas de
// partidos. Sus premios sí se conservan (cnt, awBlocks, /awards/). Ver docs/discovery/05.
const YC=seasons.filter(s=>s.mode!=='awards-only').map(s=>s.y);
const onlyAwards=y=>sn(y)?.mode=='awards-only';
const bar=(h,x='')=>`<div class="bar"><h1>${h}</h1>${x}</div>`;
// Selector de temporada sobre una lista concreta (no todas las temporadas son del equipo).
const ddY=(cur,fn,ys,ov)=>dd(cur,[...(ov?[ov]:[]),...ys.map(y=>[fn(y),y])]);
const sel=(cur,fn,ov)=>ddY(cur,fn,Y,ov);
const tl=c=>teamLink(c,`${c} ${T[c][0]}`);
const tierOf=(a,i)=>a.ty=='a'?a.tier:a.ty=='p'?['gold','silver','bronze'][i]:'awarded';
const won=(y,c)=>A[y].flatMap(a=>a.w.map((k,i)=>k==c?{n:a.name,tr:tierOf(a,i)}:null).filter(Boolean));
const cntY=(y,c)=>{const o={gold:0,silver:0,bronze:0,honorable:0};won(y,c).forEach(x=>o[x.tr=='awarded'?'honorable':x.tr]++);return o};
const cnt=c=>{const o={gold:0,silver:0,bronze:0,honorable:0};Y.forEach(y=>{const z=cntY(y,c);Object.keys(o).forEach(k=>o[k]+=z[k])});return o};
const awList=(y,c)=>won(y,c).map(x=>kvr(x.n,pip(x.tr))).join('')||`<div class="muted">${t('noAwards')}</div>`;
// Alianza de playoffs. Si el equipo no llegó, NO se imprime nada: la gran mayoría de los
// equipos no pasa a playoffs, así que un «Did not play playoffs» repetido en cada bloque
// de cada temporada es ruido, no información. Es una excepción deliberada a la regla 6
// (decidida por el dueño): el hueco no se declara, simplemente no aparece.
const al=(y,c)=>{const i=(AL[y]||[]).findIndex(g=>g.includes(c));
  return i<0?'':kvr(`${t('alliance')} ${i+1}`,AL[y][i].map(k=>`<a href="${urls.team(k)}">${k}</a>`).join(' '))};
const R={gold:0,silver:1,bronze:2,honorable:3,awarded:4},nm=c=>teamLink(c,T[c][0]);
const cells=a=>a.ty=='a'?[[a.w.map(nm).join(', '),a.tier]]:a.w.map((c,i)=>[nm(c),tierOf(a,i)]);
// Un premio del catálogo puede no existir en todos los años (el catálogo es la unión),
// por eso la búsqueda por año puede no encontrar nada.
const ovCells=name=>{const m={};Y.forEach(y=>{const a=A[y].find(x=>x.name==name);if(!a)return;a.w.forEach((c,i)=>{const k=tierOf(a,i),z=m[c]||(m[c]={n:0,k});z.n++;if(R[k]<R[z.k])z.k=k})});return Object.entries(m).sort((a,b)=>R[a[1].k]-R[b[1].k]||b[1].n-a[1].n).map(([c,z])=>[nm(c)+(z.n>1?` ×${z.n}`:''),z.k])};
const awBlocks=y=>`<div class="aws">${(y?A[y]:AW.map(([name,desc])=>({name,desc}))).map(a=>awardBlock(a.name,a.desc,y?cells(a):ovCells(a.name))).join('')}</div>`;
const pips=o=>Object.entries(o).map(([k,n])=>`${pip(k)} ×${n}`).join(' ');
const av=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=av(a);return Math.sqrt(av(a.map(v=>(v-m)**2)))},pm=a=>`${av(a).toFixed(1)} <span class="muted">± ${sd(a).toFixed(1)}</span>`;
const best=ms=>ms.length?ms.reduce((a,m)=>Math.max(m.rs,m.bs)>Math.max(a.rs,a.bs)?m:a):null;
const hi=m=>m?`<div>${matchRow(m)}</div><div class="sec">${m.video?videoThumb(m):videoFallback(m)}</div>`:`<div class="muted">${t('noMatchData')}</div>`;
const sc=ms=>ms.flatMap(m=>[m.rs,m.bs]);
// "Average winning margin": un empate no tiene margen de victoria, así que no entra.
// Contarlos como 0 hundía el promedio (2025: 7.0 con empates, 8.0 sin ellos).
const mg=ms=>ms.filter(m=>m.rs!=null&&m.rs!==m.bs).map(m=>Math.abs(m.rs-m.bs));
// Las columnas de desempate cambian cada temporada y vienen de los datos (S[y][].cols),
// no de una constante: cada año la competición puntúa cosas distintas. La etiqueta la
// pone data/raw/manual/rankings.labels.json al normalizar, así que aquí no hay texto.
const seasonCols=y=>(S[y][0]?.cols??[]).map(([label],i)=>[label,z=>z.cols[i][1]]);
// La columna W-L-T solo se pinta si esa temporada trae récord (2019 desde el CSV; 2024
// y 2025 derivados de los partidos). Si no, se omite en vez de llenarla de «No data». Y
// dentro de una temporada que sí lo trae, un equipo sin partidos de clasificación —CMR o
// JAM en 2025, que solo jugaron playoffs— muestra «No data», nunca «undefined–…».
const hasWlt=y=>(S[y]||[]).some(z=>z.w!==undefined);
const rank=y=>{const C=seasonCols(y),W=hasWlt(y),head=[['#',1],[t('team')],...C.map(c=>[c[0],1])];
  if(W)head.push([t('wlt'),1]);
  return dt(head,S[y].map(z=>{const row=[z.rank,tl(z.code),...C.map(c=>c[1](z))];if(W)row.push(z.w!==undefined?`${z.w}–${z.l}–${z.t}`:t('noData'));return row}),1)};
const mine=(c,y)=>(M[y]||[]).filter(m=>[...m.red,...m.blue].includes(c));
const yearsOf=c=>Y.filter(y=>(S[y]||[]).some(z=>z.code==c)||mine(c,y).length>0);
// Lugar y fecha del evento. Se omiten los campos vacíos: una temporada sin metadatos
// cargados no debe imprimir huecos ni comas sueltas.
// Nombre de la temporada. Sin metadatos cargados se usa el año, que sí se conoce:
// nunca un encabezado vacío.
const sName=y=>sn(y)?.name||String(y);
// Equipos de una temporada concreta. En una página de temporada el total histórico
// (codes.length) no significa nada: se usa el de esa edición.
const teamsOf=y=>(y?(sn(y)?.teams||t('noData')):codes.length);
// Temporadas en las que el equipo llegó a la fase de round robin (está en alguna
// alianza). No es el número de partidos jugados.
const rrSeasons=c=>Y.filter(z=>(AL[z]||[]).some(g=>g.includes(c))).length;
const place=s=>[s.city,s.country].filter(Boolean).join(', ');
const when=s=>[place(s),s.dates].filter(Boolean).join(' · ');
const countryCell=s=>s.country?`${flag(s.iso)} ${s.country}`:t('noData');
// Video de revelación del juego. En una temporada es el suyo; en el overview, el de
// la temporada más reciente que lo tenga cargado. Sin URL se deja el marcador de la
// maqueta (el dato se rellena en data/raw/manual/seasons.csv, columna reveal_video).
const revealBlock=y=>{const s=y?sn(y):seasons.find(x=>x.reveal);
  return `<h3>${t('reveal')}</h3>`+(s?.reveal
    ?videoCard(s.reveal,`${t('season')} ${s.y}`,sName(s.y))
    :`<div class="thumb">${t('thumbnail')}</div>`)};

const nAw=ys=>ys.reduce((n,z)=>n+A[z].reduce((m,a)=>m+a.w.length,0),0);
// Sin mapa de sedes: es puramente estético y queda fuera del alcance actual
// (ver docs/discovery/05-plan.md). La Home es hero → lista de sedes → KPIs.
const home=()=>hero()+`<h3>${t('venues')}</h3>${dt([[t('year')],[t('venue')],[t('country')],[t('dates')]],seasons.map(s=>[`<a href="${urls.insights(s.y)}">${s.y}</a>`,s.city||t('noData'),countryCell(s),s.dates||t('noData')]))}
<h3>${t('overview')}</h3>${boxes([box(t('matches'),Y.reduce((n,y)=>n+(M[y]||[]).length,0)),box(t('awards'),nAw(Y)),box(t('teams'),codes.length)],1)}`;

const insOverview=()=>{
  const allAwardsList=[];
  const winningCodes=new Set();
  Y.forEach(yr=>{
    (A[yr]||[]).forEach(a=>{
      if(a.ty==='a'){
        a.w.forEach(c=>{allAwardsList.push({code:c,year:yr,award:a.name,tier:a.tier});winningCodes.add(c)});
      }else{
        a.w.forEach((c,idx)=>{allAwardsList.push({code:c,year:yr,award:a.name,tier:tierOf(a,idx)});winningCodes.add(c)});
      }
    });
  });
  allAwardsList.sort((a,b)=>b.year-a.year||(T[a.code]?.[0]||a.code).localeCompare(T[b.code]?.[0]||b.code));

  return bar(t('overview'),dd(t('overview'),[[urls.insights(),t('overview')],...Y.map(z=>[urls.insights(z),z])]))
  +`<p class="muted">${t('allAwards')}</p>`
  +boxes([box(t('awards'),nAw(Y)),box(t('winningTeams'),winningCodes.size),box(t('seasons'),Y.length)],1)
  +`<h3>${t('allAwards')}</h3>`
  +dt([[t('team')],[t('year'),1],[t('awards')],[t('medals'),0]],allAwardsList.map(item=>[tl(item.code),`<a href="${urls.insights(item.year)}">${item.year}</a>`,item.award,pip(item.tier)]),1)
  +`<h3>${t('awards')}</h3>${awardKey()}${awBlocks()}`;
};

const insLive=y=>{
  const s=sn(y);
  const ms=(M[y]||[]).filter(m=>m.red&&m.red.length>0&&m.blue&&m.blue.length>0);
  const completed=ms.filter(m=>m.rs!==null);
  const upcoming=ms.filter(m=>m.rs===null);
  const fields=[...new Set(upcoming.map(m=>m.field))].filter(Boolean).sort().slice(0,5);
  const onDeck=fields.map(f=>upcoming.find(m=>m.field===f)).filter(Boolean);
  const dayBtns=STREAMS_2026.general.map(d=>`<a class="stream-btn" href="${urls.gameday()}?stream=${d.key}">${d.label}</a>`).join('');

  return bar(`${t('season')} ${y}`,dd(y,[[urls.insights(),t('overview')],...Y.map(z=>[urls.insights(z),z])]))
  +`<p class="muted">${[sName(y),place(s)].filter(Boolean).join(' · ')} · <a href="https://first.global/archive/fgc-${y}/">${t('officialSite')}</a> · ${t('koreaTime')}</p>`
  +boxes([box(t('matches'),ms.length),box(t('completed'),completed.length),box(t('upcoming'),upcoming.length),box(t('teams'),teamsOf(y))],1)
  +`<div class="stream-bar"><span>${t('mainBroadcast')}:</span>${dayBtns}<a class="stream-btn" href="${STREAMS_2026.playlist}" target="_blank" rel="noopener">▶ ${t('playlist')} ↗</a><a class="stream-btn on" href="${urls.gameday()}">⚡ ${t('gamedayTitle')}</a></div>`
  +revealBlock(y)
  +`<div class="bar"><h3>${t('liveTracker')}</h3><input type="search" id="match-filter" placeholder="${t('search')}" aria-label="${t('search')}"></div>`
  +(onDeck.length?`<h3>${t('onDeck')}</h3><div class="on-deck-matches" id="on-deck-container">${onDeck.map(m=>matchRow(m)).join('')}</div>`:'')
  +(completed.length?`<h3>${t('completed')}</h3><div>${completed.slice().reverse().map(m=>matchRow(m)).join('')}</div>`:'')
  +`<h3>${t('upcoming')}</h3><div id="live-match-list">${upcoming.map(m=>matchRow(m)).join('')}</div>`;
};

const insArchived=y=>{
  const aw=onlyAwards(y),ms=M[y]||[],q=ms.filter(m=>m.stage=='ranking'),p=ms.filter(m=>m.stage!='ranking'),s=sn(y);
  const kp=(l,a)=>a.length?box(l,av(a).toFixed(1),`± ${sd(a).toFixed(1)}`):box(l,t('noData'));
  const medalTop=yy=>codes.map(c=>[c,cntY(yy,c)]).filter(x=>tot(x[1])>0).sort((a,b)=>tot(b[1])-tot(a[1])).slice(0,10).map(([c,o],i)=>[i+1,tl(c),pips(o),tot(o)]);
  const cntBox=(l,n)=>box(l,n?n:t('noData'));
  const topVal=z=>z.cols?.[0]?.[1]??t('noData');
  const top=aw?medalTop(y):S[y].slice(0,10).map(z=>[z.rank,tl(z.code),topVal(z)]);
  const ranked=!aw;
  return bar(`${t('season')} ${y}`,dd(y,[[urls.insights(),t('overview')],...Y.map(z=>[urls.insights(z),z])]))
  +`<p class="muted">${[sName(y),place(s)].filter(Boolean).join(' · ')} · <a href="https://first.global/archive/fgc-${y}/">${t('officialSite')}</a></p>`
  +boxes(aw?[box(t('teams'),teamsOf(y)),cntBox(t('awards'),nAw([y]))]:[box(t('teams'),teamsOf(y)),cntBox(t('matches'),ms.length),cntBox(t('awards'),nAw([y]))],1)
  +revealBlock(y)
  +`<h3>${t('awards')}</h3>${awardKey()}${awBlocks(y)}`
  +(aw?`<p class="note">${t('noCompetition')}</p>`
    :`<h3>${t('highestMatch')}</h3>${hi(best(q))}<h3>${t('qualMetrics')}</h3>${boxes([kp(t('avgMatch'),sc(q)),kp(t('avgMargin'),mg(q))])}`
    +`<h3>${t('playoffs')}</h3><div>${matchList(p)}</div>`
    +`<h3>${t('highestPlayoff')}</h3>${hi(best(p))}${boxes([kp(t('avgMatch'),sc(p)),kp(t('avgMargin'),mg(p))])}`)
  +`<h3>${ranked?t('topRank'):t('mostAwards')}</h3>`+(top.length?dt(ranked?[['#',1],[t('team')],[S[y][0]?.cols?.[0]?.[0]??t('rankingPoints'),1]]:[['#',1],[t('team')],[t('medals'),0],[t('total'),1]],top):`<p class="note">${t('noData')}</p>`)
  +(ranked?`<p><a href="${urls.rankings(y)}">${t('fullRanking')}</a></p>`:`<p><a href="${urls.awards()}">${t('fullAwards')}</a></p>`);
};

const ins=y=>!y?insOverview():sn(y)?.mode==='live'?insLive(y):insArchived(y);
// Nota: la tabla muestra los 10 primeros de los 161 equipos con premios; el enlace
// lleva a /awards/, que los lista todos. La lista completa de bloques de premio
// (arriba) sí incluye a todos los ganadores de cada premio.

const teams=()=>bar(t('teams'))+['Africa','Americas','Asia','Europe','Oceania'].map(k=>`<h3>${k}</h3>`+dt([[t('flagCol')],[t('iso')],[t('team')],[t('seasons'),1]],codes.filter(c=>T[c][1]==k).sort().map(c=>[flag(c),c,`<a href="${urls.team(c)}">${T[c][0]}</a>`,yearsOf(c).length]))).join('');

const awards=()=>bar(t('awards'))+dt([[t('team')],...['gold','silver','bronze','honorable'].map(k=>[brand.medals[k].label,1]),[t('total'),1]],codes.map(c=>[c,cnt(c)]).sort((a,b)=>tot(b[1])-tot(a[1])).map(([c,o])=>[tl(c),o.gold,o.silver,o.bronze,o.honorable,tot(o)]),1);
const tot=o=>Object.values(o).reduce((x,y)=>x+y,0);

// 2020 y 2021 son temporadas `awards-only`: existieron y repartieron premios, pero sin
// competencia presencial (COVID-19), así que no hay ranking ni partidos que mostrar. Sus
// páginas se generan igual, con el aviso explícito, en vez de dejar un enlace muerto en
// el selector de temporada — que era lo que pasaba antes.
const noComp=()=>`<p class="note">${t('noCompetition')}</p>`;
// Y una temporada que existe pero todavía no tiene datos (2026, viva) declara su hueco
// en vez de pintar una tabla sin filas o un div vacío.
const rankings=y=>bar(`${t('topRank')} ${y}`,sel(y,z=>urls.rankings(z)))
  +(onlyAwards(y)?noComp():S[y].length?rank(y):`<p class="note">${t('noData')}</p>`);
const matches=y=>bar(`${t('matches')} ${y}`,sel(y,z=>urls.matches(z)))
  +(onlyAwards(y)?noComp():M[y].length?`<div>${matchList(M[y])}</div>`:`<p class="note">${t('noMatchData')}</p>`);
const gameday=()=>{
  const defStream=STREAMS_2026.general[0];
  const upcoming=(M[2026]||[]).filter(m=>m.rs===null);
  const fields=[...new Set(upcoming.map(m=>m.field))].filter(Boolean).sort().slice(0,5);
  const onDeck=fields.map(f=>upcoming.find(m=>m.field===f)).filter(Boolean);

  const presetBtns=[
    `<button class="stream-btn on" data-preset="1">${t('singleStream')}</button>`,
    `<button class="stream-btn" data-preset="2">${t('dualView')}</button>`,
    `<button class="stream-btn" data-preset="3">${t('tripleView')}</button>`,
    `<button class="stream-btn" data-preset="4">${t('quadView')}</button>`,
    `<button class="stream-btn" data-preset="5">${t('allFields')}</button>`,
  ].join('');

  const dayBtns=STREAMS_2026.general.map((d,i)=>
    `<button class="stream-btn stream-toggle${i===0?' on':''}" data-stream-id="${d.id}" data-stream-key="${d.key}" data-stream-label="${d.label}">${d.label}</button>`
  ).join('');

  const fieldBtns=Object.values(STREAMS_2026.fields).map(f=>
    `<button class="stream-btn stream-toggle" data-stream-id="${f.id}" data-stream-key="${f.key}" data-stream-field="${f.field}" data-stream-label="${f.label}">${f.label}</button>`
  ).join('');

  const initialCard=
    `<div class="player-card" data-stream-id="${defStream.id}" data-stream-key="${defStream.key}">`
    +`<div class="player-head"><span>● ${defStream.label}</span><button class="player-close" aria-label="${t('closeStream')}" title="${t('closeStream')}" data-id="${defStream.id}">×</button></div>`
    +`<div class="player-frame"><iframe src="https://www.youtube.com/embed/${defStream.id}" title="${defStream.label}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    +`</div>`;

  return bar('GameDay',`<a class="stream-btn" href="${STREAMS_2026.playlist}" target="_blank" rel="noopener">▶ ${t('playlist')} ↗</a>`)
  +`<p class="muted">${t('selectStream')} · Incheon, 2026 · ${t('koreaTime')}</p>`
  +`<div class="stream-bar"><span>${t('presets')}:</span>${presetBtns}</div>`
  +`<div class="stream-bar"><span>${t('mainBroadcast')}:</span>${dayBtns}</div>`
  +`<div class="stream-bar"><span>${t('fieldStreams')}:</span>${fieldBtns}</div>`
  +`<div class="gameday-grid" id="gameday-grid" data-count="1">${initialCard}</div>`
  +`<div class="bar"><h3>${t('onDeck')}</h3><a href="${urls.insights(2026)}">${t('liveTracker')} →</a></div>`
  +`<div class="on-deck-matches" id="on-deck-container">${onDeck.map(m=>matchRow(m)).join('')}</div>`;
};

// Foto del equipo EN ESA temporada: los integrantes cambian cada año, así que la
// imagen es por (equipo, año) y no del equipo en general. La URL es un hotlink
// externo (no se espeja en el repo) y solo se muestra, no se enlaza. Sin URL queda
// el marcador de la maqueta, que es un estado explícito.
const photo=(c,y)=>{const u=PH[y]?.[c],alt=`${T[c][0]} ${y} · ${t('photo')}`;
  return `<div class="photo">${u?`<img src="${e(u)}" alt="${e(alt)}" loading="lazy" decoding="async">`:t('photo')}</div>`};

const th=c=>{const R2=Y.map(y=>{const z=(S[y]||[]).find(x=>x.code==c);if(z)return {...z,y};const ms=mine(c,y);return ms.length?{code:c,rank:t('noData'),y,live:true}:null}),P=R2.filter(Boolean),
  // Centinela Infinity, no 99: con 99 cualquier equipo peor que el puesto 99 se
  // quedaba con el valor inicial y mostraba «#99» como si fuera su mejor puesto.
  rankedP=P.filter(z=>typeof z.rank==='number'),
  b=rankedP.reduce((a,z)=>z.rank<a.rank?{rank:z.rank,y:z.y}:a,{rank:Infinity,y:''}),
  // Un récord de carrera solo se puede sumar si TODAS las temporadas rankeadas del
  // equipo traen W-L-T (hoy: 2019 desde el CSV, 2024-2025 derivados de los partidos).
  // Sumar solo las que lo traen daría un total falso, así que si falta alguna temporada
  // se declara «No data» en vez de un número que parece completo y no lo es.
  rec=P.filter(z=>z.w!==undefined),full=rec.length>0&&rec.length===P.length,
  W=rec.reduce((a,z)=>a+z.w,0),Lo=rec.reduce((a,z)=>a+z.l,0),Ti=rec.reduce((a,z)=>a+z.t,0),n=W+Lo+Ti;
  return `<div class="bar"><div class="title">${flag(c)}<h1>${T[c][0]}</h1></div>${ddY(t('seasons'),z=>urls.team(c,z),P.map(z=>z.y))}</div><div class="kv"><div><span>${t('iso')}:</span> ${c}</div></div>`
  +boxes([box(t('matches'),full?n:t('noData')),box(t('awards'),tot(cnt(c))),box(t('record'),full?`${W}–${Lo}–${Ti}`:t('noData'),full?`${(100*W/n).toFixed(1)}%`:''),box(t('bestRank'),rankedP.length?`#${b.rank}`:t('noData'),rankedP.length?`${b.y} · ${t('of')} ${teamsOf(b.y)}`:''),box(t('medals'),'',pips(cnt(c)))],1)
  +`<h3>${t('timeline')}</h3>`+Y.map((y,i)=>{const z=R2[i],s=sn(y);
    // Sin fila de ranking hay dos casos muy distintos:
    //  · la temporada NO se jugó (2020-2021, awards-only) → el aviso es cierto, se muestra;
    //  · la temporada SÍ se jugó y el equipo no fue → no hay bloque. Antes decía «no hubo
    //    competencia», que era falso: la competencia existió, el equipo simplemente no estaba.
    if(!z)return onlyAwards(y)?`<section class="ev"><div><h2>${sName(y)}</h2><div class="when">${when(s)}</div><p class="note">${t('noCompetition')}</p><div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div>${photo(c,y)}</div></section>`:'';
    const ps=sc(mine(c,y));
    // Los KPIs de la temporada van en la columna IZQUIERDA, bajo Rank y Record, como
    // en @component:season-block del demo. La derecha queda para la foto.
    return `<section class="ev" data-season="${y}"><div><h2><a href="${urls.team(c,y)}">${sName(y)}</a></h2><div class="when">${when(s)}</div>${boxes([box(t('rank'),z.rank,`${t('of')} ${teamsOf(y)}`),box(t('record'),z.w!==undefined?`${z.w}–${z.l}–${z.t}`:t('noData'))])}${kvr(t('highestScore'),ps.length?Math.max(...ps):t('noData'))}${kvr(t('avgScore'),z.avg??t('noData'))}${al(y,c)}<div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div>${photo(c,y)}</div></section>`}).join('')};

const ts=(c,y)=>{const z=(S[y]||[]).find(x=>x.code==c)||{code:c,rank:t('noData')},s=sn(y);
  return `<div class="bar"><div class="title">${flag(c)}<h1>${T[c][0]} · ${y}</h1></div>${ddY(y,k=>urls.team(c,k),yearsOf(c))}</div><p><a href="${urls.team(c)}">← ${t('back')}</a></p>`
  +`<section class="ev" data-season="${y}"><div><h2>${sName(y)}</h2><div class="when">${when(s)}</div>${boxes([box(t('rank'),z.rank,`${t('of')} ${teamsOf(y)}`),box(t('record'),z.w!==undefined?`${z.w}–${z.l}–${z.t}`:t('noData'))])}${al(y,c)}<div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div>${photo(c,y)}</div></section>`
  +`<h3>${t('matches')}</h3><div>${matchList(mine(c,y),c)}</div>`};

// Página de un partido: a la izquierda la tabla estándar (alianzas y marcador, roja
// arriba y azul abajo) y debajo el desglose; a la derecha solo la miniatura del video.
// La lista de equipos del pie se quitó: repetía la tabla.
const mp=m=>`<div class="bar"><h1>${m.label} · ${sName(m.y)}</h1></div><p class="when">${m.field} · ${m.time}</p><section class="ev"><div class="mh span-all"><div>${scoreboard(m)}<div class="sec">${breakdown(m)}</div></div><div class="vids">${videoThumb(m)}</div></div></section>`;

export const pages=()=>{const P=[{path:'',title:brand.name,body:home()},{path:outPath(urls.insights()),title:t('overview'),active:'insights',body:ins()},{path:outPath(urls.teams()),title:t('teams'),active:'teams',body:teams()},{path:outPath(urls.awards()),title:t('awards'),active:'awards',body:awards()},{path:outPath(urls.gameday()),title:'GameDay',active:'gameday',body:gameday()}];
  Y.forEach(y=>{P.push({path:outPath(urls.insights(y)),title:`${t('season')} ${y}`,active:'insights',body:ins(y)},
    // Las temporadas sin competencia (2020-2021) también tienen páginas de ranking y de
    // partidos: muestran el aviso, no una tabla vacía. Sus partidos son 0, así que el
    // map de abajo no añade ninguna página de partido.
    {path:outPath(urls.rankings(y)),title:`${t('topRank')} ${y}`,active:'rankings',body:rankings(y)},{path:outPath(urls.matches(y)),title:`${t('matches')} ${y}`,active:'matches',body:matches(y)},...M[y].map(m=>({path:outPath(urls.match(m.id)),title:`${m.label} ${y}`,active:'matches',body:mp(m)})))});
  codes.forEach(c=>P.push({path:outPath(urls.team(c)),title:T[c][0],active:'teams',body:th(c)},...yearsOf(c).map(y=>({path:outPath(urls.team(c,y)),title:`${T[c][0]} ${y}`,active:'teams',body:ts(c,y)}))));
  const sx=[...codes.map(c=>T[c][0]),...Y.map(String)];return P.map(p=>({latest:L,sx,...p}))};
