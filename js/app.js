/* Zaploon shell — HUD, navigation, extras. */

(function () {
  const STICKERS = [
    { id: "blink", name: "Blink", src: "assets/chars/cyclops.png" },
    { id: "pipa", name: "Pipa", src: "assets/chars/blob.png" },
    { id: "frog", name: "Ribbit", src: "assets/icons/frog.svg" },
    { id: "can", name: "Volt Can", src: "assets/symbols/can.png" },
    { id: "chest", name: "Hoard", src: "assets/symbols/chest.png" },
    { id: "star", name: "Lucky Star", src: "assets/symbols/star.png" },
    { id: "coin", name: "Smile Coin", src: "assets/symbols/coin.png" },
    { id: "gem", name: "Zap Gem", src: "assets/symbols/gem.png" },
    { id: "bolt", name: "Wild Bolt", src: "assets/symbols/bolt.png" },
  ];

  function fmt(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return n.toLocaleString("en-US");
  }

  function paintHud() {
    STATE.regen();
    const s = STATE.get();
    const max = STATE.energyMax();
    document.getElementById("hud-coins").textContent = fmt(s.coins);
    document.getElementById("hud-gems").textContent = s.gems;
    document.getElementById("hud-en").textContent = s.energy;
    document.getElementById("plvl").textContent = s.level;
    document.getElementById("pname").textContent = s.name;
    document.getElementById("prank").textContent = s.rank;
    document.getElementById("free-pass").textContent = s.energy;
    document.getElementById("ebar-txt").textContent = `${s.energy}/${max}`;
    document.getElementById("ebar-fill").style.width = Math.min(100, (s.energy / max) * 100) + "%";
    const left = STATE.nextEnergyIn();
    document.getElementById("ebar-timer").textContent = left
      ? `Free energy in ${clock(left)}`
      : "Energy full";
    document.getElementById("piggy-lbl").textContent = `${fmt(s.piggy)}/${fmt(s.piggyGoal)}`;
    document.getElementById("hotline").textContent = fmt(s.stats.biggestWin || 2400);
    document.getElementById("btn-sound").textContent = s.settings.sound ? "♪" : "🔇";
    document.getElementById("charge-boost").textContent = STATE.partnerActive() ? "1.2×" : "200";
  }

  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  const PORTAL_NAMES = { crash: "Sky Crash", plinko: "Plinko", mines: "Gem Mines", wheel: "Wheel" };
  const PORTAL_SYM = { crash: "gcrash", plinko: "gplinko", mines: "gmines", wheel: "gwheel" };
  let portalTimer = 0;
  let portalGame = null;

  function paintPortalBanner() {
    document.querySelectorAll(".portal-banner").forEach((el) => {
      const g = el.dataset.game;
      const stake = STATE.peekPortal(g);
      if (stake) {
        el.classList.remove("hidden");
        const txt = el.querySelector(".portal-banner-txt");
        if (txt) txt.textContent = `FREE ${PORTAL_NAMES[g] || g} · ${fmt(stake)} potatoes ride this play`;
      } else {
        el.classList.add("hidden");
      }
    });
  }

  function launchPortalSheet() {
    const pop = document.getElementById("portal-pop");
    if (pop) pop.classList.add("hidden");
    const g = portalGame;
    portalGame = null;
    if (g) openSheet(g);
  }

  function showPortal(game, stake) {
    portalGame = game;
    clearTimeout(portalTimer);
    const pop = document.getElementById("portal-pop");
    const ico = document.getElementById("portal-ico");
    const name = document.getElementById("portal-name");
    const st = document.getElementById("portal-stake");
    if (ico && MATH.SYM[PORTAL_SYM[game]]) ico.src = MATH.SYM[PORTAL_SYM[game]].file;
    if (name) name.textContent = PORTAL_NAMES[game] || game;
    if (st) st.textContent = `FREE play · ${fmt(stake)} potatoes on the line`;
    if (pop) pop.classList.remove("hidden");
    AUDIO.huge();
    FX.confetti(28);
    FX.sparkle();
    FX.rays();
    portalTimer = setTimeout(launchPortalSheet, 1600);
  }

  function openSheet(id) {
    closeSheets();
    const el = document.getElementById("sheet-" + id);
    if (!el) return;
    el.classList.add("on");
    const iframe = el.querySelector("iframe");
    if (iframe && iframe.dataset.src) {
      iframe.src = iframe.dataset.src;
    }
    if (id === "crash") CRASH.open();
    if (id === "plinko") PLINKO.open();
    if (id === "mines") MINES.open();
    if (id === "wheel") {
      if (WHEEL.open) WHEEL.open();
      else WHEEL.paint();
      paintDaily();
    }
    if (id === "upgrade") paintUpgrades();
    if (id === "earn") paintQuests();
    if (id === "stickers") paintStickers();
    if (id === "scratch") paintScratch(false);
    paintTickets();
    if (id === "fair") paintFair();
    if (id === "help") paintHelp();
    paintPortalBanner();
    AUDIO.click();
  }

  function closeSheets() {
    document.querySelectorAll(".sheet").forEach((s) => {
      s.classList.remove("on");
      const iframe = s.querySelector("iframe");
      if (iframe) {
        iframe.src = "";
      }
    });
    if (window.CRASH && CRASH.close) CRASH.close();
  }

  function paintUpgrades() {
    const s = STATE.get();
    document.getElementById("upgrade-list").innerHTML = STATE.UPGRADES.map((u) => {
      const lv = s.upgrades[u.id] || 0;
      const maxed = lv >= u.max;
      const cost = maxed ? "—" : fmt(u.cost(lv));
      return `<div class="card">
        <h3>${u.name}  <span class="tiny">Lv ${lv}/${u.max}</span></h3>
        <p>${u.desc}</p>
        <button class="btn-sm" data-up="${u.id}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "Buy " + cost}</button>
      </div>`;
    }).join("");
  }

  function paintQuests() {
    STATE.get();
    document.getElementById("earn-list").innerHTML = STATE.QUESTS.map((q) => {
      const have = Math.min(q.need, STATE.get().questProg[q.key] || 0);
      const done = have >= q.need;
      const claimed = STATE.get().questClaimed[q.id];
      const bits = [];
      if (q.reward.coins) bits.push(fmt(q.reward.coins) + "★");
      if (q.reward.energy) bits.push("+" + q.reward.energy + "⚡");
      if (q.reward.gems) bits.push("+" + q.reward.gems + "◆");
      return `<div class="card">
        <h3>${q.name}</h3>
        <p>${have}/${q.need} · ${bits.join("  ")}</p>
        <button class="btn-sm" data-q="${q.id}" ${!done || claimed ? "disabled" : ""}>${claimed ? "CLAIMED" : done ? "CLAIM" : "IN PROGRESS"}</button>
      </div>`;
    }).join("");
  }

  function paintStickers() {
    const own = STATE.get().stickers;
    document.getElementById("sticker-grid").innerHTML = STICKERS.map((s) => {
      const n = own[s.id] || 0;
      return `<div class="sticker ${n ? "" : "locked"}">
        <img src="${s.src}" alt="" />
        <b>${s.name}</b>
        <div class="tiny">×${n}</div>
      </div>`;
    }).join("");
  }

  let ticket = null;
  function paintScratch(newTicket) {
    const grid = document.getElementById("scratch-grid");
    if (newTicket || !ticket) {
      ticket = { opened: 0, done: false, cells: Array(9).fill("?") };
      grid.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const b = document.createElement("button");
        b.className = "sc-cell";
        b.textContent = "?";
        b.addEventListener("click", () => scratchCell(i, b));
        grid.appendChild(b);
      }
      document.getElementById("scratch-out").textContent = "";
    }
  }

  async function scratchCell(i, el) {
    if (!ticket || ticket.done || el.classList.contains("open")) return;
    if (ticket.opened === 0) {
      const free = STATE.useTicket("scratch");
      if (!free && !STATE.spendCoins(MATH.SCRATCH_COST)) {
        FX.toast("Need " + MATH.SCRATCH_COST + " potatoes or a scratch ticket", "bad");
        return;
      }
    }
    el.classList.add("open");
    ticket.opened++;
    const faces = [
      "assets/symbols/coin.png",
      "assets/symbols/can.png",
      "assets/symbols/gem.png",
      "assets/symbols/star.png",
      "assets/symbols/bolt.png",
    ];
    el.innerHTML = `<img src="${faces[i % 5]}" alt="" />`;
    AUDIO.tick();
    if (ticket.opened >= 3 && !ticket.done) {
      ticket.done = true;
      const { stream } = await STATE.nextStream();
      const u = await stream.unit();
      const idx = MATH.pickWeighted(MATH.SCRATCH_PRIZES, u);
      const p = MATH.SCRATCH_PRIZES[idx];
      if (p.coins) {
        STATE.addCoins(p.coins);
        AUDIO.win(2);
        FX.toast(`Ticket +${p.coins}`, "win");
        FX.sparkle();
        if (p.coins >= 3000) FX.rays();
      } else {
        AUDIO.lose();
        FX.toast("Scratch bust", "bad");
      }
      document.getElementById("scratch-out").textContent = p.coins ? `+${p.coins} potatoes` : "No prize";
    }
  }

  async function paintFair() {
    const s = STATE.get();
    document.getElementById("client-seed").value = s.clientSeed;
    document.getElementById("server-hash").textContent = await STATE.serverHash();
    document.getElementById("nonce").textContent = s.nonce;
    const meta = MATH.slotMeta();
    document.getElementById("slot-meta").textContent =
      `Slot full cycle ${meta.combinations.toLocaleString()} stops · hit rate ${(meta.hitRate * 100).toFixed(2)}% · payBase ${meta.payBase.toFixed(4)} · target RTP ${(MATH.SLOT_RTP_TARGET * 100).toFixed(1)}%`;
    const wev = MATH.wheelCoinEv();
    const extra = document.getElementById("rtp-extra") || (() => {
      const p = document.createElement("p");
      p.id = "rtp-extra";
      p.className = "tiny";
      document.getElementById("rtp-card").appendChild(p);
      return p;
    })();
    extra.textContent = `Wheel raw coin EV ${wev.toFixed(3)}x. Scratch EV ${MATH.scratchEv().ev.toFixed(0)} / ${MATH.SCRATCH_COST} = ${(MATH.scratchEv().rtp * 100).toFixed(1)}%.`;
  }

  function paintHelp() {
    document.getElementById("help-body").innerHTML = `
      <div class="card"><h3>Slot</h3><p>Spend energy (or a slot ticket). 5 paylines — 3 across + 2 diagonals. Wild bolt substitutes for everything except the Lucky Potato scatter. 3 potatoes anywhere grant +3 energy and +1 gem. Tap ×1 to cycle ×2 / ×5 / ×10. Hold SPIN to autospin; tap again to stop.</p>
      <p class="tiny">Pays 3-oak and smaller 2-oak. Soft 99% RTP. Slot tickets skip the energy cost.</p></div>
      <div class="card"><h3>Bonus portals</h3><p>Land 3 matching Crash, Plinko, Mines, or Wheel stickers anywhere on the window. Autospin stops. Your slot coins stay. Then you jump into that game for one <b>FREE</b> play. The free stake is the bigger of your slot win and 800 × your bet chip — nothing extra is spent. Whatever that game pays multiplies the ride.</p></div>
      <div class="card"><h3>Sky Crash</h3><p>Only runs while this sheet is open. BET once, then tap CASHOUT (or set a number in Auto cashout ×). 99.5% RTP. Busts still happen.</p></div>
      <div class="card"><h3>Potato Pyramid</h3><p>One DROP per tap. Every bucket is in play. 10–18 rows, Low / Medium / High risk.</p></div>
      <div class="card"><h3>Gem Mines</h3><p>PLAY starts a 5×5 board. Tap tiles, then CASH OUT any time. Default 2 mines.</p></div>
      <div class="card"><h3>Wheel & Scratch</h3><p>One SPIN is 800 potatoes. Slices pay ×2–×50 or a ticket for an individual game. Daily spin is free once per 20 hours. Scratch: one 400-potato ticket, tap 3 tiles.</p></div>
      <div class="card"><h3>What we added vs a plain clone</h3><p>Published RTP on every game. Honest partner boost (coins only, documented). Piggy bank skim you can smash. Daily quests. Sticker book. Charge meter bonus energy. Seeded HMAC outcomes. No fake near-miss rigging.</p></div>
    `;
  }

  function paintTickets() {
    const map = {
      crash: ["tix-crash", "assets/games/rewards/ticket_crash.png"],
      plinko: ["tix-plinko", "assets/games/rewards/ticket_plinko.png"],
      mines: ["tix-mines", "assets/games/rewards/ticket_mines.png"],
      scratch: ["tix-scratch", "assets/games/rewards/ticket_scratch.png"],
      slot: ["tix-slot", "assets/games/rewards/ticket_slot.png"],
    };
    Object.keys(map).forEach((g) => {
      const el = document.getElementById(map[g][0]);
      if (!el) return;
      const n = STATE.ticketCount(g);
      el.innerHTML = `<i class="spr spr-ticket"></i><img src="${map[g][1]}" alt="" /> Free tickets: ${n}`;
    });
    document.querySelectorAll("[data-tix]").forEach((dot) => {
      const n = STATE.ticketCount(dot.dataset.tix);
      dot.hidden = n <= 0;
      dot.textContent = n > 9 ? "9+" : String(n);
    });
  }

  function paintDaily() {
    const left = WHEEL.dailyLeft();
    const b = document.getElementById("wheel-daily");
    b.disabled = left > 0;
    b.textContent = left > 0 ? `DAILY in ${clock(left)}` : "DAILY FREE SPIN";
  }

  function bind() {
    STATE.load();
    SLOT.bind();
    CRASH.bind();
    PLINKO.bind();
    MINES.bind();
    WHEEL.bind();
    paintHud();
    STATE.on(paintHud);

    document.getElementById("btn-enter").addEventListener("click", () => {
      AUDIO.unlock();
      document.getElementById("boot").classList.add("go");
    });

    document.querySelectorAll("[data-open]").forEach((b) => {
      b.addEventListener("click", () => openSheet(b.dataset.open));
    });
    document.querySelectorAll("[data-close]").forEach((b) => {
      b.addEventListener("click", closeSheets);
    });

    const spin = document.getElementById("btn-spin");
    let holdT = 0;
    spin.addEventListener("pointerdown", () => {
      holdT = setTimeout(() => SLOT.startAuto(), 380);
    });
    const endHold = () => clearTimeout(holdT);
    spin.addEventListener("pointerup", endHold);
    spin.addEventListener("pointerleave", endHold);
    spin.addEventListener("click", () => {
      if (document.getElementById("auto-flag").classList.contains("on")) {
        SLOT.stopAuto();
        return;
      }
      SLOT.spin();
    });
    document.getElementById("bet-mult").addEventListener("click", () => SLOT.cycleBet());

    document.getElementById("crash-cta").addEventListener("click", () => {
      const t = document.getElementById("crash-cta").textContent;
      if (t === "CASHOUT") CRASH.cashout();
      else CRASH.place();
    });
    document.getElementById("plinko-drop").addEventListener("click", () => PLINKO.drop());
    document.getElementById("plinko-rows").addEventListener("change", (e) => PLINKO.setRows(e.target.value));
    document.getElementById("plinko-risk").addEventListener("change", (e) => PLINKO.setRisk(e.target.value));
    document.getElementById("mines-cta").addEventListener("click", () => {
      if (MINES.isLive()) MINES.cash();
      else MINES.start();
    });
    document.getElementById("wheel-spin").addEventListener("click", () => WHEEL.spin(false));
    document.getElementById("wheel-daily").addEventListener("click", () => WHEEL.spin(true));

    document.getElementById("upgrade-list").addEventListener("click", (e) => {
      const id = e.target.dataset.up;
      if (!id) return;
      if (STATE.buyUpgrade(id)) {
        AUDIO.cash();
        FX.toast("Upgraded!", "ok");
        paintUpgrades();
      } else FX.toast("Need more coins", "bad");
    });
    document.getElementById("earn-list").addEventListener("click", (e) => {
      const id = e.target.dataset.q;
      if (!id) return;
      if (STATE.claimQuest(id)) {
        AUDIO.cash();
        FX.confetti(16);
        paintQuests();
      }
    });

    document.getElementById("btn-partner").addEventListener("click", () => {
      if (STATE.unlockPartner()) {
        FX.toast("Partner boost ON 10 min", "ok");
        AUDIO.cash();
        document.getElementById("partner").classList.add("hidden");
      } else FX.toast("Need 8 gems", "bad");
    });
    document.getElementById("partner-x").addEventListener("click", () => {
      document.getElementById("partner").classList.add("hidden");
      try { localStorage.setItem("zaploon.partner.hide", "1"); } catch (_) {}
    });
    if (localStorage.getItem("zaploon.partner.hide")) {
      document.getElementById("partner").classList.add("hidden");
    }

    document.getElementById("sat-piggy").addEventListener("click", () => {
      const got = STATE.smashPiggy();
      if (got) {
        FX.confetti(20);
        AUDIO.huge();
        FX.toast(`Piggy smashed +${fmt(got)}`, "win");
      } else FX.toast("Piggy still filling", "ok");
    });

    document.getElementById("scratch-buy").addEventListener("click", () => paintScratch(true));

    document.getElementById("btn-fair").addEventListener("click", () => openSheet("fair"));
    document.getElementById("btn-help").addEventListener("click", () => openSheet("help"));
    document.getElementById("btn-paytable").addEventListener("click", () => openSheet("help"));
    document.getElementById("btn-sound").addEventListener("click", () => {
      const s = STATE.get();
      s.settings.sound = !s.settings.sound;
      STATE.save();
      AUDIO.click();
    });
    document.getElementById("rotate-seed").addEventListener("click", async () => {
      const s = STATE.get();
      s.clientSeed = document.getElementById("client-seed").value.trim() || s.clientSeed;
      await STATE.rotateSeeds();
      paintFair();
      FX.toast("Seeds rotated", "ok");
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("Reset all local progress?")) {
        STATE.reset();
        closeSheets();
        paintHud();
      }
    });

    STATE.on(paintTickets);
    paintTickets();
    setInterval(() => {
      paintHud();
      paintTickets();
    }, 500);
  }

  bind();
})();
