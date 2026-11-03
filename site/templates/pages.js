// PLANTILLAS de las 10 pantallas. Cada una = composición de bloques; sin HTML de estilo propio.
import {brand,t,metaText} from '../brand/brand.js';
import {e,hero,flag,teamLink,teamCell,pip,box,boxes,kvr,dd,dt,matchList,matchRow,awardBlock,awardKey,scoreboard,breakdown,videoThumb,videoFallback,videoCard} from './blocks.js';
import {urls,outPath} from './urls.js';
import {seasons,T,codes,M,S,A,AL,AW,PH,ST,PL} from './data.js';
import {LIVE_STREAMS} from '../brand/streams.js';
const Y=seasons.map(s=>s.y),L=Y[0],sn=y=>seasons.find(s=>s.y==y);
// YC = temporadas con competencia. Las de solo premios (2020, 2021) no tienen partidos,
// rankings ni alianzas: no generan páginas de temporada ni entran en las métricas de
// partidos. Sus premios sí se conservan (cnt, awBlocks, /awards/). Ver docs/new-season.md.
const YC=seasons.filter(s=>s.mode!=='awards-only').map(s=>s.y);
const onlyAwards=y=>sn(y)?.mode=='awards-only';
// Una sola temporada viva como máximo: es la que enciende el overlay y el GameDay
// en tiempo real. Sin ella, el GameDay pasa a ser el archivo de playlists.
const LIVE=seasons.find(s=>s.mode==='live');
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
const al=(y,c)=>{const i=(AL[y]||[]).findIndex(g=>g.teams.includes(c));
  return i<0?'':kvr(`${t('alliance')} ${i+1}`,AL[y][i].teams.map(k=>`<a href="${urls.team(k)}">${k}</a>`).join(' '))};
// Ranking de la fase de round robin: una fila por alianza, ordenadas por su puesto en esa
// fase (y por número de alianza mientras no lo haya). El puesto, la puntuación y los
// partidos jugados son de la ALIANZA —la API los repite en las cuatro filas de equipo— y
// llegan a null hasta que publica `round_robin`, así que se declaran «No data» (regla 6) en
// vez de esconder la columna o inventar un 0; el overlay en vivo (site/brand/live.js) los
// rellena de `live.json` en cuanto el worker los reenvía. Donde no hay alianzas no se
// imprime nada, ni un «No alliances»: la mayoría de las temporadas no las tienen y sería
// ruido (misma excepción deliberada que en `al`). El `id` es el gancho del overlay, igual
// que `#ranking-table`.
const alTable=y=>{const g=(AL[y]||[]).map((a,i)=>({...a,n:i+1}));
  if(!g.length)return '';
  const head=[[t('rank'),1],[t('alliance')],[t('rankingScore'),1],[t('played'),1],
    ...[1,2,3,4].map(i=>[t('teamN').replace('{n}',i)])];
  const rows=g.slice().sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.n-b.n)
    .map(a=>[a.rank??t('noData'),`${t('alliance')} ${a.n}`,a.score??t('noData'),a.played??t('noData'),
      ...[0,1,2,3].map(i=>a.teams[i]?teamCell(a.teams[i]):'')]);
  return `<h2>${t('alliances')}</h2><div id="alliances-table">${dt(head,rows)}</div>`};
