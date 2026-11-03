// scripts/dev.js
// Servidor de desarrollo local con Live Reloading y soporte de Live Overlay.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { fetchLiveSnapshot } from './poll-live.js';
import { seasons } from '../site/templates/data.js';

// Sin una temporada en modo live no hay overlay que refrescar.
const hasLive = seasons.some((s) => s.mode === 'live');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'site', 'dist');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const sseClients = new Set();

function broadcastReload() {
  for (const client of sseClients) {
    try {
      client.write('data: reload\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}

const LIVE_RELOAD_SCRIPT = `<script>
  (function() {
    const sse = new EventSource('/__livereload');
    sse.onmessage = function() { location.reload(); };
    sse.onerror = function() { setTimeout(function() { location.reload(); }, 2000); };
  })();
</script>`;

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  let filePath = path.join(DIST, urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!path.extname(filePath) && fs.existsSync(filePath + '/index.html')) {
    filePath = path.join(filePath, 'index.html');
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (ext === '.html') {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const modifiedHtml = htmlContent.includes('</body>')
      ? htmlContent.replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`)
      : htmlContent + LIVE_RELOAD_SCRIPT;

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(modifiedHtml);
  } else {
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }
});

let isBuilding = false;
let buildScheduled = false;

function triggerBuild() {
  if (isBuilding) {
    buildScheduled = true;
    return;
  }

  isBuilding = true;
  console.log('🔄 Cambios detectados. Recompilando...');

  exec('node site/build.js', { cwd: ROOT }, (error, stdout, stderr) => {
    isBuilding = false;
    if (error) {
      console.error('❌ Error al compilar:');
      console.error(stderr || stdout);
    } else {
      console.log('✅ Recompilación completada.');
      broadcastReload();
    }

    if (buildScheduled) {
      buildScheduled = false;
      triggerBuild();
    }
  });
}

let debounceTimer = null;
function onFileChange(eventType, filename) {
  if (filename && (filename.startsWith('dist') || filename.includes('node_modules') || filename === 'live.json')) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerBuild();
  }, 200);
}

const watchDirs = [
  path.join(ROOT, 'site', 'templates'),
  path.join(ROOT, 'site', 'brand'),
  path.join(ROOT, 'site', 'css'),
  path.join(ROOT, 'site', 'flags'),
  path.join(ROOT, 'data', 'processed')
];

for (const dir of watchDirs) {
  if (fs.existsSync(dir)) {
    try {
      fs.watch(dir, { recursive: true }, onFileChange);
    } catch {
      fs.watch(dir, onFileChange);
    }
  }
}

// Iniciar servidor y poller live
server.listen(PORT, async () => {
  console.log(`\n🚀 Servidor de desarrollo iniciado con Live Reloading`);
  console.log(`   URL local: http://localhost:${PORT}`);
  console.log(`   Vigilando: site/templates, site/brand, site/css, data/processed\n`);

  if (!fs.existsSync(DIST)) {
    triggerBuild();
  }

  // Actualizar live.json al inicio, solo si hay temporada viva.
  if (hasLive) {
    try {
      await fetchLiveSnapshot();
    } catch (err) {
      console.warn('Aviso: no se pudo actualizar live.json al inicio:', err.message);
    }
  }
});
