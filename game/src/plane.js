// The air tanker: its shape (built from primitives, red-and-white livery)
// and its flight model (arcade, but speed, lift and stall are real).

import { PLANE, PALETTE, WORLD } from './config.js';
import { MeshBuilder, matMultiply, matRotateX, matRotateY, matRotateZ, matTranslate } from './gl.js';
import { heightAt, onStrip } from './world.js';

// A high-wing single-engine tanker, drawn from boxes and pyramids:
// fuselage, wings, tail, prop disc, belly tank, floats of colour.
export function buildPlaneMesh(gl) {
  const b = new MeshBuilder();
  const red = PALETTE.planeRed;
  const white = PALETTE.planeWhite;
  const yellow = PALETTE.planeYellow;
  const dark = [0.12, 0.12, 0.14];
  // Fuselage: nose at -z, tail at +z. (Forward is -z in model space.)
  b.box(0, 0, -0.6, 1.7, 1.7, 5.4, red);
  b.box(0, 0.15, -3.4, 1.2, 1.2, 1.6, white); // nose cap
  b.box(0, -0.95, 0.4, 1.1, 0.5, 3.6, yellow); // belly tank
  // Cockpit windows.
  b.box(0, 0.55, -2.2, 1.3, 0.6, 1.2, [0.15, 0.3, 0.45]);
  // High wing.
  b.box(0, 0.75, -0.4, 11.5, 0.28, 1.9, white);
  b.box(0, 0.75, -0.4, 11.5, 0.3, 0.3, red); // wing stripe
  // Tail: horizontal stabiliser and fin.
  b.box(0, 0.35, 2.9, 3.8, 0.22, 1.1, white);
  b.box(0, 1.0, 2.9, 0.24, 1.7, 1.3, red);
  // Tail cone.
  b.pyramid(0, 0, 3.6, 0.8, 1.6, red);
  // Prop hub and spinner.
  b.box(0, 0.15, -4.3, 0.5, 0.5, 0.5, dark);
  return b.build(gl);
}

// The spinning prop is its own thin disc, rotated each frame.
export function buildPropMesh(gl) {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 0.24, 3.4, 0.12, [0.15, 0.15, 0.16]);
  b.box(0, 0, 0, 3.4, 0.24, 0.12, [0.15, 0.15, 0.16]);
  return b.build(gl);
}

export function newPlane() {
  return {
    // Start parked on the strip, nose along the strip heading.
    x: 420,
    y: 14.6,
    z: -420,
    heading: 0.5,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    tank: 0,
    fuel: PLANE.fuelCapacity,
    hull: PLANE.hullMax,
    onGround: true,
    propAngle: 0,
    vspeed: 0,
  };
}