const R={gold:0,silver:1,bronze:2,honorable:3,awarded:4},nm=c=>teamLink(c,T[c][0]);
const cells=a=>a.ty=='a'?[[a.w.map(nm).join(', '),a.tier]]:a.w.map((c,i)=>[nm(c),tierOf(a,i)]);
// Un premio del catálogo puede no existir en todos los años (el catálogo es la unión),
// por eso la búsqueda por año puede no encontrar nada.
// Un mismo premio puede tener varias entradas en una temporada (p. ej. Judges
// Award técnico y no técnico). Se recorren TODAS: con `.find` se perdía una y el
// bloque mostraba menos equipos de los que ganaron el premio.
const ovCells=name=>{const m={};Y.forEach(y=>{A[y].filter(x=>x.name==name).forEach(a=>{a.w.forEach((c,i)=>{const k=tierOf(a,i),z=m[c]||(m[c]={n:0,k});z.n++;if(R[k]<R[z.k])z.k=k})})});return Object.entries(m).sort((a,b)=>R[a[1].k]-R[b[1].k]||b[1].n-a[1].n).map(([c,z])=>[nm(c)+(z.n>1?` ×${z.n}`:''),z.k])};
const awBlocks=y=>`<div class="aws">${(y?A[y]:AW.map(([name,desc])=>({name,desc}))).map(a=>awardBlock(a.name,a.desc,y?cells(a):ovCells(a.name))).join('')}</div>`;
const pips=o=>Object.entries(o).map(([k,n])=>`${pip(k)} ×${n}`).join(' ');
const av=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=av(a);return Math.sqrt(av(a.map(v=>(v-m)**2)))},pm=a=>`${av(a).toFixed(1)} <span class="muted">± ${sd(a).toFixed(1)}</span>`;
const best=ms=>ms.length?ms.reduce((a,m)=>Math.max(m.rs,m.bs)>Math.max(a.rs,a.bs)?m:a):null;
const hi=m=>m?`<div>${matchRow(m)}</div><div class="sec">${(m.video||m.stream)?videoThumb(m):videoFallback(m)}</div>`:`<div class="muted">${t('noMatchData')}</div>`;
const sc=ms=>ms.flatMap(m=>[m.rs,m.bs]).filter(v=>v!=null);
// "Average winning margin": un empate no tiene margen de victoria, así que no entra.
// Contarlos como 0 hundía el promedio (2025: 7.0 con empates, 8.0 sin ellos).
const mg=ms=>ms.filter(m=>m.rs!=null&&m.rs!==m.bs).map(m=>Math.abs(m.rs-m.bs));
// Las columnas de desempate cambian cada temporada y vienen de los datos (S[y][].cols),
// no de una constante: cada año la competición puntúa cosas distintas. La etiqueta la
// pone data/raw/manual/rankings/{year}.json al normalizar, así que aquí no hay texto.
const seasonCols=y=>(S[y][0]?.cols??[]).map(([label],i)=>[label,z=>z.cols[i][1]??t('noData')]);
// La columna W-L-T solo se pinta si esa temporada trae récord (2019 desde el CSV; 2024
// y 2025 derivados de los partidos). Si no, se omite en vez de llenarla de «No data». Y
// dentro de una temporada que sí lo trae, un equipo sin partidos de clasificación —CMR o
// JAM en 2025, que solo jugaron playoffs— muestra «No data», nunca «undefined–…».
// `w` presente pero a null es la temporada viva: la columna existe, el valor todavía no
// (null !== undefined, así que `hasWlt` la mantiene sin tocar nada).
const hasWlt=y=>(S[y]||[]).some(z=>z.w!==undefined);
// Un puesto o un récord a null (temporada viva, antes de que la API los publique) se
// declara «No data»: es un hueco, no un cero.
const rank=y=>{const C=seasonCols(y),W=hasWlt(y),head=[['#',1],[t('team')],...C.map(c=>[c[0],1])];
  if(W)head.push([t('wlt'),1]);
  return dt(head,S[y].map(z=>{const row=[z.rank??t('noData'),tl(z.code),...C.map(c=>c[1](z))];if(W)row.push(z.w!=null?`${z.w}–${z.l}–${z.t}`:t('noData'));return row}),1)};
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
const rrSeasons=c=>Y.filter(z=>(AL[z]||[]).some(g=>g.teams.includes(c))).length;
const place=s=>[s.city,s.country].filter(Boolean).join(', ');
const when=s=>[place(s),s.dates].filter(Boolean).join(' · ');
const countryCell=s=>s.country?`${flag(s.iso)} ${s.country}`:t('noData');
// Video de revelación del juego. En una temporada es el suyo; en el overview, el de
// la temporada más reciente que lo tenga cargado. Sin URL se deja el marcador de la
// maqueta (el dato se rellena en data/raw/manual/seasons.json, campo revealVideo).
const revealBlock=y=>{const s=y?sn(y):seasons.find(x=>x.reveal);
  return `<h2>${t('reveal')}</h2>`+(s?.reveal
    ?videoCard(s.reveal,`${t('season')} ${s.y}`,sName(s.y))
    :`<div class="thumb">${t('thumbnail')}</div>`)};

