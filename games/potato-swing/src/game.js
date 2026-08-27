/* ============================================================
   POTATO SWING — a smooth rope-swinging momentum game
   One-touch: HOLD = throw rope & swing, RELEASE = fly!
   ============================================================ */
'use strict';

const ASSETS = %%ASSETS%%;
const META = %%META%%;

/* ------------------------- images ------------------------- */
const IMG = {};
let loadTotal = 0, loadDone = 0;
function loadImages(cb) {
  for (const k in ASSETS) loadTotal++;
  for (const k in ASSETS) {
    const im = new Image();
    im.onload = im.onerror = () => { loadDone++; if (loadDone >= loadTotal) cb(); };
    im.src = ASSETS[k];
    IMG[k] = im;
  }
}

/* ------------------------- canvas ------------------------- */
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let DPR = 1, VW = 0, VH = 0, SCALE = 1, viewW = 0, viewH = 0;
let skyGrad = null, vign = null, safeT = 0, safeL = 0, safeR = 0;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  /* landscape: fit ~720 world px tall; portrait: zoom in more so the
     potato stays a decent size and centered in the middle of the screen */
  SCALE = VW >= VH ? Math.min(VH / 720, VW / 820) : Math.max(VW / 620, VH / 1500);
  viewW = VW / SCALE; viewH = VH / SCALE;
  skyGrad = null; vign = null;
  try {
    const probe = document.getElementById('safe');
    if (probe) {
      const cs = getComputedStyle(probe);
      safeT = parseFloat(cs.paddingTop) || 0;
      safeL = parseFloat(cs.paddingLeft) || 0;
      safeR = parseFloat(cs.paddingRight) || 0;
    }
  } catch (e) { safeT = safeL = safeR = 0; }
}

/* ------------------------- helpers ------------------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function srand(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circle(x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
function txt(s, x, y, size, fill, stroke, lw, align, weight) {
  ctx.font = (weight || 900) + ' ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (stroke) { ctx.lineWidth = lw || Math.max(3, size / 7); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}

/* ------------------------- storage ------------------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ps_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ps_' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ------------------------- constants ------------------------- */
const G = 2300;
const RUN_SPEED = 350;
const MAX_SPEED = 2100;
const ROPE_MAX = 560;
const ROPE_MIN = 150;
const PUMP = 300;
const RELEASE_BOOST = 1.045;
const CHASM_Y = 600;
const DEATH_Y = CHASM_Y + 120;
const ROPE_DEATH_Y = CHASM_Y + 260;
const FOOT = 48;
const DT = 1 / 120;

const ANIMS = {
  idle:   { sheet: 'potato_idle',  fps: 7,  pivot: [0.5, 0.94], drawH: 96 },
  run:    { sheet: 'potato_run',   fps: 13, pivot: [0.5, 0.94], drawH: 96 },
  fly:    { sheet: 'potato_fly',   fps: 10, pivot: [0.5, 0.55], drawH: 90 },
  swing:  { sheet: 'potato_swing', fps: 5,  pivot: [0.5, 0.05], drawH: 122 },
  throwA: { sheet: 'potato_throw', fps: 13, pivot: [0.5, 0.55], drawH: 100, once: true },
  hit:    { sheet: 'potato_hit',   fps: 6,  pivot: [0.5, 0.5],  drawH: 94 }
};

/* ------------------------- state ------------------------- */
let MODE = 'load';           // load | menu | play | over
let time = 0, menuT = 0, overT = 0, loadT = 0;
let best = store.get('best', 0);
let chipsTotal = store.get('chipsTotal', 0);
let TUT = store.get('tut', { grab: 0, rel: 0 });
let soundMode = store.get('sound', 2);   // 2 music+sfx | 1 sfx | 0 mute

let anchors = [], chips = [], parts = [], trail = [], clouds = [];
let genX = 0, prevAx = 0, prevAy = 0, chipsRun = 0, meters = 0, newBest = false;
const cam = { x: -260, y: -80, sh: 0, shx: 0, shy: 0 };

const P = {
  x: 0, y: 0, vx: 0, vy: 0, state: 'idle', anim: 'idle', animT: 0, frame: 0,
  angle: 0, face: 1, squash: 0, rope: null, ground: null, deadT: 0, spin: 1,
  cand: null, trailT: 0, fogHit: false
};

