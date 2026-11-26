// The sortie: three fire fronts, three things to protect, one score.
// A fire grows until water puts it out; what it reaches, it damages.

import { FIRE, SCORE } from './config.js';
import { FIRE_SPOTS } from './world.js';
import { mulberry32 } from './random.js';

export function newMission() {
  const rand = mulberry32(20261126 + 5);
  return {
    fires: FIRE_SPOTS.map((s) => ({
      name: s.name,
      x: s.x,
      z: s.z,
      r: s.r,
      intensity: 60 + rand() * 30,
      target: s.target,
      out: false,
    })),
    townHealth: 100,
    stationHealth: 100,
    score: 0,
    acresSaved: 0,
    firesOut: 0,
    time: 0,
    won: false,
    lost: false,
    loseReason: '',
    messages: [],
  };
}

function pushMessage(m, text) {
  m.messages.push({ text, t: 0 });
  if (m.messages.length > 3) m.messages.shift();
}

// One fixed step. plane: the aircraft (for drop/scoop checks done by the
// caller); drops: [{x, z, amount}] water impacts this step; dt seconds.
export function stepMission(m, drops, dt, town, station) {
  if (m.won || m.lost) return;
  m.time += dt;
  const rand = Math.random;
  for (const f of m.fires) {
    if (f.out) continue;
    // Grow.
    f.r = Math.min(FIRE.maxRadius, f.r + FIRE.growRate * dt);
    // Water dropped inside the front knocks the intensity down.
    for (const d of drops) {
      const dist = Math.hypot(d.x - f.x, d.z - f.z);
      if (dist < f.r + FIRE.waterRadius) {
        f.intensity -= FIRE.dropKill * (d.amount / 100) * Math.max(0.3, 1 - dist / (f.r + FIRE.waterRadius));
      }
    }
    // Spot fires: a front can throw an ember and start a new edge.
    if (rand() < FIRE.spreadEmber * dt) {
      f.r = Math.min(FIRE.maxRadius, f.r + 6);
    }
    if (f.intensity <= 0) {
      f.out = true;
      f.intensity = 0;
      m.firesOut++;
      m.score += SCORE.perFireOut;
      m.acresSaved += Math.round(f.r * f.r * 0.0008);
      pushMessage(m, `${f.name} front is OUT — +${SCORE.perFireOut}`);
    }
    // Damage what the front reaches.
    if (f.target === 'town') {
      const d = Math.hypot(f.x - town.houses[0].x, f.z - town.houses[0].z);
      if (d < f.r + 60) {
        m.townHealth = Math.max(0, m.townHealth - 1.8 * dt);
        for (const h of town.houses) h.health = m.townHealth;
      }
    }
    if (f.target === 'station') {
      const d = Math.hypot(f.x - station.x, f.z - station.z);
      if (d < f.r + 60) {
        m.stationHealth = Math.max(0, m.stationHealth - 1.8 * dt);
        station.health = m.stationHealth;
      }
    }
  }
  // Score trickles for ground held: every second every front is out is
  // ground the fire never took.
  m.score += m.firesOut * SCORE.timeBonusPerSecond * dt * 0.1;
  // Win: every front out. Lose: the town or the station burns down.
  if (m.fires.every((f) => f.out)) {
    m.won = true;
    m.score += SCORE.townSaveBonus * (m.townHealth / 100);
    m.score += SCORE.stationSaveBonus * (m.stationHealth / 100);
    m.score += Math.round(m.acresSaved * SCORE.perAcreSaved * 0.1);
  }
  if (m.townHealth <= 0) {
    m.lost = true;
    m.loseReason = 'The lakeside town burned down.';
  } else if (m.stationHealth <= 0) {
    m.lost = true;
    m.loseReason = 'The ranger station burned down.';
  }
  for (const msg of m.messages) msg.t += dt;
  m.messages = m.messages.filter((msg) => msg.t < 6);
}

// The current objective line for the HUD: the most urgent live front —
// the one closest to what it threatens — or the win.
export function objectiveLine(m) {
  if (m.won) return 'All fronts out — valley saved!';
  const live = m.fires.filter((f) => !f.out);
  if (live.length === 0) return 'Mopping up…';
  const f = mostUrgent(m);
  const what =
    f.target === 'town'
      ? 'protect the lakeside town'
      : f.target === 'station'
        ? 'protect the ranger station'
        : 'stop the canyon fire';
  return `Front: ${f.name} — ${what} (${live.length} front${live.length > 1 ? 's' : ''} burning)`;
}

// The most urgent front: the smallest gap between its edge and what it
// threatens. The canyon fire threatens nothing, so it comes last.
export function mostUrgent(m) {
  let best = null;
  let bestGap = Infinity;
  for (const f of m.fires) {
    if (f.out) continue;
    let gap = Infinity;
    if (f.target === 'town') gap = Math.hypot(f.x - -80, f.z - 330) - f.r - 60;
    if (f.target === 'station') gap = Math.hypot(f.x - 620, f.z - 520) - f.r - 60;
    if (gap < bestGap) {
      bestGap = gap;
      best = f;
    }
  }
  return best || m.fires.find((f) => !f.out);
}

// The nearest live fire, for the HUD compass marker and the drop ring.
export function nearestFire(m, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const f of m.fires) {
    if (f.out) continue;
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}
