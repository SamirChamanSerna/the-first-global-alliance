// Los códigos de país de api.first.global son inconsistentes entre fuentes y entre años:
//
//   mismo país      partidos/rankings                    roster (/v1/teams)
//   Antigua         ATG en 2023-2024, ANT en 2025         ANT
//   Refugiados      HPE                                   "10"
//
// El alpha-2 SÍ coincide siempre (`ag`, `10`), así que es el puente.
//
// **El roster manda**: es el código que ve quien rellena teams.csv y el que el sitio
// usa en las URLs. Aquí se traduce todo lo demás a ese espacio. Ver 06-join-keys.md.
//
// Consecuencia asumida y documentada: `ANT` es un ISO retirado y `10` no es un ISO.
// Se corrigen en origen cuando el roster se arregle, no aquí.

import fs from 'node:fs';
import path from 'node:path';

// El roster escribe los códigos especiales con sufijo ("10_hope") y la competición
// sin él ("10"). Ningún alpha-2 real lleva "_", así que cortar por ahí es seguro.
const a2 = (v) => String(v ?? '').toLowerCase().split('_')[0];

/** Lee todos los snapshots crudos de data/raw/api/{year}.json. */
export function readSnapshots(rawApiDir) {
  if (!fs.existsSync(rawApiDir)) return [];
  return fs.readdirSync(rawApiDir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(rawApiDir, f), 'utf8')));
}

/** {código visto en la competición → código del roster}.
 *  Todo equipo que no necesite traducción no aparece en el mapa. */
export function buildAliases(roster, snapshots) {
  const rosterByA2 = {};
  for (const t of roster) rosterByA2[a2(t.countryCode)] = t.country;

  const alias = {};
  const note = (entry) => {
    const canonical = rosterByA2[a2(entry.countryCode)];
    if (canonical && canonical !== entry.country) alias[entry.country] = canonical;
  };
  for (const snap of snapshots) {
    for (const m of snap.matches ?? []) for (const p of m.participants ?? []) note(p);
    for (const r of snap.rankings ?? []) if (r.team) note(r.team);
    for (const a of [...(snap.alliances_round_robin ?? []), ...(snap.alliances_finals ?? [])]) {
      for (const slot of [a.captain, a.pick1, a.pick2, a.pick3]) if (slot) note(slot.team);
    }
  }
  return alias;
}
