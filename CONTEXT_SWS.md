# TeeBox (Swimming With Sharks) — Context File
_Last updated: 2026-05-17 (vw-1.2.23)_

## Status snapshot
**vw-1.2.23 — Casino refined over 3 rapid iterations.** Engine changed from stacked bonuses to **winner-only bonus**. Per-hole UI separates the player's *called* multiplier (the tap state) from gross *bonus* (birdie/eagle) — bonus surfaces only in the stakes-per-matchup table and outcome calculation. Hole screen now shows a per-hole row + cumulative row. Stakes table shows resolved outcome (winner + ×stake / AS / pending ×base). Printed report scorecard tags both Banker AND Casino mults in a stacked suffix.

- **Working file**: `src/teebox.jsx` (~8506 lines)
- **Local**: `~/Desktop/teebox/src/teebox.jsx`
- **Repo**: github.com/vincentwahkit/teebox
- **Live**: https://teebox69.vercel.app
- **Version**: `vw-1.2.23` (`APP_VERSION` line 7)
- **Deploy**: `cd ~/Desktop/teebox && git add src/teebox.jsx && git commit -m "vw-1.2.23: Casino cumulative + outcome layout" && git push`
- **Build check**: `cd ~/Desktop/teebox && npm run build`

## What TeeBox is
TeeBox is the "do" app — round logging + betting. Games:

| Game | Type | Notes |
|------|------|-------|
| Vegas | Team (3–6) | Cap on nett for Vegas number only |
| Cut Throat (CT) | All-pairs, ±1 unit | Raw nett |
| Banker (p3) | vs banker, par 3 only | `banker[hi]` + `p3mult` product stakes |
| **Casino** | All-pairs, called × winner-bonus | **All holes**, raw nett, see below |
| Pts | Points | 3+ players |
| Sixes | Team segments | 4/5/6 players |
| Match bets | Nassau / GDB / Match Play / Stroke Play | `matchupBets.matchups` |

1–6 players per flight. Companion to **Dohyo** (reconcile) and **Sankaku** (rank/leaderboard).

User is sole user. Rounds → Supabase `rounds_full` / `rounds_log`. Group code + superuser WATCH ALL (`__ALL__`).

---

## Casino game (current = vw-1.2.23) — rules

