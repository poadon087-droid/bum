/* Plinko — wide pyramid, every bucket reachable, bigger rows. */

const PLINKO = (() => {
  let rows = 14;
  let risk = "low";
  let bet = 250;
  let balls = [];
  let pegs = [];
  let raf = 0;
  const els = {};
  const IMG = {};
  const BUCKETS = [
    "assets/games/plinko/bucket_pink.png",
    "assets/games/plinko/bucket_gold.png",
    "assets/games/plinko/bucket_cyan.png",
    "assets/games/plinko/bucket_green.png",
    "assets/games/plinko/bucket_orange.png",
    "assets/games/plinko/bucket_purple.png",
  ];

  function load(src) {
    const i = new Image();
    i.src = src;
    return i;
  }

  function bind() {
    IMG.ball = load("assets/games/plinko/ball.png");
    IMG.peg = load("assets/games/plinko/peg.png");
    els.canvas = document.getElementById("plinko-canvas");
    els.mults = document.getElementById("plinko-mults");
    els.rows = document.getElementById("plinko-rows");
    els.risk = document.getElementById("plinko-risk");
    els.bet = document.getElementById("plinko-bet");
    layout();
    paintBuckets();
    loop();
  }

  function layout() {
    pegs = [];
    const c = els.canvas;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const pad = 14;
    const top = 22;
    const bot = 28;
    const gapY = (h - top - bot) / rows;
    const gapX = (w - pad * 2) / rows;
    const xMid = w / 2;
    for (let r = 0; r < rows; r++) {
      const n = r + 1;
      const rowW = (n - 1) * gapX;
      const x0 = xMid - rowW / 2;
      for (let i = 0; i < n; i++) {
        pegs.push({ x: x0 + i * gapX, y: top + r * gapY, r, i });
      }
    }
    c._gapX = gapX;
    c._gapY = gapY;
    c._top = top;
    c._pad = pad;
    c._xMid = xMid;
  }

  function slotX(step, rights, w) {
    const gapX = els.canvas._gapX;
    const n = step + 1;
    const rowW = (n - 1) * gapX;
    return w / 2 - rowW / 2 + rights * gapX;
  }

  function paintBuckets() {
    const { mults } = MATH.plinkoTables(rows, risk);
    els.mults.innerHTML = mults
      .map((m, i) => {
        const src = BUCKETS[i % BUCKETS.length];
        return `<span class="pkb" data-i="${i}"><img src="${src}" alt="" /><em>${trim(m)}×</em></span>`;
      })
      .join("");
  }

  function trim(m) {
    return m >= 100 ? String(Math.round(m)) : m % 1 === 0 ? String(m) : m.toFixed(1);
  }

  async function drop() {
    bet = Math.max(5, Math.round(+els.bet.value || bet));
    els.bet.value = bet;
    const portal = STATE.consumePortal("plinko");
    let stake = bet;
    if (portal) {
      stake = portal;
      if (els.bet) els.bet.value = stake;
      document.querySelector("#sheet-plinko .portal-banner")?.classList.add("hidden");
      FX.toast("FREE Plinko — " + stake.toLocaleString() + " potatoes on the ball", "ok");
    } else {
      const free = STATE.useTicket("plinko");
      if (!free && !STATE.spendCoins(bet)) {
        FX.toast("Need potatoes or a Plinko ticket", "bad");
        return;
      }
    }
    const { stream } = await STATE.nextStream();
    const bits = [];
    for (let i = 0; i < rows; i++) bits.push((await stream.int(2)) === 1 ? 1 : 0);
    const { bucket } = MATH.plinkoPath(rows, bits);
    const { mults } = MATH.plinkoTables(rows, risk);
    const mult = mults[bucket];
    const win = Math.round(stake * mult);
    const w = els.canvas.clientWidth;
    balls.push({
      x: w / 2,
      y: 8,
      bits,
      bucket,
      mult,
      win,
      done: false,
      step: 0,
      t: 0,
    });
    STATE.bump("plinko");
    AUDIO.drop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const c = els.canvas;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
      layout();
    }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const gapY = c._gapY || 22;
    const top = c._top || 22;
    const pegS = Math.max(12, Math.min(20, (c._gapX || 18) * 0.55));

    for (const p of pegs) {
      if (IMG.peg.complete && IMG.peg.naturalWidth) {
        g.drawImage(IMG.peg, p.x - pegS / 2, p.y - pegS / 2, pegS, pegS);
      } else {
        g.beginPath();
        g.arc(p.x, p.y, pegS / 2.4, 0, Math.PI * 2);
        g.fillStyle = "#ffd23a";
        g.fill();
      }
    }

    const ballR = Math.max(11, pegS * 0.72);
    balls.forEach((b) => {
      if (!b.done) {
        b.t += 1;
        const speed = 0.085 + Math.min(0.04, b.step * 0.003);
        b.step = Math.min(rows, b.step + speed);
        const row = Math.min(rows - 1, Math.floor(b.step));
        const frac = b.step - row;
        const rightsNow = b.bits.slice(0, row).reduce((s, x) => s + x, 0);
        const rightsNext = rightsNow + (b.bits[row] || 0);
        const x0 = slotX(row, rightsNow, w);
        const x1 = row + 1 >= rows ? slotX(rows, b.bucket, w) : slotX(row + 1, rightsNext, w);
        const y0 = top + row * gapY;
        const y1 = row + 1 >= rows ? h - 16 : top + (row + 1) * gapY;
        const ease = frac * frac * (3 - 2 * frac);
        b.x = x0 + (x1 - x0) * ease;
        b.y = y0 + (y1 - y0) * ease;
        if (b.t % 8 === 0) AUDIO.peg();
        if (b.step >= rows) {
          b.done = true;
          b.x = slotX(rows, b.bucket, w);
          b.y = h - 16;
          settle(b);
        }
      }
      if (IMG.ball.complete && IMG.ball.naturalWidth) {
        g.drawImage(IMG.ball, b.x - ballR, b.y - ballR, ballR * 2, ballR * 2);
      } else {
        g.beginPath();
        g.arc(b.x, b.y, ballR, 0, Math.PI * 2);
        g.fillStyle = "#3ecfff";
        g.fill();
      }
    });
    balls = balls.filter((b) => !b.done || b.hold-- > 0);
  }

  function settle(b) {
    b.hold = 44;
    STATE.addCoins(b.win);
    const span = els.mults?.querySelector(`[data-i="${b.bucket}"]`);
    span?.classList.add("hit");
    setTimeout(() => span?.classList.remove("hit"), 700);
    if (b.mult >= 1) {
      AUDIO.win(b.mult >= 10 ? 3 : 1);
      FX.toast(`${trim(b.mult)}×   +${b.win}`, b.mult >= 2 ? "win" : "ok");
      if (b.mult >= 3) FX.sparkle();
      if (b.mult >= 8) {
        FX.confetti(24);
        FX.rays();
      }
    } else AUDIO.lose();
  }

  function setRows(n) {
    rows = +n;
    layout();
    paintBuckets();
  }
  function setRisk(r) {
    risk = r;
    paintBuckets();
  }
  function open() {
    if (els.bet) els.bet.value = bet;
    if (els.rows) els.rows.value = String(rows);
    if (els.risk) els.risk.value = risk;
    layout();
    paintBuckets();
    const stake = STATE.peekPortal("plinko");
    if (stake) {
      if (els.bet) els.bet.value = stake;
      setTimeout(() => drop(), 420);
    }
  }

  return { bind, drop, setRows, setRisk, open };
})();
