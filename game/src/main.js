// EMBERLINE: Fire Season — boot, game loop and state machine.
// Screens: title → fly ⇄ pause → win / gameover. The loop runs the flight
// model at a fixed step and renders every animation frame.

import { WORLD, PLANE } from './config.js';
import { createProgram } from './gl.js';
import {
  buildRunwayMesh,
  buildSkyDome,
  buildStation,
  buildTerrainMesh,
  buildTown,
  buildTrees,
  buildWaterMesh,
  heightAt,
} from './world.js';
import { buildPlaneMesh, buildPropMesh, newPlane, stepPlane } from './plane.js';
import { newMission, stepMission, nearestFire } from './missions.js';
import { newInput, attachInput, readControls, pressed } from './input.js';
import { newAudio, startAudio, setMuted, updateAudio, sfx } from './audio.js';
import { drawHUD, drawTitle, drawPause, drawGameOver, drawWin } from './hud.js';
import { createRenderer, renderScene, chaseCamera, cameraMatrixForShot } from './render.js';
import { parseShot, stageShot } from './shots.js';

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const hudCtx = hudCanvas.getContext('2d');

window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  if (el) el.textContent = 'Error: ' + e.message;
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const c of [glCanvas, hudCanvas]) {
    c.width = w;
    c.height = h;
  }
}
window.addEventListener('resize', resize);
resize();

const gl = glCanvas.getContext('webgl', { antialias: true });
if (!gl) {
  document.getElementById('err').textContent =
    'WebGL is not available in this browser.';
  throw new Error('no webgl');
}
const program = createProgram(gl);

const world = {
  terrain: buildTerrainMesh(gl),
  water: buildWaterMesh(gl),
  runway: buildRunwayMesh(gl),
  town: buildTown(gl),
  station: buildStation(gl),
  trees: buildTrees(gl),
  sky: buildSkyDome(gl),
};

const renderer = createRenderer(gl, world);
const input = newInput();
attachInput(input, hudCanvas);
const audio = newAudio();

const shot = parseShot(window.location.search);
const staged = shot.shot ? stageShot(shot.shot) : null;

const state = {
  screen: staged ? staged.screen : 'title',
  plane: staged ? staged.plane : newPlane(),
  mission: staged ? staged.mission : newMission(),
  planeMesh: buildPlaneMesh(gl),
  propMesh: buildPropMesh(gl),
  drops: [], // water blobs in flight {x,y,z,vy,age}
  splashes: [], // expanding rings where water landed {x,y,z,age}
  dropping: staged ? !!staged.dropping : false,
  stagedDrop: staged ? !!staged.dropping : false, // ?shot=drop releases water on its own
  anchor: staged ? staged.anchor || null : null, // ?shot=play|drop holds the plane in place
  nearestFire: null,
  overLake: false,
  stalled: false,
  cam: { x: 420, y: 40, z: -380, tx: 420, ty: 14, tz: -420 },
  time: 0,
  fireOutCount: 0,
};

function resetGame() {
  state.plane = newPlane();
  state.mission = newMission();
  state.drops = [];
  state.splashes = [];
  state.dropping = false;
  state.screen = 'fly';
  state.fireOutCount = 0;
  state.cam = {
    x: state.plane.x,
    y: 40,
    z: state.plane.z - 30,
    tx: state.plane.x,
    ty: 14,
    tz: state.plane.z,
  };
}

// Scoop check: low and slow over the lake, skimming the water.
function overLake(x, z) {
  return Math.hypot((x - WORLD.lake.x) / WORLD.lake.rx, (z - WORLD.lake.z) / WORLD.lake.rz) < 1;
}