/* ------------------------- audio ------------------------- */
let AC = null, master = null, musicG = null, sfxG = null, noiseBuf = null;
let musicTimer = null, nextNote = 0, noteI = 0;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    AC = new Ctx();
    master = AC.createGain(); master.connect(AC.destination);
    musicG = AC.createGain(); musicG.connect(master);
    sfxG = AC.createGain(); sfxG.connect(master);
    applySound();
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextNote = AC.currentTime + 0.1;
    musicTimer = setInterval(musicTick, 60);
  } catch (e) { AC = null; }
}
function applySound() {
  if (!AC) return;
  master.gain.value = soundMode === 0 ? 0 : 0.55;
  musicG.gain.value = soundMode === 2 ? 0.42 : 0;
  sfxG.gain.value = 1;
}
function tone(f, f2, dur, type, vol, delay, dest) {
  if (!AC || soundMode === 0) return;
  const t0 = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || sfxG);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noiseHit(dur, vol, fc, fc2, delay) {
  if (!AC || soundMode === 0) return;
  const t0 = AC.currentTime + (delay || 0);
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const flt = AC.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 0.9;
  flt.frequency.setValueAtTime(fc, t0);
  if (fc2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, fc2), t0 + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(flt); flt.connect(g); g.connect(sfxG);
  s.start(t0); s.stop(t0 + dur + 0.05);
}
function sfx(name) {
  if (!AC) return;
  switch (name) {
    case 'thwip': noiseHit(0.13, 0.5, 2600, 500); tone(950, 260, 0.14, 'triangle', 0.16); break;
    case 'whoosh': noiseHit(0.3, 0.34, 420, 2600); break;
    case 'ding': tone(987, 0, 0.12, 'triangle', 0.24); tone(1318, 0, 0.2, 'triangle', 0.22, 0.07); break;
    case 'thud': tone(120, 50, 0.16, 'sine', 0.55); noiseHit(0.09, 0.3, 300, 140); break;
    case 'deny': tone(170, 140, 0.07, 'square', 0.1); tone(150, 120, 0.07, 'square', 0.1, 0.08); break;
    case 'crash':
      noiseHit(0.5, 0.55, 1300, 180);
      tone(392, 0, 0.18, 'square', 0.12, 0.02);
      tone(311, 0, 0.18, 'square', 0.12, 0.17);
      tone(233, 175, 0.34, 'square', 0.12, 0.32);
      break;
    case 'best': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0, 0.22, 'triangle', 0.22, i * 0.12)); break;
  }
}
/* cheerful tiny loop */
const MELO = [0, 4, 7, 12, 9, 7, 4, 0, 2, 5, 9, 14, 12, 9, 5, 2];
const BASS = [0, 0, -5, -5, -3, -3, -7, -7];
const STEP = 0.217; // 8ths @138bpm
function musicTick() {
  if (!AC || soundMode !== 2) { nextNote = AC ? AC.currentTime + 0.1 : 0; return; }
  while (nextNote < AC.currentTime + 0.22) {
    const mi = MELO[noteI % MELO.length];
    const f = 261.63 * Math.pow(2, mi / 12) * (noteI % 32 >= 16 ? 1.5 : 1);
    tone(f, 0, 0.16, 'triangle', 0.16, nextNote - AC.currentTime, musicG);
    if (noteI % 2 === 0) {
      const b = BASS[(noteI >> 1) % BASS.length];
      tone(65.41 * Math.pow(2, (b + 12) / 12), 0, 0.24, 'sine', 0.22, nextNote - AC.currentTime, musicG);
    }
    nextNote += STEP; noteI++;
  }
}

/* ------------------------- world gen ------------------------- */
let seedC = 1234;
function rnd() { seedC = (seedC * 1103515245 + 12345) & 0x7fffffff; return seedC / 0x7fffffff; }

function resetWorld() {
  anchors = []; chips = []; parts = []; trail = []; clouds = [];
  seedC = (Date.now() & 0xffff) + 7;
  genX = 560; prevAx = 560; prevAy = -70;
  anchors.push({ x: 560, y: -70, vw: 1, flip: false, seed: 1 });
  genAhead(2600);
  for (let i = 0; i < 8; i++)
    clouds.push({ x: -600 + i * 420 + rnd() * 200, y: 20 + rnd() * 300, s: 0.6 + rnd() * 0.9, v: 5 + rnd() * 12 });
}

function genAhead(untilX) {
  while (genX < untilX) {
    const diff = clamp(genX / 40000, 0, 1);
    let gap = 300 + rnd() * 110 + diff * 100;
    let y = clamp(prevAy + (rnd() * 2 - 1) * (120 + diff * 140), CHASM_Y - 560, CHASM_Y - 320);
    let x = prevAx + gap;
    // keep reachable from a standstill on previous spire top
    let tries = 0;
    while (Math.hypot(x - prevAx, y - (prevAy + 150)) > 520 && tries < 8) {
      gap *= 0.92; x = prevAx + gap;
      y = clamp(y + 24, CHASM_Y - 560, CHASM_Y - 320); tries++;
    }
    const a = { x, y, vw: 0.85 + rnd() * 0.35, flip: rnd() < 0.5, seed: anchors.length };
    anchors.push(a);
    if (rnd() < 0.78) {
      const n = 3 + (rnd() * 3 | 0);
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        chips.push({
          x: lerp(prevAx, x, t),
          y: lerp(prevAy, y, t) + 150 + Math.sin(t * Math.PI) * 130,
          ph: rnd() * 6.28, taken: false
        });
      }
    }
    prevAx = x; prevAy = y; genX = x;
  }
  while (anchors.length && anchors[0].x < cam.x - 900) anchors.shift();
  while (chips.length && chips[0].x < cam.x - 900) chips.shift();
}

/* ------------------------- player control ------------------------- */
function attachRange() {
  return ROPE_MAX + clamp((P.y - (CHASM_Y - 280)) / 300, 0, 1) * 120;
}
function pickAnchor() {
  const R = attachRange();
  let bestA = null, bestS = -1e9;
  for (const a of anchors) {
    if (a.x < P.x - 260 || a.x > P.x + 640) continue;
    if (a.y > P.y + 160) continue;
    const d = Math.hypot(a.x - P.x, a.y - P.y);
    if (d > R) continue;
    const ahead = clamp(a.x - P.x, -260, 420);
    const above = Math.min(P.y - a.y, 500);
    const s = ahead * 1.0 + Math.max(0, above) * 0.7 - Math.abs(d - 330) * 0.3;
    if (s > bestS) { bestS = s; bestA = a; }
  }
  return bestA;
}
function tryAttach() {
  if (P.state === 'dead') return;
  const a = pickAnchor();
  if (!a) {
    sfx('deny');
    parts.push({ type: 'deny', x: P.x, y: P.y - 70, life: 0.35, max: 0.35 });
    return;
  }
  const d = Math.hypot(a.x - P.x, a.y - P.y);
  P.rope = { a, len: Math.max(ROPE_MIN, Math.min(d - 30, ROPE_MAX)), t: 0 };
  P.state = 'swing'; P.ground = null;
  P.anim = 'throwA'; P.animT = 0; P.frame = 0;
  sfx('thwip');
  parts.push({ type: 'ring', x: a.x, y: a.y, life: 0.3, max: 0.3 });
  if (!TUT.grab) { TUT.grab = 1; store.set('tut', TUT); }
}
function release() {
  if (!P.rope) return;
  P.rope = null;
  P.vx *= RELEASE_BOOST; P.vy *= RELEASE_BOOST;
  const sp = Math.hypot(P.vx, P.vy);
  if (sp > MAX_SPEED) { P.vx *= MAX_SPEED / sp; P.vy *= MAX_SPEED / sp; }
  P.state = 'fly'; P.anim = 'fly'; P.animT = 0;
  sfx('whoosh');
  for (let i = 0; i < 5; i++)
    parts.push({ type: 'puff', x: P.x, y: P.y, vx: -P.vx * 0.06 + (rnd() - 0.5) * 60, vy: -P.vy * 0.06 + (rnd() - 0.5) * 60, life: 0.4, max: 0.4 });
  if (sp > 950) parts.push({ type: 'text', x: P.x, y: P.y - 80, s: 'NICE!', life: 0.8, max: 0.8 });
  if (!TUT.rel) { TUT.rel = 1; store.set('tut', TUT); }
}
function die() {
  if (P.state === 'dead') return;
  P.state = 'dead'; P.deadT = 0; P.fogHit = false;
  P.anim = 'hit'; P.animT = 0;
  P.rope = null; P.ground = null;
  P.vx *= 0.25; P.vy = Math.min(P.vy, -380);
  P.spin = (P.vx >= 0 ? 1 : -1) * 6;
  cam.sh = 16;
  sfx('crash');
  if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
  for (let i = 0; i < 14; i++)
    parts.push({ type: 'star', x: P.x, y: P.y, vx: (rnd() - 0.5) * 500, vy: (rnd() - 0.7) * 500, life: 0.9, max: 0.9, rot: rnd() * 6 });
}
function finalize() {
  MODE = 'over'; overT = 0;
  newBest = meters > best;
  if (newBest) { best = meters; store.set('best', best); sfx('best'); }
  chipsTotal += chipsRun; store.set('chipsTotal', chipsTotal);
}

