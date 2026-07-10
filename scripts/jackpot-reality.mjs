/**
 * Realistic lottery jackpot amounts, match tiers, and shared-jackpot rules.
 * Draw cadence is enforced: daily / weekly / monthly / quarterly - never spam.
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TIER_REALITY = Object.freeze({
  daily: {
    id: 'daily',
    name: 'Daily Draw',
    scheduleLabel: 'Daily · midnight Curaçao time',
    cadenceDays: 1,
    baseJackpot: 3_184,
    jackpotRange: [2_147, 3_892],
    /** Share of that draw’s jackpot for lower match tiers */
    /** Keep in sync with js/prize-tier-matrix.js MATCH_PCT */
    matchPct: {
      5: [0.12, 0.20],
      4: [0.03, 0.07],
      3: [0.008, 0.018],
    },
    jackpotTitle: 'Daily Jackpot',
  },
  weekly: {
    id: 'weekly',
    name: 'Weekly Mega',
    scheduleLabel: 'Weekly · Sunday 8:00 PM Curaçao time',
    cadenceDays: 7,
    baseJackpot: 2_184_750,
    jackpotRange: [1_847_320, 5_392_180],
    matchPct: {
      5: [0.01, 0.02],
      4: [0.0003, 0.0007],
      3: [0.000012, 0.000028],
    },
    jackpotTitle: 'Weekly Mega Jackpot',
  },
  monthly: {
    id: 'monthly',
    name: 'Monthly Jackpot',
    scheduleLabel: 'Monthly · 1st · 9:00 PM Curaçao time',
    cadenceDays: 30,
    baseJackpot: 5_392_180,
    jackpotRange: [4_847_260, 12_847_390],
    matchPct: {
      5: [0.009, 0.018],
      4: [0.00025, 0.00055],
      3: [0.000009, 0.00002],
    },
    jackpotTitle: 'Monthly Jackpot',
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarterly Ultra',
    scheduleLabel: 'Quarterly · Jan / Apr / Jul / Oct · 10:30 PM Curaçao time',
    cadenceDays: 90,
    baseJackpot: 12_847_390,
    jackpotRange: [9_847_260, 28_392_750],
    matchPct: {
      5: [0.008, 0.016],
      4: [0.0002, 0.00045],
      3: [0.000007, 0.000016],
    },
    jackpotTitle: 'Quarterly Ultra Jackpot',
  },
});

export function formatUsdExact(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
}

/** Irregular lottery-style amounts - avoid clean $2,000,000 / $3,000 figures */
export function messyAmount(rand, lo, hi) {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  let n = a + rand() * (b - a);
  const scale = Math.max(11, n * 0.0028);
  n += (rand() - 0.5) * 2 * scale;
  n = Math.round(n);
  // Only scramble large round figures - don’t inflate small daily prizes
  if (n >= 5_000 && (n % 1000 < 30 || n % 1000 > 970)) {
    n += 47 + Math.floor(rand() * 853);
  } else if (n >= 500 && n % 100 === 0) {
    n += 13 + Math.floor(rand() * 71);
  } else if (n % 10 === 0) {
    n += 1 + Math.floor(rand() * 8);
  }
  return Math.max(1, Math.round(n));
}

function range(rand, [lo, hi]) {
  return messyAmount(rand, lo, hi);
}

/** Lower-tier cash = % of that draw’s jackpot, with messy digits */
export function paidFromJackpotShare(rand, jackpotAmount, tierId, matchCount) {
  const tier = TIER_REALITY[tierId] || TIER_REALITY.monthly;
  if (matchCount >= 6) return Math.round(jackpotAmount);
  const band = tier.matchPct?.[matchCount];
  if (!band) return messyAmount(rand, 25, 120);
  const pct = band[0] + rand() * (band[1] - band[0]);
  const raw = jackpotAmount * pct;
  return messyAmount(rand, raw * 0.91, raw * 1.09);
}

export function uniqueNumbers(rand, count = 6, max = 49) {
  const set = new Set();
  while (set.size < count) set.add(1 + Math.floor(rand() * max));
  return [...set].sort((a, b) => a - b);
}

/** Rare multi-ticket jackpot splits */
export function rollShareCount(rand) {
  const r = rand();
  if (r < 0.03) return 3;
  if (r < 0.12) return 2;
  return 1;
}

