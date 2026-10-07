// node site/build.js → site/dist/ (sitio estático completo)
//
// Genera las 11 pantallas desde site/templates/. La fuente de datos la decide
// site/templates/data.js: data/processed/ si existe, si no el fixture mock.
import fs from 'fs';import {fileURLToPath} from 'url';
import {pages} from './templates/pages.js';import {layout} from './templates/blocks.js';import {source} from './templates/data.js';
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
fs.rmSync(o,{recursive:true,force:true});
const w=(f,d)=>{fs.mkdirSync(o+f.replace(/[^/]*$/,''),{recursive:true});fs.writeFileSync(o+f,d)};
const iso=new Set();let n=0;
// `[\w-]+`, no `\w+`: los assets regionales llevan guion (`14_europe`, `11_south-america`).
// Con `\w+` no se detectaban, así que no se copiaban a dist/ y salían como <img> roto.
for(const p of pages()){const h=layout(p);for(const m of h.matchAll(/flags\/([\w-]+)\.svg/g))iso.add(m[1]);w(p.path+'index.html',h);n++}
w('site.css',r('./brand/tokens.css')+'\n'+r('./css/components.css'));w('brand/favicon.svg',r('./brand/favicon.svg'));
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
