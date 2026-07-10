/**
 * Shared live authority: one feed for every visitor (slots, roulette, lottery activity, winners).
 * House payout ratios stay server-side only; never sent to the browser.
 *
 * Used by production-server / dev-server under /api/live/*
 */
import { randomBytes } from 'node:crypto';
import {
  TIER_REALITY,
  buildCashWin,
  buildFifteenMonthArchive,
  buildRecentBoard,
  formatUsdExact,
  lastDrawTimestamp,
  messyAmount,
  mulberry32,
  rollShareCount,
} from './jackpot-reality.mjs';
import { burstCount, getCrowdPulse, nextDelayMs } from './crowd-pulse.mjs';

/** Opaque settlement policy: not exposed on public API responses */
const POLICY = Object.freeze({
  prizeBps: 1000, // 10% of pool max (matches contract defaultPrizeBps)
  dailyPrizeBpsMin: 100,
  dailyPrizeBpsMax: 300,
  majorPrizeBps: 1000,
  retainImplied: true,
});

const ROSTER_SIZE = 100;
const FEED_LIMIT = 40;
const WINNERS_LIMIT = 28;
const HISTORY_LIMIT = 120;

const SYMBOLS = [
  { id: 'cherry', label: 'Cherry', mult: 2 },
  { id: 'orange', label: 'Orange', mult: 3 },
  { id: 'bell', label: 'Bell', mult: 5 },
  { id: 'crown', label: 'Crown', mult: 15 },
  { id: 'seven', label: 'Lucky 7', mult: 25 },
];

const BET_TYPES = ['red', 'black', 'even', 'odd', 'low', 'high'];
const BET_LABELS = {
  red: 'Red', black: 'Black', even: 'Even', odd: 'Odd', low: '1-18', high: '19-36',
};
const WHEEL = [
  '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1',
  '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2',
];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const TIERS = Object.values(TIER_REALITY).map((t) => ({
  id: t.id,
  name: t.name,
  advertised: t.baseJackpot,
}));

