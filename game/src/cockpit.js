// The first-person cockpit: its camera, its interior, and the
// takeoff/landing phase the HUD announces. The camera rides the plane's
// own orientation (heading, pitch, roll), so the horizon banks with the
// aircraft and the runway rushes by on the roll — a chase camera cannot
// show either. The interior is built from the same primitives as the
// aircraft, so it reads as part of the plane, not a pasted overlay.

import { WORLD } from './config.js';
import { MeshBuilder } from './gl.js';
import { planeMatrix } from './plane.js';
import { onStrip } from './world.js';

// Apply a column-major 4x4 matrix (the renderer's layout) to a point.
function matVec(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// The cockpit camera: eye at the pilot's head, looking along the nose,
// up vector rolled with the wings. Returns the eye, the target and the
// up vector for matLookAt — the up vector is what banks the horizon.
export function cockpitCamera(p) {
  const m = planeMatrix(p);
  const eye = matVec(m, 0, 0.62, -1.9);
  // Forward is the model's -z axis, up is its +y axis, both rotated by
  // the plane's orientation (translation does not move a direction).
  const fwd = [-m[8], -m[9], -m[10]];
  const up = [m[4], m[5], m[6]];
  const dist = 80;
  return {
    x: eye[0],
    y: eye[1],
    z: eye[2],
    tx: eye[0] + fwd[0] * dist,
    ty: eye[1] + fwd[1] * dist,
    tz: eye[2] + fwd[2] * dist,
    ux: up[0],
    uy: up[1],
    uz: up[2],
  };
}

// The cockpit interior, drawn in the plane's own frame (planeMatrix) when
// the cockpit camera is on, in place of the outside of the aircraft:
// glareshield and instrument panel below the windscreen, the yoke, the
// canopy pillars and top bar, and the nose and spinner ahead — so the
// pilot sees the aircraft they are flying, not an empty sky.
export function buildCockpitMesh(gl) {
  const b = new MeshBuilder();
  const panel = [0.09, 0.1, 0.12];
  const shield = [0.17, 0.16, 0.15];
  const trim = [0.78, 0.16, 0.1];
  const dark = [0.12, 0.12, 0.14];
  const noseRed = [0.78, 0.16, 0.1];
  const noseWhite = [0.94, 0.93, 0.9];
  // Glareshield: the shelf across the base of the windscreen, kept
  // low so the runway stays visible on final — its top edge is the
  // bottom of the pilot's view, and a tall shield hides the strip.
  b.box(0, 0.18, -2.55, 1.7, 0.16, 0.5, shield);
  // Instrument panel below it, with a red trim line on its top edge.
  b.box(0, -0.18, -2.72, 1.7, 0.62, 0.28, panel);
  b.box(0, 0.14, -2.72, 1.7, 0.05, 0.3, trim);
  // Two dark instrument faces on the panel (the lit gauges themselves are
  // drawn on the 2D overlay; these give the panel its shape).
  b.box(-0.42, -0.18, -2.86, 0.5, 0.42, 0.04, [0.05, 0.08, 0.12]);
  b.box(0.42, -0.18, -2.86, 0.5, 0.42, 0.04, [0.05, 0.08, 0.12]);
  // Yoke: column from the panel and a crossbar the pilot holds.
  b.box(0, -0.3, -2.55, 0.08, 0.5, 0.08, dark);
  b.box(0, -0.05, -2.5, 0.6, 0.08, 0.08, dark);
  // Canopy pillars at the windscreen's sides and the bar over the top.
  b.box(-0.82, 0.55, -2.5, 0.08, 0.9, 0.12, dark);
  b.box(0.82, 0.55, -2.5, 0.08, 0.9, 0.12, dark);
  b.box(0, 0.98, -2.5, 1.7, 0.08, 0.12, dark);
  // The nose ahead of the windscreen, so the propeller has an aircraft.
  // It sits LOW: the pilot looks over it, not through it. A nose at
  // eye height is a red wall across the windscreen that hides the
  // runway on final.
  b.box(0, -0.25, -3.6, 0.95, 0.7, 1.4, noseRed);
  b.box(0, -0.15, -4.15, 0.75, 0.6, 0.5, noseWhite);
  b.box(0, -0.2, -4.45, 0.4, 0.4, 0.3, dark);
  return b.build(gl);
}

// How far the plane is from the strip centre, and whether its nose points
// at the strip (within ~17 degrees) — the final-approach test.
export function stripApproach(p) {
  const dx = WORLD.strip.x - p.x;
  const dz = WORLD.strip.z - p.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(-dx, -dz);
  let diff = want - p.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { dist, aligned: Math.abs(diff) < 0.3 };
}

// The flight phase: what the pilot is doing right now, and the one line
// the HUD should say about it. The takeoff and landing phases are the
// sequence — roll, rotate, climb out, final, flare, touchdown — and the
// banner is what makes them read as a sequence instead of a state.
export function flightPhase(p, m) {
  if (p.onGround) {
    if (p.speed < 2) {
      return {
        id: 'parked',
        label: 'PARKED ON THE STRIP — hold Shift to throttle up',
      };
    }
    if (p.speed < 20) {
      return {
        id: 'roll',
        label: 'TAKEOFF ROLL — pull back (S) at 90 km/h',
      };
    }
    return { id: 'rotate', label: 'ROTATE — pull back (S) to lift off' };
  }
  const ap = stripApproach(p);
  if (p.vspeed < -0.5 && ap.dist < 600 && p.y < 100 && ap.aligned) {
    if (p.y < 18) {
      return { id: 'flare', label: 'FLARE — ease the nose up, touch down gently' };
    }
    return { id: 'final', label: 'FINAL APPROACH — line up with the strip' };
  }
  if (p.vspeed > 0.5 && p.y < 80) {
    return { id: 'climb', label: 'CLIMB OUT — head for the lake, then the fire' };
  }
  const overLake =
    Math.hypot((p.x - WORLD.lake.x) / WORLD.lake.rx, (p.z - WORLD.lake.z) / WORLD.lake.rz) < 1;
  if (overLake && p.y < WORLD.waterLevel + 5 && p.speed > 14 && p.speed < 42) {
    return { id: 'scoop', label: 'SCOOPING — hold low and slow, tank filling' };
  }
  if (onStrip(p.x, p.z) && p.y < 30) {
    return { id: 'rollout', label: 'ROLLOUT — refuelling, then go again' };
  }
  return { id: 'cruise', label: '' };
}

// The landing bonus: a gentle touchdown on the strip is worth more than
// a hard one, so landing well is a decision, not just a refuel stop.
export function landingBonus(p) {
  const smooth = p.vspeed > -3.5;
  return { points: smooth ? 50 : 10, smooth };
}
