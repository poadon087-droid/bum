/* 5×5 Mines — combinatorial payout, cash out any time. */

const MINES = (() => {
  let mines = 2;
  let bet = 400;
  let board = [];
  let revealed = [];
  let dead = false;
  let cashed = false;
  let gems = 0;
  let live = false;
  const els = {};

  function bind() {
    els.grid = document.getElementById("mines-grid");
    els.mult = document.getElementById("mines-mult");
    els.next = document.getElementById("mines-next");
    els.cta = document.getElementById("mines-cta");
    els.bet = document.getElementById("mines-bet");
    els.mines = document.getElementById("mines-count");
    buildIdle();
  }

  function buildIdle() {
    els.grid.innerHTML = "";
    for (let i = 0; i < 25; i++) {
      const t = document.createElement("button");
      t.className = "mine-tile";
      t.type = "button";
      t.dataset.i = String(i);
      const face = document.createElement("img");
      face.className = "mine-face";
      face.src = "assets/games/mines/tile.png";
      face.alt = "";
      t.appendChild(face);
      t.addEventListener("click", () => pick(i));
      els.grid.appendChild(t);
    }
    paintHud();
  }

  async function start() {
    if (live) return;
    bet = Math.max(10, Math.round(+els.bet.value || bet));
    mines = Math.max(1, Math.min(24, +els.mines.value || mines));
    els.bet.value = bet;
    els.mines.value = mines;
    const portal = STATE.consumePortal("mines");
    if (portal) {
      bet = portal;
      els.bet.value = bet;
      document.querySelector("#sheet-mines .portal-banner")?.classList.add("hidden");
      FX.toast("FREE Mines — " + bet.toLocaleString() + " potatoes on the board", "ok");
    } else {
      const free = STATE.useTicket("mines");
      if (!free && !STATE.spendCoins(bet)) {
        FX.toast("Need potatoes or a Mines ticket", "bad");
        return;
      }
    }
    const { stream } = await STATE.nextStream();
    const idx = [...Array(25).keys()];
    for (let i = 24; i > 0; i--) {
      const j = await stream.int(i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    board = Array(25).fill("gem");
    for (let k = 0; k < mines; k++) board[idx[k]] = "mine";
    revealed = Array(25).fill(false);
    dead = false;
    cashed = false;
    gems = 0;
    live = true;
    [...els.grid.children].forEach((t) => {
      t.className = "mine-tile";
      t.disabled = false;
      const img = t.querySelector("img");
      if (img) img.src = "assets/games/mines/tile.png";
    });
    paintHud();
    AUDIO.click();
  }

  function pick(i) {
    if (!live || dead || cashed || revealed[i]) return;
    revealed[i] = true;
    const tile = els.grid.children[i];
    if (board[i] === "mine") {
      tile.classList.add("boom");
      const img = tile.querySelector("img");
      if (img) img.src = "assets/games/mines/bomb.png";
      dead = true;
      live = false;
      revealAll();
      AUDIO.crashBoom();
      FX.shake(document.getElementById("sheet-mines"));
      FX.toast("Mine! Bet lost", "bad");
      paintHud();
      return;
    }
    gems++;
    tile.classList.add("gem");
    const img = tile.querySelector("img");
    if (img) img.src = "assets/games/mines/gem.png";
    AUDIO.pop();
    paintHud();
    if (gems >= 25 - mines) cash();
  }

  function cash() {
    if (!live || dead || cashed || gems <= 0) return;
    const m = MATH.minesMultiplier(mines, gems);
    const win = Math.round(bet * m);
    cashed = true;
    live = false;
    STATE.addCoins(win);
    STATE.bump("minesCash");
    revealAll();
    AUDIO.cash();
    FX.toast(`Cashed ${m.toFixed(2)}×  +${win}`, "win");
    if (m >= 2) FX.sparkle();
    if (m >= 5) {
      FX.confetti(22);
      FX.rays();
    }
    paintHud();
  }

  function revealAll() {
    for (let i = 0; i < 25; i++) {
      const t = els.grid.children[i];
      const img = t.querySelector("img");
      if (board[i] === "mine") {
        t.classList.add("mine");
        if (img) img.src = "assets/games/mines/bomb.png";
      } else if (revealed[i]) {
        if (img) img.src = "assets/games/mines/gem.png";
      } else t.classList.add("safe-dim");
    }
  }

  function paintHud() {
    const m = gems > 0 ? MATH.minesMultiplier(mines, gems) : 1;
    const nxt = MATH.minesMultiplier(mines, gems + 1);
    if (els.mult) els.mult.textContent = m.toFixed(2) + "×";
    if (els.next) els.next.textContent = live ? `Next ${nxt.toFixed(2)}×` : "Pick mines & bet";
    if (els.cta) {
      els.cta.textContent = live ? (gems ? `CASH OUT  ${Math.round(bet * m)}` : "Pick a tile") : "PLAY";
      els.cta.className = "cta" + (live && gems ? " cash" : "");
      els.cta.disabled = live && gems === 0;
    }
  }

  function open() {
    if (els.bet) els.bet.value = bet;
    if (els.mines) els.mines.value = mines;
    if (!live) buildIdle();
    paintHud();
    const stake = STATE.peekPortal("mines");
    if (stake && !live) {
      if (els.bet) els.bet.value = stake;
      setTimeout(() => start(), 420);
    }
  }

  return { bind, start, cash, open, isLive: () => live };
})();
