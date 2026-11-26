// Seeded random numbers and smooth value noise. Everything the world
// builds from a seed is the same every run, so screenshots are repeatable
// and a flight can be replayed exactly.

// mulberry32: small, fast, good enough for placement and terrain.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise: a lattice of random heights, bilinearly blended
// with a smoothstep, plus two octaves for detail.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const N = 256;
  const grid = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) grid[i] = rand() * 2 - 1;
  const at = (ix, iz) => grid[((iz % N + N) % N) * N + ((ix % N + N) % N)];
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = smooth(x - ix);
    const fz = smooth(z - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  // fbm: two octaves, the second half the strength.
  return function fbm(x, z) {
    return noise(x, z) * 0.67 + noise(x * 2.13 + 7.7, z * 2.13 + 3.1) * 0.33;
  };
}

// Pick k items out of an array without replacement (Fisher-Yates prefix).
export function sampleN(rand, arr, k) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy.slice(0, k);
}
