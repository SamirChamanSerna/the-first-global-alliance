/**
 * The search index.
 *
 * One small file, filtered in the browser. There is no search service and no
 * index server: ~257 teams is a table, not a query engine.
 *
 * `key` is folded HERE, at build time, rather than in the browser — lowercased
 * and stripped of accents, with every name, alias and ISO code already joined —
 * so the client filter is a single `includes()` and every visitor does the same
 * work the build already did.
 */

import { href } from './lib.mjs';

/** Lowercase, strip diacritics: "Côte d'Ivoire" → "cote d'ivoire". */
export const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export function searchIndexPayload(ctx) {
  const teams = ctx.identity.teams.map((t) => {
    const aliases = [...(t.aliases?.country_code ?? []), ...(t.aliases?.name ?? [])];
    return {
      team_id: t.team_id,
      name: t.name,
      display_name: t.display_name,
      entity_type: t.entity_type,
      iso2: t.iso2,
      code3: t.code3,
      seasons: t.seasons_active.length,
      first_season: t.first_season,
      href: href.team(t.team_id),
      key: fold([t.name, t.display_name, t.code3, t.iso2, ...aliases].join(' ')),
    };
  });

  return { count: teams.length, teams };
}
