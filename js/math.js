/* Zaploon math — published house edge, virtual coins only.
   Soft arcade: Crash/Plinko/Mines 99%, Slot 98.5%, Scratch 97%.
   Wheel is a carnival bonus with posted x2–x50 (generous, play-for-fun). */

const MATH = (() => {
  const CRASH_RTP = 0.995;
  const MINES_RTP = 0.995;
  const PLINKO_RTP = 0.995;
  const WHEEL_RTP = 8.67;
  const SLOT_RTP_TARGET = 0.99;

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }

  /* ---------- CRASH ----------
     Survival: P(M >= m) = rtp / m  for m >= 1
     Inverse transform: M = rtp / U, U ~ Unif(0,1]
     Instant 1.00x mass = 1 - rtp  (the house edge).
     EV at ANY cashout target = rtp - 1. Strategy-proof. */
  function crashMultiplier(u) {
    const m = CRASH_RTP / Math.max(u, 1e-12);
    return Math.max(1, Math.floor(m * 100) / 100);
  }

  function crashSurviveProb(target) {
    return Math.min(1, CRASH_RTP / Math.max(1, target));
  }

  /* Multiplier growth: m(t) = e^(λt), λ chosen so 2.00x ≈ 4.2s (Aviator-like). */
  const CRASH_LAMBDA = Math.log(2) / 4.2;
  function crashTimeTo(mult) {
    return Math.log(Math.max(1.0001, mult)) / CRASH_LAMBDA;
  }
  function crashMultAt(t) {
    return Math.exp(CRASH_LAMBDA * t);
  }

  /* ---------- MINES ----------
     5×5 = 25 tiles. After k safe gems with m mines:
     fair = C(25,k) / C(25-m, k)
     paid = rtp * fair
     Equivalent product form:
     Π i=0..k-1  (25-m-i)/(25-i)   then invert * rtp */
  function minesMultiplier(mines, gems) {
    if (gems <= 0) return 1;
    const safe = 25 - mines;
    if (gems > safe) return 0;
    const fair = binom(25, gems) / binom(safe, gems);
    return Math.floor(MINES_RTP * fair * 100) / 100;
  }

  function minesNextSurvive(mines, gemsAlready) {
    const left = 25 - gemsAlready;
    const safeLeft = 25 - mines - gemsAlready;
    return safeLeft / left;
  }

  /* ---------- PLINKO ----------
     Path is binomial: P(k) = C(rows,k) / 2^rows
     Raw aesthetic tables (Stake-like shape), then uniformly scaled to PLINKO_RTP. */
  const PLINKO_RAW = {
    8: {
      low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
      med: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
      high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    },
    10: {
      low: [8.9, 3, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3, 8.9],
      med: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
      high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    },
    12: {
      low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
      med: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
      high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    },
    14: {
      low: [7.1, 4, 1.9, 1.3, 1.2, 1.1, 0.5, 0.5, 1.1, 1.2, 1.3, 1.9, 4, 7.1, 7.1].slice(0, 15),
      med: [58, 15, 7, 3, 1.3, 0.6, 0.3, 0.2, 0.3, 0.6, 1.3, 3, 7, 15, 58],
      high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    },
    16: {
      low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.7, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
      med: [110, 41, 10, 5, 3, 1.5, 1.0, 0.6, 0.45, 0.6, 1.0, 1.5, 3, 5, 10, 41, 110],
      high: [1000, 130, 26, 9, 4, 2, 0.35, 0.3, 0.3, 0.3, 0.35, 2, 4, 9, 26, 130, 1000],
    },
    18: {
      low: [22, 9, 4, 2.2, 1.6, 1.3, 1.2, 1.1, 1.0, 0.75, 1.0, 1.1, 1.2, 1.3, 1.6, 2.2, 4, 9, 22],
      med: [180, 48, 16, 8, 4, 2.2, 1.2, 0.7, 0.5, 0.4, 0.5, 0.7, 1.2, 2.2, 4, 8, 16, 48, 180],
      high: [700, 110, 28, 10, 3.5, 1.4, 0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.5, 1.4, 3.5, 10, 28, 110, 700],
    },
  };
  // fix 14-low (I botched the array)
  PLINKO_RAW[14].low = [7.1, 4, 1.9, 1.3, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.3, 1.9, 4, 7.1];

  const plinkoCache = {};

  function plinkoTables(rows, risk) {
    const key = rows + ":" + risk;
    if (plinkoCache[key]) return plinkoCache[key];
    const raw = PLINKO_RAW[rows][risk];
    const total = 2 ** rows;
    let ev = 0;
    for (let k = 0; k <= rows; k++) ev += binom(rows, k) * raw[k];
    ev /= total;
    const scaled = raw.map((m) => Math.round((m * PLINKO_RTP) / ev * 100) / 100);
    const probs = [];
    for (let k = 0; k <= rows; k++) probs.push(binom(rows, k) / total);
    plinkoCache[key] = { mults: scaled, probs, rawEv: ev, rtp: PLINKO_RTP };
    return plinkoCache[key];
  }

  /* Sample bucket from N independent 50/50 bits (matches physics path). */
  function plinkoPath(rows, bits /* array of 0/1 */) {
    let k = 0;
    const path = [];
    for (let i = 0; i < rows; i++) {
      k += bits[i];
      path.push(k);
    }
    return { bucket: k, path };
  }

  /* ---------- WHEEL ----------
     12 equal carnival slices (same layout as the face art).
     Coin slices x2 x5 x20 x3 x50 x12 → coin EV 7.67× on an 80-coin spin.
     Ticket slices are extra juice. Play-for-fun, deliberately generous. */
  const WHEEL_COST = 800;
  const WHEEL_SEGMENTS = [
    { id: "x2", label: "x2", kind: "mult", mult: 2, w: 1, color: "#ffd23a", icon: "assets/symbols/potato.png" },
    { id: "tslot", label: "SLOT", kind: "ticket", ticket: "slot", w: 1, color: "#ff4da6", icon: "assets/games/rewards/ticket_slot.png" },
    { id: "x5", label: "x5", kind: "mult", mult: 5, w: 1, color: "#2f8cff", icon: "assets/symbols/potato.png" },
    { id: "tplinko", label: "PLINKO", kind: "ticket", ticket: "plinko", w: 1, color: "#ff8a1f", icon: "assets/games/rewards/ticket_plinko.png" },
    { id: "x20", label: "x20", kind: "mult", mult: 20, w: 1, color: "#3ecf4a", icon: "assets/symbols/potato.png" },
    { id: "tmines", label: "MINES", kind: "ticket", ticket: "mines", w: 1, color: "#7b3cff", icon: "assets/games/rewards/ticket_mines.png" },
    { id: "x3", label: "x3", kind: "mult", mult: 3, w: 1, color: "#ffe14a", icon: "assets/symbols/potato.png" },
    { id: "tcrash", label: "CRASH", kind: "ticket", ticket: "crash", w: 1, color: "#2b6bff", icon: "assets/games/rewards/ticket_crash.png" },
    { id: "tscratch", label: "SCRATCH", kind: "ticket", ticket: "scratch", w: 1, color: "#ff5aad", icon: "assets/games/rewards/ticket_scratch.png" },
    { id: "x50", label: "x50", kind: "mult", mult: 50, w: 1, color: "#2fd64a", icon: "assets/symbols/potato.png" },
    { id: "x12a", label: "x12", kind: "mult", mult: 12, w: 1, color: "#8a3cff", icon: "assets/symbols/potato.png" },
    { id: "x12b", label: "x12", kind: "mult", mult: 12, w: 1, color: "#ff3b3b", icon: "assets/symbols/potato.png" },
  ];

  function wheelTotalW() {
    return WHEEL_SEGMENTS.reduce((s, x) => s + x.w, 0);
  }

  function wheelCoinEv() {
    const tw = wheelTotalW();
    let ev = 0;
    for (const s of WHEEL_SEGMENTS) {
      if (s.kind === "mult") ev += (s.w / tw) * s.mult;
      // bonus segments return 0 coins (energy/gems are extras)
    }
    return ev;
  }

  function pickWeighted(items, u, weightKey = "w") {
    const tw = items.reduce((s, x) => s + x[weightKey], 0);
    let t = u * tw;
    for (let i = 0; i < items.length; i++) {
      t -= items[i][weightKey];
      if (t <= 0) return i;
    }
    return items.length - 1;
  }

  /* ---------- SLOT ----------
     3 reels × 3 visible. Classic virtual reel strips.
     5 paylines: top, mid, bot, diag\, diag/.
     Wild (bolt) substitutes for all except scatter (can).
     3 scatter cans anywhere on the window: energy bonus.
     Pays 3-of-a-kind on a line. Highest line win only per line.
     Bet = 1 energy × betMult. Coin win = linePay * COIN_PER_ENERGY * betMult.
     COIN_PER_ENERGY is the economic bridge (1 energy spin ≈ 100 coin unit). */

  const COIN_PER_ENERGY = 1500;

  const SYM = {
    wild: { id: "wild", name: "Volt Wild", file: "assets/symbols/bolt.png", pay: 80 },
    chest: { id: "chest", name: "Hoard", file: "assets/symbols/chest.png", pay: 48 },
    gem: { id: "gem", name: "Zap Gem", file: "assets/symbols/gem.png", pay: 28 },
    coin: { id: "coin", name: "Lucky Coin", file: "assets/symbols/coin.png", pay: 16 },
    pot: { id: "pot", name: "Pot o' Gold", file: "assets/symbols/pot.png", pay: 12 },
    star: { id: "star", name: "Star", file: "assets/symbols/star.png", pay: 8 },
    can: { id: "can", name: "Lucky Potato", file: "assets/symbols/potato.png", pay: 8, scatter: true },
    crate: { id: "crate", name: "Crate", file: "assets/symbols/crate.png", pay: 4 },
    gcrash: { id: "gcrash", name: "Sky Crash", file: "assets/symbols/gcrash.png", pay: 20, portal: "crash" },
    gplinko: { id: "gplinko", name: "Plinko", file: "assets/symbols/gplinko.png", pay: 20, portal: "plinko" },
    gmines: { id: "gmines", name: "Gem Mines", file: "assets/symbols/gmines.png", pay: 20, portal: "mines" },
    gwheel: { id: "gwheel", name: "Wheel", file: "assets/symbols/gwheel.png", pay: 20, portal: "wheel" },
  };

  const PORTALS = { gcrash: "crash", gplinko: "plinko", gmines: "mines", gwheel: "wheel" };
  function isPortal(id) {
    return !!PORTALS[id];
  }

  /* Hand-built strips. Length 30. Tuned toward ~96% via enumerate. */
  const STRIPS = [
    [
      "crate", "star", "coin", "gcrash", "pot", "can", "crate", "coin", "star", "gem",
      "gplinko", "pot", "crate", "coin", "star", "can", "gmines", "chest", "pot", "coin",
      "star", "crate", "wild", "coin", "gwheel", "star", "pot", "can", "crate", "gem",
    ],
    [
      "crate", "coin", "star", "gcrash", "pot", "crate", "can", "coin", "star", "gplinko",
      "gem", "pot", "crate", "coin", "star", "gmines", "chest", "can", "pot", "coin",
      "crate", "star", "wild", "gwheel", "coin", "pot", "star", "crate", "can", "gem",
    ],
    [
      "crate", "star", "gcrash", "coin", "pot", "crate", "can", "star", "coin", "gplinko",
      "gem", "pot", "crate", "coin", "star", "can", "gmines", "chest", "pot", "star",
      "crate", "coin", "wild", "gwheel", "pot", "star", "coin", "crate", "can", "gem",
    ],
  ];

  const LINES = [
    [0, 0, 0], // top
    [1, 1, 1], // mid
    [2, 2, 2], // bot
    [0, 1, 2], // \
    [2, 1, 0], // /
  ];

  function wrap(strip, i) {
    const n = strip.length;
    return strip[((i % n) + n) % n];
  }

  function windowFromStops(stops) {
    // window[row][reel]
    const win = [[], [], []];
    for (let r = 0; r < 3; r++) {
      const strip = STRIPS[r];
      const s = stops[r];
      win[0][r] = wrap(strip, s - 1);
      win[1][r] = wrap(strip, s);
      win[2][r] = wrap(strip, s + 1);
    }
    return win;
  }

  function sameForPay(a, b) {
    if (a === "can" || b === "can") return a === b;
    if (isPortal(a) || isPortal(b)) return a === b;
    if (a === "wild" || b === "wild") return true;
    return a === b;
  }

  function lineSymbol(ids) {
    // resolve the paying symbol (ignore wilds if a natural exists)
    const naturals = ids.filter((x) => x !== "wild");
    if (naturals.length === 0) return "wild";
    const t = naturals[0];
    if (naturals.every((x) => x === t)) return t;
    return null;
  }

  function evalWindow(window) {
    const lineWins = [];
    let coinMult = 0;
    for (let li = 0; li < LINES.length; li++) {
      const ids = LINES[li].map((row, reel) => window[row][reel]);
      if (ids.includes("can") || ids.some(isPortal)) continue;
      const three =
        sameForPay(ids[0], ids[1]) && sameForPay(ids[1], ids[2]) && sameForPay(ids[0], ids[2]);
      if (three) {
        const sym = lineSymbol(ids);
        if (!sym) continue;
        const pay = SYM[sym].pay;
        coinMult += pay;
        lineWins.push({ line: li, symbol: sym, pay, cells: LINES[li].map((row, reel) => [row, reel]) });
        continue;
      }
      // left-pair 2-oak — more frequent small hits
      if (sameForPay(ids[0], ids[1]) && ids[0] !== "can" && ids[1] !== "can") {
        const pair = ids[0] === "wild" ? ids[1] : ids[0];
        if (pair && SYM[pair]) {
          const pay = Math.max(1, Math.round(SYM[pair].pay * 0.36));
          coinMult += pay;
          lineWins.push({
            line: li,
            symbol: pair,
            pay,
            cells: [
              [LINES[li][0], 0],
              [LINES[li][1], 1],
            ],
          });
        }
      }
    }
    let cans = 0;
    const scatterCells = [];
    for (let row = 0; row < 3; row++) {
      for (let reel = 0; reel < 3; reel++) {
        if (window[row][reel] === "can") {
          cans++;
          scatterCells.push([row, reel]);
        }
      }
    }
    let energyBonus = 0;
    let gemBonus = 0;
    let scatterPay = 0;
    if (cans >= 3) {
      energyBonus = 3;
      gemBonus = 1;
      scatterPay = SYM.can.pay * 2;
      coinMult += scatterPay;
    }
    let bonus = null;
    const portalCells = [];
    const portalCounts = {};
    for (let row = 0; row < 3; row++) {
      for (let reel = 0; reel < 3; reel++) {
        const id = window[row][reel];
        if (!isPortal(id)) continue;
        portalCounts[id] = (portalCounts[id] || 0) + 1;
        portalCells.push([row, reel, id]);
      }
    }
    for (const id of Object.keys(portalCounts)) {
      if (portalCounts[id] >= 3) {
        bonus = {
          game: PORTALS[id],
          symbol: id,
          count: portalCounts[id],
          cells: portalCells.filter((c) => c[2] === id).map(([r, re]) => [r, re]),
        };
        break;
      }
    }
    return { lineWins, coinMult, cans, scatterCells, energyBonus, gemBonus, scatterPay, bonus };
  }

  function enumerateSlotRtp() {
    const n0 = STRIPS[0].length;
    const n1 = STRIPS[1].length;
    const n2 = STRIPS[2].length;
    const total = n0 * n1 * n2;
    let ev = 0;
    let hits = 0;
    for (let a = 0; a < n0; a++) {
      for (let b = 0; b < n1; b++) {
        for (let c = 0; c < n2; c++) {
          const r = evalWindow(windowFromStops([a, b, c]));
          ev += r.coinMult;
          if (r.coinMult > 0) hits++;
        }
      }
    }
    // coinMult is in "pay units". A spin costs 1 energy = COIN_PER_ENERGY coins.
    // Win coins = coinMult * (COIN_PER_ENERGY / PAY_UNIT).
    // We set PAY_UNIT so that EV(coinMult)/PAY_UNIT = SLOT_RTP_TARGET
    // i.e. average coinMult * scale = SLOT_RTP_TARGET, scale = rtp / avgMult
    const avgMult = ev / total;
    return {
      combinations: total,
      avgPayUnits: avgMult,
      hitRate: hits / total,
      // coins returned per 100-coin energy unit if we pay `payUnits` coins * 1
      // We pay: winCoins = payUnits * COIN_PER_ENERGY / BASE
      // Choose BASE so RTP = avgPayUnits * COIN_PER_ENERGY / BASE / COIN_PER_ENERGY
      //        = avgPayUnits / BASE = target  => BASE = avgPayUnits / target
      payBase: avgMult / SLOT_RTP_TARGET,
    };
  }

  let _slotMeta = null;
  function slotMeta() {
    if (!_slotMeta) _slotMeta = enumerateSlotRtp();
    return _slotMeta;
  }

  function slotPayoutCoins(evalResult, betMult) {
    const meta = slotMeta();
    const coins = (evalResult.coinMult / meta.payBase) * COIN_PER_ENERGY * betMult;
    return Math.round(coins);
  }

  /* ---------- SCRATCH (bonus) ----------
     3×3 tickets. 3 matching symbols pay. RTP ~94% (bonus game). */
  const SCRATCH_PRIZES = [
    { id: "bust", w: 12, coins: 0 },
    { id: "small", w: 30, coins: 800 },
    { id: "mid", w: 24, coins: 1600 },
    { id: "nice", w: 18, coins: 3200 },
    { id: "big", w: 12, coins: 7000 },
    { id: "jack", w: 4, coins: 22000 },
  ];
  const SCRATCH_COST = 400;
  const SCRATCH_RTP = 0.98;
  (function calibrateScratch() {
    const tw = SCRATCH_PRIZES.reduce((s, x) => s + x.w, 0);
    let ev = 0;
    for (const p of SCRATCH_PRIZES) ev += (p.w / tw) * p.coins;
    const k = (SCRATCH_RTP * SCRATCH_COST) / ev;
    for (const p of SCRATCH_PRIZES) p.coins = Math.round(p.coins * k);
  })();

  function scratchEv() {
    const tw = SCRATCH_PRIZES.reduce((s, x) => s + x.w, 0);
    let ev = 0;
    for (const p of SCRATCH_PRIZES) ev += (p.w / tw) * p.coins;
    return { ev, rtp: ev / SCRATCH_COST, cost: SCRATCH_COST };
  }

  return {
    CRASH_RTP,
    MINES_RTP,
    PLINKO_RTP,
    WHEEL_RTP,
    SLOT_RTP_TARGET,
    COIN_PER_ENERGY,
    binom,
    crashMultiplier,
    crashSurviveProb,
    crashTimeTo,
    crashMultAt,
    CRASH_LAMBDA,
    minesMultiplier,
    minesNextSurvive,
    plinkoTables,
    plinkoPath,
    WHEEL_SEGMENTS,
    wheelTotalW,
    wheelCoinEv,
    pickWeighted,
    SYM,
    PORTALS,
    isPortal,
    STRIPS,
    LINES,
    windowFromStops,
    evalWindow,
    enumerateSlotRtp,
    slotMeta,
    slotPayoutCoins,
    SCRATCH_PRIZES,
    SCRATCH_COST,
    scratchEv,
  };
})();
