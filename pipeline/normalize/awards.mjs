/**
 * Award normalization.
 *
 * This is the only series with uninterrupted coverage from 2017, which makes it
 * the backbone of the all-time medal table — so it is worth being precise about
 * what the data does and does not say.
 *
 * `class` is a property of the RECIPIENT, not of the award. One award can carry
 * a `gold` recipient plus several `other[]` recipients that are ALSO classed
 * `gold` — the four members of a winning alliance. Reading the award's name to
 * infer a tier would therefore be wrong.
 *
 * ── NULL CLASS IS NOT MISSING DATA ──────────────────────────────────────────
 *
 * Many recipients carry `class: null`. Verified across seasons: every single one
 * belongs to an award with no podium at all — Judges Award, Outstanding Mentor
 * Award, Social Media Challenge Award, Mansa Musa Award for Fundraising,
 * Francisco José de Caldas Award, New Technology Experience Research Posters.
 *
 * So `null` means "a recognition with no medal tier", which is a real answer.
 * The medal table counts only classed recipients; unclassed ones are counted
 * separately rather than being silently dropped or, worse, promoted to a tier.
 *
 * The one mixed case is 2025's "Video Storytelling Award": 12 recipients classed
 * and 30 not. Within a single award, upstream distinguishes placed entries from
 * unplaced ones. The normalizer preserves that rather than flattening it.
 *
 * ── SOME AWARDS GO TO PEOPLE, NOT TEAMS ─────────────────────────────────────
 *
 * A recipient is either a team (`countryCode`) or a person (`recipientName`).
 * Verified across all seven seasons: 725 team recipients, 18 person recipients,
 * 0 malformed. Every one of the 18 is the same award — the Francisco José de
 * Caldas Award for Sustainable Excellence, given to educators, three per year
 * from 2018 onward.
 *
 * Persons are kept in the award so the season page can list them, and excluded
 * from every team tally — attributing an educator's award to their country would
 * be a silent fabrication.
 */

import { resolveTeamId, normalizeCode } from './identity.mjs';

/** Upstream writes "honorable mention"; the canonical key is "honorable". */
const CLASS_ALIASES = {
  gold: 'gold',
  silver: 'silver',
  bronze: 'bronze',
  'honorable mention': 'honorable',
  honorable: 'honorable',
};

export function canonicalClass(raw) {
  if (raw === null || raw === undefined) return null;
  return CLASS_ALIASES[String(raw).toLowerCase().trim()] ?? null;
}

function recipient(entry, tierClass, tierSource, year, identity, issues, awardName) {
  if (!entry) return null;

  // A person, not a team. Kept, but never attributed to a country.
  if (!entry.countryCode) {
    if (entry.recipientName) {
      return {
        kind: 'person',
        team_id: null,
        recipient_name: String(entry.recipientName),
        class: tierClass,
        tier_source: tierSource,
      };
    }
    issues.push({
      kind: 'award',
      message: `${year}: "${awardName}" has a recipient that is neither a team nor a person: ${JSON.stringify(entry).slice(0, 80)}`,
    });
    return null;
  }

  return {
    kind: 'team',
    team_id: resolveTeamId(identity, year, entry.countryCode),
    country_code_raw: normalizeCode(entry.countryCode),
    country_name_raw: entry.country ?? null,
    class: tierClass,
    tier_source: tierSource, // 'tier' | 'other'
  };
}

export function normalizeAwards(bundle, identity, year) {
  const issues = [];
  const awards = [];

  for (const award of bundle.awards ?? []) {
    const recipients = [];
    const seen = new Set();

    const push = (entry) => {
      if (!entry) return;
      // A person's name is not a unique key the way a team_id is, so only team
      // recipients are de-duplicated.
      const key = entry.kind === 'team' ? `team:${entry.team_id}` : null;
      if (key) {
        if (seen.has(key)) {
          issues.push({
            kind: 'award',
            message: `${year}: "${award.name}" lists ${entry.team_id} more than once — kept the first`,
          });
          return;
        }
        seen.add(key);
      }
      recipients.push(entry);
    };

    // gold / silver / bronze carry their class in the key name.
    for (const tier of ['gold', 'silver', 'bronze']) {
      push(recipient(award[tier], tier, 'tier', year, identity, issues, award.name));
    }

    // `other[]` carries its class per recipient. Null stays null.
    for (const other of award.other ?? []) {
      push(recipient(other, canonicalClass(other.class), 'other', year, identity, issues, award.name));
    }

    const teamRecipients = recipients.filter((r) => r.kind === 'team');
    const classed = teamRecipients.filter((r) => r.class !== null).length;

    awards.push({
      sort_order: award.sortOrder ?? null,
      name: award.name ?? null,
      description: award.description ?? null,
      recipients,
      counts: {
        total: recipients.length,
        teams: teamRecipients.length,
        people: recipients.length - teamRecipients.length,
        classed,
        unclassed: teamRecipients.length - classed,
      },
    });
  }

  awards.sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity));

  return { awards, issues };
}

/**
 * Per-team award tally. Medals are counted by class; unclassed recognitions are
 * kept in their own bucket so both numbers are honest.
 */
export function tallyAwards(awardsByYear) {
  const byTeam = new Map();

  const bump = (teamId, cls) => {
    if (!byTeam.has(teamId)) {
      byTeam.set(teamId, { gold: 0, silver: 0, bronze: 0, honorable: 0, unclassed: 0, by_year: {} });
    }
    const t = byTeam.get(teamId);
    if (cls === null) t.unclassed++;
    else t[cls]++;
  };

  for (const { year, awards } of awardsByYear) {
    for (const award of awards) {
      for (const r of award.recipients) {
        if (r.kind !== 'team') continue; // a person's award is not a country's
        bump(r.team_id, r.class);
        const t = byTeam.get(r.team_id);
        t.by_year[year] = (t.by_year[year] ?? 0) + 1;
      }
    }
  }

  for (const t of byTeam.values()) {
    t.medals = t.gold + t.silver + t.bronze;
    t.total = t.medals + t.honorable + t.unclassed;
  }

  return byTeam;
}
