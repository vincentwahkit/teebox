# Session Handoff — 2026-05-16

## All three apps + their context files

| App | Source | Version | Lines | Context file |
|---|---|---|---|---|
| **Sankaku** (rank) | sankaku.jsx | vw-0.10.21 | ~7872 | CONTEXT_SANKAKU.md |
| **TeeBox** (do) | teebox.jsx | **vw-1.2.20** | **~8440** | CONTEXT_SWS.md |
| **Dohyo** (reconcile) | dohyo.jsx | vw-1.2.1 | ~2790 | CONTEXT_DOHYO.md |

---

## What just shipped (May 16 session) — TeeBox Casino

### TeeBox — vw-1.2.19 → vw-1.2.20 (1 feature)

**Casino** — new betting game (all-pairs cut throat + banker-style mult product on every hole).

| Topic | Decision |
|-------|----------|
| **Engine** | All-pairs on **raw nett** (no cap). Per pair: `stake = effectiveMult[i] × effectiveMult[j]`. |
| **Called mult** | Per player per hole: tap **×1 → ×2 → ×3** (`casinoMult[18][N]`). |
| **Gross bonus** | **Option A (multiply):** `effectiveMult = called × grossBonus`. Birdie default ×2, eagle+ default ×4 (setup steppers). |
| **Banker** | None — no `banker[hi]` role. |
| **Holes** | All in-play holes (not par-3 only). HIO scores normally. |
| **Players** | 2–6; default **all in flight**; picker when **N > 4** (min 2). `config.casinoPlayers`. |
| **vs V/CT/B** | **Not mutually exclusive** — can run together (uncommon). |
| **Advanced** | V/CT/B Advanced panel does **not** apply to Casino. |

**UI / data wired:**
- Setup: CASINO block under V/CT/B (toggle, $ stake, birdie/eagle steppers, player picker)
- Scorecard: Casino section per hole (mult buttons, effective × display, pair stake list)
- Totals: **Casino** row on TOTALS tab; **Sub** includes `casinoCum × casinoVal`
- Report: **Casino** settlement row; subtotal + HCP/Next include Casino
- Supabase: `games_enabled.casino`, `casino_mult`, `casino_cum`, `game_settings` (val, birdie, eagle, players)
- Import preview + round confirm dialog list Casino

**Not done:**
- Per-hole Casino mult tags on **printed report scorecard** (Banker still has B on par 3s only)
- iPhone field test
- Sankaku/Dohyo do not read/display Casino yet

**Functions added:** `casinoGrossBonus` (~455), `computeCasino` (~465).

### Sankaku / Dohyo — unchanged this session
Still vw-0.10.21 / vw-1.2.1.

---

## Previous session (May 8, 2026) — summary

### Sankaku — vw-0.10.11 → vw-0.10.21
Curtailed-round support end-to-end (cutoff, IN PROGRESS chip, handicap policy prorate/par_fill/as_played, export TeeBox JSON, scoring rules UI, etc.). See CONTEXT_SANKAKU.md.

### TeeBox — vw-1.2.16 → vw-1.2.19
Group_code integrity + in_play consistency:
- 1.2.16: WATCH ALL + `__ALL__` sentinel
- 1.2.17: Manual flight link in WATCH ALL
- 1.2.18: Sticky `group_code` (`stickyGroupCodeRef`)
- 1.2.19: in_play OFF resets gross row to par

### Dohyo — unchanged since Apr 29

---

## Cross-cutting lessons (cumulative)

1. **Investigate at the source.** Sankaku display bugs may be TeeBox writer bugs (cap-rule, in_play, etc.).
2. **Sample data masquerades as real data.** Sankaku `SAMPLE_ROUNDS` string IDs — don't add UUID defenses in TeeBox.
3. **Defaults are policy.** Sankaku `TOURNAMENT_FORMAT_DEFAULTS` changes affect existing tournaments without explicit config.
4. **Toggle: non-destructive vs aggressive.** in_play reset-to-par (1.2.19) centralizes consistency in the writer.
5. **Casino mult: multiply, don't floor.** `called × grossBonus`; pair stake is product of both sides' effective mults.

---

## Deploy commands

```bash
# Deploy TeeBox (Casino — vw-1.2.20)
cd ~/Desktop/teebox
git add src/teebox.jsx CONTEXT_SWS.md SESSION_HANDOFF.md
git commit -m "vw-1.2.20: Casino game (all-pairs CT + gross birdie/eagle mults)"
git push
# Vercel auto-deploys from push

# If copying from Downloads artifact instead:
# cp ~/Downloads/teebox.jsx ~/Desktop/teebox/src/teebox.jsx

# Deploy Sankaku (if needed — unchanged since 0.10.21)
# cp ~/Downloads/sankaku.jsx ~/Desktop/sankaku/src/sankaku.jsx
# cd ~/Desktop/sankaku && git add src/sankaku.jsx && git commit -m "..." && git push
```

No SQL changes for Casino.

**Build check (TeeBox):**
```bash
cd ~/Desktop/teebox && npm run build
```

---

## For the next conversation

**Files to upload / open:**
1. `src/teebox.jsx` (or `teebox.jsx`)
2. `CONTEXT_SWS.md`
3. `SESSION_HANDOFF.md` (this file)
4. Plus `sankaku.jsx` / `dohyo.jsx` + their CONTEXT files if touching those apps

**First-message pattern:**
> Read CONTEXT_SWS.md and SESSION_HANDOFF.md. Then [task].

**Open questions / test plan:**
- [ ] iPhone: Casino mult UI, 5–6 player picker, totals $, report PDF
- [ ] Casino-only round vs Casino + V/CT/B together
- [ ] Deploy vw-1.2.20 to teebox69.vercel.app if not live yet
- [ ] (May 8 carryover) Sankaku curtailed-round modes on real partial tournament
- [ ] (May 8 carryover) TeeBox 1.2.19 in_play toggle on iPhone

---

## Deferred in all three apps

**TeeBox:**
- Casino: report scorecard hole tags for mults (optional)
- Casino: Sankaku/Dohyo integration only if needed
- `course_name` trailing-dash cleanup at source
- Log Supabase on in_play toggle (not only hole change)
- Auto-merge identical linked flights in WATCH ALL

**Sankaku** (unchanged):
- Allowance custom value; auto-discovery deletion bug; Ryder Cup; Best Gross highlight; live toast; status math gating; gross-mode cap TODO

**Dohyo** (unchanged):
- iOS first-hole audio skip; "Shitadara" rename

---

## Standing reminders

- Sole user; OK to wipe data; dislikes migration code
- iPhone testing via Vercel preview URL
- TZ hardcoded to Asia/Singapore
- Always bump `APP_VERSION` when shipping TeeBox
- TeeBox entry: `main.jsx` → `teebox.jsx` (not template `App.jsx`)
- Build: `npm run build` in repo (or esbuild single-file check)