**Scoring engine** (`computeCasino`, ~468):
- For each in-scope pair (i, j), determine winner by **lower raw nett**.
- Base stake = `calledMult[i] × calledMult[j]`.
- **Winner-only bonus** (vw-1.2.22+): final stake = `base × winnerBonus`. Loser's bonus is ignored.
- **Tie** → no exchange (regardless of either side's bonus).
- **calledMult**: per player per hole, tap cycles 1 → 2 → 3 (`casinoMult[18][N]`, default 1).
- **grossBonus** (`casinoGrossBonus`, ~455): gross ≤ par−2 → `casinoEagleMult` (default ×4); gross = par−1 → `casinoBirdieMult` (default ×2); else ×1. Eagle beats birdie.
- **No banker role.** HIO holes score Casino normally (no skip).
- **Nett**: uncapped (`nettScore`), same as CT/Banker match-play games.

**Concrete example**: Vincent calls ×2, John calls ×3, base = 6. Vincent birdies (bonus ×2).
- Vincent wins → ×12 (`6 × 2`). John wins → ×6 (no bonus, John didn't birdie). Tie → 0.

**Setup** (own peer section between V/CT/B Advanced and Points Games, ~2743):
- Toggle + `$` stake (`casinoVal`, **default 2** as of vw-1.2.22).
- Player picker **always visible** when Casino on; default = all players selected; min 2.
- Stepper **Gross birdie** (default ×2), **Gross eagle+** (default ×4).
- **NOT tied** to V/CT/B Advanced panel (HCP cap, HIO rule, Vegas rules, bankerNett). Advanced sits with V/CT/B; Casino is its own section.
- Start validation: Casino on + fewer than 2 picked players → error.

**Can run alongside** Vegas / CT / Banker (seldom, supported).

**Hole UI** (`{/* Casino */}`, ~6547):
- Per-player buttons show *called* mult only (×1/×2/×3) — clean tap state, no folded bonus.
- **Stakes per matchup** table: 3-column flex row (names+bonus tags | winner | ×stake), `maxHeight: 220` (6 pairs fit without scroll, 10/15 still scrolls).
  - Bonus icons next to names: 🐦 birdie, 🦅 eagle+ (only when corresponding mult > 1).
  - Pre-resolution: shows base stake on far right.
  - Tie: "AS" in centre.
  - Resolved: winner name (in winner's colour) centred, `×{stake}` on far right.
- **Hole points section** (`Hole {N} — Casino`, ~6866): "This hole" row + new **Cumulative** row (fontSize 22, +/- colouring).

**Settlement**:
- `dollars[pi]` includes `casinoCum[pi] * casinoVal` in V/CT/B subtotal (~5452).
- Totals → TOTALS tab: **Casino** row + **Sub** includes Casino.
- Report: **Casino** row in settlement table; subtotal + HCP/Next use `dollarsSubtotal` (includes Casino).

**Report scorecard tags** (vw-1.2.21+):
- Per-cell suffix is a 16px wide stack: banker tag row → casino tag row → vegas dot row.
- `showCasinoRow` flag hoisted outside loop (~938) — 3rd row only allocated when Casino is on, so non-casino reports stay compact.
- Casino tag = `×N` in indigo `#4f46e5` when called > 1 (only). Always shown (par-3 with both banker + casino → both visible since rows are stacked, not OR'd).
- Legend entry: `×2/×3 = Casino mult called` (indigo).
- Bonus icons do NOT appear on printed scorecard — bonus info is in-app only.

**Carry-over data**: rounds saved before vw-1.2.22 have `casino_cum` baked under the old stacking rule. Display in totals will reflect that historical computation until re-scored.

---

## Architecture quick-ref

### Stack
- React 19 + Vite 8, PWA (`public/manifest.json` + `vite-plugin-pwa`)
- Supabase REST (`SUPA_URL_BASE`, anon key in source)
- `main.jsx` mounts `teebox.jsx` (not `App.jsx` template)

### localStorage keys
`sws_rounds` (max 3), `sws_device_id`, `sws_lastcourse`, `sws_theme`, `sws_last_viewer_code`, `sws_highlights_<code>_<date>`, `sws_linked_flights_<date>`, `swimmingWithSharks_courses`

### Data flow
- Setup → Scorecard → autosave localStorage on gross / inPlay / casinoMult changes
- `logRound` on hole-index change (and group-code change) → `rounds_log` + `rounds_full`
- Hash-dedup skips identical `logFull` payloads

### rounds_full fields (relevant)
- `games_enabled.casino`, `game_settings.casinoVal`, `casinoBirdieMult`, `casinoEagleMult`, `casinoPlayers`
- `casino_mult` — `[18][N]` called mults (when Casino on)
- `casino_cum` — per-player unit totals (winner-bonus-only rule from vw-1.2.22)
- Existing: `gross`, `in_play`, `v_teams`, `banker`, `p3mult`, `matchups`, `group_code`, etc.

### Key constants & sentinels
- `SUPERUSER_DEFAULT_CODE = "0000"`
- `ALL_CODES_SENTINEL = "__ALL__"` — WATCH ALL drops group_code filter

### Group code stickiness (vw-1.2.18)
`stickyGroupCodeRef` in Scorecard — Supabase `group_code` never silently reverts to 0000 mid-round.

### in_play consistency (vw-1.2.19)
Toggle in_play OFF → reset that hole's gross row to par for all players (+ ghost). Writers fix data; readers don't gate on in_play.

---

## Recent version history (vw-1.2.x)

| Version | Change |
|---------|--------|
| 1.2.16 | WATCH ALL + `__ALL__`; per-row group_code chip |
| 1.2.17 | Manual flight link in WATCH ALL |
| 1.2.18 | Sticky group_code in Scorecard |
| 1.2.19 | in_play OFF resets gross to par |
| 1.2.20 | Casino game (initial: stacked bonuses; mult product per pair) |
| 1.2.21 | Casino reorg: own section, picker always visible, decoupled called/bonus in hole UI, report mult tags |
| 1.2.22 | Casino default $2; **winner-only bonus rule** (no stacking); outcome status in stakes table; stacked banker+casino tags in report (both visible on par-3) |
| **1.2.23** | **Casino cumulative row in hole screen; 3-slot stakes row layout (names \| winner \| stake) with dropped "+"** |

---

## Key code locations (~line numbers in current `teebox.jsx` @ vw-1.2.23)

| What | Line | Notes |
|------|------|-------|
| `APP_VERSION` | 7 | Bump each ship |
| `casinoGrossBonus` | ~455 | Gross → birdie/eagle factor |
| `computeCasino` | ~468 | All-pairs, **winner-bonus only** |
| `computeCutThroat` / `computePar3` | ~366 / ~440 | Casino cousins |
| `generateReport` signature | ~871 | Now accepts `casinoMult, casinoPlayers` |
| `showCasinoRow` hoist | ~938 | Drives 3rd suffix row + legend + spacers |
| Per-cell suffix (banker / casino / vegas stacked) | ~988 | 10+10+7px rows |
| Casino legend (indigo `×2/×3`) | ~1149 | Shown only when `showCasinoRow` |
| Report Casino settlement row | ~1109 | TOTAL table |
| `casinoVal` state | ~1462 | Default `?? 2` |
| `canCasino` | ~1587 | `playerCount >= 2` |
| `proceedToStart` (config build) | ~1763 | `casinoPlayers`, `casinoVal`, `games.casino` |
| `{/* ── CASINO ── */}` (Setup) | ~2743 | Section between V/CT/B Advanced & Points Games |
| `toggleCasinoMult` (1→2→3) | ~5185 | |
| Casino contributes to `dollars` subtotal | ~5452 | |
| `buildFullPayload` (Supabase persist) | ~5485 | `casino_mult`, `casino_cum`, `casinoPlayers` |
| `{/* Casino */}` hole UI (mult buttons + stakes table) | ~6547 | Outcome with winner-only bonus |
| `Hole {N} — Casino` (This hole / Cumulative rows) | ~6866 | vw-1.2.23 |
| `TotalsView` | ~7101 | Casino row + tab |
| `App` root | ~8266 | |

---

## Companion apps

| App | Version | Live |
|-----|---------|------|
| Sankaku | vw-0.10.21 | sankaku69.vercel.app |
| Dohyo | vw-1.2.1 | dohyo.vercel.app |
| TeeBox | vw-1.2.23 | teebox69.vercel.app |

**Cross-app note**: Bad data in Sankaku may originate in TeeBox. Casino units in TeeBox are independent of Sankaku tournament scoring rules. Sankaku/Dohyo do not yet read `casino_cum` or display Casino — implement only if needed.

---

## Deferred / follow-ups

**Casino**
- iPhone field test (mult UI, cumulative row, 5–6 player picker, stakes outcome, report PDF)
- Optional: re-score historical rounds saved under stacked-bonus rule (vw-1.2.20/21) — only if user notices discrepancy
- Sankaku/Dohyo integration if needed

**General (unchanged)**
- `course_name` trailing-dash cleanup at source
- Log Supabase immediately on in_play toggle (not only hole change)
- Auto-merge identical linked flights in WATCH ALL

---

## Lessons (cumulative)

1. Fix at the **writer** (TeeBox) when downstream display is wrong.
2. Sample Sankaku rounds use string IDs — don't add UUID defenses in TeeBox.
3. in_play: centralized reset-to-par (1.2.19) beats gating every reader.
4. **Casino bonus**: winner-only (vw-1.2.22) is cleaner than stacking — birdieing while losing no longer penalizes you. Bonus stays a *bonus*, not a tax.
5. **Casino UI**: separate the explicit player choice (called mult) from passive game state (bonus). Tap state is for the player; bonus state is for the table.
6. **Stacked suffix rows** in printed scorecard avoid the OR-priority trap (banker hiding casino on par-3). Hoist a single flag outside the loop so non-relevant rows aren't allocated.

---

## For the next conversation

**Upload / open:**
1. `src/teebox.jsx`
2. `CONTEXT_SWS.md` (this file)
3. `SESSION_HANDOFF.md` if doing multi-app work

**First message pattern:**
> Read CONTEXT_SWS.md. Then [task].

**Standing reminders:**
- Sole user; OK to wipe data; no migration code
- iPhone via Vercel preview
- TZ: Asia/Singapore
- Always bump `APP_VERSION` when shipping
- Casino **not** mutually exclusive with V/CT/B
- TeeBox entry: `main.jsx` → `teebox.jsx` (not template `App.jsx`)

**Open from May 8 handoff (still valid):** curtailed-round Sankaku testing, in_play iPhone check.
