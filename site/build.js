// node site/build.js → site/dist/ (sitio estático completo)
//
// Genera las 11 pantallas desde site/templates/. La fuente de datos la decide
// site/templates/data.js: data/processed/ si existe, si no el fixture mock.
import fs from 'fs';import {fileURLToPath} from 'url';
import {pages} from './templates/pages.js';import {layout} from './templates/blocks.js';import {source} from './templates/data.js';
// fileURLToPath, no URL.pathname: en Windows pathname da "/C:/…" y mkdir falla con "C:\C:\…".
const o=fileURLToPath(new URL('./dist/',import.meta.url)),r=f=>fs.readFileSync(new URL(f,import.meta.url));
fs.rmSync(o,{recursive:true,force:true});
const w=(f,d)=>{fs.mkdirSync(o+f.replace(/[^/]*$/,''),{recursive:true});fs.writeFileSync(o+f,d)};
const iso=new Set();let n=0;
for(const p of pages()){const h=layout(p);for(const m of h.matchAll(/flags\/(\w+)\.svg/g))iso.add(m[1]);w(p.path+'index.html',h);n++}
w('site.css',r('./brand/tokens.css')+'\n'+r('./css/components.css'));w('brand/favicon.svg',r('./brand/favicon.svg'));
// Banderas PLACEHOLDER (reemplazar por el set real en site/flags/{iso}.svg)
for(const i of iso){const k=[...i].reduce((a,c)=>a*31+c.charCodeAt(0),7),c=m=>`hsl(${(k*m)%360} 45% 45%)`;w(`flags/${i}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height=".67" fill="${c(1)}"/><rect y=".67" width="3" height=".67" fill="#fff"/><rect y="1.34" width="3" height=".66" fill="${c(7)}"/></svg>`)}
console.log(n,'páginas,',iso.size,'banderas placeholder · datos:',source);
