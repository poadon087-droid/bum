/* Zaploon persistent player state + economy. */

const STATE = (() => {
  const KEY = "zaploon.v2";
  const ENERGY_BASE_MS = 45000;

  const QUESTS = [
    { id: "spin10", name: "Spin the slot 10 times", need: 10, key: "spins", reward: { energy: 8, coins: 4000 } },
    { id: "crash3", name: "Cash out Crash 3 times", need: 3, key: "crashCash", reward: { coins: 8000, gems: 1 } },
    { id: "plinko8", name: "Drop 8 Plinko balls", need: 8, key: "plinko", reward: { coins: 6000, energy: 4 } },
    { id: "mines2", name: "Cash out Mines twice", need: 2, key: "minesCash", reward: { coins: 7000, gems: 1 } },
    { id: "wheel1", name: "Spin the prize wheel", need: 1, key: "wheel", reward: { coins: 3000, energy: 3 } },
    { id: "win5", name: "Hit 5 slot line wins", need: 5, key: "lineWins", reward: { gems: 2, coins: 5000 } },
  ];

  const UPGRADES = [
    {
      id: "cap",
      name: "Bigger Battery",
      desc: "Raise max energy +10 per level (max 5).",
      max: 5,
      cost: (lv) => 2500 * (lv + 1) * (lv + 1),
    },
    {
      id: "regen",
      name: "Fast Charge",
      desc: "Energy returns 5s faster per level (max 5).",
      max: 5,
      cost: (lv) => 3000 * (lv + 1) * (lv + 1),
    },
    {
      id: "piggy",
      name: "Fatter Piggy",
      desc: "Piggy skims +1% of coin wins per level (max 3).",
      max: 3,
      cost: (lv) => 4000 * (lv + 1) * (lv + 2),
    },
    {
      id: "luck",
      name: "Neon Charm",
      desc: "Cosmetic sparkle + tiny daily gift bump. Does not change RTP.",
      max: 3,
      cost: (lv) => 2000 * (lv + 1),
    },
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function fresh() {
    return {
      name: "You",
      coins: 250000,
      gems: 18,
      energy: 50,
      energyMaxBase: 50,
      lastEnergyAt: Date.now(),
      xp: 0,
      level: 1,
      rank: 12880 + Math.floor(Math.random() * 4000),
      upgrades: { cap: 0, regen: 0, piggy: 0, luck: 0 },
      stickers: {},
      piggy: 0,
      piggyGoal: 1000,
      questProg: {},
      questClaimed: {},
      questDay: todayKey(),
      stats: {
        spins: 0,
        lineWins: 0,
        crashCash: 0,
        plinko: 0,
        minesCash: 0,
        wheel: 0,
        biggestWin: 0,
        spent: 0,
        won: 0,
      },
      settings: { sound: true },
      partnerUntil: 0,
      dailyWheelAt: 0,
      tickets: { crash: 1, plinko: 1, mines: 1, scratch: 1, slot: 1, any: 2 },
      clientSeed: RNG.randomHex(16),
      serverSeed: RNG.randomHex(32),
      nextServerSeed: RNG.randomHex(32),
      nonce: 0,
      seenHelp: false,
      createdAt: Date.now(),
      portal: null,
    };
  }

  let data = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
    } catch {
      data = fresh();
    }
    data.tickets = { crash: 0, plinko: 0, mines: 0, scratch: 0, slot: 0, any: 0, ...(data.tickets || {}) };
    if (!data.portal || !data.portal.game || !(data.portal.stake > 0)) data.portal = null;
    rollQuestsIfNeeded();
    regen();
    return data;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    listeners.forEach((fn) => fn(data));
  }

  function on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function get() {
    return data;
  }

  function energyMax() {
    return data.energyMaxBase + data.upgrades.cap * 10;
  }

  function regenMs() {
    return Math.max(15000, ENERGY_BASE_MS - data.upgrades.regen * 5000);
  }

  function regen() {
    const max = energyMax();
    if (data.energy >= max) {
      data.lastEnergyAt = Date.now();
      return;
    }
    const step = regenMs();
    const passed = Date.now() - data.lastEnergyAt;
    const gained = Math.floor(passed / step);
    if (gained > 0) {
      data.energy = Math.min(max, data.energy + gained);
      data.lastEnergyAt += gained * step;
      if (data.energy >= max) data.lastEnergyAt = Date.now();
    }
  }

  function nextEnergyIn() {
    regen();
    if (data.energy >= energyMax()) return 0;
    return Math.max(0, regenMs() - (Date.now() - data.lastEnergyAt));
  }

  function partnerActive() {
    return Date.now() < data.partnerUntil;
  }

  function addCoins(n, why) {
    data.coins = Math.max(0, Math.round(data.coins + n));
    if (n > 0) {
      data.stats.won += n;
      const skim = 0.03 + data.upgrades.piggy * 0.01;
      const cut = Math.floor(n * skim);
      if (cut > 0 && data.piggy < data.piggyGoal) {
        const add = Math.min(cut, data.piggyGoal - data.piggy);
        data.piggy += add;
      }
      if (n > data.stats.biggestWin) data.stats.biggestWin = n;
    } else {
      data.stats.spent += -n;
    }
    save();
  }

  function addGems(n) {
    data.gems = Math.max(0, data.gems + n);
    save();
  }

  function addEnergy(n) {
    data.energy = Math.max(0, Math.min(energyMax() + 20, data.energy + n));
    save();
  }

  function spendEnergy(n) {
    regen();
    if (data.energy < n) return false;
    data.energy -= n;
    if (data.energy === energyMax() - n) data.lastEnergyAt = Date.now();
    save();
    return true;
  }

  function spendCoins(n) {
    if (data.coins < n) return false;
    addCoins(-n);
    return true;
  }

  function spendGems(n) {
    if (data.gems < n) return false;
    addGems(-n);
    return true;
  }

  function bump(stat, n = 1) {
    data.stats[stat] = (data.stats[stat] || 0) + n;
    data.questProg[stat] = (data.questProg[stat] || 0) + n;
    data.xp += n * 8;
    const need = 100 + data.level * 40;
    while (data.xp >= need) {
      data.xp -= need;
      data.level += 1;
    }
    save();
  }

  function rollQuestsIfNeeded() {
    if (data.questDay !== todayKey()) {
      data.questDay = todayKey();
      data.questProg = {};
      data.questClaimed = {};
    }
  }

  function claimQuest(id) {
    rollQuestsIfNeeded();
    const q = QUESTS.find((x) => x.id === id);
    if (!q || data.questClaimed[id]) return false;
    const have = data.questProg[q.key] || 0;
    if (have < q.need) return false;
    data.questClaimed[id] = true;
    if (q.reward.coins) data.coins += q.reward.coins;
    if (q.reward.energy) data.energy = Math.min(energyMax() + 20, data.energy + q.reward.energy);
    if (q.reward.gems) data.gems += q.reward.gems;
    save();
    return true;
  }

  function buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return false;
    const lv = data.upgrades[id] || 0;
    if (lv >= u.max) return false;
    const cost = u.cost(lv);
    if (!spendCoins(cost)) return false;
    data.upgrades[id] = lv + 1;
    save();
    return true;
  }

  function unlockPartner() {
    if (!spendGems(8)) return false;
    data.partnerUntil = Date.now() + 10 * 60 * 1000;
    save();
    return true;
  }

  function smashPiggy() {
    if (data.piggy < data.piggyGoal) return 0;
    const got = data.piggy;
    data.piggy = 0;
    data.coins += got;
    data.piggyGoal = Math.round(data.piggyGoal * 1.25);
    save();
    return got;
  }

  function addSticker(id) {
    data.stickers[id] = (data.stickers[id] || 0) + 1;
    save();
  }

  function addTicket(game, n = 1) {
    if (!data.tickets) data.tickets = { crash: 0, plinko: 0, mines: 0, scratch: 0, slot: 0, any: 0 };
    data.tickets[game] = (data.tickets[game] || 0) + n;
    save();
  }

  function useTicket(game) {
    if (!data.tickets) data.tickets = { crash: 0, plinko: 0, mines: 0, scratch: 0, slot: 0, any: 0 };
    if ((data.tickets[game] || 0) > 0) {
      data.tickets[game] -= 1;
      save();
      return true;
    }
    if ((data.tickets.any || 0) > 0) {
      data.tickets.any -= 1;
      save();
      return true;
    }
    return false;
  }

  function ticketCount(game) {
    const t = data.tickets || {};
    if (game === "any") return t.any || 0;
    return (t[game] || 0) + (t.any || 0);
  }

  function armPortal(game, stake) {
    data.portal = { game, stake: Math.max(1, Math.round(stake)) };
    save();
  }

  function peekPortal(game) {
    const p = data.portal;
    if (p && p.game === game && p.stake > 0) return p.stake;
    return 0;
  }

  function consumePortal(game) {
    const s = peekPortal(game);
    if (!s) return 0;
    data.portal = null;
    save();
    return s;
  }

  function clearPortal() {
    if (!data.portal) return;
    data.portal = null;
    save();
  }

  async function nextStream() {
    const nonce = data.nonce++;
    const stream = RNG.makeStream(data.serverSeed, data.clientSeed, nonce);
    save();
    return { stream, nonce, serverSeed: data.serverSeed, clientSeed: data.clientSeed };
  }

  async function rotateSeeds() {
    data.serverSeed = data.nextServerSeed;
    data.nextServerSeed = RNG.randomHex(32);
    data.nonce = 0;
    save();
    return RNG.sha256(data.serverSeed);
  }

  async function serverHash() {
    return RNG.sha256(data.serverSeed);
  }

  function reset() {
    data = fresh();
    save();
  }

  return {
    KEY,
    QUESTS,
    UPGRADES,
    load,
    save,
    on,
    get,
    energyMax,
    regenMs,
    regen,
    nextEnergyIn,
    partnerActive,
    addCoins,
    addGems,
    addEnergy,
    spendEnergy,
    spendCoins,
    spendGems,
    bump,
    claimQuest,
    buyUpgrade,
    unlockPartner,
    smashPiggy,
    addSticker,
    addTicket,
    useTicket,
    ticketCount,
    armPortal,
    peekPortal,
    consumePortal,
    clearPortal,
    nextStream,
    rotateSeeds,
    serverHash,
    reset,
    todayKey,
  };
})();