export function headlineFor({ matchCount, shareCount, tier }) {
  if (matchCount === 6) {
    if (shareCount >= 3) return 'TRIPLE JACKPOT SPLIT';
    if (shareCount === 2) return 'JACKPOT SHARED · 2 WINNING TICKETS';
    return `${tier.jackpotTitle.toUpperCase()} · SOLE WINNER`;
  }
  if (matchCount === 5) return '5 OF 6 MATCHED · SECOND PRIZE';
  if (matchCount === 4) return '4 OF 6 MATCHED · PRIZE TIER';
  if (matchCount === 3) return '3 OF 6 MATCHED · PRIZE TIER';
  return `${matchCount} OF 6 MATCHED`;
}

export function shareNote(shareCount, jackpotAmount, paid) {
  if (shareCount <= 1) {
    return `Sole winner · claimed the full ${formatUsdExact(jackpotAmount)} jackpot`;
  }
  return `${shareCount} winning tickets split ${formatUsdExact(jackpotAmount)} · ${formatUsdExact(paid)} each`;
}

export function buildCashWin(rand, tierId, opts = {}) {
  const tier = TIER_REALITY[tierId] || TIER_REALITY.monthly;
  let matchCount = opts.matchCount;
  if (matchCount == null) {
    const r = rand();
    if (r < 0.22) matchCount = 6;
    else if (r < 0.48) matchCount = 5;
    else if (r < 0.78) matchCount = 4;
    else matchCount = 3;
  }

  const jackpotAmount = opts.jackpotAmount != null
    ? Math.round(opts.jackpotAmount)
    : range(rand, tier.jackpotRange);

  let shareCount = 1;
  let paid;
  let isJackpot = false;

  if (matchCount === 6) {
    isJackpot = true;
    shareCount = opts.shareCount != null ? opts.shareCount : rollShareCount(rand);
    // Split can leave uneven cents-style remainders on last share
    const base = Math.floor(jackpotAmount / shareCount);
    const rem = jackpotAmount - base * shareCount;
    paid = base + (opts.shareIndex === shareCount ? rem : 0);
    if (opts.shareIndex == null) paid = base;
  } else {
    paid = paidFromJackpotShare(rand, jackpotAmount, tier.id, matchCount);
  }

  const numbers = opts.numbers || uniqueNumbers(rand);
  const headline = headlineFor({ matchCount, shareCount, tier });

  return {
    drawId: tier.id,
    drawName: tier.name,
    scheduleLabel: tier.scheduleLabel,
    matchCount,
    shareCount,
    isJackpot,
    jackpotAmount,
    advertisedPrize: jackpotAmount,
    prize: paid,
    prizeUsd: paid,
    paidUsd: paid,
    prizeLabel: formatUsdExact(paid),
    jackpotLabel: formatUsdExact(jackpotAmount),
    prizeType: 'cash',
    headline,
    shareNote: shareNote(shareCount, jackpotAmount, paid),
    numbers,
    jackpotTierWin: isJackpot,
  };
}

