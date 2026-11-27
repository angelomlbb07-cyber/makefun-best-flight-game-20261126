// The 3D scene: chase camera, golden-hour sky, terrain, water, buildings,
// trees, fire billboards, smoke, drop rings, the aircraft and particles.
// All geometry is vertex-coloured; the sun and the fog do the lighting.

import { PALETTE, WORLD } from './config.js';
import {
  matIdentity,
  matLookAt,
  matMultiply,
  matPerspective,
  matRotateX,
  matRotateY,
  matRotateZ,
  matScale,
  matTranslate,
  MeshBuilder,
} from './gl.js';
import { planeMatrix, propMatrix } from './plane.js';

const SUN_DIR = [0.55, 0.42, 0.72];

// A billboard polygon facing the camera (upright, yaw only), built as a
// triangle fan around its centre — an 8-gon reads as a puff, not a card.
function billboardPoly(b, cam, x, y, z, w, hgt, color, n = 8, pinch = 0) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  const len = Math.hypot(dx, dz) || 1;
  const rx = -dz / len;
  const rz = dx / len;
  const cx = x;
  const cy = y;
  const cz = z;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    let px = Math.cos(a) * (w / 2);
    let py = Math.sin(a) * (hgt / 2);
    // pinch > 0 pulls the top half narrower, making a pointed flame.
    if (pinch > 0 && py > 0) px *= 1 - pinch * (py / (hgt / 2));
    pts.push([cx + rx * px, cy + py, cz + rz * px]);
  }
  for (let i = 0; i < n; i++) {
    b.tri([cx, cy, cz], pts[i], pts[(i + 1) % n], color);
  }
}

// A billboard quad facing the camera, centred at (x, y, z) with size s.
// The quad is built in world space each frame (cheap: a handful of quads).
function billboardQuad(b, cam, x, y, z, s, color, aspect = 1) {
  // Right and up vectors from the camera's view: recompute from yaw only
  // (billboards stay upright, they only yaw to face the camera).
  const dx = x - cam.x;
  const dz = z - cam.z;
  const len = Math.hypot(dx, dz) || 1;
  const rx = -dz / len;
  const rz = dx / len;
  const hw = (s * aspect) / 2;
  const hh = s / 2;
  const a = [x - rx * hw, y - hh, z - rz * hw];
  const bb = [x + rx * hw, y - hh, z + rz * hw];
  const c = [x + rx * hw, y + hh, z + rz * hw];
  const d = [x - rx * hw, y + hh, z - rz * hw];
  b.quad(a, bb, c, d, color);
}

// The ring that marks a drop zone: a flat annulus hovering over a fire,
// drawn as a segmented ring of small quads (cheap, reads as a target).
function ringMesh(b, x, y, z, r, color, segments = 28) {
  const w = 2.2;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
    const p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    const p2 = [x + Math.cos(a1) * (r + w), y, z + Math.sin(a1) * (r + w)];
    const p3 = [x + Math.cos(a0) * (r + w), y, z + Math.sin(a0) * (r + w)];
    b.quad(p0, p1, p2, p3, color);
  }
}

export function createRenderer(gl, world) {
  return { gl, world, time: 0 };
}

