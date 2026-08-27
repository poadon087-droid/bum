/* Particles, toasts, screen shake, sprite bursts. */

const FX = (() => {
  let layer;
  function ensure() {
    if (!layer) layer = document.getElementById("fx-layer");
    return layer;
  }

  function toast(msg, kind = "ok") {
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.textContent = msg;
    ensure().appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => {
      el.classList.remove("in");
      setTimeout(() => el.remove(), 280);
    }, 1700);
  }

  function floatText(x, y, text, kind = "win") {
    const el = document.createElement("div");
    el.className = `floater floater-${kind}`;
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    ensure().appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function confetti(n = 28) {
    const box = ensure();
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.className = "confetti";
      p.style.left = 10 + Math.random() * 80 + "%";
      p.style.background = ["#ffd23a", "#ff4d8d", "#3ecfff", "#8ee04a", "#b44dff"][i % 5];
      p.style.animationDelay = Math.random() * 0.2 + "s";
      p.style.setProperty("--x", Math.random() * 120 - 60 + "px");
      box.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  }

  function shake(el, ms = 380) {
    if (!el) return;
    el.classList.add("shaking");
    setTimeout(() => el.classList.remove("shaking"), ms);
  }

  function burst(el) {
    if (!el) return;
    el.classList.remove("burst");
    void el.offsetWidth;
    el.classList.add("burst");
  }

  function placeSpr(cls, left, top, life) {
    const s = document.createElement("i");
    s.className = "spr " + cls;
    s.style.left = left;
    s.style.top = top;
    ensure().appendChild(s);
    setTimeout(() => s.remove(), life);
    return s;
  }

  function sparkle() {
    for (let i = 0; i < 5; i++) {
      placeSpr(
        "spr-sparkle",
        16 + Math.random() * 68 + "%",
        10 + Math.random() * 32 + "%",
        700
      );
    }
  }

  function rays() {
    const s = placeSpr("spr-rays", "50%", "18%", 800);
    s.style.marginLeft = "-48px";
  }

  function zap() {
    for (let i = 0; i < 3; i++) {
      placeSpr(
        "spr-bolt",
        22 + Math.random() * 56 + "%",
        14 + Math.random() * 28 + "%",
        520
      );
    }
  }

  return { toast, floatText, confetti, shake, burst, sparkle, rays, zap };
})();
