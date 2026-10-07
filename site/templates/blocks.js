// BLOQUES COMPARTIDOS. Markup copiado del demo (docs/web-style-guide/demo-team-match.html).
import { brand, t } from '../brand/brand.js';
import { urls } from './urls.js';

export const e = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Sin ISO no hay imagen: marco gris (.fl.none), nunca un <img> roto.
export const flag = (isoCode) =>
  isoCode
    ? `<img class="fl" src="${urls.flag(isoCode)}" alt="" width="16" height="11" loading="lazy">`
    : `<span class="fl none"></span>`;

export const teamCell = (code, isCurrentTeam) =>
  `<a class="t${isCurrentTeam ? ' me' : ''}" href="${urls.team(code)}">${flag(code)}${code}</a>`;

export const teamLink = (code, teamName) =>
  `<a href="${urls.team(code)}">${flag(code)} ${e(teamName)}</a>`;

export const pip = (tierKey) => {
  const medal = brand.medals[tierKey];
  return `<span class="pip">${medal.emoji ? medal.emoji + ' ' : ''}${medal.label}</span>`;
};

export const box = (label, value, subtext) =>
  `<div class="box"><small>${label}</small><b>${value}</b>${subtext ? `<small>${subtext}</small>` : ''}</div>`;

export const boxes = (boxItems, columns3) =>
  `<div class="boxes${columns3 ? ' c3' : ''}">${boxItems.join('')}</div>`;

export const kvr = (label, value, isTotal) =>
  `<div class="kvr${isTotal ? ' tot' : ''}"><span>${label}</span><span>${value}</span></div>`;

export const dd = (label, items) =>
  `<details class="dd"><summary>${label}</summary><div>${items
    .map(([href, text]) => `<a href="${href}">${text}</a>`)
    .join('')}</div></details>`;

