/* Zaploon — cryptographic-style RNG (play-for-fun, virtual coins).
   HMAC-SHA-256(serverSeed, clientSeed:nonce:cursor) → uniform (0,1]. */

const RNG = (() => {
  const enc = new TextEncoder();

  function hexFromBuf(buf) {
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function randomHex(bytes = 32) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return hexFromBuf(a);
  }

  async function hmacSha256(keyHex, message) {
    const keyRaw = enc.encode(keyHex);
    const key = await crypto.subtle.importKey(
      "raw",
      keyRaw,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return hexFromBuf(sig);
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return hexFromBuf(buf);
  }

  function hashToUnit(hex) {
    // 52 bits → float in (0, 1]
    const slice = hex.slice(0, 13);
    const int = parseInt(slice, 16);
    const max = 16 ** 13;
    return (int + 1) / max;
  }

  function hashToInt(hex, maxExclusive) {
    const slice = hex.slice(0, 13);
    const int = parseInt(slice, 16);
    return int % maxExclusive;
  }

  function makeStream(serverSeed, clientSeed, nonce) {
    let cursor = 0;
    const cache = [];
    async function fill() {
      const hex = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor++}`);
      cache.push(hex);
      return hex;
    }
    return {
      async unit() {
        const hex = await fill();
        return hashToUnit(hex);
      },
      async int(maxExclusive) {
        const hex = await fill();
        return hashToInt(hex, maxExclusive);
      },
      async hex() {
        return fill();
      },
    };
  }

  return { randomHex, hmacSha256, sha256, hashToUnit, hashToInt, makeStream };
})();
