# Contributing

This is an unofficial, volunteer-run archive. Small fixes and data corrections are
welcome; for larger changes, open an issue first so the approach can be agreed.

## Ground rules

- **Never hand-edit generated output.** `data/processed/` and `site/dist/` are wiped and
  rebuilt. Edit `data/raw/`, `scripts/`, `site/templates/`, `site/brand/`, `site/css/` or
  `worker/`.
- **Do not invent data.** A missing value is `null` (or an absent key), never `0`, `-`,
  `N/A` or an empty string pretending to be a result. The templates have explicit empty
  states.
- **Do not join on `teamKey`.** It is reassigned every season. Teams are identified by
  their roster code (ISO alpha-3); alpha-2 is the bridge to the API. See
  [`docs/api-notes.md`](docs/api-notes.md).
- **Respect the data contract.** The processed shape is documented at the top of
  `site/templates/data.js`. Templates must use `t()` for UI text, `urls.js` for links and
  `blocks.js` for shared markup.
- **No secrets.** Never commit `.env`, `.dev.vars`, `.wrangler/` or API tokens. The live
  worker needs none today.
- **New components need a proposal** in `docs/web-style-guide/05-componentes-pendientes.md`
  and approval before they are added to `components.css`.

## Before opening a pull request

```bash
node scripts/normalize.js
node site/build.js
node scripts/check.js
npm test
```

The build must finish without errors, `check.js` must pass and the generated site must
still work with JavaScript disabled. If a change is meant to alter visible output, say so
in the pull request and include the affected pages.

## Language

Code comments and commit messages are in Spanish. Public documentation and user-facing
strings are in English; UI strings live in `site/brand/brand.js` under `labels` and
`meta`. Labels are whole phrases with placeholders, never strings glued together from
fragments. The original visual guide in `docs/web-style-guide/` remains in Spanish.

## Adding a season

Follow [`docs/new-season.md`](docs/new-season.md). It covers the data refresh, the manual
JSON files, the live worker and the archive step.
