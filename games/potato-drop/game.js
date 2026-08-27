'use strict';
/* ============================================================
   POTATO DROP! v3 — a falling arcade game
   Steer your potato out of the plane, catch clouds, grab
   POWER-UPS, hit BOUNCERS, and land well. Then the plane comes
   back, picks him up, BLASTS off, and he falls AGAIN.
   ============================================================ */

// ---------- canvas ----------
const W = 720, H = 1280;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let dpr = 1, scale = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = Math.round(W * scale) + 'px';
  cv.style.height = Math.round(H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---------- helpers ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const fmt = n => Math.floor(n).toLocaleString('en-US');

function txt(s, x, y, size, fill, align, sw, sc) {
  ctx.font = '900 ' + size + 'px "Arial Rounded MT Bold","Trebuchet MS",Verdana,sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if (sw) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = sw;
    ctx.strokeStyle = sc || '#14213d';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
function rrPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rr(x, y, w, h, r, fill) { rrPath(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function bar(x, y, w, h, k, col) {
  rrPath(x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fill();
  rrPath(x, y, Math.max(h, w * clamp(k, 0, 1)), h, h / 2);
  ctx.fillStyle = col;
  ctx.fill();
  rrPath(x, y, w, h, h / 2);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
}
function drawSpr(img, cx, cy, w, rot) {
  const h = w * img.height / img.width;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function drawSprSh(img, cx, cy, w, rot) {
  const h = w * img.height / img.width;
  ctx.save();
  ctx.shadowColor = 'rgba(25,45,70,.25)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 9;
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function panel(x, y, w, h) {
  const r = 28;
  rr(x, y + 12, w, h, r, '#0e2a3f');
  rr(x, y, w, h, r, '#bfe6ff');
  rr(x + 12, y + 12, w - 24, h - 24, r - 10, '#fff6df');
  ctx.save();
  rrPath(x + 8, y + 6, w - 16, h * 0.35, r * 0.7);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(x, y, w, h * 0.5);
  ctx.restore();
  rrPath(x, y, w, h, r);
  ctx.lineWidth = 9; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
}
function drawButton(id, x, y, w, label) {
  const h = Math.round(w * 0.34);
  const r = h / 2;
  BTN[id] = { x: x - w / 2, y: y - h / 2, w, h };
  rr(x - w / 2, y - h / 2 + 10, w, h, r, '#c25e00');
  rr(x - w / 2, y - h / 2, w, h, r, '#ffd23f');
  ctx.save();
  rrPath(x - w / 2 + 10, y - h / 2 + 8, w - 20, h * 0.42, r * 0.6);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fillRect(x - w / 2, y - h / 2, w, h * 0.5);
  ctx.restore();
  rrPath(x - w / 2, y - h / 2, w, h, r);
  ctx.lineWidth = 10; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
  txt(label, x, y + 5, Math.round(h * 0.42), '#4a2500', 'center', 0);
}

// ---------- audio (tiny synth) ----------
let AC = null, master = null;
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.2;
      master.connect(AC.destination);
    } catch (e) { /* no audio */ }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f0, f1, dur, type, vol, delay) {
  const ac = audio(); if (!ac) return;
  type = type || 'sine'; vol = vol === undefined ? 1 : vol; delay = delay || 0;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noiseBurst(dur, vol, cut, delay) {
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + (delay || 0);
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut || 1200;
  const g = ac.createGain(); g.gain.value = vol || 0.5;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}
const SFX = {
  click() { tone(520, 760, 0.07, 'square', 0.5); },
  pop() { tone(320, 720, 0.12, 'sine', 0.9); },
  gold() { tone(620, 930, 0.09, 'sine', 0.8); tone(930, 1400, 0.14, 'sine', 0.8, 0.08); },
  boing() { tone(140, 520, 0.16, 'sine', 0.9); tone(520, 180, 0.18, 'sine', 0.7, 0.14); },
  land() { noiseBurst(0.16, 0.5, 500); tone(160, 70, 0.15, 'sine', 0.6); },
  crash() { noiseBurst(0.32, 0.9, 900); tone(220, 50, 0.3, 'sawtooth', 0.7); },
  splash() { noiseBurst(0.25, 0.6, 700); },
  whoosh() { noiseBurst(0.5, 0.8, 2600); tone(160, 900, 0.5, 'sine', 0.55); },
  rescue() { tone(392, 523, 0.12, 'triangle', 0.7); tone(523, 659, 0.12, 'triangle', 0.7, 0.1); tone(659, 784, 0.16, 'triangle', 0.7, 0.2); },
  shieldOn() { tone(400, 900, 0.14, 'sine', 0.8); tone(900, 1250, 0.1, 'sine', 0.6, 0.1); },
  over(good) {
    const notes = good ? [520, 660, 780, 1040] : [400, 320, 240, 180];
    notes.forEach((f, i) => tone(f, f * 0.99, 0.14, 'triangle', 0.7, i * 0.11));
  }
};

// ---------- sprites ----------
const SHEETS = {
  potatoIdle:  { src: 'assets/sheets/potato_idle.png',  cols: 4 },
  potatoFall:  { src: 'assets/sheets/potato_fall.png',  cols: 4 },
  potatoCatch: { src: 'assets/sheets/potato_catch.png', cols: 3 },
  cloud:       { src: 'assets/sheets/cloud.png',        cols: 2 },
  goldCloud:   { src: 'assets/sheets/gold_cloud.png',   cols: 2 },
  plane:       { src: 'assets/sheets/plane.png',        cols: 2 },
  trampoline:  { src: 'assets/sheets/trampoline.png',   cols: 3 },
  pad:         { src: 'assets/sheets/goldpad.png',      cols: 1 },
  spikes:      { src: 'assets/sheets/spikes.png',       cols: 1 },
  mud:         { src: 'assets/sheets/mudpit.png',       cols: 1 },
  puChili:     { src: 'assets/sheets/powerup_chili.png',    cols: 2 },
  puBalloon:   { src: 'assets/sheets/powerup_balloon.png',  cols: 2 },
  puShield:    { src: 'assets/sheets/powerup_shield.png',   cols: 2 },
  puMagnet:    { src: 'assets/sheets/powerup_magnet.png',   cols: 2 },
  puStar:      { src: 'assets/sheets/powerup_star.png',     cols: 2 },
  bcloud:      { src: 'assets/sheets/bounce_bcloud.png',    cols: 2 },
  mushroom:    { src: 'assets/sheets/bounce_mushroom.png',  cols: 2 },
  ball:        { src: 'assets/sheets/bounce_ball.png',      cols: 2 },
  rocket:      { src: 'assets/sheets/bounce_rocket.png',    cols: 2 }
};
let sprites = {};
function loadAll() {
  return new Promise(res => {
    const keys = Object.keys(SHEETS);
    let pending = keys.length;
    const done = () => { if (--pending <= 0) res(); };
    keys.forEach(k => {
      const s = SHEETS[k];
      const im = new Image();
      im.onload = () => {
        const fw = im.width / s.cols, fh = im.height;
        const frames = [];
        for (let i = 0; i < s.cols; i++) {
          const c = document.createElement('canvas');
          c.width = fw; c.height = fh;
          c.getContext('2d').drawImage(im, i * fw, 0, fw, fh, 0, 0, fw, fh);
          frames.push(c);
        }
        sprites[k] = { frames, fw, fh };
        done();
      };
      im.onerror = done;
      im.src = s.src;
    });
  });
}

// ---------- power-up definitions ----------
const POWERUP_TYPES = ['chili', 'balloon', 'shield', 'magnet', 'star'];
const POWERUP_SPR = { chili: 'puChili', balloon: 'puBalloon', shield: 'puShield', magnet: 'puMagnet', star: 'puStar' };
const POWERUP_INFO = {
  chili:  { label: 'SPICY SPEED!  2x', col: '#ff6b4a', glow: 'rgba(255,107,74,' },
  balloon: { label: 'LIFTOFF!', col: '#ff7bac', glow: 'rgba(255,123,172,' },
  shield: { label: 'SHIELDED!', col: '#5ac8ff', glow: 'rgba(90,200,255,' },
  magnet: { label: 'CLOUD MAGNET!', col: '#ff9d3c', glow: 'rgba(255,157,60,' },
  star:   { label: 'LUCKY STAR!', col: '#ffd34d', glow: 'rgba(255,211,77,' }
};
// ---------- bouncer definitions (they launch the potato upward) ----------
const BOUNCER_TYPES = ['bcloud', 'ball', 'mushroom', 'rocket'];
const BOUNCER_SPR = { bcloud: 'bcloud', ball: 'ball', mushroom: 'mushroom', rocket: 'rocket' };
const BOUNCER_INFO = {
  bcloud:   { label: 'BOUNCY CLOUD!',   col: '#ff9ec4', glow: 'rgba(255,158,196,', vy: -780 },
  ball:     { label: 'BOING BALL!',     col: '#ff5a5f', glow: 'rgba(255,90,95,',   vy: -1080 },
  mushroom: { label: 'SPROING SHROOM!', col: '#ff6b6b', glow: 'rgba(255,107,107,', vy: -1380 },
  rocket:   { label: 'ROCKET BLAST!',   col: '#ffb347', glow: 'rgba(255,179,71,',  vy: -1850 }
};

// ---------- state ----------
const S = { MENU: 0, DROP: 1, FALL: 2, RESCUE: 3, OVER: 4 };
const GROUND_TOP = 8600, START_Y = 170, POT_R = 62;
const RESCUES_MAX = 2;
let state = S.MENU;
let t = 0;
let potato, clouds, items, particles, popups;
let camY = 0, shake = 0, score = 0, mult = 1, maxMult = 1, meters = 0, caught = 0, bounces = 0;
let planeX, dropTimer, runTime, cloudSpawnT;
let featherT, catchAnimT, flashT, flashCol, multPulse, overT, newBest;
// v2: power-ups + effects
let powerups = [];
let powerupT = 4;
let powerupsUsed = 0;
let fxSpeed = 0, fxMagnet = 0, fxShield = 0;
// v3: bouncers + rescue
let bouncers = [];
let bouncerT = 3;
let bouncersHit = 0;
let rescuesUsed = 0, landingsCount = 0;
let rescuePhase = 'approach', rescueT = 0;
let resPlane = { x: -300, y: 0 };
let planeFlyOff = false, planeFlyT = 0;
let landingInfo = null;
let best = 0;
try { best = +(localStorage.getItem('potatoDropBest') || 0); } catch (e) {}
let paused = false;
// depth layers
let bgFar = [], bgMid = [], bgNear = [];
let lastCamY = 0;
let BTN = {};
let spritesReady = false;

function initBg() {
  bgFar = []; bgMid = []; bgNear = [];
  for (let i = 0; i < 7; i++) bgFar.push({ x: rand(0, W), y: rand(-100, H + 200), s: rand(0.35, 0.6), ph: rand(0, TAU) });
  for (let i = 0; i < 6; i++) bgMid.push({ x: rand(0, W), y: rand(-100, H + 200), s: rand(0.6, 0.9), ph: rand(0, TAU) });
  for (let i = 0; i < 4; i++) bgNear.push({ x: rand(0, W), y: rand(-100, H + 200), s: rand(1.5, 2.1), ph: rand(0, TAU) });
}
function scrollBg(dt, camDelta) {
  const scroll = (arr, f) => {
    for (const p of arr) {
      p.y -= camDelta * f;
      p.x -= 10 * f * dt;
      if (p.y < -240) { p.y = H + rand(60, 220); p.x = rand(0, W); }
      if (p.x < -220) p.x = W + 220;
    }
  };
  scroll(bgFar, 0.18);
  scroll(bgMid, 0.42);
  scroll(bgNear, 1.35);
}

function makeItems() {
  const slots = 7;
  const types = ['pad', 'tramp', 'mud', 'spikes', 'none'];
  const weights = [0.24, 0.26, 0.2, 0.2, 0.1];
  const arr = [];
  for (let i = 0; i < slots; i++) {
    let r = Math.random(), acc = 0, pick = 'none';
    for (let j = 0; j < types.length; j++) {
      acc += weights[j];
      if (r <= acc) { pick = types[j]; break; }
    }
    arr.push({ type: pick, x: (i + 0.5) * (W / slots), squash: 0 });
  }
  if (!arr.some(a => a.type === 'pad')) arr[1].type = 'pad';
  if (!arr.some(a => a.type === 'tramp')) arr[3].type = 'tramp';
  return arr;
}

function spawnCloud(worldY) {
  const gold = Math.random() < 0.18;
  clouds.push({ x: rand(70, W - 70), y: worldY, gold, ph: rand(0, TAU), dead: false, vx: rand(-18, 18) });
}
function spawnPowerup(worldY) {
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({ x: rand(120, W - 120), y: worldY === undefined ? camY - 120 : worldY, type, ph: rand(0, TAU), dead: false });
}
function spawnBouncer(worldY) {
  const type = BOUNCER_TYPES[Math.floor(Math.random() * BOUNCER_TYPES.length)];
  bouncers.push({ x: rand(110, W - 110), y: worldY === undefined ? camY - 130 : worldY, type, ph: rand(0, TAU), dead: false });
}

function newRun() {
  potato = { x: W / 2, y: START_Y, vx: 0, vy: 140, tilt: 0, squashT: 0 };
  clouds = []; particles = []; popups = [];
  camY = 0; lastCamY = 0; shake = 0; score = 0; mult = 1; maxMult = 1;
  meters = 0; caught = 0; bounces = 0;
  planeX = -300; dropTimer = 0; runTime = 0;
  cloudSpawnT = 0.4; featherT = 0; catchAnimT = 0;
  flashT = 0; flashCol = 'rgba(255,255,255,'; multPulse = 0;
  overT = 0; newBest = false; landingInfo = null;
  // power-ups + effects
  powerups = []; powerupT = 3.5; powerupsUsed = 0;
  fxSpeed = 0; fxMagnet = 0; fxShield = 0;
  // v3: bouncers + rescue
  bouncers = []; bouncerT = 3; bouncersHit = 0;
  rescuesUsed = 0; landingsCount = 0;
  rescuePhase = 'approach'; rescueT = 0;
  resPlane = { x: -300, y: 0 };
  planeFlyOff = false; planeFlyT = 0;
  paused = false;
  items = makeItems();
  // long fall → lots of sky content
  for (let i = 0; i < 14; i++) spawnCloud(rand(START_Y + 250, GROUND_TOP - 900));
  for (let i = 0; i < 6; i++) spawnBouncer(rand(START_Y + 700, GROUND_TOP - 1200));
  for (let i = 0; i < 3; i++) spawnPowerup(rand(START_Y + 900, GROUND_TOP - 1400));
  state = S.DROP;
}

// ---------- input ----------
const keys = { left: false, right: false };
const pointer = { down: false, x: W / 2 };
function steerDir() {
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  if (pointer.down) {
    const d = pointer.x - potato.x;
    if (Math.abs(d) > 16) dir = clamp(d / 70, -1, 1);
  }
  return dir;
}
window.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
  else if (k === ' ' || k === 'p' || k === 'P' || k === 'Escape') { togglePause(); }
  else if (k === 'r' || k === 'R') { if (state !== S.MENU) { SFX.click(); newRun(); } }
  else if (k === 'Enter') { if (state === S.MENU || state === S.OVER) { SFX.click(); newRun(); } }
  audio();
});
window.addEventListener('keyup', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
});
function togglePause() {
  if (state === S.FALL || state === S.DROP) { paused = !paused; SFX.click(); }
}
function toGame(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}
function hit(id, x, y) {
  const b = BTN[id];
  return !!(b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}
cv.addEventListener('pointerdown', e => {
  audio();
  const p = toGame(e);
  if (state === S.MENU) {
    if (hit('play', p.x, p.y)) { SFX.click(); newRun(); }
    return;
  }
  if (state === S.OVER) {
    if (overT > 0.4 && hit('again', p.x, p.y)) { SFX.click(); newRun(); }
    return;
  }
  if (hit('pause', p.x, p.y)) { togglePause(); return; }
  pointer.down = true;
  pointer.x = p.x;
});
cv.addEventListener('pointermove', e => { if (pointer.down) pointer.x = toGame(e).x; });
window.addEventListener('pointerup', () => { pointer.down = false; });

// ---------- fx ----------
function burst(x, y, kind) {
  const cols = {
    white: ['#ffffff', '#dff3ff'],
    gold: ['#ffd34d', '#fff3c4'],
    red: ['#ff6b6b', '#ffb3b3'],
    blue: ['#7fd4ff', '#dff3ff']
  };
  const cs = cols[kind] || cols.white;
  for (let i = 0; i < 14; i++) {
    const a = rand(0, TAU), s = rand(80, 320);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.3, 0.7), max: 0.7, size: rand(6, 14), color: cs[i % 2], grav: 300 });
  }
  particles.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 10, color: '#ffffff', grav: 0, ring: true });
}
function confetti(x, y) {
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: x + rand(-170, 170), y: y + rand(-40, 20),
      vx: rand(-120, 120), vy: rand(-520, -150),
      life: rand(0.8, 1.6), max: 1.6, size: rand(6, 12),
      color: ['#ffd34d', '#7fd4ff', '#ff8fa3', '#9dff8a'][i % 4],
      grav: 700, rot: rand(0, TAU), vr: rand(-8, 8), rect: true
    });
  }
}
function spawnFlame(x, y) {
  particles.push({
    x: x + rand(-26, 26), y,
    vx: rand(-60, 60), vy: rand(140, 340),
    life: rand(0.25, 0.45), max: 0.45, size: rand(10, 20),
    color: Math.random() < 0.5 ? '#ffb347' : '#ff6b4a', grav: 220
  });
}
function mudSplash(x) {
  for (let i = 0; i < 16; i++) {
    particles.push({
      x: x + rand(-45, 45), y: GROUND_TOP - 8,
      vx: rand(-160, 160), vy: rand(-560, -200),
      life: rand(0.4, 0.8), max: 0.8, size: rand(5, 12),
      color: i % 2 ? '#7a4a26' : '#5d3a1e', grav: 900
    });
  }
}
function dust(x) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x + rand(-55, 55), y: GROUND_TOP - 6,
      vx: rand(-120, 120), vy: rand(-130, -20),
      life: rand(0.3, 0.6), max: 0.6, size: rand(6, 14), color: '#d8c9a8', grav: -60
    });
  }
}
function addPopup(x, y, s, color) { popups.push({ x, y, s, color, life: 1.1 }); }
function updateFx(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
    p.life -= dt;
    if (p.vr !== undefined) p.rot += p.vr * dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 45 * dt; p.life -= dt; }
  popups = popups.filter(p => p.life > 0);
}