function rand() {
  return randomBytes(4).readUInt32BE(0) / 0x100000000;
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function walletShort() {
  const h = () => randomBytes(2).toString('hex');
  return `0x${h()}...${h()}`;
}

function formatUsd(n) {
  return formatUsdExact(n);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function weighted(entries) {
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = rand() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e.v;
  }
  return entries[entries.length - 1].v;
}

function slotColor(result) {
  if (result === '0' || result === '00') return 'green';
  const n = parseInt(result, 10);
  return RED.has(n) ? 'red' : 'black';
}

function checkWin(betType, result) {
  if (result === '0' || result === '00') return false;
  const n = parseInt(result, 10);
  if (betType === 'red') return RED.has(n);
  if (betType === 'black') return n > 0 && !RED.has(n);
  if (betType === 'even') return n > 0 && n % 2 === 0;
  if (betType === 'odd') return n > 0 && n % 2 === 1;
  if (betType === 'low') return n >= 1 && n <= 18;
  if (betType === 'high') return n >= 19 && n <= 36;
  return false;
}

export function createLiveAuthority() {
  const roster = Array.from({ length: ROSTER_SIZE }, () => walletShort());
  let recent = [];
  const feed = [];
  const winners = [];
  let seq = 0;

  function toWinnerPayload(entry) {
    return {
      drawId: entry.drawId,
      drawName: entry.drawName,
      prize: entry.prize,
      paidUsd: entry.prize,
      prizeLabel: entry.prizeLabel,
      prizeType: 'cash',
      matchCount: entry.matchCount,
      shareCount: entry.shareCount,
      shareIndex: entry.shareIndex || 1,
      isJackpot: !!entry.isJackpot,
      jackpotTierWin: !!entry.isJackpot,
      jackpotAmount: entry.jackpotAmount,
      advertisedPrize: entry.jackpotAmount,
      jackpotLabel: entry.jackpotLabel,
      headline: entry.headline,
      shareNote: entry.shareNote,
      scheduleLabel: entry.scheduleLabel,
      source: entry.source || 'showcase',
      timestamp: entry.timestamp,
      drawDateLabel: entry.drawDateLabel,
      winner: { wallet: entry.wallet || entry.walletDisplay },
      coWinners: entry.coWinners || undefined,
      numbers: entry.numbers,
    };
  }

  /** Fixed 15-month archive: identical for every visitor */
  const jackpotHistory = (() => {
    const raw = buildFifteenMonthArchive(mulberry32(0x4e0d7a11));
    const jpGroups = new Map();
    raw.forEach((row) => {
      if (row.matchCount !== 6) return;
      const key = row.drawKey || `${row.drawId}-${row.drawDateLabel}-${(row.numbers || []).join(',')}`;
      if (!jpGroups.has(key)) jpGroups.set(key, []);
      jpGroups.get(key).push(row);
    });
    jpGroups.forEach((rows) => {
      const n = Math.max(rows[0].shareCount || 1, rows.length);
      const list = Array.from({ length: n }, () => pick(roster));
      rows.forEach((row, i) => {
        row.coWinners = list;
        row.shareCount = n;
        row.wallet = list[i] || list[0];
        row.walletDisplay = row.wallet;
        row.payloadJson = JSON.stringify(toWinnerPayload(row));
      });
    });
    raw.forEach((row) => {
      if (row.payloadJson) return;
      row.wallet = pick(roster);
      row.walletDisplay = row.wallet;
      if (row.matchCount === 6) row.coWinners = [row.wallet];
      row.payloadJson = JSON.stringify(toWinnerPayload(row));
    });
    return raw;
  })();

  function pickWallet() {
    if (recent.length && rand() < 0.16) {
      const c = [...new Set(recent)].filter((w) => recent.filter((x) => x === w).length < 2);
      if (c.length) {
        const w = pick(c);
        recent.unshift(w);
        recent = recent.slice(0, 14);
        return w;
      }
    }
    const avoid = new Set(recent.slice(0, 4));
    const pool = roster.filter((w) => !avoid.has(w));
    const w = pick(pool.length ? pool : roster);
    recent.unshift(w);
    recent = recent.slice(0, 14);
    return w;
  }

  function pushFeed(item) {
    feed.unshift(item);
    if (feed.length > FEED_LIMIT) feed.length = FEED_LIMIT;
  }

  function genSlot() {
    const sym = weighted([
      { v: SYMBOLS[0], w: 28 },
      { v: SYMBOLS[1], w: 24 },
      { v: SYMBOLS[2], w: 20 },
      { v: SYMBOLS[3], w: 16 },
      { v: SYMBOLS[4], w: 12 },
    ]);
    const bet = weighted([
      { v: 1, w: 22 }, { v: 2, w: 18 }, { v: 5, w: 18 }, { v: 10, w: 14 },
      { v: 25, w: 12 }, { v: 50, w: 8 }, { v: 100, w: 5 }, { v: 0.5, w: 3 },
    ]);
    const free = rand() < 0.1;
    const payout = free
      ? round2(0.75 + rand() * 8)
      : round2(bet * sym.mult * (0.38 + rand() * 0.22));
    const item = {
      id: `slot-${Date.now()}-${++seq}`,
      type: 'slot_win',
      wallet: pickWallet(),
      symbol: sym.id,
      symbolLabel: sym.label,
      betUsd: free ? 0 : bet,
      payoutUsd: payout,
      payoutLabel: formatUsd(payout),
      free,
      simulated: true,
      timestamp: Date.now(),
    };
    pushFeed(item);
    return item;
  }

  function genRoulette() {
    let betType = pick(BET_TYPES);
    let result = pick(WHEEL);
    for (let i = 0; i < 20 && !checkWin(betType, result); i++) {
      betType = pick(BET_TYPES);
      result = pick(WHEEL);
    }
    if (!checkWin(betType, result)) {
      betType = 'red';
      result = '1';
    }
    const bet = weighted([
      { v: 1, w: 18 }, { v: 2, w: 16 }, { v: 5, w: 18 }, { v: 10, w: 16 },
      { v: 25, w: 14 }, { v: 50, w: 10 }, { v: 100, w: 6 }, { v: 250, w: 2 },
    ]);
    const payout = round2(bet * 2);
    const item = {
      id: `roulette-${Date.now()}-${++seq}`,
      type: 'roulette_win',
      wallet: pickWallet(),
      betType,
      betLabel: BET_LABELS[betType],
      result,
      resultColor: slotColor(result),
      betUsd: bet,
      payoutUsd: payout,
      payoutLabel: formatUsd(payout),
      simulated: true,
      timestamp: Date.now(),
    };
    pushFeed(item);
    return item;
  }

  function genTicket(opts = {}) {
    const usd = weighted([
      { v: 5, w: 20 }, { v: 10, w: 20 }, { v: 20, w: 14 }, { v: 50, w: 14 },
      { v: 100, w: 12 }, { v: 1, w: 8 }, { v: 300, w: 7 }, { v: 500, w: 5 },
    ]);
    const qty = Math.max(1, Math.min(8, Math.floor(opts.count || 1)));
    const nums = [];
    const pool = Array.from({ length: 49 }, (_, i) => i + 1);
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(rand() * pool.length);
      nums.push(pool.splice(idx, 1)[0]);
    }
    nums.sort((a, b) => a - b);
    const item = {
      id: `ticket-${Date.now()}-${++seq}`,
      type: 'ticket',
      wallet: pickWallet(),
      numbers: nums,
      usdPrice: usd * qty,
      count: qty > 1 ? qty : undefined,
      simulated: true,
      timestamp: Date.now(),
    };
    pushFeed(item);
    return item;
  }

  /** Track which draw nights already posted a jackpot (prevents daily Ultra spam) */
  const postedJackpotKeys = new Set();

  function pushWinnerEntry(base, wallet) {
    const entry = {
      ...base,
      id: `win-${Date.now()}-${++seq}`,
      wallet,
      walletDisplay: wallet,
      timestamp: base.timestamp || Date.now(),
      source: 'showcase',
    };
    entry.payloadJson = JSON.stringify(toWinnerPayload(entry));
    winners.unshift(entry);
    if (winners.length > WINNERS_LIMIT) winners.length = WINNERS_LIMIT;
    pushFeed({
      id: entry.id,
      type: 'win',
      wallet,
      drawName: entry.drawName,
      prizeLabel: entry.prizeLabel,
      prizeType: 'cash',
      jackpotTierWin: !!entry.isJackpot,
      matchCount: entry.matchCount,
      headline: entry.headline,
      numbers: entry.numbers,
      simulated: true,
      timestamp: entry.timestamp,
    });
    return entry;
  }

  function attachCoWinners(rows, wallets) {
    const list = wallets.slice();
    rows.forEach((row, i) => {
      row.coWinners = list;
      row.winner = { wallet: list[i] || list[0] };
      row.wallet = list[i] || list[0];
      row.walletDisplay = row.wallet;
      row.payloadJson = JSON.stringify(toWinnerPayload(row));
    });
  }

  /**
   * Live drip respects real schedules:
   * - Mostly daily / weekly secondary prizes
   * - Jackpots only for that tier's last closed draw, once per draw night
   * - Quarterly / monthly almost never drip live (they live in the archive)
   */
  function genWinner() {
    const r = rand();
    let tierId = 'daily';
    if (r < 0.62) tierId = 'daily';
    else if (r < 0.88) tierId = 'weekly';
    else if (r < 0.97) tierId = 'monthly';
    else tierId = 'quarterly';

    const drawAt = lastDrawTimestamp(tierId);
    const drawKey = `${tierId}-${drawAt}`;

    // Jackpot only if this draw night hasn't already been jackpot-posted
    let matchCount = 3;
    const roll = rand();
    if (tierId === 'daily') {
      matchCount = roll < 0.18 ? 6 : roll < 0.4 ? 5 : roll < 0.7 ? 4 : 3;
    } else if (tierId === 'weekly') {
      matchCount = roll < 0.12 ? 6 : roll < 0.35 ? 5 : roll < 0.7 ? 4 : 3;
    } else {
      // monthly / quarterly: secondary prizes only on live drip unless never posted
      matchCount = postedJackpotKeys.has(drawKey)
        ? (roll < 0.45 ? 5 : 4)
        : (roll < 0.08 ? 6 : roll < 0.4 ? 5 : 4);
    }

    if (matchCount === 6 && postedJackpotKeys.has(drawKey)) {
      matchCount = 5;
    }

    const tier = TIER_REALITY[tierId];
    const jackpotAmount = matchCount === 6
      ? messyAmount(rand, tier.jackpotRange[0], tier.jackpotRange[1])
      : tier.baseJackpot;
    const shareCount = matchCount === 6 ? rollShareCount(rand) : 1;
    const numbers = matchCount === 6
      ? (() => {
          const set = new Set();
          while (set.size < 6) set.add(1 + Math.floor(rand() * 49));
          return [...set].sort((a, b) => a - b);
        })()
      : (() => {
          const set = new Set();
          while (set.size < 6) set.add(1 + Math.floor(rand() * 49));
          return [...set].sort((a, b) => a - b);
        })();

    if (matchCount === 6) postedJackpotKeys.add(drawKey);

    const wallets = [];
    for (let i = 0; i < shareCount; i++) wallets.push(pickWallet());

    const group = [];
    for (let i = 0; i < shareCount; i++) {
      const row = buildCashWin(rand, tierId, {
        matchCount,
        shareCount,
        jackpotAmount,
        numbers,
      });
      row.shareIndex = i + 1;
      row.timestamp = drawAt + i;
      row.drawDateLabel = new Date(drawAt).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
      row.coWinners = wallets;
      group.push(pushWinnerEntry(row, wallets[i]));
    }
    attachCoWinners(group, wallets);
    return group;
  }

  // Seed shared state so first visitors see the same world
  for (let i = 0; i < 8; i++) genTicket();
  for (let i = 0; i < 6; i++) genSlot();
  for (let i = 0; i < 5; i++) genRoulette();

  // Recent board = spaced archive draws (not 8 megas stamped "today")
  buildRecentBoard(jackpotHistory, mulberry32(0x51a0c0de), 14).forEach((w) => {
    winners.push({ ...w, source: 'archive-seed' });
    if (w.matchCount === 6 && w.drawKey) postedJackpotKeys.add(w.drawKey);
  });
  winners.sort((a, b) => b.timestamp - a.timestamp);
  if (winners.length > WINNERS_LIMIT) winners.length = WINNERS_LIMIT;

  let tick = 0;
  let crowd = getCrowdPulse();
  let playersOnline = crowd.playersOnline;

  function refreshCrowd() {
    crowd = getCrowdPulse();
    // Drift online count toward pulse target so it tracks feed pace
    const target = crowd.playersOnline;
    const drift = Math.round((target - playersOnline) * (0.25 + rand() * 0.35));
    const jitter = Math.floor(rand() * 81) - 28;
    playersOnline = Math.max(1800, Math.min(6200, playersOnline + drift + jitter));
    crowd = { ...crowd, playersOnline };
    return crowd;
  }

  function beat() {
    tick += 1;
    const pulse = refreshCrowd();
    const n = burstCount(pulse, rand);
    for (let i = 0; i < n; i++) {
      const r = rand();
      // Busier = more lottery tickets vs casino games
      const ticketBias = pulse.busy ? 0.58 : 0.42;
      if (r < ticketBias) {
        const multi = pulse.busy && rand() < 0.22 ? 2 + Math.floor(rand() * 3) : 1;
        genTicket({ count: multi });
      } else if (r < ticketBias + 0.28) genSlot();
      else genRoulette();
    }
    if (tick % Math.max(18, Math.round(45 / pulse.pace)) === 0) genWinner();
    const delay = nextDelayMs(pulse, rand);
    timer = setTimeout(beat, delay);
  }

  let timer = setTimeout(beat, 1200);

  function publicCrowd() {
    return {
      playersOnline,
      pace: crowd.pace,
      label: crowd.label,
      note: crowd.note,
      cta: crowd.cta,
      busy: !!crowd.busy,
      isWeekend: !!crowd.isWeekend,
    };
  }

  function publicFeed() {
    return {
      serverTime: Date.now(),
      crowd: publicCrowd(),
      items: feed.slice(0, 28).map((e) => ({ ...e })),
    };
  }

  function publicWinnerRow(w) {
    return {
      drawId: w.drawId,
      drawName: w.drawName,
      walletDisplay: w.walletDisplay || w.wallet,
      prizeUsd: w.prizeUsd ?? w.prize,
      prizeLabel: w.prizeLabel,
      prizeType: w.prizeType || 'cash',
      matchCount: w.matchCount,
      shareCount: w.shareCount || 1,
      shareIndex: w.shareIndex || 1,
      isJackpot: !!w.isJackpot,
      jackpotAmount: w.jackpotAmount,
      jackpotLabel: w.jackpotLabel,
      headline: w.headline,
      shareNote: w.shareNote,
      scheduleLabel: w.scheduleLabel,
      drawDateLabel: w.drawDateLabel,
      numbers: w.numbers,
      coWinners: w.coWinners || undefined,
      source: w.source,
      timestamp: w.timestamp,
      payloadJson: w.payloadJson || JSON.stringify(toWinnerPayload(w)),
    };
  }

  function publicWinners() {
    return winners.slice(0, WINNERS_LIMIT).map(publicWinnerRow);
  }

  function publicJackpotHistory() {
    return {
      months: 15,
      generatedAt: Date.now(),
      items: jackpotHistory.slice(0, HISTORY_LIMIT).map(publicWinnerRow),
    };
  }

  /** Health / opaque status: never includes POLICY ratios */
  function status() {
    return {
      ok: true,
      mode: 'shared-live-authority',
      feedSize: feed.length,
      winnersSize: winners.length,
      historySize: jackpotHistory.length,
      crowd: publicCrowd(),
      serverTime: Date.now(),
    };
  }

  function stop() {
    clearTimeout(timer);
  }

  return {
    publicFeed,
    publicWinners,
    publicJackpotHistory,
    status,
    stop,
    POLICY_INTERNAL: POLICY,
  };
}

export function attachLiveRoutes(req, res, live, securityHeaders = {}) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  const json = (code, body) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...securityHeaders,
    });
    res.end(JSON.stringify(body));
  };

  if (path === '/api/live/feed' && req.method === 'GET') {
    json(200, live.publicFeed());
    return true;
  }
  if (path === '/api/live/winners' && req.method === 'GET') {
    json(200, live.publicWinners());
    return true;
  }
  if (path === '/api/live/jackpot-history' && req.method === 'GET') {
    json(200, live.publicJackpotHistory());
    return true;
  }
  if (path === '/api/live/status' && req.method === 'GET') {
    json(200, live.status());
    return true;
  }
  return false;
}
