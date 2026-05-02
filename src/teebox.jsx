import { useState, useRef, useCallback } from "react";
import React from "react";

// CONSTANTS
const COLORS = ["#4ade80", "#60a5fa", "#f97316", "#e879f9", "#fbbf24", "#22d3ee"];
const COLORS_LIGHT = ["#16a34a", "#2563eb", "#c2410c", "#9333ea", "#b45309", "#0e7490"];
const APP_VERSION = "vw-1.2.2";

// Device ID: persistent random UUID per install. Used to group rounds without auth.
function getDeviceId() {
  try {
    let id = localStorage.getItem("sws_device_id");
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || ("d-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10));
      localStorage.setItem("sws_device_id", id);
    }
    return id;
  } catch(_) { return null; }
}

// Supabase config — anon key, RLS protects table
const SUPA_URL_BASE = "https://yfjnxjigvgwzaoyuucex.supabase.co/rest/v1";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmam54amlndmd3emFveXV1Y2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODcxMDEsImV4cCI6MjA5MjA2MzEwMX0.nA33j2qSxG7uhT8wTFbACYZ1Z8ZGj2nQmFLKvan3NBc";
const SUPA_HDR = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };

// Upsert helper: PATCH first, POST if not exists
function supaUpsert(table, roundId, payload) {
  // Atomic upsert via POST with on_conflict=round_id.
  // PostgREST will INSERT if round_id not found, UPDATE if found.
  // No PATCH-then-POST race condition → no sequence gaps.
  const url = `${SUPA_URL_BASE}/${table}?on_conflict=round_id`;
  return fetch(url, {
    method: "POST",
    headers: {
      ...SUPA_HDR,
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ ...payload, round_id: roundId }),
  }).catch(() => {});
}
const VEGAS_VAL = 1;
const CT_VAL = 3;
const P3_VAL = 5;
const DEFAULT_MATCHUP = [
  { type: "nassau", p1: 0, p2: 1, strokesFront: 0, strokesBack: 0, stake: 5, pressMode: "off", pressMult: 1, units: [1, 1, 2] },
];
// Laguna National Classic Course, Singapore — Blue tees, Par 72
const LAGUNA_CLASSIC_HOLES = [
  {par:4,si:12},{par:4,si:4},{par:5,si:2},{par:3,si:16},
  {par:4,si:8},{par:4,si:10},{par:3,si:18},{par:4,si:14},
  {par:5,si:6},{par:4,si:5},{par:3,si:15},{par:4,si:1},
  {par:5,si:11},{par:5,si:7},{par:4,si:17},{par:4,si:9},
  {par:3,si:13},{par:4,si:3},
];

// Laguna National Masters Course, Singapore — Blue tees, Par 72
const LAGUNA_MASTERS_HOLES = [
  {par:4,si:11},{par:5,si:1},{par:4,si:7},{par:4,si:13},
  {par:3,si:15},{par:4,si:3},{par:5,si:9},{par:3,si:17},
  {par:4,si:5},{par:4,si:8},{par:5,si:4},{par:3,si:18},
  {par:4,si:14},{par:4,si:10},{par:5,si:2},{par:4,si:6},
  {par:3,si:16},{par:4,si:12},
];

// Horizon Hills Golf & Country Club, Malaysia — Blue tees, Par 72
const HORIZON_HILLS_HOLES = [
  {par:4,si:11},{par:5,si:1},{par:3,si:15},{par:4,si:17},
  {par:4,si:13},{par:5,si:5},{par:4,si:3},{par:3,si:9},
  {par:4,si:7},{par:4,si:10},{par:4,si:6},{par:3,si:14},
  {par:5,si:16},{par:4,si:2},{par:4,si:8},{par:4,si:18},
  {par:3,si:12},{par:5,si:4},
];

// NSRCC Changi Golf Course, Singapore — Blue tees, Par 72
const NSRCC_CHANGI_HOLES = [
  {par:4,si:1},{par:5,si:13},{par:5,si:9},{par:4,si:3},
  {par:4,si:11},{par:3,si:15},{par:4,si:7},{par:4,si:5},
  {par:3,si:17},{par:4,si:18},{par:4,si:2},{par:3,si:16},
  {par:4,si:6},{par:5,si:12},{par:3,si:8},{par:4,si:14},
  {par:4,si:10},{par:5,si:4},
];

// Sembawang Country Club — Front 9 x2, Composite 18, Blue tees
// Front 9: odd SI per official scorecard
// Back 9:  same pars, interleaved even SI in same difficulty order
const SEMBAWANG_BACK9_HOLES = [
  // Front 9 (holes 1-9) — odd SI
  {par:4,si:11},{par:5,si:1},{par:5,si:3},{par:4,si:13},
  {par:4,si:5},{par:4,si:9},{par:3,si:17},{par:4,si:7},
  {par:3,si:15},
  // Back 9 (holes 10-18) — even SI (same difficulty order)
  {par:4,si:12},{par:5,si:2},{par:5,si:4},{par:4,si:14},
  {par:4,si:6},{par:4,si:10},{par:3,si:18},{par:4,si:8},
  {par:3,si:16},
];
const DEFAULT_HOLES = LAGUNA_CLASSIC_HOLES;
// Palm Springs Golf Country Club, Malaysia — Blue tees, Par 72
// 3 nine-hole courses: Island, Resort, Palm
const PALM_SPRINGS_ISLAND_RESORT = [
  {par:5,si:12},{par:3,si:18},{par:4,si:4},{par:4,si:8},
  {par:4,si:10},{par:4,si:2},{par:3,si:16},{par:5,si:6},
  {par:4,si:14},{par:5,si:7},{par:3,si:17},{par:4,si:3},
  {par:5,si:5},{par:4,si:1},{par:3,si:15},{par:4,si:11},
  {par:3,si:13},{par:5,si:9},
];
const PALM_SPRINGS_RESORT_PALM = [
  {par:5,si:8},{par:3,si:18},{par:4,si:4},{par:5,si:6},
  {par:4,si:2},{par:3,si:16},{par:4,si:12},{par:3,si:14},
  {par:5,si:10},{par:5,si:3},{par:4,si:7},{par:5,si:1},
  {par:3,si:17},{par:4,si:5},{par:4,si:11},{par:3,si:13},
  {par:4,si:15},{par:4,si:9},
];
const PALM_SPRINGS_PALM_ISLAND = [
  {par:5,si:3},{par:4,si:7},{par:5,si:1},{par:3,si:17},
  {par:4,si:5},{par:4,si:11},{par:3,si:13},{par:4,si:15},
  {par:4,si:9},{par:5,si:12},{par:3,si:18},{par:4,si:4},
  {par:4,si:8},{par:4,si:10},{par:4,si:2},{par:3,si:16},
  {par:5,si:6},{par:4,si:14},
];

// Batam Hills Golf Resort, Indonesia — Blue tees, Par 72
const BATAM_HILLS_HOLES = [
  {par:4,si:3},{par:3,si:11},{par:4,si:13},{par:3,si:17},
  {par:5,si:1},{par:4,si:5},{par:5,si:9},{par:4,si:15},
  {par:4,si:7},{par:4,si:14},{par:5,si:4},{par:3,si:12},
  {par:4,si:10},{par:4,si:16},{par:4,si:2},{par:5,si:6},
  {par:3,si:18},{par:4,si:8},
];

// Seletar Country Club, Singapore — Blue tees, Par 72
const SELETAR_HOLES = [
  {par:4,si:7},{par:3,si:17},{par:4,si:1},{par:4,si:9},
  {par:5,si:11},{par:3,si:13},{par:5,si:3},{par:4,si:15},
  {par:4,si:5},{par:5,si:10},{par:3,si:16},{par:4,si:4},
  {par:3,si:18},{par:4,si:8},{par:5,si:2},{par:4,si:12},
  {par:4,si:14},{par:4,si:6},
];

// IOI Palm Villa Golf & Country Club, Malaysia — Blue tees, Par 72
// IOI Course (holes 1-9) + Palm Course (holes 10-18), hole 18 is par 6
const IOI_PALM_VILLA_HOLES = [
  {par:5,si:11},{par:4,si:7},{par:3,si:17},{par:4,si:5},
  {par:4,si:1},{par:4,si:3},{par:3,si:15},{par:4,si:9},
  {par:5,si:13},{par:4,si:4},{par:5,si:2},{par:3,si:12},
  {par:4,si:8},{par:4,si:18},{par:3,si:14},{par:4,si:6},
  {par:3,si:16},{par:6,si:10},
];

// Ponderosa Golf & Country Club, Johor, Malaysia — Blue tees, Par 72
const PONDEROSA_HOLES = [
  {par:4,si:11},{par:3,si:15},{par:4,si:17},{par:4,si:3},
  {par:4,si:5},{par:5,si:13},{par:3,si:7},{par:4,si:9},
  {par:5,si:1},{par:4,si:16},{par:5,si:10},{par:3,si:12},
  {par:4,si:4},{par:4,si:6},{par:4,si:14},{par:4,si:2},
  {par:3,si:18},{par:5,si:8},
];

// Sukajadi Golf & Country Club, Batam, Indonesia — Par 72
const SUKAJADI_HOLES = [
  {par:4,si:14},{par:4,si:2},{par:5,si:6},{par:3,si:16},
  {par:4,si:8},{par:4,si:4},{par:4,si:12},{par:5,si:10},
  {par:3,si:18},{par:3,si:15},{par:4,si:13},{par:4,si:5},
  {par:4,si:9},{par:3,si:17},{par:5,si:3},{par:4,si:11},
  {par:4,si:1},{par:5,si:7},
];

// Warren Country Club, Singapore — Par 71
const WARREN_HOLES = [
  {par:4,si:5},{par:5,si:7},{par:4,si:1},{par:3,si:11},
  {par:4,si:15},{par:4,si:17},{par:3,si:9},{par:5,si:13},
  {par:4,si:3},{par:4,si:16},{par:3,si:14},{par:4,si:8},
  {par:5,si:2},{par:3,si:12},{par:5,si:6},{par:3,si:18},
  {par:4,si:10},{par:4,si:4},
];

const PRESET_COURSES = [
  { id: "laguna-classic", name: "Laguna National", tee: "Classic (Blue)", holes: LAGUNA_CLASSIC_HOLES },
  { id: "laguna-masters", name: "Laguna National", tee: "Masters (Blue)", holes: LAGUNA_MASTERS_HOLES },
  { id: "horizon-hills", name: "Horizon Hills", tee: "Blue", holes: HORIZON_HILLS_HOLES },
  { id: "nsrcc-changi", name: "NSRCC Changi", tee: "Blue", holes: NSRCC_CHANGI_HOLES },
  { id: "sembawang-back9", name: "Sembawang CC", tee: "Composite 18 (Blue)", holes: SEMBAWANG_BACK9_HOLES },
  { id: "ioi-palm-villa", name: "IOI Palm Villa", tee: "Blue", holes: IOI_PALM_VILLA_HOLES },
  { id: "seletar", name: "Seletar CC", tee: "Blue", holes: SELETAR_HOLES },
  { id: "batam-hills", name: "Batam Hills", tee: "Blue", holes: BATAM_HILLS_HOLES },
  { id: "palm-springs-ir", name: "Palm Springs", tee: "Island+Resort (Blue)", holes: PALM_SPRINGS_ISLAND_RESORT },
  { id: "palm-springs-rp", name: "Palm Springs", tee: "Resort+Palm (Blue)", holes: PALM_SPRINGS_RESORT_PALM },
  { id: "palm-springs-pi", name: "Palm Springs", tee: "Palm+Island (Blue)", holes: PALM_SPRINGS_PALM_ISLAND },
  { id: "sukajadi", name: "Sukajadi", tee: "Batam", holes: SUKAJADI_HOLES },
  { id: "ponderosa", name: "Ponderosa G&CC", tee: "Blue", holes: PONDEROSA_HOLES },
  { id: "warren", name: "Warren CC", tee: "Blue", holes: WARREN_HOLES },
];

// PURE COMPUTATION
function strokesGiven(hcp, si) {
  if (hcp <= 0) return 0;
  let s = 0;
  if (si <= hcp) s += 1;
  if (si <= hcp - 18) s += 1;
  return s;
}
function nettScore(gross, hcp, si, par) {
  // Returns RAW nett (gross - strokes received). NO CAP applied.
  // Vegas applies its own cap (configurable via capPar3/capOther) before forming Vegas number.
  // Match-play games (CT, Banker, Sixes, Pts, Nassau, GDB, MatchPlay) use raw nett — comparison-only,
  // so a real blow-up shows truth and doesn't create artificial ties.
  const g = parseInt(gross, 10);
  if (isNaN(g) || g <= 0) return null;
  return g - strokesGiven(hcp, si);
}
function vegasNum(n1, n2) {
  if (n1 === null || n2 === null) return null;
  const lo = Math.min(Math.min(n1, 9), Math.min(n2, 9));
  const hi = Math.max(Math.min(n1, 9), Math.min(n2, 9));
  return lo * 10 + hi;
}
function flipNum(n) {
  const lo = Math.floor(n / 10);
  const hi = n % 10;
  return hi * 10 + lo;
}
function teamTrigger(g1, g2, par) {
  function valid(g) { const n = parseInt(g, 10); return !isNaN(n) && n > 0; }
  function isEagle(g) { return valid(g) && parseInt(g, 10) <= par - 2; }
  function isBirdie(g) { return valid(g) && parseInt(g, 10) === par - 1; }
  function isPar(g) { return valid(g) && parseInt(g, 10) === par; }
  const eagle = isEagle(g1) || isEagle(g2);
  const birdies = [g1, g2].filter(isBirdie).length;
  const pars = [g1, g2].filter(isPar).length;
  const parOrBetter = (g) => valid(g) && parseInt(g, 10) <= par;
  // Eagle: flip + x2 always; +20 bonus only if partner also makes par or better
  if (eagle) {
    const partnerParOrBetter = isEagle(g1) ? parOrBetter(g2) : parOrBetter(g1);
    return { flip: true, mult: 2, bonus: partnerParOrBetter ? 20 : 0 };
  }
  if (birdies >= 2) return { flip: true, mult: 2, bonus: 20 };
  if (birdies === 1 && pars >= 1) return { flip: true, mult: 1, bonus: 20 };
  if (birdies === 1) return { flip: true, mult: 1, bonus: 0 };
  if (pars >= 2) return { flip: false, mult: 1, bonus: 10 };
  return { flip: false, mult: 1, bonus: 0 };
}
// Vegas rule sets:
// "classic" — nett first, winner flips loser nett number
// "council" — flip gross first, cancel if both, then nett, winner mult+bonus (DEFAULT)
// "double"  — flip gross first, no cancellation, then nett, winner mult+bonus
// Tie-break (all rules): lower gross Vegas number wins the bonus; if gross also tied, no points
function computeVegas(teams, gross, nett, par, rules) {
  if (rules === undefined) rules = "council";
  const [t0, t1] = teams;
  const trigA = teamTrigger(gross[t0[0]], gross[t0[1]], par);
  const trigB = teamTrigger(gross[t1[0]], gross[t1[1]], par);
  const gvA = vegasNum(parseInt(gross[t0[0]],10), parseInt(gross[t0[1]],10));
  const gvB = vegasNum(parseInt(gross[t1[0]],10), parseInt(gross[t1[1]],10));

  // Shared tie-break: lower gross Vegas wins bonus; gross tie = no points
  const tieBreak = (vA, vB, effA, effB, flipA, flipB, mult) => {
    const bonus = (trigA.bonus > 0 || trigB.bonus > 0) && gvA !== gvB
      ? (gvA < gvB ? trigA.bonus || trigB.bonus : trigA.bonus || trigB.bonus) : 0;
    const grossWinnerIsA = gvA < gvB;
    const netA = bonus > 0 ? (grossWinnerIsA ? bonus : -bonus) : 0;
    const netB = -netA;
    return { vA, vB, effA, effB, flipA, flipB, mult,
      tied: true, grossWinnerIsA: bonus > 0 ? grossWinnerIsA : null,
      bonusA: bonus > 0 && grossWinnerIsA ? bonus : 0,
      bonusB: bonus > 0 && !grossWinnerIsA ? bonus : 0, netA, netB };
  };

  if (rules === "classic") {
    const vA = vegasNum(nett[t0[0]], nett[t0[1]]);
    const vB = vegasNum(nett[t1[0]], nett[t1[1]]);
    if (vA === null || vB === null) return null;
    if (vA === vB) return tieBreak(vA, vB, vA, vB, false, false, 1);
    const winnerIsA = vA < vB;
    const trig = winnerIsA ? trigA : trigB;
    const effA = (!winnerIsA && trig.flip) ? flipNum(vA) : vA;
    const effB = ( winnerIsA && trig.flip) ? flipNum(vB) : vB;
    const diff = Math.abs(effA - effB) * trig.mult;
    const netA = (winnerIsA ? diff : -diff) + (winnerIsA ? trig.bonus : -trig.bonus);
    const netB = -netA;
    return { vA, vB, effA, effB,
      flipA: !winnerIsA && trig.flip, flipB: winnerIsA && trig.flip, mult: trig.mult,
      bonusA: winnerIsA ? trig.bonus : 0, bonusB: winnerIsA ? 0 : trig.bonus, netA, netB };
  }

  // council / double: flip gross first
  const bothFlip = trigA.flip && trigB.flip;
  const flipA = rules === "double" ? trigA.flip : (trigA.flip && !bothFlip);
  const flipB = rules === "double" ? trigB.flip : (trigB.flip && !bothFlip);

  const nA_raw = vegasNum(nett[t0[0]], nett[t0[1]]);
  const nB_raw = vegasNum(nett[t1[0]], nett[t1[1]]);
  if (nA_raw === null || nB_raw === null) return null;

  const vA = flipB ? flipNum(nA_raw) : nA_raw;
  const vB = flipA ? flipNum(nB_raw) : nB_raw;

  if (vA === vB) return { ...tieBreak(nA_raw, nB_raw, vA, vB, flipB, flipA, 1), trigA, trigB };

  const winnerIsA = vA < vB;
  const winTrig = winnerIsA ? trigA : trigB;
  const mult = winTrig.flip ? winTrig.mult : 1;
  // Double Flip: winner's number reverts to original for diff calculation — only loser is flipped
  const effForDiff_A = (rules === "double" && winnerIsA) ? nA_raw : vA;
  const effForDiff_B = (rules === "double" && !winnerIsA) ? nB_raw : vB;
  const diff = Math.abs(effForDiff_A - effForDiff_B) * mult;
  const bonus = winTrig.bonus;
  const netA = (winnerIsA ? diff : -diff) + (winnerIsA ? bonus : -bonus);
  const netB = -netA;
  return { vA: nA_raw, vB: nB_raw, effA: vA, effB: vB,
    effForDiffA: effForDiff_A, effForDiffB: effForDiff_B,
    flipA: flipB, flipB: flipA, mult, trigA, trigB,
    bonusA: winnerIsA ? bonus : 0, bonusB: winnerIsA ? 0 : bonus, netA, netB };
}
function computeCutThroat(nett) {
  const N = nett.length;
  if (nett.some(n => n === null)) return Array(N).fill(0);
  const d = Array(N).fill(0);
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      if (nett[i] < nett[j]) { d[i]++; d[j]--; }
      else if (nett[j] < nett[i]) { d[j]++; d[i]--; }
    }
  return d;
}
// 6-point game — 3 players only, distributes 6 points per hole based on nett rank

// Points Game — 3-ball: 4-2-0, 4+ ball: N-1 down to 0, ties split (rounds to 0.5)
function computePointsGame(nett) {
  const N = nett.length;
  if (nett.some(n => n === null)) return Array(N).fill(0);
  const sorted = [...nett].sort((a, b) => a - b);
  const basePts = N === 3
    ? [4, 2, 0]
    : Array.from({length: N}, (_, i) => N - 1 - i);
  return nett.map(score => {
    const positions = [];
    sorted.forEach((s, i) => { if (s === score) positions.push(i); });
    const avg = positions.reduce((sum, i) => sum + basePts[i], 0) / positions.length;
    return Math.round(avg * 2) / 2;
  });
}

// Sixes — compare top 1 or top 2 nett from each team
// team1/team2: arrays of player indices
// nett: full array of nett scores (one per player)
// mode: "top1" (best only) or "top2" (best + 2nd)
// Returns { t1pts, t2pts } — max 1 (top1) or 2 (top2) per hole. Ties award 0.
function computeSixes(nett, team1, team2, mode) {
  const t1scores = team1.map(i => nett[i]).filter(n => n !== null).sort((a,b) => a - b);
  const t2scores = team2.map(i => nett[i]).filter(n => n !== null).sort((a,b) => a - b);
  if (t1scores.length === 0 || t2scores.length === 0) return { t1pts: 0, t2pts: 0 };
  let t1pts = 0, t2pts = 0;
  // Best vs best
  if (t1scores[0] < t2scores[0]) t1pts += 1;
  else if (t2scores[0] < t1scores[0]) t2pts += 1;
  // 2nd vs 2nd (top2 mode only, and only if both teams have a 2nd score)
  if (mode === "top2" && t1scores.length >= 2 && t2scores.length >= 2) {
    if (t1scores[1] < t2scores[1]) t1pts += 1;
    else if (t2scores[1] < t1scores[1]) t2pts += 1;
  }
  return { t1pts, t2pts };
}

// Randomise sixes teams — 4/5-ball (round-robin among 4) or 6-ball (no pair in all 3 segs)
function randomiseSixesTeams(N) {
  if (N === 4) {
    // True round-robin: 3 segments where every player partners every other exactly once
    const players = [0,1,2,3].sort(() => Math.random() - 0.5);
    const [a, b, c, d] = players;
    return [[[a,b],[c,d]], [[a,c],[b,d]], [[a,d],[b,c]]];
  }
  if (N === 5) {
    // 5-ball: shadow=P5 (highest HCP, set outside), 4 non-shadow players rotate 4-ball style
    // Randomise the 4 non-shadow player slots
    const players = [0,1,2,3].sort(() => Math.random() - 0.5);
    const [a, b, c, d] = players;
    return [[[a,b],[c,d]], [[a,c],[b,d]], [[a,d],[b,c]]];
  }
  if (N === 6) {
    // 6-ball: 3 segments of 3v3 with no pair together in all 3 segments
    const players = [0,1,2,3,4,5].sort(() => Math.random() - 0.5);
    const [a, b, c, d, e, f] = players;
    return [[[a,b,c],[d,e,f]], [[a,d,e],[b,c,f]], [[a,b,f],[c,d,e]]];
  }
  return null;
}

function computePar3(nett, banker, mults) {
  const N = nett.length;
  const d = Array(N).fill(0);
  const bMult = Number(mults[banker]) || 1;
  for (let i = 0; i < N; i++) {
    if (i === banker) continue;
    if (nett[i] === null || nett[banker] === null) continue;
    const pMult = Number(mults[i]) || 1;
    const matchupMult = bMult * pMult;
    if (nett[i] < nett[banker]) { d[i] += matchupMult; d[banker] -= matchupMult; }
    else if (nett[banker] < nett[i]) { d[banker] += matchupMult; d[i] -= matchupMult; }
  }
  return d;
}

// NASSAU COMPUTATION
function nassauStrokeSIs(strokes, siList) {
  if (strokes === 0) return { p1: new Set(), p2: new Set() };
  const n = Math.abs(strokes);
  const sorted = [...siList].sort((a, b) => a - b);
  const set = new Set(sorted.slice(0, n));
  return strokes > 0
    ? { p1: new Set(), p2: set }
    : { p1: set, p2: new Set() };
}

// Build front/back stroke SI sets for a matchup given the full holes array
function buildNassauStrokeMaps(matchup, holes) {
  const frontSIs = holes.slice(0, 9).map(h => h.si);
  const backSIs  = holes.slice(9, 18).map(h => h.si);
  return {
    front: nassauStrokeSIs(matchup.strokesFront, frontSIs),
    back:  nassauStrokeSIs(matchup.strokesBack,  backSIs),
  };
}

// Returns { p1: 0|1, p2: 0|1 } strokes for a specific hole
function strokesForHole(hi, si, strokeMaps) {
  const map = hi < 9 ? strokeMaps.front : strokeMaps.back;
  return {
    p1: map.p1.has(si) ? 1 : 0,
    p2: map.p2.has(si) ? 1 : 0,
  };
}

function computeNassau(matchup, gross, holes, inPlay) {
  const { p1, p2 } = matchup;
  const strokeMaps = buildNassauStrokeMaps(matchup, holes);
  const holeWL = Array(18).fill(0);
  for (let hi = 0; hi < 18; hi++) {
    if (!inPlay[hi]) continue;
    const g1 = parseInt(gross[hi][p1], 10);
    const g2 = parseInt(gross[hi][p2], 10);
    if (isNaN(g1) || isNaN(g2) || g1 <= 0 || g2 <= 0) continue;
    const { si } = holes[hi];
    const strk = strokesForHole(hi, si, strokeMaps);
    // No cap — match play comparison uses raw nett; cap only matters for Vegas number formation.
    const n1 = g1 - strk.p1;
    const n2 = g2 - strk.p2;
    if (n1 < n2) holeWL[hi] = 1;
    else if (n2 < n1) holeWL[hi] = -1;
  }
  function segmentStatus(startHi, endHi) {
    let status = 0, holesPlayed = 0;
    for (let hi = startHi; hi <= endHi; hi++) {
      if (!inPlay[hi]) continue;
      const g1 = parseInt(gross[hi][p1], 10);
      const g2 = parseInt(gross[hi][p2], 10);
      if (isNaN(g1) || isNaN(g2) || g1 <= 0 || g2 <= 0) continue;
      status += holeWL[hi];
      holesPlayed++;
    }
    return { status, holesPlayed };
  }
  const front = segmentStatus(0, 8);
  const back = segmentStatus(9, 17);
  const overall = segmentStatus(0, 17);
  const presses = [];
  if (matchup.pressMode !== "off") {
    const { units = [1, 1, 2] } = matchup;
    const perNine = units[0] > 0 || units[1] > 0;
    const segments = perNine ? [[0, 8], [9, 17]] : [[0, 17]];
    for (const [startHi, endHi] of segments) {
      let pressStart = null, pressStatus = 0, runningStatus = 0;
      const segLen = endHi - startHi + 1;
      let holesPlayedInSeg = 0;
      for (let hi = startHi; hi <= endHi; hi++) {
        if (!inPlay[hi]) continue;
        const g1 = parseInt(gross[hi][p1], 10);
        const g2 = parseInt(gross[hi][p2], 10);
        if (isNaN(g1) || isNaN(g2) || g1 <= 0 || g2 <= 0) continue;
        holesPlayedInSeg++;
        runningStatus += holeWL[hi];
        const holesRemaining = segLen - holesPlayedInSeg;
        const isDormie = holesRemaining > 0 && Math.abs(runningStatus) === holesRemaining;
        if (pressStart === null) {
          if (matchup.pressMode === "auto" && Math.abs(runningStatus) >= 2) {
            pressStart = hi + 1;
            pressStatus = 0;
          } else if (matchup.pressMode === "dormie" && isDormie) {
            pressStart = hi + 1;
            pressStatus = 0;
          }
        } else {
          pressStatus += holeWL[hi];
        }
      }
      if (pressStart !== null) presses.push({ startHole: pressStart + 1, status: pressStatus });
    }
  }
  return { front, back, overall, presses, holeWL, strokeMaps };
}

function nassauDollars(matchup, front, back, overall, presses) {
  const { stake, units = [1, 1, 2], pressMult = 1 } = matchup;
  if (matchup.type === "matchplay") {
    // Match Play: settle F/B/Overall by net holes won × stake × unit. AS = $0 per segment.
    const u = units || [0, 0, 1];
    const frontDollars   = front.status   === 0 || u[0] === 0 ? 0 : front.status   * stake * u[0];
    const backDollars    = back.status    === 0 || u[1] === 0 ? 0 : back.status    * stake * u[1];
    const overallDollars = overall.status === 0 || u[2] === 0 ? 0 : overall.status * stake * u[2];
    const net = frontDollars + backDollars + overallDollars;
    return { frontDollars, backDollars, overallDollars, pressDollars: 0, net };
  }
  const frontDollars   = front.status   === 0 || units[0] === 0 ? 0 : front.status   > 0 ?  stake * units[0] : -stake * units[0];
  const backDollars    = back.status    === 0 || units[1] === 0 ? 0 : back.status    > 0 ?  stake * units[1] : -stake * units[1];
  const overallDollars = overall.status === 0 || units[2] === 0 ? 0 : overall.status > 0 ?  stake * units[2] : -stake * units[2];
  const pressDollars   = presses.reduce((sum, p) => sum + (p.status === 0 ? 0 : p.status > 0 ? stake * pressMult : -stake * pressMult), 0);
  const net = frontDollars + backDollars + overallDollars + pressDollars;
  return { frontDollars, backDollars, overallDollars, pressDollars, net };
}

// GDB COMPUTATION — Game/Dormie/Bye per 9 holes
// Compute GDB for one 9-hole segment (startHi = 0 for front, 9 for back)
function computeGDB9(matchup, gross, holes, inPlay, startHi) {
  const { p1, p2 } = matchup;
  const strokeMaps = buildNassauStrokeMaps(matchup, holes);
  const endHi = startHi + 8;
  // Per-hole W/L for this 9
  const holeWL = [];
  for (let hi = startHi; hi <= endHi; hi++) {
    if (!inPlay[hi]) { holeWL.push(0); continue; }
    const g1 = parseInt(gross[hi][p1], 10);
    const g2 = parseInt(gross[hi][p2], 10);
    if (isNaN(g1) || isNaN(g2) || g1 <= 0 || g2 <= 0) { holeWL.push(0); continue; }
    const { si } = holes[hi];
    const strk = strokesForHole(hi, si, strokeMaps);
    // No cap — match play comparison uses raw nett.
    const n1 = g1 - strk.p1;
    const n2 = g2 - strk.p2;
    holeWL.push(n1 < n2 ? 1 : n2 < n1 ? -1 : 0);
  }
  // Count played holes
  const playedIdx = []; // relative indices (0-8) of played holes
  for (let i = 0; i < 9; i++) {
    if (inPlay[startHi + i]) {
      const g1 = parseInt(gross[startHi + i][p1], 10);
      const g2 = parseInt(gross[startHi + i][p2], 10);
      if (!isNaN(g1) && !isNaN(g2) && g1 > 0 && g2 > 0) playedIdx.push(i);
    }
  }
  const holesPlayed = playedIdx.length;
  // Game: running cumulative status through 9
  let gameStatus = 0;
  const gameByHole = []; // cumulative status after each played hole
  for (let i = 0; i < holesPlayed; i++) {
    gameStatus += holeWL[playedIdx[i]];
    gameByHole.push(gameStatus);
  }
  // Detect Dormie: status = remaining holes in the 9 (can't lose)
  // e.g. 4 UP with 4 holes left = dormie
  let dormieStartIdx = null;
  for (let i = 0; i < holesPlayed; i++) {
    const remaining = 9 - (i + 1); // holes left in 9 after the (i+1)th played hole
    const status = gameByHole[i];
    if (Math.abs(status) === remaining && remaining > 0) {
      dormieStartIdx = i + 1;
      break;
    }
  }
  // Detect Buy: game decided early (lead > holes remaining = can't be caught)
  let buyStartIdx = null;
  for (let i = 0; i < holesPlayed; i++) {
    const remaining = 9 - (i + 1);
    const status = Math.abs(gameByHole[i]);
    if (status > remaining) {
      buyStartIdx = i + 1;
      break;
    }
  }
  // Game result (full 9)
  const game = { status: gameStatus, holesPlayed };
  // Dormie bet result (holes after dormie triggered)
  let dormie = null;
  if (dormieStartIdx !== null && dormieStartIdx < holesPlayed) {
    let ds = 0;
    for (let i = dormieStartIdx; i < holesPlayed; i++) ds += holeWL[playedIdx[i]];
    dormie = {
      status: ds,
      holesPlayed: holesPlayed - dormieStartIdx,
      startHole: startHi + playedIdx[dormieStartIdx] + 1, // 1-based hole number
    };
  }
  // Buy bet result (holes after game decided)
  let buy = null;
  if (buyStartIdx !== null && buyStartIdx < holesPlayed) {
    let bs = 0;
    for (let i = buyStartIdx; i < holesPlayed; i++) bs += holeWL[playedIdx[i]];
    buy = {
      status: bs,
      holesPlayed: holesPlayed - buyStartIdx,
      startHole: startHi + playedIdx[buyStartIdx] + 1,
    };
  }
  return { game, dormie, buy, holeWL, holesPlayed, gameByHole, playedIdx, startHi };
}

function computeGDB(matchup, gross, holes, inPlay) {
  const front = computeGDB9(matchup, gross, holes, inPlay, 0);
  const back   = computeGDB9(matchup, gross, holes, inPlay, 9);
  const strokeMaps = buildNassauStrokeMaps(matchup, holes);
  const holeWL = Array(18).fill(0);
  if (front?.holeWL) front.holeWL.forEach((v,i) => { holeWL[i] = v; });
  if (back?.holeWL)  back.holeWL.forEach((v,i)  => { holeWL[9+i] = v; });
  return { front, back, strokeMaps, holeWL };
}

function gdbDollars(matchup, front, back) {
  const { stake } = matchup;
  const settle9 = (seg) => {
    if (!seg) return 0;
    const gameDollars   = seg.game.status   === 0 ? 0 : seg.game.status   > 0 ? stake * 3 : -stake * 3;
    const dormieDollars = !seg.dormie || seg.dormie.status === 0 ? 0 : seg.dormie.status > 0 ? stake : -stake;
    const buyDollars    = !seg.buy    || seg.buy.status    === 0 ? 0 : seg.buy.status    > 0 ? stake : -stake;
    return { gameDollars, dormieDollars, buyDollars, net: gameDollars + dormieDollars + buyDollars };
  };
  const f = settle9(front);
  const b = settle9(back);
  return {
    front: f, back: b,
    net: f.net + b.net,
  };
}

// STROKE PLAY COMPUTATION — net stroke difference, settled F/B/Overall like Nassau
// Strokes are negotiated (strokesFront / strokesBack), same as Nassau / Match Play / GDB.
// Each segment (Front 9, Back 9, Overall 18) computes: diff = sum(p2 capped nett) - sum(p1 capped nett).
// Per-hole cap matches the rest of the app: par+3 for par 3s, par+4 for par 4/5s.
function computeStrokePlay(matchup, gross, holes, inPlay) {
  const { p1, p2 } = matchup;
  const strokeMaps = buildNassauStrokeMaps(matchup, holes);
  // Per-hole rows for scorecard + hole view
  const holeRows = [];
  // Segment accumulators
  const seg = (label, startHi, endHi) => ({ label, startHi, endHi, p1Total: 0, p2Total: 0, holesPlayed: 0 });
  const front   = seg("front", 0, 8);
  const back    = seg("back",  9, 17);
  const overall = seg("overall", 0, 17);
  for (let hi = 0; hi < 18; hi++) {
    if (!inPlay[hi]) { holeRows.push(null); continue; }
    const g1 = parseInt(gross[hi][p1], 10);
    const g2 = parseInt(gross[hi][p2], 10);
    if (isNaN(g1) || g1 <= 0 || isNaN(g2) || g2 <= 0) { holeRows.push(null); continue; }
    const par = holes[hi].par;
    const cap = par === 3 ? par + 3 : par + 4;
    const strk = strokesForHole(hi, holes[hi].si, strokeMaps);
    const n1 = Math.min(g1 - strk.p1, cap);
    const n2 = Math.min(g2 - strk.p2, cap);
    holeRows.push({
      n1, n2, s1: strk.p1, s2: strk.p2,
      capped1: (g1 - strk.p1) > cap,
      capped2: (g2 - strk.p2) > cap,
    });
    overall.p1Total += n1; overall.p2Total += n2; overall.holesPlayed += 1;
    if (hi < 9) { front.p1Total += n1; front.p2Total += n2; front.holesPlayed += 1; }
    else        { back.p1Total  += n1; back.p2Total  += n2; back.holesPlayed  += 1; }
  }
  // diff > 0 => p1 has lower nett total => p1 wins. status mirrors Nassau convention.
  const finalize = (s) => ({
    ...s,
    diff: s.p2Total - s.p1Total,
    status: s.holesPlayed === 0 ? 0 : (s.p2Total - s.p1Total),
  });
  return {
    front: finalize(front),
    back: finalize(back),
    overall: finalize(overall),
    holeRows,
    strokeMaps,
  };
}

function strokePlayDollars(matchup, front, back, overall) {
  const { stake, units = [1, 1, 2] } = matchup;
  // diff × unit × stake. AS (diff = 0) settles to $0.
  const frontDollars   = front.diff   === 0 || units[0] === 0 ? 0 : front.diff   * stake * units[0];
  const backDollars    = back.diff    === 0 || units[1] === 0 ? 0 : back.diff    * stake * units[1];
  const overallDollars = overall.diff === 0 || units[2] === 0 ? 0 : overall.diff * stake * units[2];
  const net = frontDollars + backDollars + overallDollars;
  return { frontDollars, backDollars, overallDollars, pressDollars: 0, net };
}

// HELPERS
function buildQRPayload({ names, hcps, holes, scores, inPlay, games, stakes, vTeams, dollars, nassauMatchups: matchups, nassauResults, nassauEnabled: matchupEnabled, courseName, firstNine }) {
  const ipMask = inPlay.reduce((acc, v, i) => acc + (v ? (1 << i) : 0), 0);
  const ho = holes.flatMap(h => [h.par, h.si]);
  const sc = scores.map(row => row.map(g => parseInt(g,10)||0));
  const sf = sc.flat();
  const vtDev = vTeams.map(t =>
    (t[0][0]===0&&t[0][1]===1&&t[1][0]===2&&t[1][1]===3) ? null : [t[0],t[1]]
  );
  const vt = vtDev.every(v=>v===null) ? [] : vtDev;
  const matchup = matchupEnabled ? (matchups||[]).map((m,mi) => {
    const r = (nassauResults||[])?.[mi];
    return { p1:m.p1, p2:m.p2, net:r?.dollars?.net??0 };
  }) : [];
  const payload = {
    v: "1",
    c: (courseName||"Custom").replace(/[^\x20-\x7E]/g, '-').slice(0,30),
    d: new Date().toISOString().slice(0,10).replace(/-/g,""),
    p: names.map(n=>n.replace(/[^\x20-\x7E]/g, '-').slice(0,8)),
    h: hcps,
    ho, sf,
    ip: ipMask,
    vt,
    g: { v:games.vegas?1:0, ct:games.ct?1:0, p3:games.p3?1:0, n:matchupEnabled?1:0 },
    st: { v:stakes.vegasVal||1, ct:stakes.ctVal||3, p3:stakes.p3Val||5 },
    dl: dollars,
    fn: firstNine || "F",
    matchup,
  };
  return JSON.stringify(payload);
}

function makeFilename(names) {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replace(/-/g,"");
  const players = (names||[]).map(n => n.replace(/[^a-zA-Z0-9]/g,"").slice(0,3).toUpperCase()).join(" ");
  return `sws.${date}.${players}.json`;
}

async function exportRound(roundData) {
  const json = JSON.stringify(roundData, null, 2);
  const filename = makeFilename(roundData.config?.names || roundData.config?._savedState?.liveNames);
  const blob = new Blob([json], { type: "application/json" });
  const file = new File([blob], filename, { type: "application/json" });
  // Try Web Share API with files (iOS 15+, Android Chrome)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  // Fallback: direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function haptic(style = "light") {
  try {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(style === "light" ? 10 : 20);
    }
    // iOS Taptic Engine via AudioContext workaround is not reliable
    // Best effort via vibration API
  } catch(_) {}
}

async function generateReport({ names, holes, liveHcps, inPlay, results, dollars, dollarsSubtotal, vegasCum, ctCum, p3Cum, ptsCum, vegasVal, ctVal, p3Val, ptsVal, adjustments, games, matchupEnabled, nassauResults, matchups, sixesEnabled, sixesData, sixesConfig, sixesPlayerDollars, sixesPlayerTokens, courseName, roundStartTime, qrPayload, playerCount, vegasPlayers, vTeams, banker, p3mult, hioRule, ghostEnabled, hzEnabled, hzHero }) {
  const isSolo = playerCount === 1;
  const RP = names.map((_,i) => i);
  // Generate QR data URL if qrcode-generator library is loaded
  let qrDataUrl = null;
  if (qrPayload && window.qrcode) {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(qrPayload);
      qr.make();
      const cellSize = 3;
      const margin = 2;
      const count = qr.getModuleCount();
      const imgSize = count * cellSize + margin * 2 * cellSize;
      const canvas = document.createElement('canvas');
      canvas.width = imgSize; canvas.height = imgSize;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, imgSize, imgSize);
      ctx.fillStyle = '#000000';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
          }
        }
      }
      qrDataUrl = canvas.toDataURL('image/png');
    } catch(e) { /* silent */ }
  }
  // Relative HCPs
  const minHcp = Math.min(...liveHcps);
  const relHcps = liveHcps.map(h => h - minHcp);
  // Next round HCP adjustment — based on Vegas/CT/Banker subtotal only
  const hcpBase = dollarsSubtotal || dollars;
  const strokeAdj = RP.map(i => {
    const strokes = Math.floor(Math.abs(hcpBase[i]) / 25);
    return hcpBase[i] > 0 ? -strokes : hcpBase[i] < 0 ? strokes : 0;
  });
  const adjHcps = RP.map(i => liveHcps[i] + strokeAdj[i]);
  const minAdj = Math.min(...adjHcps);
  const nextRelHcps = adjHcps.map(h => h - minAdj);
  // Date and time of day
  const now = roundStartTime ? new Date(roundStartTime) : new Date();
  const dateStr = now.toLocaleDateString("en-SG", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "Morning" : "Afternoon";
  const dateStamp = now.toISOString().slice(0,10).replace(/-/g,"");
  const reportTitle = `sws.${dateStamp}.${names.map(n=>n.replace(/[^a-zA-Z0-9]/g,"").slice(0,3).toUpperCase()).join(" ")}`;
  // Score label helper
  function scoreBadgeHtml(score, par, active) {
    if (!active) return `<span style="color:#888">${score}</span>`;
    const diff = score - par;
    let shape = "";
    if (diff <= -2) shape = `<span style="border:1.5px solid #333;border-radius:50%;padding:0 3px;outline:1.5px solid #333;outline-offset:2px">${score}</span>`;
    else if (diff === -1) shape = `<span style="border:1.5px solid #333;border-radius:50%;padding:0 3px">${score}</span>`;
    else if (diff === 1) shape = `<span style="border:1.5px solid #333;padding:0 3px">${score}</span>`;
    else if (diff >= 2) shape = `<span style="border:1.5px solid #333;padding:0 3px;outline:1.5px solid #333;outline-offset:2px">${score}</span>`;
    else shape = `${score}`;
    return shape;
  }
  // Build scorecard rows
  const RN = names.length;
  const vp = vegasPlayers || [0,1,2,3];
  const P_COLORS = ["#16a34a","#2563eb","#c2410c","#9333ea","#b45309","#0e7490"];
  let scRows = "";
  let outTotals = Array(RN).fill(0), inTotals = Array(RN).fill(0), grandTotals = Array(RN).fill(0);
  let outPar = 0, inPar = 0;
  for (let hi = 0; hi < 18; hi++) {
    const h = holes[hi];
    const active = inPlay[hi];
    const rowStyle = active ? "" : "opacity:0.4;background:#f5f5f5;";
    const team0 = hzEnabled ? [hzHero[hi]] : ((vTeams && vTeams[hi]) ? vTeams[hi][0] : [vp[0],vp[1]]);
    const team1 = hzEnabled ? [0,1,2].filter(i => i !== hzHero[hi]) : ((vTeams && vTeams[hi]) ? vTeams[hi][1] : [vp[2],vp[3]]);
    const isHIO_rep = hioRule !== false && h.par === 3 && results[hi].g.some(g => parseInt(g,10) === 1);
    let row = `<tr style="${rowStyle}">
      <td style="text-align:center;font-weight:600;color:#555">${hi+1}</td>
      <td style="text-align:center;color:#777">${h.par}</td>
      <td style="text-align:center;color:#999;font-size:11px">${h.si}</td>`;
    for (let pi = 0; pi < RN; pi++) {
      const g = parseInt(results[hi].g[pi], 10);
      const score = isNaN(g) ? "-" : g;
      if (!isNaN(g) && active) {
        if (hi < 9) outTotals[pi] += g; else inTotals[pi] += g;
        grandTotals[pi] += g;
      }
      const inVP = vp.includes(pi);
      const inTeam0 = team0.includes(pi);
      const inTeam1 = team1.includes(pi);
      const scoreHtml = isNaN(g) ? "-" : scoreBadgeHtml(g, h.par, active);
      // Banker tags — only for VP players on par 3s
      let bankerTag = "";
      if (games.p3 && h.par === 3 && banker && p3mult && inVP && !isHIO_rep) {
        const isBanker = banker[hi] === pi;
        const mult = p3mult[hi] ? p3mult[hi][pi] : 1;
        if (isBanker) bankerTag = `<span style="font-size:8px;color:#c2410c;font-weight:700">B${mult>1?`×${mult}`:""}</span>`;
        else bankerTag = `<span style="font-size:8px;color:#777;font-weight:500">${mult>1?`×${mult}`:"×1"}</span>`;
      }
      // Vegas team dot — only for VP players: filled = team 0, outline = team 1
      let vegasDot = "";
      if (games.vegas && (RN >= 4 || ghostEnabled || hzEnabled) && inVP && !isHIO_rep) {
        if (inTeam0) vegasDot = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#333;vertical-align:middle"></span>`;
        else if (inTeam1) vegasDot = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;border:1.5px solid #333;vertical-align:middle"></span>`;
      }
      const hasSuffix = (games.vegas && (RN >= 4 || ghostEnabled || hzEnabled)) || (games.p3 && h.par === 3);
      const suffix = hasSuffix
        ? `<span style="display:inline-block;width:16px;text-align:left;vertical-align:middle;margin-left:1px">
            <span style="display:block;text-align:left;height:10px;line-height:10px">${bankerTag}</span>
            <span style="display:block;text-align:left;height:7px;line-height:7px">${vegasDot}</span>
           </span>`
        : "";
      row += `<td style="text-align:center;white-space:nowrap"><span style="display:inline-block;width:20px;text-align:center;vertical-align:middle">${scoreHtml}</span>${suffix}</td>`;
    }
    row += `</tr>`;
    scRows += row;
    if (hi < 9) outPar += h.par; else inPar += h.par;
    if (hi === 8) {
      const hasSuffix = (games.vegas && (RN >= 4 || ghostEnabled || hzEnabled)) || games.p3;
      scRows += `<tr style="background:#e8f5e8;font-weight:700">
        <td style="text-align:center">OUT</td>
        <td style="text-align:center">${outPar}</td>
        <td></td>
        ${outTotals.map(t => `<td style="text-align:center;white-space:nowrap"><span style="display:inline-block;width:20px;text-align:center">${t||"-"}</span>${hasSuffix?`<span style="display:inline-block;width:16px"></span>`:""}</td>`).join("")}
      </tr>`;
    }
  }
  const hasSuffix = (games.vegas && (RN >= 4 || ghostEnabled || hzEnabled)) || games.p3;
  scRows += `<tr style="background:#e8f5e8;font-weight:700">
    <td style="text-align:center">IN</td>
    <td style="text-align:center">${inPar}</td>
    <td></td>
    ${inTotals.map(t => `<td style="text-align:center;white-space:nowrap"><span style="display:inline-block;width:20px;text-align:center">${t||"-"}</span>${hasSuffix?`<span style="display:inline-block;width:16px"></span>`:""}</td>`).join("")}
  </tr>
  <tr style="background:#0a1a0a;color:#4ade80;font-weight:700">
    <td style="text-align:center">TOT</td>
    <td style="text-align:center">${outPar+inPar}</td>
    <td></td>
    ${grandTotals.map(t => `<td style="text-align:center;white-space:nowrap"><span style="display:inline-block;width:20px;text-align:center">${t||"-"}</span>${hasSuffix?`<span style="display:inline-block;width:16px"></span>`:""}</td>`).join("")}
  </tr>`;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${reportTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 12px 16px; color: #222; font-size: 11px; }
  .header { background: #0a1a0a; color: #4ade80; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; letter-spacing: 3px; color: #4ade80; }
  .header-sub { color: #4a7a4a; font-size: 9px; letter-spacing: 2px; margin-top: 2px; }
  .header-right { text-align: right; font-size: 9px; color: #4a7a4a; }
  .meta-row { display: flex; gap: 20px; margin-bottom: 8px; font-size: 11px; color: #444; }
  h2 { font-size: 9px; color: #4a7a4a; letter-spacing: 2px; text-transform: uppercase; margin: 8px 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0a1a0a; color: #4ade80; padding: 4px 3px; text-align: center; font-size: 10px; }
  td { padding: 3px 3px; border-bottom: 1px solid #eee; text-align: center; font-size: 11px; }
  td.label { text-align: left; color: #555; }
  table.scorecard th:nth-child(1), table.scorecard td:nth-child(1) { width: 22px; }
  table.scorecard th:nth-child(2), table.scorecard td:nth-child(2) { width: 22px; }
  table.scorecard th:nth-child(3), table.scorecard td:nth-child(3) { width: 22px; }
  .pos { color: #16a34a; font-weight: 700; }
  .neg { color: #dc2626; font-weight: 700; }
  .total-row td { background: #0a1a0a; font-weight: 700; font-size: 12px; }
  .total-row td:first-child { color: #4ade80; }
  .total-row .pos { color: #4ade80 !important; }
  .total-row .neg { color: #f87171 !important; }
  .out-row td, .in-row td { background: #e8f5e8; font-weight: 700; font-size: 11px; }
  .footer { text-align: center; color: #bbb; font-size: 9px; margin-top: 8px; border-top: 1px solid #eee; padding-top: 6px; }
  @media print {
    body { padding: 8px; }
    .no-print { display: none; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:10px">
      ${(() => {
        const s = 40, c = s/2, ringS = s*0.80, rx0 = c-ringS/2, ry0 = c-ringS/2;
        const ropeW = s*0.028, postR = s*0.045;
        const h = s*0.28, w = h*0.11, gap = h*0.62, cupR = w*2.2;
        const topY = c-h*0.48, tipY = topY+h;
        const lx = c-gap/2-w/2, rx2 = c+gap/2+w/2;
        const ringR = s*0.04, bgR = s*0.16;
        function teePaths(cx) {
          const stem = `M${cx-w*0.5} ${topY} L${cx+w*0.5} ${topY} L${cx+w*0.14} ${tipY} L${cx-w*0.14} ${tipY}Z`;
          const rimL=cx-cupR, rimR=cx+cupR, dip=topY+cupR*0.45;
          const cup = `M${rimL} ${topY} C${cx-cupR*0.5},${topY} ${cx},${dip} ${cx},${dip} C${cx},${dip} ${cx+cupR*0.5},${topY} ${rimR},${topY} L${rimR},${topY+cupR*0.22} C${cx+cupR*0.5},${topY+cupR*0.22} ${cx},${dip+cupR*0.22} ${cx},${dip+cupR*0.22} C${cx},${dip+cupR*0.22} ${cx-cupR*0.5},${topY+cupR*0.22} ${rimL},${topY+cupR*0.22}Z`;
          return [stem, cup];
        }
        const [ls,lc]=teePaths(lx), [rs,rc]=teePaths(rx2);
        const posts = [[rx0,ry0],[rx0+ringS,ry0],[rx0,ry0+ringS],[rx0+ringS,ry0+ringS]];
        return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
          <rect width="${s}" height="${s}" rx="${bgR}" fill="#0a1a0a"/>
          <rect x="${rx0}" y="${ry0}" width="${ringS}" height="${ringS}" rx="${ringR}" fill="#071507"/>
          <rect x="${rx0}" y="${ry0}" width="${ringS}" height="${ringS}" rx="${ringR}" fill="none" stroke="#4ade80" stroke-width="${ropeW}"/>
          ${posts.map(([px,py])=>`<circle cx="${px}" cy="${py}" r="${postR}" fill="#4ade80"/>`).join('')}
          <path d="${ls}" fill="#fff"/><path d="${lc}" fill="#fff"/>
          <path d="${rs}" fill="#fff"/><path d="${rc}" fill="#fff"/>
        </svg>`;
      })()}
      <div>
        <h1>teebox</h1>
        <div class="header-sub">May the honors be with you.</div>
      </div>
    </div>
    <div class="header-right" style="color:#e8f5e8">
      <div>${dateStr}</div>
      <div>${timeOfDay} · ${courseName || "Custom Course"}</div>
      <div style="margin-top:2px;color:#4a7a4a">vw-1.2.2</div>
    </div>
  </div>
  ${!isSolo ? `<div>
    <h2>$$$ Summary</h2>
    <table>
      <tr><th style="text-align:left"></th>${names.map(n=>`<th>${n.slice(0,8)}</th>`).join("")}</tr>
      ${(games.pts||games.vegas||games.ct||games.p3) ? (()=>{
        // Show HCP/Next if Vegas/CT/Banker is active (next HCP only meaningful for betting games)
        // Show HCP alone if only Points Game is active
        const showNext = games.vegas || games.ct || games.p3;
        const label = showNext ? "HCP/Next" : "HCP";
        return `<tr style="background:#f8f8f8"><td class="label" style="color:#333;font-size:11px">${label}</td>${names.map((_,i)=>`<td style="font-size:${showNext?11:12}px;color:#333;text-align:center">${relHcps[i]}${showNext?` / <b>${nextRelHcps[i]}</b>`:""}</td>`).join("")}</tr>`;
      })() : ""}
      ${games.vegas ? `<tr><td class="label">Vegas${hzEnabled?" (Hero or Zero)":ghostEnabled?" (Ghost)":""}</td>${RP.map(i=>{const v=vegasCum[i]*vegasVal;return`<td class="${v>0?"pos":v<0?"neg":""}">${v>0?"+":""}${v||"—"}</td>`;}).join("")}</tr>`:""}      ${games.ct ? `<tr><td class="label">CT</td>${RP.map(i=>{const v=ctCum[i]*ctVal;return`<td class="${v>0?"pos":v<0?"neg":""}">${v>0?"+":""}${v||"—"}</td>`;}).join("")}</tr>`:""}      ${games.p3 ? `<tr><td class="label">Banker</td>${RP.map(i=>{const v=p3Cum[i]*p3Val;return`<td class="${v>0?"pos":v<0?"neg":""}">${v>0?"+":""}${v||"—"}</td>`;}).join("")}</tr>`:""}      ${adjustments.some(a=>a!==0)?`<tr><td class="label">Adj</td>${adjustments.map(v=>`<td class="${v>0?"pos":v<0?"neg":""}">${v>0?"+":""}${v||"—"}</td>`).join("")}</tr>`:""}      ${(games.vegas||games.ct||games.p3)?`<tr style="background:#f0f7f0;font-weight:600"><td style="text-align:left;color:#555">${(games.pts||matchupEnabled)?"Sub":""}</td>${(dollarsSubtotal||dollars).map(v=>`<td class="${v>0?"pos":v<0?"neg":""}" style="font-weight:700">${v>0?"+":""}${v||"—"}</td>`).join("")}</tr>`:""}
      ${games.pts && ptsCum ? `<tr><td class="label">${ptsVal===0?"Pts (pt)":`Pts ($${ptsVal})`}</td>${RP.map(i=>{const v=ptsVal>0?RP.reduce((s,j)=>j!==i?s+(ptsCum[i]-ptsCum[j])*ptsVal:s,0):ptsCum[i];return`<td class="${v>0?"pos":v<0?"neg":""}">${v||"—"}</td>`;}).join("")}</tr>`:""}
      ${sixesEnabled ? `<tr><td class="label">${sixesConfig.stakeType==="cash"?`Sixes ($${sixesConfig.cashAmount})`:(()=>{const tot=sixesPlayerTokens.reduce((s,v)=>s+v,0);return`Sixes (${tot} token${tot===1?"":"s"})`;})()}</td>${RP.map(i=>{if(sixesConfig.stakeType==="cash"){const v=sixesPlayerDollars[i];return`<td class="${v>0?"pos":v<0?"neg":""}">${v>0?"+":""}${v||"—"}</td>`;}else{const v=sixesPlayerTokens[i];return`<td>${v||"—"}</td>`;}}).join("")}</tr>`:""}
      ${matchupEnabled ? (()=>{
        const typeOrder = [["nassau","Nassau"],["gdb","GDB"],["matchplay","Match Play"],["stroke","Stroke Play"]];
        const byType = {};
        typeOrder.forEach(([k]) => byType[k] = Array(RP.length).fill(0));
        const totalPD = Array(RP.length).fill(0);
        (nassauResults||[]).forEach((r, mi) => {
          const m = matchups[mi];
          const t = m.type || "nassau";
          if (!byType[t]) byType[t] = Array(RP.length).fill(0);
          byType[t][m.p1] += r.dollars.net;
          byType[t][m.p2] -= r.dollars.net;
          totalPD[m.p1] += r.dollars.net;
          totalPD[m.p2] -= r.dollars.net;
        });
        const usedTypes = typeOrder.filter(([k]) => byType[k].some(v => v !== 0));
        const showSub = usedTypes.length > 1;
        let html = "";
        usedTypes.forEach(([k,label]) => {
          html += `<tr><td class="label">${label}</td>${byType[k].map(v=>`<td class="${v>0?"pos":v<0?"neg":""}">${v>0?"+":""}${v||"—"}</td>`).join("")}</tr>`;
        });
        if (showSub) {
          html += `<tr style="background:#f0f7f0;font-weight:600"><td class="label" style="color:#555">Sub</td>${totalPD.map(v=>`<td class="${v>0?"pos":v<0?"neg":""}" style="font-weight:700">${v>0?"+":""}${v||"—"}</td>`).join("")}</tr>`;
        }
        return html;
      })() : ""}
      ${(matchupEnabled||(games.pts&&ptsVal>0)||(sixesEnabled&&sixesConfig.stakeType==="cash")) ? `<tr class="total-row"><td style="text-align:left;color:#4ade80">TOTAL</td>${dollars.map(v=>`<td style="color:${v>0?"#4ade80":v<0?"#f87171":"#aaa"};font-weight:700">${v>0?"+":v<0?"":"-"}${Math.abs(v)||"—"}</td>`).join("")}</tr>` : ""}
    </table>
  </div>` : ""}
  <h2>Scorecard (Gross)</h2>
  ${games.vegas && (RN >= 4 || ghostEnabled || hzEnabled) ? `<div style="font-size:9px;color:#555;margin-bottom:2px">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#333;vertical-align:middle;margin-right:3px"></span>= Team A &nbsp;
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;border:1.5px solid #333;vertical-align:middle;margin-right:3px"></span>= Team B
  </div>` : ""}
  ${games.p3 ? `<div style="font-size:9px;color:#555;margin-bottom:4px">
    <span style="color:#c2410c;font-weight:700;margin-right:3px">B</span>= Banker &nbsp;
    <span style="color:#9333ea;font-weight:700;margin-right:3px">×2/×3</span>= Multiplier called
  </div>` : ""}
  <table class="scorecard">
    <tr>
      <th>H</th><th>Par</th><th>SI</th>
      ${(function(){ const hasSuffix2 = (games.vegas && (RN >= 4 || ghostEnabled || hzEnabled)) || games.p3; return names.map(n=>`<th><span style="display:inline-block;width:20px;text-align:center">${n.slice(0,8)}</span>${hasSuffix2?`<span style="display:inline-block;width:16px"></span>`:""}</th>`).join(""); })()}
    </tr>
    ${scRows}
  </table>
  <div class="footer">
    Generated by Tee Box vw-1.2.2 · ${new Date().toLocaleString("en-SG")}
  </div>
  <div style="text-align:center;margin:10px 0;page-break-inside:avoid">
    <h2 style="font-size:9px;color:#4a7a4a;letter-spacing:2px;text-transform:uppercase;margin:8px 0 6px;border-bottom:1px solid #ddd;padding-bottom:2px">QR Code — Full Round Data</h2>
    ${qrDataUrl ? `<div style="display:inline-block;background:#fff;padding:6px;border:1px solid #eee;border-radius:4px"><img src="${qrDataUrl}" width="160" height="160"/></div>` : ''}
    <div style="font-size:9px;color:#aaa;margin-top:4px">${names.join(" · ")}</div>
  </div>
  <div class="no-print" style="text-align:center;margin-top:10px;display:flex;gap:10px;justify-content:center">
    <button onclick="window.print()" style="padding:8px 20px;background:#0a1a0a;color:#4ade80;border:none;border-radius:6px;font-size:13px;cursor:pointer">
      🖨 Print / Save as PDF
    </button>
</body>
</html>`;
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEE BOX LOGO
// ─────────────────────────────────────────────────────────────────────────────
function TeeBoxLogo({ size }) {
  const s = size || 48;
  const c = s / 2;
  const ringS = s * 0.80;
  const rx0 = c - ringS/2, ry0 = c - ringS/2;
  const ropeW = s * 0.028, postR = s * 0.045;
  const h = s * 0.28, w = h * 0.11, gap = h * 0.62, cupR = w * 2.2;
  const topY = c - h * 0.48, tipY = topY + h;
  const lx = c - gap/2 - w/2, rx2 = c + gap/2 + w/2;
  function teePath(cx) {
    const stemPath = `M ${cx-w*0.5} ${topY} L ${cx+w*0.5} ${topY} L ${cx+w*0.14} ${tipY} L ${cx-w*0.14} ${tipY} Z`;
    const rimL=cx-cupR, rimR=cx+cupR, dip=topY+cupR*0.45;
    const cupPath = `M ${rimL} ${topY} C ${cx-cupR*0.5},${topY} ${cx},${dip} ${cx},${dip} C ${cx},${dip} ${cx+cupR*0.5},${topY} ${rimR},${topY} L ${rimR},${topY+cupR*0.22} C ${cx+cupR*0.5},${topY+cupR*0.22} ${cx},${dip+cupR*0.22} ${cx},${dip+cupR*0.22} C ${cx},${dip+cupR*0.22} ${cx-cupR*0.5},${topY+cupR*0.22} ${rimL},${topY+cupR*0.22} Z`;
    return [stemPath, cupPath];
  }
  const lt = teePath(lx), rt = teePath(rx2);
  const posts = [[rx0,ry0],[rx0+ringS,ry0],[rx0,ry0+ringS],[rx0+ringS,ry0+ringS]];
  const accent = "#4ade80";
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <rect width={s} height={s} rx={s*0.16} fill="#0a1a0a"/>
      <rect x={rx0} y={ry0} width={ringS} height={ringS} rx={s*0.04} fill="#071507"/>
      <rect x={rx0} y={ry0} width={ringS} height={ringS} rx={s*0.04} fill="none" stroke={accent} strokeWidth={ropeW}/>
      {posts.map(([px,py],i) => <circle key={i} cx={px} cy={py} r={postR} fill={accent}/>)}
      <path d={lt[0]} fill="#ffffff"/><path d={lt[1]} fill="#ffffff"/>
      <path d={rt[0]} fill="#ffffff"/><path d={rt[1]} fill="#ffffff"/>
    </svg>
  );
}

function SplashContent({ onDone, isLight, isSuperuser, onLogoTap }) {
  const [key, setKey] = useState(0);
  const s = 120, c = s/2;
  const ringS = s*0.80, rx0 = c-ringS/2, ry0 = c-ringS/2;
  const ropeW = s*0.028, postR = s*0.045;
  const h = s*0.28, w = h*0.11, gap = h*0.62, cupR = w*2.2;
  const topY = c-h*0.48, tipY = topY+h;
  const lx = c-gap/2-w/2, rx2 = c+gap/2+w/2;
  function teePath(cx) {
    const stemPath = `M ${cx-w*0.5} ${topY} L ${cx+w*0.5} ${topY} L ${cx+w*0.14} ${tipY} L ${cx-w*0.14} ${tipY} Z`;
    const rimL=cx-cupR, rimR=cx+cupR, dip=topY+cupR*0.45;
    const cupPath = `M ${rimL} ${topY} C ${cx-cupR*0.5},${topY} ${cx},${dip} ${cx},${dip} C ${cx},${dip} ${cx+cupR*0.5},${topY} ${rimR},${topY} L ${rimR},${topY+cupR*0.22} C ${cx+cupR*0.5},${topY+cupR*0.22} ${cx},${dip+cupR*0.22} ${cx},${dip+cupR*0.22} C ${cx},${dip+cupR*0.22} ${cx-cupR*0.5},${topY+cupR*0.22} ${rimL},${topY+cupR*0.22} Z`;
    return [stemPath, cupPath];
  }
  const lt = teePath(lx), rt = teePath(rx2);
  const posts = [[rx0,ry0],[rx0+ringS,ry0],[rx0,ry0+ringS],[rx0+ringS,ry0+ringS]];
  const accent = "#4ade80";
  return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:"40px 20px" }}>
      <style>{`
        html, body, #root { background: #000 !important; }
        @keyframes tbRingAppear { 0%{opacity:0;transform:scale(0.5)} 30%{opacity:1;transform:scale(1.05)} 45%{transform:scale(0.97)} 55%{transform:scale(1)} 100%{opacity:1;transform:scale(1)} }
        @keyframes tbTeeLeft    { 0%{transform:translateX(-180px);opacity:0} 100%{transform:translateX(0);opacity:1} }
        @keyframes tbTeeRight   { 0%{transform:translateX(180px);opacity:0}  100%{transform:translateX(0);opacity:1} }
        @keyframes tbClash      { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.2)} 10%{opacity:1;transform:translate(-50%,-50%) scale(1.4)} 40%{opacity:0;transform:translate(-50%,-50%) scale(0.8)} 100%{opacity:0} }
        @keyframes tbTitleRise  { 0%{opacity:0;transform:translateY(24px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes tbTagRise    { 0%{opacity:0} 100%{opacity:1} }
        @keyframes tbBtnAppear  { 0%{opacity:0} 100%{opacity:1} }
        .tb-ring  { animation: tbRingAppear 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s  both; }
        .tb-teel  { animation: tbTeeLeft    0.5s cubic-bezier(0.22,1,0.36,1)    1.0s  both; }
        .tb-teer  { animation: tbTeeRight   0.5s cubic-bezier(0.22,1,0.36,1)    1.0s  both; }
        .tb-clash { animation: tbClash      0.6s ease                           1.45s both; }
        .tb-title { animation: tbTitleRise  0.6s ease                           1.6s  both; }
        .tb-tag   { animation: tbTagRise    0.5s ease                           2.0s  both; }
        .tb-btn   { animation: tbBtnAppear  0.5s ease                           2.5s  both; }
      `}</style>
      <div key={key} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
        <div onClick={onLogoTap} style={{ position:"relative", width:s, height:s, cursor: onLogoTap ? "pointer" : "default", userSelect: "none", WebkitTapHighlightColor: "transparent" }}>
          <svg className="tb-ring" width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ position:"absolute", top:0, left:0 }}>
            <rect width={s} height={s} rx={s*0.16} fill="#0a1a0a"/>
            <rect x={rx0} y={ry0} width={ringS} height={ringS} rx={s*0.04} fill="#071507"/>
            <rect x={rx0} y={ry0} width={ringS} height={ringS} rx={s*0.04} fill="none" stroke={accent} strokeWidth={ropeW}/>
            {posts.map(([px,py],i) => <circle key={i} cx={px} cy={py} r={postR} fill={accent}/>)}
          </svg>
          <svg className="tb-teel" width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ position:"absolute", top:0, left:0 }}>
            <path d={lt[0]} fill="#ffffff"/><path d={lt[1]} fill="#ffffff"/>
          </svg>
          <svg className="tb-teer" width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ position:"absolute", top:0, left:0 }}>
            <path d={rt[0]} fill="#ffffff"/><path d={rt[1]} fill="#ffffff"/>
          </svg>
          <div className="tb-clash" style={{ position:"absolute", top:"50%", left:"50%", width:50, height:50, borderRadius:"50%", background:"radial-gradient(circle, rgba(74,222,128,0.95) 0%, rgba(74,222,128,0.3) 50%, transparent 70%)", pointerEvents:"none" }}/>
        </div>
        <div className="tb-title" onClick={onLogoTap} style={{ textAlign:"center", cursor: onLogoTap ? "pointer" : "default", userSelect: "none", WebkitTapHighlightColor: "transparent", position: "relative", display: "inline-block" }}>
          <div style={{ fontSize:42, fontWeight:"900", letterSpacing:6, color:"#ffffff", lineHeight:1, fontFamily:"'DM Sans', sans-serif", position: "relative", display: "inline-block" }}>
            teebox
            {isSuperuser && (
              <span style={{ position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 10, fontSize: 18, color: accent, letterSpacing: 1 }}>🛡️</span>
            )}
          </div>
        </div>
        <div className="tb-tag" style={{ fontSize:13, color:accent, letterSpacing:1, textAlign:"center", fontFamily:"'DM Sans', sans-serif" }}>
          May the honors be with you.
        </div>
        <div className="tb-btn" style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={onDone} style={{ padding:"12px 28px", background:"transparent", border:`1px solid ${accent}`, borderRadius:24, color:accent, fontSize:14, cursor:"pointer", letterSpacing:2, fontFamily:"'DM Sans', sans-serif" }}>ENTER →</button>
          <button onClick={() => setKey(k => k+1)} style={{ padding:"12px 16px", background:"transparent", border:"1px solid #555", borderRadius:24, color:"#555", fontSize:14, cursor:"pointer" }}>↺</button>
        </div>
      </div>
    </div>
  );
}

// SETUP
function Setup({ onStart, savedRounds = [], onLoadRound, isLight, toggleTheme, savedScores = null, savedConfig = null, onNewRound, isSuperuser }) {
  const sc = savedConfig; // shorthand
  // Round is "in progress" when at least one hole has been played (toggled In Play).
  // Used to lock player count + lineup reorder to prevent score corruption.
  const roundInProgress = !!(savedScores?.inPlay?.some?.(p => p));
  const [playerCount, setPlayerCount] = useState(() => {
    if (sc) return sc.playerCount || 4;
    try { return parseInt(localStorage.getItem("sws_playercount") || "4"); } catch { return 4; }
  });
  const [names, setNames] = useState(() => {
    if (sc) return sc.names || ["A","B","C","D","E","F"];
    try {
      const saved = JSON.parse(localStorage.getItem("sws_names") || '["A","B","C","D","E","F"]');
      while (saved.length < 6) saved.push(`P${saved.length+1}`);
      return saved;
    } catch { return ["A","B","C","D","E","F"]; }
  });
  const [hcps, setHcps] = useState(() => {
    if (sc) return sc.hcps?.length >= 6 ? sc.hcps : [...(sc.hcps||[0,0,0,0]), 0, 0].slice(0,6);
    try {
      const saved = JSON.parse(localStorage.getItem("sws_hcps") || "[0,0,0,0,0,0]");
      while (saved.length < 6) saved.push(0);
      return saved;
    } catch { return [0,0,0,0,0,0]; }
  });
  const [holes, setHoles] = useState(() => {
    if (sc) return sc.holes.map(h => ({ ...h }));
    try {
      const saved = localStorage.getItem("sws_lastcourse");
      if (saved) { const c = JSON.parse(saved); return c.holes.map(h => ({ ...h })); }
    } catch(_) {}
    return DEFAULT_HOLES.map(h => ({ ...h }));
  });
  const [vegasVal, setVegasVal] = useState(sc?.vegasVal ?? 1);
  const [ctVal, setCtVal] = useState(sc?.ctVal ?? 3);
  const [p3Val, setP3Val] = useState(sc?.p3Val ?? 5);
  const [bankerNett, setBankerNett] = useState(sc?.bankerNett ?? true);
  const [hcpCap, setHcpCap] = useState(sc?.hcpCap ?? null);
  const [vegasRules, setVegasRules] = useState(sc?.vegasRules ?? "council");
  const [showVegasAdvanced, setShowVegasAdvanced] = useState(false);
  const [hioRule, setHioRule] = useState(sc?.hioRule ?? true);
  const [ptsVal, setPtsVal] = useState(sc?.ptsVal !== undefined ? sc.ptsVal : 0);
  const [hcpThreshold, setHcpThreshold] = useState(sc?.hcpThreshold ?? 25);
  // Group Code — optional 4-digit code that links flights together for live highlights.
  // When set, Setup propagates to config.groupCode; logRound puts it in rounds_full.group_code.
  const [groupCode, setGroupCode] = useState(sc?.groupCode || "");
  // groupLookup: { state: "idle"|"loading"|"new"|"existing"|"error", names?: string[] }
  const [groupLookup, setGroupLookup] = useState({ state: "idle" });
  React.useEffect(() => {
    if (!groupCode || groupCode.length !== 4) { setGroupLookup({ state: "idle" }); return; }
    setGroupLookup({ state: "loading" });
    const t = setTimeout(async () => {
      try {
        // Today-only filter (SGT) — old codes don't surface stale rounds
        const todaySGT = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD
        const sinceParam = `&created_at=gte.${todaySGT}T00:00:00%2B08:00`;
        const url = `${SUPA_URL_BASE}/rounds_full?group_code=eq.${encodeURIComponent(groupCode)}${sinceParam}&order=created_at.asc&limit=1`;
        const res = await fetch(url, { headers: SUPA_HDR });
        if (!res.ok) { setGroupLookup({ state: "error" }); return; }
        const arr = await res.json();
        if (!arr || arr.length === 0) { setGroupLookup({ state: "new" }); return; }
        const first = arr[0];
        const names = (first.players || []).map(p => p?.name || "").filter(Boolean);
        setGroupLookup({ state: "existing", names });
      } catch(_) { setGroupLookup({ state: "error" }); }
    }, 500);
    return () => clearTimeout(t);
  }, [groupCode]);
  // Vegas score cap settings — only applied to Vegas (cap nett before forming Vegas number).
  // Default par+3 for par-3, par+4 for par-4/5/6 (matches historical hardcode).
  // No UI exposed yet; values flow through to Vegas pipeline only. KIV configurable UI.
  const [capPar3, setCapPar3] = useState(sc?.capPar3 ?? 3);
  const [capOther, setCapOther] = useState(sc?.capOther ?? 4);
  // 3-ball Vegas variant: "hz" (Hero or Zero — default) or "ghost" (virtual 4th player)
  const [threeBallVariant, setThreeBallVariant] = useState(sc?.threeBallVariant ?? "hz");
  // Hero or Zero: bonus on/off for whole round
  const [hzBonus, setHzBonus] = useState(sc?.hzBonus ?? false);
  const [courses, setCourses] = useState([]);
  const [showLib, setShowLib] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTee, setSaveTee] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [overwriteId, setOverwriteId] = useState(null);
  const [storageMsg, setStorageMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loadedCourse, setLoadedCourse] = useState(() => {
    if (sc) return { name: sc.courseName || "Custom", tee: "", holes: sc.holes };
    try {
      const saved = localStorage.getItem("sws_lastcourse");
      if (saved) {
        const c = JSON.parse(saved);
        const preset = PRESET_COURSES.find(p => p.id === c.id);
        return preset || c;
      }
    } catch(_) {}
    return PRESET_COURSES[0];
  });
  const [games, setGames] = useState(sc?.games || { vegas: true, ct: true, p3: true, pts: false, sixes: false });
  const [vegasPlayers, setVegasPlayers] = useState(() => sc?.vegasPlayers || [0,1,2,3]);
  // When playerCount drops below current vegasPlayers indices, reset to first 4
  React.useEffect(() => {
    setVegasPlayers(prev => {
      const valid = prev.filter(i => i < playerCount);
      if (valid.length === 4) return prev;
      const all = Array.from({length: playerCount}, (_,i) => i);
      return all.slice(0, 4);
    });
  }, [playerCount]);
  // Auto-adjust game defaults when player count changes — only if not restoring from config
  React.useEffect(() => {
    if (sc) return; // don't override restored games
    if (playerCount === 1) setGames(g => ({ ...g, vegas: false, ct: false, p3: false, pts: false, sixes: false }));
    if (playerCount === 2) setGames(g => ({ ...g, vegas: false, ct: false, p3: false, pts: false, sixes: false }));
    if (playerCount === 3) setGames(g => ({ ...g, vegas: false, ct: false, p3: false, pts: true, sixes: false }));
    if (playerCount === 4) setGames(g => ({ ...g, vegas: true, ct: true, p3: true, pts: false, sixes: false }));
    if (playerCount === 5) setGames(g => ({ ...g, vegas: false, ct: false, p3: false, pts: false, sixes: true }));
    if (playerCount === 6) setGames(g => ({ ...g, vegas: false, ct: false, p3: false, pts: false, sixes: true }));
    // Matchup default: on for 2+ players
    if (playerCount === 2) setMatchupBets(n => ({ ...n, on: true }));
    // Reset default sixes teams for new player count
    if (playerCount === 4) setSixesConfig(s => ({ ...s, segments: [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]] }));
    if (playerCount === 6) setSixesConfig(s => ({ ...s, segments: [[[0,1,2],[3,4,5]], [[0,3,4],[1,2,5]], [[0,1,5],[2,3,4]]] }));
  }, [playerCount]);
  // Game availability based on player count
  const canVegas = playerCount >= 3; // 3-ball = Ghost mode
  const canCT    = playerCount >= 2;
  const canP3    = playerCount >= 2;
  const canMatchup = playerCount >= 2;
  const canPts   = playerCount >= 3;
  const canSixes = playerCount === 4 || playerCount === 5 || playerCount === 6;
  const [matchupBets, setMatchupBets] = useState(sc?.nassau || { on: false, matchups: DEFAULT_MATCHUP.map(m => ({ ...m })) });
  const [sixesConfig, setSixesConfig] = useState(() => {
    const defaults = {
      mode: "top2",
      stakeType: "meal",
      cashAmount: 10,
      segments: [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]],
      shadowPlayer: null,
      shadowOf: [null, null, null],
    };
    return sc?.sixesConfig ? { ...defaults, ...sc.sixesConfig } : defaults;
  });
  // Ensure sixes segments match current player count (handles 4→5→6 mismatch)
  React.useEffect(() => {
    if (playerCount !== 4 && playerCount !== 5 && playerCount !== 6) return;
    const currentFirstTeam = sixesConfig.segments?.[0]?.[0];
    const expectedTeamSize = playerCount === 6 ? 3 : 2;
    const teamSizeWrong = !currentFirstTeam || currentFirstTeam.length !== expectedTeamSize;
    const shadowMissing = playerCount === 5 && (sixesConfig.shadowPlayer === null || sixesConfig.shadowPlayer === undefined);
    if (teamSizeWrong || shadowMissing) {
      if (playerCount === 4) {
        setSixesConfig(s => ({ ...s, segments: [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]], shadowPlayer: null, shadowOf: [null,null,null] }));
      } else if (playerCount === 5) {
        // 5-ball: shadow = weakest player (highest HCP), shadows next-weakest
        const indexed = [0,1,2,3,4].map(i => ({ i, hcp: hcps[i] || 0 }));
        indexed.sort((a, b) => b.hcp - a.hcp); // highest HCP first
        const shadowIdx = indexed[0].i;
        const nextWeakestIdx = indexed[1].i;
        setSixesConfig(s => ({ ...s, segments: teamSizeWrong ? [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]] : s.segments, shadowPlayer: shadowIdx, shadowOf: [nextWeakestIdx, nextWeakestIdx, nextWeakestIdx] }));
      } else {
        setSixesConfig(s => ({ ...s, segments: [[[0,1,2],[3,4,5]], [[0,3,4],[1,2,5]], [[0,1,5],[2,3,4]]], shadowPlayer: null, shadowOf: [null,null,null] }));
      }
    }
  }, [playerCount, sixesConfig.segments, sixesConfig.shadowPlayer, hcps]);
  const [importPreview, setImportPreview] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [startError, setStartError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const importRef = React.useRef();
  const courseImportRef = React.useRef();
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("swimmingWithSharks_courses");
      if (saved) setCourses(JSON.parse(saved));
    } catch (_) {}
  }, []);
  async function saveCourse() {
    if (!saveName.trim()) { setStorageMsg("Please enter a course name."); return; }
    const entry = {
      id: overwriteId || Date.now(),
      name: saveName.trim(),
      tee: saveTee.trim() || "—",
      note: saveNote.trim(),
      holes: holes.map(h => ({ ...h }))
    };
    const updated = overwriteId
      ? courses.map(c => c.id === overwriteId ? entry : c)
      : [...courses, entry];
    try {
      localStorage.setItem("swimmingWithSharks_courses", JSON.stringify(updated));
      setCourses(updated); setSaveName(""); setSaveTee(""); setSaveNote(""); setShowSave(false); setOverwriteId(null);
      setStorageMsg(`"${entry.name} / ${entry.tee}" ${overwriteId ? "updated" : "saved"}.`);
      setLoadedCourse(entry);
      setTimeout(() => setStorageMsg(""), 2500);
    } catch (_) { setStorageMsg("Save failed."); }
  }
  function openSaveForm(course) {
    // Validate SI uniqueness before opening form
    const siCounts = holes.reduce((acc, h) => { acc[h.si] = (acc[h.si]||0)+1; return acc; }, {});
    const dupSIs = Object.keys(siCounts).filter(si => siCounts[si] > 1).map(Number);
    if (dupSIs.length > 0) {
      setSaveError(`Duplicate SI: ${dupSIs.sort((a,b)=>a-b).join(", ")} — fix before saving`);
      setTimeout(() => setSaveError(""), 3000);
      return;
    }
    setSaveError("");
    const src = course || loadedCourse;
    const isPreset = src && PRESET_COURSES.find(p => p.id === src.id);
    setSaveName(src ? src.name : "");
    setSaveTee(src ? (src.tee === "—" ? "" : src.tee) : "");
    setSaveNote(src ? (src.note || "") : "");
    setOverwriteId(src && !isPreset ? src.id : null);
    setShowSave(true); setShowLib(false);
  }
  async function deleteCourse(id) {
    const updated = courses.filter(c => c.id !== id);
    try { localStorage.setItem("swimmingWithSharks_courses", JSON.stringify(updated)); setCourses(updated); } catch (_) {}
  }
  function loadCourse(course) {
    setHoles(course.holes.map(h => ({ ...h })));
    setLoadedCourse(course); setShowLib(false);
    setStorageMsg(`Loaded "${course.name} / ${course.tee}"`);
    setTimeout(() => setStorageMsg(""), 2500);
    try { localStorage.setItem("sws_lastcourse", JSON.stringify({ id: course.id, name: course.name, tee: course.tee, holes: course.holes })); } catch(_) {}
  }
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.config || !data.config.names) { alert("Invalid round file."); return; }
        setImportPreview(data);
      } catch { alert("Could not read file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function exportCourse() {
    const src = loadedCourse || { name: "Custom", tee: "—" };
    const courseData = { tbCourse: true, name: src.name, tee: src.tee, note: src.note || "", holes: holes.map(h => ({ ...h })) };
    const json = JSON.stringify(courseData, null, 2);
    const safeName = src.name.replace(/[^a-zA-Z0-9]/g,"_").slice(0,12);
    const safeTee = (src.tee||"").replace(/[^a-zA-Z0-9]/g,"_").slice(0,8) || "course";
    const filename = `teebox_${safeName}_${safeTee}.json`;
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: filename }).catch(e => { if (e.name !== "AbortError") fallbackDownload(); });
    } else {
      fallbackDownload();
    }
    function fallbackDownload() {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
  function handleCourseImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.tbCourse || !data.holes || data.holes.length !== 18) {
          setSaveError("Invalid course file."); setTimeout(() => setSaveError(""), 3000); return;
        }
        const entry = { id: Date.now(), name: data.name || "Imported", tee: data.tee || "—", note: data.note || "", holes: data.holes };
        // Check for duplicate name + tee in saved courses and presets
        const allCourses = [...PRESET_COURSES, ...courses];
        const dup = allCourses.find(c => c.name.toLowerCase() === entry.name.toLowerCase() && c.tee.toLowerCase() === entry.tee.toLowerCase());
        if (dup) {
          setSaveError(`"${entry.name} / ${entry.tee}" already exists in your library. Rename the tee box to save as a new entry.`);
          setTimeout(() => setSaveError(""), 4000);
          return;
        }
        const updated = [...courses, entry];
        try {
          localStorage.setItem("swimmingWithSharks_courses", JSON.stringify(updated));
          setCourses(updated); loadCourse(entry);
          setImportMsg(`✓ Imported "${entry.name} / ${entry.tee}"`);
          setTimeout(() => setImportMsg(""), 2500);
        } catch (_) { setSaveError("Import failed."); setTimeout(() => setSaveError(""), 3000); }
      } catch { setSaveError("Could not read file — make sure it's a valid Tee Box course file."); setTimeout(() => setSaveError(""), 3000); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  return (
    <div style={S.page} className={isLight ? "light-mode" : "dark-mode"}>
      <style>{`

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { overscroll-behavior: none; overscroll-behavior-y: none; height: 100%; }
        body { overscroll-behavior: none; overscroll-behavior-y: none; height: 100%; margin: 0; }
        #root { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: none; }
        .light-mode { --bg: #ffffff; --card: #eeeeee; --input: #ffffff; --border: #cccccc; --border2: #888888; --text: #000000; --muted: #333333; --dim: #333333; --neg: #cc0000; --accent: #000000; --score-bg: #111111; --score-btn: #111111; --progress-bg: #dddddd; --pill-played: #222222; --pill-p3: #1a4a8a; --badge: #111111; }
        .light-mode * { -webkit-font-smoothing: antialiased; }
        .light-mode .sect-title { font-weight: 800 !important; color: #000000 !important; }
        .light-mode .tab-btn { font-weight: 700 !important; }
        .dark-mode  { --bg: #0a1a0a; --card: #0d2210; --input: #071507; --border: #1e3a1e; --border2: #2a5a2a; --text: #e8f5e8; --muted: #5a8a5a; --dim: #4a7a4a; --neg: #f87171; --accent: #4ade80; --score-bg: #1a3a1a; --score-btn: #1a3a1a; --progress-bg: #1e3a1e; --pill-played: #2a5a2a; --pill-p3: #1a4a6a; --badge: #e8f5e8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        .pm-btn:active { transform: scale(0.92); background: #2a5a2a !important; }
        .tab-btn:active { opacity: 0.7; }
        .start-btn:active { transform: scale(0.97); }
        .hole-nav:active { transform: scale(0.95); background: #1e3a1e !important; }
        .inplay-toggle:active { opacity: 0.8; }
        .setup-row:active { opacity: 0.7; }
        select { appearance: none; -webkit-appearance: none; }
      `}</style>
      {/* Import preview modal */}
      {importPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 14, padding: 20, width: "100%", maxWidth: 420 }}>
            <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>IMPORT ROUND</div>
            <div style={{ fontSize: 16, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{importPreview.courseName || "Round"}</div>
            <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>{importPreview.date}</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${importPreview.config.names.length},1fr)`, gap: 6, marginBottom: 16 }}>
              {importPreview.config.names.map((name, pi) => {
                const cfg = importPreview.config;
                const ss = cfg._savedState;
                if (!ss) return <div key={pi} />;
                const _NP=ss.liveHcps.length;const vCum=Array(_NP).fill(0),cCum=Array(_NP).fill(0),pCum=Array(_NP).fill(0);
                const _vp=cfg.vegasPlayers||[0,1,2,3];
                cfg.holes.forEach((h,hi) => {
                  if (!ss.inPlay[hi]) return;
                  const g=ss.gross[hi];
                  const n=Array.from({length:_NP},(_,p)=>nettScore(g[p],ss.liveHcps[p],h.si,h.par));
                  if (cfg.games.vegas){const vr=computeVegas(ss.vTeams[hi],g,n,h.par);if(vr){ss.vTeams[hi][0].forEach(p=>{vCum[p]+=vr.netA;});ss.vTeams[hi][1].forEach(p=>{vCum[p]+=vr.netB;});}}
                  if (cfg.games.ct){const vpN=_vp.map(p=>n[p]);const ct=computeCutThroat(vpN);_vp.forEach((p,idx)=>cCum[p]+=ct[idx]);}
                  if (cfg.games.p3&&h.par===3){const vpN=_vp.map(p=>n[p]);const vpBi=_vp.indexOf(ss.banker[hi])>=0?_vp.indexOf(ss.banker[hi]):0;const vpM=_vp.map(p=>ss.p3mult[hi]?.[p]||1);const p3=computePar3(vpN,vpBi,vpM);_vp.forEach((p,idx)=>pCum[p]+=p3[idx]);}
                });
                const subtotal=(cfg.games.vegas?vCum[pi]*cfg.vegasVal:0)+(cfg.games.ct?cCum[pi]*cfg.ctVal:0)+(cfg.games.p3?pCum[pi]*cfg.p3Val:0)+(ss.adjustments?.[pi]||0);
                // Nassau
                let nassauD = 0;
                if (cfg.nassau?.on && ss.matchups) {
                  ss.matchups.forEach(m => {
                    let net = 0;
                    const type = m.type || "nassau";
                    if (type === "gdb") {
                      const r = computeGDB(m, ss.gross, cfg.holes, ss.inPlay);
                      const dol = gdbDollars(m, r.front, r.back);
                      net = dol.net;
                    } else if (type === "matchplay") {
                      const r = computeNassau(m, ss.gross, cfg.holes, ss.inPlay);
                      net = r.overall.status !== 0 ? (r.overall.status > 0 ? 1 : -1) * m.stake * Math.abs(r.overall.status) : 0;
                    } else if (type === "stroke") {
                      const r = computeStrokePlay(m, ss.gross, cfg.holes, ss.inPlay);
                      net = strokePlayDollars(m, r.front, r.back, r.overall).net;
                    } else {
                      const r = computeNassau(m, ss.gross, cfg.holes, ss.inPlay);
                      const dol = nassauDollars(m, r.front, r.back, r.overall, r.presses);
                      net = dol.net;
                    }
                    if (m.p1 === pi) nassauD += net;
                    if (m.p2 === pi) nassauD -= net;
                  });
                }
                const d = subtotal + nassauD;
                // Relative HCP
                const minHcp = Math.min(...ss.liveHcps);
                const relHcp = ss.liveHcps[pi] - minHcp;
                return (
                  <div key={pi} style={{ background: "var(--input)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: isLight?COLORS_LIGHT[pi]:COLORS[pi], marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>{name.slice(0,5)}</div>
                    <div style={{ fontSize: 11, color: "var(--text)", marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>HCP {relHcp}</div>
                    <div style={{ fontSize: 18, fontWeight: "700", color: d>0?(isLight?"#16a34a":COLORS[0]):d<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontFamily: "'DM Sans', sans-serif" }}>{d>0?"+":""}{d}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { window.scrollTo(0,0); 
                // Preserve original _roundId so old rounds remain locked (24h+ rule).
                // Superuser bypasses the lock if edits are needed.
                onLoadRound({ ...importPreview });
                setImportPreview(null);
              }}
                style={{ ...S.startBtn, flex: 2, fontSize: 15, padding: "13px" }}>Load Round</button>
              <button onClick={() => setImportPreview(null)}
                style={{ ...S.startBtn, flex: 1, fontSize: 15, padding: "13px", background: "var(--border)", color: "var(--accent)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 40px" }}>
        {/* Header */}
        <div style={{ position: "relative", padding: "24px 20px 16px", background: isLight ? "linear-gradient(180deg, #e8f5e8 0%, #f8faf8 100%)" : "linear-gradient(180deg, #0d2a0d 0%, #0a1a0a 100%)" }}>
          <div style={{ position: "absolute", top: 8, right: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isSuperuser && (
                <button onClick={async () => {
                    // Force full reload bypassing cache + clear caches if available
                    try {
                      if ("caches" in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                      }
                      if ("serviceWorker" in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(regs.map(r => r.unregister()));
                      }
                    } catch(_) {}
                    window.location.reload();
                  }}
                  style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: 1 }}>
                  ↻ RELOAD
                </button>
              )}
              <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>vw-1.2.2</span>
            </div>
            <div onClick={toggleTheme} title={isLight ? "Switch to Night Mode" : "Switch to Outdoor Mode"}
              style={{ width: 36, height: 20, borderRadius: 10, background: isLight ? COLORS[0] : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", border: "1px solid var(--border2)", flexShrink: 0 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: isLight ? 18 : 2, transition: "left 0.2s" }}>
                <span style={{ position: "absolute", fontSize: 9, top: 1, left: isLight ? 0 : 1 }}>{isLight ? "☀" : "🌙"}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 12 }}>
            <TeeBoxLogo size={44} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: "900", letterSpacing: 4, color: isLight ? "#000" : "#fff", lineHeight: 1 }}>teebox{isSuperuser && <span style={{ fontSize: 12, color: "var(--accent)", marginLeft: 6, letterSpacing: 1 }}>🛡️</span>}</div>
              <div style={{ fontSize: 11, color: "var(--text)", letterSpacing: 1, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>May the honors be with you.</div>
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 16px 100px" }}>
          {/* ── Saved scores banner ── */}
          {savedScores && (
            <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>♻️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: "700", color: "var(--accent)", fontFamily: "'DM Sans', sans-serif" }}>Scores preserved</div>
                <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{roundInProgress ? "Change settings then START ROUND. Lineup order locked." : "Change settings then START ROUND."}</div>
              </div>
              <button onClick={() => onNewRound && onNewRound()}
                style={{ background: "#3a1a1a", color: "var(--neg)", border: "1px solid #5a2a2a", borderRadius: 8, fontSize: 13, padding: "6px 10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
                🗑 New Round
              </button>
            </div>
          )}
          <Sect title="Players & Handicaps">
            {/* Player count selector */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Players</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => {
                    setPlayerCount(n);
                    try { localStorage.setItem("sws_playercount", String(n)); } catch(_) {}
                  }} style={{ width: 40, height: 40, borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: "700",
                    border: `1px solid ${playerCount===n?"var(--accent)":"var(--border)"}`,
                    background: playerCount===n ? (isLight ? "#000" : "var(--accent)") : "transparent",
                    color: playerCount===n ? "#fff" : "var(--muted)",
                    fontFamily: "'DM Sans', sans-serif" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {Array.from({length: playerCount}, (_,i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                {/* Reorder arrows — disabled mid-round to prevent score corruption */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => {
                    if (i === 0 || roundInProgress) return;
                    const n=[...names], h=[...hcps];
                    [n[i], n[i-1]] = [n[i-1], n[i]];
                    [h[i], h[i-1]] = [h[i-1], h[i]];
                    setNames(n); setHcps(h);
                    try { localStorage.setItem("sws_names", JSON.stringify(n)); localStorage.setItem("sws_hcps", JSON.stringify(h)); } catch(_) {}
                  }} disabled={roundInProgress ? true : false}
                  style={{ width: 28, height: 24, background: (i===0||roundInProgress)?"#0d1a0d":"#1e3a1e", border: "none", borderRadius: 4, color: (i===0||roundInProgress)?"#2a4a2a":COLORS[0], cursor: (i===0||roundInProgress)?"default":"pointer", fontSize: 13, opacity: roundInProgress?0.4:1 }}>↑</button>
                  <button onClick={() => {
                    if (i === playerCount-1 || roundInProgress) return;
                    const n=[...names], h=[...hcps];
                    [n[i], n[i+1]] = [n[i+1], n[i]];
                    [h[i], h[i+1]] = [h[i+1], h[i]];
                    setNames(n); setHcps(h);
                    try { localStorage.setItem("sws_names", JSON.stringify(n)); localStorage.setItem("sws_hcps", JSON.stringify(h)); } catch(_) {}
                  }} disabled={roundInProgress ? true : false}
                  style={{ width: 28, height: 24, background: (i===playerCount-1||roundInProgress)?"#0d1a0d":"#1e3a1e", border: "none", borderRadius: 4, color: (i===playerCount-1||roundInProgress)?"#2a4a2a":COLORS[0], cursor: (i===playerCount-1||roundInProgress)?"default":"pointer", fontSize: 13, opacity: roundInProgress?0.4:1 }}>↓</button>
                </div>
                <div style={{ ...S.dot, background: isLight ? COLORS_LIGHT[i] : COLORS[i], fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, flexShrink: 0 }}>{i+1}</div>
                <input value={names[i]||""} placeholder={`Player ${i+1}`}
                  style={{ ...S.inp, flex: 1, minWidth: 0, fontSize: 16, padding: "11px 10px" }}
                  onChange={e => { const n=[...names]; n[i]=e.target.value; setNames(n); try { localStorage.setItem("sws_names", JSON.stringify(n)); } catch(_){} }} />
                <div style={{ display: "flex", alignItems: "center", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                  <button className="pm-btn" onClick={() => { const h=[...hcps]; h[i]=Math.max(0,h[i]-1); setHcps(h); try{localStorage.setItem("sws_hcps",JSON.stringify(h));}catch(_){} }} style={S.pmBtnInline}>−</button>
                  <span style={{ width: 34, textAlign: "center", color: "var(--text)", fontSize: 17, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>{hcps[i]}</span>
                  <button className="pm-btn" onClick={() => { const h=[...hcps]; h[i]=Math.min(36,h[i]+1); setHcps(h); try{localStorage.setItem("sws_hcps",JSON.stringify(h));}catch(_){} }} style={S.pmBtnInline}>+</button>
                </div>
              </div>
            ))}
          </Sect>
          {/* ── Course — collapsible ── */}
          {(() => {
            const courseTitle = loadedCourse
              ? `${loadedCourse.name}${loadedCourse.tee && loadedCourse.tee !== "—" ? ` · ${loadedCourse.tee}` : ""}`
              : "Custom";
            return (
              <CollapseSect title={`Course — ${courseTitle}`} open={activeSection==="course"} onToggle={() => setActiveSection(s => s==="course" ? null : "course")}>
                {storageMsg && <div style={{ background: "var(--card)", border: "1px solid #4ade80", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 13, color: "#4ade80" }}>{storageMsg}</div>}
                {saveError && <div style={{ background: "#3a0a0a", border: "1px solid var(--neg)", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 13, color: "var(--neg)" }}>⚠ {saveError}</div>}
                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button style={S.courseBtn} onClick={() => { setShowLib(l=>!l); setShowSave(false); }}>
                    {showLib ? "Hide Library" : `📂 Library${courses.length>0?` (${courses.length})`:""}`}
                  </button>
                  <button style={S.courseBtn} onClick={() => { if (showSave) { setShowSave(false); setOverwriteId(null); } else openSaveForm(); }}>
                    {showSave ? "Cancel" : "💾 Save / Update"}
                  </button>
                  <button style={S.courseBtn} onClick={exportCourse} title="Export course as JSON">
                    ↑ Export
                  </button>
                </div>
                {/* Save form */}
                {showSave && (
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                      {overwriteId ? "UPDATE SAVED COURSE" : "SAVE AS NEW COURSE"}
                    </div>
                    <input value={saveName} placeholder="Course name" style={{ ...S.inp, width: "100%", marginBottom: 8, padding: "11px 14px" }} onChange={e => setSaveName(e.target.value)} />
                    <input value={saveTee} placeholder="Tee box (e.g. Yellow, Blue)" style={{ ...S.inp, width: "100%", marginBottom: 8, padding: "11px 14px" }} onChange={e => setSaveTee(e.target.value)} />
                    <input value={saveNote} placeholder="Note (optional)" style={{ ...S.inp, width: "100%", marginBottom: 10, padding: "11px 14px", fontSize: 13 }} onChange={e => setSaveNote(e.target.value)} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="start-btn" style={{ ...S.startBtn, flex: 2, fontSize: 14, padding: "11px" }} onClick={saveCourse}>
                        {overwriteId ? "Update" : "Save"}
                      </button>
                      {overwriteId && (
                        <button className="start-btn" style={{ ...S.startBtn, flex: 1, fontSize: 13, padding: "11px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}
                          onClick={() => { setOverwriteId(null); setSaveName(saveName); }}>
                          Save as New
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Library */}
                {showLib && (
                  <div style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>PRELOADED</div>
                    {PRESET_COURSES.map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ cursor: "pointer", flex: 1 }} onClick={() => loadCourse(c)}>
                          <div style={{ fontSize: 14, color: loadedCourse?.id===c.id?"var(--accent)":"var(--text)", fontWeight: "600" }}>{c.name} {loadedCourse?.id===c.id && "✓"}</div>
                          <div style={{ fontSize: 12, color: "var(--text)" }}>⛳ {c.tee}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#3a6a3a", padding: "3px 8px", border: "1px solid var(--border)", borderRadius: 6 }}>built-in</div>
                      </div>
                    ))}
                    {courses.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: "var(--text)", letterSpacing: 2, margin: "10px 0 8px", fontFamily: "'DM Sans', sans-serif" }}>SAVED</div>
                        {courses.map(c => (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ cursor: "pointer", flex: 1 }} onClick={() => loadCourse(c)}>
                              <div style={{ fontSize: 14, color: loadedCourse?.id===c.id?"var(--accent)":"var(--text)", fontWeight: "600" }}>{c.name} {loadedCourse?.id===c.id && "✓"}</div>
                              <div style={{ fontSize: 12, color: "var(--text)" }}>⛳ {c.tee}{c.note ? ` · ${c.note}` : ""}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { loadCourse(c); openSaveForm(c); }} style={{ background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: "5px 10px" }}>✎</button>
                              <button onClick={() => deleteCourse(c.id)} style={{ background: "transparent", border: "1px solid #5a2a2a", borderRadius: 6, color: "var(--neg)", cursor: "pointer", fontSize: 12, padding: "5px 10px" }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
                {/* Total par summary */}
                {(() => {
                  const frontPar = holes.slice(0,9).reduce((s,h)=>s+h.par,0);
                  const backPar  = holes.slice(9,18).reduce((s,h)=>s+h.par,0);
                  return (
                    <div style={{ display:"flex", gap:8, marginTop:8 }}>
                      {[["OUT",frontPar],["IN",backPar],["TOT",frontPar+backPar]].map(([label,val]) => (
                        <div key={label} style={{ flex:1, textAlign:"center", background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 4px" }}>
                          <div style={{ fontSize:10, color:"var(--dim)", letterSpacing:1, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                          <div style={{ fontSize:20, fontWeight:"700", color:"var(--accent)", fontFamily:"'DM Sans', sans-serif" }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px", background: "var(--card)", padding: "8px 12px", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text)", fontWeight: "600", textAlign: "center" }}>H</div>
                    <div style={{ fontSize: 11, color: "var(--text)", fontWeight: "600", textAlign: "center" }}>PAR</div>
                    <div style={{ fontSize: 11, color: "var(--text)", fontWeight: "600", textAlign: "center" }}>SI</div>
                  </div>
                  {holes.map((hole, hi) => (
                    <div key={hi} style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px", padding: "7px 12px", gap: 8, alignItems: "center", background: hi%2===0?"var(--input)":"var(--card)", borderTop: "1px solid var(--border)" }}>
                      {/* Hole number */}
                      <div style={{ fontSize: 16, fontWeight: "700", color: "var(--text)", textAlign: "center" }}>{hi+1}</div>
                      {/* Par stepper */}
                      <div style={{ display: "flex", alignItems: "center", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                        <button className="pm-btn" onClick={() => { const h=holes.map(x=>({...x})); h[hi].par=Math.max(3,hole.par-1); setHoles(h); }} style={S.pmBtnInline}>−</button>
                        <span style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{hole.par}</span>
                        <button className="pm-btn" onClick={() => { const h=holes.map(x=>({...x})); h[hi].par=Math.min(6,hole.par+1); setHoles(h); }} style={S.pmBtnInline}>+</button>
                      </div>
                      {/* SI dropdown */}
                      <select value={hole.si}
                        onChange={e => { const h=holes.map(x=>({...x})); h[hi].si=Number(e.target.value); setHoles(h); }}
                        style={{ ...S.sel, width: "100%", textAlign: "center", padding: "9px 4px", fontSize: 16, fontWeight: "700" }}>
                        {Array.from({length:18},(_,k)=>k+1).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </CollapseSect>
            );
          })()}
          {/* Group Code — optional 4-digit code linking flights for live highlights */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>Group code</div>
                <div style={{ fontSize: 11, color: "var(--text)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Optional · 4 digits · same code links flights for live highlights</div>
              </div>
              <input type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={groupCode}
                onChange={(e) => setGroupCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="—"
                style={{ width: 84, textAlign: "center", padding: "10px 6px", fontSize: 18, fontWeight: "700", fontFamily: "'DM Sans', sans-serif", color: "var(--accent)", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, letterSpacing: 4 }} />
            </div>
            {groupCode.length === 4 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                {groupLookup.state === "loading" && <span style={{ color: "var(--text)" }}>Checking…</span>}
                {groupLookup.state === "new" && (
                  <div>
                    <span style={{ color: "var(--text)", fontWeight: "600" }}>No active round yet for this code</span>
                    <div style={{ fontSize: 11, color: "var(--text)", marginTop: 3, opacity: 0.8 }}>Status updates once any flight starts logging holes</div>
                  </div>
                )}
                {groupLookup.state === "existing" && (
                  <span style={{ color: "var(--text)" }}>
                    <span style={{ color: isLight ? "#16a34a" : "#4ade80", fontWeight: "600" }}>✓ Joining: </span>
                    <span style={{ fontWeight: "600" }}>{(groupLookup.names || []).join(", ") || "—"}</span>
                  </span>
                )}
                {groupLookup.state === "error" && <span style={{ color: "var(--neg)" }}>Couldn't check group</span>}
              </div>
            )}
          </div>
          {/* ── Games & Stakes — collapsible ── */}
          <CollapseSect title="Games & Stakes" open={activeSection==="games"} onToggle={() => setActiveSection(s => s==="games" ? null : "games")}>
            {/* Vegas Players — only shown when N > 4 */}
            {playerCount > 4 && games.vegas && (
              <div style={{ marginBottom: 14, padding: "10px 12px", background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--text)", letterSpacing: 1, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>BETTING GROUP — PICK 4 (VEGAS / CT / BANKER)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Array.from({length: playerCount}, (_,i) => {
                    const isIn = vegasPlayers.includes(i);
                    const col = isLight ? COLORS_LIGHT[i] : COLORS[i];
                    return (
                      <button key={i} onClick={() => {
                        if (isIn) {
                          if (vegasPlayers.length > 2) setVegasPlayers(prev => prev.filter(x => x !== i));
                        } else {
                          if (vegasPlayers.length < 4) setVegasPlayers(prev => [...prev, i].sort((a,b)=>a-b));
                          else setVegasPlayers(prev => [...prev.slice(1), i].sort((a,b)=>a-b));
                        }
                      }} style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "700",
                        border: `1px solid ${isIn ? col : "var(--border)"}`,
                        background: isIn ? col + "33" : "transparent",
                        color: isIn ? col : "var(--muted)",
                        fontFamily: "'DM Sans', sans-serif" }}>
                        {names[i] || `P${i+1}`}
                        {isIn && <span style={{ marginLeft: 4, fontSize: 11 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                {vegasPlayers.length !== 4 && (
                  <div style={{ fontSize: 11, color: "#f87171", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>Select exactly 4 players for Vegas</div>
                )}
              </div>
            )}
            {/* ── TEAM GAMES ── */}
            <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, fontWeight: "700", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>TEAM GAMES</div>
            {/* Vegas / CT / Banker — each row: toggle + stake */}
            {[["vegas","Vegas",canVegas,vegasVal,setVegasVal],["ct","Cut Throat",canCT,ctVal,setCtVal],["p3","Banker",canP3,p3Val,setP3Val]].map(([key,label,available,val,setter]) => {
              const on = games[key];
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: available?1:0.35 }}>
                  {/* Toggle */}
                  <button onClick={() => { if (!available) return; setGames(g => ({ ...g, [key]: !g[key] })); }}
                    style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, cursor: available?"pointer":"not-allowed",
                      border: `1px solid ${on && available?"var(--accent)":"var(--border)"}`,
                      background: on && available ? (isLight ? "#000" : "var(--accent)") : "transparent",
                      color: on && available ? "#fff" : "var(--text)",
                      fontSize: 16, fontWeight: "700" }}>
                    {on && available ? "✓" : "—"}
                  </button>
                  {/* Label */}
                  <span style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                    {label}
                    {key === "vegas" && playerCount === 3 && on && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 6, fontWeight: "700" }}>{threeBallVariant === "ghost" ? "👻 Ghost" : "🦸 Hero or Zero"}</span>}
                    {!available && <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: 6 }}>{key==="vegas"?"3+ players":"2+ players"}</span>}
                  </span>
                  {/* Stake stepper */}
                  <div style={{ display: "flex", alignItems: "center", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", opacity: on&&available?1:0.4, pointerEvents: on&&available?"auto":"none" }}>
                    <button className="pm-btn" onClick={() => setter(v => Math.max(1,v-1))} style={S.pmBtnInline}>−</button>
                    <span style={{ width: 42, textAlign: "center", color: "var(--accent)", fontSize: 16, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>${val}</span>
                    <button className="pm-btn" onClick={() => setter(v => v+1)} style={S.pmBtnInline}>+</button>
                  </div>
                </div>
              );
            })}
            {/* ── 3-ball Vegas variant config ── */}
            {playerCount === 3 && games.vegas && (
              <div style={{ marginBottom: 14, padding: 10, background: "var(--card)", borderRadius: 8, border: "1px solid var(--border2)" }}>
                <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>3-BALL VEGAS VARIANT</div>
                {/* Variant selector */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[["hz", "🦸 Hero or Zero"], ["ghost", "👻 Ghost"]].map(([val, lbl]) => (
                    <button key={val} onClick={() => setThreeBallVariant(val)}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: "600", cursor: "pointer",
                        border: `1px solid ${threeBallVariant === val ? "var(--accent)" : "var(--border)"}`,
                        background: threeBallVariant === val ? (isLight?"#000":"var(--accent)") : "transparent",
                        color: threeBallVariant === val ? "#fff" : "var(--text)",
                        fontFamily: "'DM Sans', sans-serif" }}>{lbl}</button>
                  ))}
                </div>
                {/* Bonus toggle — HZ only */}
                {threeBallVariant === "hz" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <button onClick={() => setHzBonus(b => !b)}
                      style={{ width: 36, height: 22, borderRadius: 11, flexShrink: 0, cursor: "pointer",
                        border: `1px solid ${hzBonus ? "var(--accent)" : "var(--border)"}`,
                        background: hzBonus ? "var(--accent)" : "transparent",
                        position: "relative", padding: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: hzBonus ? "#fff" : "var(--text)",
                        position: "absolute", top: 3, left: hzBonus ? 19 : 3, transition: "left 0.15s" }} />
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Bonus play</div>
                      <div style={{ fontSize: 10, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{hzBonus ? "Bonus & multiplier triggers apply" : "Multipliers apply, no bonus"}</div>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                  {threeBallVariant === "hz"
                    ? "Pick a Hero per hole — their score pairs with itself. Hero wins 2× or loses 2×."
                    : "Virtual 4th player (Ghost) plays bogey each hole. Ghost can be overridden per hole."}
                </div>
              </div>
            )}
            {/* ── Advanced toggle ── */}
            {(() => {
              const vcbActive = (canVegas && games.vegas) || (canCT && games.ct) || (canP3 && games.p3);
              const activeCount = [
                !bankerNett,
                hcpCap !== null,
                hcpThreshold !== 25,
                vegasRules !== "council",
                !hioRule,
              ].filter(Boolean).length;
              return (
                <div onClick={() => vcbActive && setShowVegasAdvanced(v => !v)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showVegasAdvanced ? 10 : 14, cursor: vcbActive ? "pointer" : "not-allowed", padding: "10px 14px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--border2)", opacity: vcbActive ? 1 : 0.4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚙</span>
                    <span style={{ fontSize: 15, fontWeight: "700", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Advanced</span>
                    {activeCount > 0 && vcbActive && (
                      <span style={{ fontSize: 11, fontWeight: "700", color: "#000", background: "var(--accent)", borderRadius: 10, padding: "1px 7px", fontFamily: "'DM Sans', sans-serif" }}>{activeCount}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--accent)" }}>{showVegasAdvanced ? "▲" : "▼"}</span>
                </div>
              );
            })()}
            {showVegasAdvanced && (
              <div style={{ background: "var(--card)", borderRadius: 8, borderLeft: "3px solid var(--accent)", border: "1px solid var(--border2)", padding: "12px 14px", marginBottom: 14 }}>
                {/* Banker nett toggle */}
                {games.p3 && canP3 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div><span style={{ fontSize: 15, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>Use nett scores </span><span style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>(Banker only)</span></div>
                    <div onClick={() => setBankerNett(v => !v)}
                      style={{ width: 44, height: 24, borderRadius: 12, background: bankerNett?"var(--accent)":"var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: bankerNett?23:3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                    </div>
                  </div>
                )}
                {/* HIO Rule */}
                {canP3 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>Hole In One rule <span style={{ fontSize: 12, color: "var(--text)" }}>(par 3)</span></div>
                      <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Vegas · CT · Banker all off for HIO hole</div>
                    </div>
                    <div onClick={() => setHioRule(v => !v)}
                      style={{ width: 44, height: 24, borderRadius: 12, background: hioRule ? "var(--accent)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: hioRule ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                    </div>
                  </div>
                )}
                {/* HCP Cap */}
                {canVegas && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 15, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>HCP cap </span>
                      <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>(Vegas/CT/Banker)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div onClick={() => setHcpCap(v => v === null ? 24 : null)}
                        style={{ width: 44, height: 24, borderRadius: 12, background: hcpCap!==null?"var(--accent)":"var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: hcpCap!==null?23:3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                      </div>
                      {hcpCap !== null && (
                        <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                          <button className="pm-btn" onClick={() => setHcpCap(v => Math.max(1, v-1))} style={S.pmBtnInline}>−</button>
                          <span style={{ width: 36, textAlign: "center", color: "var(--accent)", fontSize: 15, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>{hcpCap}</span>
                          <button className="pm-btn" onClick={() => setHcpCap(v => v+1)} style={S.pmBtnInline}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* HCP adjustment */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: canVegas ? 10 : 0 }}>
                  <span style={{ fontSize: 15, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>HCP adjustment</span>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <button className="pm-btn" onClick={() => setHcpThreshold(v => Math.max(1,v-1))} style={S.pmBtnInline}>−</button>
                    <span style={{ width: 52, textAlign: "center", color: "var(--accent)", fontSize: 15, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>${hcpThreshold}</span>
                    <button className="pm-btn" onClick={() => setHcpThreshold(v => v+1)} style={S.pmBtnInline}>+</button>
                  </div>
                </div>
                {/* Vegas Rules */}
                {canVegas && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 14, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>Vegas rules</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[["council","Standard"],["classic","Classic"],["double","Aggressive"]].map(([val, label]) => (
                        <button key={val} onClick={() => setVegasRules(val)}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: "700",
                            border: `1px solid ${vegasRules===val?"var(--accent)":"var(--border)"}`,
                            background: vegasRules===val ? (isLight ? "#000" : "var(--accent)") : "transparent",
                            color: vegasRules===val ? "#fff" : "var(--text)",
                            fontFamily: "'DM Sans', sans-serif" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, padding: "12px 14px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        {vegasRules === "council" && (
                          <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <div style={{ fontSize: 16, fontWeight: "700", color: "var(--accent)", marginBottom: 10 }}>Standard Rules</div>
                            {[
                              "1. Check each team's gross scores for a flip trigger.",
                              "2. If both teams trigger → flips cancel out. If only one triggers → flip the opponent's gross Vegas number.",
                              "3. Compute nett scores → form nett Vegas numbers, now reflecting the gross flip.",
                              "4. Compare nett numbers → winner determined.",
                              "5. Winner earns diff × multiplier + bonus.",
                            ].map((s, i) => (
                              <div key={i} style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.7, marginBottom: 4 }}>{s}</div>
                            ))}
                          </div>
                        )}
                        {vegasRules === "classic" && (
                          <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <div style={{ fontSize: 16, fontWeight: "700", color: "var(--accent)", marginBottom: 10 }}>Classic Rules</div>
                            {[
                              "1. Compute nett scores → form nett Vegas numbers.",
                              "2. Compare nett numbers → winner determined.",
                              "3. If winner triggered a flip → flip the loser's nett number, recalculate diff.",
                              "4. Winner earns diff × multiplier + bonus.",
                            ].map((s, i) => (
                              <div key={i} style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.7, marginBottom: 4 }}>{s}</div>
                            ))}
                          </div>
                        )}
                        {vegasRules === "double" && (
                          <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <div style={{ fontSize: 16, fontWeight: "700", color: "var(--accent)", marginBottom: 10 }}>Aggressive Rules</div>
                            {[
                              "1. Check each team's gross scores for a flip trigger.",
                              "2. If both teams trigger → both flips apply, no cancellation.",
                              "3. Compute nett scores → form nett Vegas numbers, reflecting all flips.",
                              "4. Compare nett numbers → winner determined.",
                              "5. Winner's number reverts to original (pre-flip) for diff calculation — only the loser's flipped number is used.",
                              "6. Winner earns diff × multiplier + bonus.",
                              "⚠ Most volatile — flips never cancel, and winner always uses original number for a bigger diff.",
                            ].map((s, i) => (
                              <div key={i} style={{ fontSize: 15, color: i === 6 ? "#f97316" : "var(--text)", lineHeight: 1.7, marginBottom: 4, fontWeight: i === 6 ? "600" : "400" }}>{s}</div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                )}
                {/* Trigger table */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 13, fontWeight: "700", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Flip Triggers (gross scores)</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Condition","Flip","Mult","Bonus"].map(h => (
                          <th key={h} style={{ padding: "4px 6px", fontSize: 12, color: "var(--text)", fontWeight: "600", textAlign: "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Eagle / 2 Birdies", "✓", "×2", "+20"],
                        ["Birdie + Par",       "✓", "×1", "+20"],
                        ["Birdie only",        "✓", "×1", "—"],
                        ["2 Pars",             "—", "×1", "+10"],
                        ["Other",              "—", "×1", "—"],
                      ].map(([cond, flip, mult, bonus]) => (
                        <tr key={cond} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px 6px", fontSize: 13, color: "var(--text)" }}>{cond}</td>
                          <td style={{ padding: "6px 6px", fontSize: 13, color: flip==="✓"?"#f97316":"var(--dim)", fontWeight: flip==="✓"?"700":"400" }}>{flip}</td>
                          <td style={{ padding: "6px 6px", fontSize: 13, color: mult!=="×1"?"#e879f9":"var(--dim)" }}>{mult}</td>
                          <td style={{ padding: "6px 6px", fontSize: 13, color: bonus!=="—"?"var(--accent)":"var(--dim)" }}>{bonus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
                    Mult and bonus awarded to winning team only. Eagle bonus only applies if partner makes par or better.
                  </div>
                </div>
              </div>
            )}
            {/* ── POINTS GAMES ── */}
            <div style={{ borderTop: "2px solid var(--border)", marginBottom: 12 }} />
            <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, fontWeight: "700", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>POINTS GAMES</div>

            {/* Points Game game — 4-6 players */}
            {(() => {
              const available = canPts;
              const on = games.pts;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: available?1:0.35 }}>
                  <button onClick={() => { if (!available) return; setGames(g => ({ ...g, pts: !g.pts })); }}
                    style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, cursor: available?"pointer":"not-allowed",
                      border: `1px solid ${on&&available?"var(--accent)":"var(--border)"}`,
                      background: on&&available ? (isLight?"#000":"var(--accent)") : "transparent",
                      color: on&&available?"#fff":"var(--text)", fontSize: 16, fontWeight: "700" }}>
                    {on&&available?"✓":"—"}
                  </button>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                    Points Game
                    {!available && <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: 6 }}>3-6 players</span>}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", opacity: on&&available?1:0.4, pointerEvents: on&&available?"auto":"none" }}>
                    <button className="pm-btn" onClick={() => setPtsVal(v => Math.max(0,v-1))} style={S.pmBtnInline}>−</button>
                    <span style={{ width: 42, textAlign: "center", color: "var(--accent)", fontSize: 16, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>
                      {ptsVal===0?"meal":`$${ptsVal}`}
                    </span>
                    <button className="pm-btn" onClick={() => setPtsVal(v => v+1)} style={S.pmBtnInline}>+</button>
                  </div>
                </div>
              );
            })()}
            {/* Sixes game — 4-ball or 6-ball */}
            {(() => {
              const available = canSixes;
              const on = games.sixes;
              const N = playerCount;
              return (
                <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: available?1:0.35 }}>
                  <button onClick={() => { if (!available) return; setGames(g => ({ ...g, sixes: !g.sixes })); }}
                    style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, cursor: available?"pointer":"not-allowed",
                      border: `1px solid ${on&&available?"var(--accent)":"var(--border)"}`,
                      background: on&&available ? (isLight?"#000":"var(--accent)") : "transparent",
                      color: on&&available?"#fff":"var(--text)", fontSize: 16, fontWeight: "700" }}>
                    {on&&available?"✓":"—"}
                  </button>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                    Sixes
                    {!available && <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: 6 }}>4-6 players</span>}
                  </span>
                </div>

                {/* Sixes config */}
                {on && available && (
                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    {/* Mode toggle */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>MODE</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[["top1", "Best Ball"], ["top2", "Best 2"]].map(([val, label]) => (
                          <button key={val} onClick={() => setSixesConfig(s => ({ ...s, mode: val }))}
                            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13, fontWeight: "600", cursor: "pointer",
                              border: `1px solid ${sixesConfig.mode === val ? "var(--accent)" : "var(--border)"}`,
                              background: sixesConfig.mode === val ? (isLight?"#000":"var(--accent)") : "transparent",
                              color: sixesConfig.mode === val ? "#fff" : "var(--text)",
                              fontFamily: "'DM Sans', sans-serif" }}>{label}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                        {sixesConfig.mode === "top1" ? "1 pt/hole — best score from each team" : "2 pts/hole — best + 2nd best from each team"}
                      </div>
                    </div>

                    {/* Stake type */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>STAKE</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        {[["meal", "Meal (tokens)"], ["cash", "Cash"]].map(([val, label]) => (
                          <button key={val} onClick={() => setSixesConfig(s => ({ ...s, stakeType: val }))}
                            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13, fontWeight: "600", cursor: "pointer",
                              border: `1px solid ${sixesConfig.stakeType === val ? "var(--accent)" : "var(--border)"}`,
                              background: sixesConfig.stakeType === val ? (isLight?"#000":"var(--accent)") : "transparent",
                              color: sixesConfig.stakeType === val ? "#fff" : "var(--text)",
                              fontFamily: "'DM Sans', sans-serif" }}>{label}</button>
                        ))}
                      </div>
                      {sixesConfig.stakeType === "cash" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>$ per segment winner:</span>
                          <div style={{ display: "flex", alignItems: "center", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                            <button onClick={() => setSixesConfig(s => ({ ...s, cashAmount: Math.max(0, s.cashAmount - 5) }))} style={S.pmBtnInline}>−</button>
                            <span style={{ width: 50, textAlign: "center", color: "var(--accent)", fontSize: 14, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>${sixesConfig.cashAmount}</span>
                            <button onClick={() => setSixesConfig(s => ({ ...s, cashAmount: s.cashAmount + 5 }))} style={S.pmBtnInline}>+</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shadow player (5-ball only) */}
                    {N === 5 && (() => {
                      const shadow = sixesConfig.shadowPlayer;
                      const nonShadowPlayers = [0,1,2,3,4].filter(i => i !== shadow);
                      return (
                        <div style={{ marginBottom: 12, padding: 10, background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>SHADOW PLAYER</div>
                          <div style={{ fontSize: 11, color: "var(--text)", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                            Shadow contributes best of their score + shadowed player's score to their team.
                          </div>
                          {/* Shadow player selector */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Shadow:</span>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {[0,1,2,3,4].map(pi => (
                                <button key={pi} onClick={() => {
                                  // Set shadow; default partner to next-weakest HCP (excluding the shadow)
                                  const nonShadowSorted = [0,1,2,3,4].filter(i => i !== pi)
                                    .map(i => ({ i, hcp: hcps[i] || 0 }))
                                    .sort((a, b) => b.hcp - a.hcp);
                                  const defaultOf = nonShadowSorted[0].i;
                                  setSixesConfig(s => ({ ...s, shadowPlayer: pi, shadowOf: [defaultOf, defaultOf, defaultOf] }));
                                }}
                                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: "600", cursor: "pointer",
                                    border: `1px solid ${shadow === pi ? "var(--accent)" : "var(--border)"}`,
                                    background: shadow === pi ? (isLight?"#000":"var(--accent)") : "transparent",
                                    color: shadow === pi ? "#fff" : "var(--text)",
                                    fontFamily: "'DM Sans', sans-serif" }}>
                                  {(names[pi]||`P${pi+1}`).slice(0,5)}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Shadows whom per segment */}
                          {shadow !== null && (
                            <div>
                              <div style={{ fontSize: 11, color: "var(--text)", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Shadows whom per segment:</div>
                              {["1st", "2nd", "3rd"].map((segLabel, si) => (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12, color: "var(--text)", fontWeight: "600", width: 30, fontFamily: "'DM Sans', sans-serif" }}>{segLabel}:</span>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {nonShadowPlayers.map(pi => (
                                      <button key={pi} onClick={() => {
                                        const newOf = [...sixesConfig.shadowOf];
                                        newOf[si] = pi;
                                        setSixesConfig(s => ({ ...s, shadowOf: newOf }));
                                      }}
                                        style={{ padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: "600", cursor: "pointer",
                                          border: `1px solid ${sixesConfig.shadowOf?.[si] === pi ? "var(--accent)" : "var(--border)"}`,
                                          background: sixesConfig.shadowOf?.[si] === pi ? (isLight?"#000":"var(--accent)") : "transparent",
                                          color: sixesConfig.shadowOf?.[si] === pi ? "#fff" : "var(--text)",
                                          fontFamily: "'DM Sans', sans-serif" }}>
                                        {(names[pi]||`P${pi+1}`).slice(0,5)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Segment pairings */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>SEGMENTS</div>
                        <button onClick={() => {
                          const newTeams = randomiseSixesTeams(N);
                          if (newTeams) setSixesConfig(s => ({ ...s, segments: newTeams }));
                        }}
                          style={{ fontSize: 12, fontWeight: "600", padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                            border: "1px solid var(--border)", background: "transparent", color: "var(--text)",
                            fontFamily: "'DM Sans', sans-serif" }}>
                          🎲 Randomise
                        </button>
                      </div>
                      {sixesConfig.segments.map((seg, si) => (
                        <div key={si} style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, marginBottom: 6 }}>
                          <div style={{ fontSize: 11, color: "var(--text)", fontWeight: "700", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{["1st", "2nd", "3rd"][si]}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                            <div style={{ flex: 1, color: "var(--text)" }}>
                              {seg[0].map(pi => {
                                const isShadowed = N === 5 && sixesConfig.shadowOf?.[si] === pi;
                                return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginRight: 4 }}>
                                  {names[pi]?.slice(0,5) || `P${pi+1}`}
                                  {isShadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2 }}>+{(names[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                                </span>;
                              })}
                            </div>
                            <span style={{ color: "var(--dim)", fontSize: 11 }}>vs</span>
                            <div style={{ flex: 1, color: "var(--text)", textAlign: "right" }}>
                              {seg[1].map(pi => {
                                const isShadowed = N === 5 && sixesConfig.shadowOf?.[si] === pi;
                                return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginLeft: 4 }}>
                                  {names[pi]?.slice(0,5) || `P${pi+1}`}
                                  {isShadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2 }}>+{(names[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                                </span>;
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </>
              );
            })()}
            {/* ── MATCHUPS ── */}
            <div style={{ borderTop: "2px solid var(--border)", marginBottom: 12, marginTop: 4 }} />
            <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, fontWeight: "700", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>MATCHUPS</div>
            {/* Matchup toggle */}
            {canMatchup && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: matchupBets.on ? 12 : 0 }}>
                  <button onClick={() => setMatchupBets(n => ({ ...n, on: !n.on }))}
                    style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                      border: `1px solid ${matchupBets.on?"var(--accent)":"var(--border)"}`,
                      background: matchupBets.on ? (isLight ? "#000" : "var(--accent)") : "transparent",
                      color: matchupBets.on ? "#fff" : "var(--text)",
                      fontSize: 16, fontWeight: "700" }}>
                    {matchupBets.on ? "✓" : "—"}
                  </button>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Matchup (Nassau / GDB / Match Play / Stroke Play)</span>
                </div>
                {/* Matchup config */}
                {matchupBets.on && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 2, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>MATCHUPS</div>
                    {matchupBets.matchups.map((m, mi) => (
                      <div key={mi} style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, fontFamily: "'DM Sans', sans-serif" }}>MATCH {mi + 1}</span>
                          {matchupBets.matchups.length > 1 && (
                            <button onClick={() => setMatchupBets(n => ({ ...n, matchups: n.matchups.filter((_,i) => i !== mi) }))}
                              style={{ background: "transparent", border: "1px solid var(--neg)", borderRadius: 6, color: "var(--neg)", cursor: "pointer", fontSize: 12, padding: "3px 10px", fontFamily: "'DM Sans', sans-serif" }}>
                              Remove
                            </button>
                          )}
                        </div>
                        {/* Type toggle */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                          {[["nassau","Nassau"],["gdb","GDB"],["matchplay","Match Play"],["stroke","Stroke Play"]].map(([val,label]) => (
                            <button key={val} onClick={() => setMatchupBets(n => {
                              const ms=n.matchups.map(x=>({...x}));
                              const cur = ms[mi];
                              const prev = cur.type || "nassau";
                              if (prev === val) return n; // no-op
                              // Save current stake under its previous type's slot
                              const stakeKey = "stake_" + prev;
                              cur[stakeKey] = cur.stake;
                              cur.type = val;
                              // Restore stake for new type — use saved value if any, else default
                              const newStakeKey = "stake_" + val;
                              const defaultStake = val === "matchplay" ? 10 : 5;
                              cur.stake = (cur[newStakeKey] != null) ? cur[newStakeKey] : defaultStake;
                              // Per-type units defaults (only swap if user still has the corresponding default)
                              const curUnits = (cur.units||[1,1,2]).join(",");
                              if (val === "stroke" && prev !== "stroke") {
                                if (curUnits === "1,1,2") cur.units = [0, 0, 1];
                              } else if (prev === "stroke" && val !== "stroke" && val !== "matchplay") {
                                if (curUnits === "0,0,1") cur.units = [1, 1, 2];
                              } else if (val === "matchplay" && prev !== "matchplay") {
                                if (curUnits === "1,1,2") cur.units = [0, 0, 1];
                              } else if (prev === "matchplay" && val !== "matchplay" && val !== "stroke") {
                                if (curUnits === "0,0,1") cur.units = [1, 1, 2];
                              }
                              return { ...n, matchups: ms };
                            })}
                              style={{ flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: "700",
                                border: `1px solid ${(m.type||"nassau")===val?"var(--accent)":"var(--border)"}`,
                                background: (m.type||"nassau")===val ? (isLight ? "#000" : "var(--accent)") : "transparent",
                                color: (m.type||"nassau")===val ? "#fff" : "var(--text)",
                                fontFamily: "'DM Sans', sans-serif" }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {/* Player pair */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <select value={m.p1} style={{ ...S.sel, flex: 1 }}
                            onChange={e => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].p1=Number(e.target.value); return { ...n, matchups: ms }; })}>
                            {Array.from({length:playerCount},(_,i) => <option key={i} value={i}>{names[i]||`P${i+1}`}</option>)}
                          </select>
                          <span style={{ color: "var(--muted)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>vs</span>
                          <select value={m.p2} style={{ ...S.sel, flex: 1 }}
                            onChange={e => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].p2=Number(e.target.value); return { ...n, matchups: ms }; })}>
                            {Array.from({length:playerCount},(_,i) => <option key={i} value={i}>{names[i]||`P${i+1}`}</option>)}
                          </select>
                        </div>
                        {/* Strokes */}
                        {(() => {
                          const giverF = m.strokesFront >= 0 ? m.p1 : m.p2;
                          const receiverF = m.strokesFront >= 0 ? m.p2 : m.p1;
                          const giverB = m.strokesBack >= 0 ? m.p1 : m.p2;
                          const receiverB = m.strokesBack >= 0 ? m.p2 : m.p1;
                          return (
                            <div style={{ marginBottom: 10 }}>
                              {[["FRONT","strokesFront",giverF,receiverF],["BACK","strokesBack",giverB,receiverB]].map(([label, field, giver, receiver]) => (
                                <div key={field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                  <div>
                                    <div style={{ fontSize: 10, color: "var(--text)", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                                    <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                                      {m[field] === 0 ? "Scratch"
                                        : <><span style={{ color: isLight?COLORS_LIGHT[giver]:COLORS[giver], fontWeight:"600" }}>{names[giver]||`P${giver+1}`}</span> gives <span style={{ color: isLight?COLORS_LIGHT[receiver]:COLORS[receiver], fontWeight:"600" }}>{names[receiver]||`P${receiver+1}`}</span> {Math.abs(m[field])} stroke{Math.abs(m[field])!==1?"s":""}</>
                                      }
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                                    <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi][field]-=1; return { ...n, matchups: ms }; })} style={S.pmBtnInline}>−</button>
                                    <span style={{ width: 30, textAlign: "center", color: "var(--accent)", fontSize: 16, fontWeight: "700" }}>{Math.abs(m[field])}</span>
                                    <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi][field]+=1; return { ...n, matchups: ms }; })} style={S.pmBtnInline}>+</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {/* Stake */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Stake</span>
                            <div style={{ fontSize: 10, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                              {(m.type||"nassau")==="nassau" ? `F=${(m.units||[1,1,2])[0]}× B=${(m.units||[1,1,2])[1]}× Overall=${(m.units||[1,1,2])[2]}×` : (m.type)==="gdb" ? `Game 3× · Dormie 1× · Bye 1×` : (m.type)==="stroke" ? `Net stroke diff × stake/stroke · ${(m.units||[0,0,1]).join(":")}` : `Net holes won × stake/hole · ${(m.units||[0,0,1]).join(":")}`}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                            <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].stake=Math.max(1,ms[mi].stake-1); return { ...n, matchups: ms }; })} style={S.pmBtnInline}>−</button>
                            <span style={{ width: 38, textAlign: "center", color: "var(--accent)", fontSize: 16, fontWeight: "700" }}>${m.stake}</span>
                            <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].stake+=1; return { ...n, matchups: ms }; })} style={S.pmBtnInline}>+</button>
                          </div>
                        </div>
                        {/* Units ratio — Nassau, Match Play, Stroke Play */}
                        {((m.type||"nassau") === "nassau" || (m.type||"nassau") === "stroke" || (m.type||"nassau") === "matchplay") && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Units ratio</span>
                              <span style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                                {(m.units||[1,1,2]).join(" : ")}{(m.type||"nassau") === "nassau" && ` · max $${(m.units||[1,1,2]).reduce((s,u)=>s+u,0) * m.stake}`}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              {["F","B","18"].map((label, ui) => (
                                <div key={ui} style={{ flex: 1, textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: "var(--text)", marginBottom: 4, letterSpacing: 1, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                                  <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                                    <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x,units:[...(x.units||[1,1,2])]})); ms[mi].units[ui]=Math.max(0,ms[mi].units[ui]-1); return { ...n, matchups: ms }; })} style={S.pmBtnInline}>−</button>
                                    <span style={{ width: 28, textAlign: "center", color: (m.units||[1,1,2])[ui]===0?"var(--dim)":"var(--accent)", fontSize: 16, fontWeight: "700" }}>{(m.units||[1,1,2])[ui]}</span>
                                    <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x,units:[...(x.units||[1,1,2])]})); ms[mi].units[ui]+=1; return { ...n, matchups: ms }; })} style={S.pmBtnInline}>+</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* GDB info */}
                        {(m.type||"nassau") === "gdb" && (
                          <div style={{ marginBottom: 10, background: "var(--card)", borderRadius: 8, padding: "8px 12px" }}>
                            <span style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                              Game ${m.stake*3} · Dormie ${m.stake} · Bye ${m.stake} · max ${m.stake*5}/9
                            </span>
                          </div>
                        )}
                        {/* Press mode — Nassau and GDB only */}
                        {(m.type||"nassau") !== "matchplay" && (m.type||"nassau") !== "stroke" && (<>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Auto Press</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            {[["off","Off"],["auto","2-Down"],["dormie","Dormie"]].map(([val,label]) => (
                              <button key={val} onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].pressMode=val; return { ...n, matchups: ms }; })}
                                style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                  border: `1px solid ${m.pressMode===val?"var(--accent)":"var(--border)"}`,
                                  background: m.pressMode===val ? (isLight ? "#000" : "var(--accent)") : "transparent",
                                  color: m.pressMode===val ? "#fff" : "var(--text)",
                                  fontFamily: "'DM Sans', sans-serif" }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Press multiplier — only when press is on */}
                        {m.pressMode !== "off" && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>Press stake</span>
                            <div style={{ display: "flex", alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                              <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].pressMult=Math.max(1,(ms[mi].pressMult||1)-1); return { ...n, matchups: ms }; })} style={S.pmBtnInline}>−</button>
                              <span style={{ width: 38, textAlign: "center", color: "var(--accent)", fontSize: 16, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>×{m.pressMult||1}</span>
                              <button className="pm-btn" onClick={() => setMatchupBets(n => { const ms=n.matchups.map(x=>({...x})); ms[mi].pressMult=(ms[mi].pressMult||1)+1; return { ...n, matchups: ms }; })} style={S.pmBtnInline}>+</button>
                            </div>
                          </div>
                        )}
                        </>)}
                      </div>
                    ))}
                    {matchupBets.matchups.length < 6 && (
                      <button onClick={() => setMatchupBets(n => ({
                        ...n, matchups: [...n.matchups, { type:"nassau", p1:0, p2:1, strokesFront:0, strokesBack:0, stake:5, pressMode:"off", pressMult:1, units:[1,1,2] }]
                      }))} style={{ ...S.courseBtn, width: "100%", textAlign: "center", marginTop: 2 }}>
                        + Add Matchup ({matchupBets.matchups.length}/6)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CollapseSect>
          {/* ── Recent Rounds — collapsible ── */}
          {savedRounds.length > 0 && (
            <CollapseSect title={`Recent Rounds (${savedRounds.length})`} open={activeSection==="history"} onToggle={() => setActiveSection(s => s==="history" ? null : "history")}>
              {savedRounds.map((round) => (
                <div key={round.savedAt} style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: "700", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{round.courseName || "Round"}</div>
                      <div style={{ fontSize: 13, color: "var(--text)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{round.date}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => exportRound(round)}
                        style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--accent)", cursor: "pointer", fontSize: 14, fontWeight: "600", fontFamily: "'DM Sans', sans-serif" }}>
                        ↑ Export
                      </button>
                      <button onClick={() => onLoadRound(round)}
                        style={{ padding: "6px 12px", background: COLORS[0]+"22", border: `1px solid var(--accent)`, borderRadius: 6, color: "var(--accent)", cursor: "pointer", fontSize: 14, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>
                        Resume
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${round.config.names.length},1fr)`, gap: 4 }}>
                    {round.config.names.map((name, pi) => {
                      const cfg = round.config;
                      const ss = cfg._savedState;
                      if (!ss) return null;
                      const _NP=ss.liveHcps.length;const vCum=Array(_NP).fill(0),cCum=Array(_NP).fill(0),pCum=Array(_NP).fill(0);
                      const _vp=cfg.vegasPlayers||[0,1,2,3];
                      cfg.holes.forEach((h,hi) => {
                        if (!ss.inPlay[hi]) return;
                        const g=ss.gross[hi];
                        const n=Array.from({length:_NP},(_,p)=>nettScore(g[p],ss.liveHcps[p],h.si,h.par));
                        if(cfg.games.vegas){const vr=computeVegas(ss.vTeams[hi],g,n,h.par);if(vr){ss.vTeams[hi][0].forEach(p=>{vCum[p]+=vr.netA;});ss.vTeams[hi][1].forEach(p=>{vCum[p]+=vr.netB;});}}
                        if(cfg.games.ct){const vpN=_vp.map(p=>n[p]);const ct=computeCutThroat(vpN);_vp.forEach((p,idx)=>cCum[p]+=ct[idx]);}
                        if(cfg.games.p3&&h.par===3){const vpN=_vp.map(p=>n[p]);const vpBi=_vp.indexOf(ss.banker[hi])>=0?_vp.indexOf(ss.banker[hi]):0;const vpM=_vp.map(p=>ss.p3mult[hi]?.[p]||1);const p3=computePar3(vpN,vpBi,vpM);_vp.forEach((p,idx)=>pCum[p]+=p3[idx]);}
                      });
                      const subtotal=(cfg.games.vegas?vCum[pi]*cfg.vegasVal:0)+(cfg.games.ct?cCum[pi]*cfg.ctVal:0)+(cfg.games.p3?pCum[pi]*cfg.p3Val:0)+(ss.adjustments?.[pi]||0);
                      // Nassau
                      let nassauD = 0;
                      if (cfg.nassau?.on && ss.matchups) {
                        ss.matchups.forEach(m => {
                          let net = 0;
                          const type = m.type || "nassau";
                          if (type === "gdb") {
                            const r = computeGDB(m, ss.gross, cfg.holes, ss.inPlay);
                            const dol = gdbDollars(m, r.front, r.back);
                            net = dol.net;
                          } else if (type === "matchplay") {
                            const r = computeNassau(m, ss.gross, cfg.holes, ss.inPlay);
                            net = r.overall.status !== 0 ? (r.overall.status > 0 ? 1 : -1) * m.stake * Math.abs(r.overall.status) : 0;
                          } else if (type === "stroke") {
                            const r = computeStrokePlay(m, ss.gross, cfg.holes, ss.inPlay);
                            net = strokePlayDollars(m, r.front, r.back, r.overall).net;
                          } else {
                            const r = computeNassau(m, ss.gross, cfg.holes, ss.inPlay);
                            const dol = nassauDollars(m, r.front, r.back, r.overall, r.presses);
                            net = dol.net;
                          }
                          if (m.p1 === pi) nassauD += net;
                          if (m.p2 === pi) nassauD -= net;
                        });
                      }
                      const d = subtotal + nassauD;
                      // Relative HCP
                      const minHcp = Math.min(...ss.liveHcps);
                      const relHcp = ss.liveHcps[pi] - minHcp;
                      return (
                        <div key={pi} style={{ textAlign: "center", background: "var(--card)", borderRadius: 6, padding: "6px 4px" }}>
                          <div style={{ fontSize: 13, fontWeight: "700", color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>{name.slice(0,5)}</div>
                          <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>HCP {relHcp}</div>
                          <div style={{ fontSize: 17, fontWeight: "700", color: d>0?(isLight?"#16a34a":COLORS[0]):d<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{d>0?"+":""}{d}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CollapseSect>
          )}
          {/* ── Import ── */}
          {importMsg && <div style={{ background: "var(--card)", border: "1px solid #4ade80", borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: 13, color: "#4ade80" }}>{importMsg}</div>}
          {saveError && <div style={{ background: "#3a0a0a", border: "1px solid var(--neg)", borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: 13, color: "var(--neg)" }}>⚠ {saveError}</div>}
          <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
          <input ref={courseImportRef} type="file" accept=".json,application/json,text/plain,*/*" style={{ display: "none" }} onChange={handleCourseImport} />
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <button onClick={() => importRef.current.click()}
              style={{ ...S.courseBtn, flex: 1, textAlign: "center" }}>
              ↓ Import Round
            </button>
            <button onClick={() => courseImportRef.current.click()}
              style={{ ...S.courseBtn, flex: 1, textAlign: "center" }}>
              ↓ Import Course
            </button>
          </div>
        </div>
      </div>
      {/* Sticky START button */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 16px", background: isLight ? "linear-gradient(0deg, #ffffff 70%, transparent)" : "linear-gradient(0deg, #0a1a0a 70%, transparent)", maxWidth: 480, margin: "0 auto" }}>
        {startError && (
          <div style={{ background: "#3a0a0a", border: "1px solid var(--neg)", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "var(--neg)", fontFamily: "'DM Sans', sans-serif" }}>
            ⚠ {startError}
          </div>
        )}
        <button className="start-btn"
          style={{ ...S.startBtn, fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, padding: "18px", marginBottom: 8 }}
          onClick={() => {
            const siCounts = holes.reduce((acc,h) => { acc[h.si]=(acc[h.si]||0)+1; return acc; }, {});
            const dups = Object.keys(siCounts).filter(si=>siCounts[si]>1).map(Number);
            if (dups.length > 0) {
              setStartError(`Duplicate SI: ${dups.sort((a,b)=>a-b).join(", ")} — fix in Course setup`);
              setTimeout(() => setStartError(""), 3000);
              return;
            }
            setStartError("");
            onStart({
              names: names.slice(0, playerCount).map((n,i) => n.trim()||`P${i+1}`),
              hcps: hcps.slice(0, playerCount),
              playerCount,
              vegasPlayers: playerCount >= 4 ? vegasPlayers.filter(i => i < playerCount).slice(0,4) : [0,1,2,3],
              holes, vegasVal, ctVal, p3Val, hcpThreshold, bankerNett, hcpCap, vegasRules, hioRule,
              threeBallVariant, hzBonus,
              capPar3, capOther,
              games: {
                vegas: canVegas && games.vegas,
                ct: canCT && games.ct,
                p3: canP3 && games.p3,
                pts: canPts && games.pts,
                sixes: canSixes && games.sixes,
              },
              nassau: matchupBets,
              sixesConfig,
              ptsVal,
              groupCode,
              courseName: loadedCourse ? `${loadedCourse.name}${loadedCourse.tee && loadedCourse.tee !== "—" ? " — " + loadedCourse.tee : ""}` : "Custom Course",
              _savedScores: savedScores || null,
              _roundId: sc?._roundId || null,
            });
            window.scrollTo(0, 0);
          }}>
          START ROUND →
        </button>
      </div>
    </div>
  );
}

// QR CODE — uses qrcode-generator (supports up to version 40, handles large payloads)
const QR_CDN = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
function QRCodeDisplay({ payload, size = 300 }) {
  const divRef = React.useRef(null);
  const [err, setErr] = React.useState(null);
  const [loaded, setLoaded] = React.useState(!!window.qrcode);
  React.useEffect(() => {
    if (window.qrcode) { setLoaded(true); return; }
    const existing = document.querySelector(`script[src="${QR_CDN}"]`);
    if (existing) { existing.addEventListener('load', () => setLoaded(true)); return; }
    const s = document.createElement('script');
    s.src = QR_CDN;
    s.onload = () => setLoaded(true);
    s.onerror = () => setErr('QR library unavailable');
    document.head.appendChild(s);
  }, []);
  React.useEffect(() => {
    if (!loaded || !payload || !divRef.current) return;
    divRef.current.innerHTML = '';
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      const moduleCount = qr.getModuleCount();
      const cellSize = Math.max(4, Math.floor(size / (moduleCount + 8)));
      divRef.current.innerHTML = qr.createImgTag(cellSize, 4);
    } catch(e) { setErr('QR error: ' + e.message); }
  }, [loaded, payload, size]);
  if (err) return <div style={{color:'var(--neg)',fontSize:12,padding:8}}>{err}</div>;
  if (!loaded) return <div style={{color:'var(--dim)',fontSize:12,padding:8}}>Loading QR...</div>;
  return (
    <div style={{display:'inline-block',background:'#fff',padding:8,borderRadius:8}}>
      <div ref={divRef}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR PAYLOAD DECODER (for Verify modal — inverse of buildQRPayload)
// ─────────────────────────────────────────────────────────────────────────────
function decodeQRPayload(str) {
  try {
    const clean = str.trim();
    const parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.ho || !parsed.sf || !parsed.p) return null;
    const N = parsed.p.length;
    const holes = [];
    for (let i = 0; i < 36; i += 2) holes.push({ par: parsed.ho[i], si: parsed.ho[i+1] });
    const scores = [];
    for (let h = 0; h < 18; h++) scores.push(parsed.sf.slice(h*N, h*N+N));
    const inPlay = [];
    for (let j = 0; j < 18; j++) inPlay.push(!!(parsed.ip & (1<<j)));
    const vt = Array.isArray(parsed.vt) && parsed.vt.length > 0 ? parsed.vt : null;
    return {
      v: parsed.v,
      courseName: parsed.c,
      date: parsed.d,
      names: parsed.p,
      hcps: parsed.h || [],
      holes,
      scores,
      inPlay,
      vTeams: vt,
      games: parsed.g || {},
      stakes: parsed.st || {},
      dollars: parsed.dl || [],
      firstNine: parsed.fn || "F",
      matchup: parsed.matchup || parsed.nassau || [],
    };
  } catch(e) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER MATCHING — fuzzy name + score similarity
// ─────────────────────────────────────────────────────────────────────────────
function normalizeName(s) {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}
function initialsOf(name) {
  const norm = normalizeName(name);
  if (!norm) return "";
  // If single word, take first 2 chars; if multi, first letter of each word
  const parts = norm.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts.map(p => p[0]).join("");
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) m[i][j] = m[i-1][j-1];
      else m[i][j] = Math.min(m[i-1][j-1] + 1, m[i][j-1] + 1, m[i-1][j] + 1);
    }
  }
  return m[b.length][a.length];
}
function fuzzyNameScore(a, b) {
  if (!a || !b) return 0;
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  // Substring
  if (na.length >= 2 && nb.length >= 2) {
    if (na.includes(nb) || nb.includes(na)) return 0.85;
  }
  // Initials match
  const ia = initialsOf(a), ib = initialsOf(b);
  if (ia.length >= 2 && ib.length >= 2 && (ia === ib || ia === nb || ib === na)) return 0.75;
  // Compare initials of one to other (e.g. "VW" vs "Vince Wong")
  if (ia === nb || ib === na) return 0.75;
  // Levenshtein ratio
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const ratio = 1 - dist / maxLen;
  if (ratio >= 0.5) return Math.min(0.7, ratio);
  // Same first letter
  if (na[0] === nb[0]) return 0.3;
  return 0;
}
function fuzzyScoreMatch(scoresA, scoresB, inPlayA, inPlayB) {
  let played = 0, diffs = 0;
  for (let h = 0; h < 18; h++) {
    if (!inPlayA[h] || !inPlayB[h]) continue;
    played++;
    if (scoresA[h] !== scoresB[h]) diffs++;
  }
  if (played === 0) return null;
  return (played - diffs) / played;
}
// Returns combined score 0..1, weight adapts to holes played
function combinedScore(nameSim, scoreSim, holesPlayed) {
  if (scoreSim === null || holesPlayed < 2) return nameSim;
  const wScore = Math.min(0.8, 0.2 + holesPlayed * 0.06); // ramps 0.2 → 0.8 over 10 holes
  const wName = 1 - wScore;
  return wName * nameSim + wScore * scoreSim;
}
// Find best 1-to-1 assignment via brute force (N! permutations, fine for N<=6)
function bestAssignment(local, scanned) {
  const localPlayers = (local.names || []).map((name, i) => ({
    idx: i,
    name,
    scores: (local.scores || []).map(row => row?.[i] ?? 0),
  }));
  const scannedPlayers = (scanned.names || []).map((name, i) => ({
    idx: i,
    name,
    scores: (scanned.scores || []).map(row => row?.[i] ?? 0),
  }));
  const N_local = localPlayers.length;
  const N_scanned = scannedPlayers.length;
  // Build score matrix: combined[i][j] = score of matching localPlayers[i] to scannedPlayers[j]
  const matrix = [];
  const sharedHoles = (local.inPlay || []).reduce((acc, v, i) => acc + (v && (scanned.inPlay || [])[i] ? 1 : 0), 0);
  for (let i = 0; i < N_local; i++) {
    matrix[i] = [];
    for (let j = 0; j < N_scanned; j++) {
      const nameSim = fuzzyNameScore(localPlayers[i].name, scannedPlayers[j].name);
      const scoreSim = fuzzyScoreMatch(localPlayers[i].scores, scannedPlayers[j].scores, local.inPlay, scanned.inPlay);
      matrix[i][j] = combinedScore(nameSim, scoreSim, sharedHoles);
    }
  }
  // Brute-force permutations of scanned indices for assignment
  const N = Math.max(N_local, N_scanned);
  const indices = Array.from({ length: N_scanned }, (_, k) => k);
  function* permutations(arr) {
    if (arr.length <= 1) { yield arr; return; }
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const p of permutations(rest)) yield [arr[i], ...p];
    }
  }
  let best = { perm: null, total: -1, perPair: [] };
  // For each ordering of scanned players
  for (const perm of permutations(indices)) {
    let total = 0;
    const perPair = [];
    for (let i = 0; i < Math.min(N_local, perm.length); i++) {
      const j = perm[i];
      const score = matrix[i][j];
      total += score;
      perPair.push({ localIdx: i, scannedIdx: j, score });
    }
    if (total > best.total) best = { perm, total, perPair };
  }
  // Calculate confidence: min individual score among matched pairs
  const matched = best.perPair.filter(p => p.score > 0);
  const minScore = matched.length > 0 ? Math.min(...matched.map(p => p.score)) : 0;
  const avgScore = matched.length > 0 ? best.total / matched.length : 0;
  // Build mapping: { localName: scannedName }
  const mapping = {};
  best.perPair.forEach(p => {
    if (p.score > 0.5) {
      mapping[localPlayers[p.localIdx].name] = scannedPlayers[p.scannedIdx].name;
    }
  });
  return {
    mapping,
    perPair: best.perPair.map(p => ({
      localName: localPlayers[p.localIdx].name,
      scannedName: scannedPlayers[p.scannedIdx]?.name || null,
      score: p.score,
    })),
    minScore,
    avgScore,
    sharedHoles,
    confidence: minScore >= 0.8 ? "high" : minScore >= 0.5 ? "medium" : "low",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARE TWO ROUND PAYLOADS — returns array of {label, ok, detail}
// Takes an explicit name mapping: { localName -> scannedName }
// ─────────────────────────────────────────────────────────────────────────────
function compareRounds(local, scanned, mapping) {
  const checks = [];
  // Course (compare SI sequences for first 4 holes)
  const localSI = (local.holes || []).slice(0, 4).map(h => h.si).join(",");
  const scannedSI = (scanned.holes || []).slice(0, 4).map(h => h.si).join(",");
  checks.push({
    label: "Course",
    ok: localSI === scannedSI,
    detail: localSI === scannedSI ? local.courseName : `You: ${local.courseName} (${localSI})\nThem: ${scanned.courseName} (${scannedSI})`,
  });

  // Players — based on mapping
  const localNames = local.names || [];
  const scannedNames = scanned.names || [];
  const mappedLocal = Object.keys(mapping || {});
  const mappedScanned = Object.values(mapping || {});
  const unmappedLocal = localNames.filter(n => !mappedLocal.includes(n));
  const unmappedScanned = scannedNames.filter(n => !mappedScanned.includes(n));
  const playersOk = unmappedLocal.length === 0 && unmappedScanned.length === 0;
  let playerDetail;
  if (mappedLocal.length === 0) {
    playerDetail = "No matching players found.";
  } else if (playersOk) {
    playerDetail = mappedLocal.map(n => mapping[n] === n ? n : `${n} ↔ ${mapping[n]}`).join(", ");
  } else {
    const lines = [];
    lines.push("Matched: " + (mappedLocal.length > 0 ? mappedLocal.map(n => mapping[n] === n ? n : `${n}↔${mapping[n]}`).join(", ") : "none"));
    if (unmappedLocal.length) lines.push(`Only on you: ${unmappedLocal.join(", ")}`);
    if (unmappedScanned.length) lines.push(`Only on them: ${unmappedScanned.join(", ")}`);
    playerDetail = lines.join("\n");
  }
  checks.push({ label: "Players", ok: playersOk, detail: playerDetail });

  // Build name → index maps
  const localIdx = {}; localNames.forEach((n, i) => { localIdx[n] = i; });
  const scannedIdx = {}; scannedNames.forEach((n, i) => { scannedIdx[n] = i; });

  // In-play holes
  const ipDiff = [];
  for (let i = 0; i < 18; i++) {
    if (!!local.inPlay[i] !== !!scanned.inPlay[i]) ipDiff.push(i + 1);
  }
  checks.push({
    label: "Holes In Play",
    ok: ipDiff.length === 0,
    detail: ipDiff.length === 0
      ? `${local.inPlay.filter(Boolean).length} of 18 in play`
      : `Differ at hole(s): ${ipDiff.join(", ")}`,
  });

  // Gross scores — compare hole by hole, only mapped players, only where both have inPlay
  const scoreDiffs = [];
  for (let h = 0; h < 18; h++) {
    if (!local.inPlay[h] || !scanned.inPlay[h]) continue;
    mappedLocal.forEach(localName => {
      const scannedName = mapping[localName];
      const ai = localIdx[localName];
      const bi = scannedIdx[scannedName];
      const a = local.scores[h]?.[ai];
      const b = scanned.scores[h]?.[bi];
      if (a !== b) {
        const label = localName === scannedName ? localName : `${localName}↔${scannedName}`;
        scoreDiffs.push(`H${h+1} ${label}: you ${a}, them ${b}`);
      }
    });
  }
  checks.push({
    label: "Scores",
    ok: scoreDiffs.length === 0,
    detail: scoreDiffs.length === 0
      ? (mappedLocal.length > 0 ? `All in-play scores match` : "No matched players to compare")
      : scoreDiffs.slice(0, 8).join("\n") + (scoreDiffs.length > 8 ? `\n…+${scoreDiffs.length - 8} more` : ""),
  });

  // Final $
  const dollarDiffs = [];
  mappedLocal.forEach(localName => {
    const scannedName = mapping[localName];
    const ai = localIdx[localName];
    const bi = scannedIdx[scannedName];
    const a = (local.dollars || [])[ai];
    const b = (scanned.dollars || [])[bi];
    if (a !== b) {
      const label = localName === scannedName ? localName : `${localName}↔${scannedName}`;
      dollarDiffs.push(`${label}: you ${a >= 0 ? "+" : ""}${a}, them ${b >= 0 ? "+" : ""}${b}`);
    }
  });
  checks.push({
    label: "Final $",
    ok: dollarDiffs.length === 0,
    detail: dollarDiffs.length === 0
      ? (mappedLocal.length > 0
          ? mappedLocal.map(n => `${n} ${((local.dollars || [])[localIdx[n]] >= 0 ? "+" : "")}${(local.dollars || [])[localIdx[n]]}`).join(" · ")
          : "No matched players to compare")
      : dollarDiffs.join("\n"),
  });

  return checks;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY MODAL — paste/upload another phone's payload and compare
// ─────────────────────────────────────────────────────────────────────────────
function VerifyModal({ localPayload, roundId, onClose, isLight }) {
  const [pasted, setPasted] = React.useState("");
  const [scanned, setScanned] = React.useState(null);  // decoded scanned payload
  const [matchInfo, setMatchInfo] = React.useState(null); // result of bestAssignment
  const [confirmedMapping, setConfirmedMapping] = React.useState(null); // user-confirmed name mapping
  const [comparison, setComparison] = React.useState(null);
  const [error, setError] = React.useState("");
  const fileRef = React.useRef(null);

  const localDecoded = React.useMemo(() => decodeQRPayload(localPayload), [localPayload]);

  function processPayload(payloadStr) {
    setError("");
    const decoded = decodeQRPayload(payloadStr);
    if (!decoded) { setError("Could not decode payload. Check format."); return; }
    if (!localDecoded) { setError("Local payload invalid."); return; }
    // SANITY CHECKS — stop if scanned QR looks fundamentally different
    // 1. Course check (SI sequence over first 4 holes)
    const localSI = (localDecoded.holes || []).slice(0, 4).map(h => h.si).join(",");
    const scannedSI = (decoded.holes || []).slice(0, 4).map(h => h.si).join(",");
    if (localSI && scannedSI && localSI !== scannedSI) {
      setError(`Different course detected.\nYou: ${localDecoded.courseName} (SI ${localSI})\nThem: ${decoded.courseName} (SI ${scannedSI})\n\nThis QR appears to be from a different round.`);
      return;
    }
    // 2. Date check — warn if dates differ (but allow continue)
    if (localDecoded.date && decoded.date && localDecoded.date !== decoded.date) {
      const fmt = d => d ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : "?";
      setError(`Date mismatch — likely a different round.\nYou: ${fmt(localDecoded.date)}\nThem: ${fmt(decoded.date)}\n\nThis QR appears to be from a different round.`);
      return;
    }
    // 3. Player overlap check — try matching, abort if no plausible matches
    const match = bestAssignment(localDecoded, decoded);
    const anyPlausible = match.perPair.some(p => p.score >= 0.3);
    if (!anyPlausible) {
      setError(`No matching players found between the two rounds.\nYou: ${(localDecoded.names || []).join(", ")}\nThem: ${(decoded.names || []).join(", ")}\n\nThis QR appears to be from a different group.`);
      return;
    }
    // Cache key incorporates scanned names so different other-phones get fresh matching
    const scannedNamesKey = (decoded.names || []).join("|");
    const cacheKey = `tb_verify_matches:${roundId}:${scannedNamesKey}`;
    let cachedMapping = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cachedMapping = JSON.parse(raw);
    } catch(_) {}
    setScanned(decoded);
    setMatchInfo(match);
    // Validate cached mapping — every value in mapping must exist in scanned names
    let cacheValid = false;
    if (cachedMapping && Object.keys(cachedMapping).length > 0) {
      const scannedSet = new Set(decoded.names || []);
      cacheValid = Object.values(cachedMapping).every(v => scannedSet.has(v));
    }
    // If cached and valid → use it
    if (cacheValid) {
      setConfirmedMapping(cachedMapping);
      setComparison(compareRounds(localDecoded, decoded, cachedMapping));
    } else if (match.confidence === "high") {
      // High confidence → auto-apply
      setConfirmedMapping(match.mapping);
      setComparison(compareRounds(localDecoded, decoded, match.mapping));
      try { localStorage.setItem(cacheKey, JSON.stringify(match.mapping)); } catch(_) {}
    }
    // Otherwise: matchInfo is set, render shows match-confirm UI
  }

  function applyConfirmedMapping(mapping) {
    setConfirmedMapping(mapping);
    setComparison(compareRounds(localDecoded, scanned, mapping));
    // Cache it (keyed by roundId + scanned names)
    const scannedNamesKey = (scanned.names || []).join("|");
    const cacheKey = `tb_verify_matches:${roundId}:${scannedNamesKey}`;
    try { localStorage.setItem(cacheKey, JSON.stringify(mapping)); } catch(_) {}
  }

  function rematch() {
    // Clear cache for current scanned, return to match-confirm UI
    if (scanned) {
      const scannedNamesKey = (scanned.names || []).join("|");
      const cacheKey = `tb_verify_matches:${roundId}:${scannedNamesKey}`;
      try { localStorage.removeItem(cacheKey); } catch(_) {}
    }
    setConfirmedMapping(null);
    setComparison(null);
  }

  function reset() {
    setScanned(null);
    setMatchInfo(null);
    setConfirmedMapping(null);
    setComparison(null);
    setPasted("");
    setError("");
  }

  async function onPhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("Decoding image…");
    try {
      // Load jsQR if needed
      if (!window.jsQR) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
          s.onload = res;
          s.onerror = () => rej(new Error("Failed to load jsQR library"));
          document.head.appendChild(s);
        });
      }
      // Read file as data URL (more reliable than createObjectURL on iOS)
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = () => rej(new Error("Could not read file: " + (reader.error?.message || "unknown")));
        reader.readAsDataURL(file);
      });
      // Load into Image
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("Could not load image. iOS HEIC photos may not be supported — try a screenshot or PNG/JPG."));
        i.src = dataUrl;
      });
      if (!img.naturalWidth || !img.naturalHeight) {
        throw new Error("Image has zero dimensions");
      }
      // Limit canvas size to avoid memory issues on big iOS photos
      const MAX_DIM = 2000;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = MAX_DIM / Math.max(w, h);
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      if (!code || !code.data) {
        setError("No QR code found in image. Try a clearer photo, or paste the payload text instead.");
        return;
      }
      setPasted(code.data);
      processPayload(code.data);
    } catch(err) {
      const msg = err?.message || (typeof err === "string" ? err : JSON.stringify(err)) || "unknown error";
      setError("Image decode error: " + msg);
    }
  }

  // STAGE: input (paste/upload) | match-confirm | comparison
  let stage = "input";
  if (comparison) stage = "comparison";
  else if (matchInfo && !confirmedMapping) stage = "match-confirm";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
        maxWidth: 520, width: "100%", maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* Fixed header */}
        <div style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Verify ↔</div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "var(--text)", fontSize: 22, cursor: "pointer", padding: 0
          }}>×</button>
        </div>

        {/* Scrollable middle */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {stage === "input" && (
            <>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>
                Paste another phone's payload below, or upload a photo of their QR.
              </div>
              <button onClick={() => fileRef.current?.click()} style={{
                width: "100%", padding: "12px", marginBottom: 10, fontSize: 14,
                borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)",
                color: "var(--text)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>📷 Upload QR photo</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoSelected}/>

              <div style={{ fontSize: 11, color: "var(--text)", letterSpacing: 1, marginBottom: 4 }}>OR PASTE PAYLOAD</div>
              <textarea
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                placeholder='{"v":"1","c":"...","p":[...],...}'
                style={{
                  width: "100%", padding: 10, fontSize: 16, borderRadius: 6, fontFamily: "monospace",
                  background: "var(--input)", border: "1px solid var(--border)", color: "var(--text)",
                  boxSizing: "border-box", minHeight: 90, resize: "vertical",
                }}/>
              <button onClick={() => processPayload(pasted)} disabled={!pasted.trim()} style={{
                width: "100%", padding: "10px", marginTop: 8, fontSize: 14, fontWeight: 700,
                borderRadius: 6, border: "1px solid var(--text)", background: "var(--text)", color: "var(--bg)",
                cursor: pasted.trim() ? "pointer" : "default", opacity: pasted.trim() ? 1 : 0.4,
                fontFamily: "'DM Sans', sans-serif",
              }}>Compare</button>
              {error && (
                <div style={{ marginTop: 12, padding: 10, fontSize: 12, color: "#f87171",
                  background: "var(--card)", border: "1px solid #5a2a2a", borderRadius: 6 }}>{error}</div>
              )}
            </>
          )}

          {stage === "match-confirm" && (
            <MatchConfirm
              local={localDecoded}
              scanned={scanned}
              matchInfo={matchInfo}
              onConfirm={applyConfirmedMapping}
              onCancel={reset}
            />
          )}

          {stage === "comparison" && (
            <>
              {confirmedMapping && Object.keys(confirmedMapping).length > 0 && (
                <div style={{ marginBottom: 12, padding: 10,
                  background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>Player matches</div>
                    <button onClick={rematch} style={{
                      padding: "3px 8px", fontSize: 10,
                      borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text)",
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}>Re-match</button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text)" }}>{Object.entries(confirmedMapping).map(([k, v]) => k === v ? k : `${k} ↔ ${v}`).join(" · ")}</div>
                </div>
              )}
              {comparison.map((c, i) => (
                <div key={i} style={{
                  background: "var(--card)",
                  border: `1px solid ${c.ok ? "var(--accent)" : "#5a2a2a"}`,
                  borderRadius: 8, padding: 12, marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18, color: c.ok ? "var(--accent)" : "#f87171" }}>
                      {c.ok ? "✓" : "✗"}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text)", whiteSpace: "pre-wrap", paddingLeft: 26 }}>
                    {c.detail}
                  </div>
                </div>
              ))}
              <button onClick={reset} style={{
                width: "100%", padding: "10px", marginTop: 8, fontSize: 13,
                borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text)",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Compare another</button>
            </>
          )}
        </div>

        {/* Fixed footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{
            width: "100%", padding: "10px 0", borderRadius: 6, fontSize: 13, cursor: "pointer",
            border: "1px solid var(--text)", background: "var(--text)", color: "var(--bg)", fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH CONFIRM UI — shown when auto-matching needs human verification
// ─────────────────────────────────────────────────────────────────────────────
function MatchConfirm({ local, scanned, matchInfo, onConfirm, onCancel }) {
  // Pre-fill confident pairs (score >= 0.8), require manual for the rest
  const initialMapping = {};
  matchInfo.perPair.forEach(p => {
    if (p.score >= 0.8) initialMapping[p.localName] = p.scannedName;
  });
  const [mapping, setMapping] = React.useState(initialMapping);

  const localNames = local.names || [];
  const scannedNames = scanned.names || [];
  const usedScanned = new Set(Object.values(mapping));
  const allMapped = localNames.every(n => mapping[n]);

  function setMatch(localName, scannedName) {
    setMapping(m => {
      const next = { ...m };
      // If this scannedName was already mapped to another local, clear that
      Object.keys(next).forEach(k => { if (next[k] === scannedName) delete next[k]; });
      if (scannedName === null) delete next[localName];
      else next[localName] = scannedName;
      return next;
    });
  }

  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>
        Match the players. {matchInfo.sharedHoles > 0 ? `Auto-suggestions based on names + ${matchInfo.sharedHoles} holes of scores.` : "Auto-suggestions based on names."}
      </div>

      {localNames.map(localName => {
        const currentMatch = mapping[localName];
        const suggestion = matchInfo.perPair.find(p => p.localName === localName);
        const score = suggestion?.score || 0;
        const confidence = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";
        return (
          <div key={localName} style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
            padding: 12, marginBottom: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1 }}>{localName}</span>
              <span style={{ fontSize: 16, color: "var(--text)" }}>↔</span>
              <span style={{ fontSize: 13, color: currentMatch ? "var(--text)" : "var(--dim)", fontStyle: currentMatch ? "normal" : "italic", flex: 1, textAlign: "right" }}>
                {currentMatch || "—"}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {scannedNames.map(scannedName => {
                const isCurrent = currentMatch === scannedName;
                const isUsedElsewhere = !isCurrent && usedScanned.has(scannedName);
                const isSuggested = suggestion?.scannedName === scannedName && score >= 0.5;
                return (
                  <button key={scannedName} onClick={() => setMatch(localName, isCurrent ? null : scannedName)}
                    disabled={isUsedElsewhere}
                    style={{
                      fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: isUsedElsewhere ? "default" : "pointer",
                      border: `1px solid ${isCurrent ? "var(--accent)" : isSuggested ? "var(--border2)" : "var(--border)"}`,
                      background: isCurrent ? "var(--accent)" : "transparent",
                      color: isCurrent ? "#0a1a0a" : "var(--text)",
                      fontWeight: isCurrent ? 700 : 500,
                      opacity: isUsedElsewhere ? 0.3 : 1,
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                    {isSuggested && !isCurrent && "✨ "}{scannedName}
                  </button>
                );
              })}
              <button onClick={() => setMatch(localName, null)} style={{
                fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                border: "1px dashed var(--border)", background: "transparent", color: "var(--dim)",
                fontFamily: "'DM Sans', sans-serif",
              }}>none</button>
            </div>
          </div>
        );
      })}

      <button onClick={() => onConfirm(mapping)} style={{
        width: "100%", padding: "10px", marginTop: 8, fontSize: 14, fontWeight: 700,
        borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent)", color: "#0a1a0a",
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
      }}>Compare with {Object.keys(mapping).length}/{localNames.length} matched</button>

      <button onClick={onCancel} style={{
        width: "100%", padding: "8px", marginTop: 6, fontSize: 12,
        borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text)",
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
      }}>Back</button>
    </>
  );
}

// Ticker scroller — renders N copies of content as one long string, animates
// linearly from start to end (no looping), fires onComplete when done.
// This avoids any seamless-wrap concerns since there's literally one continuous scroll.
function TickerScroller({ items, passes = 5, onComplete, renderItem }) {
  const ref = React.useRef(null);
  const [duration, setDuration] = React.useState(15);
  const [distancePx, setDistancePx] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    function measure() {
      const totalWidth = ref.current.scrollWidth;
      const PX_PER_SEC = 95;
      const sec = Math.max(8, totalWidth / PX_PER_SEC);
      setDuration(sec);
      setDistancePx(totalWidth);
    }
    measure();
    const t = setTimeout(measure, 200);
    return () => clearTimeout(t);
  }, [items, passes]);
  // Build the content array: items repeated N times with separator between passes
  const allEntries = [];
  for (let p = 0; p < passes; p++) {
    items.forEach((item, i) => {
      allEntries.push({ item, key: `p${p}-${i}-${item.id || item.name}` });
    });
    // Separator between passes (skip after last pass)
    if (p < passes - 1) {
      allEntries.push({ separator: true, key: `sep-${p}` });
    }
  }
  return (
    <div
      ref={ref}
      onAnimationEnd={onComplete}
      style={{
        display: "flex", alignItems: "center", gap: 24, whiteSpace: "nowrap",
        height: "100%", width: "max-content",
        animation: distancePx > 0 ? `tickerScroll ${duration}s linear forwards` : "none",
        ["--ticker-distance"]: `${distancePx}px`,
        willChange: "transform",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {allEntries.map(entry =>
        entry.separator ? (
          <span key={entry.key} style={{ display: "inline-flex", alignItems: "center", gap: 14, fontSize: 14, color: "#16a34a", fontWeight: 700, opacity: 0.7 }}>
            <span>•</span><span>•</span><span>•</span>
          </span>
        ) : (
          renderItem(entry.item, entry.key)
        )
      )}
    </div>
  );
}

// SCORECARD
function Scorecard({ config, onBack, onSave, isLight, toggleTheme, isSuperuser }) {
  const { names, hcps, holes, games, bankerNett = true, hcpCap = null, vegasRules = "council", hioRule = true, capPar3 = 3, capOther = 4 } = config;
  const [vegasVal, setVegasVal] = useState(config.vegasVal ?? 1);
  const [ctVal, setCtVal] = useState(config.ctVal ?? 3);
  const [p3Val, setP3Val] = useState(config.p3Val ?? 5);
  const [ptsVal] = useState(config.ptsVal !== undefined ? config.ptsVal : 0);
  const [hcpThreshold, setHcpThreshold] = useState(config.hcpThreshold ?? 25);
  const saved = config._savedState;
  const savedScores = config._savedScores; // from mid-round back to setup
  const roundId = React.useRef(config._roundId || Date.now()).current;
  // Lock rounds older than 24h to prevent silent overwrite of historical Supabase data.
  // Superuser bypasses lock. roundId is a Date.now() ms timestamp.
  const isOldRound = (Date.now() - roundId) > 24 * 60 * 60 * 1000;
  const isLocked = isOldRound && !isSuperuser;
  const N = Math.min(config.playerCount || names.length || 4, names.length || 4);
  const players = Array.from({length: N}, (_, i) => i);
  // 3-ball Vegas variants: Hero or Zero (default) or Ghost
  const threeBallVariant = config.threeBallVariant || "hz";
  const hzBonus = config.hzBonus || false;
  const hzEnabled = N === 3 && config.games?.vegas && threeBallVariant === "hz";
  const ghostEnabled = N === 3 && config.games?.vegas && threeBallVariant === "ghost";
  const GHOST_IDX = 3; // index of virtual 4th player
  const [ghostGross, setGhostGross] = useState(() => {
    const savedGhost = savedScores?.ghostGross || config._savedState?.ghostGross;
    if (savedGhost) return savedGhost;
    return Array.from({length: 18}, (_, hi) => String(holes[hi].par + 1)); // default to bogey
  });
  const ghostGrossRef = React.useRef(ghostGross);
  React.useEffect(() => { ghostGrossRef.current = ghostGross; }, [ghostGross]);
  // HZ: per-hole Hero index (0, 1, or 2). Default P1 (idx 0).
  const [hzHero, setHzHero] = useState(() => {
    const savedHZ = savedScores?.hzHero || config._savedState?.hzHero;
    if (savedHZ) return savedHZ;
    return Array(18).fill(0);
  });
  const hzHeroRef = React.useRef(hzHero);
  React.useEffect(() => { hzHeroRef.current = hzHero; }, [hzHero]);
  const vegasPlayers = config.vegasPlayers || [0,1,2,3];
  const vp = ghostEnabled ? [0,1,2,3] : (vegasPlayers || [0,1,2,3]).filter(i => i < N);
  const [gross, setGross] = useState(() => {
    const savedGross = savedScores?.gross || saved?.gross;
    if (savedGross) {
      // Pad each hole's score array to N — new players default to par
      return Array.from({length:18}, (_, hi) => {
        const row = savedGross[hi] ? [...savedGross[hi]] : [];
        while (row.length < N) row.push(String(holes[hi].par));
        return row;
      });
    }
    return Array.from({length:18}, (_, hi) => Array(N).fill(String(holes[hi].par)));
  });
  const [vTeams, setVTeams] = useState(() => {
    const defaultVT = Array.from({length:18}, () => [[vp[0],vp[1]],[vp[2],vp[3]]]);
    const savedVT = savedScores?.vTeams || saved?.vTeams;
    if (!savedVT) return defaultVT;
    // Check all holes: both teams must only contain players in current vp
    const consistent = savedVT.every(ht =>
      [...(ht[0]||[]), ...(ht[1]||[])].every(pi => vp.includes(pi))
    );
    return consistent ? savedVT : defaultVT;
  });
  const [banker, setBanker] = useState(() => {
    if (savedScores?.banker || saved?.banker) return savedScores?.banker || saved?.banker;
    // Default: cycle banker through players in lineup order across par-3 holes
    const par3Holes = holes.map((h, hi) => h.par === 3 ? hi : -1).filter(hi => hi >= 0);
    const initial = Array(18).fill(0);
    const playersForBanker = (config.vegasPlayers || [0,1,2,3]).filter(i => i < N).slice(0, 4);
    const groupSize = playersForBanker.length || N;
    par3Holes.forEach((hi, idx) => {
      const playerIdx = playersForBanker[idx % groupSize] ?? (idx % groupSize);
      initial[hi] = playerIdx;
    });
    return initial;
  });
  const [p3mult, setP3mult] = useState(() => {
    const savedP3 = savedScores?.p3mult || saved?.p3mult;
    if (savedP3) {
      return Array.from({length:18}, (_, hi) => {
        const row = savedP3[hi] ? [...savedP3[hi]] : [];
        while (row.length < N) row.push(1);
        return row;
      });
    }
    return Array.from({length:18}, () => Array(N).fill(1));
  });
  const [holeIdx, setHoleIdx] = useState(0);
  const [inPlay, setInPlay] = useState(() => savedScores?.inPlay || saved?.inPlay || Array(18).fill(false));
  const [roundStartTime, setRoundStartTime] = useState(() => saved?.roundStartTime || null);
  const [liveHcps, setLiveHcps] = useState(() => saved?.liveHcps ? [...saved.liveHcps] : [...hcps]);
  const [liveNames, setLiveNames] = useState(() => saved?.liveNames ? [...saved.liveNames] : [...names]);
  // Helper: get name for a player index (handles Ghost)
  const getName = (pi) => pi === GHOST_IDX && ghostEnabled ? "Ghost" : (liveNames[pi] || `P${pi+1}`);
  const getColor = (pi) => pi === GHOST_IDX && ghostEnabled ? (isLight ? "#666" : "#888") : (isLight ? COLORS_LIGHT[pi] : COLORS[pi]);
  const [view, setView] = useState("hole");
  const [confirmBack, setConfirmBack] = useState(false);
  const [adjustments, setAdjustments] = useState(() => {
    const savedAdj = savedScores?.adjustments || saved?.adjustments;
    if (savedAdj) {
      const padded = [...savedAdj];
      while (padded.length < N) padded.push(0);
      return padded;
    }
    return Array(N).fill(0);
  });
  const [saveMsg, setSaveMsg] = useState("");
  // 9-hole verify prompt — shown once per round when 9 holes go in play
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const verifyPromptShownRef = React.useRef(false);
  const matchupEnabled = !!config.nassau?.on;
  const [matchups, setMatchups] = useState(() =>
    (config.nassau?.matchups || DEFAULT_MATCHUP).map(m => ({ ...m }))
  );
  const [showBackStrokeModal, setShowBackStrokeModal] = useState(false);
  // Refs for stale-closure-safe access inside setScore setTimeout
  const vTeamsRef = React.useRef(vTeams);
  const bankerRef = React.useRef(banker);
  const p3multRef = React.useRef(p3mult);
  const matchupsRef = React.useRef(matchups);
  const liveHcpsRef = React.useRef(liveHcps);
  const adjustmentsRef = React.useRef(adjustments);
  const grossRef = React.useRef(gross);
  const holeIdxRef = React.useRef(holeIdx);
  const inPlayRef = React.useRef(inPlay);
  const [reportHTML, setReportHTML] = useState(null);
  // Swipe support
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const handleTouchStart = useCallback(e => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback(e => {
    if (touchStartX.current === null || view !== "hole") return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Swipe horizontally anywhere on screen to navigate holes
    // Only trigger if horizontal movement is dominant and exceeds 60px threshold
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 60) {
      if (dx < 0 && holeIdx < 17) { haptic("medium"); setHoleIdx(h => { const next = h + 1; if (!inPlay[next]) window.scrollTo(0,0); return next; }); }
      if (dx > 0 && holeIdx > 0) { haptic("medium"); setHoleIdx(h => { const next = h - 1; if (!inPlay[next]) window.scrollTo(0,0); return next; }); }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [view, holeIdx]);
  function triggerBackStrokeModal() {
    setShowBackStrokeModal(true);
  }
  function setScore(hi, pi, val) {
    setGross(prev => {
      const n = prev.map(r => [...r]);
      n[hi][pi] = val;
      return n;
    });
    setInPlay(prev => {
      const n = [...prev];
      n[hi] = true;
      return n;
    });
  }

  // Auto-save whenever gross or inPlay changes
  const isFirstRender = React.useRef(true);
  const saveNow = React.useCallback(() => {
    onSave({
      roundId,
      config: { ...config, _roundId: roundId, _savedState: {
        gross,
        vTeams: vTeamsRef.current,
        banker: bankerRef.current,
        p3mult: p3multRef.current,
        holeIdx: holeIdxRef.current,
        inPlay,
        liveHcps: liveHcpsRef.current,
        adjustments: adjustmentsRef.current,
        matchups: matchupsRef.current,
        ghostGross: ghostGrossRef.current,
        hzHero: hzHeroRef.current,
      }},
      date: new Date().toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" }),
      courseName: config.courseName || "Round",
    });
  }, [gross, inPlay, config, onSave, roundId]);
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (isLocked) return; // view-only — don't overwrite localStorage state either
    saveNow();
  }, [gross, inPlay, ghostGross, hzHero]); // eslint-disable-line react-hooks/exhaustive-deps
  // Save on app background / tab hide / unload — prevents data loss if iOS kills the PWA
  React.useEffect(() => {
    if (isLocked) return; // view-only — don't save
    const onHide = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    const onPageHide = () => saveNow();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [saveNow, isLocked]);
  function setVTeam(hi, side, players) {
    setVTeams(prev => { const n=prev.map(r=>[r[0].slice(),r[1].slice()]); n[hi][side]=players; return n; });
  }
  function toggleMult(hi, pi) {
    setP3mult(prev => { const n=JSON.parse(JSON.stringify(prev)); n[hi][pi]=n[hi][pi]===1?2:n[hi][pi]===2?3:1; return n; });
  }
  // Keep refs in sync with state
  React.useEffect(() => { vTeamsRef.current = vTeams; }, [vTeams]);
  React.useEffect(() => { bankerRef.current = banker; }, [banker]);
  React.useEffect(() => { p3multRef.current = p3mult; }, [p3mult]);
  React.useEffect(() => { matchupsRef.current = matchups; }, [matchups]);
  React.useEffect(() => { liveHcpsRef.current = liveHcps; }, [liveHcps]);
  React.useEffect(() => { adjustmentsRef.current = adjustments; }, [adjustments]);
  React.useEffect(() => { grossRef.current = gross; }, [gross]);
  React.useEffect(() => { holeIdxRef.current = holeIdx; }, [holeIdx]);
  React.useEffect(() => { inPlayRef.current = inPlay; }, [inPlay]);

  // If resuming a round where all 18 holes are already in-play, treat as already logged
  // so the 18-hole auto-trigger doesn't fire again on mount.
  const restoredInPlay = savedScores?.inPlay || config._savedState?.inPlay;
  const hasLoggedRef = React.useRef(Array.isArray(restoredInPlay) && restoredInPlay.every(Boolean));
  // Verify prompt — fires when user crosses from their starting nine to the other nine
  // Front-9 start: trigger when on hole 10+ (holeIdx >= 9)
  // Back-9 start: trigger when on hole 1-9 (holeIdx < 9)
  // Plus at least 9 holes must be in play
  React.useEffect(() => {
    if (verifyPromptShownRef.current) return;
    if (N <= 1) return; // no need for solo
    const count = inPlay.filter(Boolean).length;
    if (count < 9) return;
    const frontPlayedCount = inPlay.slice(0, 9).filter(Boolean).length;
    const backPlayedCount = inPlay.slice(9, 18).filter(Boolean).length;
    const startedOnFront = frontPlayedCount >= backPlayedCount;
    // Are we on the "other" nine now?
    const onOtherNine = startedOnFront ? holeIdx >= 9 : holeIdx < 9;
    if (onOtherNine) {
      verifyPromptShownRef.current = true;
      setShowVerifyPrompt(true);
    }
  }, [holeIdx, inPlay]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = holes.map((h, hi) => {
    const g = gross[hi];
    // Full-group relative HCPs (for scorecard display, 6-point, matchup)
    const minHcpAll = Math.min(...liveHcps);
    const n = players.map(pi => nettScore(g[pi], liveHcps[pi] - minHcpAll, h.si, h.par));
    // VP-only relative HCPs (for Vegas/CT/Banker — min within betting group only)
    // Ghost mode: extend to 4 players with ghost at index 3 (HCP 0, gross = ghostGross)
    const vpHcps = ghostEnabled
      ? [liveHcps[0], liveHcps[1], liveHcps[2], 0]
      : vp.map(pi => liveHcps[pi]);
    const minHcpVP = Math.min(...vpHcps);
    const nVP = ghostEnabled
      ? [0,1,2,3].map(pi => {
          if (pi === GHOST_IDX) {
            // Ghost is treated as a HCP 0 player. nettScore handles validation/null.
            // Vegas score cap applied at Vegas pipeline (not here) — raw nett returned.
            return nettScore(ghostGross[hi], 0, h.si, h.par);
          }
          let relHcp = liveHcps[pi] - minHcpVP;
          if (hcpCap !== null) relHcp = Math.min(relHcp, hcpCap);
          return nettScore(g[pi], relHcp, h.si, h.par);
        })
      : players.map(pi => {
          if (!vp.includes(pi)) return n[pi];
          let relHcp = liveHcps[pi] - minHcpVP;
          if (hcpCap !== null) relHcp = Math.min(relHcp, hcpCap);
          return nettScore(g[pi], relHcp, h.si, h.par);
        });
    // HIO detection — any player scores 1 on a par 3 (ghost doesn't trigger HIO)
    const isHIO = hioRule && h.par === 3 && players.some(pi => parseInt(g[pi], 10) === 1);
    // Vegas: allowed in 3-ball with Ghost (ghostEnabled) OR HZ (hzEnabled) OR 4+ players
    let grossForVegas, nettForVegas, teamsForVegas;
    if (hzEnabled) {
      // HZ: Hero self-pairs. Virtual index 3 = copy of Hero.
      const hero = hzHero[hi];
      const other = [0,1,2].filter(i => i !== hero);
      grossForVegas = [g[0], g[1], g[2], g[hero]];
      nettForVegas = [nVP[0], nVP[1], nVP[2], nVP[hero]];
      teamsForVegas = [[hero, 3], other];
    } else if (ghostEnabled) {
      grossForVegas = [g[0], g[1], g[2], ghostGross[hi]];
      nettForVegas = nVP;
      teamsForVegas = vTeams[hi];
    } else {
      grossForVegas = g;
      nettForVegas = nVP;
      teamsForVegas = vTeams[hi];
    }
    // Apply Vegas score cap — bound nett values before forming Vegas number.
    // Cap is Vegas-specific (other games use raw nett for true match-play comparison).
    const vegasCap = h.par === 3 ? h.par + capPar3 : h.par + capOther;
    nettForVegas = nettForVegas.map(v => v === null ? null : Math.min(v, vegasCap));
    let vr = (games.vegas && (N >= 4 || ghostEnabled || hzEnabled) && !isHIO) ? computeVegas(teamsForVegas, grossForVegas, nettForVegas, h.par, vegasRules) : null;
    // HZ: if bonus toggle is OFF, zero out bonuses from result
    if (vr && hzEnabled && !hzBonus) {
      const adjNetA = vr.netA - (vr.bonusA || 0) + (vr.bonusB || 0);
      const adjNetB = vr.netB - (vr.bonusB || 0) + (vr.bonusA || 0);
      vr = { ...vr, bonusA: 0, bonusB: 0, netA: adjNetA, netB: adjNetB };
    }
    const vd = Array(N).fill(0);
    if (vr) {
      if (hzEnabled) {
        // HZ: Hero gets 2× (netA covers both slots), other team splits normally (1× each)
        const hero = hzHero[hi];
        const other = [0,1,2].filter(i => i !== hero);
        // teamsForVegas = [[hero, 3], other]. Team 0 netA, Team 1 netB.
        vd[hero] = vr.netA * 2; // Hero absorbs the virtual duplicate's share
        other.forEach(pi => { vd[pi] = vr.netB; });
      } else if (ghostEnabled) {
        // Ghost's result absorbed by partner — partner gets 2x their share
        const t0 = vTeams[hi][0], t1 = vTeams[hi][1];
        const t0Net = vr.netA, t1Net = vr.netB;
        t0.forEach(pi => {
          if (pi === GHOST_IDX) return;
          const ghostOnTeam = t0.includes(GHOST_IDX);
          vd[pi] = ghostOnTeam ? t0Net * 2 : t0Net;
        });
        t1.forEach(pi => {
          if (pi === GHOST_IDX) return;
          const ghostOnTeam = t1.includes(GHOST_IDX);
          vd[pi] = ghostOnTeam ? t1Net * 2 : t1Net;
        });
      } else {
        vTeams[hi][0].filter(pi => vp.includes(pi)).forEach(pi => { vd[pi]=vr.netA; });
        vTeams[hi][1].filter(pi => vp.includes(pi)).forEach(pi => { vd[pi]=vr.netB; });
      }
    }
    // CT and Banker restricted to vp (the betting group of 4) when N > 4
    // In Ghost mode: CT/Banker use only real 3 players
    const ct = Array(N).fill(0);
    if (games.ct && !isHIO) {
      if (ghostEnabled) {
        // 3-ball CT uses only real players
        const realNett = [0,1,2].map(pi => n[pi]);
        const realCt = computeCutThroat(realNett);
        [0,1,2].forEach(pi => { ct[pi] = realCt[pi]; });
      } else {
        const vpNett = vp.map(pi => nVP[pi]);
        const vpCt = computeCutThroat(vpNett);
        vp.forEach((pi, idx) => { ct[pi] = vpCt[idx]; });
      }
    }
    const p3 = Array(N).fill(0);
    if (games.p3 && h.par === 3 && !isHIO) {
      const vpNett = bankerNett ? vp.map(pi => nVP[pi]) : vp.map(pi => { const gv=parseInt(g[pi],10); return isNaN(gv)||gv<=0?null:gv; });
      const vpBankerIdx = vp.indexOf(banker[hi]) >= 0 ? vp.indexOf(banker[hi]) : 0;
      const vpMults = vp.map(pi => p3mult[hi][pi]);
      const vpP3 = computePar3(vpNett, vpBankerIdx, vpMults);
      vp.forEach((pi, idx) => { p3[pi] = vpP3[idx]; });
    }
    const pts = games.pts ? computePointsGame(n) : Array(N).fill(0);
    return { g, grossForVegas, teamsForVegas, n, nVP, vr, vd, ct, p3, pts, isHIO };
  });
  const vegasCum=Array(N).fill(0), ctCum=Array(N).fill(0), p3Cum=Array(N).fill(0), ptsCum=Array(N).fill(0);
  results.forEach((r, hi) => {
    if (!inPlay[hi]) return;
    players.forEach(pi => { vegasCum[pi]+=r.vd[pi]; ctCum[pi]+=r.ct[pi]; p3Cum[pi]+=r.p3[pi]; ptsCum[pi]+=r.pts[pi]; });
  });

  // ── Sixes computation ──
  // Walk through holes, assigning each in-play hole to a segment (1-3)
  // Segment advances when 6 in-play holes played OR early close (lead > remaining)
  const sixesEnabled = games.sixes && config.sixesConfig && (N === 4 || N === 5 || N === 6);
  const sixesConfig = config.sixesConfig;
  const sixesData = { segments: [], holeAssignments: Array(18).fill(null) };
  if (sixesEnabled) {
    let currentSeg = 0;
    let segHolesPlayed = 0;
    let segT1 = 0, segT2 = 0;
    const segments = [
      { segIdx: 0, teams: sixesConfig.segments[0], holes: [], t1pts: 0, t2pts: 0, closed: false, closedEarly: false, closedAt: null },
      { segIdx: 1, teams: sixesConfig.segments[1], holes: [], t1pts: 0, t2pts: 0, closed: false, closedEarly: false, closedAt: null },
      { segIdx: 2, teams: sixesConfig.segments[2], holes: [], t1pts: 0, t2pts: 0, closed: false, closedEarly: false, closedAt: null },
    ];
    const maxPtsPerHole = sixesConfig.mode === "top2" ? 2 : 1;
    for (let hi = 0; hi < 18; hi++) {
      if (!inPlay[hi]) continue;
      if (currentSeg >= 3) break; // all segments closed
      const [t1, t2] = sixesConfig.segments[currentSeg];
      const r = results[hi];
      // Apply shadow — replace shadowed player's nett with min(shadowed, shadow)
      let nettForSixes = r.n;
      if (N === 5 && sixesConfig.shadowPlayer !== null && sixesConfig.shadowPlayer !== undefined) {
        const shadowIdx = sixesConfig.shadowPlayer;
        const shadowedIdx = sixesConfig.shadowOf?.[currentSeg];
        if (shadowedIdx !== null && shadowedIdx !== undefined && r.n[shadowIdx] !== null && r.n[shadowedIdx] !== null) {
          nettForSixes = [...r.n];
          nettForSixes[shadowedIdx] = Math.min(r.n[shadowedIdx], r.n[shadowIdx]);
        }
      }
      const { t1pts, t2pts } = computeSixes(nettForSixes, t1, t2, sixesConfig.mode);
      segments[currentSeg].holes.push({ hi, t1pts, t2pts });
      segments[currentSeg].t1pts += t1pts;
      segments[currentSeg].t2pts += t2pts;
      sixesData.holeAssignments[hi] = currentSeg;
      segHolesPlayed++;
      // Check if segment should close
      const holesRemaining = 6 - segHolesPlayed;
      const lead = Math.abs(segments[currentSeg].t1pts - segments[currentSeg].t2pts);
      const maxRemaining = holesRemaining * maxPtsPerHole;
      if (segHolesPlayed >= 6) {
        segments[currentSeg].closed = true;
        segments[currentSeg].closedAt = hi;
        currentSeg++;
        segHolesPlayed = 0;
      } else if (lead > maxRemaining) {
        segments[currentSeg].closed = true;
        segments[currentSeg].closedEarly = true;
        segments[currentSeg].closedAt = hi;
        currentSeg++;
        segHolesPlayed = 0;
      }
    }
    sixesData.segments = segments;
    sixesData.currentSeg = currentSeg;
  }
  // Per-player sixes $ / tokens
  const sixesPlayerDollars = Array(N).fill(0);
  const sixesPlayerTokens = Array(N).fill(0);
  if (sixesEnabled) {
    sixesData.segments.forEach((seg, segIdx) => {
      if (!seg.closed) return;
      // For 5-ball: add shadow player to their shadowed partner's team for this segment
      let teamsForSettle = seg.teams;
      if (N === 5 && sixesConfig.shadowPlayer !== null && sixesConfig.shadowPlayer !== undefined) {
        const shadowIdx = sixesConfig.shadowPlayer;
        const shadowedIdx = sixesConfig.shadowOf?.[segIdx];
        if (shadowedIdx !== null && shadowedIdx !== undefined) {
          // Find which team the shadowed player is on, add shadow to that team
          teamsForSettle = seg.teams.map(t => t.includes(shadowedIdx) ? [...t, shadowIdx] : t);
        }
      }
      if (sixesConfig.stakeType === "cash") {
        if (seg.t1pts === seg.t2pts) return; // tie, no cash payment
        const winnerIdx = seg.t1pts > seg.t2pts ? 0 : 1;
        const winners = teamsForSettle[winnerIdx];
        const losers = teamsForSettle[1 - winnerIdx];
        const payPerLoser = sixesConfig.cashAmount;
        losers.forEach(pi => { sixesPlayerDollars[pi] -= payPerLoser; });
        const totalCollected = payPerLoser * losers.length;
        const perWinner = totalCollected / winners.length;
        winners.forEach(pi => { sixesPlayerDollars[pi] += perWinner; });
      } else {
        // Meal tokens — tokens are BAD (shares of meal cost)
        // Tied: every player gets 1 token
        // Won/Lost: losers get 2 tokens each, winners get 0
        if (seg.t1pts === seg.t2pts) {
          teamsForSettle[0].forEach(pi => { sixesPlayerTokens[pi] += 1; });
          teamsForSettle[1].forEach(pi => { sixesPlayerTokens[pi] += 1; });
        } else {
          const loserIdx = seg.t1pts > seg.t2pts ? 1 : 0;
          teamsForSettle[loserIdx].forEach(pi => { sixesPlayerTokens[pi] += 2; });
        }
      }
    });
  }

  const dollars = players.map(pi =>
    (games.vegas?vegasCum[pi]*vegasVal:0) +
    (games.ct?ctCum[pi]*ctVal:0) +
    (games.p3?p3Cum[pi]*p3Val:0) +
    adjustments[pi]);
  // 6-point is separate from Vegas/CT/Banker subtotal (like Nassau)
  // Nassau / GDB computation
  const matchupResults = matchupEnabled ? matchups.map(m => {
    const t = m.type || "nassau";
    if (t === "gdb") {
      const result = computeGDB(m, gross, holes, inPlay);
      const dol = gdbDollars(m, result.front, result.back);
      return { ...result, dollars: dol, type: "gdb" };
    } else if (t === "stroke") {
      const result = computeStrokePlay(m, gross, holes, inPlay);
      const dol = strokePlayDollars(m, result.front, result.back, result.overall);
      return { ...result, dollars: dol, type: "stroke" };
    } else {
      const result = computeNassau(m, gross, holes, inPlay);
      const dol = nassauDollars(m, result.front, result.back, result.overall, result.presses);
      return { ...result, dollars: dol, type: t };
    }
  }) : [];
  const matchupPlayerDollars = Array(N).fill(0);
  if (matchupEnabled) {
    matchupResults.forEach((r, mi) => {
      const m = matchups[mi];
      matchupPlayerDollars[m.p1] += r.dollars.net;
      matchupPlayerDollars[m.p2] -= r.dollars.net;
    });
  }
  const ptsDollarsArr = games.pts && ptsVal > 0 ? players.map(i => players.reduce((sum, j) => j !== i ? sum + (ptsCum[i] - ptsCum[j]) * ptsVal : sum, 0)) : Array(N).fill(0);
  const dollarsTotal = players.map(pi => dollars[pi] + matchupPlayerDollars[pi] + ptsDollarsArr[pi] + (sixesEnabled && sixesConfig.stakeType === "cash" ? sixesPlayerDollars[pi] : 0));

  // Supabase logging — fires after delay to avoid PWA first-launch hang
  // Build the full round payload (used for both 18-hole trigger and explicit save)
  const buildFullPayload = React.useCallback(() => {
    const rid = String(roundId);
    const sgt = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
    const games_str = Object.entries(games).filter(([,v])=>v).map(([k])=>k).join(",");
    const playersArr = Array.from({ length: N }, (_, i) => ({ name: liveNames[i] || `P${i+1}`, hcp: liveHcps[i] }));
    // Round signature for duplicate detection (only for complete rounds)
    // Format: {first 4 holes' SI}|{sorted player total scores}|{date DD/MM/YYYY}
    let round_signature = null;
    if (inPlay.every(Boolean)) {
      const totalScores = Array.from({ length: N }, (_, i) =>
        gross.reduce((sum, hole) => sum + (parseInt(hole[i], 10) || 0), 0)
      );
      const sortedTotals = [...totalScores].sort((a, b) => a - b).join(",");
      const siSeq = holes.slice(0, 4).map(h => h.si).join(",");
      const datePart = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Singapore" });
      round_signature = `${siSeq}|${sortedTotals}|${datePart}`;
    }
    return {
      logBasic: {
        round_id: rid,
        course: config.courseName || "Custom",
        players: liveNames.slice(0, N),
        hcps: liveHcps.slice(0, N),
        games: games_str,
        player_count: N,
        holes_played: inPlay.filter(Boolean).length,
        logged_at_sgt: sgt,
        device_id: getDeviceId(),
      },
      logFull: {
        round_id: rid,
        logged_at_sgt: sgt,
        device_id: getDeviceId(),
        app_version: APP_VERSION,
        course_name: config.courseName || "Custom",
        course_holes: holes,
        group_code: config.groupCode || null,
        player_count: N,
        players: playersArr,
        games_enabled: games,
        game_settings: {
          vegasVal, ctVal, p3Val, ptsVal,
          vegasRules: config.vegasRules,
          hcpCap: config.hcpCap,
          hcpThreshold: config.hcpThreshold,
          bankerNett: config.bankerNett,
          hioRule: config.hioRule,
          capPar3: config.capPar3 ?? 3,
          capOther: config.capOther ?? 4,
        },
        three_ball_variant: ghostEnabled ? "ghost" : hzEnabled ? "hz" : null,
        hz_bonus: hzEnabled ? !!config.hzBonus : null,
        sixes_config: sixesEnabled ? sixesConfig : null,
        matchups: matchupEnabled ? matchups : null,
        gross,
        in_play: inPlay,
        v_teams: vTeams,
        banker,
        p3mult,
        hz_hero: hzEnabled ? hzHero : null,
        ghost_gross: ghostEnabled ? ghostGross : null,
        final_dollars: dollarsTotal,
        vegas_cum: vegasCum,
        ct_cum: ctCum,
        p3_cum: p3Cum,
        pts_cum: ptsCum,
        sixes_dollars: sixesEnabled ? sixesPlayerDollars : null,
        sixes_tokens: sixesEnabled ? sixesPlayerTokens : null,
        matchup_results: matchupEnabled ? matchupResults : null,
        adjustments,
        course_par: holes.reduce((s, h) => s + h.par, 0),
        total_holes_played: inPlay.filter(Boolean).length,
        is_complete: inPlay.every(Boolean),
        round_signature,
      },
    };
  }, [roundId, config, games, liveNames, liveHcps, N, inPlay, gross, vTeams, banker, p3mult, holes, vegasVal, ctVal, p3Val, ptsVal, ghostEnabled, hzEnabled, hzHero, ghostGross, sixesEnabled, sixesConfig, matchupEnabled, matchups, sixesPlayerDollars, sixesPlayerTokens, matchupResults, adjustments, dollarsTotal, dollars, vegasCum, ctCum, p3Cum, ptsCum]);
  // Log helper — writes to both tables
  const logRound = React.useCallback(() => {
    if (isLocked) return; // view-only — don't overwrite historical rounds
    const { logBasic, logFull } = buildFullPayload();
    // Skip if nothing meaningful to log (no holes in play yet)
    if ((logFull.total_holes_played || 0) === 0) return;
    const rid = logBasic.round_id;
    supaUpsert("rounds_log", rid, logBasic);
    supaUpsert("rounds_full", rid, logFull);
  }, [buildFullPayload, isLocked]);
  // 18-hole auto-trigger
  React.useEffect(() => {
    if (hasLoggedRef.current) return;
    if (!inPlay.every(v => v)) return;
    hasLoggedRef.current = true;
    setTimeout(() => { logRound(); }, 3000);
  }, [inPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE FLIGHT HIGHLIGHTS (Layer 1)
  // ─────────────────────────────────────────────────────────────────────────
  // When in a multi-flight group (groupCode set), each in-play hole triggers:
  //   1. logRound() — pushes our gross to Supabase
  //   2. fetchOtherFlights() — pulls other flights' gross arrays
  //   3. diff vs prevSnapshot → detect new birdies/eagles/HIO → toast
  // Snapshot persists in localStorage so iPhone PWA kill/relaunch works correctly.
  // Unified ticker: scores from all flights + flash entries (birdies/eagles/HIO)
  // Flash entries auto-expire 15 seconds after creation, regardless of further fetches.
  const [flashItems, setFlashItems] = useState([]); // [{ id, emoji, text, expiresAt }]
  // Tick every 2s to re-render and drop expired flash items
  const [tickerTick, setTickerTick] = useState(0);
  React.useEffect(() => {
    if (flashItems.length === 0) return;
    const t = setInterval(() => {
      setTickerTick(x => x + 1);
      setFlashItems(prev => prev.filter(f => f.expiresAt > Date.now()));
    }, 2000);
    return () => clearInterval(t);
  }, [flashItems.length]);
  // Scores ticker — appears once per fetch, runs for ~3 passes, then disappears.
  // Stores: array of { name, color, vsPar, lastHole } per player from all flights.
  const [scoresTicker, setScoresTicker] = useState(null); // null = hidden, [] = empty pass, [{...}] = showing
  const groupCode = (config.groupCode || "").trim();
  const todayKey = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const snapshotKey = groupCode ? `sws_highlights_${groupCode}_${todayKey}` : null;
  const prevSnapshotRef = React.useRef(null);
  // Restore snapshot from localStorage on mount
  React.useEffect(() => {
    if (!snapshotKey) return;
    try {
      const raw = localStorage.getItem(snapshotKey);
      const parsed = raw ? JSON.parse(raw) : {};
      prevSnapshotRef.current = parsed;
    } catch (_) { prevSnapshotRef.current = {}; }
  }, [snapshotKey]);
  function persistSnapshot() {
    if (!snapshotKey || !prevSnapshotRef.current) return;
    try { localStorage.setItem(snapshotKey, JSON.stringify(prevSnapshotRef.current)); } catch(_) {}
  }
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    } catch (_) {}
  }
  function pushToast(emoji, text) {
    const id = Date.now() + Math.random();
    setFlashItems(prev => [...prev, { id, emoji, text, expiresAt: Date.now() + 15000 }]);
    playChime();
  }
  // Helper: compute vsPar + lastHole for a flight's gross + in_play + holes
  function computeFlightScores(grossArr, inPlayArr, holesArr, names, isSelf) {
    const N = (grossArr[0] || []).length;
    const out = [];
    for (let pi = 0; pi < N; pi++) {
      let grossSum = 0, parSum = 0, lastHole = 0;
      for (let hi = 0; hi < Math.min(grossArr.length, holesArr.length); hi++) {
        if (!inPlayArr[hi]) continue;
        const g = parseInt(grossArr[hi]?.[pi], 10) || 0;
        const p = holesArr[hi]?.par;
        if (g > 0 && p) {
          grossSum += g;
          parSum += p;
          if (hi + 1 > lastHole) lastHole = hi + 1;
        }
      }
      if (lastHole === 0) continue; // no holes played yet
      const vsPar = grossSum - parSum;
      out.push({
        name: names[pi] || `P${pi+1}`,
        vsPar,
        lastHole,
        isSelf: !!isSelf,
      });
    }
    return out;
  }
  async function fetchOtherFlightsAndDiff() {
    if (!groupCode || !prevSnapshotRef.current) return;
    try {
      const myRid = String(roundId);
      // Today-only filter (SGT) — only fetch rounds created today, not stale ones
      const todaySGT = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
      const sinceParam = `&created_at=gte.${todaySGT}T00:00:00%2B08:00`;
      const url = `${SUPA_URL_BASE}/rounds_full?group_code=eq.${encodeURIComponent(groupCode)}&total_holes_played=gt.0${sinceParam}&order=created_at.desc&limit=10`;
      const res = await fetch(url, { headers: SUPA_HDR });
      if (!res.ok) return;
      const flights = await res.json();
      const snap = prevSnapshotRef.current;
      let dirty = false;
      // Aggregate scores from all flights (incl. self from local state)
      const allScores = computeFlightScores(gross, inPlay, holes, liveNames.slice(0, N), true);
      flights.forEach(flight => {
        const fgross = flight.gross || [];
        const fholes = flight.course_holes || [];
        const fplayers = (flight.players || []).map(p => p?.name || "");
        const fInPlay = flight.in_play || [];
        // Add this flight's scores to the aggregate (skip self — already added above)
        if (flight.round_id !== myRid) {
          const fs = computeFlightScores(fgross, fInPlay, fholes, fplayers, false);
          allScores.push(...fs);
        }
        // Highlights diff (other flights only)
        if (flight.round_id === myRid) return; // skip self for highlights
        const flightSnap = snap[flight.round_id] || { toasted: {} };
        const toasted = flightSnap.toasted || {};
        for (let hi = 0; hi < Math.min(fgross.length, fholes.length); hi++) {
          if (!fInPlay[hi]) continue;
          const par = fholes[hi]?.par;
          if (!par) continue;
          const row = fgross[hi] || [];
          for (let pi = 0; pi < row.length; pi++) {
            const newG = parseInt(row[pi], 10) || 0;
            if (newG <= 0) continue;
            const cellKey = `${hi}_${pi}`;
            if (toasted[cellKey]) continue;
            const name = fplayers[pi] || `P${pi+1}`;
            let shown = false;
            if (newG === 1 && par === 3) {
              pushToast("🕳️", `${name} HOLE-IN-ONE on hole ${hi+1}!`);
              shown = true;
            } else if (newG <= par - 2) {
              pushToast("🦅", `${name} eagle on hole ${hi+1}`);
              shown = true;
            } else if (newG === par - 1) {
              pushToast("🐦", `${name} birdie on hole ${hi+1}`);
              shown = true;
            }
            if (shown) toasted[cellKey] = true;
          }
        }
        snap[flight.round_id] = { toasted };
        dirty = true;
      });
      if (dirty) persistSnapshot();
      // Trigger scores ticker — sort by vsPar ascending (best first)
      if (allScores.length > 0) {
        const sorted = [...allScores].sort((a, b) => a.vsPar - b.vsPar);
        setScoresTicker(sorted);
      }
    } catch (_) {}
  }
  // Per-hole trigger: when an inPlay flag changes, log and fetch.
  // Skipped if no group code (no need to broadcast or watch).
  // Skipped if isLocked (view-only).
  const inPlayKey = inPlay.join(",");
  const lastInPlayKeyRef = React.useRef(inPlayKey);
  React.useEffect(() => {
    if (lastInPlayKeyRef.current === inPlayKey) return;
    lastInPlayKeyRef.current = inPlayKey;
    if (!groupCode) return;
    if (isLocked) return;
    // Slight delay so localStorage save runs first
    const t = setTimeout(() => {
      logRound();
      fetchOtherFlightsAndDiff();
    }, 800);
    return () => clearTimeout(t);
  }, [inPlayKey, groupCode, isLocked]); // eslint-disable-line react-hooks/exhaustive-deps
  const frontPlayed = inPlay.slice(0,9).filter(Boolean).length;
  const backPlayed = inPlay.slice(9,18).filter(Boolean).length;
  const firstNine = frontPlayed >= backPlayed ? "F" : "B";
  const qrPayload = React.useMemo(() => buildQRPayload({
    names: liveNames, hcps: liveHcps, holes, scores: gross, inPlay,
    games, stakes: { vegasVal, ctVal, p3Val },
    vTeams, dollars: dollarsTotal,
    matchups, nassauResults: matchupResults, matchupEnabled,
    courseName: config.courseName, firstNine,
  }), [inPlay.join(","), dollarsTotal.join(","), matchupEnabled]);
  const h = holes[holeIdx];
  const res = results[holeIdx];
  const completedCount = inPlay.filter(Boolean).length;
  // Running gross total vs par through in-play holes
  const runningTotal = players.map(pi => {
    let strokes = 0, par = 0;
    results.forEach((r, hi) => {
      if (!inPlay[hi]) return;
      const g = parseInt(r.g[pi], 10);
      if (!isNaN(g)) { strokes += g; par += holes[hi].par; }
    });
    return strokes === 0 ? null : strokes - par;
  });
  const runningPts = games.pts ? players.map(pi => {
    let total = 0; let any = false;
    results.forEach((r, hi) => { if (inPlay[hi] && r.pts) { total += r.pts[pi]; any = true; } });
    return any ? total : null;
  }) : null;
  return (
    <>
    <div style={S.page} className={isLight ? "light-mode" : "dark-mode"} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <style>{`

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { overscroll-behavior: none; overscroll-behavior-y: none; height: 100%; }
        body { overscroll-behavior: none; overscroll-behavior-y: none; height: 100%; margin: 0; }
        #root { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: none; }
        .light-mode { --bg: #ffffff; --card: #eeeeee; --input: #ffffff; --border: #cccccc; --border2: #888888; --text: #000000; --muted: #333333; --dim: #333333; --neg: #cc0000; --accent: #000000; --score-bg: #111111; --score-btn: #111111; --progress-bg: #dddddd; --pill-played: #222222; --pill-p3: #1a4a8a; --badge: #111111; }
        .light-mode * { -webkit-font-smoothing: antialiased; }
        .light-mode .sect-title { font-weight: 800 !important; color: #000000 !important; }
        .light-mode .tab-btn { font-weight: 700 !important; }
        .dark-mode  { --bg: #0a1a0a; --card: #0d2210; --input: #071507; --border: #1e3a1e; --border2: #2a5a2a; --text: #e8f5e8; --muted: #5a8a5a; --dim: #4a7a4a; --neg: #f87171; --accent: #4ade80; --score-bg: #1a3a1a; --score-btn: #1a3a1a; --progress-bg: #1e3a1e; --pill-played: #2a5a2a; --pill-p3: #1a4a6a; --badge: #e8f5e8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        .pm-btn:active { transform: scale(0.9) !important; background: #2a5a2a !important; }
        .tab-btn:active { opacity: 0.7; }
        .hole-nav:active { transform: scale(0.95); background: #1e3a1e !important; }
        .score-btn:active { transform: scale(0.88); background: #2a5a2a !important; }
        select { appearance: none; -webkit-appearance: none; }
        @keyframes scoreIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .score-in { animation: scoreIn 0.15s ease-out; }
        @keyframes slideDown { from { transform: translateY(-30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tickerScroll { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(calc(-1 * var(--ticker-distance, 50%)), 0, 0); } }
      `}</style>
      {showBackStrokeModal && matchupEnabled && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 14, padding: 20, width: "100%", maxWidth: 380, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            {(() => {
              const frontPlayed = inPlay.slice(0, 9).filter(Boolean).length;
              const backPlayed  = inPlay.slice(9, 18).filter(Boolean).length;
              const secondNineIsBack = frontPlayed >= backPlayed;
              const firstNineLabel = secondNineIsBack ? "Front 9" : "Back 9";
              const secondNineLabel = secondNineIsBack ? "Back 9" : "Front 9";
              return (
                <>
                  <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, marginBottom: 4, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                    TURN — {secondNineLabel.toUpperCase()} STROKES
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 16, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                    Adjust strokes for {secondNineLabel}. Tap ± to change.
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
                  {matchups.map((m, mi) => {
                    const field = secondNineIsBack ? "strokesBack" : "strokesFront";
                    const currentVal = m[field];
                    const p1col = isLight ? COLORS_LIGHT[m.p1] : COLORS[m.p1];
                    const p2col = isLight ? COLORS_LIGHT[m.p2] : COLORS[m.p2];
                    // giver = original p1 if positive, p2 if negative (they now give)
                    const giver   = currentVal >= 0 ? m.p1 : m.p2;
                    const receiver = currentVal >= 0 ? m.p2 : m.p1;
                    const givercol   = currentVal >= 0 ? p1col : p2col;
                    const receivercol = currentVal >= 0 ? p2col : p1col;
                    const isStrokePlay = m.type === "stroke";
                    // First nine result for this matchup
                    const firstNineStart = secondNineIsBack ? 0 : 9;
                    const firstNineStrokeMaps = buildNassauStrokeMaps(m, holes);
                    let p1wins = 0, p2wins = 0;
                    let p1NettSum = 0, p2NettSum = 0; // for stroke play
                    for (let h = firstNineStart; h < firstNineStart + 9; h++) {
                      if (!inPlay[h]) continue;
                      const g1 = parseInt(gross[h][m.p1], 10);
                      const g2 = parseInt(gross[h][m.p2], 10);
                      if (isNaN(g1) || isNaN(g2) || g1 <= 0 || g2 <= 0) continue;
                      const strk = strokesForHole(h, holes[h].si, firstNineStrokeMaps);
                      if (isStrokePlay) {
                        const par = holes[h].par;
                        const cap = par === 3 ? par + 3 : par + 4;
                        p1NettSum += Math.min(g1 - strk.p1, cap);
                        p2NettSum += Math.min(g2 - strk.p2, cap);
                      } else {
                        // No cap — match play comparison uses raw nett.
                        const n1 = g1 - strk.p1;
                        const n2 = g2 - strk.p2;
                        if (n1 < n2) p1wins++; else if (n2 < n1) p2wins++;
                      }
                    }
                    const netHoles = p1wins - p2wins; // positive = p1 leads (Nassau/GDB/MatchPlay)
                    const strokeDiff = p2NettSum - p1NettSum; // positive = p1 leads (Stroke Play)
                    const firstNineWinner = isStrokePlay
                      ? (strokeDiff > 0 ? m.p1 : strokeDiff < 0 ? m.p2 : null)
                      : (netHoles > 0 ? m.p1 : netHoles < 0 ? m.p2 : null);
                    const firstNineWinCol = (isStrokePlay ? strokeDiff : netHoles) > 0 ? p1col : p2col;
                    return (
                      <div key={mi} style={{ marginBottom: 0, paddingBottom: 18, borderBottom: mi < matchups.length - 1 ? "1px solid var(--border2)" : "none", marginTop: mi > 0 ? 18 : 0 }}>
                        <div style={{ fontSize: 18, fontWeight: "800", color: "var(--text)", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                          <span style={{ fontSize: 10, color: "var(--text)", fontWeight: "500", letterSpacing: 1, display: "block", marginBottom: 2 }}>MATCH {mi+1}{isStrokePlay ? " · STROKE PLAY" : ""}</span>
                          <span style={{ color: p1col }}>{liveNames[m.p1]}</span> <span style={{ color: "var(--dim)", fontSize: 14 }}>vs</span> <span style={{ color: p2col }}>{liveNames[m.p2]}</span>
                        </div>
                        {/* First nine result */}
                        <div style={{ background: "var(--input)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                          <span style={{ color: "var(--text)" }}>{firstNineLabel}: </span>
                          {isStrokePlay
                            ? (firstNineWinner !== null
                                ? <span style={{ color: firstNineWinCol, fontWeight: "700" }}>{liveNames[firstNineWinner]} by {Math.abs(strokeDiff)} ({p1NettSum}–{p2NettSum})</span>
                                : <span style={{ color: "var(--text)", fontWeight: "700" }}>All Square ({p1NettSum}–{p2NettSum})</span>)
                            : (firstNineWinner !== null
                                ? <span style={{ color: firstNineWinCol, fontWeight: "700" }}>{liveNames[firstNineWinner]} {Math.abs(netHoles)} UP ({p1wins}W–{p2wins}W)</span>
                                : <span style={{ color: "var(--text)", fontWeight: "700" }}>All Square ({p1wins}W–{p2wins}W)</span>)
                          }
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{secondNineLabel} strokes</span>
                            <div style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
                              {currentVal === 0
                                ? <span style={{ color: "var(--text)" }}>Scratch</span>
                                : currentVal > 0
                                  ? <><span style={{ color: givercol, fontWeight:"600" }}>{liveNames[giver]}</span><span style={{ color:"var(--muted)" }}> gives </span><span style={{ color: receivercol, fontWeight:"600" }}>{liveNames[receiver]}</span><span style={{ color:"var(--muted)" }}> {Math.abs(currentVal)} stroke{Math.abs(currentVal)!==1?"s":""}</span></>
                                  : <><span style={{ color: givercol, fontWeight:"600" }}>{liveNames[giver]}</span><span style={{ color:"var(--neg)" }}> now gives </span><span style={{ color: receivercol, fontWeight:"600" }}>{liveNames[receiver]}</span><span style={{ color:"var(--neg)" }}> {Math.abs(currentVal)} stroke{Math.abs(currentVal)!==1?"s":""}</span></>
                              }
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                            <button className="pm-btn" onClick={() => setMatchups(prev => { const n=prev.map(x=>({...x})); n[mi][field]-=1; return n; })} style={S.pmBtnInline}>−</button>
                            <span style={{ width: 38, textAlign: "center", color: "var(--accent)", fontSize: 18, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>{Math.abs(currentVal)}</span>
                            <button className="pm-btn" onClick={() => setMatchups(prev => { const n=prev.map(x=>({...x})); n[mi][field]+=1; return n; })} style={S.pmBtnInline}>+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  <button className="start-btn" style={{ ...S.startBtn, marginTop: 4, flexShrink: 0 }} onClick={() => setShowBackStrokeModal(false)}>
                    Confirm →
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--card)", borderBottom: "1px solid var(--border)", boxShadow: isLight ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>
          <div style={{ height: 3, background: "var(--border)" }}>
          <div style={{ height: "100%", width: `${(completedCount/18)*100}%`, background: COLORS[0], transition: "width 0.4s ease" }} />
        </div>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "var(--text)", letterSpacing: 2 }}>HOLE{isSuperuser && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--accent)" }}>🛡️</span>}</span>
            <select value={holeIdx} style={{ ...S.sel, fontSize: 22, fontWeight: "bold", color: "var(--text)", padding: "2px 8px", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}
              onChange={e => { const i = Number(e.target.value); if (!inPlay[i]) window.scrollTo(0,0); setHoleIdx(i); setView("hole"); }}>
              {Array.from({length:18}, (_,i) => (
                <option key={i} value={i}>{i+1}{inPlay[i] ? " ✓" : ""}</option>
              ))}
            </select>
            <div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: "600", color: "var(--text)" }}>Par {h.par}</span>
              <span style={{ fontSize: 16, color: "var(--text)", marginLeft: 6, fontWeight: "600" }}>SI {h.si}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {[["hole","HOLE"],["totals","$"]].map(([v,label]) => (
              <button key={v} className="tab-btn" onClick={() => { setView(v); window.scrollTo(0,0); if (v === "totals") { setTimeout(() => { logRound(); }, 2000); } }}
                style={{
                  padding: v==="totals" ? "8px 18px" : "6px 10px",
                  borderRadius: 6,
                  fontSize: v==="totals" ? 20 : 11,
                  letterSpacing: 1,
                  cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${view===v ? COLORS[0] : "var(--border)"}`,
                  background: view===v ? COLORS[0] : "transparent",
                  color: view===v ? (isLight ? "#fff" : "#000000") : "var(--dim)",
                  fontWeight: view===v ? "bold" : "normal" }}>
                {label}
              </button>
            ))}
            <button className="tab-btn" onClick={() => { window.scrollTo(0,0); onBack({ gross, vTeams, banker, p3mult, inPlay, liveHcps, liveNames, adjustments, matchups, holeIdx, ghostGross, hzHero }, roundId); }}
              style={{ padding: "6px 10px", borderRadius: 6, fontSize: 16, cursor: "pointer", transition: "all 0.15s", border: "1px solid var(--border)", background: "transparent", color: "var(--dim)" }}>
              🏠
            </button>
          </div>
        </div>
        {/* Hole progress pills */}
        {view === "hole" && (
          <div style={{ display: "flex", gap: 2, padding: "0 8px 8px" }}>
            {Array.from({length:18}, (_,i) => {
              const isPar3 = holes[i].par === 3;
              const isCurrent = i === holeIdx;
              const isPlayed = inPlay[i];
              const bg = isCurrent
                ? (isLight ? "#16a34a" : COLORS[0])
                : isPlayed
                  ? (isPar3 ? (isLight?"#1e40af":"#1a4a6a") : (isLight?"#166534":"#2a5a2a"))
                  : (isPar3 ? (isLight?"#dbeafe":"#0d2a3a") : (isLight?"#d1d5db":"#1e3a1e"));
              const col = isCurrent
                ? "#ffffff"
                : isPlayed
                  ? (isPar3 ? (isLight?"#ffffff":"#60a5fa") : (isLight?"#ffffff":COLORS[0]))
                  : (isPar3 ? (isLight?"#1e40af":"#2a5a7a") : (isLight?"#555555":"#3a5a3a"));
              return (
                <div key={i} onClick={() => { if (!inPlay[i]) window.scrollTo(0,0); setHoleIdx(i); setView("hole"); }}
                  style={{ flex: 1, height: 20, borderRadius: 3, cursor: "pointer",
                    transition: "all 0.2s", background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                    border: isPar3 ? `1px solid ${isCurrent?(isLight?"#16a34a":COLORS[0]):(isLight?"#1e40af":"#1a4a6a")}` : "none",
                    fontWeight: isCurrent?"700":"500" }}>
                  <span style={{ fontSize: 9, color: col, fontFamily: "'DM Sans', sans-serif" }}>{i+1}</span>
                </div>
              );
            })}
          </div>
        )}

        {view === "hole" && completedCount > 0 && (
          <div style={{ display: "flex", gap: 4, padding: "0 14px 8px", justifyContent: "flex-end" }}>
            {players.map(pi => {
              const t = runningTotal[pi];
              if (t === null) return null;
              const col = t < 0 ? COLORS[0] : t === 0 ? "#60a5fa" : "#f87171";
              return (
                <div key={pi} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[pi] }} />
                  <span style={{ fontSize: 11, color: col, fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>
                    {t > 0 ? "+" : ""}{t}
                  </span>
                </div>
              );
            })}
            <span style={{ fontSize: 10, color: "#3a6a3a", fontFamily: "'DM Sans', sans-serif", marginLeft: 2 }}>
              thru {completedCount}
            </span>
          </div>
        )}

      </div>
      {isLocked && (
        <div style={{ background: isLight ? "#fbbf24" : "#3a2a0a", borderBottom: `2px solid ${isLight ? "#d97706" : "#fbbf24"}`, padding: "8px 14px", textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: isLight ? "#000" : "#fbbf24", letterSpacing: 2 }}>
          🔒 VIEW ONLY · ROUND LOCKED (24h+)
        </div>
      )}
      {/* Unified live ticker — flash entries (birdies/eagles/HIO) + player scores */}
      {(scoresTicker || flashItems.length > 0) && (
        <div style={{
          position: "sticky", top: 0, zIndex: 9999,
          background: isLight ? "#1e3a1e" : "#0d2210",
          borderBottom: `1px solid ${isLight ? "#16a34a" : "#1e3a1e"}`,
          height: 36, overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {/* LIVE badge — absolute, always above scrolling content */}
          <div style={{ position: "absolute", top: 0, left: 0, height: "100%", padding: "0 10px", fontSize: 10, color: "#fff", fontWeight: 700, letterSpacing: 1, background: "#16a34a", display: "flex", alignItems: "center", zIndex: 2, boxShadow: "2px 0 6px rgba(0,0,0,0.3)" }}>
            LIVE
          </div>
          {(() => {
            const items = [...flashItems, ...(scoresTicker || [])];
            if (items.length === 0) return null;
            const renderItem = (item, key) => {
              if (item.emoji) {
                return (
                  <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "#fbbf24", fontWeight: 700 }}>
                    <span style={{ fontSize: 20 }}>{item.emoji}</span>
                    <span>{item.text}</span>
                  </span>
                );
              }
              const sign = item.vsPar > 0 ? "+" : "";
              const txt = item.vsPar === 0 ? "E" : `${sign}${item.vsPar}`;
              const col = item.vsPar < 0 ? "#fbbf24" : item.vsPar === 0 ? "#fff" : (isLight ? "#fff" : "#e8f5e8");
              return (
                <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: col, fontWeight: item.isSelf ? 700 : 500 }}>
                  <span style={{ color: item.isSelf ? "#4ade80" : "var(--muted)", fontSize: 11 }}>{item.isSelf ? "▶" : ""}</span>
                  <span>{item.name}</span>
                  <span style={{ fontWeight: 700 }}>{txt}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>(H{item.lastHole})</span>
                </span>
              );
            };
            return (
              <div style={{ paddingLeft: 70, height: "100%", overflow: "hidden" }}>
                <TickerScroller
                  items={items}
                  passes={5}
                  onComplete={() => setScoresTicker(null)}
                  renderItem={renderItem}
                />
              </div>
            );
          })()}
        </div>
      )}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 14px 160px", position: "relative" }}>
        {isLocked && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, pointerEvents: "auto", background: "transparent", cursor: "not-allowed" }} onClick={(e) => { e.stopPropagation(); }} />
        )}        {view === "hole" ? (
          <>
            {/* HIO Banner */}
            {res.isHIO && (
              <div style={{ marginBottom: 14,
                background: "linear-gradient(135deg, #1a0a00, #2d1500, #1a0a00)",
                border: "2px solid #f59e0b",
                boxShadow: "0 0 32px #f59e0b44, inset 0 1px 0 #fbbf2433",
                animation: "hio-flash 1.2s ease-in-out 2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", animation: "hio-slide 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
                  <div style={{ flexShrink: 0 }}>
                    <TeeBoxLogo size={38} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: "#fbbf24", fontFamily: "'DM Sans', sans-serif", fontWeight: "700", textTransform: "uppercase", marginBottom: 3 }}>Par 3 · Hole {holeIdx + 1}</div>
                    <div style={{ fontSize: 24, fontWeight: "900", color: "#fbbf24", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1, lineHeight: 1, textShadow: "0 0 16px #fbbf2066" }}>Hole In One</div>
                    <div style={{ width: 32, height: 1.5, background: "#fbbf24", margin: "6px 0", borderRadius: 1, opacity: 0.4 }} />
                    <div style={{ fontSize: 10, fontWeight: "600", color: "#e8f5e8", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1, opacity: 0.7, whiteSpace: "nowrap" }}>VEGAS · CT · BANKER — ALL BETS OFF</div>
                  </div>
                </div>
              </div>
            )}
            {/* Score entry — large touch targets */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="sect-title" style={{ fontSize: 13, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>Gross Scores</div>
              {/* Inline In Play toggle */}
              <div onClick={() => {
                setInPlay(prev => {
                  const n = [...prev]; n[holeIdx] = !n[holeIdx];
                  return n;
                });
              }} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                <div style={{ width: 40, height: 22, borderRadius: 11, background: inPlay[holeIdx] ? "var(--accent)" : "var(--neg)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: inPlay[holeIdx] ? 21 : 3, transition: "left 0.2s" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: "600", color: inPlay[holeIdx] ? "var(--accent)" : "var(--neg)", fontFamily: "'DM Sans', sans-serif" }}>
                  {inPlay[holeIdx] ? "In Play" : "Not In Play"}
                </span>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              {/* Player names row */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${ghostEnabled?4:N},1fr)`, gap: (ghostEnabled||N>=5)?4:6, marginBottom: 10 }}>
                {(ghostEnabled ? [0,1,2,3] : players).map(pi => (
                  <div key={pi} style={{ textAlign: "center" }}>
                    <div style={{ color: (pi===GHOST_IDX && ghostEnabled)?(isLight?"#666":"#888"):(isLight?COLORS_LIGHT[pi]:COLORS[pi]), fontWeight: "800", fontSize: (ghostEnabled||N>=5)?14:20, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(pi===GHOST_IDX && ghostEnabled)?"👻 Ghost":liveNames[pi]}</div>
                    {(pi===GHOST_IDX && ghostEnabled) ? (
                      <div style={{ fontSize: (ghostEnabled||N>=5)?10:13, fontWeight: "600", color: "var(--dim)" }}>HCP 0</div>
                    ) : (() => {
                      const strokes = strokesGiven(liveHcps[pi], h.si);
                      const strokeColor = strokes === 2 ? (isLight?"#16a34a":COLORS[0]) : strokes === 1 ? (isLight?"#16a34a":"#6ab87a") : "var(--dim)";
                      const strokeWeight = strokes > 0 ? "600" : "400";
                      return (
                        <div style={{ fontSize: (ghostEnabled||N>=5)?10:13, fontWeight: "600", color: "var(--text)" }}>
                          {(ghostEnabled||N>=5) ? liveHcps[pi] : `HCP ${liveHcps[pi]}`}
                          <span style={{ color: strokeColor, fontWeight: strokeWeight, marginLeft: 2 }}>
                            {strokes > 0 ? `+${strokes}` : "·"}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
              {/* Big score buttons */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${ghostEnabled?4:N},1fr)`, gap: (ghostEnabled||N>=5)?4:8, marginBottom: 10 }}>
                {(ghostEnabled ? [0,1,2,3] : players).map(pi => {
                  const isGhost = pi === GHOST_IDX && ghostEnabled;
                  const g = parseInt(isGhost ? ghostGross[holeIdx] : gross[holeIdx][pi], 10) || (isGhost ? h.par+1 : h.par);
                  const grossDiff = g - h.par;
                  const setGhostScore = (val) => {
                    setGhostGross(prev => { const n = [...prev]; n[holeIdx] = val; return n; });
                    setInPlay(prev => { const n = [...prev]; n[holeIdx] = true; return n; });
                  };
                  return (
                    <div key={pi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: (ghostEnabled||N>=5)?2:4, opacity: isGhost?0.7:1 }}>
                      <button className="score-btn" onClick={() => { const next=g+1; const par=holes[holeIdx].par; if(next >= par+5 || next <= par-2) { haptic("strong"); window.navigator?.vibrate?.([30,20,30]); } else { haptic(); } if(isGhost) setGhostScore(String(next)); else setScore(holeIdx, pi, String(next)); }}
                        style={{ width: "100%", height: (ghostEnabled||N>=5)?34:44, borderRadius: 8, background: "var(--score-btn)", border: "1px solid var(--border2)", color: "#ffffff", fontSize: (ghostEnabled||N>=5)?16:22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" }}>+</button>
                      <ScoreBadge score={g} diff={grossDiff} large={!ghostEnabled && N<5} />
                      <button className="score-btn" onClick={() => { const next=Math.max(1,g-1); const par=holes[holeIdx].par; if(next >= par+5 || next <= par-2) { haptic("strong"); window.navigator?.vibrate?.([30,20,30]); } else { haptic(); } if(isGhost) setGhostScore(String(next)); else setScore(holeIdx, pi, String(next)); }}
                        style={{ width: "100%", height: (ghostEnabled||N>=5)?34:44, borderRadius: 8, background: "var(--score-btn)", border: "1px solid var(--border2)", color: "#ffffff", fontSize: (ghostEnabled||N>=5)?16:22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" }}>−</button>
                    </div>
                  );
                })}
              </div>
              {/* Nett scores */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${ghostEnabled?4:N},1fr)`, gap: (ghostEnabled||N>=5)?4:6 }}>
                {(ghostEnabled ? [0,1,2,3] : players).map(pi => {
                  const isGhost = pi === GHOST_IDX && ghostEnabled;
                  const n = isGhost ? res.nVP[GHOST_IDX] : res.n[pi];
                  const nettDiff = n !== null ? n - h.par : null;
                  return (
                    <div key={pi} style={{ textAlign: "center", background: "var(--input)", borderRadius: 6, padding: "4px 2px 6px", border: "1px solid var(--border)", opacity: isGhost?0.7:1 }}>
                      <div style={{ fontSize: 10, color: "var(--text)", marginBottom: 2 }}>NETT</div>
                      {n !== null ? <ScoreBadge score={n} diff={nettDiff} /> : <div style={{ fontSize: 18, color: "#2a4a2a" }}>—</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Vegas */}
            {games.vegas && <div style={{ opacity: inPlay[holeIdx] ? 1 : 0.4, pointerEvents: inPlay[holeIdx] ? "auto" : "none" }}><Sect title={hzEnabled ? "Vegas — Pick Hero 🦸" : ghostEnabled ? "Vegas — Teams 👻" : "Vegas — Teams"}>
              {hzEnabled ? (
                <>
                  <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8 }}>
                    Pick the <span style={{ color: "var(--accent)", fontWeight: "600" }}>Hero</span> — their score pairs with itself. Other two form opposing team.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {[0,1,2].map(pi => {
                      const isHero = hzHero[holeIdx] === pi;
                      const col = isLight?COLORS_LIGHT[pi]:COLORS[pi];
                      return (
                        <button key={pi} style={{ flex: 1, padding: "14px 0", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${isHero ? col : "#1e3a1e"}`,
                          background: isHero ? col+"33" : "transparent",
                          transition: "all 0.15s" }}
                          onClick={() => { setHzHero(prev => { const n = [...prev]; n[holeIdx] = pi; return n; }); }}>
                          <div style={{ fontSize: 20, fontWeight: "800", color: isHero?col:(isLight?"#666666":"#5a8a5a"), marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>{liveNames[pi]}</div>
                          <div style={{ fontSize: 18, fontWeight: "700", color: isHero?col:"#3a5a3a", lineHeight: 1, fontFamily: "'Bebas Neue', sans-serif" }}>{isHero ? "🦸 HERO" : "—"}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: "700", color: "var(--text)", marginBottom: 8, textAlign: "center" }}>
                    {(() => {
                      const hero = hzHero[holeIdx];
                      const other = [0,1,2].filter(i => i !== hero);
                      return (
                        <>
                          <span style={{ color: getColor(hero) }}>{liveNames[hero]}×2</span>
                          {" "}<span style={{ color: "#2a4a2a" }}>vs</span>{" "}
                          <span style={{ color: getColor(other[0]) }}>{liveNames[other[0]]}</span>+<span style={{ color: getColor(other[1]) }}>{liveNames[other[1]]}</span>
                        </>
                      );
                    })()}
                  </div>
                  {!hzBonus && <div style={{ fontSize: 10, color: "var(--dim)", textAlign: "center", marginBottom: 8 }}>No bonus (multiplier applies)</div>}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8 }}>
                    Pick <span style={{ color: "var(--accent)", fontWeight: "600" }}>{getName(vp[0])}</span>'s partner
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {vp.slice(1).map(pi => {
                      const isPartner = vTeams[holeIdx][0].includes(pi);
                      const col = pi === GHOST_IDX ? (isLight ? "#666" : "#888") : COLORS[pi];
                      return (
                        <button key={pi} style={{ flex: 1, padding: "14px 0", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${isPartner ? col : "#1e3a1e"}`,
                          background: isPartner ? col+"33" : "transparent",
                          transition: "all 0.15s" }}
                          onClick={() => { const others=vp.slice(1).filter(x=>x!==pi); setVTeam(holeIdx,0,[vp[0],pi]); setVTeam(holeIdx,1,others); }}>
                          <div style={{ fontSize: 26, fontWeight: "800", color: isPartner?(pi===GHOST_IDX?col:(isLight?COLORS_LIGHT[pi]:COLORS[pi])):(isLight?"#666666":"#5a8a5a"), marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>{getName(pi)}</div>
                          <div style={{ fontSize: 30, fontWeight: "700", color: isPartner?col:"#3a5a3a", lineHeight: 1, fontFamily: "'Bebas Neue', sans-serif" }}>{isPartner ? "✓" : "—"}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: "700", color: "var(--text)", marginBottom: 8 }}>
                    <span style={{ color: "var(--accent)" }}>{getName(vTeams[holeIdx][0][0])}</span>+<span style={{ color: getColor(vTeams[holeIdx][0][1]) }}>{getName(vTeams[holeIdx][0][1])}</span>
                    {" "}<span style={{ color: "#2a4a2a" }}>vs</span>{" "}
                    <span style={{ color: getColor(vTeams[holeIdx][1][0]) }}>{getName(vTeams[holeIdx][1][0])}</span>+<span style={{ color: getColor(vTeams[holeIdx][1][1]) }}>{getName(vTeams[holeIdx][1][1])}</span>
                  </div>
                </>
              )}
              {res.vr && (() => {
                const r = res.vr;
                const t0 = res.teamsForVegas ? res.teamsForVegas[0] : vTeams[holeIdx][0];
                const t1 = res.teamsForVegas ? res.teamsForVegas[1] : vTeams[holeIdx][1];
                // For HZ, show Hero as "Hero×2" instead of Hero+Hero
                const t0name = hzEnabled ? `${liveNames[hzHero[holeIdx]]}×2` : t0.map(i=>getName(i)).join(" + ");
                const t1name = hzEnabled ? t1.map(i=>liveNames[i]).join(" + ") : t1.map(i=>getName(i)).join(" + ");
                const winnerIsA = r.tied ? r.grossWinnerIsA : r.effA < r.effB;
                const tied = r.tied && r.bonusA === 0 && r.bonusB === 0;
                const winnerName = winnerIsA != null ? (winnerIsA ? t0name : t1name) : null;
                const loserName  = winnerIsA != null ? (winnerIsA ? t1name : t0name) : null;
                const StepRow = ({ label, children }) => (
                  <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--text)", letterSpacing: 2, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                    {children}
                  </div>
                );
                const NumBadge = ({ val, flipped, winner }) => (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: "700", lineHeight: 1,
                      color: flipped ? "#f97316" : winner ? (isLight ? COLORS_LIGHT[0] : COLORS[0]) : "var(--text)",
                      fontFamily: "'Bebas Neue', sans-serif" }}>{val}</div>
                    {flipped && <div style={{ fontSize: 10, color: "#f97316", marginTop: 2 }}>FLIPPED</div>}
                    {winner && !flipped && <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>WINNER</div>}
                  </div>
                );
                return (
                  <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                    {/* Rule label */}
                    <div style={{ padding: "6px 12px", background: "var(--card)", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text)",or: "var(--dim)", letterSpacing: 2, fontFamily: "'DM Sans', sans-serif" }}>
                      {vegasRules === "classic" ? "CLASSIC RULES" : vegasRules === "double" ? "AGGRESSIVE RULES" : "STANDARD RULES"}
                    </div>
                    {/* Council/Double: Step 1 — Gross flip check + flipped numbers */}
                    {vegasRules !== "classic" && (
                      <StepRow label="STEP 1 — GROSS FLIP CHECK">
                        {(() => {
                          const gvA2 = vegasNum(parseInt(res.grossForVegas[t0[0]],10), parseInt(res.grossForVegas[t0[1]],10));
                          const gvB2 = vegasNum(parseInt(res.grossForVegas[t1[0]],10), parseInt(res.grossForVegas[t1[1]],10));
                          const tA = r.trigA || teamTrigger(res.grossForVegas[t0[0]], res.grossForVegas[t0[1]], h.par);
                          const tB = r.trigB || teamTrigger(res.grossForVegas[t1[0]], res.grossForVegas[t1[1]], h.par);
                          const bothTriggered = tA.flip && tB.flip;
                          const flipAppliedA = r.flipA; // A's number was flipped by B
                          const flipAppliedB = r.flipB; // B's number was flipped by A
                          const effGvA = flipAppliedA ? flipNum(gvA2) : gvA2;
                          const effGvB = flipAppliedB ? flipNum(gvB2) : gvB2;
                          return (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 6 }}>
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "700", marginBottom: 2 }}>{t0name}</div>
                                  <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>gross: {gvA2}</div>
                                  <div style={{ fontSize: 10, color: tA.flip ? "#f97316" : "var(--dim)", marginBottom: 4 }}>{tA.flip ? "triggers flip" + (tA.mult > 1 ? " ×"+tA.mult : "") + (tA.bonus > 0 ? " +"+tA.bonus : "") : "no trigger"}</div>
                                  {flipAppliedA && <><div style={{ fontSize: 10, color: "#f97316" }}>→ flipped to</div><div style={{ fontSize: 28, fontWeight: "700", color: "#f97316", fontFamily: "'Bebas Neue', sans-serif" }}>{effGvA}</div></>}
                                  {!flipAppliedA && <div style={{ fontSize: 28, fontWeight: "700", color: "var(--text)", fontFamily: "'Bebas Neue', sans-serif" }}>{gvA2}</div>}
                                </div>
                                <div style={{ textAlign: "center", alignSelf: "center" }}>
                                  <div style={{ fontSize: 12, color: "var(--dim)" }}>vs</div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "700", marginBottom: 2 }}>{t1name}</div>
                                  <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>gross: {gvB2}</div>
                                  <div style={{ fontSize: 10, color: tB.flip ? "#f97316" : "var(--dim)", marginBottom: 4 }}>{tB.flip ? "triggers flip" + (tB.mult > 1 ? " ×"+tB.mult : "") + (tB.bonus > 0 ? " +"+tB.bonus : "") : "no trigger"}</div>
                                  {flipAppliedB && <><div style={{ fontSize: 10, color: "#f97316" }}>→ flipped to</div><div style={{ fontSize: 28, fontWeight: "700", color: "#f97316", fontFamily: "'Bebas Neue', sans-serif" }}>{effGvB}</div></>}
                                  {!flipAppliedB && <div style={{ fontSize: 28, fontWeight: "700", color: "var(--text)", fontFamily: "'Bebas Neue', sans-serif" }}>{gvB2}</div>}
                                </div>
                              </div>
                              {bothTriggered && vegasRules === "council" && <div style={{ fontSize: 11, color: "#f97316", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>Both triggered — flips cancel out</div>}
                              {bothTriggered && vegasRules === "double" && <div style={{ fontSize: 11, color: "#f97316", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>Both triggered — both flips apply</div>}
                              {!tA.flip && !tB.flip && <div style={{ fontSize: 11, color: "var(--text)", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>No flip triggered</div>}
                            </div>
                          );
                        })()}
                      </StepRow>
                    )}
                    {/* Step 1 (classic) / Step 2 (council/double) — Nett Vegas numbers */}
                    <StepRow label={vegasRules === "classic" ? "STEP 1 — NETT VEGAS NUMBERS" : "STEP 2 — NETT VEGAS NUMBERS"}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, color: "var(--text)", marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>{t0name}</div>
                          <NumBadge val={vegasRules === "classic" ? r.vA : r.effA} flipped={false} winner={!r.tied && winnerIsA && (vegasRules !== "classic" || (!r.flipA && !r.flipB))} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: r.tied ? "#60a5fa" : "#3a6a3a", fontFamily: "'DM Sans', sans-serif", fontWeight: r.tied ? "700" : "400" }}>{r.tied ? "TIED" : "vs"}</div>
                          {r.tied && <div style={{ fontSize: 10, color: "#60a5fa", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>check gross</div>}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, color: "var(--text)", marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>{t1name}</div>
                          <NumBadge val={vegasRules === "classic" ? r.vB : r.effB} flipped={false} winner={!r.tied && !winnerIsA && (vegasRules !== "classic" || (!r.flipA && !r.flipB))} />
                        </div>
                      </div>
                    </StepRow>
                    {/* Step 2 — Gross tiebreak (only on nett tie with bonus) */}
                    {r.tied && (r.bonusA > 0 || r.bonusB > 0) && (
                      <StepRow label="STEP 2 — GROSS VEGAS TIEBREAK (bonus only)">
                        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                          Nett tied — using gross Vegas numbers to award bonus
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, color: "var(--text)", marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>{t0name}</div>
                            <div style={{ fontSize: 28, fontWeight: "700", color: r.grossWinnerIsA ? COLORS[0] : "#e8f5e8", fontFamily: "'Bebas Neue', sans-serif" }}>
                              {vegasNum(parseInt(res.grossForVegas[t0[0]],10), parseInt(res.grossForVegas[t0[1]],10))}
                            </div>
                            {r.grossWinnerIsA && <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>WINS BONUS</div>}
                          </div>
                          <div style={{ fontSize: 13, color: "#3a6a3a" }}>vs</div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, color: "var(--text)", marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>{t1name}</div>
                            <div style={{ fontSize: 28, fontWeight: "700", color: !r.grossWinnerIsA ? COLORS[0] : "#e8f5e8", fontFamily: "'Bebas Neue', sans-serif" }}>
                              {vegasNum(parseInt(res.grossForVegas[t1[0]],10), parseInt(res.grossForVegas[t1[1]],10))}
                            </div>
                            {!r.grossWinnerIsA && <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>WINS BONUS</div>}
                          </div>
                        </div>
                      </StepRow>
                    )}
                    {/* Classic only: Step 2 — Flip */}
                    {vegasRules === "classic" && (r.flipA || r.flipB) && (
                      <StepRow label="STEP 2 — FLIP (winner flips loser nett)">
                        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                          {winnerName} triggered a flip
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
                          <NumBadge val={r.effA} flipped={r.flipA} winner={winnerIsA && !r.flipA} />
                          <div style={{ fontSize: 13, color: "#3a6a3a" }}>vs</div>
                          <NumBadge val={r.effB} flipped={r.flipB} winner={!winnerIsA && !r.flipB} />
                        </div>
                      </StepRow>
                    )}
                    {/* Step 3 or 4 — Difference & multiplier */}
                    {!tied && (
                      <StepRow label={vegasRules === "classic" ? `STEP ${r.flipA || r.flipB ? "3" : "2"} — DIFFERENCE${r.mult > 1 ? " × MULTIPLIER" : ""}` : `STEP 3 — DIFFERENCE${r.mult > 1 ? " × MULTIPLIER" : ""}`}>
                        {(() => {
                          const dA = (vegasRules === "double" && r.effForDiffA !== undefined) ? r.effForDiffA : r.effA;
                          const dB = (vegasRules === "double" && r.effForDiffB !== undefined) ? r.effForDiffB : r.effB;
                          const diff = Math.abs(dA - dB);
                          return (
                            <div>
                              {vegasRules === "double" && (dA !== r.effA || dB !== r.effB) && (
                                <div style={{ fontSize: 12, color: "#f97316", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
                                  Winner reverts to original: {winnerIsA ? dA : dB} (was {winnerIsA ? r.effA : r.effB})
                                </div>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 14, color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>
                                  |{dA} − {dB}| = <span style={{ color: "var(--text)", fontWeight: "700" }}>{diff}</span>
                                </span>
                                {r.mult > 1 && (
                                  <span style={{ fontSize: 14, color: "#e879f9", fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>
                                    × {r.mult} = <span style={{ color: "var(--text)" }}>{diff * r.mult} pts</span>
                                  </span>
                                )}
                                {r.mult === 1 && (
                                  <span style={{ fontSize: 14, color: "var(--accent)", fontFamily: "'DM Sans', sans-serif" }}>
                                    = <strong>{diff} pts</strong>
                                  </span>
                                )}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, color: "var(--accent)", fontFamily: "'DM Sans', sans-serif" }}>
                                🏆 {winnerName} wins {diff * r.mult} pt{diff * r.mult !== 1 ? "s" : ""}
                              </div>
                            </div>
                          );
                        })()}
                      </StepRow>
                    )}
                    {/* Bonus step */}
                    {(r.bonusA > 0 || r.bonusB > 0) && (
                      <StepRow label={r.tied ? "STEP 3 — BONUS" : vegasRules === "classic" ? `STEP ${r.flipA || r.flipB ? "4" : "3"} — BONUS` : "STEP 4 — BONUS"}>
                        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                          {r.bonusA > 0
                            ? `${t0name} earned a +${r.bonusA} pt bonus`
                            : `${t1name} earned a +${r.bonusB} pt bonus`}
                        </div>
                      </StepRow>
                    )}
                    {/* Final result */}
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "var(--text)", letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                        {tied ? "RESULT — TIED" : r.tied ? "RESULT — NETT TIED (BONUS ONLY)" : "RESULT"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(4,1fr)`, gap: 6 }}>
                        {vp.map(pi => {
                          if (pi === GHOST_IDX && ghostEnabled) return null; // hide Ghost from $ display
                          const v = res.vd[pi];
                          return (
                            <div key={pi} style={{ background: "var(--card)", borderRadius: 6, padding: "8px 4px", textAlign: "center", border: `1px solid ${v>0?"#2a5a2a":v<0?"#5a2a2a":"#1e3a1e"}` }}>
                              <div style={{ fontSize: 15, color: isLight?COLORS_LIGHT[pi]:COLORS[pi], marginBottom: 2, fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>{names[pi]||`P${pi+1}`}</div>
                              <div style={{ fontSize: 26, fontWeight: "700", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontFamily: "'Bebas Neue', sans-serif" }}>
                                {v > 0 ? "+" : ""}{v}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Sect>
            </div>}
            {/* Banker */}
            {games.p3 && h.par === 3 && (
              <div style={{ opacity: inPlay[holeIdx] ? 1 : 0.4, pointerEvents: inPlay[holeIdx] ? "auto" : "none" }}>
              <Sect title="Banker">
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: "var(--text)", fontWeight: "600", marginBottom: 8 }}>Banker</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {vp.map(pi => (
                      <button key={pi} style={{ flex: 1, padding: "12px 0", borderRadius: 8, cursor: "pointer", fontSize: 13,
                        border: `1px solid ${banker[holeIdx]===pi?(isLight?COLORS_LIGHT[pi]:COLORS[pi]):"var(--border)"}`,
                        background: banker[holeIdx]===pi?(isLight?COLORS_LIGHT[pi]:COLORS[pi])+"33":"transparent",
                        color: banker[holeIdx]===pi?(isLight?COLORS_LIGHT[pi]:COLORS[pi]):"var(--dim)",
                        fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: "700" }}
                        onClick={() => { setBanker(prev => { const n=[...prev]; n[holeIdx]=pi; return n; }); }}>
                        {names[pi]||`P${pi+1}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "var(--text)", fontWeight: "600", marginBottom: 8 }}>Multipliers (tap to cycle 1→2→3)</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {vp.map(pi => (
                      <button key={pi} style={{ flex: 1, padding: "16px 0", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${p3mult[holeIdx][pi]>1?COLORS[pi]:"#1e3a1e"}`,
                        background: p3mult[holeIdx][pi]>1?COLORS[pi]+"22":"transparent",
                        fontFamily: "'DM Sans', sans-serif" }}
                        onClick={() => toggleMult(holeIdx, pi)}>
                        <div style={{ fontSize: 20, color: isLight?COLORS_LIGHT[pi]:COLORS[pi], marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: "800" }}>{liveNames[pi]}</div>
                        <div style={{ fontSize: 32, fontWeight: "700", color: p3mult[holeIdx][pi]>1?COLORS[pi]:"#5a8a5a", lineHeight: 1, fontFamily: "'Bebas Neue', sans-serif" }}>×{p3mult[holeIdx][pi]}</div>
                      </button>
                    ))}
                  </div>
                  {/* Effective matchup multipliers */}
                  <div style={{ marginTop: 10, background: "var(--input)", borderRadius: 8, padding: "8px 10px", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, color: "var(--text)", letterSpacing: 2, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>STAKES PER MATCHUP</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {vp.filter(pi => pi !== banker[holeIdx]).map(pi => {
                        const bMult = p3mult[holeIdx][banker[holeIdx]];
                        const pMult = p3mult[holeIdx][pi];
                        const effective = bMult * pMult;
                        return (
                          <div key={pi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 16, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600" }}>
                              <span style={{ color: isLight?COLORS_LIGHT[banker[holeIdx]]:COLORS[banker[holeIdx]] }}>{liveNames[banker[holeIdx]]}</span>
                              {" vs "}
                              <span style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi] }}>{liveNames[pi]}</span>
                            </span>
                            <span style={{ fontSize: 18, fontWeight: "700", color: effective > 1 ? "#e879f9" : "#4a7a4a", fontFamily: "'Bebas Neue', sans-serif" }}>
                              ×{effective}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Sect>
              </div>
            )}
            {/* Nassau inline status */}
            {matchupEnabled && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div className="sect-title" style={{ fontSize: 13, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>Match</div>
                  <button onClick={triggerBackStrokeModal}
                    style={{ padding: "4px 12px", background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--accent)", cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                    Turn Adj
                  </button>
                </div>
                {matchups.map((m, mi) => {
                  const r = matchupResults[mi];
                  if (!r) return null;
                  const p1col = isLight ? COLORS_LIGHT[m.p1] : COLORS[m.p1];
                  const p2col = isLight ? COLORS_LIGHT[m.p2] : COLORS[m.p2];
                  const isGDB = m.type === "gdb";
                  const isMatchPlay = m.type === "matchplay";
                  const isStrokePlay = m.type === "stroke";
                  const segLabel = (seg) => {
                    if (!seg || seg.holesPlayed === 0) return <span style={{ color: "var(--text)", fontWeight: "600" }}>—</span>;
                    if (seg.status === 0) return <span style={{ color: "var(--text)", fontWeight: "700" }}>AS</span>;
                    const col = seg.status > 0 ? p1col : p2col;
                    const name = seg.status > 0 ? liveNames[m.p1] : liveNames[m.p2];
                    return <span style={{ color: col, fontWeight: "700" }}>{name} {Math.abs(seg.status)} UP</span>;
                  };
                  // GDB segment from the current 9
                  const gdbSeg = isGDB ? (holeIdx < 9 ? r.front : r.back) : null;
                  return (
                    <div key={mi} style={{ background: "var(--card)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: `2px solid ${isLight?"#888":"#3a5a3a"}` }}>
                      <div style={{ fontSize: 18, fontWeight: "800", color: "var(--text)", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                        <span style={{ fontSize: 11, color: "var(--text)", fontWeight: "600", letterSpacing: 1, display: "block", marginBottom: 2 }}>MATCH {mi+1} · {isGDB ? "GDB (Game/Dormie/Bye)" : isMatchPlay ? "MATCH PLAY" : isStrokePlay ? "STROKE PLAY" : "NASSAU"}</span>
                        <span style={{ color: p1col }}>{liveNames[m.p1]}</span> <span style={{ color: "var(--dim)", fontSize: 14 }}>vs</span> <span style={{ color: p2col }}>{liveNames[m.p2]}</span>
                        <span style={{ fontSize: 12, fontWeight: "500", color: "var(--text)", marginLeft: 6 }}>{(() => {
                          const eff = holeIdx < 9 ? m.strokesFront : m.strokesBack;
                          if (eff === 0) return "scratch";
                          const giver = eff > 0 ? m.p1 : m.p2;
                          const receiver = eff > 0 ? m.p2 : m.p1;
                          const map = holeIdx < 9 ? r.strokeMaps.front : r.strokeMaps.back;
                          const receiverSet = eff > 0 ? map.p2 : map.p1;
                          const siList = [...receiverSet].sort((a,b)=>a-b).join(",");
                          return `${liveNames[giver]} gives ${liveNames[receiver]} ${Math.abs(eff)} (SI ${siList})`;
                        })()}</span>
                      </div>
                                    {(() => {
                        const strk = strokesForHole(holeIdx, h.si, r.strokeMaps);
                        const g1 = parseInt(gross[holeIdx][m.p1], 10);
                        const g2 = parseInt(gross[holeIdx][m.p2], 10);
                        // For stroke play we DO cap (par+3 par3, par+4 par4/5) since the totals are summed.
                        // For Nassau/GDB/Match Play: no display cap — match the W/L logic those games use.
                        const par = h.par;
                        const cap = par === 3 ? par + 3 : par + 4;
                        const rawN1 = (inPlay[holeIdx] && !isNaN(g1) && g1 > 0) ? (g1 - strk.p1) : null;
                        const rawN2 = (inPlay[holeIdx] && !isNaN(g2) && g2 > 0) ? (g2 - strk.p2) : null;
                        const nn1 = isStrokePlay && rawN1 !== null ? Math.min(rawN1, cap) : rawN1;
                        const nn2 = isStrokePlay && rawN2 !== null ? Math.min(rawN2, cap) : rawN2;
                        const holeWL = nn1 !== null && nn2 !== null ? (nn1 < nn2 ? 1 : nn2 < nn1 ? -1 : 0) : null;
                        return (
                          <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                            {[{pi: m.p1, col: p1col, nn: nn1}, {pi: m.p2, col: p2col, nn: nn2}].map(({pi, col, nn}, idx) => {
                              const nettDiff = nn !== null ? nn - h.par : null;
                              const winThisHole = holeWL !== null && ((idx === 0 && holeWL === 1) || (idx === 1 && holeWL === -1));
                              const gotStroke = idx === 0 ? strk.p1 > 0 : strk.p2 > 0;
                              const strokeCount = idx === 0 ? strk.p1 : strk.p2;
                              return (
                                <div key={pi} style={{ flex: 1, textAlign: "center", background: winThisHole ? col+"33" : "var(--input)", borderRadius: 8, padding: "8px 6px", border: `2px solid ${winThisHole ? col : gotStroke ? (isLight?"#16a34a":COLORS[0]) : "var(--border)"}` }}>
                                  <div style={{ fontSize: 13, color: col, fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>
                                    {liveNames[pi]}
                                    {gotStroke && <span style={{ color: isLight?"#16a34a":COLORS[0], fontSize: 10, marginLeft: 3 }}>+{strokeCount}</span>}
                                  </div>
                                  <div style={{ fontSize: 32, fontWeight: "700", color: nn !== null ? col : "var(--dim)", fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>
                                    {nn !== null ? nn : "—"}
                                  </div>
                                  {nettDiff !== null && (
                                    <div style={{ fontSize: 12, fontWeight: "600", color: nettDiff < 0 ? (isLight?"#16a34a":COLORS[0]) : nettDiff > 0 ? "var(--neg)" : "var(--muted)", fontFamily: "'DM Sans', sans-serif" }}>
                                      {nettDiff < 0 ? nettDiff : nettDiff > 0 ? `+${nettDiff}` : "par"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div style={{ fontSize: 22, fontFamily: "'DM Sans', sans-serif", minWidth: 32, textAlign: "center" }}>
                              {holeWL === null ? <span style={{ color: "var(--dim)" }}>—</span> : holeWL === 0 ? <span style={{ color: "var(--muted)" }}>½</span> : holeWL === 1 ? <span style={{ color: p1col }}>▲</span> : <span style={{ color: p2col }}>▲</span>}
                            </div>
                          </div>
                        );
                      })()}
                      {/* Nassau: Front/Back/Overall status boxes */}
                      {!isGDB && !isMatchPlay && !isStrokePlay && (
                        <div style={{ display: "flex", gap: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
                          {[["FRONT", r.front], ["BACK", r.back], ["OVERALL", r.overall]].map(([label, seg]) => (
                            <div key={label} style={{ flex: 1, textAlign: "center", background: "var(--input)", borderRadius: 6, padding: "6px 6px" }}>
                              <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, fontWeight: "700" }}>{label}</div>
                              <div style={{ fontWeight: "700", color: "var(--text)", fontSize: 15 }}>{segLabel(seg)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Match play: running hole count */}
                      {/* Stroke play: F/B/Overall diff boxes */}
                      {isStrokePlay && (() => {
                        const u = m.units || [1, 1, 2];
                        const segBox = (label, seg, unit) => {
                          const muted = unit === 0;
                          const txtCol = muted ? "var(--dim)" : seg.holesPlayed === 0 ? "var(--text)"
                            : seg.diff === 0 ? "var(--text)"
                            : seg.diff > 0 ? p1col : p2col;
                          const text = seg.holesPlayed === 0 ? "—"
                            : seg.diff === 0 ? "AS"
                            : `${seg.diff > 0 ? liveNames[m.p1] : liveNames[m.p2]} ${Math.abs(seg.diff)}`;
                          const dollarPreview = muted ? "" : seg.diff === 0 ? "" : `$${Math.abs(seg.diff * m.stake * unit)}`;
                          return (
                            <div key={label} style={{ flex: 1, textAlign: "center", background: "var(--input)", borderRadius: 6, padding: "6px 6px", opacity: muted ? 0.4 : 1 }}>
                              <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, fontWeight: "700" }}>{label} ×{unit}</div>
                              <div style={{ fontWeight: "700", color: txtCol, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>{text}</div>
                              {dollarPreview && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{dollarPreview}</div>}
                            </div>
                          );
                        };
                        return (
                          <div style={{ display: "flex", gap: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
                            {segBox("FRONT",   r.front,   u[0])}
                            {segBox("BACK",    r.back,    u[1])}
                            {segBox("OVERALL", r.overall, u[2])}
                          </div>
                        );
                      })()}
                      {/* Match Play: F/B/Overall diff boxes (net holes won) */}
                      {isMatchPlay && (() => {
                        const u = m.units || [0, 0, 1];
                        const segBox = (label, seg, unit) => {
                          const muted = unit === 0;
                          const txtCol = muted ? "var(--dim)" : seg.holesPlayed === 0 ? "var(--text)"
                            : seg.status === 0 ? "var(--text)"
                            : seg.status > 0 ? p1col : p2col;
                          const text = seg.holesPlayed === 0 ? "—"
                            : seg.status === 0 ? "AS"
                            : `${seg.status > 0 ? liveNames[m.p1] : liveNames[m.p2]} ${Math.abs(seg.status)} UP`;
                          const dollarPreview = muted ? "" : seg.status === 0 ? "" : `$${Math.abs(seg.status * m.stake * unit)}`;
                          return (
                            <div key={label} style={{ flex: 1, textAlign: "center", background: "var(--input)", borderRadius: 6, padding: "6px 6px", opacity: muted ? 0.4 : 1 }}>
                              <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, fontWeight: "700" }}>{label} ×{unit}</div>
                              <div style={{ fontWeight: "700", color: txtCol, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>{text}</div>
                              {dollarPreview && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{dollarPreview}</div>}
                            </div>
                          );
                        };
                        return (
                          <div style={{ display: "flex", gap: 8, fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
                            {segBox("FRONT",   r.front,   u[0])}
                            {segBox("BACK",    r.back,    u[1])}
                            {segBox("OVERALL", r.overall, u[2])}
                          </div>
                        );
                      })()}
                      {/* Press status */}
                      {!isGDB && !isMatchPlay && !isStrokePlay && r.presses?.length > 0 && r.presses.map((p, pi) => (
                        <div key={pi} style={{ marginTop: 6, background: "var(--input)", borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, fontWeight: "700" }}>PRESS {pi+1} (from H{p.startHole})</span>
                          <span style={{ fontSize: 14, fontWeight: "700", color: "var(--text)" }}>{segLabel(p)}</span>
                        </div>
                      ))}
                      {/* GDB: Game + Dormie/Bye status */}
                      {isGDB && gdbSeg && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", gap: 8, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                            <div style={{ flex: 2, textAlign: "center", background: "var(--input)", borderRadius: 6, padding: "6px 8px" }}>
                              <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, fontWeight: "700" }}>GAME ×3 · {holeIdx < 9 ? "FRONT" : "BACK"} {gdbSeg.holesPlayed > 0 ? `(${gdbSeg.holesPlayed} played)` : ""}</div>
                              <div style={{ fontWeight: "700", color: "var(--text)", fontSize: 15 }}>{segLabel(gdbSeg.game)}</div>
                            </div>
                            <div style={{ flex: 1, textAlign: "center", background: gdbSeg.dormie ? "var(--card)" : "var(--input)", borderRadius: 6, padding: "6px 4px", border: gdbSeg.dormie ? "1px solid var(--border2)" : "none" }}>
                              <div style={{ fontSize: 10, color: gdbSeg.dormie ? "var(--accent)" : "var(--dim)", letterSpacing: 1, fontWeight: "700" }}>DORMIE ×1</div>
                              <div style={{ fontWeight: "700", fontSize: 12 }}>
                                {gdbSeg.dormie
                                  ? <><div style={{ fontSize: 9, color: "var(--muted)" }}>from H{gdbSeg.dormie.startHole}</div><span style={{ color: "var(--accent)" }}>{segLabel(gdbSeg.dormie)}</span></>
                                  : <span style={{ color: "var(--dim)" }}>—</span>}
                              </div>
                            </div>
                            <div style={{ flex: 1, textAlign: "center", background: gdbSeg.buy ? "var(--card)" : "var(--input)", borderRadius: 6, padding: "6px 4px", border: gdbSeg.buy ? "1px solid var(--border2)" : "none" }}>
                              <div style={{ fontSize: 10, color: gdbSeg.buy ? "var(--accent)" : "var(--dim)", letterSpacing: 1, fontWeight: "700" }}>BYE ×1</div>
                              <div style={{ fontWeight: "700", fontSize: 12 }}>
                                {gdbSeg.buy
                                  ? <><div style={{ fontSize: 9, color: "var(--muted)" }}>from H{gdbSeg.buy.startHole}</div><span style={{ color: "var(--accent)" }}>{segLabel(gdbSeg.buy)}</span></>
                                  : <span style={{ color: "var(--dim)" }}>—</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Points this hole — only when 2+ players and at least one game active */}
            {N > 1 && !!(games.vegas || games.ct || (games.p3 && h.par === 3)) && (
            <Sect title={`Hole ${holeIdx+1} Points`}>
              <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${vp.length}, 1fr)`, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ padding: "8px 10px" }} />
                  {vp.map(pi => (
                    <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 17, color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>{liveNames[pi]}</div>
                  ))}
                </div>
                        {games.vegas && (
                  <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${vp.length}, 1fr)`, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ padding: "8px 10px", fontSize: 17, fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>Vegas</div>
                    {vp.map(pi => {
                      const v = inPlay[holeIdx] ? res.vd[pi] : 0;
                      return <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 15, fontWeight: "600", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                    })}
                  </div>
                )}
                        {games.ct && (
                  <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${vp.length}, 1fr)`, borderBottom: (games.p3 && h.par===3)?"1px solid #0d2210":"none" }}>
                    <div style={{ padding: "8px 8px", fontSize: 14, fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>Cut Throat</div>
                    {vp.map(pi => {
                      const v = inPlay[holeIdx] ? res.ct[pi] : 0;
                      return <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 15, fontWeight: "600", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                    })}
                  </div>
                )}
                {/* Banker row — only on par 3s */}
                {games.p3 && h.par === 3 && (
                  <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${vp.length}, 1fr)` }}>
                    <div style={{ padding: "8px 10px", fontSize: 17, fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>Banker</div>
                    {vp.map(pi => {
                      const v = inPlay[holeIdx] ? res.p3[pi] : 0;
                      return <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 15, fontWeight: "600", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                    })}
                  </div>
                )}
              </div>
            </Sect>
            )}

            {/* Points Game standalone section */}
            {N > 1 && games.pts && (
            <Sect title={`Hole ${holeIdx+1} Points`}>
              <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${N}, 1fr)`, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ padding: "8px 10px" }} />
                  {players.map(pi => (
                    <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 15, color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", fontFamily: "'DM Sans', sans-serif" }}>{(liveNames[pi]||`P${pi+1}`).slice(0,5)}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${N}, 1fr)`, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ padding: "8px 10px", fontSize: 15, fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>This hole</div>
                  {players.map(pi => {
                    const v = inPlay[holeIdx] ? res.pts[pi] : null;
                    return <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 15, fontWeight: "700", color: v===null?"var(--dim)":v>=(N-1)?(isLight?"#16a34a":COLORS[0]):"var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{v !== null ? v : "—"}</div>;
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${N}, 1fr)` }}>
                  <div style={{ padding: "8px 10px", fontSize: 15, fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>Total pts</div>
                  {players.map(pi => {
                    const cum = ptsCum[pi];
                    const maxCum = Math.max(...players.map(p => ptsCum[p]));
                    return <div key={pi} style={{ padding: "8px 4px", textAlign: "center", fontSize: 22, fontWeight: "700", color: cum===maxCum&&cum>0?(isLight?"#16a34a":COLORS[0]):"var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{cum}</div>;
                  })}
                </div>
              </div>
            </Sect>
            )}

            {/* Sixes standalone section */}
            {sixesEnabled && (() => {
              const segIdx = sixesData.holeAssignments[holeIdx];
              if (segIdx === null || segIdx === undefined) {
                // Hole not yet played / not in play — show context for current segment
                if (sixesData.currentSeg >= 3) return null; // all segments closed
                const seg = sixesData.segments[sixesData.currentSeg];
                const relT1 = Math.max(0, seg.t1pts - seg.t2pts);
                const relT2 = Math.max(0, seg.t2pts - seg.t1pts);
                return (
                  <Sect title={`Sixes — ${["1st", "2nd", "3rd"][sixesData.currentSeg]}`}>
                    <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", padding: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 15 }}>
                        <div style={{ flex: 1 }}>
                          {seg.teams[0].map(pi => {
                            const shadowed = N === 5 && sixesConfig.shadowOf?.[sixesData.holeAssignments[holeIdx] ?? sixesData.currentSeg] === pi;
                            return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginRight: 6 }}>
                              {(liveNames[pi]||`P${pi+1}`).slice(0,5)}
                              {shadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2, fontSize: 11 }}>+{(liveNames[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                            </span>;
                          })}
                        </div>
                        <span style={{ color: "var(--dim)", fontSize: 12 }}>vs</span>
                        <div style={{ flex: 1, textAlign: "right" }}>
                          {seg.teams[1].map(pi => {
                            const shadowed = N === 5 && sixesConfig.shadowOf?.[sixesData.holeAssignments[holeIdx] ?? sixesData.currentSeg] === pi;
                            return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginLeft: 6 }}>
                              {(liveNames[pi]||`P${pi+1}`).slice(0,5)}
                              {shadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2, fontSize: 11 }}>+{(liveNames[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                            </span>;
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 26, fontWeight: "700" }}>
                        <span style={{ color: relT1 > 0 ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{relT1}</span>
                        <span style={{ color: "var(--dim)", fontSize: 18 }}>—</span>
                        <span style={{ color: relT2 > 0 ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{relT2}</span>
                      </div>
                    </div>
                  </Sect>
                );
              }
              const seg = sixesData.segments[segIdx];
              const thisHole = seg.holes.find(h => h.hi === holeIdx);
              if (!thisHole) return null;
              const relT1 = Math.max(0, seg.t1pts - seg.t2pts);
              const relT2 = Math.max(0, seg.t2pts - seg.t1pts);
              const closeLabel = seg.closed
                ? (seg.closedEarly ? ` (closed early — ${seg.holes.length} holes)` : ` (closed)`)
                : "";
              return (
                <Sect title={`Sixes — ${["1st", "2nd", "3rd"][segIdx]}${closeLabel}`}>
                  <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", padding: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    {/* Teams row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 15 }}>
                      <div style={{ flex: 1 }}>
                        {seg.teams[0].map(pi => {
                            const shadowed = N === 5 && sixesConfig.shadowOf?.[sixesData.holeAssignments[holeIdx] ?? sixesData.currentSeg] === pi;
                            return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginRight: 6 }}>
                              {(liveNames[pi]||`P${pi+1}`).slice(0,5)}
                              {shadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2, fontSize: 11 }}>+{(liveNames[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                            </span>;
                          })}
                      </div>
                      <span style={{ color: "var(--dim)", fontSize: 12 }}>vs</span>
                      <div style={{ flex: 1, textAlign: "right" }}>
                        {seg.teams[1].map(pi => {
                            const shadowed = N === 5 && sixesConfig.shadowOf?.[sixesData.holeAssignments[holeIdx] ?? sixesData.currentSeg] === pi;
                            return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginLeft: 6 }}>
                              {(liveNames[pi]||`P${pi+1}`).slice(0,5)}
                              {shadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2, fontSize: 11 }}>+{(liveNames[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                            </span>;
                          })}
                      </div>
                    </div>
                    {/* This hole's result */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, color: "var(--text)", marginBottom: 8 }}>
                      <span>This hole:</span>
                      <span style={{ fontWeight: "700", fontSize: 17, color: thisHole.t1pts > thisHole.t2pts ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{thisHole.t1pts}</span>
                      <span style={{ color: "var(--dim)" }}>—</span>
                      <span style={{ fontWeight: "700", fontSize: 17, color: thisHole.t2pts > thisHole.t1pts ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{thisHole.t2pts}</span>
                    </div>
                    {/* Segment running tally (relative) */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 28, fontWeight: "700", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <span style={{ color: relT1 > 0 ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{relT1}</span>
                      <span style={{ color: "var(--dim)", fontSize: 18 }}>—</span>
                      <span style={{ color: relT2 > 0 ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{relT2}</span>
                    </div>
                  </div>
                </Sect>
              );
            })()}
          </>
        ) : (
          <TotalsView names={liveNames} results={results} holes={holes} vTeams={vTeams}
            vegasCum={vegasCum} ctCum={ctCum} p3Cum={p3Cum} ptsCum={ptsCum}
            dollars={dollarsTotal} dollarsSubtotal={dollars} playerCount={N}
            vegasVal={vegasVal} ctVal={ctVal} p3Val={p3Val} ptsVal={ptsVal} inPlay={inPlay}
            adjustments={adjustments} setAdjustments={setAdjustments}
            liveHcps={liveHcps} hcpThreshold={hcpThreshold} games={games}
            vegasPlayers={ghostEnabled ? vp.filter(i => i !== GHOST_IDX) : vp}
            matchupEnabled={matchupEnabled} nassauResults={matchupResults} matchups={matchups}
            sixesEnabled={sixesEnabled} sixesData={sixesData} sixesConfig={sixesConfig}
            sixesPlayerDollars={sixesPlayerDollars} sixesPlayerTokens={sixesPlayerTokens}
            qrPayload={qrPayload}
            hzEnabled={hzEnabled} ghostEnabled={ghostEnabled}
            roundId={roundId}
            saveMsg={saveMsg}
            onSave={() => {
              const roundData = {
                roundId,
                config: { ...config, _roundId: roundId, _savedState: { gross, vTeams, banker, p3mult, holeIdx, inPlay, liveHcps, liveNames, adjustments, matchups } },
                date: new Date().toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" }),
                courseName: config.courseName || "Round",
                savedAt: Date.now(),
              };
              onSave(roundData);
              setSaveMsg("Round saved ✓");
              setTimeout(() => setSaveMsg(""), 2500);
              // Log to Supabase (delayed to not block save UX)
              setTimeout(() => { logRound(); }, 1500);
            }}
            onExport={() => {
              const roundData = {
                roundId,
                config: { ...config, _roundId: roundId, _savedState: { gross, vTeams, banker, p3mult, holeIdx, inPlay, liveHcps, liveNames, adjustments, matchups } },
                date: new Date().toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" }),
                courseName: config.courseName || "Round",
                savedAt: Date.now(),
              };
              exportRound(roundData);
            }}
            onReport={async () => { try { const html = await generateReport({ names: liveNames, holes, liveHcps, inPlay, results, dollars: dollarsTotal, dollarsSubtotal: dollars, vegasCum, ctCum, p3Cum, ptsCum, vegasVal, ctVal, p3Val, ptsVal, adjustments, games, matchupEnabled, nassauResults: matchupResults, matchups, sixesEnabled, sixesData, sixesConfig, sixesPlayerDollars, sixesPlayerTokens, courseName: config.courseName, roundStartTime, qrPayload, playerCount: N, vegasPlayers: vp, vTeams, banker, p3mult, hioRule, ghostEnabled, hzEnabled, hzHero }); setReportHTML(html); } catch(e) { alert("Report error: " + e.message); console.error(e); } }}
            onHole={hi => { if (!inPlay[hi]) window.scrollTo(0,0); setHoleIdx(hi); setView("hole"); }}
            isLight={isLight} />
        )}
      </div>
        {view === "hole" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg)", borderTop: "1px solid var(--border)", padding: "10px 16px 10px", display: "flex", gap: 10, maxWidth: 480, margin: "0 auto" }}>
          <button className="hole-nav"
            disabled={holeIdx===0}
            onClick={() => { const next = holeIdx-1; if (!inPlay[next]) window.scrollTo(0,0); setHoleIdx(next); }}
            style={{ flex: 1, padding: "14px", background: "var(--card)", color: holeIdx===0?"var(--border)":"var(--accent)", border: `1px solid ${holeIdx===0?"var(--border)":"var(--border2)"}`, borderRadius: 10, cursor: holeIdx===0?"default":"pointer", fontSize: 15, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, transition: "all 0.15s" }}>
            ← PREV
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 60 }}>
            <div style={{ fontSize: 10, color: "#3a6a3a", fontFamily: "'DM Sans', sans-serif" }}>{completedCount}/18</div>
            <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>played</div>
          </div>
          <button className="hole-nav"
            disabled={holeIdx===17}
            onClick={() => { const next = holeIdx+1; if (!inPlay[next]) window.scrollTo(0,0); setHoleIdx(next); }}
            style={{ flex: 1, padding: "14px", background: "var(--border)", color: holeIdx===17?"var(--border)":"var(--accent)", border: `1px solid ${holeIdx===17?"var(--border)":"var(--border2)"}`, borderRadius: 10, cursor: holeIdx===17?"default":"pointer", fontSize: 15, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, transition: "all 0.15s" }}>
            NEXT →
          </button>
        </div>
      )}
    </div>
    {/* Inline report modal */}
    {reportHTML && (
      <div style={{ position:"fixed", inset:0, zIndex:300, background:"#fff", display:"flex", flexDirection:"column" }}>
        <div style={{ background:"#f3f4f6", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #e5e7eb", flexShrink:0 }}>
          <button onClick={() => setReportHTML(null)} style={{ background:"transparent", border:"none", color:"#16a34a", cursor:"pointer", fontSize:15, fontFamily:"'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontSize:15, fontWeight:"700", color:"#111", fontFamily:"'DM Sans', sans-serif" }}>Report</div>
          <button onClick={() => {
            const blob = new Blob([reportHTML], { type:"text/html" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "teebox-report.html";
            a.click();
          }} style={{ background:"transparent", border:"none", color:"#16a34a", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans', sans-serif" }}>⬇ Save</button>
        </div>
        <iframe srcDoc={reportHTML} style={{ flex:1, border:"none", width:"100%", minHeight:"80vh" }} title="Tee Box Report"/>
      </div>
    )}
    </>
  );
}

// TOTALS VIEW
function TotalsView({ names, results, holes, vTeams, vegasCum, ctCum, p3Cum, ptsCum, dollars, dollarsSubtotal, playerCount, vegasVal, ctVal, p3Val, ptsVal, inPlay, adjustments, setAdjustments, liveHcps, hcpThreshold, games, vegasPlayers, onSave, onExport, onReport, saveMsg, onHole, isLight, matchupEnabled, nassauResults: matchupResults, matchups, sixesEnabled, sixesData, sixesConfig, sixesPlayerDollars, sixesPlayerTokens, qrPayload, hzEnabled, ghostEnabled, roundId }) {
  const isSolo = playerCount === 1;
  const vp = vegasPlayers || [0,1,2,3];
  const [tab, setTab] = useState("board");
  const [showHcp, setShowHcp] = useState(false);
  const [showAdj, setShowAdj] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [copyStatus, setCopyStatus] = useState(""); // "", "ok", or "err: ..."
  async function copyPayloadToClipboard() {
    // Try modern API first; if it throws (iframe sandbox / permission denied), fall back.
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(qrPayload);
        setCopyStatus("ok");
        setTimeout(() => setCopyStatus(""), 2000);
        return;
      } catch (e) { /* fall through to legacy path */ }
    }
    // Fallback: hidden textarea + execCommand. Works in older Safari, sandboxed iframes,
    // and non-secure contexts. Less reliable on mobile but a good backstop.
    try {
      const ta = document.createElement("textarea");
      ta.value = qrPayload;
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, qrPayload.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) throw new Error("execCommand copy returned false");
      setCopyStatus("ok");
    } catch (e) {
      setCopyStatus("err: " + (e.message || "unknown"));
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }
  const hcpBase = dollarsSubtotal || dollars;
  const RP = names.map((_,i)=>i);
  const strokeAdj = RP.map(i => {
    const strokes = Math.floor(Math.abs(hcpBase[i]) / hcpThreshold);
    return hcpBase[i]>0 ? -strokes : hcpBase[i]<0 ? strokes : 0;
  });
  const adjHcps = RP.map(i => liveHcps[i] + strokeAdj[i]);
  const minHcp = Math.min(...adjHcps);
  const newRelHcps = adjHcps.map(h => h - minHcp);
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={onSave} style={{ flex: 2, padding: "13px", background: "var(--card)", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: "600", fontFamily: "'DM Sans', sans-serif" }}>
          💾 Save
        </button>
        <button onClick={onExport} style={{ flex: 1, padding: "13px", background: "transparent", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          ↑ Export
        </button>
        <button onClick={onReport} style={{ flex: 1, padding: "13px", background: "transparent", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          📄 Report
        </button>
      </div>
      {saveMsg && <div style={{ textAlign: "center", fontSize: 12, color: "var(--accent)", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{saveMsg}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[["board","TOTALS"],["vegas","VEGAS"],["ct","CT"],["par3","BANKER"],["pts","PTS"],["sixes","SIXES"],["nassau","MATCH"]].filter(([t]) => t==="board" || (!isSolo && ((t==="vegas"&&games.vegas) || (t==="ct"&&games.ct) || (t==="par3"&&games.p3) || (t==="pts"&&games.pts) || (t==="sixes"&&sixesEnabled) || (t==="nassau"&&matchupEnabled)))).map(([t,label]) => (
          <button key={t} className="tab-btn" onClick={() => setTab(t)}
            style={{ padding: "8px 12px", borderRadius: 6, fontSize: 11, letterSpacing: 1, cursor: "pointer",
              border: `1px solid ${tab===t?COLORS[0]:"var(--border)"}`,
              background: tab===t?COLORS[0]:"transparent",
              color: tab===t?"#0a1a0a":"var(--text)",
              fontWeight: tab===t?"bold":"normal",
              fontFamily: "'DM Sans', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "board" && (
        <>
          {isSolo && (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontSize: 14, background: "var(--card)", borderRadius: 8, marginBottom: 14 }}>
              Score keeping mode — no betting active
            </div>
          )}
          {!isSolo && <><Sect title="Totals">
            <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
              {/* Header */}
              {(() => {
                const minHcp = Math.min(...liveHcps);
                const relHcps = liveHcps.map(h => h - minHcp);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ padding: "5px 6px", fontSize: 11, color: "#3a6a3a" }} />
                    {RP.map(i => (
                      <div key={i} style={{ padding: "5px 3px", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                        <div style={{ fontSize: 14, color: isLight?COLORS_LIGHT[i]:COLORS[i], fontWeight: "700" }}>{(names[i]||"").slice(0,5)}</div>
                        {games.pts && <div style={{ fontSize: 10, color: "var(--text)" }}>{relHcps[i]}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {[[`Vegas${hzEnabled?" H":ghostEnabled?" G":""}`,"vegas",vegasCum,vegasVal],["CT","ct",ctCum,ctVal],["Banker","p3",p3Cum,p3Val]].filter(([,key])=>games[key]).map(([label,,cum,val]) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ padding: "5px 4px", fontSize: 13, color: "var(--text)", fontWeight: "600", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", whiteSpace: "nowrap" }}>{label}</div>
                  {RP.map(i => {
                    const v = cum[i]*val;
                    return <div key={i} style={{ padding: "5px 3px", textAlign: "center", fontSize: 14, fontWeight: "600", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                  })}
                </div>
              ))}
              {adjustments.some(a=>a!==0) && (
                <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ padding: "5px 6px", fontSize: 13, color: "var(--text)", fontWeight: "600", display: "flex", alignItems: "center" }}>Adj</div>
                  {RP.map(i => {
                    const v=adjustments[i];
                    return <div key={i} style={{ padding: "5px 3px", textAlign: "center", fontSize: 14, fontWeight: "600", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a" }}>{v>0?"+":""}{v||"—"}</div>;
                  })}
                </div>
              )}
              {/* Subtotal — only when Vegas/CT/Banker active */}
              {(games.vegas || games.ct || games.p3) && (
              <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, background: "var(--card)", borderBottom: (matchupEnabled||games.pts||sixesEnabled) ? "2px solid var(--border2)" : "none" }}>
                <div style={{ padding: "5px 6px", fontSize: 13, color: "var(--text)", fontWeight: "700", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>
                  {(matchupEnabled||games.pts||sixesEnabled) ? "Sub" : "TOTAL"}
                </div>
                {RP.map(i => {
                  const v = (dollarsSubtotal||dollars)[i];
                  return <div key={i} style={{ padding: (matchupEnabled||games.pts||sixesEnabled)?"8px 4px":"10px 4px", textAlign: "center", fontSize: (matchupEnabled||games.pts||sixesEnabled)?16:22, fontWeight: "700", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                })}
              </div>
              )}
              {/* 6-Point row — separate from subtotal */}
              {games.pts && ptsCum && (() => {
                const isMeal = !ptsVal || ptsVal === 0;
                const ptsDollars = RP.map(i => isMeal ? ptsCum[i] : RP.reduce((sum, j) => j !== i ? sum + (ptsCum[i] - ptsCum[j]) * ptsVal : sum, 0));
                const ptsLabel = isMeal ? "Pts (pt)" : `Pts ($${ptsVal})`;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length}, 1fr)`, borderBottom: (matchupEnabled?"1px solid var(--border)":"none") }}>
                    <div style={{ padding: "8px 6px", fontSize: 13, color: "var(--text)", fontWeight: "600", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", whiteSpace: "nowrap" }}>{ptsLabel}</div>
                    {RP.map(i => {
                      const v = ptsDollars[i];
                      const col = isMeal ? "var(--text)" : v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a";
                      return <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: "600", color: col, fontFamily: "'DM Sans', sans-serif" }}>{isMeal ? ptsCum[i] : (v>0?"+":"")+v||"—"}</div>;
                    })}
                  </div>
                );
              })()}
              
              {/* Sixes row */}
              {sixesEnabled && (() => {
                const isCash = sixesConfig.stakeType === "cash";
                const totalTokens = sixesPlayerTokens.reduce((s, v) => s + v, 0);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ padding: "8px 6px", display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>
                      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: "600", lineHeight: 1.1 }}>Sixes</div>
                      <div style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.1, marginTop: 2 }}>{isCash ? `$${sixesConfig.cashAmount}` : `${totalTokens} token${totalTokens===1?"":"s"}`}</div>
                    </div>
                    {RP.map(i => {
                      if (isCash) {
                        const v = sixesPlayerDollars[i];
                        const col = v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a";
                        return <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: "600", color: col, fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                      } else {
                        const v = sixesPlayerTokens[i];
                        return <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: "600", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>{v||"—"}</div>;
                      }
                    })}
                  </div>
                );
              })()}
              
              {/* Matchup rows — grouped by game type, plus aggregate */}
              {matchupEnabled && (() => {
                const typeOrder = [
                  ["nassau",    "Nassau"],
                  ["gdb",       "GDB"],
                  ["matchplay", "MatchP"],
                  ["stroke",    "StrokeP"],
                ];
                // Per-type per-player dollars
                const byType = {};
                typeOrder.forEach(([k]) => byType[k] = Array(RP.length).fill(0));
                const totalPD = Array(RP.length).fill(0);
                matchupResults.forEach((r, mi) => {
                  const m = matchups[mi];
                  const t = m.type || "nassau";
                  if (!byType[t]) byType[t] = Array(RP.length).fill(0);
                  byType[t][m.p1] += r.dollars.net;
                  byType[t][m.p2] -= r.dollars.net;
                  totalPD[m.p1] += r.dollars.net;
                  totalPD[m.p2] -= r.dollars.net;
                });
                const usedTypes = typeOrder.filter(([k]) => byType[k].some(v => v !== 0));
                const showSubtotal = usedTypes.length > 1;
                return <>
                  {usedTypes.map(([k, label]) => (
                    <div key={k} style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, borderBottom: "1px solid var(--border)" }}>
                      <div style={{ padding: "8px 6px", fontSize: 13, color: "var(--text)", fontWeight: "600", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", whiteSpace: "nowrap" }}>{label}</div>
                      {RP.map(i => {
                        const v = byType[k][i];
                        return <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 16, fontWeight: "600", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                      })}
                    </div>
                  ))}
                  {showSubtotal && (
                    <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, background: "var(--card)", borderBottom: "2px solid var(--border2)" }}>
                      <div style={{ padding: "5px 6px", fontSize: 13, color: "var(--text)", fontWeight: "700", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>Sub</div>
                      {RP.map(i => {
                        const v = totalPD[i];
                        return <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 16, fontWeight: "700", color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{v>0?"+":""}{v||"—"}</div>;
                      })}
                    </div>
                  )}
                </>;
              })()}
              {/* Grand total */}
              {(matchupEnabled || (games.pts && ptsVal > 0) || (sixesEnabled && sixesConfig.stakeType === "cash")) && (
                <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, background: "var(--card)" }}>
                  <div style={{ padding: "10px 10px", fontSize: 12, color: "var(--text)", fontWeight: "700", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>TOTAL</div>
                  {RP.map(i => (
                    <div key={i} style={{ padding: "10px 4px", textAlign: "center", fontSize: 22, fontWeight: "700", color: dollars[i]>0?(isLight?"#16a34a":COLORS[0]):dollars[i]<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>
                      {dollars[i]>0?"+":""}{dollars[i]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Sect>
          <CollapseSect title={`Next Round HCP (@ $${hcpThreshold}/stroke)`} open={showHcp} onToggle={() => setShowHcp(v=>!v)}>
            <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
              {[["Current HCP", liveHcps],["Adj", strokeAdj],["Adjusted", adjHcps],["New Rel HCP", newRelHcps]].map(([label, vals], ri) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: `56px repeat(${RP.length},1fr)`, borderBottom: ri<3?"1px solid #0d2210":"none", background: ri===3?"#0d2210":"transparent" }}>
                  <div style={{ padding: "8px 10px", fontSize: 11, color: ri===3?"#e8f5e8":"#5a8a5a", display: "flex", alignItems: "center", fontWeight: ri===3?"700":"400", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                  {RP.map(i => (
                    <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 14, color: ri===3?"#e8f5e8":ri===1?(vals[i]>0?COLORS[0]:vals[i]<0?"#f87171":"#4a7a4a"):"#aaa", fontWeight: ri===3?"700":"400", fontFamily: "'DM Sans', sans-serif" }}>
                      {ri===1 && vals[i]>0 ? "+":""}{vals[i]}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CollapseSect>
          <CollapseSect title="Manual Adjustment ($)" open={showAdj} onToggle={() => setShowAdj(v=>!v)}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${RP.length},1fr)`, gap: 8 }}>
              {RP.map(pi => (
                <div key={pi} style={{ textAlign: "center" }}>
                  <div style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", fontSize: 16, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{names[pi]||`P${pi+1}`}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <button className="pm-btn" onClick={() => { const n=[...adjustments]; n[pi]+=1; setAdjustments(n); }} style={{ ...S.pmBtnLarge }}>+</button>
                    <div style={{ fontSize: 22, fontWeight: "700", color: adjustments[pi]>0?COLORS[0]:adjustments[pi]<0?"#f87171":"#4a7a4a", fontFamily: "'DM Sans', sans-serif" }}>
                      {adjustments[pi]>0?"+":""}{adjustments[pi]}
                    </div>
                    <button className="pm-btn" onClick={() => { const n=[...adjustments]; n[pi]-=1; setAdjustments(n); }} style={{ ...S.pmBtnLarge }}>−</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setAdjustments(Array(RP.length).fill(0))} style={{ ...S.navBtn, width: "100%", marginTop: 12, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>Reset Adjustments</button>
          </CollapseSect>
          {/* $ Over Round chart — bottom of totals */}
          {(games.vegas || games.ct || games.p3) && (() => {
            const cumData = [];
            const running = Array(RP.length).fill(0);
            for (let hi = 0; hi < 18; hi++) {
              if (!inPlay[hi]) continue;
              const r = results[hi];
              RP.forEach(pi => {
                running[pi] += (games.vegas?r.vd[pi]*vegasVal:0) + (games.ct?r.ct[pi]*ctVal:0) + (games.p3?r.p3[pi]*p3Val:0);
              });
              cumData.push({ hi, values: [...running] });
            }
            if (cumData.length < 2) return null;
            const allVals = cumData.flatMap(d => d.values);
            const minV = Math.min(0, ...allVals);
            const maxV = Math.max(0, ...allVals);
            const range = maxV - minV || 1;
            const chartH = 80;
            const zeroY = chartH * (maxV / range);
            const xStep = 20;
            return (
              <Sect title="$ Over Round">
                <div style={{ fontSize: 11, color: "var(--text)", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                  Vegas / Cut Throat / Banker only — excludes 6-Point and Matchup
                </div>
                <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", padding: "12px 8px 8px", overflowX: "auto" }}>
                  <svg width="100%" viewBox={`0 0 ${cumData.length * xStep + 10} ${chartH + 20}`} style={{ display: "block", minWidth: 200 }}>
                    <line x1="5" y1={zeroY + 4} x2={cumData.length * xStep + 5} y2={zeroY + 4}
                      stroke="#1e3a1e" strokeWidth="0.8" strokeDasharray="3,3"/>
                    {RP.map(pi => {
                      const pts = cumData.map((d, idx) => {
                        const x = idx * xStep + 15;
                        const y = 4 + chartH * (1 - (d.values[pi] - minV) / range);
                        return `${x},${y}`;
                      }).join(" ");
                      return <polyline key={pi} points={pts} fill="none" stroke={COLORS[pi]} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round"/>;
                    })}
                    {RP.map(pi => {
                      const last = cumData[cumData.length - 1];
                      const x = (cumData.length - 1) * xStep + 15;
                      const y = 4 + chartH * (1 - (last.values[pi] - minV) / range);
                      return <circle key={pi} cx={x} cy={y} r="2.5" fill={COLORS[pi]}/>;
                    })}
                    {cumData.map((d, idx) => (
                      <text key={idx} x={idx * xStep + 15} y={chartH + 16}
                        textAnchor="middle" fontSize="8" fill="#3a6a3a" fontFamily="sans-serif">
                        {d.hi + 1}
                      </text>
                    ))}
                  </svg>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
                    {RP.map(pi => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 12, height: 2, background: COLORS[pi], borderRadius: 1 }}/>
                        <span style={{ fontSize: 13, color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "600", fontFamily: "'DM Sans', sans-serif" }}>{names[pi]||`P${pi+1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Sect>
            );
          })()}
          </>}
        </>
      )}
            {tab === "vegas" && (
        <Sect title={`Vegas — Hole by Hole${hzEnabled?" (Hero or Zero)":ghostEnabled?" (Ghost)":""}`}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", minWidth: 320 }}>
            <div style={{ display: "grid", gridTemplateColumns: `28px 56px 40px 36px repeat(4,1fr)`, borderBottom: "1px solid var(--border)" }}>
              {["H","Teams","Nums","Trig",...vp.map(i=>(names[i]||"Ghost").slice(0,5))].map((h,i) => (
                <div key={i} style={{ ...S.th, padding: "8px 2px", fontSize: i>3?14:11, fontWeight: i>3?"700":"500", color: i>3?(isLight?COLORS_LIGHT[vp[i-4]]:COLORS[vp[i-4]]):"var(--muted)" }}>{h}</div>
              ))}
            </div>
            {results.map((r, hi) => {
              const active = inPlay[hi];
              const isHIO = r.isHIO;
              const mult = r.vr?.mult > 1 ? `×${r.vr.mult}` : "";
              const bonus = (r.vr?.bonusA > 0 || r.vr?.bonusB > 0) ? `+${r.vr.bonusA || r.vr.bonusB}` : "";
              const trig = [mult, bonus].filter(Boolean).join(" ");
              return (
                <div key={hi} onClick={() => onHole(hi)} style={{ display: "grid", gridTemplateColumns: `28px 56px 40px 36px repeat(4,1fr)`, borderBottom: "1px solid var(--border)", cursor: "pointer", opacity: active?1:0.35 }}>
                  <div style={S.td}>{hi+1}</div>
                  <div style={{ ...S.td, fontSize: 10 }}>{isHIO ? <span style={{ color: "#fbbf24", fontWeight: "700", fontSize: 9 }}>HIO</span> : (() => {
                    const t0 = r.teamsForVegas ? r.teamsForVegas[0] : vTeams[hi][0];
                    const t1 = r.teamsForVegas ? r.teamsForVegas[1] : vTeams[hi][1];
                    // De-dupe (HZ has Hero twice)
                    const t0u = [...new Set(t0)];
                    const t1u = [...new Set(t1)];
                    return `${t0u.map(i=>(names[i]||"G")[0]).join("")}${t0.length > t0u.length ? "×2" : ""}|${t1u.map(i=>(names[i]||"G")[0]).join("")}`;
                  })()}</div>
                  <div style={{ ...S.td, fontSize: 10 }}>{!isHIO && active && r.vr ? `${r.vr.effA}|${r.vr.effB}` : ""}</div>
                  <div style={{ ...S.td, fontSize: 10, color: trig?"#e879f9":"#4a7a4a", fontWeight: trig?"700":"400" }}>{!isHIO && active ? trig : ""}</div>
                  {vp.map(i => { const v=active&&!isHIO?r.vd[i]:0; return <div key={i} style={{ ...S.td, color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontWeight: v!==0?"600":"400" }}>{isHIO ? <span style={{ color: "#fbbf24", fontSize: 9 }}>—</span> : v!==0?(v>0?"+":"")+v:"—"}</div>; })}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: `28px 56px 40px 36px repeat(4,1fr)`, background: "var(--card)", borderTop: "1px solid var(--border)" }}>
              <div style={{ ...S.td, fontWeight: "700", fontSize: 11 }}>TOT</div>
              <div style={S.td} /><div style={S.td} /><div style={S.td} />
              {vp.map(i => { const v=vegasCum[i]; return <div key={i} style={{ ...S.td, color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontWeight: "700" }}>{v>0?"+":""}{v||"—"}</div>; })}
            </div>
          </div>
          </div>
        </Sect>
      )}
      {tab === "ct" && (
        <Sect title="Cut Throat — Hole by Hole">
          <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: `28px 28px repeat(4,1fr)`, borderBottom: "1px solid var(--border)" }}>
              {["H","Par",...vp.map(i=>(names[i]||"Ghost").slice(0,5))].map((h,i) => (
                <div key={i} style={{ ...S.th, padding: "8px 4px", fontSize: i>1?14:11, fontWeight: i>1?"700":"500", color: i>1?(isLight?COLORS_LIGHT[vp[i-2]]:COLORS[vp[i-2]]):"var(--muted)" }}>{h}</div>
              ))}
            </div>
            {results.map((r, hi) => {
              const active = inPlay[hi];
              const isHIO_ct = r.isHIO;
              return (
                <div key={hi} onClick={() => onHole(hi)} style={{ display: "grid", gridTemplateColumns: `28px 28px repeat(4,1fr)`, borderBottom: "1px solid var(--border)", cursor: "pointer", opacity: active?1:0.35 }}>
                  <div style={S.td}>{hi+1}</div>
                  <div style={{ ...S.td, color: isHIO_ct ? "#fbbf24" : "inherit", fontWeight: isHIO_ct ? "700" : "400", fontSize: isHIO_ct ? 9 : "inherit" }}>{isHIO_ct ? "HIO" : holes[hi].par}</div>
                  {vp.map(i => { const v=active&&!isHIO_ct?r.ct[i]:0; return <div key={i} style={{ ...S.td, color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontWeight: v!==0?"600":"400" }}>{v!==0?(v>0?"+":"")+v:"—"}</div>; })}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: `28px 28px repeat(4,1fr)`, background: "var(--card)", borderTop: "1px solid var(--border)" }}>
              <div style={{ ...S.td, fontWeight: "700", fontSize: 11 }}>TOT</div>
              <div style={S.td} />
              {vp.map(i => { const v=ctCum[i]; return <div key={i} style={{ ...S.td, color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontWeight: "700" }}>{v>0?"+":""}{v||"—"}</div>; })}
            </div>
          </div>
        </Sect>
      )}
      {tab === "par3" && (
        <Sect title="Banker — Hole by Hole">
          <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: `28px repeat(4,1fr)`, borderBottom: "1px solid var(--border)" }}>
              {["H",...vp.map(i=>(names[i]||"Ghost").slice(0,5))].map((h,i) => (
                <div key={i} style={{ ...S.th, padding: "8px 4px", fontSize: i>0?14:11, fontWeight: i>0?"700":"500", color: i>0?(isLight?COLORS_LIGHT[vp[i-1]]:COLORS[vp[i-1]]):"var(--muted)" }}>{h}</div>
              ))}
            </div>
            {results.map((r, hi) => {
              if (holes[hi].par !== 3) return null;
              const active = inPlay[hi];
              const isHIO_p3 = r.isHIO;
              return (
                <div key={hi} onClick={() => onHole(hi)} style={{ display: "grid", gridTemplateColumns: `28px repeat(4,1fr)`, borderBottom: "1px solid var(--border)", cursor: "pointer", opacity: active?1:0.35 }}>
                  <div style={{ ...S.td, color: isHIO_p3 ? "#fbbf24" : "inherit", fontWeight: isHIO_p3 ? "700" : "400", fontSize: isHIO_p3 ? 9 : "inherit" }}>{isHIO_p3 ? "HIO" : hi+1}</div>
                  {vp.map(i => { const v=active&&!isHIO_p3?r.p3[i]:0; return <div key={i} style={{ ...S.td, color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontWeight: v!==0?"600":"400" }}>{v!==0?(v>0?"+":"")+v:"—"}</div>; })}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: `28px repeat(4,1fr)`, background: "var(--card)", borderTop: "1px solid var(--border)" }}>
              <div style={{ ...S.td, fontWeight: "700", fontSize: 11 }}>TOT</div>
              {vp.map(i => { const v=p3Cum[i]; return <div key={i} style={{ ...S.td, color: v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"#4a7a4a", fontWeight: "700" }}>{v>0?"+":""}{v||"—"}</div>; })}
            </div>
          </div>
        </Sect>
      )}
      {tab === "pts" && games.pts && (
        <Sect title="Points Game — Hole by Hole">
          <div style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: `28px repeat(${playerCount}, 1fr)`, borderBottom: "1px solid var(--border)" }}>
              <div style={{ ...S.th }}>H</div>
              {RP.map(i => <div key={i} style={{ ...S.th, color: isLight?COLORS_LIGHT[i]:COLORS[i], fontWeight: "700" }}>{(names[i]||"").slice(0,5)}</div>)}
            </div>
            {results.map((r, hi) => {
              if (!r.pts || r.pts.every(v => v === 0)) return null;
              const active = inPlay[hi];
              return (
                <div key={hi} onClick={() => onHole(hi)} style={{ display: "grid", gridTemplateColumns: `28px repeat(${playerCount}, 1fr)`, borderBottom: "1px solid var(--border)", cursor: "pointer", opacity: active?1:0.35 }}>
                  <div style={{ ...S.td }}>{hi+1}</div>
                  {RP.map(i => {
                    const v = active ? r.pts[i] : 0;
                    const isTop = active && v === Math.max(...RP.map(p => r.pts[p]));
                    return <div key={i} style={{ ...S.td, color: isTop?(isLight?"#16a34a":COLORS[0]):"var(--text)", fontWeight: isTop?"700":"400" }}>{active ? v : "—"}</div>;
                  })}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: `28px repeat(${playerCount}, 1fr)`, background: "var(--card)", borderTop: "1px solid var(--border)" }}>
              <div style={{ ...S.td, fontWeight: "700", fontSize: 11 }}>TOT</div>
              {ptsCum.map((v,i) => <div key={i} style={{ ...S.td, color: isLight?COLORS_LIGHT[i]:COLORS[i], fontWeight: "700" }}>{v}</div>)}
            </div>
            {ptsVal > 0 && (
              <div style={{ padding: "10px 12px", background: "var(--card)", borderTop: "1px solid var(--border2)" }}>
                <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>SETTLEMENT (${ptsVal}/pt)</div>
                {RP.map(i => {
                  const net = RP.reduce((sum,j) => j!==i ? sum+(ptsCum[i]-ptsCum[j])*ptsVal : sum, 0);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: isLight?COLORS_LIGHT[i]:COLORS[i], fontWeight: "600", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>{names[i]||`P${i+1}`}</span>
                      <span style={{ fontSize: 16, fontWeight: "700", color: net>0?(isLight?"#16a34a":COLORS[0]):net<0?(isLight?"#cc0000":"#f87171"):"var(--dim)", fontFamily: "'DM Sans', sans-serif" }}>{net>0?"+":""}{net}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {ptsVal === 0 && (
              <div style={{ padding: "10px 12px", background: "var(--card)", borderTop: "1px solid var(--border2)", fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                Points only — settle outside
              </div>
            )}
          </div>
        </Sect>
      )}
      {tab === "sixes" && sixesEnabled && (
        <Sect title="Sixes — Segments">
          {sixesData.segments.map((seg, si) => {
            const relT1 = Math.max(0, seg.t1pts - seg.t2pts);
            const relT2 = Math.max(0, seg.t2pts - seg.t1pts);
            const isTied = seg.closed && seg.t1pts === seg.t2pts;
            const winnerIdx = seg.t1pts > seg.t2pts ? 0 : seg.t2pts > seg.t1pts ? 1 : -1;
            const segLabel = ["1st", "2nd", "3rd"][si];
            const holesCount = seg.holes.length;
            const closeNote = seg.closed
              ? (seg.closedEarly ? `closed early — ${holesCount} holes` : `closed — ${holesCount} holes`)
              : (holesCount > 0 ? `${holesCount} of 6 holes` : "not started");
            return (
              <div key={si} style={{ background: "var(--input)", borderRadius: 8, border: "1px solid var(--border)", padding: 12, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: "700", color: "var(--text)" }}>{segLabel}</span>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>{closeNote}</span>
                </div>
                {/* Teams */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13 }}>
                  <div style={{ flex: 1 }}>
                    {seg.teams[0].map(pi => {
                      const shadowed = playerCount === 5 && sixesConfig.shadowOf?.[si] === pi;
                      return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginRight: 4 }}>
                        {(names[pi]||`P${pi+1}`).slice(0,5)}
                        {shadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2, fontSize: 11 }}>+{(names[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                      </span>;
                    })}
                  </div>
                  <span style={{ color: "var(--dim)", fontSize: 11 }}>vs</span>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    {seg.teams[1].map(pi => {
                      const shadowed = playerCount === 5 && sixesConfig.shadowOf?.[si] === pi;
                      return <span key={pi} style={{ color: isLight?COLORS_LIGHT[pi]:COLORS[pi], fontWeight: "700", marginLeft: 4 }}>
                        {(names[pi]||`P${pi+1}`).slice(0,5)}
                        {shadowed && <span style={{ color: "var(--dim)", fontWeight: "400", marginLeft: 2, fontSize: 11 }}>+{(names[sixesConfig.shadowPlayer]||`P${sixesConfig.shadowPlayer+1}`).slice(0,3)}</span>}
                      </span>;
                    })}
                  </div>
                </div>
                {/* Score */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 22, fontWeight: "700", borderTop: "1px solid var(--border)", paddingTop: 8, marginBottom: 6 }}>
                  <span style={{ color: winnerIdx === 0 ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{relT1}</span>
                  <span style={{ color: "var(--dim)", fontSize: 14 }}>—</span>
                  <span style={{ color: winnerIdx === 1 ? (isLight?"#16a34a":COLORS[0]) : "var(--text)" }}>{relT2}</span>
                </div>
                {/* Result */}
                {seg.closed && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--text)" }}>
                    {(() => {
                      // Build teams including shadow for 5-ball
                      let teamsForDisplay = seg.teams;
                      if (playerCount === 5 && sixesConfig.shadowPlayer !== null && sixesConfig.shadowPlayer !== undefined) {
                        const shadowIdx = sixesConfig.shadowPlayer;
                        const shadowedIdx = sixesConfig.shadowOf?.[si];
                        if (shadowedIdx !== null && shadowedIdx !== undefined) {
                          teamsForDisplay = seg.teams.map(t => t.includes(shadowedIdx) ? [...t, shadowIdx] : t);
                        }
                      }
                      if (isTied) {
                        return sixesConfig.stakeType === "cash"
                          ? "Halved — no payment"
                          : "Halved — each player +1 token";
                      }
                      const winners = teamsForDisplay[winnerIdx].map(pi => (names[pi]||`P${pi+1}`).slice(0,5)).join(" + ");
                      const losers = teamsForDisplay[1-winnerIdx].map(pi => (names[pi]||`P${pi+1}`).slice(0,5)).join(" + ");
                      if (sixesConfig.stakeType === "cash") {
                        return <>🏆 <b style={{ color: isLight?"#16a34a":COLORS[0] }}>{winners}</b> wins ${sixesConfig.cashAmount}</>;
                      } else {
                        return <>🏆 <b style={{ color: isLight?"#16a34a":COLORS[0] }}>{winners}</b> wins · <span style={{ color: isLight?"#cc0000":"#f87171" }}>{losers}</span> +2 tokens each</>;
                      }
                    })()}
                  </div>
                )}
              </div>
            );
          })}
          {/* Settlement summary */}
          <div style={{ background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)", padding: 12, marginTop: 12, fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", marginBottom: 8 }}>SETTLEMENT</div>
            {sixesConfig.stakeType === "meal" && (
              <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8, fontStyle: "italic" }}>Tokens = shares of meal cost (lower is better)</div>
            )}
            {RP.map(i => {
              const isCash = sixesConfig.stakeType === "cash";
              const v = isCash ? sixesPlayerDollars[i] : sixesPlayerTokens[i];
              const display = isCash
                ? `${v>0?"+$":v<0?"-$":"$"}${Math.abs(v)}`
                : `${v} token${v===1?"":"s"}`;
              const col = isCash
                ? (v>0?(isLight?"#16a34a":COLORS[0]):v<0?(isLight?"#cc0000":"#f87171"):"var(--dim)")
                : "var(--text)";
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 14 }}>
                  <span style={{ color: isLight?COLORS_LIGHT[i]:COLORS[i], fontWeight: "600" }}>{names[i]||`P${i+1}`}</span>
                  <span style={{ fontWeight: "700", color: col }}>{display}</span>
                </div>
              );
            })}
            {/* Total row for meal tokens */}
            {sixesConfig.stakeType === "meal" && (() => {
              const total = sixesPlayerTokens.reduce((s, v) => s + v, 0);
              return (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 14 }}>
                  <span style={{ color: "var(--text)", fontWeight: "700" }}>Total</span>
                  <span style={{ fontWeight: "700", color: "var(--text)" }}>{total} token{total===1?"":"s"}</span>
                </div>
              );
            })()}
          </div>
        </Sect>
      )}
      {tab === "nassau" && matchupEnabled && (
        <Sect title="Matchups — Results">
          {(matchupResults||[]).map((r, mi) => {
            const m = matchups[mi];
            const p1name = names[m.p1];
            const p2name = names[m.p2];
            const p1col = isLight ? COLORS_LIGHT[m.p1] : COLORS[m.p1];
            const p2col = isLight ? COLORS_LIGHT[m.p2] : COLORS[m.p2];
            const isGDB = m.type === "gdb";
            const isMatchPlay = m.type === "matchplay";
            const isStrokePlay = m.type === "stroke";
            const net = r.dollars.net;
            function segRow(label, seg, dollarAmt) {
              if (!seg) return null;
              const { status, holesPlayed } = seg;
              const statusText = (holesPlayed !== undefined && holesPlayed === 0) ? "—"
                : status === 0 ? "AS"
                : `${status > 0 ? p1name : p2name} ${Math.abs(status)} UP`;
              const statusCol = status > 0 ? p1col : status < 0 ? p2col : "var(--dim)";
              const dollarCol = dollarAmt > 0 ? (isLight?"#16a34a":COLORS[0]) : dollarAmt < 0 ? "var(--neg)" : "var(--dim)";
              return (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600", width: 90 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: "600", color: statusCol, fontFamily: "'DM Sans', sans-serif", flex: 1, textAlign: "center" }}>{statusText}</span>
                  <span style={{ fontSize: 14, fontWeight: "700", color: dollarCol, fontFamily: "'DM Sans', sans-serif", width: 56, textAlign: "right" }}>
                    {dollarAmt === 0 ? "—" : `${dollarAmt > 0 ? "+" : ""}$${dollarAmt}`}
                  </span>
                </div>
              );
            }
            return (
              <div key={mi} style={{ background: "var(--input)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                {/* Header */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 2, fontWeight: "700", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                    MATCH {mi+1} · {isGDB ? "GDB (Game/Dormie/Bye)" : isMatchPlay ? "MATCH PLAY" : isStrokePlay ? "STROKE PLAY" : "NASSAU"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: "800", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>
                    <span style={{ color: p1col }}>{p1name}</span> <span style={{ color: "var(--dim)", fontSize: 13 }}>vs</span> <span style={{ color: p2col }}>{p2name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text)", marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>
                    {isGDB
                      ? `Game/Dormie/Bye · $${m.stake}/unit · max $${m.stake*5}/9`
                      : isMatchPlay
                      ? `Match play · ${(m.units||[0,0,1]).join(":")} · $${m.stake}/hole`
                      : isStrokePlay
                      ? `Stroke play · ${(m.units||[1,1,2]).join(":")} · $${m.stake}/stroke`
                      : `${(m.units||[1,1,2]).join(":")} · $${m.stake}/unit`
                    } ·{" "}
                    {[["F", m.strokesFront], ["B", m.strokesBack]].map(([label, v]) => {
                      if (v === 0) return `${label}: scratch`;
                      const giver = v > 0 ? p1name : p2name;
                      const receiver = v > 0 ? p2name : p1name;
                      return `${label}: ${giver}→${receiver} ${Math.abs(v)}`;
                    }).join(" · ")}
                  </div>
                </div>
                {/* Nassau rows */}
                {!isGDB && !isMatchPlay && !isStrokePlay && (() => {
                  const { frontDollars, backDollars, overallDollars, pressDollars } = r.dollars;
                  const u = m.units||[1,1,2];
                  return <>
                    {u[0] > 0 && segRow(`Front 9 ×${u[0]}`, r.front, frontDollars)}
                    {u[1] > 0 && segRow(`Back 9 ×${u[1]}`, r.back, backDollars)}
                    {u[2] > 0 && segRow(`Overall ×${u[2]}`, r.overall, overallDollars)}
                    {r.presses?.length > 0 && r.presses.map((p, pi) => {
                      const pm = m.pressMult || 1;
                      const pd = p.status === 0 ? 0 : p.status > 0 ? m.stake * pm : -m.stake * pm;
                      return segRow(`Press ${pi+1} (from H${p.startHole})`, p, pd);
                    })}
                  </>;
                })()}
                {/* Stroke play rows */}
                {isStrokePlay && (() => {
                  const { frontDollars, backDollars, overallDollars } = r.dollars;
                  const u = m.units || [1, 1, 2];
                  const segStrokeRow = (label, seg, dollarAmt) => {
                    const statusText = seg.holesPlayed === 0 ? "—"
                      : seg.diff === 0 ? "AS"
                      : `${seg.diff > 0 ? p1name : p2name} by ${Math.abs(seg.diff)}`;
                    const statusCol = seg.diff > 0 ? p1col : seg.diff < 0 ? p2col : "var(--dim)";
                    const dollarCol = dollarAmt > 0 ? (isLight?"#16a34a":COLORS[0]) : dollarAmt < 0 ? "var(--neg)" : "var(--dim)";
                    return (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600", width: 90 }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: "600", color: statusCol, fontFamily: "'DM Sans', sans-serif", flex: 1, textAlign: "center" }}>{statusText}</span>
                        <span style={{ fontSize: 14, fontWeight: "700", color: dollarCol, fontFamily: "'DM Sans', sans-serif", width: 56, textAlign: "right" }}>
                          {dollarAmt === 0 ? "—" : `${dollarAmt > 0 ? "+" : ""}$${Math.abs(dollarAmt)}`}
                        </span>
                      </div>
                    );
                  };
                  return <>
                    {u[0] > 0 && segStrokeRow(`Front 9 ×${u[0]}`, r.front, frontDollars)}
                    {u[1] > 0 && segStrokeRow(`Back 9 ×${u[1]}`, r.back, backDollars)}
                    {u[2] > 0 && segStrokeRow(`Overall ×${u[2]}`, r.overall, overallDollars)}
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Sans', sans-serif", padding: "4px 0" }}>
                      Diff × $${m.stake}/stroke × unit · per-hole cap par+3/par+4 · {r.overall.holesPlayed}/18 played
                    </div>
                  </>;
                })()}
                {/* Match Play rows: F/B/Overall by net holes won */}
                {isMatchPlay && (() => {
                  const { frontDollars, backDollars, overallDollars } = r.dollars;
                  const u = m.units || [0, 0, 1];
                  const segMpRow = (label, seg, dollarAmt) => {
                    const statusText = seg.holesPlayed === 0 ? "—"
                      : seg.status === 0 ? "AS"
                      : `${seg.status > 0 ? p1name : p2name} ${Math.abs(seg.status)} UP`;
                    const statusCol = seg.status > 0 ? p1col : seg.status < 0 ? p2col : "var(--dim)";
                    const dollarCol = dollarAmt > 0 ? (isLight?"#16a34a":COLORS[0]) : dollarAmt < 0 ? "var(--neg)" : "var(--dim)";
                    return (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", fontWeight: "600", width: 90 }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: "600", color: statusCol, fontFamily: "'DM Sans', sans-serif", flex: 1, textAlign: "center" }}>{statusText}</span>
                        <span style={{ fontSize: 14, fontWeight: "700", color: dollarCol, fontFamily: "'DM Sans', sans-serif", width: 56, textAlign: "right" }}>
                          {dollarAmt === 0 ? "—" : `${dollarAmt > 0 ? "+" : ""}$${Math.abs(dollarAmt)}`}
                        </span>
                      </div>
                    );
                  };
                  return <>
                    {u[0] > 0 && segMpRow(`Front 9 ×${u[0]}`, r.front, frontDollars)}
                    {u[1] > 0 && segMpRow(`Back 9 ×${u[1]}`, r.back, backDollars)}
                    {u[2] > 0 && segMpRow(`Overall ×${u[2]}`, r.overall, overallDollars)}
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Sans', sans-serif", padding: "4px 0" }}>
                      Net holes × ${m.stake}/hole × unit · {r.overall.holesPlayed}/18 played
                    </div>
                  </>;
                })()}
                {/* GDB rows — per 9 */}
                {isGDB && [["FRONT 9", r.front, r.dollars.front], ["BACK 9", r.back, r.dollars.back]].map(([label, seg9, dol9]) => {
                  if (!seg9 || !dol9) return null;
                  return (
                    <div key={label} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, fontWeight: "700", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{label}</div>
                      {segRow(`Game ×3`, seg9.game, dol9.gameDollars)}
                      {seg9.dormie && segRow(`Dormie ×1 (H${seg9.dormie.startHole}+)`, seg9.dormie, dol9.dormieDollars)}
                      {seg9.buy    && segRow(`Bye ×1 (H${seg9.buy.startHole}+)`,    seg9.buy,    dol9.buyDollars)}
                      {!seg9.dormie && !seg9.buy && (
                        <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", padding: "4px 0" }}>No Dormie or Bye triggered</div>
                      )}
                    </div>
                  );
                })}
                {/* Net */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: "700", color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}>Net</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: net > 0 ? p1col : net < 0 ? p2col : "var(--dim)", fontWeight: "600", fontFamily: "'DM Sans', sans-serif" }}>
                      {net === 0 ? "All Square" : `${net > 0 ? p1name : p2name} wins`}
                    </span>
                    <span style={{ fontSize: 22, fontWeight: "700", color: net > 0 ? (isLight?"#16a34a":COLORS[0]) : net < 0 ? "var(--neg)" : "var(--dim)", fontFamily: "'Bebas Neue', sans-serif" }}>
                      {net === 0 ? "—" : `$${Math.abs(net)}`}
                    </span>
                  </div>
                </div>
                {/* Nett scorecard — Dohyo style */}
                {r.holeWL && (() => {
                  const sm = r.strokeMaps;
                  const renderNine = (startHi, nineLabel) => {
                    const holeNums = Array.from({length:9}, (_,i) => startHi+i);
                    let running = 0;
                    const hd = holeNums.map(hi => {
                      const hole = holes[hi];
                      const active = inPlay[hi];
                      const strk = sm ? strokesForHole(hi, hole.si, sm) : {p1:0, p2:0};
                      const g1 = parseInt(results[hi]?.g[m.p1], 10);
                      const g2 = parseInt(results[hi]?.g[m.p2], 10);
                      // No cap on display — raw nett matches what computeNassau/GDB use for W/L.
                      const n1 = active && !isNaN(g1) && g1>0 ? (g1-strk.p1) : null;
                      const n2 = active && !isNaN(g2) && g2>0 ? (g2-strk.p2) : null;
                      const wl = active && n1!==null && n2!==null ? r.holeWL[hi] : 0;
                      if (active && n1!==null && n2!==null) running += wl;
                      return { hi, hole, active, n1, n2, wl, strk, run: active&&n1!==null&&n2!==null ? running : null };
                    });
                    const endStatus = running;
                    const endCol = endStatus>0?p1col:endStatus<0?p2col:"var(--dim)";
                    const endTxt = endStatus===0?"AS":`${endStatus>0?p1name.slice(0,5):p2name.slice(0,5)} ${Math.abs(endStatus)}UP`;
                    const p1tot = hd.reduce((s,{active,n1})=>s+(active&&n1!==null?n1:0),0);
                    const p2tot = hd.reduce((s,{active,n2})=>s+(active&&n2!==null?n2:0),0);
                    const cS = (bg) => ({ padding:"3px 2px", textAlign:"center", fontSize:11, border:"1px solid var(--border)", background:bg||"var(--input)", minWidth:18 });
                    const hS = { padding:"3px 2px", textAlign:"center", fontSize:10, color:"var(--muted)", fontWeight:"600", background:"var(--card)", border:"1px solid var(--border)" };
                    return (
                      <div style={{ marginTop:10, overflowX:"auto" }}>
                        <div style={{ fontSize:10, color:"var(--accent)", letterSpacing:2, fontWeight:"700", fontFamily:"'DM Sans', sans-serif", marginBottom:4 }}>{nineLabel}</div>
                        <table style={{ borderCollapse:"collapse", width:"100%" }}>
                          <tbody>
                            <tr>
                              <td style={{ ...hS, textAlign:"left", paddingLeft:4, minWidth:44 }}></td>
                              {holeNums.map(hi => <td key={hi} style={hS}>{hi+1}</td>)}
                              <td style={{ ...hS, minWidth:28 }}>TOT</td>
                            </tr>
                            <tr>
                              <td style={{ ...cS("var(--card)"), textAlign:"left", paddingLeft:4, fontWeight:"700", color:p1col, fontSize:11 }}>{p1name.slice(0,5)}</td>
                              {hd.map(({hi,active,n1,n2,strk}) => {
                                const win = n1!==null&&n2!==null&&n1<n2;
                                return <td key={hi} style={{ ...cS(), color:active?(win?p1col:"var(--text)"):"var(--dim)", fontWeight:win?"700":"400", opacity:active?1:0.35 }}>
                                  {active&&n1!==null?<>{n1}{strk.p1>0&&<sup style={{color:"var(--accent)",fontSize:8}}>+{strk.p1}</sup>}</>:"·"}
                                </td>;
                              })}
                              <td style={{ ...cS("var(--card)"), fontWeight:"700", color:p1col }}>{p1tot||"·"}</td>
                            </tr>
                            <tr>
                              <td style={{ ...cS("var(--card)"), textAlign:"left", paddingLeft:4, fontWeight:"700", color:p2col, fontSize:11 }}>{p2name.slice(0,5)}</td>
                              {hd.map(({hi,active,n1,n2,strk}) => {
                                const win = n1!==null&&n2!==null&&n2<n1;
                                return <td key={hi} style={{ ...cS("var(--bg)"), color:active?(win?p2col:"var(--text)"):"var(--dim)", fontWeight:win?"700":"400", opacity:active?1:0.35 }}>
                                  {active&&n2!==null?<>{n2}{strk.p2>0&&<sup style={{color:"var(--accent)",fontSize:8}}>+{strk.p2}</sup>}</>:"·"}
                                </td>;
                              })}
                              <td style={{ ...cS("var(--card)"), fontWeight:"700", color:p2col }}>{p2tot||"·"}</td>
                            </tr>
                            <tr>
                              <td style={{ ...cS("var(--card)"), textAlign:"left", paddingLeft:4, fontSize:10, color:"var(--muted)" }}>Res</td>
                              {hd.map(({hi,active,n1,n2,wl},idx) => {
                                const txt = !active||n1===null||n2===null?"·":wl===1?"W":wl===-1?"L":"H";
                                const col = wl===1?p1col:wl===-1?p2col:"var(--dim)";
                                const isLast = idx===8;
                                return <td key={hi} style={{ ...cS("var(--card)"), color:active&&txt!=="·"?col:"var(--dim)", fontWeight:txt!=="·"?"700":"400", opacity:active?1:0.35 }}>
                                  {isLast&&hd[idx].run!==null
                                    ? <div style={{lineHeight:1.1}}><div>{txt}</div><div style={{color:endCol,fontSize:8,fontWeight:"700"}}>{endTxt}</div></div>
                                    : txt}
                                </td>;
                              })}
                              <td style={{ ...cS("var(--card)"), fontSize:9, color:endCol, fontWeight:"700", whiteSpace:"nowrap" }}>{endTxt}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  };
                  return (
                    <div style={{ marginTop:8, borderTop:"1px solid var(--border)", paddingTop:8 }}>
                      {renderNine(0, "FRONT 9")}
                      {renderNine(9, "BACK 9")}
                    </div>
                  );
                })()}
                {/* Stroke play scorecard */}
                {isStrokePlay && r.holeRows && (() => {
                  const renderNine = (startHi, nineLabel) => {
                    const holeNums = Array.from({length:9}, (_,i) => startHi+i);
                    let runP1 = 0, runP2 = 0;
                    const hd = holeNums.map(hi => {
                      const hole = holes[hi];
                      const active = inPlay[hi];
                      const row = r.holeRows[hi];
                      const n1 = row ? row.n1 : null;
                      const n2 = row ? row.n2 : null;
                      const s1 = row ? row.s1 : (r.strokeMaps ? strokesForHole(hi, hole.si, r.strokeMaps).p1 : 0);
                      const s2 = row ? row.s2 : (r.strokeMaps ? strokesForHole(hi, hole.si, r.strokeMaps).p2 : 0);
                      if (row) { runP1 += n1; runP2 += n2; }
                      return { hi, hole, active, n1, n2, s1, s2, run: row ? (runP2 - runP1) : null };
                    });
                    const p1tot = hd.reduce((s,{n1})=>s+(n1!==null?n1:0),0);
                    const p2tot = hd.reduce((s,{n2})=>s+(n2!==null?n2:0),0);
                    const endDiff = p2tot - p1tot;
                    const endCol = endDiff>0?p1col:endDiff<0?p2col:"var(--dim)";
                    const endTxt = endDiff===0?"AS":`${endDiff>0?p1name.slice(0,5):p2name.slice(0,5)} ${Math.abs(endDiff)}`;
                    const cS = (bg) => ({ padding:"3px 2px", textAlign:"center", fontSize:11, border:"1px solid var(--border)", background:bg||"var(--input)", minWidth:18 });
                    const hS = { padding:"3px 2px", textAlign:"center", fontSize:10, color:"var(--muted)", fontWeight:"600", background:"var(--card)", border:"1px solid var(--border)" };
                    return (
                      <div style={{ marginTop:10, overflowX:"auto" }}>
                        <div style={{ fontSize:10, color:"var(--accent)", letterSpacing:2, fontWeight:"700", fontFamily:"'DM Sans', sans-serif", marginBottom:4 }}>{nineLabel}</div>
                        <table style={{ borderCollapse:"collapse", width:"100%" }}>
                          <tbody>
                            <tr>
                              <td style={{ ...hS, textAlign:"left", paddingLeft:4, minWidth:44 }}></td>
                              {holeNums.map(hi => <td key={hi} style={hS}>{hi+1}</td>)}
                              <td style={{ ...hS, minWidth:28 }}>TOT</td>
                            </tr>
                            <tr>
                              <td style={{ ...cS("var(--card)"), textAlign:"left", paddingLeft:4, fontWeight:"700", color:p1col, fontSize:11 }}>{p1name.slice(0,5)}</td>
                              {hd.map(({hi,active,n1,s1}) => (
                                <td key={hi} style={{ ...cS(), color:active?"var(--text)":"var(--dim)", opacity:active?1:0.35 }}>
                                  {active&&n1!==null?<>{n1}{s1>0&&<sup style={{color:"var(--accent)",fontSize:8}}>+{s1}</sup>}</>:"·"}
                                </td>
                              ))}
                              <td style={{ ...cS("var(--card)"), fontWeight:"700", color:p1col }}>{p1tot||"·"}</td>
                            </tr>
                            <tr>
                              <td style={{ ...cS("var(--card)"), textAlign:"left", paddingLeft:4, fontWeight:"700", color:p2col, fontSize:11 }}>{p2name.slice(0,5)}</td>
                              {hd.map(({hi,active,n2,s2}) => (
                                <td key={hi} style={{ ...cS("var(--bg)"), color:active?"var(--text)":"var(--dim)", opacity:active?1:0.35 }}>
                                  {active&&n2!==null?<>{n2}{s2>0&&<sup style={{color:"var(--accent)",fontSize:8}}>+{s2}</sup>}</>:"·"}
                                </td>
                              ))}
                              <td style={{ ...cS("var(--card)"), fontWeight:"700", color:p2col }}>{p2tot||"·"}</td>
                            </tr>
                            <tr>
                              <td style={{ ...cS("var(--card)"), textAlign:"left", paddingLeft:4, fontSize:10, color:"var(--muted)" }}>Diff</td>
                              {hd.map(({hi,active,run},idx) => {
                                const isLast = idx===8;
                                const txt = run===null ? "·" : run===0 ? "0" : `${run>0?"+":""}${run}`;
                                const col = run>0?p1col:run<0?p2col:"var(--dim)";
                                return <td key={hi} style={{ ...cS("var(--card)"), color:active&&run!==null?col:"var(--dim)", fontWeight:"700", fontSize:10, opacity:active?1:0.35 }}>
                                  {isLast&&run!==null
                                    ? <div style={{lineHeight:1.1}}><div>{txt}</div><div style={{color:endCol,fontSize:8,fontWeight:"700"}}>{endTxt}</div></div>
                                    : txt}
                                </td>;
                              })}
                              <td style={{ ...cS("var(--card)"), fontSize:9, color:endCol, fontWeight:"700", whiteSpace:"nowrap" }}>{endTxt}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  };
                  return (
                    <div style={{ marginTop:8, borderTop:"1px solid var(--border)", paddingTop:8 }}>
                      {renderNine(0, "FRONT 9")}
                      {renderNine(9, "BACK 9")}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </Sect>
      )}
      <Sect title="Scorecard (Gross)">
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--card)" }}>
                <th style={{ ...S.th, padding: "5px 4px" }}>H</th>
                <th style={{ ...S.th, padding: "5px 4px" }}>Par</th>
                <th style={{ ...S.th, padding: "5px 4px", color: "var(--text)" }}>SI</th>
                {RP.map(i => (
                  <th key={i} style={{ ...S.th, padding: "5px 3px", fontSize: 13, fontWeight: "700", color: isLight?COLORS_LIGHT[i]:COLORS[i] }}>{(names[i]||"").slice(0,5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0,1,2,3,4,5,6,7,8].map(row => {
                const active = inPlay[row];
                return (
                  <tr key={row} style={{ background: row%2===0?"var(--input)":"var(--card)", opacity: active?1:0.4 }}>
                    <td style={{ ...S.td, color: "var(--text)", fontWeight: "600" }}>{row+1}</td>
                    <td style={{ ...S.td, color: "var(--text)" }}>{holes[row].par}</td>
                    <td style={{ ...S.td, color: "var(--text)", fontSize: 12 }}>{holes[row].si}</td>
                    {RP.map(pi => {
                      const g = parseInt(results[row].g[pi], 10);
                      const diff = isNaN(g) ? null : g - holes[row].par;
                      return (
                        <td key={pi} style={{ ...S.td, padding: "4px 2px" }}>
                          {diff !== null
                            ? active
                              ? <ScoreBadge score={g} diff={diff} />
                              : <span style={{ color: "var(--text)", fontSize: 13, fontWeight: "400" }}>{g}</span>
                            : <span style={{ color: "var(--dim)" }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr style={{ background: "var(--card)", borderTop: "1px solid var(--border)", borderBottom: "2px solid #2a5a2a" }}>
                <td style={{ ...S.td, fontWeight: "700", color: "var(--text)" }}>OUT</td>
                <td style={{ ...S.td, fontWeight: "700", color: "var(--text)" }}>{holes.slice(0,9).reduce((s,h)=>s+h.par,0)}</td>
                <td style={S.td} />
                {RP.map(pi => {
                  const total = results.slice(0,9).reduce((s,r) => { const g=parseInt(r.g[pi],10); return s+(isNaN(g)?0:g); }, 0);
                  return <td key={pi} style={{ ...S.td, fontWeight: "700", color: "var(--text)" }}>{total||"—"}</td>;
                })}
              </tr>
              {[9,10,11,12,13,14,15,16,17].map(row => {
                const active = inPlay[row];
                return (
                  <tr key={row} style={{ background: row%2===0?"var(--input)":"var(--card)", opacity: active?1:0.4 }}>
                    <td style={{ ...S.td, color: "var(--text)", fontWeight: "600" }}>{row+1}</td>
                    <td style={{ ...S.td, color: "var(--text)" }}>{holes[row].par}</td>
                    <td style={{ ...S.td, color: "var(--text)", fontSize: 12 }}>{holes[row].si}</td>
                    {RP.map(pi => {
                      const g = parseInt(results[row].g[pi], 10);
                      const diff = isNaN(g) ? null : g - holes[row].par;
                      return (
                        <td key={pi} style={{ ...S.td, padding: "4px 2px" }}>
                          {diff !== null
                            ? active
                              ? <ScoreBadge score={g} diff={diff} />
                              : <span style={{ color: "var(--text)", fontSize: 13, fontWeight: "400" }}>{g}</span>
                            : <span style={{ color: "var(--dim)" }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr style={{ background: "var(--card)", borderTop: "1px solid var(--border)", borderBottom: "2px solid #2a5a2a" }}>
                <td style={{ ...S.td, fontWeight: "700", color: "var(--text)" }}>IN</td>
                <td style={{ ...S.td, fontWeight: "700", color: "var(--text)" }}>{holes.slice(9,18).reduce((s,h)=>s+h.par,0)}</td>
                <td style={S.td} />
                {RP.map(pi => {
                  const total = results.slice(9,18).reduce((s,r) => { const g=parseInt(r.g[pi],10); return s+(isNaN(g)?0:g); }, 0);
                  return <td key={pi} style={{ ...S.td, fontWeight: "700", color: "var(--text)" }}>{total||"—"}</td>;
                })}
              </tr>
              <tr style={{ background: "#071d07", borderTop: "1px solid var(--border2)" }}>
                <td style={{ ...S.td, fontWeight: "700", color: "var(--accent)", fontSize: 13 }}>TOT</td>
                <td style={{ ...S.td, fontWeight: "700", color: "var(--text)", fontSize: 13 }}>{holes.reduce((s,h)=>s+h.par,0)}</td>
                <td style={S.td} />
                {RP.map(pi => {
                  const total = results.reduce((s,r) => { const g=parseInt(r.g[pi],10); return s+(isNaN(g)?0:g); }, 0);
                  return <td key={pi} style={{ ...S.td, fontWeight: "700", color: COLORS[pi], fontSize: 13 }}>{total||"—"}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Sect>
      {qrPayload && (
        <Sect title="QR Code — Share Round">
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>
              Scan to share full round data · cross-flight matchups · scorecard
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <QRCodeDisplay payload={qrPayload} size={300} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text)", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
              {qrPayload.length} chars · {names.join(" · ")}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={copyPayloadToClipboard}
                style={{ padding: "6px 14px", background: "transparent", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--accent)", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                {copyStatus === "ok" ? "✓ Copied" : copyStatus.startsWith("err") ? "⚠ Failed" : "📋 Copy Payload"}
              </button>
              <button onClick={() => setShowVerify(true)}
                style={{ padding: "6px 14px", background: "transparent", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--accent)", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                ↔ Verify
              </button>
            </div>
            {copyStatus.startsWith("err") && (
              <div style={{ fontSize: 11, color: "var(--neg)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                {copyStatus}
              </div>
            )}
          </div>
        </Sect>
      )}
      {showVerify && qrPayload && (
        <VerifyModal localPayload={qrPayload} roundId={roundId} onClose={() => setShowVerify(false)} isLight={isLight} />
      )}
    </>
  );
}

// MICRO COMPONENTS & STYLES

// Shape indicators follow golf scorecard convention:
// Eagle or better = double circle, Birdie = single circle,
// Par = plain, Bogey = single square, Double bogey+ = double square
function ScoreBadge({ score, diff, large }) {
  const size = large ? 62 : 36;
  const fontSize = large ? 28 : 17;
  const strokeW = large ? 1.5 : 1.2;
  const gap = large ? 4 : 3;   // gap between double shapes
  const r = large ? 26 : 15;   // inner shape radius / half-size
  const stroke = "var(--badge)";
  const shapes = () => {
    if (diff <= -2) {
      return (
        <>
          <circle cx={size/2} cy={size/2} r={r - gap} fill="none" stroke={stroke} strokeWidth={strokeW} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth={strokeW} />
        </>
      );
    } else if (diff === -1) {
      return <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth={strokeW} />;
    } else if (diff === 0) {
      return null;
    } else if (diff === 1) {
      const pad = size/2 - r;
      return <rect x={pad} y={pad} width={r*2} height={r*2} fill="none" stroke={stroke} strokeWidth={strokeW} />;
    } else {
      const pad = size/2 - r;
      const pad2 = pad - gap;
      return (
        <>
          <rect x={pad} y={pad} width={r*2} height={r*2} fill="none" stroke={stroke} strokeWidth={strokeW} />
          <rect x={pad2} y={pad2} width={r*2 + gap*2} height={r*2 + gap*2} fill="none" stroke={stroke} strokeWidth={strokeW} />
        </>
      );
    }
  };
  return (
    <div style={{ width: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        {shapes()}
        <text x={size/2} y={size/2 + fontSize*0.36} textAnchor="middle"
          fontSize={fontSize} fontWeight="700" fill="var(--badge)"
          fontFamily="'DM Sans', sans-serif">{score}</text>
      </svg>
    </div>
  );
}

function InPlayToggle({ on, onToggle }) {
  return (
    <div className="inplay-toggle" onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
      background: "var(--card)",
      border: `2px solid ${on ? "var(--accent)" : "var(--neg)"}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 18, userSelect: "none",
    }}>
      <div style={{ width: 52, height: 28, borderRadius: 14, flexShrink: 0, background: on?"var(--accent)":"var(--neg)", position: "relative", transition: "background 0.2s" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on?27:3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: "600", color: on?"var(--accent)":"var(--neg)", fontFamily: "'DM Sans', sans-serif" }}>
          {on ? "✓ In Play" : "✗ Not In Play"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
          {on ? "Hole counted in totals" : "Hole excluded from totals"}
        </div>
      </div>
    </div>
  );
}
function CollapseSect({ title, open, onToggle, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open?10:0, cursor: "pointer", padding: "4px 0" }}>
        <div style={{ fontSize: 13, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{title}</div>
        <span style={{ fontSize: 14, color: "var(--accent)" }}>{open?"▲":"▼"}</span>
      </div>
      {open && children}
    </div>
  );
}
function Sect({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="sect-title" style={{ fontSize: 13, color: "var(--accent)", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", fontWeight: "700" }}>{title}</div>
      {children}
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'DM Sans', Arial, sans-serif" },
  dot: { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#ffffff", fontWeight: "bold", fontSize: 14 },
  inp: { background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "10px 12px", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" },
  sel: { background: "var(--input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 8px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", outline: "none" },
  th: { padding: "8px 6px", color: "var(--text)", fontWeight: "500", textAlign: "center", fontSize: 11, fontFamily: "'DM Sans', sans-serif" },
  td: { padding: "5px 3px", textAlign: "center", color: "var(--text)", fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
  navBtn: { padding: "12px", background: "var(--card)", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
  pmBtnInline: { width: 40, height: 40, background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s", fontFamily: "'DM Sans', sans-serif" },
  pmBtnLarge: { width: "100%", padding: "10px 0", background: "var(--card)", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 8, cursor: "pointer", fontSize: 22, transition: "all 0.1s", fontFamily: "'DM Sans', sans-serif" },
  startBtn: { width: "100%", padding: "16px", background: COLORS[0], color: "#000000", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 18, fontWeight: "bold", fontFamily: "'DM Sans', sans-serif", transition: "transform 0.1s" },
  courseBtn: { flex: 1, padding: "12px", background: "var(--card)", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
};

// SLOW REVEAL COMPONENT
export default function App() {
  const [config, setConfig] = useState(null);
  const [savedScores, setSavedScores] = useState(null);
  const [savedConfig, setSavedConfig] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [savedRounds, setSavedRounds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sws_rounds") || "[]"); } catch { return []; }
  });
  const [isLight, setIsLight] = useState(() => {
    try { return localStorage.getItem("sws_theme") === "light"; } catch { return false; }
  });
  const [isSuperuser, setIsSuperuser] = useState(() => {
    try { return localStorage.getItem("sws_superuser") === "1"; } catch { return false; }
  });
  const [superToast, setSuperToast] = useState(""); // "ON" or "OFF" briefly
  const superTapsRef = React.useRef(0);
  const superTapTimerRef = React.useRef(null);
  function handleLogoTap() {
    superTapsRef.current += 1;
    clearTimeout(superTapTimerRef.current);
    superTapTimerRef.current = setTimeout(() => { superTapsRef.current = 0; }, 3000);
    if (superTapsRef.current >= 3) {
      const next = !isSuperuser;
      setIsSuperuser(next);
      try { localStorage.setItem("sws_superuser", next ? "1" : "0"); } catch(_) {}
      setSuperToast(next ? "🛡️ Superuser ON" : "👤 Normal user");
      setTimeout(() => setSuperToast(""), 2200);
      superTapsRef.current = 0;
    }
  }
  function toggleTheme() {
    setIsLight(v => {
      const next = !v;
      try { localStorage.setItem("sws_theme", next ? "light" : "dark"); } catch(_) {}
      return next;
    });
  }
  function saveRound(roundData) {
    const entry = { ...roundData, savedAt: Date.now() };
    setSavedRounds(prev => {
      const existing = prev.findIndex(r => r.roundId === entry.roundId);
      const updated = existing >= 0
        ? prev.map((r, i) => i === existing ? entry : r)
        : [entry, ...prev].slice(0, 3);
      try {
        localStorage.setItem("sws_rounds", JSON.stringify(updated));
      } catch (e) {
        console.error("Save failed:", e.message);
      }
      return updated;
    });
  }
  function loadRound(round) {
    const ss = round.config?._savedState;
    const rid = round.config?._roundId;
    // Strip _savedScores — it takes priority over _savedState and must not bleed into resume
    const { _savedScores, ...cleanConfig } = round.config;
    setConfig(cleanConfig);
    window.scrollTo(0, 0);
    // Remember course from resumed round
    if (round.config.courseName) {
      try { localStorage.setItem("sws_lastcourse", JSON.stringify({ name: round.config.courseName, tee: "", holes: round.config.holes })); } catch(_) {}
    }
  }
  if (showSplash) return <SplashContent onDone={() => setShowSplash(false)} isLight={isLight} isSuperuser={isSuperuser} onLogoTap={handleLogoTap} />;
  return (
    <>
      {superToast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: isLight ? "#000" : "#fff", color: isLight ? "#fff" : "#000",
          padding: "10px 18px", borderRadius: 24, fontSize: 14, fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif", zIndex: 10000,
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
        }}>{superToast}</div>
      )}
      {config
        ? <Scorecard config={config} onBack={(scores, rid) => { setSavedScores(scores || null); setSavedConfig(rid ? { ...config, _roundId: rid } : config); setConfig(null); }} onSave={(rd) => saveRound(rd)} isLight={isLight} toggleTheme={toggleTheme} isSuperuser={isSuperuser} />
        : <Setup onStart={(cfg) => { setSavedScores(null); setSavedConfig(null); setConfig(cfg); }} savedRounds={savedRounds} onLoadRound={loadRound} isLight={isLight} toggleTheme={toggleTheme} savedScores={savedScores} savedConfig={savedConfig} onNewRound={() => { setSavedScores(null); setSavedConfig(null); }} isSuperuser={isSuperuser} />
      }
    </>
  );
}