/* ------------------------- physics ------------------------- */
function surfacesNear() {
  const s = [];
  if (P.x < 400) s.push({ x0: -180, x1: 180, y: CHASM_Y - 430 });
  for (const a of anchors) {
    if (a.x > P.x - 350 && a.x < P.x + 350) s.push({ x0: a.x - 78, x1: a.x + 78, y: a.y + 150 });
  }
  return s;
}
function stepPhysics(dt) {
  const prevFeet = P.y + FOOT;
  P.vy += G * dt;

  if (P.state === 'run' && P.ground) {
    P.vx += clamp(RUN_SPEED - P.vx, -1100 * dt, 700 * dt);
    P.vy = 0;
    P.y = P.ground.y - FOOT;
    if (P.x > P.ground.x1 || P.x < P.ground.x0 - 6) {
      P.state = 'fly'; P.anim = 'fly'; P.animT = 0; P.ground = null;
    }
  }
  if (P.state === 'swing' && P.rope) {
    P.rope.len = Math.max(ROPE_MIN, P.rope.len - 55 * dt);      // gentle reel-in
    P.rope.t = Math.min(1, P.rope.t + dt / 0.08);
  }
  P.x += P.vx * dt; P.y += P.vy * dt;

  if (P.state === 'swing' && P.rope && P.rope.t > 0.55) {
    const a = P.rope.a;
    const eff = Math.max(60, P.rope.len - 52);                  // hands offset
    let dx = P.x - a.x, dy = P.y - a.y;
    let d = Math.hypot(dx, dy) || 1e-6;
    if (d > eff) {
      const nx = dx / d, ny = dy / d;
      P.x = a.x + nx * eff; P.y = a.y + ny * eff;
      const vr = P.vx * nx + P.vy * ny;
      if (vr > 0) { P.vx -= vr * nx; P.vy -= vr * ny; }
      const below = dy / d;
      if (below > 0.12) {                                        // swing pump
        const tx = -ny, ty = nx;
        let s = P.vx * tx + P.vy * ty;
        if (Math.abs(s) < 40) s = (P.vx >= 0 ? 1 : -1) * 40;
        const b = PUMP * below * dt * Math.sign(s);
        P.vx += tx * b; P.vy += ty * b;
      }
    }
  }
  const sp = Math.hypot(P.vx, P.vy);
  if (sp > MAX_SPEED) { P.vx *= MAX_SPEED / sp; P.vy *= MAX_SPEED / sp; }
  if (P.state === 'fly') { const dr = Math.pow(0.9994, dt * 120); P.vx *= dr; P.vy *= dr; }

  /* landing */
  if ((P.state === 'fly' || P.state === 'swing') && P.vy >= -20) {
    const feet = P.y + FOOT;
    for (const s of surfacesNear()) {
      if (P.x > s.x0 - 14 && P.x < s.x1 + 14 && prevFeet <= s.y + 8 && feet >= s.y - 4) {
        P.y = s.y - FOOT; P.vy = 0;
        if (P.rope) P.rope = null;
        P.state = 'run'; P.anim = 'run'; P.animT = 0;
        P.ground = s; P.squash = 0.6;
        sfx('thud'); cam.sh = Math.min(5, Math.abs(P.vx) / 400);
        for (let i = 0; i < 7; i++)
          parts.push({ type: 'dust', x: P.x + (rnd() - 0.5) * 50, y: s.y, vx: (rnd() - 0.5) * 160, vy: -rnd() * 90, life: 0.5, max: 0.5 });
        break;
      }
    }
  }
  if (P.state === 'run') P.squash += Math.abs(Math.sin(P.animT * 26)) * 0.02;

  /* death */
  if (P.state !== 'dead') {
    const dy = P.rope ? ROPE_DEATH_Y : DEATH_Y;
    if (P.y > dy) die();
  } else {
    P.deadT += dt;
    P.angle += P.spin * dt;
    if (!P.fogHit && P.y > CHASM_Y + 30) {
      P.fogHit = true;
      for (let i = 0; i < 12; i++)
        parts.push({ type: 'fog', x: P.x + (rnd() - 0.5) * 120, y: CHASM_Y + 40, vx: (rnd() - 0.5) * 180, vy: -rnd() * 60 - 20, life: 1.1, max: 1.1 });
    }
    if (P.deadT > 1.45 && MODE === 'play') finalize();
  }
  meters = Math.max(meters, Math.floor((P.x + 40) / 50));
}