// cam: {x, y, z} camera position, computed from the plane in main.js.
export function renderScene(r, program, state, cam) {
  const gl = r.gl;
  const loc = program.loc;
  const w = gl.canvas.width;
  const h = gl.canvas.height;
  gl.viewport(0, 0, w, h);
  gl.clearColor(0.94, 0.68, 0.45, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(program.prog);
  const proj = matPerspective((62 * Math.PI) / 180, w / h, 0.5, 4200);
  // The cockpit camera carries its own up vector (rolled with the wings);
  // the chase camera stays level.
  const up = cam.ux === undefined ? [0, 1, 0] : [cam.ux, cam.uy, cam.uz];
  const view = matLookAt(
    [cam.x, cam.y, cam.z],
    [cam.tx, cam.ty, cam.tz],
    up,
  );
  gl.uniformMatrix4fv(loc.uProj, false, proj);
  gl.uniformMatrix4fv(loc.uView, false, view);
  gl.uniform3fv(loc.uSunDir, SUN_DIR);
  gl.uniform3fv(loc.uFogColor, PALETTE.fog);
  gl.uniform1f(loc.uFogNear, 500);
  gl.uniform1f(loc.uFogFar, 2600);
  gl.uniform1f(loc.uEmissive, 0);
  gl.uniform1f(loc.uAlpha, 1);
  const I = matIdentity();
  // Sky dome first, centred on the camera, fog pushed far out and the
  // colour mostly emissive so the gradient reads as the sky itself.
  gl.disable(gl.DEPTH_TEST);
  {
    gl.uniform1f(loc.uFogNear, 10000);
    gl.uniform1f(loc.uFogFar, 20000);
    gl.uniform1f(loc.uEmissive, 0.85);
    r.world.sky.draw(program, matTranslate(cam.x, 0, cam.z));
    gl.uniform1f(loc.uEmissive, 0);
    gl.uniform1f(loc.uFogNear, 500);
    gl.uniform1f(loc.uFogFar, 2600);
  }
  // Sky sun disc: a bright billboard far away, drawn with depth off.
  {
    const b = new MeshBuilder();
    const sunX = cam.x + SUN_DIR[0] * 3000;
    const sunY = 700;
    const sunZ = cam.z + SUN_DIR[2] * 3000;
    billboardQuad(b, cam, sunX, sunY, sunZ, 170, PALETTE.sun);
    const mesh = b.build(gl);
    gl.uniform1f(loc.uEmissive, 0.9);
    mesh.draw(program, I);
    gl.uniform1f(loc.uEmissive, 0);
  }
  gl.enable(gl.DEPTH_TEST);
  // Opaque world.
  r.world.terrain.draw(program, I);
  r.world.runway.draw(program, I);
  r.world.town.mesh.draw(program, I);
  r.world.station.mesh.draw(program, I);
  r.world.trees.draw(program, I);
  // Water: transparent, drawn after the opaque ground.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1f(loc.uAlpha, 0.86);
  r.world.water.draw(program, I);
  gl.uniform1f(loc.uAlpha, 1);
  gl.disable(gl.BLEND);
  // Drop rings over live fires, pulsing gently.
  {
    const b = new MeshBuilder();
    for (const f of state.mission.fires) {
      if (f.out) continue;
      const pulse = 1 + 0.06 * Math.sin(r.time * 3 + f.x);
      const y = 26 + 4 * Math.sin(r.time * 1.4 + f.z);
      ringMesh(b, f.x, y, f.z, (f.r + 26) * pulse, [1.0, 0.85, 0.2]);
    }
    if (b.idx.length > 0) b.build(gl).draw(program, I);
  }
  // Fires: flame billboards + scorch discs + smoke columns.
  {
    const b = new MeshBuilder();
    for (const f of state.mission.fires) {
      if (f.out) continue;
      // Scorch disc on the ground.
      const seg = 18;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        const y = 0.4;
        b.tri(
          [f.x, y, f.z],
          [f.x + Math.cos(a1) * f.r, y, f.z + Math.sin(a1) * f.r],
          [f.x + Math.cos(a0) * f.r, y, f.z + Math.sin(a0) * f.r],
          [0.12, 0.09, 0.07],
        );
      }
      // Flames: pointed billboards, flickering with time.
      const n = 5;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + f.x * 0.01;
        const rr = f.r * 0.55;
        const fx = f.x + Math.cos(ang) * rr;
        const fz = f.z + Math.sin(ang) * rr;
        const flick = 0.75 + 0.25 * Math.sin(r.time * 9 + i * 2.1 + f.z);
        const hgt = (10 + f.intensity * 0.22) * flick;
        const col = i % 2 === 0 ? PALETTE.fireMid : PALETTE.fireCore;
        billboardPoly(b, cam, fx, hgt / 2 + 1, fz, hgt * 0.55, hgt, col, 4, 0.55);
      }
    }
    if (b.idx.length > 0) {
      gl.uniform1f(loc.uEmissive, 0.35);
      b.build(gl).draw(program, I);
      gl.uniform1f(loc.uEmissive, 0);
    }
    // Smoke: smaller, lighter, translucent puffs rising and drifting, so
    // they read as smoke and not as solid black cards in front of the plane.
    const sb = new MeshBuilder();
    for (const f of state.mission.fires) {
      if (f.out) continue;
      for (let i = 0; i < 4; i++) {
        const ph = (r.time * 0.12 + i * 0.25 + f.x * 0.001) % 1;
        const sx = f.x + Math.sin(i * 2.4) * f.r * 0.4 + ph * 26;
        const sz = f.z + Math.cos(i * 1.7) * f.r * 0.4 + ph * 14;
        const sy = 8 + ph * 95;
        const size = 10 + ph * 22;
        const shade = 0.45 - ph * 0.15;
        billboardPoly(sb, cam, sx, sy, sz, size, size, [shade, shade, shade], 8);
      }
    }
    if (sb.idx.length > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(loc.uAlpha, 0.5);
      sb.build(gl).draw(program, I);
      gl.uniform1f(loc.uAlpha, 1);
      gl.disable(gl.BLEND);
    }
  }
  // Water drops in flight and the splash where they land.
  {
    const b = new MeshBuilder();
    for (const d of state.drops) {
      const s = 3 + d.age * 1.2;
      billboardPoly(b, cam, d.x, d.y, d.z, s, s, [0.55, 0.78, 1.0], 8);
    }
    for (const s of state.splashes) {
      const size = 5 + s.age * 18;
      billboardPoly(b, cam, s.x, s.y + 1, s.z, size, size, [0.75, 0.88, 1.0], 8);
    }
    if (b.idx.length > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(loc.uAlpha, 0.55);
      gl.uniform1f(loc.uEmissive, 0.25);
      b.build(gl).draw(program, I);
      gl.uniform1f(loc.uAlpha, 1);
      gl.uniform1f(loc.uEmissive, 0);
      gl.disable(gl.BLEND);
    }
  }
  // The aircraft: from the cockpit you see its interior and its nose,
  // not its outside. The prop blades are NOT drawn in cockpit view:
  // two solid dark blades spinning right ahead of the windscreen read
  // as a black pillar across the pilot's view in a still frame. The
  // spinner is part of the cockpit mesh, so the nose still reads.
  // From the chase view you see the whole plane, prop included.
  const pm = planeMatrix(state.plane);
  if (state.cockpit && state.cockpitMesh) {
    state.cockpitMesh.draw(program, pm);
  } else {
    state.planeMesh.draw(program, pm);
    state.propMesh.draw(program, propMatrix(state.plane));
  }
  // Clouds: rounded puffs drifting high up, bright (emissive) so they
  // read white against the sky instead of grey cards.
  {
    const b = new MeshBuilder();
    for (let i = 0; i < 7; i++) {
      const cx = -900 + i * 300 + Math.sin(i * 3.3) * 120 + r.time * 1.5;
      const cz = -700 + ((i * 397) % 1400);
      const cyc = ((cx + 1200) % 2400) - 1200;
      billboardPoly(b, cam, cyc, 330 + (i % 3) * 40, cz, 260, 90, [0.98, 0.94, 0.9], 8);
      billboardPoly(b, cam, cyc + 90, 310 + (i % 3) * 40, cz, 150, 60, [0.98, 0.94, 0.9], 8);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(loc.uAlpha, 0.85);
    gl.uniform1f(loc.uEmissive, 0.75);
    b.build(gl).draw(program, I);
    gl.uniform1f(loc.uAlpha, 1);
    gl.uniform1f(loc.uEmissive, 0);
    gl.disable(gl.BLEND);
  }
}

