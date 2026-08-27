/* 3-reel cartoon slot — predetermined stops, juicy strips, 5 lines. */

const SLOT = (() => {
  function cellH() {
    return document.querySelector(".reel-cell")?.offsetHeight || 68;
  }
  let spinning = false;
  let auto = false;
  let autoTimer = null;
  let betMult = 1;
  let charge = 0;
  const els = {};

  function bind() {
    els.reels = [...document.querySelectorAll(".reel-strip")];
    els.viewport = document.getElementById("reel-viewport");
    els.spin = document.getElementById("btn-spin");
    els.mult = document.getElementById("bet-mult");
    els.chargeFill = document.getElementById("charge-fill");
    els.chargeTxt = document.getElementById("charge-txt");
    els.winLines = document.getElementById("win-lines");
    buildStrips();
  }

  function buildStrips() {
    els.reels.forEach((el, ri) => {
      el.innerHTML = "";
      const strip = MATH.STRIPS[ri];
      for (let copy = 0; copy < 12; copy++) {
        for (const id of strip) {
          const cell = document.createElement("div");
          cell.className = "reel-cell";
          cell.dataset.sym = id;
          const img = document.createElement("img");
          img.src = MATH.SYM[id].file;
          img.alt = id;
          img.draggable = false;
          cell.appendChild(img);
          el.appendChild(cell);
        }
      }
      el.dataset.len = String(strip.length);
      setOffset(el, 1, false, 0);
    });
  }

  function setOffset(el, stop, animate, extraTurns = 0) {
    const len = +el.dataset.len;
    const idx = ((stop - 1) % len + len) % len + extraTurns * len;
    const y = -idx * cellH();
    el.style.transition = animate
      ? `transform ${0.7 + extraTurns * 0.11}s cubic-bezier(.12,.82,.12,1)`
      : "none";
    el.style.transform = `translateY(${y}px)`;
    el.dataset.stop = String(stop);
  }

  function highlight(result) {
    els.viewport.querySelectorAll(".reel-cell").forEach((c) => c.classList.remove("win-cell"));
    els.winLines.innerHTML = "";
    if (!result.lineWins.length && result.cans < 3 && !result.bonus) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    const colors = ["#ff4d8d", "#ffd23a", "#3ecfff", "#8ee04a", "#b44dff"];
    result.lineWins.forEach((lw, i) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      p.setAttribute(
        "points",
        lw.cells.map(([row, reel]) => `${16.6 + reel * 33.3},${16.6 + row * 33.3}`).join(" ")
      );
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", colors[i % colors.length]);
      p.setAttribute("stroke-width", "3.2");
      p.setAttribute("stroke-linecap", "round");
      svg.appendChild(p);
      lw.cells.forEach(([row, reel]) => markVisible(reel, row));
    });
    result.scatterCells?.forEach(([row, reel]) => markVisible(reel, row));
    result.bonus?.cells?.forEach(([row, reel]) => markVisible(reel, row));
    els.winLines.appendChild(svg);
  }

  function markVisible(reel, row) {
    const strip = els.reels[reel];
    const len = +strip.dataset.len;
    const stop = +strip.dataset.stop || 0;
    const topIdx = ((stop - 1) % len + len) % len;
    const cells = [...strip.children];
    for (let copy = 0; copy < 12; copy++) {
      const i = copy * len + topIdx + row;
      if (cells[i]) cells[i].classList.add("win-cell");
    }
  }

  async function spin() {
    if (spinning) return;
    STATE.regen();
    const costE = betMult;
    const free = STATE.useTicket("slot");
    if (!free) {
      if (STATE.get().energy < costE) {
        FX.toast("Not enough energy", "bad");
        AUDIO.lose();
        return;
      }
      STATE.spendEnergy(costE);
    }
    STATE.bump("spins");
    spinning = true;
    els.spin.classList.add("busy");
    highlight({ lineWins: [], cans: 0 });
    AUDIO.spin();
    els.reels.forEach((el) => el.classList.add("blur"));

    const { stream } = await STATE.nextStream();
    const stops = [
      await stream.int(MATH.STRIPS[0].length),
      await stream.int(MATH.STRIPS[1].length),
      await stream.int(MATH.STRIPS[2].length),
    ];
    const window = MATH.windowFromStops(stops);
    const ev = MATH.evalWindow(window);
    let coins = MATH.slotPayoutCoins(ev, betMult);
    if (STATE.partnerActive()) coins = Math.round(coins * 1.2);

    els.reels.forEach((el, i) => {
      const turns = 4 + i * 2;
      setOffset(el, +(el.dataset.stop || 0), false, 0);
      requestAnimationFrame(() => setOffset(el, stops[i], true, turns));
    });

    const totalMs = 820 + 8 * 110 + 80;
    await wait(totalMs);
    els.reels.forEach((el) => el.classList.remove("blur"));
    AUDIO.stop();
    highlight(ev);

    if (ev.energyBonus) STATE.addEnergy(ev.energyBonus);
    if (ev.gemBonus) STATE.addGems(ev.gemBonus);
    if (coins > 0) {
      STATE.addCoins(coins);
      STATE.bump("lineWins", ev.lineWins.length || 1);
      const tier = coins >= 800 ? 3 : coins >= 300 ? 2 : 1;
      if (tier >= 3) {
        AUDIO.huge();
        FX.confetti(40);
        FX.toast(`LEGENDARY  +${fmt(coins)} potatoes`, "win");
        FX.sparkle();
        FX.rays();
        FX.zap();
      } else {
        AUDIO.win(tier);
        if (tier >= 2) FX.confetti(16);
        FX.toast(`+${fmt(coins)} potatoes`, "win");
        if (tier >= 2) {
          FX.sparkle();
          FX.rays();
        }
      }
      maybeSticker(ev);
    } else if (!ev.bonus) {
      AUDIO.tick();
    }

    charge = Math.min(100, charge + (ev.coinMult > 0 ? 8 : 3));
    if (charge >= 100) {
      charge = 0;
      STATE.addEnergy(5);
      FX.toast("CHARGE FULL — +5 energy!", "ok");
      AUDIO.cash();
    }
    paintCharge();

    spinning = false;
    els.spin.classList.remove("busy");
    if (ev.bonus) {
      stopAuto();
      const stake = Math.max(coins, 800 * betMult);
      STATE.armPortal(ev.bonus.game, stake);
      if (window.ZAP && ZAP.showPortal) ZAP.showPortal(ev.bonus.game, stake);
      else FX.toast("FREE " + ev.bonus.game.toUpperCase() + "!", "win");
      return;
    }
    if (auto) autoTimer = setTimeout(spin, 380);
  }

  function maybeSticker(ev) {
    const pool = ["blink", "pipa", "can", "chest", "star"];
    if (Math.random() < 0.18 || ev.cans >= 3) {
      STATE.addSticker(pool[Math.floor(Math.random() * pool.length)]);
      FX.toast("New sticker!", "ok");
    }
  }

  function paintCharge() {
    if (els.chargeFill) els.chargeFill.style.width = charge + "%";
    if (els.chargeTxt) els.chargeTxt.textContent = `${charge}/100`;
  }

  function cycleBet() {
    const opts = [1, 2, 5, 10];
    betMult = opts[(opts.indexOf(betMult) + 1) % opts.length];
    if (els.mult) els.mult.textContent = "×" + betMult;
    AUDIO.click();
  }

  function startAuto() {
    auto = true;
    document.getElementById("auto-flag")?.classList.add("on");
    if (!spinning) spin();
  }
  function stopAuto() {
    auto = false;
    clearTimeout(autoTimer);
    document.getElementById("auto-flag")?.classList.remove("on");
  }
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function fmt(n) {
    return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
  }

  return { bind, spin, cycleBet, startAuto, stopAuto, isSpinning: () => spinning, getBet: () => betMult, paintCharge };
})();
