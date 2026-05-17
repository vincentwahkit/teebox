# Session Handoff — 2026-05-17

## All three apps + their context files

| App | Source | Version | Lines | Context file |
|---|---|---|---|---|
| **Sankaku** (rank) | sankaku.jsx | vw-0.10.21 | ~7872 | CONTEXT_SANKAKU.md |
| **TeeBox** (do) | teebox.jsx | **vw-1.2.23** | **~8506** | CONTEXT_SWS.md |
| **Dohyo** (reconcile) | dohyo.jsx | vw-1.2.1 | ~2790 | CONTEXT_DOHYO.md |

---

## What just shipped (May 17 session) — TeeBox Casino, three rapid iterations

Three consecutive bumps refining the Casino game shipped in vw-1.2.20.

### vw-1.2.20 → vw-1.2.21 — Setup + UI cleanup
| Topic | Decision |
|-------|----------|
| **Setup placement** | Casino moved into its own section between V/CT/B Advanced panel and Points Games. Advanced no longer "sandwiched" by Casino. |
| **Player picker** | Always visible when Casino on (was: only when N > 4). Default = all players. Min 2. |
| **Decoupled called vs bonus** | Per-player mult button shows only the tapped value (×1/×2/×3) — no folded bonus, no "call ×N" subtext. Bonus visualized only in stakes table via 🐦 / 🦅 icons next to player names. |
| **Stakes table size** | `maxHeight: 120 → 220` so 4-player default (6 pairs) fits without scroll. |
| **Report scorecard tags** | Casino mult tag (indigo ×N) added in per-cell suffix slot; legend added. Used `||` fallback initially. |

### vw-1.2.21 → vw-1.2.22 — Engine rewrite + outcome + report fix
| Topic | Decision |
|-------|----------|
| **Default stake** | `casinoVal` 3 → 2 (state init + 3 `?? 2` fallback sites for legacy rounds). |
| **Bonus rule rewrite** | `computeCasino` rewritten: **only the winner's bonus** applies. Stake = `calledI × calledJ × winnerBonus`. Tie → no exchange. Old rule was `effI × effJ` with both sides stacking — birdieing while losing penalized you, which felt wrong. |
| **Outcome in stakes table** | Each row shows resolved state: **AS** (tied), **`{Winner} +×{stake}`** (resolved), or **×{baseStake}** (pre-resolution preview using base only). |
| **Report tag visibility** | Suffix rows are now stacked (banker → casino → vegas dot) instead of `bankerTag \|\| casinoTag`. Both visible on par-3 when both games are on. `showCasinoRow` flag hoisted outside the loop drives the 3rd row presence + legend + alignment spacers (header / OUT / IN / TOT). 3rd row only allocated when Casino on — non-casino reports stay compact. |

### vw-1.2.22 → vw-1.2.23 — Cumulative + layout polish
| Topic | Decision |
|-------|----------|
| **Cumulative casino points** | New "Cumulative" row in the per-hole Casino section, mirroring Points Game's "Total pts" pattern (fontSize 22, +/- coloured by sign). Old single "Casino" row split into "This hole" + "Cumulative". |
| **Stakes row layout** | Per-pair row restructured to 3-slot flex with `justifyContent: space-between`: **names+bonus tags** (left) \| **winner name** (centre) \| **×stake** (right). Winner is visually separated from stake. Dropped the redundant "+" prefix on the stake. |

**Engine**: `computeCasino` is the single source of truth — totals, hole-section rows, and stakes-table outcomes all flow through it. No drift.

---

## Open / test plan

- [ ] iPhone: Casino cumulative row visibility + sizing across 2–6 players
- [ ] iPhone: stakes table 3-slot layout — readable on narrow screens
- [ ] iPhone: report PDF rendering of stacked banker + casino tags on par-3 + non-par-3
- [ ] Casino-only round vs Casino + V/CT/B together
- [ ] Confirm winner-bonus-only is intuitive in practice: birdie + win = ×2, birdie + lose = ×1 (loser's bonus suppressed)
- [ ] Deploy vw-1.2.23 to teebox69.vercel.app
- [ ] (May 8 carryover) Sankaku curtailed-round modes on real partial tournament
- [ ] (May 8 carryover) TeeBox 1.2.19 in_play toggle on iPhone

**Carry-over data note**: rounds saved under vw-1.2.20/21 stacking rule keep their `casino_cum` as-saved. If the discrepancy matters, manually clear those rounds or re-enter. No migration code added.

---

## Sankaku / Dohyo — unchanged this session
Still vw-0.10.21 / vw-1.2.1. Neither reads `casino_cum` yet; Casino is TeeBox-only for now.

---

## Cross-cutting lessons (cumulative — updated)

1. **Investigate at the source.** Sankaku display bugs may be TeeBox writer bugs.
2. **Sample data masquerades as real data.** Sankaku `SAMPLE_ROUNDS` string IDs — don't add UUID defenses in TeeBox.
3. **Defaults are policy.** Sankaku `TOURNAMENT_FORMAT_DEFAULTS` changes affect existing tournaments without explicit config.
4. **Toggle: non-destructive vs aggressive.** in_play reset-to-par (1.2.19) centralizes consistency in the writer.
5. **Bonus rules: winner-only beats stacking.** A bonus should reward a great shot when it wins, not also amplify the loss when it doesn't. (vw-1.2.22)
6. **Separate player intent from passive state.** Tap state = player choice. Score-derived state (bonus) = game logic, belongs in the calc + outcome display, not the tap target. (vw-1.2.21)
7. **Stack, don't OR.** When two indicators can co-occur in the same slot, stacking is honest; OR-fallback hides info. Hoist the "do I need this slot?" decision outside the loop to avoid per-cell waste. (vw-1.2.22)

---

## Deploy commands

```bash
# Deploy TeeBox vw-1.2.23
cd ~/Desktop/teebox
cp ~/Downloads/teebox.jsx src/teebox.jsx  # if working from Claude artifact
git add src/teebox.jsx CONTEXT_SWS.md SESSION_HANDOFF.md
git commit -m "vw-1.2.23: Casino cumulative row + 3-slot stakes layout; context files"
git push
# Vercel auto-deploys from push
```

No SQL changes for any Casino version. All Casino fields (`casino_mult`, `casino_cum`, `casinoPlayers`, etc.) live in existing `rounds_full` JSONB columns.

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

---

## Deferred in all three apps

**TeeBox:**
- Casino: report scorecard hole tags currently show called only — could add bonus icon to per-cell tag (deferred since bonus changes per outcome, would need finalized scoring)
- Casino: re-score historical rounds saved under stacked-bonus rule — only if user notices
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
- Casino is independent — not mutually exclusive with V/CT/B
- Build: `npm run build` in repo (or `npx esbuild teebox.jsx --bundle=false --loader:.jsx=jsx > /dev/null` for syntax-only)
