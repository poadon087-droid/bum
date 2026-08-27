/* ================= POTATO SLICER =================
   Infinite fruit-slicing game starring the grumpy potato guy.
   Art: generated cartoon sticker style, sprite-sheet animations.
   ================================================= */
(() => {
"use strict";
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

let W = 0, H = 0, U = 1, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = Math.max(0.55, Math.min(1.8, Math.min(W / 900, H / 800)));
}
window.addEventListener('resize', resize);
resize();

/* ---------- assets ---------- */
const FRUIT_TYPES = [
  { name: 'watermelon', juice: '#ff4d6d' },
  { name: 'apple',      juice: '#ffd97a' },
  { name: 'carrot',     juice: '#ff8c2e' },
  { name: 'banana',     juice: '#ffe9a8' },
];
const LOAD_LIST = [
  ['bg', 'assets/bg.png'], ['logo', 'assets/logo.png'],
  ['idle', 'assets/potato_idle.png'], ['swing', 'assets/potato_swing.png'],
  ['heartSheet', 'assets/heart_sheet.png'],
];
for (const f of FRUIT_TYPES) {
  LOAD_LIST.push(['fruit_' + f.name, `assets/fruit_${f.name}.png`]);
  LOAD_LIST.push(['halfL_' + f.name, `assets/half_${f.name}_L.png`]);
  LOAD_LIST.push(['halfR_' + f.name, `assets/half_${f.name}_R.png`]);
  LOAD_LIST.push(['splash_' + f.name, `assets/splash_${f.name}.png`]);
}
const IMG = {};
let loaded = 0;
const total = LOAD_LIST.length;
for (const [key, src] of LOAD_LIST) {
  const im = new Image();
  im.onload = () => { if (++loaded === total) init(); };
  im.onerror = () => { console.error('failed to load', src); if (++loaded === total) init(); };
  im.src = src;
  IMG[key] = im;
}

/* ---------- audio (WebAudio, synthesized) ---------- */
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f0, f1, dur, type, vol) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq) {
  const ac = audio(); if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(ac.destination); s.start();
}
const SFX = {
  slice() { noise(0.09, 0.5, 2600); tone(900, 1600, 0.07, 'triangle', 0.12); },
  splat() { tone(280, 70, 0.14, 'triangle', 0.3); noise(0.08, 0.25, 500); },
  miss()  { tone(220, 90, 0.35, 'square', 0.22); },
  combo() { tone(660, 660, 0.09, 'sine', 0.25); setTimeout(() => tone(880, 880, 0.12, 'sine', 0.25), 90); },
  over()  { tone(440, 440, 0.18, 'sawtooth', 0.18); setTimeout(() => tone(330, 330, 0.18, 'sawtooth', 0.18), 180); setTimeout(() => tone(220, 110, 0.5, 'sawtooth', 0.2), 360); },
  start() { tone(440, 880, 0.15, 'sine', 0.25); },
};

/* ---------- state ---------- */
let state = 'menu';           // menu | play | over
let paused = false;
let now = 0;                  // global clock (s)
let runT = 0;                 // time within run
let score = 0, best = +(localStorage.getItem('ps_best') || 0), newBest = false;
let lives = 3;
let fruits = [], halves = [], splashes = [], popups = [];
let trail = [];
let spawnT = 0.8;
let flash = 0, shake = 0;
let heartLostAt = [ -9, -9, -9 ];
let overAt = 0;
const potato = { x: 0, targetX: 0, swingT: -1, facing: 1 };
const pointer = { x: 0, y: 0, down: false, lastT: 0 };
let combo = 0;

/* ---------- helpers ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function fruitDims(t) {
  const im = IMG['fruit_' + t.name];
  const ds = U; // sprites built ~190px tall
  return { w: im.width * ds, h: im.height * ds, r: Math.max(im.width, im.height) * ds * 0.44 };
}

/* ---------- spawning ---------- */
function spawnFruit() {
  const t = FRUIT_TYPES[(Math.random() * FRUIT_TYPES.length) | 0];
  const d = fruitDims(t);
  const x = rnd(0.14, 0.86) * W;
  const g = 1500 * U;
  const peak = rnd(0.62, 0.92) * H;
  fruits.push({
    type: t, x, y: H + d.h,
    vx: ((0.5 - x / W) * rnd(140, 320)) * U,
    vy: -Math.sqrt(2 * g * peak),
    rot: rnd(0, 6.28), vrot: rnd(-2.2, 2.2),
    r: d.r, w: d.w, h: d.h,
  });
}
function spawnWave() {
  const cap = Math.min(4, 1 + Math.floor(runT / 18));
  const n = 1 + Math.floor(Math.random() * cap);
  for (let i = 0; i < n; i++) setTimeout(function trySpawn() {
    if (state !== 'play') return;
    if (paused) { setTimeout(trySpawn, 150); return; }
    spawnFruit();
  }, i * rnd(60, 220));
}