// ---------- catching (clouds / power-ups / bouncers) ----------
function processCatches(dt) {
  // clouds
  for (const c of clouds) {
    c.x += c.vx * dt;
    if (c.x < 60 || c.x > W - 60) c.vx *= -1;
    if (fxMagnet > 0 && !c.dead) {
      const dx = potato.x - c.x, dy = potato.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 90000 && d2 > 400) {
        const d = Math.sqrt(d2);
        c.x += (dx / d) * 340 * dt;
        c.y += (dy / d) * 340 * dt;
      }
    }
    if (!c.dead && Math.abs(c.x - potato.x) < 95 && Math.abs(c.y - potato.y) < 85) {
      c.dead = true;
      caught++;
      if (c.gold) {
        mult = Math.min(10, mult + 2);
        score += 150 * mult;
        SFX.gold();
        addPopup(c.x, c.y - 45, 'GOLD! x' + mult, '#ffd34d');
        burst(c.x, c.y, 'gold');
      } else {
        mult = Math.min(10, mult + 1);
        score += 50 * mult;
        SFX.pop();
        addPopup(c.x, c.y - 45, 'x' + mult, '#ffffff');
        burst(c.x, c.y, 'white');
      }
      maxMult = Math.max(maxMult, mult);
      featherT = 0.55;
      catchAnimT = 0.4;
      multPulse = 1.4;
    }
  }
  clouds = clouds.filter(c => !c.dead && c.y > camY - 500 && c.y < camY + H + 500);

  // power-ups
  for (const p of powerups) {
    p.x += Math.sin(p.ph + t * 1.6) * 26 * dt;
    if (fxMagnet > 0 && !p.dead) {
      const dx = potato.x - p.x, dy = potato.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 49000 && d2 > 400) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * 260 * dt;
        p.y += (dy / d) * 260 * dt;
      }
    }
    if (!p.dead && Math.abs(p.x - potato.x) < 92 && Math.abs(p.y - potato.y) < 88) {
      p.dead = true;
      powerupsUsed++;
      const info = POWERUP_INFO[p.type];
      if (p.type === 'chili') {
        fxSpeed = 3.2; SFX.whoosh();
        addPopup(p.x, p.y - 50, info.label, info.col);
        burst(p.x, p.y, 'gold'); flashT = 0.15; flashCol = 'rgba(255,110,60,';
      } else if (p.type === 'balloon') {
        potato.vy = -Math.min(1250, Math.max(320, (potato.y - 350) * 1.6));
        SFX.boing(); addPopup(p.x, p.y - 50, info.label, info.col); burst(p.x, p.y, 'blue'); shake = 10;
      } else if (p.type === 'shield') {
        fxShield = 1; SFX.shieldOn(); addPopup(p.x, p.y - 50, info.label, info.col); burst(p.x, p.y, 'blue');
      } else if (p.type === 'magnet') {
        fxMagnet = 6; SFX.gold(); addPopup(p.x, p.y - 50, info.label, info.col); burst(p.x, p.y, 'white');
      } else {
        mult = Math.min(10, mult + 1); maxMult = Math.max(maxMult, mult); score += 300 * mult;
        SFX.gold(); addPopup(p.x, p.y - 50, info.label + ' +' + fmt(300 * mult), info.col); confetti(p.x, p.y);
      }
    }
  }
  powerups = powerups.filter(p => !p.dead && p.y > camY - 500 && p.y < camY + H + 500);

  // bouncers (launch the potato upward)
  for (const b of bouncers) {
    b.x += Math.sin(b.ph + t * 1.4) * 22 * dt;
    if (b.x < 90 || b.x > W - 90) b.ph += Math.PI;
    if (!b.dead && Math.abs(b.x - potato.x) < 92 && Math.abs(b.y - potato.y) < 90) {
      b.dead = true;
      bouncersHit++;
      const info = BOUNCER_INFO[b.type];
      potato.vy = info.vy;
      potato.squashT = 0.35;
      score += 40 * mult;
      SFX.boing();
      shake = 12;
      addPopup(b.x, b.y - 50, info.label, info.col);
      burst(b.x, b.y, 'white');
      if (b.type === 'rocket') fxSpeed = Math.max(fxSpeed, 1.6);
    }
  }
  bouncers = bouncers.filter(b => !b.dead && b.y > camY - 500 && b.y < camY + H + 500);
}
function updateSpawns(dt) {
  cloudSpawnT -= dt;
  if (cloudSpawnT <= 0) {
    spawnCloud(camY - 80);
    if (Math.random() < 0.35) spawnCloud(camY - rand(120, 320));
    const base = lerp(1.15, 0.6, clamp(runTime / 30, 0, 1));
    cloudSpawnT = base * rand(0.8, 1.3);
  }
  powerupT -= dt;
  if (powerupT <= 0) { spawnPowerup(); powerupT = rand(6.5, 10); }
  bouncerT -= dt;
  if (bouncerT <= 0) { spawnBouncer(); bouncerT = rand(4.5, 6.5); }
}