/* ------------------------- misc updates ------------------------- */
function updateAnim(dt) {
  if (P.anim === 'throwA' && P.state !== 'swing') { P.anim = 'fly'; P.animT = 0; P.frame = 0; }
  const an = ANIMS[P.anim], m = META[an.sheet];
  P.animT += dt;
  if (an.once) {
    const f = Math.floor(P.animT * an.fps);
    if (f >= m.frames) { if (P.anim === 'throwA' && P.rope) { P.anim = 'swing'; P.animT = 0; P.frame = 0; } else P.frame = m.frames - 1; }
    else P.frame = f;
  } else P.frame = Math.floor(P.animT * an.fps) % m.frames;

  /* angle */
  let ta = 0;
  if (P.state === 'swing' && P.rope) ta = Math.atan2(P.rope.a.y - P.y, P.rope.a.x - P.x) + Math.PI / 2;
  else if (P.state === 'fly') ta = clamp(Math.atan2(P.vy, Math.max(60, P.vx)) * 0.55, -0.5, 1.1);
  else if (P.state === 'run') ta = clamp(P.vx * 0.00012, -0.12, 0.12);
  if (P.state !== 'dead') P.angle += angDiff(ta, P.angle) * (1 - Math.exp(-dt * 12));
  P.face = P.vx < -90 ? -1 : 1;
  P.squash *= Math.exp(-dt * 9);
}
function collectChips() {
  for (const c of chips) {
    if (c.taken) continue;
    if (Math.abs(c.x - P.x) < 70 && Math.abs(c.y - P.y) < 70 && Math.hypot(c.x - P.x, c.y - P.y) < 60) {
      c.taken = true; chipsRun++;
      sfx('ding');
      parts.push({ type: 'text', x: c.x, y: c.y - 30, s: '+1', life: 0.7, max: 0.7 });
      for (let i = 0; i < 8; i++)
        parts.push({ type: 'spark', x: c.x, y: c.y, vx: (rnd() - 0.5) * 300, vy: (rnd() - 0.7) * 300, life: 0.5, max: 0.5, rot: rnd() * 6 });
    }
  }
}
/* Center the potato in the middle of the screen (slightly left-of-center
   look-ahead so you can see where you're flying). */
const CAM_FX = 0.45, CAM_FY = 0.45;
function updateCamera(dt) {
  const tx = P.x - viewW * CAM_FX, ty = P.y - viewH * CAM_FY;
  cam.x += (tx - cam.x) * (1 - Math.exp(-dt * 9));
  cam.y += (ty - cam.y) * (1 - Math.exp(-dt * 7));
  /* hard safety: the potato can NEVER leave the screen while alive */
  if (P.state !== 'dead') {
    cam.x = clamp(cam.x, P.x - viewW * 0.80, P.x - viewW * 0.16);
    cam.y = clamp(cam.y, P.y - viewH * 0.82, P.y - viewH * 0.10);
  }
  cam.y = Math.min(cam.y, CHASM_Y + 320 - viewH);
  cam.y = Math.max(cam.y, -1150);
  cam.sh *= Math.exp(-dt * 6);
  cam.shx = (rnd() - 0.5) * 2 * cam.sh;
  cam.shy = (rnd() - 0.5) * 2 * cam.sh;
}
function snapCamera() {
  cam.x = P.x - viewW * CAM_FX;
  cam.y = P.y - viewH * CAM_FY;
  cam.y = Math.min(cam.y, CHASM_Y + 320 - viewH);
  cam.y = Math.max(cam.y, -1150);
  cam.sh = 0; cam.shx = 0; cam.shy = 0;
}
function updateParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (p.type === 'dust' || p.type === 'spark' || p.type === 'star') { p.vy += 900 * dt; p.vx *= Math.pow(0.4, dt); }
    if (p.type === 'text') p.y -= 55 * dt;
    if (p.rot !== undefined) p.rot += dt * 6;
  }
}
function updateTrail(dt) {
  const sp = Math.hypot(P.vx, P.vy);
  P.trailT -= dt;
  if (sp > 750 && P.trailT <= 0) {
    trail.push({ x: P.x, y: P.y, r: clamp(sp / 90, 12, 26) });
    if (trail.length > 11) trail.shift();
    P.trailT = 0.026;
  } else if (sp < 500 && trail.length) trail.shift();
  if (sp > 1250 && rnd() < dt * 22) {
    const a = rnd() * TAU;
    parts.push({ type: 'line', x: P.x - Math.cos(a) * 50, y: P.y - Math.sin(a) * 50, vx: -P.vx * 0.25, vy: -P.vy * 0.25, life: 0.22, max: 0.22 });
  }
}
function updateClouds(dt) {
  const p = 0.28, lx = cam.x * p;
  for (const c of clouds) {
    c.x -= c.v * dt;
    if (c.x < lx - viewW * 0.7 - 400) c.x = lx + viewW * 0.7 + 400 + rnd() * 300;
    if (c.x > lx + viewW * 0.7 + 900) c.x = lx - viewW * 0.7 - 300;
  }
}

/* ------------------------- flow ------------------------- */
function startGame() {
  resetWorld();
  P.x = -40; P.y = CHASM_Y - 430 - FOOT;
  P.vx = 0; P.vy = 0;
  P.state = 'run'; P.anim = 'run'; P.animT = 0; P.frame = 0;
  P.angle = 0; P.face = 1; P.squash = 0; P.rope = null; P.deadT = 0;
  P.ground = { x0: -180, x1: 180, y: CHASM_Y - 430 };
  chipsRun = 0; meters = 0; newBest = false;
  snapCamera();
  MODE = 'play';
}

