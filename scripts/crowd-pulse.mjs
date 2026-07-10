/**
 * Crowd pulse: weekend / prime-time busyness for shared live feed.
 * Keep in sync with js/crowd-pulse.js
 */
export function getCrowdPulse(now = new Date()) {
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekend = day === 0 || day === 6;
  const isFriEvening = day === 5 && hour >= 17;
  const isPrimeTime = hour >= 18 || hour <= 1;
  const isQuietMorning = hour >= 5 && hour < 11;

  let baseOnline = 2680;
  let pace = 1;
  let label = 'Steady play';
  let note = '';
  let cta = 'Pick your six and jump in.';
  let busy = false;

  if (isWeekend) {
    baseOnline = 4550;
    pace = 2.55;
    label = 'Weekend rush';
    note = 'Busy weekend: more players locking in numbers right now.';
    cta = 'Weekends fill up fast. Grab your line.';
    busy = true;
  } else if (isFriEvening) {
    baseOnline = 3980;
    pace = 2.15;
    label = 'Friday night surge';
    note = 'Friday night is heating up across every draw.';
    cta = 'Join the Friday crowd before the next close.';
    busy = true;
  } else if (isPrimeTime) {
    baseOnline = 3420;
    pace = 1.65;
    label = 'Prime-time play';
    note = 'Evening rush: ticket buys are coming in faster.';
    cta = 'Players are buying in. Lock your numbers.';
    busy = true;
  } else if (isQuietMorning) {
    baseOnline = 2140;
    pace = 0.7;
    label = 'Morning calm';
    note = 'Quieter morning: easy window to enter.';
    cta = 'Good time to set your numbers before it picks up.';
    busy = false;
  }

  const wave = 0.88 + Math.random() * 0.28;
  const playersOnline = Math.max(1800, Math.round(baseOnline * wave));

  return {
    playersOnline,
    pace,
    label,
    note,
    cta,
    busy,
    isWeekend,
    intensity: pace,
  };
}

export function nextDelayMs(pulse, rand = Math.random) {
  const pace = Math.max(0.45, pulse?.pace || 1);
  const baseMin = 3200;
  const baseMax = 10_500;
  const min = Math.max(700, Math.round(baseMin / pace));
  const max = Math.max(min + 400, Math.round(baseMax / pace));
  if (pulse?.busy && rand() < 0.28) {
    return Math.round(400 + rand() * 900);
  }
  return Math.round(min + rand() * (max - min));
}

export function burstCount(pulse, rand = Math.random) {
  if (!pulse?.busy) return rand() < 0.12 ? 2 : 1;
  const r = rand();
  if (r < 0.35) return 1;
  if (r < 0.7) return 2;
  if (r < 0.9) return 3;
  return 4;
}
