// scripts/check.js
// Verificaciones de calidad y cumplimiento de reglas de diseño (CLAUDE.md §27).
// Falla ruidosamente si se violan los contratos de diseño o tokens.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;

function report(condition, message, details = []) {
  if (!condition) {
    console.error(`❌ ${message}`);
    for (const d of details) console.error(`   ${d}`);
    errors++;
  } else {
    console.log(`✅ ${message}`);
  }
}

// 1. Sin colores literales en components.css (deben estar exclusivamente en tokens.css)
const componentsCssPath = path.join(ROOT, 'site', 'css', 'components.css');
if (fs.existsSync(componentsCssPath)) {
  const css = fs.readFileSync(componentsCssPath, 'utf8');
  const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
  const matches = [];
  let m;
  const lines = css.split('\n');
  lines.forEach((line, idx) => {
    while ((m = colorRegex.exec(line)) !== null) {
      matches.push(`Línea ${idx + 1}: ${m[0]} en "${line.trim()}"`);
    }
  });
  report(matches.length === 0, 'No hay colores literales fuera de tokens.css', matches);
}

// 2. Sin atributos inline style= en las plantillas
const templatesDir = path.join(ROOT, 'site', 'templates');
const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.js'));
const styleMatches = [];
for (const file of templateFiles) {
  const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('style=')) {
      styleMatches.push(`${file}:${idx + 1} -> "${line.trim()}"`);
    }
  });
}
report(styleMatches.length === 0, 'No hay atributos style= inline en plantillas', styleMatches);

// 3. Sin literales directos de "The FIRST Global Alliance" fuera de brand.js
function findBrandLiteral(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hits = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'dist' && entry.name !== 'flags') {
        hits.push(...findBrandLiteral(fullPath));
      }
    } else if (entry.name.endsWith('.js') && entry.name !== 'brand.js') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('The FIRST Global Alliance')) {
          hits.push(`${path.relative(ROOT, fullPath)}:${idx + 1} -> "${line.trim()}"`);
        }
      });
    }
  }
  return hits;
}

const siteDir = path.join(ROOT, 'site');
const brandHits = findBrandLiteral(siteDir);
report(brandHits.length === 0, 'No hay strings de marca literales fuera de brand.js', brandHits);

if (errors > 0) {
  console.error(`\nSe encontraron ${errors} fallo(s) en la verificación.`);
  process.exit(1);
} else {
  console.log('\nTodas las comprobaciones de estilo y tokens pasaron con éxito.');
}
