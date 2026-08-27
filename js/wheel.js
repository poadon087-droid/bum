/* 12 equal slices drawn in CSS — pointer and payout always match. */

const WHEEL = (() => {
  let spinning = false;
  let rot = 0;
  const COST = 800;
  const els = {};

  function bind() {
    els.wheel = document.getElementById("prize-wheel");
    els.result = document.getElementById("wheel-result");
    paint();
  }

  function paint() {
    const segs = MATH.WHEEL_SEGMENTS;
    const stops = segs.map((s, i) => `${s.color} ${i * 30}deg ${(i + 1) * 30}deg`);
    els.wheel.style.background = `conic-gradient(from -90deg, ${stops.join(",")})`;
    els.wheel.style.transform = `rotate(${rot}deg)`;
    els.wheel.innerHTML = "";
    const lines = document.createElement("i");
    lines.className = "wlines";
    els.wheel.appendChild(lines);
    segs.forEach((s, i) => {
      const mid = i * 30 + 15;
      const lab = document.createElement("span");
      lab.className = "wlab";
      lab.dataset.i = String(i);
      if (s.icon) {
        const img = document.createElement("img");
        img.src = s.icon;
        img.alt = s.label;
        lab.appendChild(img);
      }
      const t = document.createElement("b");
      t.textContent = s.label;
      lab.appendChild(t);
      placeLabel(lab, mid, rot);
      els.wheel.appendChild(lab);
    });
    if (els.result && !spinning) {
      const p = STATE.peekPortal ? STATE.peekPortal("wheel") : 0;
      els.result.textContent = p
        ? `FREE spin · ${p.toLocaleString()} potatoes ride the wheel`
        : `${COST.toLocaleString()} potatoes · tickets for every game`;
    }
  }

  function placeLabel(lab, mid, wheelRot) {
    const upright = -mid - (wheelRot % 360);
    lab.style.transform = `rotate(${mid}deg) translateY(-96px) rotate(${upright}deg)`;
  }

  function relayoutLabels() {
    els.wheel.querySelectorAll(".wlab").forEach((lab) => {
      const i = +lab.dataset.i;
      placeLabel(lab, i * 30 + 15, rot);
    });
  }

  async function spin(free = false) {
    if (spinning) return;
    spinning = true;
    const st = STATE.get();
    let base = COST;
    const portal = STATE.consumePortal("wheel");
    if (portal) {
      base = portal;
      document.querySelector("#sheet-wheel .portal-banner")?.classList.add("hidden");
      FX.toast("FREE Wheel — spinning " + base.toLocaleString() + " potatoes", "ok");
    } else if (!free) {
      if (!STATE.spendCoins(COST)) {
        spinning = false;
        FX.toast("Need " + COST.toLocaleString() + " potatoes", "bad");
        return;
      }
    } else {
      if (Date.now() - st.dailyWheelAt < 20 * 3600 * 1000) {
        spinning = false;
        FX.toast("Daily spin already used", "bad");
        return;
      }
      st.dailyWheelAt = Date.now();
      STATE.save();
      base = 1200;
    }
    els.wheel.querySelectorAll(".wlab").forEach((l) => l.classList.remove("win"));
    const { stream } = await STATE.nextStream();
    const u = await stream.unit();
    const segs = MATH.WHEEL_SEGMENTS;
    const idx = MATH.pickWeighted(segs, u);
    const mid = idx * 30 + 15;
    const extra = 360 * (6 + Math.floor(Math.random() * 3));
    const target = extra + (360 - mid);
    els.wheel.style.transition = "none";
    els.wheel.style.transform = `rotate(${rot}deg)`;
    void els.wheel.offsetWidth;
    els.wheel.style.transition = "transform 4.4s cubic-bezier(.12,.75,.12,1)";
    els.wheel.style.transform = `rotate(${target}deg)`;
    let ticks = 0;
    const iv = setInterval(() => {
      AUDIO.wheel();
      if (++ticks > 30) clearInterval(iv);
    }, 120);
    await wait(4500);
    rot = ((target % 360) + 360) % 360;
    els.wheel.style.transition = "none";
    els.wheel.style.transform = `rotate(${rot}deg)`;
    relayoutLabels();
    const winLab = els.wheel.querySelector(`.wlab[data-i="${idx}"]`);
    if (winLab) winLab.classList.add("win");
    pay(segs[idx], base);
    spinning = false;
    STATE.bump("wheel");
  }

  function pay(seg, base) {
    if (seg.kind === "mult") {
      const win = Math.round((base || COST) * seg.mult);
      STATE.addCoins(win);
      els.result.textContent = `${seg.label}   +${win.toLocaleString()} potatoes`;
      if (seg.mult >= 20) {
        AUDIO.huge();
        FX.confetti(36);
        FX.sparkle();
        FX.rays();
      } else if (seg.mult >= 5) {
        AUDIO.win(3);
        FX.confetti(18);
        FX.sparkle();
      } else {
        AUDIO.win(2);
        FX.sparkle();
      }
    } else if (seg.kind === "ticket") {
      STATE.addTicket(seg.ticket, 1);
      const names = { crash: "Crash", plinko: "Plinko", slot: "Slot", mines: "Mines", scratch: "Scratch" };
      els.result.textContent = `${names[seg.ticket] || seg.ticket} ticket!`;
      AUDIO.cash();
      FX.confetti(16);
      FX.sparkle();
    }
    FX.toast(els.result.textContent, "win");
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function dailyLeft() {
    const last = STATE.get().dailyWheelAt || 0;
    return Math.max(0, 20 * 3600 * 1000 - (Date.now() - last));
  }

  function open() {
    paint();
    if (STATE.peekPortal("wheel") && !spinning) setTimeout(() => spin(false), 420);
  }

  return { bind, spin, paint, open, dailyLeft, COST };
})();