// head: [[etiqueta, numérica?]…]; rows: arrays de HTML. sort=true → ordenable con JS (el orden inicial ya viene en el HTML)
export const dt = (head, rows, sortable) =>
  `<div class="scroll"><table class="dt${sortable ? ' s' : ''}"><thead><tr>${head
    .map((h) => `<th${h[1] ? ' class="n"' : ''}>${h[0]}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${r
          .map((cell, idx) => `<td${head[idx][1] ? ' class="n"' : ''}>${cell}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody></table></div>`;

export const awardKey = () =>
  `<div class="key"><b>${t('key')}</b><span class="t-gold">${t('tierGold')}</span><span class="t-silver">${t(
    'tierSilver'
  )}</span><span class="t-bronze">${t('tierBronze')}</span><span class="t-awarded">${t('tierNone')}</span></div>`;

// cells: [[html, gold|silver|bronze|awarded]…] — módulo reutilizable para Insights (temporada y overview)
export const awardBlock = (name, desc, cells) =>
  `<div class="aw"><b>${e(name)}</b><i>${e(desc)}</i><div class="aw-r">${cells
    .map(([htmlContent, tierClass]) => `<span class="t-${tierClass}">${htmlContent}</span>`)
    .join('')}</div></div>`;

// Empate y "sin jugar" NO son lo mismo:
//   sin jugar → 'neu', gris neutro (el marcador va como «–»)
//   empate    → 'lose' en ambos lados, que es el tono tenue: cada alianza conserva
//               su rojo/azul sin que ninguna quede resaltada como ganadora.
const tone = (scoreA, scoreB) =>
  scoreA == null || scoreB == null ? 'neu' : scoreA === scoreB ? 'lose' : scoreA > scoreB ? 'win' : 'lose';

const scoreFormat = (score, toneState) => (toneState === 'win' ? `<b class="w">${score}</b>` : score);

export const matchRow = (match, currentTeamCode) => {
  const isPlayed = match.rs != null;
  const redTone = isPlayed ? tone(match.rs, match.bs) : 'neu';
  const blueTone = isPlayed ? tone(match.bs, match.rs) : 'neu';
  const renderAllianceCells = (allianceCodes) =>
    allianceCodes.map((code) => teamCell(code, code === currentTeamCode)).join('');

  return `<div class="m"><span class="c-pl">${
    match.video ? `<a class="pl" href="${urls.match(match.id)}" aria-label="${t('watch')}"></a>` : ''
  }</span><a class="lb" href="${urls.match(match.id)}">${match.label}${
    isPlayed ? '' : `<small>~${match.time} · ${match.field}</small>`
  }</a><div class="ra ${redTone}">${renderAllianceCells(match.red)}</div><div class="ba ${blueTone}">${renderAllianceCells(
    match.blue
  )}</div><span class="rs ${redTone}">${isPlayed ? scoreFormat(match.rs, redTone) : '–'}</span><span class="bs ${blueTone}">${
    isPlayed ? scoreFormat(match.bs, blueTone) : '–'
  }</span></div>`;
};

const STAGES = [
  ['finals', 'stageFinals'],
  ['round_robin', 'stageRoundRobin'],
  ['ranking', 'stageRanking']
]; // última fase primero

export const matchList = (matches, currentTeamCode) =>
  STAGES.map(([stageKey, labelKey]) => {
    const stageMatches = matches.filter((m) => m.stage === stageKey);
    return stageMatches.length
      ? `<div class="stg"><i></i><b>${t(labelKey)}</b><i></i></div>` +
          stageMatches.map((m) => matchRow(m, currentTeamCode)).join('')
      : '';
  }).join('');

export const scoreboard = (match) => {
  const redTone = tone(match.rs, match.bs);
  const blueTone = tone(match.bs, match.rs);
  return `<div class="sb"><div class="hd2">${t('teams')}</div><div class="hd2">${t('score')}</div><div class="ra ${redTone}">${match.red
    .map((c) => teamCell(c))
    .join('')}</div><span class="rs ${redTone}">${scoreFormat(match.rs, redTone)}</span><div class="ba ${blueTone}">${match.blue
    .map((c) => teamCell(c))
    .join('')}</div><span class="bs ${blueTone}">${scoreFormat(match.bs, blueTone)}</span></div>`;
};

const breakdownRow = (isTotal, label, redVal, blueVal) =>
  `<tr><td class="${isTotal ? 'rw' : 'rl'}">${redVal}</td><td class="lb${
    isTotal ? ' tot' : ''
  }"><span class="ar">${redVal > blueVal ? '←' : ''}</span><span>${label}</span><span class="ar">${
    blueVal > redVal ? '→' : ''
  }</span></td><td class="${isTotal ? 'bw' : 'bl'}">${blueVal}</td></tr>`;

// Filas del desglose, que es específico de cada juego:
//   datos reales → m.breakdown = [{label, red, blue}]  (mapa por temporada, ver docs/discovery/03)
//   fixture      → m.bd = [redWater, redParking, blueWater, blueParking]  (forma de la maqueta)
// Sin filas de detalle solo queda la fila de total.
const bdRows = (match) =>
  match.breakdown ?? [
    [t('water'), match.bd?.[0], match.bd?.[2]],
    [t('parking'), match.bd?.[1], match.bd?.[3]]
  ];

export const breakdown = (match) =>
  `<table class="bd"><tbody>${bdRows(match)
    .map(([label, redVal, blueVal]) => breakdownRow(false, label, redVal, blueVal))
    .join('')}${breakdownRow(true, t('final'), match.rs, match.bs)}</tbody></table>`;

export const videoThumb = (match) =>
  `<div><div class="thumb">${t('thumbnail')}</div><div class="cap"><a href="${urls.match(match.id)}">${
    match.label
  }</a><small>${match.y} · ${match.field}</small></div></div>`;

// Misma forma que video-thumb del demo, pero con un enlace externo y sin depender de
// un partido. Se usa para el video de revelación de la temporada.
export const videoCard = (href, label, subtext) =>
  `<div><div class="thumb">${t('thumbnail')}</div><div class="cap"><a href="${e(href)}" rel="noopener">${e(
    label
  )}</a><small>${e(subtext)}</small></div></div>`;

export const videoFallback = (match) => {
  const redWon = match.rs > match.bs;
  return `<div class="vb"><small class="when">${match.label}</small><div class="sc"><div class="tn-r${
    redWon ? 'w' : 'l'
  }"><b>${match.rs}</b><small>${match.red.join(' · ')}</small></div><div class="tn-b${
    redWon ? 'l' : 'w'
  }"><b>${match.bs}</b><small>${match.blue.join(' · ')}</small></div></div><a class="go" href="${urls.match(
    match.id
  )}">${t('watch')}</a></div>`;
};

const SORT_SCRIPT = `document.querySelectorAll('table.dt.s th').forEach((h,i)=>h.onclick=()=>{const b=h.closest('table').tBodies[0],d=h.dataset.d=h.dataset.d=='1'?-1:1;[...b.rows].sort((x,y)=>{const a=x.cells[i].textContent.trim(),c=y.cells[i].textContent.trim(),n=parseFloat(a)-parseFloat(c);return d*(isNaN(n)?a.localeCompare(c):n)}).forEach(r=>b.append(r))});document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{document.documentElement.dataset.theme=b.dataset.t;try{localStorage.setItem('th',b.dataset.t)}catch(e){}})`;

// Página completa. Enlaces internos absolutos → se convierten a relativos (+index.html) para abrir sin servidor.
export const layout = ({ title, path, active, body, latest, sx = [] }) => {
  const navLinksHtml = brand.nav
    .map(
      (n) =>
        `<a href="${n.href.replace('{season}', latest)}"${n.key === active ? ' aria-current="page"' : ''}>${
          n.label
        }</a>`
    )
    .join('');

  const htmlDoc = `<!doctype html><html lang="${brand.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="${brand.themeColor}"><title>${e(
    title
  )} · ${brand.name}</title><link rel="icon" href="${urls.favicon()}"><link rel="stylesheet" href="${urls.css()}"><script>try{var s=localStorage.getItem("th");if(s)document.documentElement.dataset.theme=s}catch(e){}</script></head><body>
<header class="nav"><a class="brand" href="${urls.home()}">${brand.logoSvg}<span>${brand.name}</span></a><nav class="links">${navLinksHtml}</nav><form action="${urls.search()}"><input type="search" name="q" list="sx" placeholder="${t(
    'search'
  )}" aria-label="${t('search')}"><datalist id="sx">${sx.map((o) => `<option value="${e(o)}">`).join('')}</datalist></form><details class="menu"><summary>${t(
    'menu'
  )}</summary><div>${navLinksHtml}</div></details></header>
<div class="wrap one"><main>${body}</main></div>
<footer><div class="row"><span>${brand.footerLinks
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join('')}</span><span class="seg"><button data-t="light">${t('light')}</button><button data-t="dark">${t(
    'dark'
  )}</button></span></div><p>${brand.attribution} ${t('mockNote')}.</p></footer>
<script>${SORT_SCRIPT}</script></body></html>`;

  const relativePrefix = '../'.repeat(path.split('/').filter(Boolean).length) || './';
  return htmlDoc.replace(
    /(href|src)="\/([^"]*)"/g,
    (m, attr, targetPath) =>
      `${attr}="${relativePrefix}${targetPath === '' || targetPath.endsWith('/') ? targetPath + 'index.html' : targetPath}"`
  );
};

export const hero = () =>
  `<div class="hero">${brand.logoSvg}<h1>${brand.name}</h1><p class="muted">${brand.tagline}</p></div>`;