/* ---------- slicing ---------- */
function doSlice(f, idx, dx, dy, speed) {
  fruits.splice(idx, 1);
  const nx = -dy, ny = dx; // perpendicular
  const pop = 260 * U;
  const carry = 0.22;
  halves.push({ img: IMG['halfL_' + f.type.name], x: f.x, y: f.y, vx: dx * speed * carry * 0.4 + nx * pop + rnd(-60, 60) * U, vy: dy * speed * carry * 0.4 + ny * pop - 220 * U, rot: f.rot, vrot: rnd(-6, -2) });
  halves.push({ img: IMG['halfR_' + f.type.name], x: f.x, y: f.y, vx: dx * speed * carry * 0.4 - nx * pop + rnd(-60, 60) * U, vy: dy * speed * carry * 0.4 - ny * pop - 220 * U, rot: f.rot, vrot: rnd(2, 6) });
  splashes.push({ type: f.type, x: f.x, y: f.y, t0: now, sc: rnd(0.9, 1.3) });
  score += 10; combo++;
  popups.push({ text: '+10', x: f.x, y: f.y - f.r, t0: now, color: '#fff', size: 30 });
  potato.swingT = 0;
  potato.facing = dx >= 0 ? 1 : -1;
  potato.targetX = clamp(pointer.x, 60 * U, W - 60 * U);
  SFX.slice(); SFX.splat();
}
function checkSlice(ax, ay, bx, by, dx, dy, speed) {
  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    if (segDist(f.x, f.y, ax, ay, bx, by) < f.r * 0.95) doSlice(f, i, dx, dy, speed);
  }
}
function missFruit(f) {
  lives--;
  heartLostAt[2 - lives] = now; // rightmost heart breaks first
  flash = 0.5; shake = 0.35;
  SFX.miss();
  if (lives <= 0) {
    state = 'over'; overAt = now;
    newBest = score > best;
    if (newBest) { best = score; localStorage.setItem('ps_best', best); }
    SFX.over();
  }
}

/* ---------- run control ---------- */
function startRun() {
  state = 'play'; paused = false;
  score = 0; lives = 3; runT = 0; spawnT = 0.6;
  fruits = []; halves = []; splashes = []; popups = []; trail = [];
  combo = 0; flash = 0; shake = 0; newBest = false;
  heartLostAt = [-9, -9, -9];
  potato.x = potato.targetX = W / 2; potato.swingT = -1; potato.facing = 1;
  SFX.start();
}

/* ---------- input ---------- */
function ptr(e) { return { x: e.clientX, y: e.clientY }; }
window.addEventListener('pointerdown', e => {
  audio();
  const p = ptr(e);
  pointer.x = p.x; pointer.y = p.y; pointer.down = true; pointer.lastT = performance.now();
  trail = [{ x: p.x, y: p.y, t: now }];
  if (state === 'menu') { startRun(); return; }
  if (state === 'over') { if (now - overAt > 0.7) startRun(); return; }
  if (paused) { paused = false; return; }
  // pause button hit?
  if (p.x > W - 70 * U && p.y < 70 * U) { paused = true; return; }
  combo = 0;
});
window.addEventListener('pointermove', e => {
  const p = ptr(e); const tms = performance.now();
  if (pointer.down && state === 'play' && !paused) {
    const dt = Math.max(8, tms - pointer.lastT) / 1000;
    const ddx = p.x - pointer.x, ddy = p.y - pointer.y;
    const dist = Math.hypot(ddx, ddy);
    trail.push({ x: p.x, y: p.y, t: now });
    if (trail.length > 40) trail.shift();
    const speed = dist / dt;
    if (dist > 2 && speed > 420 * U) checkSlice(pointer.x, pointer.y, p.x, p.y, ddx / dist, ddy / dist, Math.min(speed, 2600 * U));
    potato.targetX = clamp(p.x, 60 * U, W - 60 * U);
  }
  pointer.x = p.x; pointer.y = p.y; pointer.lastT = tms;
});
window.addEventListener('pointerup', () => {
  pointer.down = false;
  if (state === 'play' && combo >= 2) {
    const bonus = combo * 5;
    score += bonus;
    popups.push({ text: 'COMBO x' + combo + '  +' + bonus, x: pointer.x, y: pointer.y - 40, t0: now, color: '#ffd23e', size: 40 });
    SFX.combo();
  }
  combo = 0;
});
window.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') { if (state === 'play') paused = !paused; }
  if ((e.key === 'r' || e.key === 'R') && state === 'over') startRun();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') paused = true; });

