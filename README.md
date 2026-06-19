# World Cup 2026 — Best Thirds & Bracket

A self-contained webapp that calculates the **8 best third-placed teams** that
advance from the 2026 FIFA World Cup group stage, updates live as goals are
entered, includes a simulator, and shows the full knockout bracket.

## Run it

No build step:

```bash
python3 serve.py
# then open http://localhost:4173
```

(`serve.py` is a tiny no-cache static server so edits show up on reload. Any
static server works too; opening `index.html` directly also works, but live
scores need it served over http.)

## What it does

- **Groups** — live standings for all 12 groups. The real, finished World Cup
  results are pre-loaded and **locked** (🔒 FT, not editable). Upcoming fixtures
  are editable: type a score and every view recalculates instantly. Each row
  also shows yellow cards, red cards, and the team's FIFA ranking, all of which
  feed the tiebreakers. Ranking uses the exact FIFA 2026 rules.
- **Live scores and cards.** Matches in progress are pulled from ESPN's public
  API every 30s, shown with a pulsing 🔴 LIVE badge and minute, and counted into
  the standings/thirds/bracket as they happen. Yellow and red cards are fetched
  per match too (with the FIFA breakdown: a second yellow is an indirect red),
  so the team-conduct tiebreaker stays accurate live. Games lock automatically
  at full time. Nothing is randomised; you only edit not-yet-started fixtures.
- **Best 3rd-Placed** — ranks the 12 third-placed teams and highlights the top 8
  that qualify.
- **Knockout Bracket** — the real, official bracket frame. No winners are
  predicted. A group's Round-of-32 slots fill in once all its matches are
  played; the 8 third-place slots lock (via FIFA Annexe C) once every group is
  complete. Knockout rounds show which match feeds each slot.
- **Tiebreak Rules** — the FIFA policy, with source.
- Your predictions for upcoming matches persist in localStorage; the locked
  real results always come from the data file, so they can't be overwritten.

## FIFA rules implemented (2026 regulations, Articles 12–13)

Within a group, teams level on points are separated by:
1. Head-to-head points → 2. head-to-head GD → 3. head-to-head goals
4. overall GD → 5. overall goals → 6. team conduct (fair-play) score
7. FIFA World Ranking

> 2026 changes: head-to-head now comes **before** overall goal difference, and
> "drawing of lots" was removed (final fallback is the FIFA World Ranking).

The 12 third-placed teams are compared on overall stats only (they never met):
points → GD → goals → conduct score → FIFA Ranking. Top 8 qualify.

The Round of 32 third-place slots are fixed by **Annexe C**, a published table of
all C(12,8)=495 combinations. `js/allocations.js` embeds all 495 rows, extracted
and validated directly from the official FIFA PDF.

Source: *Regulations for the FIFA World Cup 26* (May 2026), Articles 12 & 13 and
Annexe C — https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `css/styles.css` | Styling |
| `js/engine.js` | Standings + tiebreak logic (Article 13) |
| `js/data.js` | Teams, groups, fixtures, rules text |
| `js/allocations.js` | Official Annexe C table (495 rows) |
| `js/bracket.js` | Round of 32 + knockout tree |
| `js/live.js` | Live/finished scores from ESPN's public API |
| `js/app.js` | Rendering, score editing, live updates, persistence |
| `serve.py` | No-cache static dev server |

## Notes

- Groups reflect the Final Draw (Dec 2025) with playoff slots resolved (Mar 2026).
- Played matches carry their real result and disciplinary record (yellow/red
  cards), cross-verified from match reports. These feed the team-conduct
  tiebreaker. Matchday 1's Mexico 2-0 South Africa famously had three red cards.
- FIFA World Ranking values are an approximation, used only as the final
  tiebreaker.