const nAw=ys=>ys.reduce((n,z)=>n+A[z].reduce((m,a)=>m+a.w.length,0),0);
// Sin mapa de sedes: es puramente estético y queda fuera del alcance actual
// (ver docs/new-season.md). La Home es hero → lista de sedes → KPIs.
const home=()=>hero()+`<h2>${t('venues')}</h2>${dt([[t('year')],[t('venue')],[t('country')],[t('dates')]],seasons.map(s=>[`<a href="${urls.insights(s.y)}">${s.y}</a>`,s.city||t('noData'),countryCell(s),s.dates||t('noData')]))}
<h2>${t('overview')}</h2>${boxes([box(t('matches'),Y.reduce((n,y)=>n+(M[y]||[]).length,0)),box(t('awards'),nAw(Y)),box(t('teams'),codes.length)],1)}`;

const insOverview=()=>{
  const winningCodes=new Set();
  Y.forEach(yr=>(A[yr]||[]).forEach(a=>a.w.forEach(c=>winningCodes.add(c))));

  return bar(t('overview'),dd(t('overview'),[[urls.insights(),t('overview')],...Y.map(z=>[urls.insights(z),z])]))
  +boxes([box(t('awards'),nAw(Y)),box(t('winningTeams'),winningCodes.size),box(t('seasons'),Y.length)],1)
  +`<h2>${t('awards')}</h2>${awardKey()}${awBlocks()}`;
};

const insLive=y=>{
  const s=sn(y);
  const ms=(M[y]||[]).filter(m=>m.red&&m.red.length>0&&m.blue&&m.blue.length>0);
  const completed=ms.filter(m=>m.rs!==null);
  const upcoming=ms.filter(m=>m.rs===null);
  const fields=[...new Set(upcoming.map(m=>m.field))].filter(Boolean).sort().slice(0,5);
  const onDeck=fields.map(f=>upcoming.find(m=>m.field===f)).filter(Boolean);
  const dayBtns=LIVE_STREAMS.general.map(d=>`<a class="stream-btn" href="${urls.gameday()}?stream=${d.key}">${d.label}</a>`).join('');

  return bar(`${t('season')} ${y}`,dd(y,[[urls.insights(),t('overview')],...Y.map(z=>[urls.insights(z),z])]))
  +`<p class="muted">${[sName(y),place(s)].filter(Boolean).join(' · ')} · <a href="https://first.global/archive/fgc-${y}/">${t('officialSite')}</a> · ${t('koreaTime')}</p>`
  +boxes([
    box(t('matches'),ms.length),
    `<div class="box"><small>${t('completed')}</small><b id="kpi-completed">${completed.length}</b></div>`,
    `<div class="box"><small>${t('upcoming')}</small><b id="kpi-upcoming">${upcoming.length}</b></div>`,
    box(t('teams'),teamsOf(y))
  ],1)
  +`<div class="stream-bar"><span>${t('mainBroadcast')}:</span>${dayBtns}<a class="stream-btn" href="${LIVE_STREAMS.playlist}" target="_blank" rel="noopener">▶ ${t('playlist')} ↗</a><a class="stream-btn on" href="${urls.gameday()}">⚡ ${t('gamedayTitle')}</a></div>`
  +revealBlock(y)
  // La tabla de alianzas de la fase que se está jugando: es lo que pide la especificación
  // (§2, «Playoffs / Round Robin: tabla de alianzas clasificadas») para la página de la
  // temporada. Va entre el vídeo de revelación y el tracker, antes de los partidos.
  +alTable(y)
  +`<div class="bar"><h2>${t('liveTracker')}</h2><input type="search" id="match-filter" placeholder="${t('search')}" aria-label="${t('search')}"></div>`
  +`<div id="on-deck-section"${onDeck.length?'':' hidden'}><h2>${t('onDeck')}</h2><div class="on-deck-matches" id="on-deck-container">${onDeck.map(m=>matchRow(m)).join('')}</div></div>`
  +`<div id="completed-section"${completed.length?'':' hidden'}><h2>${t('completed')}</h2><div id="completed-match-list">${completed.slice().reverse().map(m=>matchRow(m)).join('')}</div></div>`
  +`<div id="upcoming-section"><h2>${t('upcoming')}</h2><div id="live-match-list">${upcoming.map(m=>matchRow(m)).join('')}</div></div>`;
};

