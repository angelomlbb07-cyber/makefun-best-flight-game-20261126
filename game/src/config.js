// EMBERLINE: Fire Season — tuning constants. One place for every number the
// flight model, the world and the missions share, so a balance change is one edit.

// World: a forested mountain valley, 2400 x 2400 m, lake in the middle,
// airstrip on the valley floor, a town on the lakeshore, a ranger station
// on the ridge. Y is up; the ground height comes from world.heightAt().
export const WORLD = {
  size: 2400,
  half: 1200,
  waterLevel: 6.0,
  lake: { x: -260, z: 120, rx: 320, rz: 240 },
  strip: { x: 420, z: -420, heading: 0.5, length: 420, width: 26 },
  town: { x: -80, z: 330 },
  station: { x: 620, z: 520 },
  seed: 20261126,
};

// Flight model (arcade, but honest: speed, lift and stall all matter).
export const PLANE = {
  minSpeed: 16, // m/s — below this the wing stops flying
  maxSpeed: 78,
  cruiseSpeed: 46,
  climbRate: 9, // m/s at full throttle, level
  sinkRate: 6, // m/s gliding at idle
  rollRate: 1.25, // max bank angle (rad) at full deflection
  pitchRate: 0.9, // max pitch angle (rad) at full deflection
  turnRate: 0.55, // heading rad/s at full bank
  throttleRate: 0.7, // per second
  tankCapacity: 100, // water units
  scoopRate: 55, // units per second over the lake, low and slow
  dropRate: 90, // units per second while dropping
  fuelCapacity: 160, // one tank covers a full three-front sortie with margin
  fuelBurn: 0.55, // units per second at full throttle
  fuelBurnIdle: 0.12,
  hullMax: 100,
  heatDamage: 10, // hull per second inside a fire plume
  crashSpeed: 26, // hitting ground faster than this is a crash
};

// Fires: each front is a circle that grows until water puts it out.
export const FIRE = {
  growRate: 0.35, // metres of radius per second
  maxRadius: 170,
  spreadEmber: 0.02, // chance per second to throw a spot fire nearby
  dropKill: 10, // intensity removed by a full-tank drop inside the radius
  intensityMax: 100,
  waterRadius: 46, // a drop wets this radius around its impact
};

// Scoring: acres saved is the headline; fires out and time are the rest.
export const SCORE = {
  perFireOut: 500,
  perAcreSaved: 25,
  townSaveBonus: 1200,
  stationSaveBonus: 800,
  timeBonusPerSecond: 2,
};

// Colours (linear-ish, chosen for a golden-hour valley: warm sky, green
// forest, orange fire, blue lake).
export const PALETTE = {
  skyTop: [0.36, 0.55, 0.85],
  skyHorizon: [0.98, 0.72, 0.42],
  fog: [0.94, 0.68, 0.45],
  sun: [1.0, 0.82, 0.45],
  grass: [0.23, 0.48, 0.2],
  grassDry: [0.55, 0.5, 0.24],
  rock: [0.6, 0.56, 0.5],
  sand: [0.78, 0.7, 0.5],
  forest: [0.13, 0.34, 0.14],
  water: [0.16, 0.42, 0.62],
  runway: [0.16, 0.16, 0.18],
  runwayMark: [0.92, 0.92, 0.88],
  roof: [0.72, 0.3, 0.18],
  wall: [0.88, 0.82, 0.7],
  fireCore: [1.0, 0.75, 0.15],
  fireMid: [1.0, 0.42, 0.08],
  smoke: [0.25, 0.23, 0.22],
  planeRed: [0.78, 0.16, 0.1],
  planeWhite: [0.94, 0.93, 0.9],
  planeYellow: [0.98, 0.78, 0.15],
};