function step(dt) {
  const p = state.plane;
  const m = state.mission;
  const controls = readControls(input, hudCanvas.width);
  if (pressed(input, 'm')) {
    setMuted(audio, !audio.muted);
  }
  if (state.screen === 'title') {
    if (pressed(input, 'enter') || input.clicked) {
      startAudio(audio);
      sfx.click(audio);
      state.screen = 'fly';
      input.clicked = null;
    }
    return;
  }
  if (state.screen === 'pause') {
    if (pressed(input, 'p') || pressed(input, 'enter')) state.screen = 'fly';
    if (pressed(input, 'r')) resetGame();
    return;
  }
  if (state.screen === 'win' || state.screen === 'gameover') {
    if (pressed(input, 'r') || pressed(input, 'enter')) resetGame();
    return;
  }
  // Flying.
  if (pressed(input, 'p')) {
    state.screen = 'pause';
    return;
  }
  if (pressed(input, 'r')) {
    resetGame();
    return;
  }
  const ev = stepPlane(p, controls, dt);
  state.stalled = ev.stalled;
  // Scooping: skimming the lake fills the tank.
  state.overLake = overLake(p.x, p.z);
  if (state.overLake && !p.onGround && p.y < WORLD.waterLevel + 5 && p.speed > 14 && p.speed < 42) {
    if (p.tank < 100) {
      const before = p.tank;
      p.tank = Math.min(100, p.tank + 55 * dt);
      if (before < 100 && p.tank >= 100) sfx.scoop(audio);
      if (Math.random() < dt * 20) {
        state.splashes.push({ x: p.x, y: WORLD.waterLevel, z: p.z, age: 0 });
      }
    }
  }
  // Dropping: Space releases water while the tank lasts. The staged drop
  // screenshot releases continuously (tank topped up) so water is always
  // in the air when the frame is taken.
  if (state.stagedDrop) p.tank = Math.max(p.tank, 55);
  const wantDrop = controls.drop || state.stagedDrop;
  state.dropping = wantDrop && p.tank > 0 && !p.onGround;
  if (state.dropping) {
    p.tank = Math.max(0, p.tank - 90 * dt);
    if (Math.random() < dt * 14) {
      state.drops.push({
        x: p.x + (Math.random() - 0.5) * 12,
        y: p.y - 1,
        z: p.z + (Math.random() - 0.5) * 12,
        vy: -6,
        age: 0,
      });
    }
    if (Math.random() < dt * 6) sfx.drop(audio);
  }
  // Water blobs fall and land.
  const impacts = [];
  for (const d of state.drops) {
    d.age += dt;
    d.vy -= 22 * dt;
    d.y += d.vy * dt;
    d.x += -Math.sin(p.heading) * p.speed * 0.4 * dt;
    d.z += -Math.cos(p.heading) * p.speed * 0.4 * dt;
    const ground = overLake(d.x, d.z) ? WORLD.waterLevel : heightAt(d.x, d.z);
    if (d.y <= ground + 0.5) {
      impacts.push({ x: d.x, z: d.z, amount: 60 });
      state.splashes.push({ x: d.x, y: ground + 0.5, z: d.z, age: 0 });
    }
  }
  state.drops = state.drops.filter((d) => {
    const ground = overLake(d.x, d.z) ? WORLD.waterLevel : heightAt(d.x, d.z);
    return d.y > ground + 0.5 && d.age < 6;
  });
  for (const s of state.splashes) s.age += dt;
  state.splashes = state.splashes.filter((s) => s.age < 1.2);
  // Fires and scoring. The staged drop screenshot is visual only: its
  // water falls and splashes, but the fire keeps burning for the photo
  // (in real play the same drops put fires out).
  const beforeOut = m.firesOut;
  stepMission(m, state.stagedDrop ? [] : impacts, dt, world.town, world.station);
  if (m.firesOut > beforeOut) sfx.fireOut(audio);
  // Heat damage: low over a live fire cooks the hull. Below 42 m you are
  // in the plume; dropping from 55 m is safe, diving lower is the risk
  // you take for a more accurate drop.
  for (const f of m.fires) {
    if (f.out) continue;
    const d = Math.hypot(f.x - p.x, f.z - p.z);
    if (d < f.r + 30 && p.y < 42) {
      p.hull = Math.max(0, p.hull - PLANE.heatDamage * dt);
    }
  }
  // Refuel and repair on the strip.
  if (p.onGround) {
    const nearStrip =
      Math.hypot(p.x - WORLD.strip.x, p.z - WORLD.strip.z) < WORLD.strip.length;
    if (nearStrip && p.speed < 6) {
      p.fuel = Math.min(100, p.fuel + 14 * dt);
      p.hull = Math.min(100, p.hull + 6 * dt);
    }
  }
  // Crash / out of fuel over rough ground.
  if (ev.crashed || p.hull <= 0) {
    sfx.crash(audio);
    state.screen = 'gameover';
    if (!m.loseReason) m.loseReason = 'The aircraft is down.';
    return;
  }
  if (m.won) {
    sfx.win(audio);
    state.screen = 'win';
    return;
  }
  if (m.lost) {
    sfx.crash(audio);
    state.screen = 'gameover';
    return;
  }
  if (p.fuel <= 0 && p.onGround && p.speed < 2) {
    // Ran dry on the ground away from the strip: the sortie is over.
    const nearStrip =
      Math.hypot(p.x - WORLD.strip.x, p.z - WORLD.strip.z) < WORLD.strip.length;
    if (!nearStrip) {
      m.loseReason = 'Out of fuel, down in the bush.';
      state.screen = 'gameover';
      return;
    }
  }
  // Alarms.
  if ((p.fuel < PLANE.fuelCapacity * 0.25 && p.fuel > 0) || p.hull < 30) {
    if (Math.random() < dt * 0.7) sfx.alarm(audio);
  }
  state.nearestFire = nearestFire(m, p.x, p.z);
  updateAudio(audio, p.throttle, p.speed, p.onGround);
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  renderer.time += dt;
  state.time += dt;
  if (state.screen === 'fly') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    // Staged screenshots hold the plane on its anchor: the world animates
    // around it, but the fire and the ring stay in frame.
    if (state.anchor) {
      state.plane.x = state.anchor.x;
      state.plane.y = state.anchor.y;
      state.plane.z = state.anchor.z;
      state.plane.heading = state.anchor.heading;
    }
  } else if (state.screen === 'title' || state.screen === 'win' || state.screen === 'gameover') {
    // Menus still animate the world behind them; a title keypress is read
    // through the same step so Enter/click works.
    step(0);
    // Gentle orbit for the title backdrop.
    if (state.screen === 'title') {
      const t = renderer.time * 0.05;
      state.plane.heading = 0.5 + Math.sin(t) * 0.1;
    }
  }
  // Camera.
  const p = state.plane;
  if (state.screen === 'title') {
    const t = renderer.time * 0.04;
    const cx = 420 + Math.sin(t) * 260;
    const cz = -420 + Math.cos(t) * 260;
    state.cam.x = cx;
    state.cam.y = 90;
    state.cam.z = cz;
    state.cam.tx = -100;
    state.cam.ty = 30;
    state.cam.tz = 100;
  } else if (state.anchor && shot.shot === 'drop') {
    // Three-quarter view for the drop shot: the camera sits off the
    // plane's right side and looks at the fire, so the falling water
    // reads as a trail instead of a column.
    const f = state.mission.fires[1];
    const fx = -Math.sin(p.heading);
    const fz = -Math.cos(p.heading);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const ex = p.x - fx * 24 + rx * 18;
    const ez = p.z - fz * 24 + rz * 18;
    const ey = Math.max(p.y + 8, 10);
    const k = Math.min(1, dt * 4.5);
    state.cam.x += (ex - state.cam.x) * k;
    state.cam.y += (ey - state.cam.y) * k;
    state.cam.z += (ez - state.cam.z) * k;
    state.cam.tx += (f.x - state.cam.tx) * k;
    state.cam.ty += (26 - state.cam.ty) * k;
    state.cam.tz += (f.z - state.cam.tz) * k;
  } else if (shot.shot && state.screen !== 'fly') {
    const c = cameraMatrixForShot(p, 'hero');
    state.cam = c;
  } else {
    chaseCamera(p, dt, state.cam);
  }
  renderScene(renderer, program, state, state.cam);
  // Overlay.
  const w = hudCanvas.width;
  const h = hudCanvas.height;
  if (state.screen === 'title') {
    drawHUD(hudCtx, w, h, state);
    drawTitle(hudCtx, w, h);
  } else if (state.screen === 'pause') {
    drawHUD(hudCtx, w, h, state);
    drawPause(hudCtx, w, h);
  } else if (state.screen === 'gameover') {
    drawHUD(hudCtx, w, h, state);
    drawGameOver(hudCtx, w, h, state);
  } else if (state.screen === 'win') {
    drawHUD(hudCtx, w, h, state);
    drawWin(hudCtx, w, h, state);
  } else {
    drawHUD(hudCtx, w, h, state);
  }
}

requestAnimationFrame(frame);