const insArchived=y=>{
  const aw=onlyAwards(y),ms=M[y]||[],q=ms.filter(m=>m.stage=='ranking'),p=ms.filter(m=>m.stage!='ranking'),s=sn(y);
  const kp=(l,a)=>a.length?box(l,av(a).toFixed(1),`± ${sd(a).toFixed(1)}`):box(l,t('noData'));
  const medalTop=yy=>codes.map(c=>[c,cntY(yy,c)]).filter(x=>tot(x[1])>0).sort(awardOrder).slice(0,10).map(([c,o],i)=>[i+1,tl(c),pips(o),tot(o)]);
  const cntBox=(l,n)=>box(l,n?n:t('noData'));
  const topVal=z=>z.cols?.[0]?.[1]??t('noData');
  const top=aw?medalTop(y):S[y].slice(0,10).map(z=>[z.rank,tl(z.code),topVal(z)]);
  const ranked=!aw;
  return bar(`${t('season')} ${y}`,dd(y,[[urls.insights(),t('overview')],...Y.map(z=>[urls.insights(z),z])]))
  +`<p class="muted">${[sName(y),place(s)].filter(Boolean).join(' · ')} · <a href="https://first.global/archive/fgc-${y}/">${t('officialSite')}</a></p>`
  +boxes(aw?[box(t('teams'),teamsOf(y)),cntBox(t('awards'),nAw([y]))]:[box(t('teams'),teamsOf(y)),cntBox(t('matches'),ms.length),cntBox(t('awards'),nAw([y]))],1)
  +revealBlock(y)
  +`<h2>${t('awards')}</h2>${awardKey()}${awBlocks(y)}`
  +(aw?`<p class="note">${t('noCompetition')}</p>`
    :`<h2>${t('highestMatch')}</h2>${hi(best(q))}<h2>${t('qualMetrics')}</h2>${boxes([kp(t('avgMatch'),sc(q)),kp(t('avgMargin'),mg(q))])}`
    +`<h2>${t('playoffs')}</h2><div>${matchList(p)}</div>`
    +`<h2>${t('highestPlayoff')}</h2>${hi(best(p))}${boxes([kp(t('avgMatch'),sc(p)),kp(t('avgMargin'),mg(p))])}`)
  +`<h2>${ranked?t('topRank'):t('mostAwards')}</h2>`+(top.length?dt(ranked?[['#',1],[t('team')],[S[y][0]?.cols?.[0]?.[0]??t('rankingPoints'),1]]:[['#',1],[t('team')],[t('medals'),0],[t('total'),1]],top):`<p class="note">${t('noData')}</p>`)
  +(ranked?`<p><a href="${urls.rankings(y)}">${t('fullRanking')}</a></p>`:`<p><a href="${urls.awards()}">${t('fullAwards')}</a></p>`);
};

const ins=y=>!y?insOverview():sn(y)?.mode==='live'?insLive(y):insArchived(y);
// Nota: la tabla muestra los 10 primeros de los 161 equipos con premios; el enlace
// lleva a /awards/, que los lista todos. La lista completa de bloques de premio
// (arriba) sí incluye a todos los ganadores de cada premio.

// Un equipo sin continente no cae en ninguno de los cinco grupos y desaparecería del
// directorio sin aviso (hoy solo Hope, el equipo de refugiados: no tiene país). El
// grupo final lo recoge como estado explícito, y solo se dibuja si queda alguno.
const teams=()=>{
  const groups=[...['Africa','Americas','Asia','Europe','Oceania'].map(k=>[k,c=>T[c][1]===k]),[t('noContinent'),c=>!T[c][1]]].filter(([,f])=>codes.some(f));
  return bar(t('teams'))+groups.map(([k,f])=>`<h2>${k}</h2>`+dt([[t('flagCol')],[t('iso')],[t('team')],[t('seasons'),1]],codes.filter(f).sort().map(c=>[flag(c),c,`<a href="${urls.team(c)}">${T[c][0]}</a>`,yearsOf(c).length]))).join('');
};

// Orden de la tabla de premios: oro → plata → bronce → honorable → total y, como
// último desempate, el nombre del país. Se usa igual en /awards/ y en Insights.
const tot=o=>Object.values(o).reduce((x,y)=>x+y,0);
const awardOrder=(a,b)=>b[1].gold-a[1].gold||b[1].silver-a[1].silver||b[1].bronze-a[1].bronze||b[1].honorable-a[1].honorable||tot(b[1])-tot(a[1])||T[a[0]][0].localeCompare(T[b[0]][0],'en')||a[0].localeCompare(b[0],'en');
const awards=()=>bar(t('awards'))+dt([[t('team')],...['gold','silver','bronze','honorable'].map(k=>[brand.medals[k].label,1]),[t('total'),1]],codes.map(c=>[c,cnt(c)]).sort(awardOrder).map(([c,o])=>[tl(c),o.gold,o.silver,o.bronze,o.honorable,tot(o)]),1);