function dateLabel(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Last closed draw time for a tier (before `now`) */
export function lastDrawTimestamp(tierId, now = Date.now()) {
  const d = new Date(now);
  if (tierId === 'daily') {
    d.setHours(0, 0, 0, 0);
    if (d.getTime() > now) d.setDate(d.getDate() - 1);
    return d.getTime();
  }
  if (tierId === 'weekly') {
    // Last Sunday 20:00 Curaçao time
    const day = d.getDay();
    const back = day === 0 ? 0 : day;
    d.setDate(d.getDate() - back);
    d.setHours(20, 0, 0, 0);
    if (d.getTime() > now) d.setDate(d.getDate() - 7);
    return d.getTime();
  }
  if (tierId === 'monthly') {
    d.setDate(1);
    d.setHours(21, 0, 0, 0);
    if (d.getTime() > now) {
      d.setMonth(d.getMonth() - 1, 1);
      d.setHours(21, 0, 0, 0);
    }
    return d.getTime();
  }
  // Quarterly: Jan / Apr / Jul / Oct 1st 22:30
  const m = d.getMonth();
  const qStart = Math.floor(m / 3) * 3;
  d.setMonth(qStart, 1);
  d.setHours(22, 30, 0, 0);
  if (d.getTime() > now) {
    d.setMonth(qStart - 3, 1);
    d.setHours(22, 30, 0, 0);
  }
  return d.getTime();
}

/**
 * 15-month archive with strict cadence:
 * - Daily: at most one jackpot result per calendar day
 * - Weekly: at most one Sunday draw
 * - Monthly: at most one on the 1st
 * - Quarterly: at most one per quarter (4/year) - never weekly/daily spam
 */
export function buildFifteenMonthArchive(rand = mulberry32(0x4e0d7a11), now = Date.now()) {
  const end = new Date(now);
  const start = new Date(end.getFullYear(), end.getMonth() - 14, 1);
  const events = [];
  let id = 0;
  const usedDrawKeys = new Set();

  const drawKey = (tierId, drawAt) => {
    const d = new Date(drawAt);
    if (tierId === 'daily') return `daily-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (tierId === 'weekly') return `weekly-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (tierId === 'monthly') return `monthly-${d.getFullYear()}-${d.getMonth()}`;
    return `quarterly-${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  };

  const pushGroup = (tierId, drawAt, jackpotAmount, shareCount, numbers, { jackpotHit = true } = {}) => {
    const key = drawKey(tierId, drawAt);
    if (usedDrawKeys.has(key)) return;
    usedDrawKeys.add(key);

    if (jackpotHit) {
      for (let s = 0; s < shareCount; s++) {
        const win = buildCashWin(rand, tierId, {
          matchCount: 6,
          shareCount,
          shareIndex: s + 1,
          jackpotAmount,
          numbers,
        });
        events.push({
          ...win,
          id: `hist-jp-${++id}`,
          source: 'archive',
          historic: true,
          shareIndex: s + 1,
          timestamp: drawAt + s,
          drawDateLabel: dateLabel(drawAt),
          drawKey: key,
        });
      }
    }

    // One secondary prize row per draw night (not a pile of million-dollar matches)
    if (rand() < 0.72) {
      const m = rand() < 0.4 ? 5 : rand() < 0.75 ? 4 : 3;
      const win = buildCashWin(rand, tierId, {
        matchCount: m,
        jackpotAmount,
        numbers: uniqueNumbers(rand),
      });
      events.push({
        ...win,
        id: `hist-sec-${++id}`,
        source: 'archive',
        historic: true,
        timestamp: drawAt + 10,
        drawDateLabel: dateLabel(drawAt),
        drawKey: key,
      });
    }
  };

  // -  Weekly Mega: one Sunday slot; jackpot hits ~every 2-3 weeks (rollovers between)
  let weeklyRollover = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 7 * 86400000) {
    const d = new Date(t);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(20, 0, 0, 0);
    if (d < start || d > end) continue;
    weeklyRollover += 1;
    const hit = weeklyRollover >= 2 && rand() < 0.38;
    if (!hit) continue;
    const jackpot = messyAmount(
      rand,
      TIER_REALITY.weekly.baseJackpot * (1 + Math.min(weeklyRollover, 6) * (0.14 + rand() * 0.18)),
      TIER_REALITY.weekly.baseJackpot * (1 + Math.min(weeklyRollover, 6) * (0.22 + rand() * 0.2)),
    );
    pushGroup(
      'weekly',
      d.getTime(),
      Math.min(jackpot, TIER_REALITY.weekly.jackpotRange[1]),
      rollShareCount(rand),
      uniqueNumbers(rand),
    );
    weeklyRollover = 0;
  }

  // -  Monthly: one draw on the 1st; skip months that are quarter-open (quarterly owns that night)
  for (let i = 0; i < 15; i++) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1, 21, 0, 0, 0);
    if (d < start || d > end) continue;
    if (d.getMonth() % 3 === 0) continue; // Jan/Apr/Jul/Oct → quarterly only
    const hit = rand() < 0.82;
    if (!hit) continue;
    const jackpot = rand() < 0.25
      ? range(rand, [6_392_180, 12_847_390])
      : range(rand, [4_847_260, 7_392_850]);
    pushGroup('monthly', d.getTime(), jackpot, rollShareCount(rand), uniqueNumbers(rand));
  }

  // -  Quarterly Ultra: ONLY Jan / Apr / Jul / Oct (≤4 in 12 months, ≤5 in 15)
  const seenQ = new Set();
  for (let i = 0; i < 16; i++) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const qm = Math.floor(d.getMonth() / 3) * 3;
    d.setMonth(qm, 1);
    d.setHours(22, 30, 0, 0);
    if (d < start || d > end) continue;
    const qk = `${d.getFullYear()}-Q${qm / 3 + 1}`;
    if (seenQ.has(qk)) continue;
    seenQ.add(qk);
    // Almost always a winner each quarter (big advertised event)
    if (rand() > 0.9) continue;
    pushGroup(
      'quarterly',
      d.getTime(),
      range(rand, TIER_REALITY.quarterly.jackpotRange),
      rollShareCount(rand),
      uniqueNumbers(rand),
    );
  }

  // -  Daily: sparse (~5-8 / month), never on the 1st (monthly/quarterly day)
  for (let i = 0; i < 15; i++) {
    const y = end.getFullYear();
    const m = end.getMonth() - i;
    const hits = 5 + Math.floor(rand() * 4);
    const daysUsed = new Set();
    for (let j = 0; j < hits; j++) {
      let day = 2 + Math.floor(rand() * 27); // skip day 1
      let guard = 0;
      while (daysUsed.has(day) && guard++ < 30) day = 2 + Math.floor(rand() * 27);
      daysUsed.add(day);
      const d = new Date(y, m, day, 0, 0, 0, 0);
      if (d < start || d > end) continue;
      pushGroup(
        'daily',
        d.getTime(),
        range(rand, TIER_REALITY.daily.jackpotRange),
        rand() < 0.05 ? 2 : 1,
        uniqueNumbers(rand),
      );
    }
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Build a realistic "Recent Winners" board: spread across real draw dates,
 * at most one jackpot headline per calendar day (prefer quarterly > monthly > weekly > daily).
 */
export function buildRecentBoard(archive, rand = mulberry32(0x51a0c0de), limit = 16) {
  const tierRank = { quarterly: 4, monthly: 3, weekly: 2, daily: 1 };
  const byNight = new Map();
  for (const row of archive) {
    const key = row.drawKey || `${row.drawId}-${row.drawDateLabel}`;
    if (!byNight.has(key)) byNight.set(key, []);
    byNight.get(key).push(row);
  }

  const nights = [...byNight.values()]
    .map((rows) => rows.sort((a, b) => a.timestamp - b.timestamp))
    .sort((a, b) => {
      const ra = tierRank[a[0].drawId] || 0;
      const rb = tierRank[b[0].drawId] || 0;
      if (b[0].timestamp !== a[0].timestamp) return b[0].timestamp - a[0].timestamp;
      return rb - ra;
    });

  const out = [];
  const usedCalendarDays = new Set();
  let quarterlyShown = 0;
  let monthlyShown = 0;
  let weeklyShown = 0;
  let dailyShown = 0;

  for (const rows of nights) {
    if (out.length >= limit) break;
    const tier = rows[0].drawId;
    const dayKey = rows[0].drawDateLabel;

    // One jackpot night per calendar day on the short recent list
    if (usedCalendarDays.has(dayKey) && rows.some((r) => r.matchCount === 6)) continue;

    const jackpots = rows.filter((r) => r.matchCount === 6);
    const secondary = rows.find((r) => r.matchCount !== 6);

    // Caps apply to jackpot headlines only - don't burn a quarterly slot on a 4-of-6 row
    if (jackpots.length) {
      if (tier === 'quarterly') {
        if (quarterlyShown >= 1) continue;
        quarterlyShown += 1;
      }
      if (tier === 'monthly') {
        if (monthlyShown >= 2) continue;
        monthlyShown += 1;
      }
      if (tier === 'weekly') {
        if (weeklyShown >= 3) continue;
        weeklyShown += 1;
      }
      if (tier === 'daily') {
        if (dailyShown >= 4) continue;
        dailyShown += 1;
      }
      if (usedCalendarDays.has(dayKey)) continue;
      usedCalendarDays.add(dayKey);
      for (const j of jackpots) out.push(j);
      if (secondary && out.length < limit && rand() < 0.4) out.push(secondary);
    }
  }

  return out.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