/* ------------------------- update ------------------------- */
function update(dt) {
  time += dt;
  if (MODE === 'load') { loadT += dt; return; }
  if (MODE === 'menu') {
    menuT += dt; P.animT += dt;
    const an = ANIMS.idle, m = META[an.sheet];
    P.frame = Math.floor(P.animT * an.fps) % m.frames;
    updateClouds(dt); updateParticles(dt);
    return;
  }
  if (MODE === 'over') {
    overT += dt;
    if (P.state === 'dead') stepPhysics(dt);
    updateAnim(dt);
    updateParticles(dt); updateClouds(dt); updateCamera(dt);
    return;
  }
  /* play */
  genAhead(cam.x + viewW + 900);
  stepPhysics(dt);
  updateAnim(dt);
  collectChips();
  updateCamera(dt);
  updateParticles(dt);
  updateTrail(dt);
  updateClouds(dt);
  P.cand = (P.state === 'fly' || P.state === 'run') ? pickAnchor() : null;
}

/* ------------------------- render: backdrop ------------------------- */
function farFn(x) { return 300 + Math.sin(x * 0.00093 + 1.7) * 70 + Math.sin(x * 0.0027 + 0.4) * 40 + Math.sin(x * 0.0062 + 3.1) * 18; }
function midFn(x) { return 445 + Math.sin(x * 0.0015 + 2.6) * 50 + Math.sin(x * 0.0041 + 1.1) * 26 + Math.sin(x * 0.009 + 5) * 10; }
function nearFn(x) { return 560 + Math.sin(x * 0.0021 + 0.9) * 34 + Math.sin(x * 0.0057 + 2.2) * 18; }

function ridge(p, fn, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-12, VH + 12);
  const step = Math.max(16, VW / 55);
  for (let sx = -12; sx <= VW + 12 + step; sx += step) {
    const wx = cam.x * p + sx / SCALE;
    const sy = (fn(wx) - cam.y * p) * SCALE;
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(VW + 12, VH + 12);
  ctx.closePath(); ctx.fill();
}
function drawSky() {
  if (!skyGrad) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, VH);
    skyGrad.addColorStop(0, '#4fb7ef');
    skyGrad.addColorStop(0.45, '#8fd9fb');
    skyGrad.addColorStop(0.8, '#d8f4ff');
    skyGrad.addColorStop(1, '#ffedbe');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, VW, VH);
  /* sun */
  const sx = VW * 0.8 - cam.x * 0.012 * SCALE, sy = VH * 0.16 + cam.y * 0.02 * SCALE;
  ctx.globalAlpha = 0.25; circle(sx, sy, 86 * SCALE + 30, '#fff3b0');
  ctx.globalAlpha = 0.5; circle(sx, sy, 56 * SCALE + 16, '#ffe98a');
  ctx.globalAlpha = 1; circle(sx, sy, 36 * SCALE + 8, '#fff6c9');
}
function drawClouds() {
  const p = 0.28, lx = cam.x * p, ly = cam.y * p;
  const im = IMG.cloud, m = META.cloud;
  ctx.globalAlpha = 0.92;
  for (const c of clouds) {
    const sx = (c.x - lx) * SCALE, sy = (c.y - ly) * SCALE;
    const w = m.w * c.s * SCALE, h = m.h * c.s * SCALE;
    if (sx < -w - 60 || sx > VW + 60) continue;
    ctx.drawImage(im, sx - w / 2, sy - h / 2, w, h);
  }
  ctx.globalAlpha = 1;
}
function drawTrees(p, fn) {
  const lx = cam.x * p, ly = cam.y * p;
  const start = Math.floor((lx - viewW * 0.7) / 170), end = Math.ceil((lx + viewW * 0.7) / 170);
  for (let i = start; i <= end; i++) {
    const r = srand(i * 3.7);
    if (r > 0.55) continue;
    const wx = i * 170 + r * 90;
    const base = fn(wx) + 14 + r * 40;
    const sx = (wx - lx) * SCALE, sy = (base - ly) * SCALE;
    const s = (0.5 + r) * SCALE;
    ctx.fillStyle = '#3e6b3a';
    ctx.fillRect(sx - 3 * s, sy - 26 * s, 6 * s, 26 * s);
    circle(sx, sy - 34 * s, 16 * s, '#4e8a47');
    circle(sx - 10 * s, sy - 26 * s, 11 * s, '#47803f');
    circle(sx + 10 * s, sy - 27 * s, 12 * s, '#579450');
  }
}

