(() => {
  "use strict";

  const W = 480;
  const H = 800;
  const TAU = Math.PI * 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");

  const $ = (id) => document.getElementById(id);
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");

  const ASSETS = {
    bg: "assets/bg/sky.jpg",
    potato: "assets/sprites/potato_sheet.png",
    blue: "assets/sprites/bird_blue_sheet.png",
    red: "assets/sprites/bird_red_sheet.png",
    gold: "assets/sprites/bird_gold_sheet.png",
    crow: "assets/sprites/bird_crow_sheet.png",
    chicken: "assets/sprites/bird_chicken_sheet.png",
    potatoTug: "assets/sprites/potato_tug_sheet.png",
    rivalTug: "assets/sprites/rival_tug_sheet.png",
    rivalIdle: "assets/sprites/rival_idle.png",
    flag: "assets/ui/tug_flag.png",
    cloud: "assets/sprites/cloud.png",
    heart: "assets/ui/heart.png",
    heartEmpty: "assets/ui/heart_empty.png",
    star: "assets/ui/star.png",
    lassoUi: "assets/ui/lasso.png",
  };

  const img = {};
  const POTATO = { w: 280, h: 420, frames: ["idle", "blink", "windup", "celebrate", "sad"] };
  const BIRD = { w: 168, h: 148, n: 4 };

  const TUG = { w: 340, h: 420, n: 2 };
  const TYPES = {
    blue: { sheet: "blue", pts: 10, speed: 78, r: 28, color: "#4aa7e8", word: ["GOTCHA", "NICE", "SASSY"] },
    red: { sheet: "red", pts: 25, speed: 128, r: 28, color: "#e23b4a", word: ["ZIPPY", "YEET", "HOT"] },
    gold: { sheet: "gold", pts: 50, speed: 96, r: 30, color: "#ffd23a", word: ["JACKPOT", "GOLD", "RICH"], tug: true, tugMul: 3 },
    chicken: { sheet: "chicken", pts: 30, speed: 88, r: 32, color: "#f0c27a", word: ["CLUCK", "WINGS", "DINNER"], tug: true, tugMul: 2 },
    crow: { sheet: "crow", pts: 0, speed: 110, r: 30, color: "#5a3a78", word: ["EW", "NOPE", "BITTER"], bad: true },
  };

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  const Sfx = {
    ctx: null,
    muted: localStorage.getItem("spudMute") === "1",
    musicOn: false,
    musicNodes: [],
    unlock() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    tone(freq, dur, type = "square", vol = 0.08, slide = 0, delay = 0) {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.06) {
      if (this.muted || !this.ctx) return;
      const n = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1200;
      src.buffer = buf;
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.ctx.destination);
      src.start();
    },
    throw() {
      this.noise(0.12, 0.05);
      this.tone(280, 0.16, "sawtooth", 0.05, 420);
    },
    catch() {
      this.tone(520, 0.08, "square", 0.07);
      this.tone(780, 0.12, "square", 0.06, 0, 0.07);
    },
    gold() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.06, 0, i * 0.07));
    },
    miss() {
      this.tone(180, 0.18, "triangle", 0.06, -80);
    },
    hurt() {
      this.tone(140, 0.22, "sawtooth", 0.07, -70);
      this.noise(0.18, 0.05);
    },
    combo() {
      this.tone(660, 0.08, "square", 0.05);
      this.tone(880, 0.1, "square", 0.05, 0, 0.08);
    },
    wave() {
      this.tone(392, 0.1, "triangle", 0.06);
      this.tone(523, 0.14, "triangle", 0.06, 0, 0.1);
    },
    over() {
      this.tone(330, 0.2, "triangle", 0.06, -40);
      this.tone(247, 0.3, "triangle", 0.06, -30, 0.18);
    },
    click() {
      this.tone(700, 0.05, "square", 0.04);
    },
    startMusic() {
      if (!this.ctx || this.musicOn || this.muted) return;
      this.musicOn = true;
      this._pulseMusic();
    },
    _pulseMusic() {
      if (!this.musicOn || this.muted || !this.ctx) return;
      const notes = [262, 330, 392, 330, 294, 349, 440, 349];
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.018, t0 + i * 0.28);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.26);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t0 + i * 0.28);
        o.stop(t0 + i * 0.28 + 0.28);
      });
      this._musicTimer = setTimeout(() => this._pulseMusic(), 2300);
    },
    stopMusic() {
      this.musicOn = false;
      clearTimeout(this._musicTimer);
    },
  };

  function setMute(m) {
    Sfx.muted = m;
    localStorage.setItem("spudMute", m ? "1" : "0");
    $("muteImg").src = m ? "assets/ui/sound_off.png" : "assets/ui/sound_on.png";
    if (m) Sfx.stopMusic();
    else if (state.mode === "play") Sfx.startMusic();
  }

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(src));
      i.src = src;
    });
  }

  async function loadAll() {
    const keys = Object.keys(ASSETS);
    let n = 0;
    for (const k of keys) {
      img[k] = await loadImage(ASSETS[k]);
      n++;
      $("loadBar").style.width = (n / keys.length) * 100 + "%";
      $("loadTxt").textContent = "Loading " + k + "…";
    }
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const state = {
    mode: "title", // title | play | pause | over
    t: 0,
    score: 0,
    lives: 3,
    wave: 1,
    combo: 0,
    bestCombo: 0,
    caught: 0,
    spawnT: 0,
    spawnedThisWave: 0,
    waveQuota: 8,
    waveClearing: 0,
    superT: 0,
    shake: 0,
    hintT: 4.5,
    firstCatch: false,
    keys: {},
    pointer: { x: W / 2, y: 200, down: false, dragging: false },
    birds: [],
    pops: [],
    parts: [],
    clouds: [],
    lasso: null,
    potato: null,
    sinceSpecial: 0,
    specialCool: 0,
    scoreMul: 1,
    scoreMulT: 0,
    pendingTug: null,
    tug: null,
  };

  function bestScore() {
    return Number(localStorage.getItem("spudBest") || 0);
  }
  function saveBest(s) {
    if (s > bestScore()) localStorage.setItem("spudBest", String(s));
  }

  // ---------------------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------------------
  function makePotato() {
    return {
      x: W / 2,
      y: H - 18,
      vx: 0,
      face: 1,
      pose: 0, // sheet frame
      poseT: 0,
      blinkT: 2.4 + Math.random() * 2,
      bob: 0,
      dustT: 0,
    };
  }

  function potatoHand(p) {
    const ph = 250;
    if (p.pose === 2) return { x: p.x + p.face * 38, y: p.y - ph * 0.72 };
    if (p.pose === 3) return { x: p.x + p.face * 18, y: p.y - ph * 0.88 };
    return { x: p.x + p.face * 22, y: p.y - ph * 0.58 };
  }

  function canSpawnSpecial() {
    if (state.specialCool > 0) return false;
    if (state.pendingTug || state.tug) return false;
    if (state.birds.some((b) => TYPES[b.type] && TYPES[b.type].tug)) return false;
    if (state.wave === 1 && state.spawnedThisWave < 3) return false;
    return true;
  }

  function spawnBird(forced) {
    const wave = state.wave;
    let type = "blue";
    const r = Math.random();
    if (forced) {
      type = forced;
    } else {
      let special = false;
      if (canSpawnSpecial()) {
        state.sinceSpecial++;
        if (state.sinceSpecial >= 9 || Math.random() < 0.13) {
          type = Math.random() < 0.5 ? "gold" : "chicken";
          state.sinceSpecial = 0;
          special = true;
        }
      }
      if (!special) {
        if (wave >= 3 && r < 0.14 + Math.min(0.1, wave * 0.01)) type = "crow";
        else if (wave >= 2 && r < 0.40) type = "red";
        else type = "blue";
      }
    }

    const def = TYPES[type];
    const fromLeft = Math.random() < 0.5;
    const speed = (def.speed + wave * 7 + Math.random() * 18) * (fromLeft ? 1 : -1);
    const yMin = 92;
    const yMax = H * 0.50;
    state.birds.push({
      type,
      x: fromLeft ? -50 : W + 50,
      y: yMin + Math.random() * (yMax - yMin),
      vx: speed,
      baseY: 0,
      amp: type === "gold" ? 28 + Math.random() * 18 : type === "chicken" ? 18 + Math.random() * 12 : 8 + Math.random() * 10,
      freq: type === "gold" ? 2.6 : type === "chicken" ? 1.9 : 1.4 + Math.random(),
      phase: Math.random() * TAU,
      frame: 0,
      ft: 0,
      caught: false,
      gone: false,
      spin: 0,
    });
    state.birds[state.birds.length - 1].baseY = state.birds[state.birds.length - 1].y;
    state.spawnedThisWave++;
  }

  function throwLasso(tx, ty) {
    const p = state.potato;
    if (state.lasso || state.mode !== "play") return;
    const hand = potatoHand(p);
    const dx = tx - hand.x;
    const dy = ty - hand.y;
    const ang = Math.atan2(dy, dx);
    p.face = dx >= 0 ? 1 : -1;
    p.pose = 2;
    p.poseT = 0.55;
    Sfx.throw();
    state.lasso = {
      x0: hand.x,
      y0: hand.y,
      ang,
      dist: 0,
      max: 640,
      phase: "extend",
      loopR: state.superT > 0 ? 46 : 28,
      caught: null,
      gold: state.superT > 0,
    };
  }

  function catchBird(b, lasso) {
    b.caught = true;
    lasso.caught = b;
    lasso.phase = "reel";
    if (TYPES[b.type].bad) {
      Sfx.hurt();
      hurt(1);
      pop(b.x, b.y, pick(TYPES[b.type].word), "#b84cff");
      burst(b.x, b.y, "#5a3a78", 16);
      state.combo = 0;
      updateComboHud();
    } else {
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const comboMul = 1 + Math.floor((state.combo - 1) / 2);
      state.caught++;
      state.firstCatch = true;
      burst(b.x, b.y, TYPES[b.type].color, 14);
      stars(b.x, b.y, TYPES[b.type].tug ? 8 : 3);
      pCelebrate();
      updateComboHud();
      if (TYPES[b.type].tug) {
        Sfx.gold();
        pop(b.x, b.y, pick(TYPES[b.type].word), TYPES[b.type].color);
        state.pendingTug = {
          kind: b.type,
          pts: TYPES[b.type].pts * comboMul,
          mul: TYPES[b.type].tugMul,
        };
      } else {
        Sfx.catch();
        if (state.combo >= 2) Sfx.combo();
        const pts = Math.round(TYPES[b.type].pts * comboMul * state.scoreMul);
        state.score += pts;
        pop(b.x, b.y, "+" + pts, TYPES[b.type].color);
        if (state.combo >= 2) pop(b.x, b.y - 28, "x" + state.combo, "#ff7a18");
        $("scoreEl").textContent = state.score;
      }
    }
  }

  function pCelebrate() {
    state.potato.pose = 3;
    state.potato.poseT = 0.55;
  }

  function hurt(n) {
    state.lives = Math.max(0, state.lives - n);
    state.shake = 10;
    state.potato.pose = 4;
    state.potato.poseT = 0.7;
    renderHearts();
    if (navigator.vibrate) navigator.vibrate(40);
    if (state.lives <= 0) gameOver();
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function pop(x, y, text, color) {
    state.pops.push({ x, y, text, color, t: 0, life: 0.85 });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 40 + Math.random() * 160;
      state.parts.push({
        kind: "feather",
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        t: 0,
        life: 0.55 + Math.random() * 0.4,
        color,
        rot: Math.random() * TAU,
        rv: (Math.random() - 0.5) * 10,
        s: 6 + Math.random() * 7,
      });
    }
  }

  function stars(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 30 + Math.random() * 90;
      state.parts.push({
        kind: "star",
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 50,
        t: 0,
        life: 0.6 + Math.random() * 0.3,
        rot: Math.random() * TAU,
        rv: (Math.random() - 0.5) * 8,
        s: 10 + Math.random() * 10,
      });
    }
  }

  function dust(x, y) {
    state.parts.push({
      kind: "dust",
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: (Math.random() - 0.5) * 30,
      vy: -20 - Math.random() * 20,
      t: 0,
      life: 0.35,
      s: 8 + Math.random() * 8,
    });
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (state.mode === "play") update(dt);
    else if (state.mode === "tug") updateTug(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    state.t += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 28);
    if (state.superT > 0) state.superT = Math.max(0, state.superT - dt);
    if (state.specialCool > 0) state.specialCool = Math.max(0, state.specialCool - dt);
    if (state.scoreMulT > 0) {
      state.scoreMulT = Math.max(0, state.scoreMulT - dt);
      if (state.scoreMulT <= 0) {
        state.scoreMul = 1;
        updateMulHud();
      }
    }
    if (state.hintT > 0 && !state.firstCatch) state.hintT -= dt;
    if (state.waveClearing > 0) {
      state.waveClearing -= dt;
      if (state.waveClearing <= 0) hide($("waveBanner"));
    }

    updatePotato(dt);
    updateLasso(dt);
    updateBirds(dt);
    updateFx(dt);
    updateWaves(dt);
  }

  function updatePotato(dt) {
    const p = state.potato;
    let ax = 0;
    if (state.keys["ArrowLeft"] || state.keys["a"] || state.keys["A"]) ax -= 1;
    if (state.keys["ArrowRight"] || state.keys["d"] || state.keys["D"]) ax += 1;
    const spd = 260;
    p.vx = ax * spd;
    p.x += p.vx * dt;
    p.x = Math.max(48, Math.min(W - 48, p.x));
    if (ax) {
      p.face = ax > 0 ? 1 : -1;
      p.dustT -= dt;
      if (p.dustT <= 0) {
        dust(p.x, p.y - 8);
        p.dustT = 0.08;
      }
    }
    if (!state.lasso && state.pointer.x) {
      // glance toward aim if not throwing
      if (!ax) p.face = state.pointer.x >= p.x ? 1 : -1;
    }

    p.bob = Math.sin(state.t * 3.2) * 4;
    p.blinkT -= dt;
    if (p.poseT > 0) {
      p.poseT -= dt;
      if (p.poseT <= 0 && !state.lasso) p.pose = 0;
    } else if (!state.lasso) {
      if (p.blinkT <= 0) {
        p.pose = 1;
        p.poseT = 0.12;
        p.blinkT = 2.2 + Math.random() * 3;
      } else p.pose = 0;
    } else if (state.lasso.phase === "extend") {
      p.pose = 2;
    }

    // keep hand origin glued while lasso flies
    if (state.lasso) {
      const h = potatoHand(p);
      state.lasso.x0 = h.x;
      state.lasso.y0 = h.y;
    }
  }

  function updateLasso(dt) {
    const L = state.lasso;
    if (!L) return;
    if (L.phase === "extend") {
      L.dist += 1750 * dt;
      L.lx = L.x0 + Math.cos(L.ang) * L.dist;
      L.ly = L.y0 + Math.sin(L.ang) * L.dist;
      // hit test
      for (const b of state.birds) {
        if (b.caught || b.gone) continue;
        const dx = b.x - L.lx;
        const dy = b.y - L.ly;
        if (dx * dx + dy * dy < (L.loopR + TYPES[b.type].r) ** 2) {
          catchBird(b, L);
          L.lx = b.x;
          L.ly = b.y;
          L.dist = Math.hypot(L.lx - L.x0, L.ly - L.y0);
          break;
        }
      }
      if (L.phase === "extend" && (L.dist >= L.max || L.lx < -40 || L.lx > W + 40 || L.ly < -40 || L.ly > H + 10)) {
        L.phase = "retract";
      }
    } else if (L.phase === "reel" && L.caught) {
      L.dist = Math.max(0, L.dist - 1560 * dt);
      const b = L.caught;
      L.lx = L.x0 + Math.cos(L.ang) * L.dist;
      L.ly = L.y0 + Math.sin(L.ang) * L.dist;
      b.x = L.lx;
      b.y = L.ly;
      b.spin += 14 * dt;
      if (L.dist <= 36) {
        b.gone = true;
        state.lasso = null;
        if (state.pendingTug) {
          const job = state.pendingTug;
          state.pendingTug = null;
          startTug(job);
        }
      }
    } else if (L.phase === "retract") {
      L.dist = Math.max(0, L.dist - 2100 * dt);
      L.lx = L.x0 + Math.cos(L.ang) * L.dist;
      L.ly = L.y0 + Math.sin(L.ang) * L.dist;
      if (L.dist <= 8) {
        if (!L.caught) {
          Sfx.miss();
          state.combo = 0;
          updateComboHud();
          state.potato.pose = 4;
          state.potato.poseT = 0.45;
          pop(state.potato.x, state.potato.y - 220, pick(["AIRBALL", "DANG", "MISS"]), "#888");
        }
        state.lasso = null;
      }
    }
  }

  function updateBirds(dt) {
    for (const b of state.birds) {
      if (b.gone || b.caught) continue;
      b.x += b.vx * dt;
      b.phase += dt * b.freq;
      b.y = b.baseY + Math.sin(b.phase) * b.amp;
      b.ft += dt;
      if (b.ft > 0.09) {
        b.ft = 0;
        b.frame = (b.frame + 1) % BIRD.n;
      }
      const off = b.vx > 0 ? b.x > W + 60 : b.x < -60;
      if (off) {
        b.gone = true;
        if (!TYPES[b.type].bad) {
          hurt(1);
          pop(b.vx > 0 ? W - 40 : 40, b.y, "ESCAPED", "#e23b4a");
        }
      }
    }
    state.birds = state.birds.filter((b) => !b.gone);
  }

  function updateFx(dt) {
    for (const p of state.pops) {
      p.t += dt;
      p.y -= 38 * dt;
    }
    state.pops = state.pops.filter((p) => p.t < p.life);
    for (const p of state.parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.rot += p.rv * dt;
    }
    state.parts = state.parts.filter((p) => p.t < p.life);
    for (const c of state.clouds) {
      c.x += c.vx * dt;
      if (c.x > W + 80) c.x = -80;
    }
  }

  function updateWaves(dt) {
    const maxOn = Math.min(10, 4 + Math.floor(state.wave / 2));
    const interval = Math.max(0.42, 1.32 - state.wave * 0.07);
    if (state.spawnedThisWave < state.waveQuota && state.birds.filter((b) => !b.caught).length < maxOn) {
      state.spawnT -= dt;
      if (state.spawnT <= 0) {
        spawnBird();
        state.spawnT = interval * (0.7 + Math.random() * 0.5);
      }
    }
    if (state.spawnedThisWave >= state.waveQuota && state.birds.length === 0 && !state.lasso && state.lives > 0) {
      state.wave++;
      state.spawnedThisWave = 0;
      state.waveQuota = 8 + state.wave * 2;
      state.spawnT = 0.8;
      state.score += 40 * (state.wave - 1);
      $("scoreEl").textContent = state.score;
      $("waveEl").textContent = state.wave;
      $("waveBanner").textContent = "WAVE " + state.wave;
      show($("waveBanner"));
      state.waveClearing = 1.4;
      Sfx.wave();
      pop(W / 2, 260, "WAVE BONUS", "#ffd23a");
    }
  }

  function startTug(job) {
    state.mode = "tug";
    state.tug = {
      kind: job.kind,
      pts: job.pts,
      mul: job.mul,
      progress: 0.5,
      t: 0,
      dur: 6.5,
      result: null,
      resultT: 0,
      pFlash: 0,
      rFlash: 0,
      mashLock: 0,
    };
    hide($("hint"));
    hide($("comboEl"));
    $("tugPrize").textContent = "WIN FOR  x" + job.mul + "  MULTIPLIER";
    $("tugSub").textContent = job.kind === "gold" ? "GOLD BIRD CHALLENGE" : "CHICKEN CHALLENGE";
    hide($("tugResult"));
    show($("tugHint"));
    show($("tugHud"));
    Sfx.wave();
    pop(W / 2, 240, "TUG!", "#ffd23a");
  }

  function mashTug() {
    const T = state.tug;
    if (!T || T.result) return;
    if (T.mashLock > 0) return;
    T.mashLock = 0.05;
    T.progress = Math.max(0.05, T.progress - 0.078);
    T.pFlash = 0.16;
    Sfx.tone(220 + Math.random() * 80, 0.05, "square", 0.045);
    if (T.progress <= 0.12) finishTug(true);
  }

  function updateTug(dt) {
    const T = state.tug;
    if (!T) return;
    T.t += dt;
    if (T.pFlash > 0) T.pFlash -= dt;
    if (T.rFlash > 0) T.rFlash -= dt;
    if (T.mashLock > 0) T.mashLock -= dt;

    if (T.result) {
      T.resultT -= dt;
      if (T.resultT <= 0) closeTug();
      return;
    }

    const ai = (0.19 + state.wave * 0.026) * dt;
    T.progress = Math.min(0.95, T.progress + ai);
    if (Math.random() < dt * 8) T.rFlash = 0.12;

    if (T.progress >= 0.88) finishTug(false);
    else if (T.t >= T.dur) finishTug(T.progress < 0.5);
  }

  function finishTug(win) {
    const T = state.tug;
    if (!T || T.result) return;
    T.result = win ? "win" : "lose";
    T.resultT = 1.55;
    hide($("tugHint"));
    const el = $("tugResult");
    if (win) {
      const gained = Math.round(T.pts * T.mul);
      state.score += gained;
      state.scoreMul = T.mul;
      state.scoreMulT = T.kind === "gold" ? 10 : 8;
      if (T.kind === "gold" && state.lives < 3 && Math.random() < 0.28) {
        state.lives++;
        renderHearts();
      }
      $("scoreEl").textContent = state.score;
      updateMulHud();
      el.textContent = "YOU WIN  x" + T.mul;
      Sfx.gold();
      pCelebrate();
      stars(W / 2, H * 0.45, 14);
    } else {
      const gained = T.pts;
      state.score += gained;
      $("scoreEl").textContent = state.score;
      el.textContent = "SPROUT WINS";
      Sfx.miss();
      state.potato.pose = 4;
      state.potato.poseT = 0.8;
    }
    show(el);
  }

  function closeTug() {
    hide($("tugHud"));
    hide($("tugResult"));
    state.tug = null;
    state.specialCool = 9;
    if (state.lives <= 0) {
      gameOver();
      return;
    }
    state.mode = "play";
    updateComboHud();
  }

  function updateMulHud() {
    const el = $("mulEl");
    if (state.scoreMul > 1 && state.scoreMulT > 0) {
      el.textContent = "x" + state.scoreMul;
      show(el);
    } else hide(el);
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    // background
    ctx.drawImage(img.bg, 0, 0, W, H);

    // drifting clouds on top of painted ones
    if (img.cloud) {
      for (const c of state.clouds) {
        ctx.globalAlpha = 0.92;
        ctx.drawImage(img.cloud, c.x, c.y, c.w, c.h);
        ctx.globalAlpha = 1;
      }
    }

    if (state.mode === "play" || state.mode === "pause" || state.mode === "over" || state.mode === "tug") {
      if (state.mode !== "tug") drawAim();
      drawBirds();
      drawLasso();
      if (state.mode !== "tug") drawPotato();
      drawFx();
      if (state.superT > 0 && state.mode === "play") drawSuper();
    }
    if (state.mode === "tug") drawTug();
  }

  function drawPotato() {
    const p = state.potato;
    if (!p) return;
    const dw = 188;
    const dh = 282;
    const dx = p.x - dw / 2;
    const dy = p.y - dh + p.bob;
    ctx.save();
    ctx.translate(p.x, p.y + p.bob);
    ctx.scale(p.face, 1);
    ctx.drawImage(
      img.potato,
      p.pose * POTATO.w, 0, POTATO.w, POTATO.h,
      -dw / 2, -dh, dw, dh
    );
    ctx.restore();
    // unused to keep lints quiet
    void dx;
    void dy;
  }

  function drawBirds() {
    for (const b of state.birds) {
      const def = TYPES[b.type];
      const sheet = img[def.sheet];
      const dw = def.tug ? 86 : 78;
      const dh = def.tug ? 76 : 68;
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.caught) ctx.rotate(b.spin);
      const flip = b.vx < 0 && !b.caught ? -1 : 1;
      ctx.scale(flip, 1);
      if (def.tug && !b.caught) {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 18 + Math.sin(state.t * 8) * 6;
      }
      ctx.drawImage(sheet, b.frame * BIRD.w, 0, BIRD.w, BIRD.h, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  function drawTug() {
    const T = state.tug;
    if (!T) return;
    ctx.save();
    ctx.fillStyle = "rgba(16,10,6,0.46)";
    ctx.fillRect(0, 0, W, H);

    // tug meter
    const mx = 46, my = 168, mw = W - 92, mh = 22;
    ctx.fillStyle = "#111";
    roundRect(ctx, mx - 3, my - 3, mw + 6, mh + 6, 12);
    ctx.fill();
    ctx.fillStyle = "#fff4d4";
    roundRect(ctx, mx, my, mw, mh, 10);
    ctx.fill();
    const split = mx + mw * (1 - T.progress);
    ctx.fillStyle = "#3ecf6e";
    roundRect(ctx, mx, my, Math.max(8, split - mx), mh, 10);
    ctx.fill();
    ctx.fillStyle = "#e23b4a";
    roundRect(ctx, split, my, Math.max(8, mx + mw - split), mh, 10);
    ctx.fill();

    const ropeY = H - 168;
    const leftX = 108;
    const rightX = W - 108;
    const flagX = leftX + (rightX - leftX) * T.progress;

    // rope
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(36, ropeY);
    ctx.lineTo(W - 36, ropeY);
    ctx.stroke();
    ctx.strokeStyle = "#c4893a";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(36, ropeY);
    ctx.lineTo(W - 36, ropeY);
    ctx.stroke();

    if (img.flag) {
      ctx.drawImage(img.flag, flagX - 22, ropeY - 78, 52, 90);
    }

    const pFrame = T.pFlash > 0 ? 1 : 0;
    const rFrame = T.rFlash > 0 ? 1 : 0;
    const pw = 200, ph = 248;
    const bobP = T.pFlash > 0 ? -6 : 0;
    const bobR = T.rFlash > 0 ? -6 : 0;
    ctx.drawImage(img.potatoTug, pFrame * TUG.w, 0, TUG.w, TUG.h, leftX - pw / 2 - 8, H - ph - 8 + bobP, pw, ph);
    ctx.drawImage(img.rivalTug, rFrame * TUG.w, 0, TUG.w, TUG.h, rightX - pw / 2 + 8, H - ph - 8 + bobR, pw, ph);

    // timer bar
    const tw = 160, th = 8;
    const tx = W / 2 - tw / 2, ty = 198;
    ctx.fillStyle = "#111";
    roundRect(ctx, tx - 2, ty - 2, tw + 4, th + 4, 6);
    ctx.fill();
    ctx.fillStyle = "#ffd23a";
    const left = Math.max(0, 1 - T.t / T.dur);
    roundRect(ctx, tx, ty, tw * left, th, 4);
    ctx.fill();
    ctx.restore();
  }

  function drawLasso() {
    const L = state.lasso;
    if (!L || L.lx == null) return;
    const sag = Math.min(46, L.dist * 0.12);
    const mx = (L.x0 + L.lx) / 2;
    const my = (L.y0 + L.ly) / 2 + sag;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // outline
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(L.x0, L.y0);
    ctx.quadraticCurveTo(mx, my, L.lx, L.ly);
    ctx.stroke();
    ctx.strokeStyle = L.gold ? "#ffd23a" : "#c4893a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(L.x0, L.y0);
    ctx.quadraticCurveTo(mx, my, L.lx, L.ly);
    ctx.stroke();
    // loop
    ctx.beginPath();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 8;
    ctx.ellipse(L.lx, L.ly, L.loopR, L.loopR * 0.72, L.ang, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = L.gold ? "#ffe98a" : "#e0a04a";
    ctx.lineWidth = 4.5;
    ctx.ellipse(L.lx, L.ly, L.loopR, L.loopR * 0.72, L.ang, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawAim() {
    if (state.lasso || state.mode !== "play") return;
    const p = state.potato;
    const h = potatoHand(p);
    const ang = Math.atan2(state.pointer.y - h.y, state.pointer.x - h.x);
    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,.35)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + Math.cos(ang) * 90, h.y + Math.sin(ang) * 90);
    ctx.stroke();
    ctx.restore();
  }

  function drawFx() {
    for (const p of state.parts) {
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.globalAlpha = a;
      if (p.kind === "star" && img.star) {
        ctx.drawImage(img.star, -p.s / 2, -p.s / 2, p.s, p.s);
      } else if (p.kind === "dust") {
        ctx.fillStyle = "rgba(180,130,60,.7)";
        ctx.beginPath();
        ctx.arc(0, 0, p.s * a, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color || "#fff";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.s * 0.35, p.s, 0.4, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of state.pops) {
      const k = Math.min(1, p.t / 0.12);
      ctx.save();
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.translate(p.x, p.y);
      ctx.scale(0.8 + k * 0.35, 0.8 + k * 0.35);
      ctx.font = '900 22px Nunito, sans-serif';
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#111";
      ctx.fillStyle = p.color;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawSuper() {
    ctx.save();
    ctx.font = '900 13px Nunito, sans-serif';
    ctx.fillStyle = "#111";
    const w = 120;
    const x = W / 2 - w / 2;
    const y = 64;
    ctx.fillStyle = "#111";
    roundRect(ctx, x - 2, y - 2, w + 4, 14, 7);
    ctx.fill();
    ctx.fillStyle = "#fff4d4";
    roundRect(ctx, x, y, w, 10, 5);
    ctx.fill();
    ctx.fillStyle = "#ffd23a";
    roundRect(ctx, x, y, w * (state.superT / 8), 10, 5);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------------------------------------------------------------------------
  // HUD / scenes
  // ---------------------------------------------------------------------------
  function renderHearts() {
    const box = $("hearts");
    box.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const im = document.createElement("img");
      im.src = i < state.lives ? ASSETS.heart : ASSETS.heartEmpty;
      im.alt = "";
      box.appendChild(im);
    }
  }

  function updateComboHud() {
    const el = $("comboEl");
    if (state.combo >= 2) {
      el.textContent = "COMBO x" + state.combo;
      show(el);
    } else hide(el);
  }

  function goTitle() {
    state.mode = "title";
    hide($("hud"));
    hide($("pause"));
    hide($("over"));
    hide($("howto"));
    hide($("tugHud"));
    show($("title"));
    $("bestScore").textContent = bestScore();
    Sfx.stopMusic();
    startTitleBlink();
  }

  let titleBlink;
  function startTitleBlink() {
    clearInterval(titleBlink);
    const el = $("titleSpud");
    titleBlink = setInterval(() => {
      el.src = "assets/sprites/potato_blink.png";
      setTimeout(() => {
        el.src = "assets/sprites/potato_idle.png";
      }, 140);
    }, 2800);
  }

  function startGame() {
    clearInterval(titleBlink);
    hide($("title"));
    hide($("howto"));
    hide($("pause"));
    hide($("over"));
    show($("hud"));
    state.mode = "play";
    state.t = 0;
    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.combo = 0;
    state.bestCombo = 0;
    state.caught = 0;
    state.spawnT = 0.6;
    state.spawnedThisWave = 0;
    state.waveQuota = 8;
    state.waveClearing = 0;
    state.superT = 0;
    state.shake = 0;
    state.hintT = 4.5;
    state.firstCatch = false;
    state.birds = [];
    state.pops = [];
    state.parts = [];
    state.lasso = null;
    state.sinceSpecial = 0;
    state.specialCool = 0;
    state.scoreMul = 1;
    state.scoreMulT = 0;
    state.pendingTug = null;
    state.tug = null;
    hide($("tugHud"));
    updateMulHud();
    state.potato = makePotato();
    state.clouds = [
      { x: 40, y: 70, w: 130, h: 70, vx: 8 },
      { x: 280, y: 130, w: 100, h: 54, vx: 12 },
      { x: 160, y: 30, w: 160, h: 80, vx: 6 },
    ];
    $("scoreEl").textContent = "0";
    $("waveEl").textContent = "1";
    renderHearts();
    updateComboHud();
    show($("hint"));
    setTimeout(() => hide($("hint")), 4200);
    Sfx.unlock();
    Sfx.startMusic();
  }

  function gameOver() {
    if (state.mode === "over") return;
    state.mode = "over";
    Sfx.over();
    Sfx.stopMusic();
    const prev = bestScore();
    saveBest(state.score);
    $("overScore").textContent = state.score;
    $("overBest").textContent = bestScore();
    $("overCaught").textContent = state.caught;
    $("overCombo").textContent = state.bestCombo;
    $("over").querySelector(".over-spud").src =
      state.score > prev && state.score > 0
        ? "assets/sprites/potato_celebrate.png"
        : "assets/sprites/potato_sad.png";
    if (state.score > prev && state.score > 0) show($("newBest"));
    else hide($("newBest"));
    hide($("hud"));
    show($("over"));
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function gamePos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: ((src.clientX - r.left) / r.width) * W,
      y: ((src.clientY - r.top) / r.height) * H,
    };
  }

  let dragPotato = false;
  let dragMoved = false;
  let downPos = null;

  function onDown(e) {
    if (state.mode === "tug") {
      Sfx.unlock();
      mashTug();
      e.preventDefault();
      return;
    }
    if (state.mode !== "play") return;
    Sfx.unlock();
    const p = gamePos(e);
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    state.pointer.down = true;
    downPos = p;
    dragMoved = false;
    const pot = state.potato;
    dragPotato = p.y > H * 0.68 && Math.abs(p.x - pot.x) < 90;
    e.preventDefault();
  }
  function onMove(e) {
    const p = gamePos(e);
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    if (state.mode === "play" && state.pointer.down && dragPotato) {
      state.potato.x = Math.max(48, Math.min(W - 48, p.x));
      if (downPos && Math.abs(p.x - downPos.x) > 8) dragMoved = true;
    }
    e.preventDefault();
  }
  function onUp(e) {
    if (state.mode === "tug") {
      e.preventDefault();
      return;
    }
    if (state.mode === "play" && state.pointer.down && !dragMoved) {
      const p = downPos || state.pointer;
      // don't throw if tapping HUD-ish top strip icons
      if (p.y > 56) throwLasso(p.x, p.y);
    }
    state.pointer.down = false;
    dragPotato = false;
    dragMoved = false;
  }

  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);
  window.addEventListener("keydown", (e) => {
    state.keys[e.key] = true;
    if (e.key === " " || e.key === "Enter") {
      if (state.mode === "tug") mashTug();
      else if (state.mode === "play") throwLasso(state.pointer.x, state.pointer.y);
      e.preventDefault();
    }
    if (e.key === "Escape" && state.mode === "play") pause();
    if (e.key === "p" && state.mode === "play") pause();
  });
  window.addEventListener("keyup", (e) => {
    state.keys[e.key] = false;
  });
  window.addEventListener("resize", resize);

  function pause() {
    if (state.mode !== "play") return;
    state.mode = "pause";
    show($("pause"));
    Sfx.stopMusic();
  }
  function resume() {
    hide($("pause"));
    state.mode = "play";
    Sfx.startMusic();
  }

  // buttons
  $("btnPlay").onclick = () => {
    Sfx.unlock();
    Sfx.click();
    startGame();
  };
  $("btnHow").onclick = () => {
    Sfx.unlock();
    Sfx.click();
    hide($("title"));
    show($("howto"));
  };
  $("btnHowGo").onclick = () => {
    Sfx.click();
    startGame();
  };
  $("btnPause").onclick = () => {
    Sfx.click();
    pause();
  };
  $("btnResume").onclick = () => {
    Sfx.click();
    resume();
  };
  $("btnRestart").onclick = () => {
    Sfx.click();
    startGame();
  };
  $("btnQuit").onclick = () => {
    Sfx.click();
    goTitle();
  };
  $("btnAgain").onclick = () => {
    Sfx.click();
    startGame();
  };
  $("btnHome").onclick = () => {
    Sfx.click();
    goTitle();
  };
  $("btnMute").onclick = () => {
    Sfx.unlock();
    setMute(!Sfx.muted);
  };

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  resize();
  $("bestScore").textContent = bestScore();
  if (Sfx.muted) $("muteImg").src = "assets/ui/sound_off.png";

  loadAll()
    .then(() => {
      hide($("loader"));
      goTitle();
      requestAnimationFrame(frame);
    })
    .catch((err) => {
      $("loadTxt").textContent = "Couldn't load: " + err.message;
      console.error(err);
    });
})();