/* ---------- update ---------- */
function update(dt) {
  now += dt;
  if (state !== 'play' || paused) return;
  runT += dt;
  flash = Math.max(0, flash - dt);
  shake = Math.max(0, shake - dt);

  // spawning ramps up forever (infinite mode)
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnWave();
    spawnT = Math.max(0.5, 1.5 - runT * 0.012);
  }

  const g = 1500 * U;
  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    f.vy += g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vrot * dt;
    if (f.x < -f.w) f.x = -f.w, f.vx = Math.abs(f.vx);
    if (f.x > W + f.w) f.x = W + f.w, f.vx = -Math.abs(f.vx);
    if (f.vy > 0 && f.y - f.r > H + 30) { fruits.splice(i, 1); missFruit(f); if (state !== 'play') return; }
  }
  for (let i = halves.length - 1; i >= 0; i--) {
    const h = halves[i];
    h.vy += g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vrot * dt;
    if (h.y > H + 200) halves.splice(i, 1);
  }
  for (let i = splashes.length - 1; i >= 0; i--) if (now - splashes[i].t0 > 0.35) splashes.splice(i, 1);
  for (let i = popups.length - 1; i >= 0; i--) if (now - popups[i].t0 > 0.9) popups.splice(i, 1);

  // potato
  potato.x += (potato.targetX - potato.x) * Math.min(1, dt * 12);
  if (potato.swingT >= 0) { potato.swingT += dt; if (potato.swingT > 0.34) potato.swingT = -1; }
}

