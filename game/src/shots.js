// Deterministic screenshot staging: ?shot=start|play|drop|end&seed=N sets
// the game to a fixed scene so the screenshots are repeatable and show the
// game at its best — title over the valley, a run at a fire, a water drop,
// and the win screen. The same file drives shots.json in the repository.

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
    // Parked on the strip at golden hour, fires smoking on the horizon.
    plane.x = 420;
    plane.y = 14.6;
    plane.z = -420;
    plane.heading = 0.5;
    plane.throttle = 0;
    return { screen: 'title', plane, mission };
  }
  if (shot === 'play') {
    // Airborne, closing on the Lakeside front, ring ahead, tank full.
    // The anchor holds the plane in place for the screenshot: the world
    // animates around it (smoke, flames, clouds) while the fire stays
    // in frame ahead of the nose.
    const anchor = { x: -160, y: 82, z: 350, heading: 2.6 };
    plane.x = anchor.x;
    plane.y = anchor.y;
    plane.z = anchor.z;
    plane.heading = anchor.heading; // toward the Lakeside front at (-220, 450)
    plane.speed = 46;
    plane.throttle = 0.62;
    plane.tank = 100;
    plane.fuel = 78;
    return { screen: 'fly', plane, mission, anchor };
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
    return { screen: 'fly', plane, mission, dropping: true, anchor };
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
    return { screen: 'win', plane, mission };
  }
  return null;
}