// Chase camera: behind and above the plane, smoothed, looking ahead.
// Returns {x, y, z, tx, ty, tz} — eye and target.
export function chaseCamera(p, dt, prev) {
  const back = 26;
  const up = 7.5;
  const dirX = -Math.sin(p.heading);
  const dirZ = -Math.cos(p.heading);
  // Eye trails behind the nose; the target is ahead of the plane.
  const ex = p.x - dirX * back;
  const ez = p.z - dirZ * back;
  const ey = Math.max(p.y + up, 4);
  const tx = p.x + dirX * 34;
  const ty = p.y + Math.sin(p.pitch) * 20 - 2;
  const tz = p.z + dirZ * 34;
  const k = Math.min(1, dt * 4.5);
  prev.x += (ex - prev.x) * k;
  prev.y += (ey - prev.y) * k;
  prev.z += (ez - prev.z) * k;
  prev.tx += (tx - prev.tx) * k;
  prev.ty += (ty - prev.ty) * k;
  prev.tz += (tz - prev.tz) * k;
  return prev;
}

export function cameraMatrixForShot(p, kind) {
  // Fixed cameras for the staged screenshots (see shots.js).
  const dirX = -Math.sin(p.heading);
  const dirZ = -Math.cos(p.heading);
  if (kind === 'hero') {
    return {
      x: p.x - dirX * 34,
      y: p.y + 10,
      z: p.z - dirZ * 34,
      tx: p.x,
      ty: p.y,
      tz: p.z,
    };
  }
  return {
    x: p.x - dirX * 26,
    y: p.y + 7.5,
    z: p.z - dirZ * 26,
    tx: p.x + dirX * 34,
    ty: p.y - 2,
    tz: p.z + dirZ * 34,
  };
}
