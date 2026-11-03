// node site/build.js → site/dist/ (sitio estático completo)
//
// Genera las 11 pantallas desde site/templates/. La fuente de datos la decide
// site/templates/data.js: data/processed/ si existe, si no el fixture mock.
import fs from 'fs';import {fileURLToPath} from 'url';
import {pages} from './templates/pages.js';import {layout} from './templates/blocks.js';import {source,seasons} from './templates/data.js';import {brand,t,metaText} from './brand/brand.js';
// data/processed/ no está en el repositorio (se genera). Si hay datos crudos pero no
// procesados, casi siempre es que falta `normalize` — y sin este corte el sitio se
// construiría con el fixture, es decir, con datos de PRUEBA, sin avisar a nadie.
// Para construir el fixture a propósito: node site/build.js --fixture
if(source==='fixture'&&!process.argv.includes('--fixture')&&fs.existsSync(fileURLToPath(new URL('./../data/raw/api/',import.meta.url)))){
  console.error('No hay data/processed/, así que el sitio saldría con datos de PRUEBA (fixture).\n'+
    '  ejecuta:  node scripts/normalize.js && node site/build.js\n'+
    '  o bien:   node site/build.js --fixture   (fixture a propósito)');
  process.exit(1);
}
// fileURLToPath, no URL.pathname: en Windows pathname da "/C:/…" y mkdir falla con "C:\C:\…".
const o=fileURLToPath(new URL('./dist/',import.meta.url)),r=f=>fs.readFileSync(new URL(f,import.meta.url));
fs.rmSync(o,{recursive:true,force:true,maxRetries:10,retryDelay:100});
const w=(f,d)=>{fs.mkdirSync(o+f.replace(/[^/]*$/,''),{recursive:true});fs.writeFileSync(o+f,d)};
const iso=new Set();let n=0;const sitemap=[];
// `[\w-]+`, no `\w+`: los assets regionales llevan guion (`14_europe`, `11_south-america`).
// Con `\w+` no se detectaban, así que no se copiaban a dist/ y salían como <img> roto.
for(const p of pages()){const h=layout(p);for(const m of h.matchAll(/flags\/([\w-]+)\.svg/g))iso.add(m[1]);w(p.path+'index.html',h);if(!p.noindex)sitemap.push(p.path===''?`${brand.siteUrl}/`:`${brand.siteUrl}/${p.path}`);n++}
// 404 y SEO de sitio: sitemap y robots se generan del mismo listado de rutas.
w('404.html',layout({title:t('notFound'),path:'',active:'',latest:seasons[0].y,sx:[],body:`<div class="bar"><h1>${t('notFound')}</h1></div><p class="muted">${metaText('notFound')}</p>`,desc:metaText('notFound'),noindex:true}));
w('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(u=>`<url><loc>${u.replace(/&/g,'&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`);
w('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${brand.siteUrl}/sitemap.xml\n`);
w('site.css',r('./brand/tokens.css')+'\n'+r('./css/components.css'));w('brand/favicon.svg',r('./brand/favicon.svg'));w('ui.js',r('./brand/ui.js'));
// El overlay live solo existe mientras alguna temporada esté en modo live. Sin él,
// `live.js` y `live.json` no se publican y las páginas no los piden.
const hasLive=seasons.some(s=>s.mode==='live');
if(hasLive)w('live.js',r('./brand/live.js'));
// _headers lo lee Cloudflare Pages del raíz de la salida. El HTML y las banderas pueden
// cachearse, pero los archivos que cambian con cada build se revalidan siempre: con
// max-age=0, Pages contesta 304 si no han cambiado, así que no cuesta ancho de banda.
let headers='/site.css\n  Cache-Control: public, max-age=0, must-revalidate\n\n/ui.js\n  Cache-Control: public, max-age=0, must-revalidate\n';
if(hasLive)headers+='\n/live.js\n  Cache-Control: public, max-age=0, must-revalidate\n';
headers+='\n/flags/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/brand/*\n  Cache-Control: public, max-age=31536000, immutable\n';
headers+='\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n';
w('_headers',headers);
const liveJsonPath=fileURLToPath(new URL('./../data/processed/live.json',import.meta.url));
if(hasLive&&fs.existsSync(liveJsonPath))w('live.json',fs.readFileSync(liveJsonPath,'utf8'));
// Banderas: se copian las reales de site/flags/ (espejadas del repositorio del
// proyecto con scripts/fetch-flags.js). Solo se genera un marcador para las que
// falten, así el sitio nunca muestra un <img> roto.
const flagsSrc=fileURLToPath(new URL('./flags/',import.meta.url));
const have=new Set(fs.existsSync(flagsSrc)?fs.readdirSync(flagsSrc).filter(f=>f.endsWith('.svg')):[]);
let copied=0,missing=[];
for(const i of iso){const f=`${i}.svg`;
  if(have.has(f)){w(`flags/${f}`,r(`./flags/${f}`));copied++;continue}
  missing.push(i);
  const k=[...i].reduce((a,c)=>a*31+c.charCodeAt(0),7),c=m=>`hsl(${(k*m)%360} 45% 45%)`;
  w(`flags/${f}`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height=".67" fill="${c(1)}"/><rect y=".67" width="3" height=".67" fill="#fff"/><rect y="1.34" width="3" height=".66" fill="${c(7)}"/></svg>`)}
console.log(n,'páginas ·',copied,'banderas reales,',missing.length,'placeholder · datos:',source);
if(missing.length)console.log('  sin bandera real:',missing.slice(0,12).join(' ')+(missing.length>12?` … +${missing.length-12}`:''));