// 2020 y 2021 son temporadas `awards-only`: existieron y repartieron premios, pero sin
// competencia presencial (COVID-19), así que no hay ranking ni partidos que mostrar. Sus
// páginas se generan igual, con el aviso explícito, en vez de dejar un enlace muerto en
// el selector de temporada — que era lo que pasaba antes.
const noComp=()=>`<p class="note">${t('noCompetition')}</p>`;
// Y una temporada que existe pero todavía no tiene datos (2026, viva) declara su hueco
// en vez de pintar una tabla sin filas o un div vacío.
const rankings=y=>bar(`${t('topRank')} ${y}`,sel(y,z=>urls.rankings(z)))
  // Las alianzas van arriba y la tabla de puestos debajo. El `id` no es decorativo: el
  // overlay en vivo (site/brand/live.js) busca `table.dt` para rellenar los puestos, y
  // sin él encontraba esta primera tabla y le escribía el ranking de equipos encima.
  +(onlyAwards(y)?noComp():S[y].length?alTable(y)+`<div id="ranking-table">${rank(y)}</div>`:`<p class="note">${t('noData')}</p>`);
const matches=y=>bar(`${t('matches')} ${y}`,sel(y,z=>urls.matches(z)))
  +(onlyAwards(y)?noComp():M[y].length?`<div>${matchList(M[y])}</div>`:`<p class="note">${t('noMatchData')}</p>`);
// GameDay tiene dos caras. Con una temporada viva, el visor multi-stream de siempre;
// sin ella, el archivo de playlists: una miniatura por temporada. Los enlaces por campo
// solo existen para la temporada viva; las archivadas salen de manual/playlists.json.
const gamedayArchive=()=>{
  const cards=seasons.filter(s=>PL[s.y]?.url).map(s=>videoCard(PL[s.y].url,`${t('season')} ${s.y}`,PL[s.y].title||sName(s.y),PL[s.y].thumbnail));
  return bar('GameDay')+`<p class="muted">${t('seasonStreams')}</p>`
    +(cards.length?`<div class="vids">${cards.join('')}</div>`:`<p class="note">${t('noData')}</p>`);
};