// ---------- landing ----------
function land() {
  potato.y = GROUND_TOP - POT_R * 0.9;
  potato.vy = 0;
  const slotW = W / 7;
  const it = items.find(i => Math.abs(i.x - potato.x) < slotW * 0.5);
  const type = it ? it.type : 'none';
  let label = 'THE GROUND', bonus = 50 * mult, good = false;

  // trampoline bounce (max 3) — stays in this fall
  if (type === 'tramp' && bounces < 3) {
    bounces++;
    it.squash = 1;
    score += 150 * mult;
    potato.vy = -1150;
    potato.y = GROUND_TOP - 8;
    potato.squashT = 0.3;
    SFX.boing();
    shake = 14;
    flashT = 0.12; flashCol = 'rgba(255,255,255,';
    addPopup(potato.x, potato.y - 130, 'BOUNCE! x' + bounces, '#7fd4ff');
    burst(potato.x, potato.y + 40, 'blue');
    return;
  }

  if (type === 'pad') {
    bonus = 400 * mult; label = 'GOLD PAD!'; good = true;
    SFX.gold(); confetti(potato.x, potato.y - 260); shake = 8;
  } else if (type === 'mud') {
    bonus = 100 * mult; label = 'SOFT MUD'; good = true;
    SFX.splash(); mudSplash(potato.x);
  } else if (type === 'spikes') {
    if (fxShield > 0) {
      fxShield = 0;
      bonus = 100 * mult; label = 'SHIELDED! SAFE'; good = true;
      SFX.shieldOn(); burst(potato.x, potato.y + 20, 'blue');
      addPopup(potato.x, potato.y - 130, 'SHIELD SAVED YOU!', '#5ac8ff');
    } else {
      bonus = -300; label = 'SPIKES! OUCH!';
      mult = Math.max(1, Math.floor(mult / 2));
      SFX.crash(); shake = 22; flashT = 0.25; flashCol = 'rgba(255,80,80,';
      burst(potato.x, potato.y + 20, 'red');
    }
  } else if (type === 'tramp') {
    bonus = 50 * mult; label = 'WEARY TRAMPOLINE';
    SFX.land(); dust(potato.x);
  } else {
    SFX.land(); dust(potato.x);
  }

  score = Math.max(0, score + bonus);
  landingsCount++;

  // v3: plane comes back for a rescue (if any left) → fly up & fall again
  if (rescuesUsed < RESCUES_MAX) {
    startRescue(label, bonus, good);
    return;
  }

  // final landing → game over
  landingInfo = {
    label, bonus, good, finalScore: score, maxMult, caught, meters, bounces,
    powerups: powerupsUsed, bouncers: bouncersHit, rescues: rescuesUsed, landings: landingsCount
  };
  state = S.OVER;
  overT = 0;
  const sc = Math.floor(score);
  newBest = sc > best;
  if (newBest) {
    best = sc;
    try { localStorage.setItem('potatoDropBest', String(best)); } catch (e) {}
  }
  SFX.over(good);
  if (good) confetti(W / 2, potato.y - 320);
}
function startRescue(label, bonus, good) {
  rescuePhase = 'approach';
  rescueT = 0;
  rescuesUsed++; // commit a rescue (HUD pips update immediately)
  resPlane.x = -320;
  resPlane.y = GROUND_TOP - 40;
  potato.vy = 0; potato.vx = 0;
  SFX.rescue();
  addPopup(potato.x, potato.y - 140, 'RESCUE INCOMING!', '#7fd4ff');
  state = S.RESCUE;
}

