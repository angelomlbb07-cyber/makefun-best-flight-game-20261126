// The valley: terrain height, lake, airstrip, town, ranger station, trees.
// Every height comes from one function, heightAt(x, z), so the flight model,
// the terrain mesh and the trees all agree on where the ground is.

import { WORLD, PALETTE } from './config.js';
import { makeNoise2D, mulberry32 } from './random.js';
import { MeshBuilder } from './gl.js';

const noise = makeNoise2D(WORLD.seed);
const { lake, strip, town, station } = WORLD;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Distance from a point to the airstrip rectangle, in strip-local metres
// (negative inside the rectangle). The strip is rotated by its heading.
function stripDistance(x, z) {
  const dx = x - strip.x;
  const dz = z - strip.z;
  const c = Math.cos(-strip.heading);
  const s = Math.sin(-strip.heading);
  const u = dx * c - dz * s;
  const v = dx * s + dz * c;
  const du = Math.abs(u) - strip.length / 2;
  const dv = Math.abs(v) - strip.width / 2;
  if (du <= 0 && dv <= 0) return Math.max(du, dv);
  return Math.hypot(Math.max(du, 0), Math.max(dv, 0));
}

export function onStrip(x, z) {
  return stripDistance(x, z) < 4;
}

export function heightAt(x, z) {
  // Rolling hills from two octaves of value noise.
  let h = 18 + noise(x / 260, z / 260) * 26 + noise(x / 90, z / 90) * 8;
  // Mountains rising toward the edges of the map: a gentle ring that
  // frames the valley without walling the playable air in. The rise
  // starts at 75% of the way out and tops out at ~140 m at the map edge,
  // so a tanker at 100 m clears everything inside the valley.
  const d = Math.max(Math.abs(x), Math.abs(z)) / WORLD.half;
  const edge = Math.max(0, d - 0.75) / 0.25;
  h += edge * edge * 140;
  // Lake basin: ground sinks below the waterline inside the ellipse.
  const lx = (x - lake.x) / lake.rx;
  const lz = (z - lake.z) / lake.rz;
  const ld = Math.sqrt(lx * lx + lz * lz);
  const basin = smoothstep(1.15, 0.55, ld);
  h = h * (1 - basin) + (WORLD.waterLevel - 4) * basin;
  // Airstrip: flat apron at 14 m.
  const sd = stripDistance(x, z);
  const flat = smoothstep(90, 30, sd);
  h = h * (1 - flat) + 14 * flat;
  // Town shelf: gentle flattening around the lakeshore town.
  const td = Math.hypot(x - town.x, z - town.z);
  const tflat = smoothstep(170, 60, td);
  h = h * (1 - tflat * 0.7) + 12 * (tflat * 0.7);
  return h;
}

// Where the three fire fronts start: one threatens the town, one the ranger
// station, one burns alone in the far canyon.
export const FIRE_SPOTS = [
  // Placed so the fronts genuinely threaten what they are named for: the
  // Lakeside front reaches the town once its radius passes ~124 m
  // (about 2.5 minutes in), the Ridge front reaches the station at ~96 m.
  { name: 'Lakeside', x: -220, z: 450, r: 42, target: 'town' },
  { name: 'Ridge', x: 720, z: 640, r: 38, target: 'station' },
  { name: 'Canyon', x: -720, z: -720, r: 48, target: 'none' },
];

function terrainColor(x, z, h, slope) {
  const n = noise(x / 60 + 40, z / 60 + 40);
  if (h < WORLD.waterLevel + 1.2) return PALETTE.sand;
  if (slope > 0.55 || h > 130) return PALETTE.rock;
  if (h > 55 && n > 0.15) return PALETTE.grassDry;
  if (n > 0.35) return [0.16, 0.38, 0.16];
  return PALETTE.grass;
}