/* ------------------------- render: world ------------------------- */
function wTrans(p) {
  ctx.setTransform(DPR * SCALE, 0, 0, DPR * SCALE,
    DPR * (-cam.x * SCALE * p + cam.shx * DPR / DPR), DPR * (-cam.y * SCALE * p + cam.shy));
}
function drawSpire(x, topY, topW, flip) {
  const sm = META.spire, im = IMG.spire;
  const sx = topW / (sm.topWRatio * sm.w);
  const dw = sm.w * sx;
  /* always plunge deep into the chasm fog — never a floating island */
  const dh = Math.max(sm.h * sx, (CHASM_Y + 140) - topY);
  ctx.save();
  if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  ctx.drawImage(im, x - dw / 2, topY, dw, dh);
  ctx.restore();
}
function drawPole(a) {
  const m = META.anchor, im = IMG.anchor;
  const poleH = 200, s = poleH / m.h;
  const dw = m.w * s;
  const dx = a.x - m.ringX * dw;
  const dy = a.y - m.ringY * poleH;
  ctx.drawImage(im, dx, dy, dw, poleH);
}
function drawChips() {
  const im = IMG.chip, m = META.chip;
  const cw = m.cellW, ch = m.cellH, n = m.frames;
  const S = 46;
  for (const c of chips) {
    if (c.taken || c.x < cam.x - 100 || c.x > cam.x + viewW + 100) continue;
    const f = Math.floor((time * 8 + c.ph) % n);
    const y = c.y + Math.sin(time * 3 + c.ph) * 6;
    ctx.save();
    ctx.globalAlpha = 0.35;
    circle(c.x + 4, y + 14, 14, '#3a2b55');
    ctx.globalAlpha = 1;
    ctx.drawImage(im, f * cw, 0, cw, ch, c.x - S / 2, y - S / 2, S, S);
    ctx.restore();
  }
}
function ropeStroke(hx, hy, mx, my, tx, ty, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
}
function drawRope() {
  const r = P.rope; if (!r) return;
  const a = r.a;
  const th = Math.atan2(a.y - P.y, a.x - P.x);
  const hx = P.x + Math.cos(th) * 52, hy = P.y + Math.sin(th) * 52;
  const e = 1 - (1 - r.t) * (1 - r.t);
  const tx = lerp(hx, a.x, e), ty = lerp(hy, a.y, e);
  const d = Math.hypot(a.x - P.x, a.y - P.y);
  const slack = Math.min(90, Math.max(0, r.len - d) * 0.45);
  const mx = (hx + tx) / 2, my = (hy + ty) / 2 + slack;
  ropeStroke(hx, hy, mx, my, tx, ty, '#38221a', 9);
  ropeStroke(hx, hy, mx, my, tx, ty, '#8a5a33', 5);
  ropeStroke(hx, hy, mx, my, tx, ty, '#c09061', 1.6);
  circle(tx, ty, 8, '#38221a'); circle(tx, ty, 5.5, '#e8c14d');
  circle(hx, hy, 6, '#38221a'); circle(hx, hy, 3.5, '#c09061');
}
function drawPlayer() {
  const an = ANIMS[P.anim], m = META[an.sheet], img = IMG[an.sheet];
  const f = clamp(P.frame, 0, m.frames - 1);
  const drawH = an.drawH, drawW = m.cellW / m.cellH * drawH;
  /* P is always the potato's center; sprite drawn & rotated around center */
  /* shadow */
  if (P.state === 'run' && P.ground) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#1e2a1e';
    ctx.beginPath(); ctx.ellipse(P.x, P.ground.y + 4, 46, 10, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.rotate(P.angle);
  if (P.state === 'run' || P.state === 'idle') ctx.scale((1 + P.squash * 0.35) * P.face, 1 - P.squash * 0.4);
  else ctx.scale(P.face, 1);
  ctx.drawImage(img, f * m.cellW, 0, m.cellW, m.cellH, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}
function drawParticles() {
  for (const p of parts) {
    const t = p.life / p.max;
    if (p.type === 'dust') { ctx.globalAlpha = t * 0.5; circle(p.x, p.y, 8 + (1 - t) * 10, '#a98a63'); }
    else if (p.type === 'spark') { ctx.globalAlpha = t; star(p.x, p.y, 7 + 5 * (1 - t), p.rot, '#ffd94a', '#fff2b0'); }
    else if (p.type === 'star') { ctx.globalAlpha = t; star(p.x, p.y, 10, p.rot, '#ffd94a', '#fff'); }
    else if (p.type === 'ring') {
      ctx.globalAlpha = t; ctx.lineWidth = 4; ctx.strokeStyle = '#ffe082';
      ctx.beginPath(); ctx.arc(p.x, p.y, 14 + (1 - t) * 34, 0, TAU); ctx.stroke();
    }
    else if (p.type === 'deny') {
      ctx.globalAlpha = t * 0.7; ctx.lineWidth = 5; ctx.strokeStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 + (1 - t) * 20, 0, TAU); ctx.stroke();
    }
    else if (p.type === 'puff') { ctx.globalAlpha = t * 0.4; circle(p.x, p.y, 6 + (1 - t) * 12, '#ffffff'); }
    else if (p.type === 'fog') { ctx.globalAlpha = t * 0.5; circle(p.x, p.y, 14 + (1 - t) * 30, '#41336b'); }
    else if (p.type === 'line') {
      ctx.globalAlpha = t * 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const l = 60 * t + 20;
      const a = Math.atan2(p.vy, p.vx);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); ctx.stroke();
    }
    else if (p.type === 'text') { ctx.globalAlpha = Math.min(1, t * 2); txt(p.s, p.x, p.y, 30, '#fff', '#7a4a10', 6); }
    ctx.globalAlpha = 1;
  }
}
function star(x, y, r, rot, c1, c2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr2 = i % 2 === 0 ? r : r * 0.42;
    const a = i / 8 * TAU - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    else ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fillStyle = c1; ctx.fill();
  ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawWorld() {
  wTrans(1);
  /* start spire + anchor spires */
  drawSpire(0, CHASM_Y - 430, 360, false);
  for (const a of anchors) {
    if (a.x < cam.x - 400 || a.x > cam.x + viewW + 500) continue;
    drawSpire(a.x, a.y + 150, 170 * a.vw, a.flip);
    drawPole(a);
  }
  drawChips();
  /* candidate highlight */
  if (MODE === 'play' && P.cand) {
    const a = P.cand, pu = 0.5 + 0.5 * Math.sin(time * 7);
    ctx.globalAlpha = 0.55 + pu * 0.35;
    ctx.lineWidth = 5; ctx.strokeStyle = '#ffe082';
    ctx.beginPath(); ctx.arc(a.x, a.y, 26 + pu * 9, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.9;
    const ay = a.y - 62 - pu * 8;
    ctx.fillStyle = '#ffe082';
    ctx.beginPath(); ctx.moveTo(a.x - 13, ay); ctx.lineTo(a.x + 13, ay); ctx.lineTo(a.x, ay + 18); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  /* tutorial grab hint */
  if (MODE === 'play' && !TUT.grab && anchors.length) {
    const a = anchors[0];
    txt('HOLD!', a.x, a.y - 95, 34, '#ffffff', '#5b3a1e', 7);
  }
  /* trail */
  for (let i = 0; i < trail.length; i++) {
    const tr = trail[i], t = i / trail.length;
    ctx.globalAlpha = 0.02 + t * 0.12;
    circle(tr.x, tr.y, tr.r * (0.4 + t * 0.8), '#ffe9b0');
  }
  ctx.globalAlpha = 1;
  drawRope();
  drawPlayer();
  drawParticles();
  /* chasm fog */
  const fg = ctx.createLinearGradient(0, CHASM_Y - 30, 0, CHASM_Y + 190);
  fg.addColorStop(0, 'rgba(30,22,54,0)');
  fg.addColorStop(0.55, 'rgba(30,22,54,0.78)');
  fg.addColorStop(1, 'rgba(22,15,42,1)');
  ctx.fillStyle = fg;
  ctx.fillRect(cam.x - 20, CHASM_Y - 30, viewW + 40, 230);
  ctx.fillStyle = '#160f2a';
  ctx.fillRect(cam.x - 20, CHASM_Y + 185, viewW + 40, viewH + 400);
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#bda6e8';
  ctx.fillRect(cam.x - 20, CHASM_Y - 44, viewW + 40, 26);
  ctx.globalAlpha = 1;
}

/* ------------------------- render: UI ------------------------- */
function glossyBtn(cx, cy, r, c1, c2, icon) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.2);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(4, r * 0.13); ctx.strokeStyle = '#33202b'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx - r * 0.2, cy - r * 0.45, r * 0.55, r * 0.28, -0.4, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  ctx.fillStyle = '#fff';
  if (icon === 'play') {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.22, cy - r * 0.34);
    ctx.lineTo(cx + r * 0.42, cy);
    ctx.lineTo(cx - r * 0.22, cy + r * 0.34);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.lineWidth = r * 0.17; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, -2.4, 1.9); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.5 * Math.cos(1.9) - r * 0.1, cy + r * 0.38 * Math.sin(1.9));
    ctx.lineTo(cx + r * 0.38 * Math.cos(1.9) + r * 0.12, cy + r * 0.38 * Math.sin(1.9) - r * 0.24);
    ctx.lineTo(cx + r * 0.38 * Math.cos(1.9) + r * 0.26, cy + r * 0.38 * Math.sin(1.9) + r * 0.14);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function speakerIcon(x, y, s, mode) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, -4); ctx.lineTo(-4, -4); ctx.lineTo(2, -9); ctx.lineTo(2, 9); ctx.lineTo(-4, 4); ctx.lineTo(-9, 4);
  ctx.closePath(); ctx.fill();
  if (mode === 0) {
    ctx.strokeStyle = '#ff8080'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-11, -11); ctx.lineTo(11, 11); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(4, 0, 6, -0.9, 0.9); ctx.stroke();
    if (mode === 2) { ctx.beginPath(); ctx.arc(4, 0, 10, -0.8, 0.8); ctx.stroke(); }
  }
  ctx.restore();
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const top = safeT + 14, left = safeL + 16, right = VW - safeR - 16;
  /* distance */
  txt(meters + 'm', VW / 2, top + 24, 44, '#ffffff', '#4e342e', 8);
  /* chips */
  const im = IMG.chip, m = META.chip;
  const f = Math.floor(time * 7) % m.frames;
  ctx.drawImage(im, f * m.cellW, 0, m.cellW, m.cellH, left, top + 4, 36, 36);
  txt('× ' + chipsRun, left + 46, top + 23, 30, '#ffd94a', '#4e342e', 6, 'left');
  /* sound */
  glossyBtn(right - 26, top + 22, 24, '#8e6fd8', '#5b3fa8', 'none');
  speakerIcon(right - 26, top + 22, 1.05, soundMode);
  /* release tutorial */
  if (!TUT.rel && P.rope && P.rope.t > 0.5 && P.state === 'swing') {
    const pu = 0.6 + 0.4 * Math.sin(time * 6);
    ctx.globalAlpha = pu;
    txt('RELEASE TO FLY!', VW / 2, top + 78, 34, '#ffffff', '#c0392b', 7);
    ctx.globalAlpha = 1;
  }
}
function drawMenu() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  /* logo */
  const ly = VH * 0.17, sc = Math.min(1, VW / 560);
  ctx.save();
  ctx.translate(VW / 2, ly); ctx.rotate(-0.045); ctx.scale(sc, sc);
  const g = ctx.createLinearGradient(0, -60, 0, 60);
  g.addColorStop(0, '#ffe99a'); g.addColorStop(0.55, '#ffc93c'); g.addColorStop(1, '#ff9800');
  ctx.font = '900 92px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(40,20,60,0.45)'; ctx.shadowOffsetY = 8; ctx.shadowBlur = 0;
  ctx.lineWidth = 18; ctx.strokeStyle = '#4e342e'; ctx.strokeText('POTATO', 0, -34);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = g; ctx.fillText('POTATO', 0, -34);
  ctx.shadowColor = 'rgba(40,20,60,0.45)'; ctx.shadowOffsetY = 8;
  ctx.lineWidth = 16; ctx.strokeStyle = '#4e342e'; ctx.strokeText('SWING!', 0, 46);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = g; ctx.fillText('SWING!', 0, 46);
  ctx.restore();
  /* start prompt */
  const pu = 0.55 + 0.45 * Math.sin(menuT * 4.5);
  ctx.globalAlpha = pu;
  txt('TAP TO START', VW / 2, VH * 0.5, Math.min(44, VW / 11), '#ffffff', '#4e342e', 8);
  ctx.globalAlpha = 1;
  glossyBtn(VW / 2, VH * 0.62, Math.min(46, VW / 9), '#8ee27a', '#3fa14e', 'play');
  /* instructions */
  const iy = VH * 0.76, fs = Math.min(24, VW / 22);
  txt('HOLD — grab the ring', VW / 2 - 10, iy, fs, '#ffffff', '#4e342e', 5);
  txt('RELEASE — fly!', VW / 2 - 10, iy + fs * 1.6, fs, '#ffffff', '#4e342e', 5);
  /* best */
  if (best > 0) txt('BEST  ' + best + 'm', VW / 2, VH * 0.9, fs, '#ffd94a', '#4e342e', 5);
  /* sound */
  glossyBtn(VW - safeR - 42, safeT + 34, 26, '#8e6fd8', '#5b3fa8', 'none');
  speakerIcon(VW - safeR - 42, safeT + 34, 1.1, soundMode);
  if (VH > VW) txt('↻ rotate for the best view', VW / 2, VH - 18, 16, 'rgba(255,255,255,0.75)', 'rgba(60,40,80,0.8)', 4);
}
function drawOver() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(18,10,34,0.55)';
  ctx.fillRect(0, 0, VW, VH);
  const a = clamp(overT / 0.35, 0, 1);
  ctx.globalAlpha = a;
  const pw = Math.min(430, VW - 50), ph = Math.min(420, VH - 90);
  const px0 = (VW - pw) / 2, py0 = (VH - ph) / 2;
  rr(px0, py0, pw, ph, 26);
  ctx.fillStyle = '#3b2a56'; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#241a3a'; ctx.stroke();
  rr(px0 + 10, py0 + 10, pw - 20, ph - 20, 18);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
  txt('CRASHED!', VW / 2, py0 + 52, 46, '#ff7043', '#2d1b4e', 9);
  txt(meters + 'm', VW / 2, py0 + 118, 66, '#ffffff', '#2d1b4e', 10);
  /* chips */
  const im = IMG.chip, m = META.chip;
  const f = Math.floor(time * 7) % m.frames;
  ctx.drawImage(im, f * m.cellW, 0, m.cellW, m.cellH, VW / 2 - 66, py0 + 168, 34, 34);
  txt('× ' + chipsRun, VW / 2 - 26, py0 + 186, 28, '#ffd94a', '#2d1b4e', 6, 'left');
  txt('TOTAL  ' + chipsTotal, VW / 2 + 60, py0 + 186, 22, '#c9b8f0', '#2d1b4e', 5);
  if (newBest) {
    ctx.save();
    ctx.translate(VW / 2 + pw / 2 - 64, py0 + 66); ctx.rotate(0.22);
    const pu = 0.7 + 0.3 * Math.sin(time * 8);
    ctx.globalAlpha = pu * a;
    rr(-78, -20, 156, 40, 12);
    ctx.fillStyle = '#ffd94a'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
    txt('NEW BEST!', 0, 1, 24, '#5b3a00', null, 0);
    ctx.restore();
  } else {
    txt('BEST  ' + best + 'm', VW / 2, py0 + 246, 26, '#c9b8f0', '#2d1b4e', 5);
  }
  if (overT > 0.5) {
    glossyBtn(VW / 2, py0 + ph - 74, 42, '#ffb056', '#e2611b', 'retry');
    const pu = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.globalAlpha = pu;
    txt('TAP TO RETRY', VW / 2, py0 + ph - 16, 22, '#ffffff', '#2d1b4e', 5);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 1;
}
function drawLoad() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#221843';
  ctx.fillRect(0, 0, VW, VH);
  txt('POTATO SWING', VW / 2, VH * 0.42, Math.min(52, VW / 10), '#ffc93c', '#4e342e', 9);
  const w = Math.min(320, VW - 100);
  rr(VW / 2 - w / 2, VH * 0.55, w, 16, 8);
  ctx.fillStyle = '#160f2a'; ctx.fill();
  const t = loadTotal ? loadDone / loadTotal : 0;
  if (t > 0) { rr(VW / 2 - w / 2 + 3, VH * 0.55 + 3, (w - 6) * t, 10, 5); ctx.fillStyle = '#8ee27a'; ctx.fill(); }
  txt('loading potato…', VW / 2, VH * 0.55 + 44, 18, '#c9b8f0', null, 0);
}