const gamedayLive=s=>{
  // Los campos salen de data/raw/manual/streams/{year}.json (ya procesado): `latest` es
  // el día más reciente con enlaces, así que al añadir las filas del día siguiente el
  // GameDay se actualiza solo, sin tocar código.
  const streams=ST[s.y];
  const day=streams?.days.find(d=>d.day===streams.latest);
  const defStream=LIVE_STREAMS.general.find(g=>g.day===streams?.latest)??LIVE_STREAMS.general[0];
  const upcoming=(M[s.y]||[]).filter(m=>m.rs===null);
  const fields=[...new Set(upcoming.map(m=>m.field))].filter(Boolean).sort().slice(0,5);
  const onDeck=fields.map(f=>upcoming.find(m=>m.field===f)).filter(Boolean);

  const presetBtns=[
    `<button class="stream-btn on" data-preset="1">${t('singleStream')}</button>`,
    `<button class="stream-btn" data-preset="2">${t('dualView')}</button>`,
    `<button class="stream-btn" data-preset="3">${t('tripleView')}</button>`,
    `<button class="stream-btn" data-preset="4">${t('quadView')}</button>`,
    `<button class="stream-btn" data-preset="5">${t('allFields')}</button>`,
  ].join('');

  const dayBtns=LIVE_STREAMS.general.map(d=>
    `<button class="stream-btn stream-toggle${d===defStream?' on':''}" data-stream-id="${d.id}" data-stream-key="${d.key}" data-stream-label="${d.label}">${d.label}</button>`
  ).join('');

  // `data-stream-field` es lo que hace que `?stream=field 1` abra el campo correcto:
  // live.js busca por campo, clave o id. La clave es del CAMPO, no del vídeo («field1»
  // sigue siendo el campo 1 cuando cambie su enlace), así que una URL guardada no
  // envejece al día siguiente.
  const fieldBtns=Object.entries(day?.fields??{}).map(([field,st])=>
    `<button class="stream-btn stream-toggle" data-stream-id="${st.id}" data-stream-key="${field.toLowerCase().replace(/\s+/g,'')}" data-stream-field="${field}" data-stream-label="${field}">${field}</button>`
  ).join('');

  const initialCard=
    `<div class="player-card" data-stream-id="${defStream.id}" data-stream-key="${defStream.key}">`
    +`<div class="player-head"><span>● ${defStream.label}</span><button class="player-close" aria-label="${t('closeStream')}" title="${t('closeStream')}" data-id="${defStream.id}">×</button></div>`
    +`<div class="player-frame"><iframe src="https://www.youtube.com/embed/${defStream.id}" title="${defStream.label}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    +`</div>`;

  return bar('GameDay',`<a class="stream-btn" href="${LIVE_STREAMS.playlist}" target="_blank" rel="noopener">▶ ${t('playlist')} ↗</a>`)
  +`<p class="muted">${t('selectStream')} · ${place(s)} · ${s.y} · ${t('koreaTime')}</p>`
  +`<div class="stream-bar"><span>${t('presets')}:</span>${presetBtns}</div>`
  +`<div class="stream-bar"><span>${t('mainBroadcast')}:</span>${dayBtns}</div>`
  +`<div class="stream-bar"><span>${t('fieldStreams')}:</span>${fieldBtns}</div>`
  +`<div class="gameday-grid" id="gameday-grid" data-count="1">${initialCard}</div>`
  +`<div class="bar"><h2>${t('onDeck')}</h2><a href="${urls.insights(s.y)}">${t('liveTracker')} →</a></div>`
  +`<div class="on-deck-matches" id="on-deck-container">${onDeck.map(m=>matchRow(m)).join('')}</div>`;
};

const gameday=()=>LIVE?gamedayLive(LIVE):gamedayArchive();

// Foto del equipo EN ESA temporada: los integrantes cambian cada año, así que la
// imagen es por (equipo, año) y no del equipo en general. La URL es un hotlink
// externo (no se espeja en el repo) y solo se muestra, no se enlaza. Sin URL queda
// el marcador de la maqueta, que es un estado explícito.
const photo=(c,y)=>{const u=PH[y]?.[c],alt=`${T[c][0]} ${y} · ${t('photo')}`;
  return `<div class="photo">${u?`<img src="${e(u)}" alt="${e(alt)}" width="900" height="675" loading="lazy" decoding="async">`:t('photo')}</div>`};

const th=c=>{const R2=Y.map(y=>{const z=(S[y]||[]).find(x=>x.code==c);if(z)return {...z,y};const ms=mine(c,y);return ms.length?{code:c,rank:t('noData'),y,live:true}:null}),P=R2.filter(Boolean),
  // Centinela Infinity, no 99: con 99 cualquier equipo peor que el puesto 99 se
  // quedaba con el valor inicial y mostraba «#99» como si fuera su mejor puesto.
  rankedP=P.filter(z=>typeof z.rank==='number'),
  b=rankedP.reduce((a,z)=>z.rank<a.rank?{rank:z.rank,y:z.y}:a,{rank:Infinity,y:''}),
  // El récord de carrera se suma sobre las temporadas que ya lo publican (2019 desde el
  // CSV, 2024-2025 derivados de los partidos). La temporada viva todavía no lo tiene en el
  // build —su `w` es null—, así que queda fuera de esta suma y la añade el overlay al vuelo
  // (site/brand/live.js): sin JS el número es el de las temporadas cerradas. Sin ninguna
  // temporada con récord, o sin partidos que sumar, se declara «No data» (regla 6).
  rec=P.filter(z=>z.w!=null),
  W=rec.reduce((a,z)=>a+z.w,0),Lo=rec.reduce((a,z)=>a+z.l,0),Ti=rec.reduce((a,z)=>a+z.t,0),n=W+Lo+Ti,
  full=rec.length>0&&n>0;
  return `<div class="bar"><div class="title">${flag(c)}<h1>${T[c][0]}</h1></div>${ddY(t('seasons'),z=>urls.team(c,z),P.map(z=>z.y))}</div><div class="kv"><div><span>${t('iso')}:</span> ${c}</div></div>`
  +boxes([box(t('matches'),full?n:t('noData')),box(t('awards'),tot(cnt(c))),box(t('record'),full?`${W}–${Lo}–${Ti}`:t('noData'),full?`${(100*W/n).toFixed(1)}%`:''),box(t('bestRank'),rankedP.length?`#${b.rank}`:t('noData'),rankedP.length?`${b.y} · ${t('of')} ${teamsOf(b.y)}`:''),box(t('medals'),'',pips(cnt(c)))],1)
  +`<h2>${t('timeline')}</h2>`+Y.map((y,i)=>{const z=R2[i],s=sn(y);
    // Sin fila de ranking hay dos casos muy distintos:
    //  · la temporada NO se jugó (2020-2021, awards-only) → el aviso es cierto, se muestra;
    //  · la temporada SÍ se jugó y el equipo no fue → no hay bloque. Antes decía «no hubo
    //    competencia», que era falso: la competencia existió, el equipo simplemente no estaba.
    if(!z)return onlyAwards(y)?`<section class="ev"><div><h3>${sName(y)}</h3><div class="when">${when(s)}</div><p class="note">${t('noCompetition')}</p><div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div>${photo(c,y)}</div></section>`:'';
    const ps=sc(mine(c,y));
    // Los KPIs de la temporada van en la columna IZQUIERDA, bajo Rank y Record, como
    // en @component:season-block del demo. La derecha queda para la foto.
    return `<section class="ev" data-season="${y}"><div><h3><a href="${urls.team(c,y)}">${sName(y)}</a></h3><div class="when">${when(s)}</div>${boxes([box(t('rank'),z.rank??t('noData'),`${t('of')} ${teamsOf(y)}`),box(t('record'),z.w!=null?`${z.w}–${z.l}–${z.t}`:t('noData'))])}${kvr(t('highestScore'),ps.length?Math.max(...ps):t('noData'))}${kvr(t('avgScore'),z.avg??t('noData'))}${al(y,c)}<div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div>${photo(c,y)}</div></section>`}).join('')};

