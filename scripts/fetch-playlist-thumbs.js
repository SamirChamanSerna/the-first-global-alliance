// node scripts/fetch-playlist-thumbs.js
//
// Rellena `thumbnail` en data/raw/manual/playlists.json con la imagen que YouTube
// declara como `og:image` de cada playlist (la de su primera pieza). La URL de una
// playlist no lleva id de vídeo, así que no se puede construir la miniatura sin
// leer la página. Solo toca las playlists que tengan URL y aún no tengan miniatura.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'raw', 'manual', 'playlists.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const force = process.argv.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [year, p] of Object.entries(data)) {
  if (!p.url || (p.thumbnail && !force)) continue;
  try {
    const res = await fetch(p.url, {
      headers: {'user-agent': 'Mozilla/5.0 (compatible; TFGA/1.0)'},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const m = /<meta property="og:image" content="([^"]+)"/.exec(html);
    if (!m) throw new Error('sin og:image');
    // `og:image` viene con &amp; y parámetros de sesión; el id del vídeo es la
    // parte estable y suficiente para la miniatura.
    const id = /\/vi\/([\w-]{11})\//.exec(m[1])?.[1];
    p.thumbnail = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : m[1].replace(/&amp;/g, '&');
    console.log(`${year}: ${p.thumbnail}`);
  } catch (err) {
    console.warn(`${year}: no se pudo leer la miniatura — ${err.message}`);
  }
  await sleep(600);
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n', 'utf8');
console.log('playlists.json actualizado');