export function buildTerrainMesh(gl) {
  const cells = 96;
  const step = WORLD.size / cells;
  const verts = cells + 1;
  const b = new MeshBuilder();
  const heights = new Float32Array(verts * verts);
  for (let iz = 0; iz < verts; iz++) {
    for (let ix = 0; ix < verts; ix++) {
      const x = -WORLD.half + ix * step;
      const z = -WORLD.half + iz * step;
      heights[iz * verts + ix] = heightAt(x, z);
    }
  }
  const H = (ix, iz) =>
    heights[Math.min(verts - 1, Math.max(0, iz)) * verts + Math.min(verts - 1, Math.max(0, ix))];
  for (let iz = 0; iz < cells; iz++) {
    for (let ix = 0; ix < cells; ix++) {
      const x0 = -WORLD.half + ix * step;
      const z0 = -WORLD.half + iz * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const h00 = H(ix, iz);
      const h10 = H(ix + 1, iz);
      const h01 = H(ix, iz + 1);
      const h11 = H(ix + 1, iz + 1);
      // Slope from the cell's height differences, for rock vs grass.
      const slope = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00)) / step;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const ch = (h00 + h10 + h01 + h11) / 4;
      const color = terrainColor(cx, cz, ch, slope);
      // Two triangles; normals come from the triangle winding.
      b.tri([x0, h00, z0], [x1, h10, z0], [x1, h11, z1], color);
      b.tri([x0, h00, z0], [x1, h11, z1], [x0, h01, z1], color);
    }
  }
  return b.build(gl);
}

export function buildWaterMesh(gl) {
  const b = new MeshBuilder();
  const seg = 28;
  const cx = lake.x;
  const cz = lake.z;
  const y = WORLD.waterLevel;
  const c = PALETTE.water;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p0 = [cx + Math.cos(a0) * lake.rx, y, cz + Math.sin(a0) * lake.rz];
    const p1 = [cx + Math.cos(a1) * lake.rx, y, cz + Math.sin(a1) * lake.rz];
    b.tri([cx, y, cz], p1, p0, c);
  }
  return b.build(gl);
}

// The sky dome: a hemisphere centred on the camera, vertex-coloured from
// a warm golden horizon to a blue zenith, so the sky is a gradient and not
// a flat clear colour. Drawn first, with fog pushed out and the colour
// mostly emissive (its faces point outward, away from the viewer).
export function buildSkyDome(gl) {
  const b = new MeshBuilder();
  const R = 3600;
  const rings = 6;
  const segs = 16;
  const horizon = [0.99, 0.82, 0.58];
  const mid = [0.45, 0.62, 0.86];
  const top = [0.16, 0.35, 0.72];
  const lerp = (a, c, t) => a.map((v, i) => v + (c[i] - v) * t);
  const colorAt = (t) => (t < 0.18 ? lerp(horizon, mid, t / 0.18) : lerp(mid, top, (t - 0.18) / 0.82));
  const ringPoint = (ring, seg) => {
    const phi = (ring / rings) * (Math.PI / 2);
    const theta = (seg / segs) * Math.PI * 2;
    return [Math.cos(phi) * Math.cos(theta) * R, Math.sin(phi) * R, Math.cos(phi) * Math.sin(theta) * R];
  };
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segs; seg++) {
      const a = ringPoint(ring, seg);
      const c = ringPoint(ring, seg + 1);
      const d = ringPoint(ring + 1, seg + 1);
      const e = ringPoint(ring + 1, seg);
      const ca = colorAt(ring / rings);
      b.tri(a, c, d, ca);
      b.tri(a, d, e, ca);
    }
  }
  return b.build(gl);
}

export function buildRunwayMesh(gl) {
  const b = new MeshBuilder();
  const y = 14.25;
  const c = Math.cos(strip.heading);
  const s = Math.sin(strip.heading);
  const toWorld = (u, v) => [strip.x + u * c - v * s, y, strip.z + u * s + v * c];
  // The strip itself, slightly above the flattened ground.
  const L = strip.length / 2;
  const W = strip.width / 2;
  b.quad(
    toWorld(-L, -W),
    toWorld(L, -W),
    toWorld(L, W),
    toWorld(-L, W),
    PALETTE.runway,
  );
  // Centreline dashes.
  for (let u = -L + 30; u < L - 20; u += 40) {
    b.quad(
      toWorld(u, -1.2),
      toWorld(u + 20, -1.2),
      toWorld(u + 20, 1.2),
      toWorld(u, 1.2),
      PALETTE.runwayMark,
    );
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let v = -W + 3; v < W - 2; v += 5) {
      const u = end * (L - 12);
      b.quad(
        toWorld(u - 6, v),
        toWorld(u + 6, v),
        toWorld(u + 6, v + 2.4),
        toWorld(u - 6, v + 2.4),
        PALETTE.runwayMark,
      );
    }
  }
  // Hangar beside the strip.
  const hx = strip.x + 60;
  const hz = strip.z + 55;
  const hy = heightAt(hx, hz);
  b.box(hx, hy + 4, hz, 26, 8, 18, [0.6, 0.62, 0.66]);
  b.pyramid(hx, hy + 8, hz, 14, 5, [0.4, 0.42, 0.46]);
  // Windsock: pole and orange cone.
  const wx = strip.x - 40;
  const wz = strip.z - 30;
  const wy = heightAt(wx, wz);
  b.box(wx, wy + 5, wz, 0.5, 10, 0.5, [0.85, 0.85, 0.85]);
  b.pyramid(wx + 2, wy + 9.4, wz, 1.6, 3.4, [1.0, 0.45, 0.1]);
  return b.build(gl);
}

