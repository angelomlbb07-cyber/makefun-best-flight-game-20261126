// Deterministic screenshot staging: ?shot=start|takeoff|drop|land|end&seed=N
// sets the game to a fixed scene so the screenshots are repeatable and show
// the game at its best — the cockpit on the runway under the title, the
// lift-off, a water drop, the final approach, and the win screen. The same
// file drives shots.json in the repository.

import { newPlane } from './plane.js';
import { newMission } from './missions.js';

export function parseShot(search) {
  const q = new URLSearchParams(search);
  return {
    shot: q.get('shot') || null,
    seed: Number(q.get('seed') || 1),
  };
}

// Place the plane and the mission for a staged shot. Returns the state
// the main loop should start from (screen + plane + mission).
export function stageShot(shot) {
  const mission = newMission();
  const plane = newPlane();
  if (shot === 'start') {
    // Parked on the strip at golden hour, fires smoking on the horizon —
    // from the cockpit, so the title sits over the panel and the runway.
    plane.x = 420;
    plane.y = 14.6;
    plane.z = -420;
    plane.heading = 0.5;
    plane.throttle = 0;
    return { screen: 'title', plane, mission, cockpit: true };
  }
  if (shot === 'takeoff') {
    // On the strip, throttle full, about to rotate: the capture runs the
    // sim for ~2 s, and autoPitch pulls the nose up once the wing has
    // flying speed, so the frame catches the lift-off itself.
    plane.x = 420;
    plane.y = 14.6;
    plane.z = -420;
    plane.heading = 0.5;
    plane.speed = 12;
    plane.throttle = 1;
    plane.tank = 0;
    plane.fuel = 160;
    return { screen: 'fly', plane, mission, cockpit: true, autoPitch: true };
  }
  if (shot === 'land') {
    // On final approach to the strip, cockpit view, runway ahead: the
    // anchor holds the plane on the glidepath so the strip stays in the
    // windscreen for the photo, with the FINAL APPROACH banner lit.
    const dirX = -Math.sin(0.5);
    const dirZ = -Math.cos(0.5);
    const anchor = { x: 420 - dirX * 480, y: 52, z: -420 - dirZ * 480, heading: 0.5 };
    plane.x = anchor.x;
    plane.y = anchor.y;
    plane.z = anchor.z;
    plane.heading = anchor.heading;
    plane.speed = 34;
    plane.throttle = 0.35;
    plane.pitch = -0.06;
    plane.tank = 40;
    plane.fuel = 58;
    return { screen: 'fly', plane, mission, cockpit: true, anchor };
  }
  if (shot === 'drop') {
    // Right over the Ridge front, water falling, tank half spent. The
    // anchor sits just short of the fire centre so the falling water
    // lands inside the front (drops drift forward as they fall).
    const f = mission.fires[1];
    const anchor = { x: f.x + 20, y: 68, z: f.z + 55, heading: Math.atan2(-(f.x - (f.x + 20)), -(f.z - (f.z + 55))) };
    plane.x = anchor.x;
    plane.y = anchor.y;
    plane.z = anchor.z;
    plane.heading = anchor.heading;
    plane.speed = 38;
    plane.throttle = 0.5;
    plane.tank = 55;
    plane.fuel = 64;
    return { screen: 'fly', plane, mission, dropping: true, anchor, cockpit: false };
  }
  if (shot === 'end') {
    // All fronts out: the win screen over a quiet valley.
    for (const f of mission.fires) {
      f.out = true;
      f.intensity = 0;
    }
    mission.won = true;
    mission.score = 2840;
    mission.firesOut = 3;
    mission.acresSaved = 61;
    mission.townHealth = 82;
    mission.stationHealth = 91;
    plane.x = -260;
    plane.y = 130;
    plane.z = 120;
    plane.heading = 1.2;
    plane.speed = 42;
    plane.throttle = 0.5;
    plane.tank = 20;
    plane.fuel = 48; // a third of a tank left after the sortie
    return { screen: 'win', plane, mission, cockpit: false };
  }
  return null;
}