// ---------- update ----------
function update(dt) {
  t += dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 34);
  if (flashT > 0) flashT -= dt;
  if (multPulse > 0) multPulse -= dt;
  if (catchAnimT > 0) catchAnimT -= dt;
  if (potato && potato.squashT > 0) potato.squashT = Math.max(0, potato.squashT - dt);

  if (state === S.MENU) { scrollBg(dt, 30 * dt); return; }
  if (state === S.OVER) { overT += dt; updateFx(dt); return; }
  if (paused) return;

  if (state === S.DROP) {
    planeX += 330 * dt;
    dropTimer += dt;
    scrollBg(dt, 0);
    if (dropTimer > 1.1) {
      state = S.FALL;
      potato.x = clamp(planeX + 30, 90, W - 90);
      potato.y = 250;
      addPopup(potato.x, potato.y - 110, 'WHEEE!', '#ffffff');
    }
    return;
  }

  if (state === S.RESCUE) {
    rescueT += dt;
    const groundY = GROUND_TOP - 40;
    if (rescuePhase === 'approach') {
      const targetX = potato.x - 165;
      resPlane.x = lerp(resPlane.x, targetX, 1 - Math.pow(0.03, dt));
      resPlane.y = groundY + Math.sin(t * 3) * 4;
      if (rescueT > 1.0) { rescuePhase = 'pickup'; rescueT = 0; }
    } else if (rescuePhase === 'pickup') {
      resPlane.x = potato.x - 165;
      resPlane.y = groundY - 12 + Math.sin(t * 4) * 3;
      potato.squashT = Math.max(potato.squashT, 0.18);
      if (rescueT > 0.6) {
        rescuePhase = 'blast'; rescueT = 0;
        SFX.whoosh(); shake = 18; flashT = 0.16; flashCol = 'rgba(255,190,120,';
        addPopup(potato.x, potato.y - 150, 'BLAST OFF!', '#ffb347');
      }
    } else if (rescuePhase === 'blast') {
      resPlane.x = lerp(resPlane.x, potato.x - 20, 1 - Math.pow(0.005, dt));
      resPlane.y = groundY - 30;
      if (Math.random() < 0.9) spawnFlame(resPlane.x, resPlane.y + 70);
      if (rescueT > 0.5) { rescuePhase = 'fly'; rescueT = 0; }
    } else if (rescuePhase === 'fly') {
      // carried upward, player can steer + catch things on the climb
      const carryV = 1500;
      potato.y -= carryV * dt;
      const dir = steerDir();
      potato.vx += dir * 2800 * dt;
      potato.vx = clamp(potato.vx, -640, 640);
      if (dir === 0) potato.vx *= Math.pow(0.002, dt);
      potato.x = clamp(potato.x + potato.vx * dt, 70, W - 70);
      potato.tilt = lerp(potato.tilt, clamp(potato.vx / 640, -1, 1) * 0.5, 1 - Math.pow(0.002, dt));
      resPlane.x = lerp(resPlane.x, potato.x - 20, 1 - Math.pow(0.002, dt));
      resPlane.y = potato.y + 120;
      if (Math.random() < 0.9) spawnFlame(resPlane.x, resPlane.y + 70);
      camY = Math.max(0, potato.y - 450);
      scrollBg(dt, camY - lastCamY); lastCamY = camY;
      if (fxSpeed > 0) fxSpeed -= dt;
      if (fxMagnet > 0) fxMagnet -= dt;
      processCatches(dt);
      updateSpawns(dt);
      // release near the top
      if (potato.y <= 340) {
        state = S.FALL;
        potato.vy = 60; potato.vx = 0;
        planeFlyOff = true; planeFlyT = 0;
        SFX.pop();
        addPopup(potato.x, potato.y + 60, 'GO GO GO!', '#ffd34d');
      }
    }
    updateFx(dt);
    return;
  }

  if (state !== S.FALL) return;

  runTime += dt;

  // steering
  const dir = steerDir();
  potato.vx += dir * 2800 * dt;
  potato.vx = clamp(potato.vx, -640, 640);
  if (dir === 0) potato.vx *= Math.pow(0.002, dt);
  potato.x += potato.vx * dt;
  if (potato.x < 70) { potato.x = 70; potato.vx *= -0.3; }
  if (potato.x > W - 70) { potato.x = W - 70; potato.vx *= -0.3; }
  potato.tilt = lerp(potato.tilt, clamp(potato.vx / 640, -1, 1) * 0.55, 1 - Math.pow(0.002, dt));

  // effect timers
  if (fxSpeed > 0) fxSpeed -= dt;
  if (fxMagnet > 0) fxMagnet -= dt;
  const speedy = fxSpeed > 0;

  // gravity + feather + spicy speed
  if (featherT > 0) featherT -= dt;
  potato.vy += (featherT > 0 ? 150 : speedy ? 1150 : 720) * dt;
  potato.vy = Math.min(potato.vy, featherT > 0 ? 380 : speedy ? 2300 : 1500);
  potato.y += potato.vy * dt;

  // spicy flame trail
  if (speedy && potato.vy > 0 && Math.random() < 0.6) {
    particles.push({
      x: potato.x + rand(-26, 26), y: potato.y - 95,
      vx: rand(-40, 40), vy: rand(-380, -260),
      life: rand(0.2, 0.4), max: 0.4, size: rand(9, 16),
      color: Math.random() < 0.5 ? '#ffb36b' : '#ff6b4a', grav: -200
    });
  }

  // meters + score (2x while spicy)
  const m = (potato.y - START_Y) / 50;
  if (m > meters) meters = m;
  if (potato.vy > 0) score += (potato.vy / 50) * 10 * mult * (speedy ? 2 : 1) * dt;

  // spawning + catching
  updateSpawns(dt);
  processCatches(dt);

  // rescue plane flying off after release
  if (planeFlyOff) {
    planeFlyT += dt;
    resPlane.x += 700 * dt;
    resPlane.y -= 950 * dt;
    if (Math.random() < 0.9) spawnFlame(resPlane.x, resPlane.y + 70);
    if (resPlane.y < camY - 400 || resPlane.x > W + 500) planeFlyOff = false;
  }

  // trampoline squash decay
  for (const it of items) it.squash = Math.max(0, it.squash - dt * 3);

  // camera
  camY = Math.max(0, potato.y - 450);
  scrollBg(dt, camY - lastCamY);
  lastCamY = camY;

  // landing?
  if (potato.vy > 0 && potato.y + POT_R * 0.9 >= GROUND_TOP) land();

  updateFx(dt);
}

