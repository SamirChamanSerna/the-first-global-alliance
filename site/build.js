// node site/build.js → site/dist/ (sitio estático completo)
//
// Genera las 11 pantallas desde site/templates/. La fuente de datos la decide
// site/templates/data.js: data/processed/ si existe, si no el fixture mock.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from './templates/pages.js';
import { layout } from './templates/blocks.js';
import { source } from './templates/data.js';

// data/processed/ no está en el repositorio (se genera). Si hay datos crudos pero no
// procesados, casi siempre es que falta `normalize` — y sin este corte el sitio se
// construiría con el fixture, es decir, con datos de PRUEBA, sin avisar a nadie.
// Para construir el fixture a propósito: npm run build:fixture
const rawApiDir = fileURLToPath(new URL('./../data/raw/api/', import.meta.url));
if (source === 'fixture' && !process.argv.includes('--fixture') && fs.existsSync(rawApiDir)) {
  console.error(
    'No hay data/processed/, así que el sitio saldría con datos de PRUEBA (fixture).\n' +
      '  ejecuta:  npm run normalize && npm run build\n' +
      '  o bien:   npm run build:fixture   (fixture a propósito)'
  );
  process.exit(1);
}

// fileURLToPath, no URL.pathname: en Windows pathname da "/C:/…" y mkdir falla con "C:\C:\…".
const outputDir = fileURLToPath(new URL('./dist/', import.meta.url));
const readFileContent = (relativePath) => fs.readFileSync(new URL(relativePath, import.meta.url));

// Limpieza segura de site/dist/ con reintentos para evitar bloqueos temporales en Windows (ENOTEMPTY / EBUSY)
fs.rmSync(outputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

// Escribe un archivo asegurando la existencia de sus carpetas padre usando path.dirname
const writeFile = (relativePath, content) => {
  const fullPath = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
};

const requiredFlags = new Set();
let pageCount = 0;

// Renderizado de todas las páginas del sitio
for (const page of pages()) {
  const html = layout(page);
  for (const match of html.matchAll(/flags\/(\w+)\.svg/g)) {
    requiredFlags.add(match[1]);
  }
  writeFile(path.join(page.path, 'index.html'), html);
  pageCount++;
}

// Concatenación de estilos CSS (tokens + componentes) y copia de favicon
writeFile('site.css', readFileContent('./brand/tokens.css') + '\n' + readFileContent('./css/components.css'));
writeFile('brand/favicon.svg', readFileContent('./brand/favicon.svg'));

// Banderas: se copian las reales de site/flags/ (espejadas del repositorio con scripts/fetch-flags.js).
// Solo se genera un marcador para las que falten, evitando imágenes rotas.
const flagsSourceDir = fileURLToPath(new URL('./flags/', import.meta.url));
const availableFlags = new Set(
  fs.existsSync(flagsSourceDir)
    ? fs.readdirSync(flagsSourceDir).filter((file) => file.endsWith('.svg'))
    : []
);

let copiedFlagsCount = 0;
const missingFlags = [];

for (const isoCode of requiredFlags) {
  const flagFileName = `${isoCode}.svg`;
  if (availableFlags.has(flagFileName)) {
    writeFile(path.join('flags', flagFileName), readFileContent(`./flags/${flagFileName}`));
    copiedFlagsCount++;
    continue;
  }

  missingFlags.push(isoCode);
  const hashSeed = [...isoCode].reduce((acc, char) => acc * 31 + char.charCodeAt(0), 7);
  const generateColor = (multiplier) => `hsl(${(hashSeed * multiplier) % 360} 45% 45%)`;
  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height=".67" fill="${generateColor(
    1
  )}"/><rect y=".67" width="3" height=".67" fill="#fff"/><rect y="1.34" width="3" height=".66" fill="${generateColor(
    7
  )}"/></svg>`;

  writeFile(path.join('flags', flagFileName), placeholderSvg);
}

console.log(
  `${pageCount} páginas · ${copiedFlagsCount} banderas reales, ${missingFlags.length} placeholder · datos: ${source}`
);
if (missingFlags.length) {
  console.log(
    '  sin bandera real: ' +
      missingFlags.slice(0, 12).join(' ') +
      (missingFlags.length > 12 ? ` … +${missingFlags.length - 12}` : '')
  );
}