const ts=(c,y)=>{const z=(S[y]||[]).find(x=>x.code==c)||{code:c,rank:t('noData')},s=sn(y);
  return `<div class="bar"><div class="title">${flag(c)}<h1>${T[c][0]} · ${y}</h1></div>${ddY(y,k=>urls.team(c,k),yearsOf(c))}</div><p><a href="${urls.team(c)}">← ${t('back')}</a></p>`
  +`<section class="ev" data-season="${y}"><div><h2>${sName(y)}</h2><div class="when">${when(s)}</div>${boxes([box(t('rank'),z.rank??t('noData'),`${t('of')} ${teamsOf(y)}`),box(t('record'),z.w!=null?`${z.w}–${z.l}–${z.t}`:t('noData'))])}${al(y,c)}<div class="lbl">${t('awards')}</div>${awList(y,c)}</div><div>${photo(c,y)}</div></section>`
  +`<h2>${t('matches')}</h2><div>${matchList(mine(c,y),c)}</div>`};

// Página de un partido: a la izquierda la tabla estándar (alianzas y marcador, roja
// arriba y azul abajo) y debajo el desglose; a la derecha solo la miniatura del video.
// La lista de equipos del pie se quitó: repetía la tabla.
const mp=m=>`<div class="bar"><h1>${m.label} · ${sName(m.y)}</h1></div><p class="when">${m.field} · ${m.time}</p><section class="ev"><div class="mh span-all"><div>${scoreboard(m)}<div class="sec">${breakdown(m)}</div></div><div class="vids">${videoThumb(m)}</div></div></section>`;

const searchPage=()=>{
  return bar(t('searchResults'))
  +`<p class="muted">${t('searchPrompt')}</p>`
  +`<div class="bar"><input type="search" id="search-page-input" placeholder="${t('search')}" aria-label="${t('search')}"></div>`
  +`<div id="search-results">`
  +`<h2>${t('teams')}</h2>`
  +`<div>${dt([[t('flagCol')],[t('iso')],[t('team')],[t('seasons'),1]],codes.map(c=>[flag(c),c,`<a href="${urls.team(c)}">${T[c][0]}</a>`,yearsOf(c).length]))}</div>`
  +`<h2>${t('seasons')}</h2>`
  +`<div>${dt([[t('year')],[t('venue')],[t('country')],[t('dates')]],seasons.map(s=>[`<a href="${urls.insights(s.y)}">${s.y}</a>`,s.city||t('noData'),countryCell(s),s.dates||t('noData')]))}</div>`
  +`</div>`;
};

