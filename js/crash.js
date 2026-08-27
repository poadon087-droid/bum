/* Shared-round crash. Runs ONLY while the sheet is open. */

const CRASH = (() => {
  const BOTS = ["LunaZap", "Ribbit", "Pipa", "Nim", "Koji", "Mango", "Vex", "Pearl", "Otto", "Zuzu", "Chip", "Nova"];

  let phase = "idle";
  let crashAt = 1;
  let t0 = 0;
  let waitLeft = 3;
  let raf = 0;
  let bet = 500;
  let autoAt = 2;
  let inRound = false;
  let cashed = false;
  let myBet = 0;
  let paidWithTicket = false;
  let paidWithPortal = false;
  let portalPending = false;
  let history = [];
  let flyers = [];
  let active = false;
  const els = {};
  const rocketImg = new Image();
  rocketImg.src = "assets/games/crash/rocket.png";
  const chartImg = new Image();
  chartImg.src = "assets/games/crash/chart.png";
  const boomImg = new Image();
  boomImg.src = "assets/games/crash/boom.png";
  const flameImg = new Image();
  flameImg.src = "assets/sprites/flame.png";

  function bind() {
    els.mult = document.getElementById("crash-mult");
    els.graph = document.getElementById("crash-graph");
    els.status = document.getElementById("crash-status");
    els.hist = document.getElementById("crash-hist");
    els.feed = document.getElementById("crash-feed");
    els.bet = document.getElementById("crash-bet");
    els.auto = document.getElementById("crash-auto");
    els.cta = document.getElementById("crash-cta");
    els.canvas = els.graph;
    if (els.status) els.status.textContent = "Open Crash to play a round";
  }

  async function loopSeed() {
    if (!active) return;
    const server = RNG.randomHex(32);
    const u = RNG.hashToUnit(await RNG.hmacSha256(server, "zaploon-crash:" + Date.now()));
    crashAt = MATH.crashMultiplier(u);
    spawnBots();
    phase = "wait";
    waitLeft = 3.2;
    t0 = performance.now();
    inRound = false;
    cashed = false;
    myBet = 0;
    paidWithTicket = false;
    paidWithPortal = false;
    paintCta();
    tick();
  }

  function spawnBots() {
    flyers = [];
    const used = new Set();
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      let name = BOTS[Math.floor(Math.random() * BOTS.length)];
      if (used.has(name)) name += i;
      used.add(name);
      const u = Math.random();
      const target = u < 0.45 ? 1.2 + Math.random() * 0.8 : u < 0.8 ? 2 + Math.random() * 3 : 5 + Math.random() * 16;
      flyers.push({
        name,
        bet: [250, 500, 1000, 2500][Math.floor(Math.random() * 4)],
        target: Math.round(target * 100) / 100,
        out: false,
      });
    }
  }

  function tick() {
    if (!active) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    if (phase === "wait") {
      const left = waitLeft - (now - t0) / 1000;
      els.mult.textContent = "1.00×";
      els.mult.className = "crash-mult wait";
      els.status.textContent = `Next round in ${Math.max(0, left).toFixed(1)}s`;
      draw(1, false);
      if (portalPending && !inRound && left <= 2.0) {
        portalPending = false;
        place();
      }
      if (left <= 0) {
        phase = "fly";
        t0 = now;
        AUDIO.pop();
      }
      return;
    }
    if (phase === "fly") {
      const t = (now - t0) / 1000;
      const m = MATH.crashMultAt(t);
      if (m >= crashAt) {
        boom();
        return;
      }
      els.mult.textContent = m.toFixed(2) + "×";
      els.mult.className = "crash-mult fly" + (m >= 5 ? " hot" : "");
      els.status.textContent = "Cash out before it pops!";
      flyers.forEach((f) => {
        if (!f.out && m >= f.target && f.target < crashAt) {
          f.out = true;
          pushFeed(`${f.name} cashed ${f.target.toFixed(2)}×`);
        }
      });
      if (inRound && !cashed && autoAt > 1 && m >= autoAt) cashout();
      draw(m, false);
      return;
    }
    if (phase === "boom") {
      const left = 2.2 - (now - t0) / 1000;
      els.mult.textContent = crashAt.toFixed(2) + "×";
      els.mult.className = "crash-mult boom";
      els.status.textContent = `Crashed at ${crashAt.toFixed(2)}×`;
      draw(crashAt, true);
      if (left <= 0) loopSeed();
    }
  }

  function boom() {
    phase = "boom";
    t0 = performance.now();
    AUDIO.crashBoom();
    history.unshift(crashAt);
    history = history.slice(0, 18);
    paintHist();
    if (inRound && !cashed) {
      FX.toast("Crashed — bet lost", "bad");
      FX.shake(document.getElementById("sheet-crash"));
    }
    inRound = false;
    paintCta();
    pushFeed(`POP ${crashAt.toFixed(2)}×`);
  }

  function place() {
    if (phase !== "wait") {
      FX.toast("Wait for the next round", "bad");
      return;
    }
    bet = clampBet(+els.bet.value || bet);
    els.bet.value = bet;
    if (inRound) {
      inRound = false;
      if (paidWithPortal) STATE.armPortal("crash", myBet);
      else if (!paidWithTicket) STATE.addCoins(myBet);
      myBet = 0;
      paidWithTicket = false;
      paidWithPortal = false;
      paintCta();
      return;
    }
    const portalStake = STATE.consumePortal("crash");
    if (portalStake) {
      paidWithPortal = true;
      paidWithTicket = true;
      myBet = portalStake;
      if (els.bet) els.bet.value = portalStake;
      document.querySelector("#sheet-crash .portal-banner")?.classList.add("hidden");
      FX.toast("FREE Crash — " + portalStake.toLocaleString() + " potatoes ride this rocket", "ok");
    } else {
      const free = STATE.useTicket("crash");
      if (!free && !STATE.spendCoins(bet)) {
        FX.toast("Need potatoes or a Crash ticket", "bad");
        return;
      }
      paidWithTicket = free;
      paidWithPortal = false;
      myBet = bet;
    }
    inRound = true;
    cashed = false;
    autoAt = Math.max(1.01, +els.auto.value || 0);
    AUDIO.click();
    paintCta();
  }

  function cashout() {
    if (phase !== "fly" || !inRound || cashed) return;
    const t = (performance.now() - t0) / 1000;
    const m = MATH.crashMultAt(t);
    if (m >= crashAt) return;
    cashed = true;
    inRound = false;
    const win = Math.round(myBet * m);
    STATE.addCoins(win);
    STATE.bump("crashCash");
    AUDIO.cash();
    FX.toast(`Cashed ${m.toFixed(2)}×  +${win.toLocaleString()}`, "win");
    if (m >= 3) {
      FX.confetti(20);
      FX.sparkle();
      FX.zap();
    }
    if (m >= 5) FX.rays();
    pushFeed(`YOU cashed ${m.toFixed(2)}×`);
    paintCta();
  }

  function paintCta() {
    if (!els.cta) return;
    if (phase === "fly" && inRound && !cashed) {
      els.cta.textContent = "CASHOUT";
      els.cta.className = "cta cash";
    } else if (phase === "wait" && inRound) {
      els.cta.textContent = "CANCEL BET";
      els.cta.className = "cta ghost";
    } else if (STATE.peekPortal("crash")) {
      els.cta.textContent = "FREE BET";
      els.cta.className = "cta cash";
    } else {
      els.cta.textContent = STATE.ticketCount("crash") ? "BET  (ticket)" : "BET";
      els.cta.className = "cta";
    }
  }

  function paintHist() {
    if (!els.hist) return;
    els.hist.innerHTML = history
      .map((m) => {
        const cls = m < 1.5 ? "lo" : m < 3 ? "mid" : m < 10 ? "hi" : "leg";
        return `<span class="pill ${cls}">${m.toFixed(2)}×</span>`;
      })
      .join("");
  }

  function pushFeed(t) {
    if (!els.feed) return;
    const row = document.createElement("div");
    row.textContent = t;
    els.feed.prepend(row);
    while (els.feed.children.length > 8) els.feed.lastChild.remove();
  }

  function draw(m, crashed) {
    const c = els.canvas;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    if (chartImg.complete && chartImg.naturalWidth) {
      g.drawImage(chartImg, 0, 0, w, h);
    } else {
      g.fillStyle = "#0b1024";
      g.fillRect(0, 0, w, h);
    }

    const tmax = Math.max(MATH.crashTimeTo(m), 1.2);
    const mmax = Math.max(m * 1.15, 2);
    const pts = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const tt = (tmax * i) / steps;
      const mm = Math.min(MATH.crashMultAt(tt), m);
      const x = 22 + (w - 48) * (tt / tmax);
      const y = h - 22 - ((h - 44) * (mm - 1)) / (mmax - 1);
      pts.push([x, y]);
    }
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.strokeStyle = crashed ? "#ff4d8d" : "#ffd23a";
    g.lineWidth = 3.4;
    g.lineJoin = "round";
    g.stroke();

    const last = pts[pts.length - 1];
    if (crashed && boomImg.complete && boomImg.naturalWidth) {
      const s = 86;
      g.drawImage(boomImg, last[0] - s / 2, last[1] - s / 2, s, s);
    } else if (rocketImg.complete && rocketImg.naturalWidth) {
      g.save();
      g.translate(last[0], last[1]);
      g.rotate(-0.55);
      if (flameImg.complete && flameImg.naturalWidth && phase === "fly") {
        const fw = flameImg.naturalWidth / 4;
        const fi = Math.floor(performance.now() / 90) % 4;
        g.drawImage(flameImg, fi * fw, 0, fw, flameImg.naturalHeight, -18, 10, 28, 28);
      }
      const s = 48;
      g.drawImage(rocketImg, -s / 2, -s / 2, s, s);
      g.restore();
    }
  }

  function clampBet(n) {
    n = Math.round(n);
    return Math.max(50, Math.min(STATE.get().coins || n, n));
  }

  function open() {
    if (els.bet) els.bet.value = bet;
    if (els.auto) els.auto.value = autoAt;
    paintHist();
    paintCta();
    if (STATE.peekPortal("crash")) {
      portalPending = true;
      if (els.bet) els.bet.value = STATE.peekPortal("crash");
    }
    if (!active) {
      active = true;
      if (phase === "idle" || phase === "wait" || phase === "boom") loopSeed();
      else tick();
    }
  }

  function close() {
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    if (els.status) els.status.textContent = "Paused — reopen to play";
  }

  return { bind, place, cashout, open, close };
})();
