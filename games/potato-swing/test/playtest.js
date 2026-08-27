/* Headless playtest: stub DOM, load built game, simulate an AI player. */
'use strict';
const fs = require('fs');

/* ---- DOM stubs ---- */
function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string') return t[k] !== undefined ? t[k] : () => {};
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
const canvas = { getContext: () => makeCtx(), style: {}, width: 0, height: 0 };
global.document = {
  getElementById: id => (id === 'c' ? canvas : null),
  addEventListener: () => {},
  hidden: false
};
global.window = global;
global.addEventListener = () => {};
global.innerWidth = 820; global.innerHeight = 400;
global.devicePixelRatio = 1;
global.Image = class {
  set src(v) { if (this.onload) this.onload(); }
};
global.requestAnimationFrame = () => 0;
global.localStorage = undefined; // test guarded storage
global.navigator = { vibrate: () => {} };

/* ---- load game ---- */
let code = fs.readFileSync('/tmp/built_check.js', 'utf-8');
code += `
;globalThis.__T = {
  startGame, tryAttach, release, update, render,
  getP: () => P, getMode: () => MODE, getMeters: () => meters,
  getAnchors: () => anchors, getCam: () => cam, getChips: () => chips,
  getRope: () => P.rope, getState: () => P.state, getParts: () => parts,
  getViewW: () => viewW, getViewH: () => viewH
};`;
eval(code);
const T = globalThis.__T;
const dt = 1 / 120;

function assertNoNaN() {
  const P = T.getP();
  for (const k of ['x', 'y', 'vx', 'vy', 'angle']) {
    if (!isFinite(P[k])) throw new Error('NaN in player.' + k);
  }
  const cam = T.getCam();
  if (!isFinite(cam.x) || !isFinite(cam.y)) throw new Error('NaN in camera');
}

/* the potato must stay ON screen while alive */
function assertVisible(tag) {
  if (T.getMode() !== 'play') return;
  const P = T.getP();
  if (P.state === 'dead') return;
  const cam = T.getCam();
  const fx = (P.x - cam.x) / T.getViewW();
  const fy = (P.y - cam.y) / T.getViewH();
  if (fx < 0.01 || fx > 0.99 || fy < 0.01 || fy > 0.99)
    throw new Error(tag + ': player OFF-SCREEN fx=' + fx.toFixed(2) + ' fy=' + fy.toFixed(2));
}

/* ---- test 1: AI plays (attach when possible, release when rising & fast) ---- */
T.startGame();
let released = 0, attached = 0, landed = 0, lastState = '';
let frames = 0;
const MAX = 120 * 90; // 90 simulated seconds
let fxSum = 0, fySum = 0, fxCnt = 0, fxMin = 1, fxMax = 0;
while (frames < MAX && T.getMode() !== 'over') {
  const P = T.getP();
  if (P.state !== lastState) {
    if (P.state === 'run') landed++;
    lastState = P.state;
  }
  if ((P.state === 'fly' || P.state === 'run') && !T.getRope()) { T.tryAttach(); if (T.getRope()) attached++; }
  if (P.state === 'swing' && T.getRope() && T.getRope().t >= 1) {
    if (P.vy < -120 && P.vx > 250) { T.release(); released++; }
    // safety release if rope points backwards & below for a long time
    if (T.getRope() && T.getRope().a.x < P.x - 200 && P.vy > 0) { T.release(); released++; }
  }
  T.update(dt);
  T.render();
  assertNoNaN();
  assertVisible('test1');
  if (P.state !== 'dead') {
    const cam = T.getCam();
    const fx = (P.x - cam.x) / T.getViewW(), fy = (P.y - cam.y) / T.getViewH();
    fxSum += fx; fySum += fy; fxCnt++;
    fxMin = Math.min(fxMin, fx); fxMax = Math.max(fxMax, fx);
  }
  frames++;
}
{
  const fx = fxSum / fxCnt, fy = fySum / fxCnt;
  console.log(`[test1] framing: avg fx=${fx.toFixed(2)} fy=${fy.toFixed(2)} | fx range ${fxMin.toFixed(2)}..${fxMax.toFixed(2)} (target ~0.45)`);
  if (fx < 0.25 || fx > 0.70) throw new Error('potato not horizontally centered: avg fx=' + fx.toFixed(2));
}
console.log(`[test1] frames=${frames} (${(frames / 120).toFixed(1)}s sim) meters=${T.getMeters()} mode=${T.getMode()} state=${T.getState()} attaches=${attached} releases=${released} landings=${landed}`);
if (T.getMeters() < 30) throw new Error('AI made too little progress: ' + T.getMeters() + 'm');
console.log('[test1] PASS — momentum swinging carries the potato forward');

/* ---- test 2: render path in all modes is error-free, then idle death ---- */
T.startGame();
frames = 0;
let died = false;
while (frames < 120 * 20) {
  T.update(dt); T.render();
  if (T.getMode() === 'over') { died = true; break; }
  frames++;
}
console.log(`[test2] never-grab run: died=${died} after ${(frames / 120).toFixed(1)}s, meters=${T.getMeters()}`);
if (!died) throw new Error('player should die when never grabbing rope');
console.log('[test2] PASS — falling into the chasm kills');

/* ---- test 3: chip collection ---- */
T.startGame();
const P = T.getP();
const chips = T.getChips();
if (chips.length) { P.x = chips[0].x; P.y = chips[0].y; }
T.update(dt);
console.log('[test3] chips near start:', chips.length, '| collection path ran without error');

/* ---- test 4: long-run stability (attach/release loop 3 min) ---- */
T.startGame();
frames = 0;
let maxX = 0;
while (frames < 120 * 180 && T.getMode() !== 'over') {
  const p = T.getP();
  if ((p.state === 'fly' || p.state === 'run') && !T.getRope()) T.tryAttach();
  if (p.state === 'swing' && T.getRope() && T.getRope().t >= 1 && p.vy < -100 && p.vx > 200) T.release();
  T.update(dt);
  assertNoNaN();
  assertVisible('test4');
  maxX = Math.max(maxX, p.x);
  frames++;
}
console.log(`[test4] 3-min soak: meters=${T.getMeters()} maxX=${maxX | 0} mode=${T.getMode()}`);
console.log('ALL TESTS PASS');
