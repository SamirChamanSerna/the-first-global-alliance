// node site/build-mock.js → site/dist/ (HTML estático de prueba con datos ficticios)
import fs from 'fs';import {pages} from './templates/pages.js';import {layout} from './templates/blocks.js';
const o=new URL('./dist/',import.meta.url).pathname,r=f=>fs.readFileSync(new URL(f,import.meta.url));
fs.rmSync(o,{recursive:true,force:true});
const w=(f,d)=>{fs.mkdirSync(o+f.replace(/[^/]*$/,''),{recursive:true});fs.writeFileSync(o+f,d)};
const iso=new Set();let n=0;
for(const p of pages()){const h=layout(p);for(const m of h.matchAll(/flags\/(\w+)\.svg/g))iso.add(m[1]);w(p.path+'index.html',h);n++}
w('site.css',r('./brand/tokens.css')+'\n'+r('./css/components.css'));w('brand/favicon.svg',r('./brand/favicon.svg'));
// Banderas PLACEHOLDER (reemplazar por tu set real en /flags/{iso}.svg)
for(const i of iso){const k=[...i].reduce((a,c)=>a*31+c.charCodeAt(0),7),c=m=>`hsl(${(k*m)%360} 45% 45%)`;w(`flags/${i}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height=".67" fill="${c(1)}"/><rect y=".67" width="3" height=".67" fill="#fff"/><rect y="1.34" width="3" height=".66" fill="${c(7)}"/></svg>`)}
console.log(n,'páginas,',iso.size,'banderas placeholder');