// The town: houses with warm roofs. Returns the mesh and each house's
// position, so the mission can damage the town when fire reaches it.
export function buildTown(gl) {
  const b = new MeshBuilder();
  const rand = mulberry32(WORLD.seed + 77);
  const houses = [];
  for (let i = 0; i < 14; i++) {
    const gx = (i % 7) * 26 - 78;
    const gz = Math.floor(i / 7) * 30 - 15;
    const x = town.x + gx + (rand() - 0.5) * 8;
    const z = town.z + gz + (rand() - 0.5) * 8;
    const y = heightAt(x, z);
    const w = 9 + rand() * 4;
    const d = 8 + rand() * 3;
    const h = 5 + rand() * 2;
    b.box(x, y + h / 2, z, w, h, d, PALETTE.wall);
    b.pyramid(x, y + h, z, Math.max(w, d) * 0.72, 3.2, PALETTE.roof);
    houses.push({ x, z, y: y + h, health: 100 });
  }
  // Town hall, bigger, in the middle.
  const hx = town.x;
  const hz = town.z + 8;
  const hy = heightAt(hx, hz);
  b.box(hx, hy + 4, hz, 16, 8, 12, PALETTE.wall);
  b.pyramid(hx, hy + 8, hz, 11, 5, PALETTE.roof);
  houses.push({ x: hx, z: hz, y: hy + 8, health: 100, hall: true });
  return { mesh: b.build(gl), houses };
}

// Ranger station on the ridge: a cabin and a lookout tower.
export function buildStation(gl) {
  const b = new MeshBuilder();
  const x = station.x;
  const z = station.z;
  const y = heightAt(x, z);
  b.box(x, y + 3, z, 12, 6, 10, PALETTE.wall);
  b.pyramid(x, y + 6, z, 8.5, 4, PALETTE.roof);
  // Lookout tower: four legs and a cabin on top.
  for (const [dx, dz] of [
    [-4, -4],
    [4, -4],
    [4, 4],
    [-4, 4],
  ]) {
    b.box(x + dx, y + 7, z + dz, 0.8, 14, 0.8, [0.35, 0.28, 0.2]);
  }
  b.box(x, y + 15, z, 10, 5, 10, [0.55, 0.45, 0.32]);
  b.pyramid(x, y + 17.5, z, 7, 3.5, PALETTE.roof);
  return { mesh: b.build(gl), x, z, y: y + 17.5, health: 100 };
}

// Pines: trunk plus two stacked crowns, batched into one mesh.
export function buildTrees(gl) {
  const b = new MeshBuilder();
  const rand = mulberry32(WORLD.seed + 913);
  let placed = 0;
  let tries = 0;
  while (placed < 650 && tries < 6000) {
    tries++;
    const x = (rand() * 2 - 1) * 1120;
    const z = (rand() * 2 - 1) * 1120;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel + 1 || h > 110) continue;
    if (stripDistance(x, z) < 70) continue;
    if (Math.hypot(x - town.x, z - town.z) < 130) continue;
    if (Math.hypot(x - station.x, z - station.z) < 40) continue;
    let nearFire = false;
    for (const f of FIRE_SPOTS) {
      if (Math.hypot(x - f.x, z - f.z) < f.r + 60) nearFire = true;
    }
    if (nearFire) continue;
    const s = 0.8 + rand() * 0.9;
    const trunkH = 3.2 * s;
    const crownR = 3.4 * s;
    const crownH = 9 * s;
    b.box(x, h + trunkH / 2, z, 0.9 * s, trunkH, 0.9 * s, [0.32, 0.22, 0.14]);
    b.pyramid(x, h + trunkH, z, crownR, crownH * 0.62, PALETTE.forest);
    b.pyramid(x, h + trunkH + crownH * 0.38, z, crownR * 0.68, crownH * 0.55, [
      0.16, 0.4, 0.16,
    ]);
    placed++;
  }
  return b.build(gl);
}
