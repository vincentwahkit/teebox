# TeeBox (Swimming With Sharks) — Context File
_Last updated: 2026-05-16 (vw-1.2.20)_

## Status snapshot
**vw-1.2.20 — Casino game shipped (local, not necessarily deployed).** New betting game: all-pairs cut throat on raw nett with per-player called mults (×1/2/3) and gross birdie/eagle auto-amplifiers. Coexists with Vegas/CT/Banker (not mutually exclusive). Totals panel + PDF report settlement include Casino row and subtotal.

- **Working file**: `src/teebox.jsx` (~8440 lines)
- **Local**: `~/Desktop/teebox/src/teebox.jsx`
- **Repo**: github.com/vincentwahkit/teebox
- **Live**: https://teebox69.vercel.app
- **Version**: `vw-1.2.20` (`APP_VERSION` line 7)
- **Deploy**: `cd ~/Desktop/teebox && git add src/teebox.jsx && git commit -m "vw-1.2.20: Casino game" && git push`
- **Build check**: `cd ~/Desktop/teebox && npm run build`

## What TeeBox is
TeeBox is the "do" app — round logging + betting. Games:

| Game | Type | Notes |
|------|------|-------|
| Vegas | Team (3–6) | Cap on nett for Vegas number only |
| Cut Throat (CT) | All-pairs, ±1 unit | Raw nett |
| Banker (p3) | vs banker, par 3 only | `banker[hi]` + `p3mult` product stakes |
| **Casino** | All-pairs, variable stake | **All holes**, raw nett, see below |
| Pts | Points | 3+ players |
| Sixes | Team segments | 4/5/6 players |
| Match bets | Nassau / GDB / Match Play / Stroke Play | `matchupBets.matchups` |

1–6 players per flight. Companion to **Dohyo** (reconcile) and **Sankaku** (rank/leaderboard).

User is sole user. Rounds → Supabase `rounds_full` / `rounds_log`. Group code + superuser WATCH ALL (`__ALL__`).

---

## Casino game (vw-1.2.20) — rules

**Scoring engine** (`computeCasino`, ~465):
- For each in-scope pair (i, j), lower **raw nett** wins `stake = effectiveMult[i] × effectiveMult[j]` units.
- **effectiveMult[i] = calledMult[i] × grossBonus[i]** (Option A — multiply, not floor).
- **calledMult**: per player per hole, tap cycles 1 → 2 → 3 (`casinoMult[18][N]`, default 1).
- **grossBonus** (`casinoGrossBonus`, ~455): gross ≤ par−2 → `casinoEagleMult` (default 4); gross = par−1 → `casinoBirdieMult` (default 2); else 1. Eagle beats birdie (no stack).
- **No banker role.** HIO holes score Casino normally (no skip).
- **Nett**: uncapped (`nettScore`), same as CT/Banker match-play games.

**Setup** (section under V/CT/B, ~2500):
- Toggle + `$` stake (`casinoVal`, default 3).
- Stepper **Gross birdie** (default ×2), **Gross eagle+** (default ×4).
- **Player scope**: default all players in flight; when **N > 4**, picker (min 2, default all 5/6). Stored as `config.casinoPlayers` (array of indices).
- **Not** tied to V/CT/B Advanced panel (HCP cap, HIO rule, Vegas rules, bankerNett).
- Start validation: Casino on + fewer than 2 picked players → error.

**Can run alongside** Vegas / CT / Banker (seldom, supported).

**Settlement**:
- `dollars[pi]` includes `casinoCum[pi] * casinoVal` in V/CT/B subtotal (`dollars` array ~5425).
- Totals → TOTALS tab: **Casino** row + **Sub** includes Casino.
- Report: **Casino** row in settlement table; subtotal + HCP/Next use `dollarsSubtotal` (includes Casino).
- **Not done**: per-hole Casino mult tags on printed scorecard grid (Banker still has B/×2 on par 3s only).

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
- `casino_cum` — per-player unit totals
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
| **1.2.20** | **Casino game** (all-pairs CT + banker-style mult product + gross birdie/eagle) |

---

## Key code locations (~line numbers in current `teebox.jsx`)

| What | Line | Notes |
|------|------|-------|
| `APP_VERSION` | 7 | Bump each ship |
| `casinoGrossBonus` | ~455 | Gross → birdie/eagle factor |
| `computeCasino` | ~465 | All-pairs stakes |
| `computeCutThroat` / `computePar3` | ~366 / ~440 | Casino cousins |
| `generateReport` | ~863 | Passes `casinoCum`, `casinoVal` |
| Report Casino row | ~1088 | Settlement table |
| `Setup` | ~1411 | Casino block ~2500 |
| `proceedToStart` | ~1735 | `casinoPlayers`, `casinoVal`, `games.casino` |
| `canCasino` | ~1563 | `playerCount >= 2` |
| `Scorecard` | ~4910+ | `cp`, `casinoMult`, `casinoCum` |
| Casino hole UI | ~6515 | Mult buttons + pair stakes preview |
| Casino hole points | ~6805 | Separate section per hole |
| `dollars` incl. Casino | ~5425 | Subtotal for V/C/B/Casino |
| `buildFullPayload` | ~5475 | `casino_mult`, `casino_cum` |
| `TotalsView` | ~7037 | Casino row ~7139; tab `casino` ~7429 |
| `toggleCasinoMult` | ~5162 | 1→2→3 |
| `App` root | ~8202 | |

---

## Companion apps

| App | Version | Live |
|-----|---------|------|
| Sankaku | vw-0.10.21 | sankaku69.vercel.app |
| Dohyo | vw-1.2.1 | dohyo.vercel.app |
| TeeBox | vw-1.2.20 | teebox69.vercel.app |

**Cross-app note**: Bad data in Sankaku may originate in TeeBox. Casino units in TeeBox are independent of Sankaku tournament scoring rules.

---

## Deferred / follow-ups

**Casino**
- iPhone field test (mult UI, 5–6 player picker, report)
- Optional: Casino mult tags on report scorecard (like Banker B on par 3s)
- Sankaku/Dohyo: only if they need to read `casino_cum` / display Casino (not implemented elsewhere yet)

**General (unchanged)**
- `course_name` trailing-dash cleanup at source
- Log Supabase immediately on in_play toggle (not only hole change)
- Auto-merge identical linked flights in WATCH ALL

---

## Lessons (cumulative)

1. Fix at the **writer** (TeeBox) when downstream display is wrong.
2. Sample Sankaku rounds use string IDs — don't add UUID defenses in TeeBox.
3. in_play: centralized reset-to-par (1.2.19) beats gating every reader.
4. **Casino**: Option A = `called × grossBonus`; product stake per pair = `eff[i]×eff[j]`.

---

## For the next conversation

**Upload / open:**
1. `src/teebox.jsx`
2. `CONTEXT_SWS.md` (this file)
3. `SESSION_HANDOFF.md` from `~/Downloads/teebox/20260508.rebuild/` if doing multi-app work

**First message pattern:**
> Read CONTEXT_SWS.md. Then [task].

**Standing reminders:**
- Sole user; OK to wipe data; no migration code
- iPhone via Vercel preview
- TZ: Asia/Singapore
- Always bump `APP_VERSION` when shipping
- Casino **not** mutually exclusive with V/CT/B

**Open from May 8 handoff (still valid):** curtailed-round Sankaku testing, in_play iPhone check, deploy 1.2.19 if not already on Vercel.