/* ---------- draw ---------- */
function drawBg() {
  const im = IMG.bg;
  const s = Math.max(W / im.width, H / im.height);
  const dw = im.width * s, dh = im.height * s;
  ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
function drawFruit(f) {
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
  ctx.drawImage(IMG['fruit_' + f.type.name], -f.w / 2, -f.h / 2, f.w, f.h);
  ctx.restore();
}
function drawHalf(h) {
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
  ctx.drawImage(h.img, -h.img.width * U / 2, -h.img.height * U / 2, h.img.width * U, h.img.height * U);
  ctx.restore();
}
function drawSplash(s) {
  const im = IMG['splash_' + s.type.name];
  const fw = im.width / 5;
  const fr = Math.min(4, Math.floor((now - s.t0) / 0.07));
  const size = 170 * U * s.sc;
  ctx.drawImage(im, fr * fw, 0, fw, im.height, s.x - size / 2, s.y - size / 2, size, size);
}
function drawPotato() {
  const swinging = potato.swingT >= 0;
  const sheet = swinging ? IMG.swing : IMG.idle;
  const fw = sheet.width / 6, fh = sheet.height;
  const frame = swinging ? Math.min(5, Math.floor(potato.swingT / 0.055)) : Math.floor(now * 7) % 6;
  const bodyH = clamp(300 * U, 150, 340);
  const sc = bodyH / 360;
  const dw = fw * sc, dh = fh * sc;
  const feetY = H - 6;
  ctx.save();
  ctx.translate(potato.x, feetY);
  if (potato.facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(sheet, frame * fw, 0, fw, fh, -dw / 2, -(fh - 14) * sc, dw, dh);
  ctx.restore();
}
function drawTrail() {
  const keep = 0.14;
  while (trail.length && now - trail[0].t > keep) trail.shift();
  if (trail.length < 2 || !pointer.down) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const age = (now - b.t) / keep;
      const wdt = (1 - age) * (pass ? 7 : 16) * U + 2;
      ctx.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(255,190,60,0.4)';
      ctx.lineWidth = wdt;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.restore();
}
function cartoonText(txt, x, y, size, fill, align = 'center', strokeW = 8) {
  ctx.save();
  ctx.font = `900 ${size}px 'Arial Black','Comic Sans MS',sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#26221f'; ctx.lineWidth = strokeW;
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  ctx.restore();
}
function drawHeart(i) {
  const size = 58 * U;
  const x = W - (100 + i * 66) * U, y = 40 * U;
  const im = IMG.heartSheet, fw = im.width / 6, fh = im.height;
  const alive = i >= 3 - lives; // i=0 is rightmost; it breaks first
  let fr = alive ? 0 : 4;
  const lt = now - heartLostAt[i];
  if (!alive && lt >= 0 && lt < 0.45) fr = lt < 0.1 ? 1 : lt < 0.2 ? 2 : lt < 0.32 ? 3 : 4;
  ctx.drawImage(im, fr * fw, 0, fw, fh, x - size / 2, y - size / 2, size, size);
}
function drawHUD() {
  cartoonText('' + score, 26 * U, 42 * U, 46 * U, '#fff', 'left');
  cartoonText('BEST ' + best, 26 * U, 86 * U, 20 * U, '#ffe9b0', 'left', 5);
  for (let i = 0; i < 3; i++) drawHeart(i);
  // pause button
  ctx.save();
  const px = W - 40 * U, py = 40 * U, s = 15 * U;
  ctx.fillStyle = 'rgba(38,34,31,0.75)';
  ctx.beginPath(); ctx.roundRect(px - 26 * U, py - 26 * U, 52 * U, 52 * U, 12 * U); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(px - s * 0.7, py - s, s * 0.6, s * 2);
  ctx.fillRect(px + s * 0.1, py - s, s * 0.6, s * 2);
  ctx.restore();
}
function roundBtn(txt, cx, cy, w, h, fill) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = '#26221f'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10, (h - 10) / 2);
  ctx.fillStyle = fill; ctx.fill();
  cartoonText(txt, cx, cy + 2, h * 0.42, '#fff', 'center', 6);
  ctx.restore();
}
function drawLogo(w) {
  const im = IMG.logo;
  const hgt = w * im.height / im.width;
  const bob = Math.sin(now * 2) * 8 * U;
  ctx.save();
  ctx.translate(W / 2, H * 0.2 + bob);
  ctx.rotate(Math.sin(now * 1.3) * 0.02);
  ctx.drawImage(im, -w / 2, -hgt / 2, w, hgt);
  ctx.restore();
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 14, rnd(-1, 1) * shake * 14);
  drawBg();

  if (state === 'menu') {
    drawLogo(Math.min(W * 0.8, 640 * U));
    drawPotatoIdleCenter();
    cartoonText('SWIPE TO SLICE THE VEGGIES!', W / 2, H * 0.62, 26 * U, '#fff');
    cartoonText('Drop 3 and the potato cries. Endless mode!', W / 2, H * 0.67, 18 * U, '#ffe9b0', 'center', 5);
    roundBtn('TAP TO PLAY', W / 2, H * 0.78, 300 * U, 78 * U, '#ff8c2e');
    cartoonText('BEST ' + best, W / 2, H * 0.88, 22 * U, '#fff', 'center', 6);
    return;
  }

  for (const h of halves) drawHalf(h);
  for (const f of fruits) drawFruit(f);
  for (const s of splashes) drawSplash(s);
  drawPotato();
  drawTrail();
  for (const p of popups) {
    const age = (now - p.t0) / 0.9;
    ctx.globalAlpha = 1 - age;
    cartoonText(p.text, p.x, p.y - age * 70 * U, p.size * U, p.color, 'center', 6);
    ctx.globalAlpha = 1;
  }
  drawHUD();

  if (flash > 0) { ctx.fillStyle = `rgba(255,40,40,${flash * 0.4})`; ctx.fillRect(-30, -30, W + 60, H + 60); }

  if (paused && state === 'play') {
    ctx.fillStyle = 'rgba(30,20,10,0.55)'; ctx.fillRect(-30, -30, W + 60, H + 60);
    cartoonText('PAUSED', W / 2, H * 0.42, 60 * U, '#fff');
    roundBtn('TAP TO RESUME', W / 2, H * 0.56, 320 * U, 78 * U, '#7ab648');
  }
  if (state === 'over') {
    ctx.fillStyle = 'rgba(30,20,10,0.6)'; ctx.fillRect(-30, -30, W + 60, H + 60);
    drawLogo(Math.min(W * 0.6, 480 * U));
    cartoonText('GAME OVER', W / 2, H * 0.36, 56 * U, '#ff5a5a');
    cartoonText('SCORE ' + score, W / 2, H * 0.47, 40 * U, '#fff');
    cartoonText(newBest ? 'NEW BEST!' : 'BEST ' + best, W / 2, H * 0.55, 26 * U, newBest ? '#ffd23e' : '#ffe9b0');
    roundBtn('PLAY AGAIN', W / 2, H * 0.7, 320 * U, 80 * U, '#ff8c2e');
  }
}
function drawPotatoIdleCenter() {
  const savedX = potato.x, savedF = potato.facing, savedS = potato.swingT;
  potato.x = W / 2; potato.facing = 1; potato.swingT = -1;
  drawPotato();
  potato.x = savedX; potato.facing = savedF; potato.swingT = savedS;
}

/* ---------- main loop ---------- */
let lastT = performance.now();
function loop(t) {
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
function init() {
  potato.x = potato.targetX = W / 2;
  requestAnimationFrame(loop);
}
window.__PS = () => ({ state, score, lives, fruits: fruits.length, halves: halves.length, paused });
})();