// ---------- drawing ----------
function drawPuff(x, y, s, col) {
  ctx.fillStyle = col || 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.arc(x, y, 26 * s, 0, TAU);
  ctx.arc(x + 30 * s, y + 6 * s, 20 * s, 0, TAU);
  ctx.arc(x - 30 * s, y + 8 * s, 18 * s, 0, TAU);
  ctx.fill();
}
function drawHillLayer(baseY, color, amp, period, off) {
  if (baseY > H + 340) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, H + 40);
  for (let x = -20; x <= W + 20; x += 12) {
    const y = baseY + Math.sin((x + off) / period * TAU) * amp
      + Math.sin((x + off) / (period * 0.37) * TAU) * amp * 0.35;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 20, H + 40);
  ctx.closePath();
  ctx.fill();
}
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6fc4f2');
  g.addColorStop(0.55, '#a8e2ff');
  g.addColorStop(1, '#e8f9ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sx0 = W - 120, sy0 = 140;
  const rg = ctx.createRadialGradient(sx0, sy0, 20, sx0, sy0, 260);
  rg.addColorStop(0, 'rgba(255,244,200,.55)');
  rg.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(sx0 - 260, sy0 - 260, 520, 520);
  ctx.save();
  ctx.translate(sx0, sy0);
  ctx.rotate(t * 0.06);
  ctx.fillStyle = 'rgba(255,246,205,.16)';
  for (let i = 0; i < 8; i++) {
    ctx.rotate(TAU / 8);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 300, -0.14, 0.14); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,240,180,.95)';
  ctx.beginPath(); ctx.arc(sx0, sy0, 56, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,225,.95)';
  ctx.beginPath(); ctx.arc(sx0 - 12, sy0 - 12, 34, 0, TAU); ctx.fill();
  const p = state === S.MENU ? 0.8 : clamp(camY / (GROUND_TOP - H), 0, 1);
  drawHillLayer(lerp(H + 320, 430, p * 0.82), 'rgba(148,205,233,.6)', 42, 300, 40);
  drawHillLayer(lerp(H + 320, 300, p), 'rgba(116,188,222,.65)', 56, 240, 120);
  for (const c of bgFar) drawPuff(c.x, c.y, c.s * 0.8, 'rgba(255,255,255,.4)');
  for (const c of bgMid) drawPuff(c.x, c.y, c.s, 'rgba(255,255,255,.7)');
  if (state === S.FALL && potato && (potato.vy > 900 || fxSpeed > 0)) {
    const speedy = fxSpeed > 0;
    const n = speedy ? 14 : 9;
    ctx.strokeStyle = speedy ? 'rgba(255,140,90,.6)' : 'rgba(255,255,255,.45)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const lx = ((i * 97) % (W - 60)) + 30;
      const len = 60 + potato.vy * (speedy ? 0.07 : 0.05);
      const ly = ((t * potato.vy * 0.55 + i * 173) % (H + 200)) - 100;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + len); ctx.stroke();
    }
  }
}
function drawGround(gy) {
  const dg = ctx.createLinearGradient(0, gy, 0, gy + 420);
  dg.addColorStop(0, '#96683e');
  dg.addColorStop(1, '#6d4526');
  ctx.fillStyle = dg;
  ctx.fillRect(-20, gy, W + 40, H + 400);
  for (let i = 0; i < 40; i++) {
    const sx = (i * 173 + 40) % W;
    const sy = gy + 45 + (i * 97) % 300;
    ctx.fillStyle = i % 2 ? '#7a4c29' : '#9a6b3f';
    ctx.beginPath(); ctx.arc(sx, sy, 5 + (i % 4) * 2, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#5cbf4a';
  ctx.fillRect(-20, gy - 26, W + 40, 30);
  ctx.fillStyle = 'rgba(40,120,30,.45)';
  ctx.fillRect(-20, gy - 2, W + 40, 6);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-20, gy - 26); ctx.lineTo(W + 20, gy - 26); ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const gx = (i * 137 + 60) % W;
    ctx.strokeStyle = '#3f9e33';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(gx, gy - 24); ctx.lineTo(gx - 6, gy - 40);
    ctx.moveTo(gx, gy - 24); ctx.lineTo(gx + 2, gy - 44);
    ctx.moveTo(gx, gy - 24); ctx.lineTo(gx + 8, gy - 38);
    ctx.stroke();
  }
}
function itemShadow(it, top, rx) {
  ctx.fillStyle = 'rgba(20,35,50,.16)';
  ctx.beginPath();
  ctx.ellipse(it.x, top + 5, rx, 11, 0, 0, TAU);
  ctx.fill();
}
function drawItem(it, gy) {
  const top = gy - 26;
  if (it.type === 'pad') {
    itemShadow(it, top, 78);
    drawSpr(sprites.pad.frames[0], it.x, top - 52, 150);
  } else if (it.type === 'tramp') {
    itemShadow(it, top, 84);
    const sq = it.squash || 0;
    const fi = sq > 0.6 ? 1 : sq > 0.25 ? 2 : 0;
    drawSpr(sprites.trampoline.frames[fi], it.x, top - 46, 158);
  } else if (it.type === 'mud') {
    drawSpr(sprites.mud.frames[0], it.x, top - 16, 140);
  } else if (it.type === 'spikes') {
    itemShadow(it, top, 66);
    drawSpr(sprites.spikes.frames[0], it.x, top - 40, 125);
  }
}
function drawParticle(p) {
  ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
  if (p.ring) {
    const k = 1 - p.life / p.max;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size + k * 70, 0, TAU);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 6 * (p.life / p.max) + 1;
    ctx.stroke();
  } else if (p.rect) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size * (p.life / p.max)), 0, TAU);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function glowRing(x, y, info, ph) {
  ctx.beginPath();
  ctx.arc(x, y, 56 + Math.sin(t * 4 + ph) * 5, 0, TAU);
  ctx.strokeStyle = info.glow + '0.5)';
  ctx.lineWidth = 5;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -t * 60;
  ctx.stroke();
  ctx.setLineDash([]);
}
function drawWorld() {
  const gy = GROUND_TOP;
  if (gy - camY < H + 100) {
    drawGround(gy);
    for (const it of items) drawItem(it, gy);
  }
  for (const c of clouds) {
    const spr = c.gold ? sprites.goldCloud : sprites.cloud;
    const fi = Math.floor(t * 6 + c.ph) % spr.frames.length;
    const bob = Math.sin(c.ph + t * 2) * 5;
    drawSprSh(spr.frames[fi], c.x, c.y + bob, c.gold ? 150 : 132);
  }
  // bouncers
  for (const b of bouncers) {
    const spr = sprites[BOUNCER_SPR[b.type]];
    const fi = Math.floor(t * 7 + b.ph) % 2;
    const bob = Math.sin(b.ph + t * 2.5) * 6;
    const py = b.y + bob;
    glowRing(b.x, py, BOUNCER_INFO[b.type], b.ph);
    drawSprSh(spr.frames[fi], b.x, py, 96);
  }
  // power-ups
  for (const p of powerups) {
    const spr = sprites[POWERUP_SPR[p.type]];
    const fi = Math.floor(t * 6 + p.ph) % 2;
    const bob = Math.sin(p.ph + t * 2.5) * 6;
    const py = p.y + bob;
    glowRing(p.x, py, POWERUP_INFO[p.type], p.ph);
    drawSprSh(spr.frames[fi], p.x, py, 92);
  }
  for (const p of particles) drawParticle(p);
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    txt(p.s, p.x, p.y, 34, p.color, 'center', 8, '#111');
    ctx.globalAlpha = 1;
  }
  // rescue plane (behind potato)
  if (state === S.RESCUE || (planeFlyOff && state === S.FALL)) {
    const fi = Math.floor(t * 9) % 2;
    const rot = state === S.RESCUE && rescuePhase === 'fly' ? -0.18 : Math.sin(t * 2.4) * 0.03;
    drawSprSh(sprites.plane.frames[fi], resPlane.x, resPlane.y, 280, rot);
  }
  // drop plane
  if (state === S.DROP) {
    const pf = sprites.plane.frames[Math.floor(t * 9) % 2];
    drawSprSh(pf, planeX, 215, 300, Math.sin(t * 2.4) * 0.03);
    drawSpr(sprites.potatoIdle.frames[0], planeX + 55, 272, 118);
  }
  drawPotato();
}
function drawPotato() {
  if (!potato) return;
  if (state === S.DROP) return; // drawn at the plane position in drawWorld
  let spr, fi;
  if (catchAnimT > 0) {
    spr = sprites.potatoCatch;
    fi = Math.floor(((0.4 - catchAnimT) / 0.4) * spr.frames.length) % spr.frames.length;
  } else if (Math.abs(potato.vy) > 150 || state === S.RESCUE) {
    spr = sprites.potatoFall;
    fi = Math.floor(t * 12) % spr.frames.length;
  } else {
    spr = sprites.potatoIdle;
    fi = Math.floor(t * 3) % spr.frames.length;
  }
  if (fxShield > 0) {
    ctx.beginPath();
    ctx.arc(potato.x, potato.y, 98 + Math.sin(t * 6) * 4, 0, TAU);
    ctx.fillStyle = 'rgba(90,200,255,.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,200,255,.8)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  const w = 150, h = w * spr.fh / spr.fw;
  const sq = potato.squashT > 0 ? (potato.squashT / 0.35) : 0;
  const sx = 1 + sq * 0.3, sy = 1 - sq * 0.3;
  ctx.save();
  ctx.shadowColor = 'rgba(25,45,70,.25)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 9;
  ctx.translate(potato.x, potato.y);
  ctx.rotate(potato.tilt);
  ctx.scale(sx, sy);
  ctx.drawImage(spr.frames[fi], -w / 2, -h / 2, w, h);
  ctx.restore();
}
function drawHUD() {
  panel(24, 24, 250, 120);
  txt('SCORE', 149, 52, 22, '#3a6b8a', 'center', 0);
  txt(fmt(score), 149, 100, 46, '#173a52', 'center', 0);
  const bx = W - 84, by = 92;
  const pr = multPulse > 0 ? Math.sin(multPulse * 12) * 8 : 0;
  const rad = 56 + pr;
  ctx.beginPath(); ctx.arc(bx, by, rad, 0, TAU);
  ctx.fillStyle = mult >= 5 ? '#ffd34d' : mult >= 3 ? '#8fe07a' : '#7fd4ff';
  ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = '#111'; ctx.stroke();
  txt('x' + mult, bx, by + 4, 52, '#112233', 'center', 0);
  txt('MULTIPLIER', bx, by + 80, 18, 'rgba(255,255,255,.95)', 'center', 6, '#14213d');
  txt(fmt(meters) + ' m', 24, 176, 28, '#ffffff', 'left', 8, '#14213d');
  // bounce pips
  txt('BOUNCES', 24, 212, 18, 'rgba(255,255,255,.9)', 'left', 6, '#14213d');
  for (let i = 0; i < 3; i++) {
    const cx = 158 + i * 36, cy = 212;
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU);
    ctx.fillStyle = i < 3 - bounces ? '#7fd4ff' : 'rgba(255,255,255,.35)';
    ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.stroke();
  }
  // v3: rescue pips (plane icons)
  txt('RESCUES', 24, 248, 18, 'rgba(255,255,255,.9)', 'left', 6, '#14213d');
  for (let i = 0; i < RESCUES_MAX; i++) {
    const cx = 160 + i * 44, cy = 248;
    if (i < RESCUES_MAX - rescuesUsed) {
      drawSpr(sprites.plane.frames[0], cx, cy, 36);
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
    }
  }
  // active power-up badges
  let px0 = 24;
  if (fxShield > 0) { drawSprSh(sprites.puShield.frames[0], px0 + 17, 292, 34); px0 += 40; }
  if (fxMagnet > 0) { drawSprSh(sprites.puMagnet.frames[0], px0 + 17, 292, 34); bar(px0 + 40, 284, 72, 9, fxMagnet / 6, '#ff9d3c'); px0 += 122; }
  if (fxSpeed > 0) { drawSprSh(sprites.puChili.frames[0], px0 + 17, 292, 34); bar(px0 + 40, 284, 72, 9, fxSpeed / 3.2, '#ff6b4a'); px0 += 122; }
  // pause button
  BTN.pause = { x: W - 72, y: 176, w: 48, h: 48 };
  rr(BTN.pause.x, BTN.pause.y, 48, 48, 12, 'rgba(255,255,255,.85)');
  rrPath(BTN.pause.x, BTN.pause.y, 48, 48, 12);
  ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.fillRect(BTN.pause.x + 15, BTN.pause.y + 13, 7, 22);
  ctx.fillRect(BTN.pause.x + 27, BTN.pause.y + 13, 7, 22);
}
function drawMenu() {
  const px = (t * 140) % (W + 600) - 300;
  const pf = sprites.plane.frames[Math.floor(t * 8) % 2];
  drawSprSh(pf, px, 118 + Math.sin(t * 2) * 8, 220, Math.sin(t * 2) * 0.04);
  txt('POTATO', W / 2, 235, 110, '#ffd34d', 'center', 16, '#14213d');
  txt('DROP!', W / 2, 352, 96, '#7fd4ff', 'center', 14, '#14213d');
  const f = sprites.potatoIdle.frames[Math.floor(t * 3) % 4];
  drawSprSh(f, W / 2, 600 + Math.sin(t * 2.2) * 10, 300);
  drawButton('play', W / 2, 880, 360, 'PLAY');
  if (best > 0) txt('BEST  ' + fmt(best), W / 2, 990, 36, '#ffffff', 'center', 9, '#14213d');
  txt('ARROWS / A D   or   DRAG to steer', W / 2, 1058, 27, '#dff3ff', 'center', 7, '#14213d');
  txt('Catch clouds + power-ups + BOUNCERS!', W / 2, 1098, 27, '#ffd34d', 'center', 7, '#14213d');
  txt('Land well, get RESCUED, and drop again!', W / 2, 1138, 27, '#8fe07a', 'center', 7, '#14213d');
  txt('v3.0', 44, H - 26, 22, 'rgba(255,255,255,.55)', 'left', 4, '#14213d');
}
function drawOver() {
  const a = clamp(overT / 0.3, 0, 1);
  ctx.fillStyle = 'rgba(10,25,40,' + (0.45 * a).toFixed(3) + ')';
  ctx.fillRect(0, 0, W, H);
  if (!landingInfo) return;
  const good = landingInfo.good;
  panel(W / 2 - 280, 330, 560, 560);
  txt(good ? 'GREAT LANDING!' : 'GAME OVER', W / 2, 412, 52, good ? '#2e9e4f' : '#e04545', 'center', 10, '#111');
  txt('FINAL SCORE', W / 2, 480, 26, '#3a6b8a', 'center', 0);
  txt(fmt(landingInfo.finalScore), W / 2, 548, 72, '#173a52', 'center', 0);
  if (newBest) txt('NEW BEST!', W / 2, 612, 32, '#e08a00', 'center', 8, '#fff');
  const rows = [
    ['MAX MULTIPLIER', 'x' + landingInfo.maxMult],
    ['CLOUDS CAUGHT', '' + landingInfo.caught],
    ['HEIGHT', fmt(landingInfo.meters) + ' m'],
    ['BOUNCERS HIT', '' + landingInfo.bouncers],
    ['POWER-UPS', landingInfo.powerups + ' grabbed'],
    ['RESCUES', landingInfo.rescues + ' / ' + RESCUES_MAX]
  ];
  let yy = 650;
  for (const r of rows) {
    txt(r[0], W / 2 - 195, yy, 23, '#3a6b8a', 'left', 0);
    txt(r[1], W / 2 + 195, yy, 23, '#173a52', 'right', 0);
    yy += 38;
  }
  const btxt = (landingInfo.bonus >= 0 ? '+' : '') + fmt(landingInfo.bonus);
  txt('LAST LANDING  ' + landingInfo.label + '  ' + btxt, W / 2, yy + 4, 24, landingInfo.bonus >= 0 ? '#2e9e4f' : '#e04545', 'center', 0);
  drawButton('again', W / 2, 1020, 380, 'PLAY AGAIN');
  txt('or press R', W / 2, 1108, 24, 'rgba(255,255,255,.85)', 'center', 6, '#14213d');
  txt('BEST ' + fmt(best), W / 2, 1162, 26, '#ffd34d', 'center', 7, '#14213d');
}
function drawPause() {
  ctx.fillStyle = 'rgba(10,25,40,.55)';
  ctx.fillRect(0, 0, W, H);
  txt('PAUSED', W / 2, H / 2 - 20, 72, '#ffffff', 'center', 12, '#111');
  txt('P / ESC to resume', W / 2, H / 2 + 44, 28, 'rgba(255,255,255,.85)', 'center', 7, '#14213d');
}
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let sx = 0, sy = 0;
  if (shake > 0) { sx = rand(-shake, shake); sy = rand(-shake, shake); }
  ctx.save();
  ctx.translate(sx, sy);
  drawSky();
  if (state === S.MENU) {
    drawMenu();
  } else {
    ctx.save();
    ctx.translate(0, -camY);
    drawWorld();
    ctx.restore();
    drawHUD();
    if (state === S.OVER) drawOver();
    if (flashT > 0) {
      ctx.fillStyle = flashCol + clamp(flashT * 1.8, 0, 0.8).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (paused) drawPause();
  }
  for (const c of bgNear) drawPuff(c.x, c.y, c.s, 'rgba(255,255,255,.3)');
  ctx.restore();
}

// ---------- main loop ----------
let last = performance.now();
function frame(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  if (spritesReady) {
    update(dt);
    draw();
  }
  requestAnimationFrame(frame);
}
initBg();
loadAll().then(() => { spritesReady = true; });
requestAnimationFrame(frame);