// --- metadatos por ruta: descripción, JSON-LD y pistas de precarga -------------
const abs=u=>`${brand.siteUrl}${u}`;
const where=s=>place(s);
const metaSeason=s=>s.mode==='awards-only'
  ?metaText('seasonAwards',{name:sName(s.y),year:s.y})
  :metaText('season',{name:sName(s.y),year:s.y,place:where(s)||t('noData')});
const teamSchema=(c,y)=>({"@context":"https://schema.org","@type":"SportsTeam",name:T[c][0],alternateName:c,url:abs(y?urls.team(c,y):urls.team(c)),sport:"Robotics"});
const seasonSchema=y=>{const s=sn(y),loc=where(s);return {"@context":"https://schema.org","@type":"SportsEvent",name:`${sName(y)} · FIRST Global Challenge ${y}`,url:abs(urls.insights(y)),...(loc?{location:{"@type":"Place",name:loc}}:{})}};
const matchSchema=m=>{const s=sn(m.y),loc=where(s);return {"@context":"https://schema.org","@type":"SportsEvent",name:m.label,startDate:m.scheduledTime||undefined,url:abs(urls.match(m.id)),...(loc?{location:{"@type":"Place",name:loc}}:{}),competitor:[...new Set([...m.red,...m.blue])].map(c=>({"@type":"SportsTeam",name:T[c][0],alternateName:c}))}};
const homeSchema=[{"@context":"https://schema.org","@type":"WebSite",name:brand.name,url:`${brand.siteUrl}/`,description:metaText('home'),inLanguage:brand.lang,publisher:{"@type":"Organization",name:brand.name,url:`${brand.siteUrl}/`,logo:abs(urls.favicon())}}];

export const pages=()=>{
  const P=[
    {path:'',title:brand.name,body:home(),desc:metaText('home'),schema:homeSchema},
    {path:outPath(urls.insights()),title:t('overview'),active:'insights',body:ins(),desc:metaText('insights')},
    {path:outPath(urls.teams()),title:t('teams'),active:'teams',body:teams(),desc:metaText('teams',{count:codes.length})},
    {path:outPath(urls.awards()),title:t('awards'),active:'awards',body:awards(),desc:metaText('awards')},
    {path:outPath(urls.gameday()),title:'GameDay',active:'gameday',body:gameday(),desc:metaText('gameday'),media:true},
    // /search/ es un listado que duplica /teams/ y /insights/: no se indexa.
    {path:outPath(urls.search()),title:t('searchResults'),active:'search',body:searchPage(),desc:metaText('search'),noindex:true},
  ];
  Y.forEach(y=>{
    const s=sn(y),hasMedia=(M[y]||[]).some(m=>m.video||m.stream);
    P.push({path:outPath(urls.insights(y)),title:`${t('season')} ${y}`,active:'insights',body:ins(y),desc:metaSeason(s),schema:seasonSchema(y),media:hasMedia,photos:true},
      // Las temporadas sin competencia (2020-2021) también tienen páginas de ranking y de
      // partidos: muestran el aviso, no una tabla vacía. Sus partidos son 0, así que el
      // map de abajo no añade ninguna página de partido.
      {path:outPath(urls.rankings(y)),title:`${t('topRank')} ${y}`,active:'rankings',body:rankings(y),desc:metaText('rankings',{year:y})},
      {path:outPath(urls.matches(y)),title:`${t('matches')} ${y}`,active:'matches',body:matches(y),desc:metaText('matches',{year:y}),media:hasMedia},
      ...M[y].map(m=>({path:outPath(urls.match(m.id)),title:`${m.label} ${y}`,active:'matches',body:mp(m),desc:metaText('match',{label:m.label,year:y}),schema:matchSchema(m),media:true})));
  });
  codes.forEach(c=>P.push(
    {path:outPath(urls.team(c)),title:T[c][0],active:'teams',body:th(c),desc:metaText('team',{name:T[c][0],code:c}),schema:teamSchema(c),photos:true},
    ...yearsOf(c).map(y=>({path:outPath(urls.team(c,y)),title:`${T[c][0]} ${y}`,active:'teams',body:ts(c,y),desc:metaText('teamSeason',{name:T[c][0],year:y}),schema:teamSchema(c,y),photos:true}))));
  const sx=[...codes.map(c=>T[c][0]),...Y.map(String)];
  return P.map(p=>({latest:L,sx,...p}));
};
