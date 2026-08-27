/* Richer synthesized SFX — stacked oscillators, noise, filters. */

const AUDIO = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function enabled() {
    return STATE.get()?.settings.sound !== false;
  }

  function envGain(c, gain, at, dur, peak = 0.06) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(peak * gain, c.currentTime + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    return g;
  }

  function beep(freq, dur, type = "square", gain = 1, at = 0, slide = 0) {
    if (!enabled()) return;
    const c = ac();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + at + dur);
    const g = envGain(c, gain, at, dur, 0.055);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.03);
  }

  function tone(freq, dur, type, gain, at, slide) {
    beep(freq, dur, type, gain, at, slide);
  }

  function noise(dur, gain = 0.05, at = 0, freq = 1400, type = "bandpass") {
    if (!enabled()) return;
    const c = ac();
    const n = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource();
    s.buffer = n;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.9;
    const g = envGain(c, gain / 0.055, at, dur, 0.05);
    s.connect(f);
    f.connect(g);
    g.connect(c.destination);
    s.start(c.currentTime + at);
  }

  function chord(notes, dur, type = "triangle", gain = 0.7, at = 0) {
    notes.forEach((n, i) => tone(n, dur, type, gain * (i === 0 ? 1 : 0.7), at + i * 0.012));
  }

  return {
    unlock: () => ac(),
    tick: () => {
      tone(980 + Math.random() * 80, 0.045, "square", 0.55);
      tone(1470, 0.03, "triangle", 0.3, 0.01);
    },
    spin: () => {
      tone(180, 0.18, "sawtooth", 0.7, 0, 90);
      tone(360, 0.14, "square", 0.35, 0.02, 40);
      noise(0.12, 0.7, 0, 900, "lowpass");
    },
    stop: () => {
      tone(330, 0.07, "triangle", 0.7);
      tone(495, 0.09, "square", 0.4, 0.04);
    },
    win: (tier = 1) => {
      const seq = [
        [523, 659],
        [523, 659, 784],
        [523, 659, 784, 1046],
        [392, 523, 659, 784, 1046],
      ][Math.min(3, tier)];
      seq.forEach((n, i) => {
        tone(n, 0.18, "square", 0.75, i * 0.065);
        tone(n * 2, 0.12, "triangle", 0.28, i * 0.065 + 0.02);
      });
      if (tier >= 2) noise(0.08, 0.35, 0.02, 2400);
    },
    huge: () => {
      [392, 523, 659, 784, 988, 1175, 1568].forEach((n, i) => {
        tone(n, 0.22, "square", 0.8, i * 0.07);
        tone(n * 1.5, 0.16, "triangle", 0.3, i * 0.07 + 0.02);
      });
      noise(0.2, 0.55, 0, 1800);
    },
    lose: () => {
      tone(220, 0.22, "sawtooth", 0.6, 0, -90);
      tone(165, 0.28, "triangle", 0.4, 0.04, -50);
    },
    cash: () => {
      tone(880, 0.07, "square", 0.7);
      tone(1175, 0.09, "square", 0.65, 0.06);
      tone(1568, 0.14, "triangle", 0.5, 0.12);
    },
    crashBoom: () => {
      noise(0.34, 1, 0, 280, "lowpass");
      noise(0.18, 0.6, 0.02, 1200, "bandpass");
      tone(70, 0.36, "sawtooth", 0.9, 0, -28);
    },
    click: () => {
      tone(720, 0.035, "square", 0.5);
      tone(1080, 0.025, "triangle", 0.25, 0.01);
    },
    drop: () => {
      tone(520, 0.08, "triangle", 0.7, 0, -160);
      noise(0.06, 0.3, 0, 700, "lowpass");
    },
    peg: () => {
      tone(1000 + Math.random() * 500, 0.035, "square", 0.28);
    },
    pop: () => {
      tone(640, 0.08, "triangle", 0.65, 0, 240);
      tone(960, 0.06, "square", 0.3, 0.02);
    },
    wheel: () => {
      const f = 360 + Math.random() * 420;
      tone(f, 0.05, "square", 0.45);
      tone(f * 1.5, 0.04, "triangle", 0.22, 0.01);
    },
    potato: () => {
      tone(300, 0.07, "triangle", 0.6, 0, 80);
      tone(450, 0.05, "square", 0.35, 0.03);
    },
    chord,
  };
})();