/* ------------------------- render ------------------------- */
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (MODE === 'load') { drawLoad(); return; }
  drawSky();
  ridge(0.12, farFn, '#8d7ec4');
  ridge(0.2, farFn, '#7a6ab5');
  drawClouds();
  ridge(0.42, midFn, '#6fae66');
  drawTrees(0.42, midFn);
  ridge(0.62, nearFn, '#5a9c55');
  drawWorld();
  /* vignette */
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!vign) {
    vign = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.55, VW / 2, VH / 2, Math.max(VW, VH) * 0.78);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(20,10,40,0.22)');
  }
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, VW, VH);
  if (MODE === 'play') drawHUD();
  else if (MODE === 'menu') drawMenu();
  else if (MODE === 'over') { drawHUD(); drawOver(); }
}

/* ------------------------- input ------------------------- */
let pDown = false;
function onDown(e) {
  if (e.cancelable) e.preventDefault();
  initAudio();
  if (MODE === 'menu') {
    /* sound toggle hit? */
    const bx = VW - safeR - 42, by = safeT + 34;
    if (Math.hypot(e.clientX - bx, e.clientY - by) < 46) { cycleSound(); return; }
    startGame(); pDown = true; return;
  }
  if (MODE === 'over') {
    if (overT > 0.7) { startGame(); pDown = true; }
    return;
  }
  if (MODE === 'play') {
    /* sound toggle hit? (matches drawHUD position) */
    const bx = VW - safeR - 42, by = safeT + 36;
    if (Math.hypot(e.clientX - bx, e.clientY - by) < 44) { cycleSound(); return; }
    pDown = true;
    if (!P.rope && P.state !== 'dead') tryAttach();
  }
}
function onUp() {
  pDown = false;
  if (MODE === 'play' && P.rope && P.state === 'swing') release();
}
function cycleSound() {
  soundMode = (soundMode + 2) % 3;   // 2 -> 1 -> 0
  store.set('sound', soundMode);
  applySound();
}
window.addEventListener('pointerdown', onDown, { passive: false });
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') { e.preventDefault(); onDown(e); }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') onUp();
});
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (AC && document.hidden) AC.suspend(); else if (AC) AC.resume(); });

/* ------------------------- main loop ------------------------- */
let last = 0, acc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const now = t / 1000;
  let dt = now - last; last = now;
  if (!(dt > 0) || dt > 0.05) dt = 0.016;
  acc += dt;
  let guard = 0;
  while (acc >= DT && guard < 12) { update(DT); acc -= DT; guard++; }
  if (guard >= 12) acc = 0;
  render();
}

/* ------------------------- boot ------------------------- */
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
loadImages(() => {
  MODE = 'menu';
  resetWorld();
  P.x = -40; P.y = CHASM_Y - 430 - FOOT;
  P.state = 'idle'; P.anim = 'idle';
  snapCamera();
});
requestAnimationFrame(loop);
