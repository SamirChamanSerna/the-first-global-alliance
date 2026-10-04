# Video overlay

The hand-written dataset that links matches to their video.

One file per season: `2025.json`, `2024.json`, … A match absent from its file has
**no video link at all** — not a guessed one.

```jsonc
{
  "t2:214": { "day": 1, "t": 4213 },   // exact deep link to 1:10:13
  "t2:215": { "day": 2, "t": null }    // the right VOD for day 2, no timestamp
}
```

- **Key** — `<tournamentKey>:<id>`, the same key as everywhere else. Not the
  `match_id`; the filename already carries the year.
- **`day`** — day index within the season, matching `seasons.json → streams.days`.
  Required for a link to exist.
- **`t`** — seconds into the VOD. Optional. `null` means "link to the VOD, don't
  seek".

## The two rules

1. **`day` is never inferred.** Not from `scheduled_time`, not from match
   ordering, not from the match number. If you have not recorded which day a
   match was played, it gets no link. Deriving it would invent precision the data
   does not have — and in 2023 the field is empty on all 319 ranking matches
   anyway.

2. **A wrong VOD is worse than no VOD.** Showing nothing is an honest gap;
   showing the wrong match is a false statement about a real event.

## Why this file is separate from the archive

The published season files are immutable and cached for a year. Editing one would
invalidate that cache and break the pipeline's idempotency. This overlay is a
build input — the emit merges it into the match rows and it is never published,
so adding a timestamp touches exactly one file.

## Coverage

Run `npm run videos` to see what is still missing, per season.

```bash
npm run videos          # report
npm run pipeline        # merge the overlay into the published data
```