// One fixed step of the flight model. input: {pitch, roll, throttleDelta,
// drop} with pitch/roll in -1..1. Returns events for sound/effects.
export function stepPlane(p, input, dt) {
  const ev = { stalled: false, scraped: false, landed: false, crashed: false };
  // Throttle.
  p.throttle = Math.min(1, Math.max(0, p.throttle + input.throttleDelta * dt));
  // Target speed follows throttle; the wing needs speed to fly.
  const targetSpeed = p.throttle * PLANE.maxSpeed;
  const accel = p.onGround ? 14 : 9;
  if (p.speed < targetSpeed) p.speed = Math.min(targetSpeed, p.speed + accel * dt);
  else p.speed = Math.max(targetSpeed, p.speed - 12 * dt);
  // Controls: gentle at low speed, full authority in the air.
  const authority = p.onGround ? 0.25 : Math.min(1, p.speed / 30 + 0.3);
  p.roll += (input.roll * PLANE.rollRate * authority - p.roll) * Math.min(1, dt * 3.2);
  p.pitch += (input.pitch * PLANE.pitchRate * authority - p.pitch) * Math.min(1, dt * 3.2);
  // Bank turns the nose.
  p.heading -= p.roll * PLANE.turnRate * (p.speed / PLANE.cruiseSpeed) * dt;
  // Lift: pitch and throttle climb, speed keeps you up.
  const flying = p.speed > PLANE.minSpeed;
  let vy = 0;
  if (flying) {
    vy = Math.sin(p.pitch) * PLANE.climbRate * (0.5 + p.throttle) - 0.6;
    vy += (p.throttle - 0.35) * 3.2;
  } else if (!p.onGround) {
    vy = -PLANE.sinkRate * 1.8; // stalled: the nose drops, you sink fast
    ev.stalled = true;
  }
  p.vspeed = vy;
  // Move.
  const dirX = -Math.sin(p.heading);
  const dirZ = -Math.cos(p.heading);
  p.x += dirX * p.speed * Math.cos(p.pitch) * dt;
  p.z += dirZ * p.speed * Math.cos(p.pitch) * dt;
  p.y += vy * dt;
  p.propAngle += (2 + p.throttle * 38) * dt;
  // Keep inside the map: soft wall pushes the nose back.
  const m = 1150;
  if (Math.abs(p.x) > m || Math.abs(p.z) > m) {
    p.heading += Math.PI * dt * 0.8;
    p.x = Math.max(-m, Math.min(m, p.x));
    p.z = Math.max(-m, Math.min(m, p.z));
  }
  // Ground and water.
  const ground = heightAt(p.x, p.z);
  const overLake =
    Math.hypot((p.x - WORLD.lake.x) / WORLD.lake.rx, (p.z - WORLD.lake.z) / WORLD.lake.rz) < 1;
  const surface = overLake ? WORLD.waterLevel : ground;
  if (p.y <= surface + 0.6) {
    p.y = surface + 0.6;
    if (p.onGround) {
      // Rolling on the strip (or a field, roughly).
      if (p.speed > PLANE.crashSpeed && Math.abs(p.pitch) > 0.15) {
        ev.crashed = true;
      }
    } else if (overLake) {
      // Ditching in the lake at speed is a crash; slow is a scoop run.
      if (p.speed > 24) ev.crashed = true;
      else p.onGround = true;
    } else {
      // Touchdown: fast on the strip is a landing, anywhere else is a crash.
      const strip = onStrip(p.x, p.z);
      if (strip && p.speed < PLANE.crashSpeed + 14) {
        p.onGround = true;
        ev.landed = true;
      } else {
        ev.crashed = true;
      }
    }
    if (p.onGround && p.speed < 2) p.speed = Math.max(0, p.speed - 8 * dt);
  } else {
    p.onGround = false;
  }
  // Take off: enough speed and a pull on the stick.
  if (p.onGround && p.speed > PLANE.minSpeed + 4 && input.pitch > 0.2) {
    p.onGround = false;
    p.y += 0.5;
  }
  // Fuel burn; empty tanks mean a glide to the nearest field.
  const burn =
    (PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * p.throttle) * dt;
  p.fuel = Math.max(0, p.fuel - burn);
  if (p.fuel <= 0) p.throttle = 0;
  return ev;
}

// Model matrix for the aircraft in the world: translate, then yaw (heading),
// then pitch and roll around its own axes.
export function planeMatrix(p) {
  // Positive roll banks right (input D): the right wing drops, so the
  // model rotates by -roll about its long axis (the nose is -z). This
  // matches the turn: positive roll decreases the heading, which turns
  // the nose right (heading 0 = north, -90 deg = east).
  let m = matTranslate(p.x, p.y, p.z);
  m = matMultiply(m, matRotateY(p.heading));
  m = matMultiply(m, matRotateX(p.pitch));
  m = matMultiply(m, matRotateZ(-p.roll));
  return m;
}

export function propMatrix(p) {
  let m = planeMatrix(p);
  m = matMultiply(m, matTranslate(0, 0.15, -4.35));
  m = matMultiply(m, matRotateZ(p.propAngle));
  return m;
}
