// Procedural sound, all synthesized with WebAudio — no audio files, no
// network. Engine hum follows the throttle, wind follows speed, and the
// scoop, drop, alarm and jingle are short synthesized events.

export function newAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

// Must be called from a user gesture (click / keypress) — browsers block
// audio before one.
export function startAudio(a) {
  if (a.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: two detuned saws through a lowpass.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 70;
    const o2 = a.ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 71.5;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0.0;
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    a.engineOsc.connect(lp);
    o2.connect(lp);
    lp.connect(a.engineGain);
    a.engineGain.connect(a.master);
    a.engineOsc.start();
    o2.start();
    a.engineOsc2 = o2;
    // Wind: looped noise through a bandpass.
    const len = a.ctx.sampleRate * 2;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    a.windSrc = a.ctx.createBufferSource();
    a.windSrc.buffer = buf;
    a.windSrc.loop = true;
    a.windFilter = a.ctx.createBiquadFilter();
    a.windFilter.type = 'bandpass';
    a.windFilter.frequency.value = 600;
    a.windFilter.Q.value = 0.6;
    a.windGain = a.ctx.createGain();
    a.windGain.gain.value = 0.0;
    a.windSrc.connect(a.windFilter);
    a.windFilter.connect(a.windGain);
    a.windGain.connect(a.master);
    a.windSrc.start();
    a.started = true;
  } catch (e) {
    a.started = false;
  }
}

export function setMuted(a, muted) {
  a.muted = muted;
  if (a.master && a.ctx) {
    a.master.gain.setTargetAtTime(muted ? 0 : 0.5, a.ctx.currentTime, 0.05);
  }
}

// Per-frame: engine pitch from throttle, wind from speed.
export function updateAudio(a, throttle, speed, onGround) {
  if (!a.started || !a.ctx) return;
  const t = a.ctx.currentTime;
  const eng = onGround && throttle < 0.05 ? 0 : 0.05 + throttle * 0.075;
  a.engineGain.gain.setTargetAtTime(eng, t, 0.1);
  a.engineOsc.frequency.setTargetAtTime(58 + throttle * 66, t, 0.1);
  a.engineOsc2.frequency.setTargetAtTime(59 + throttle * 68, t, 0.1);
  const wind = Math.min(0.16, Math.max(0, (speed - 12) / 60) * 0.16);
  a.windGain.gain.setTargetAtTime(wind, t, 0.15);
  a.windFilter.frequency.setTargetAtTime(400 + speed * 12, t, 0.15);
}

function blip(a, freq, dur, type, vol, when = 0) {
  if (!a.started || !a.ctx) return;
  const t = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(a.master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBurst(a, dur, filterFreq, vol) {
  if (!a.started || !a.ctx) return;
  const t = a.ctx.currentTime;
  const len = Math.floor(a.ctx.sampleRate * dur);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = a.ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(a.master);
  src.start(t);
}

export const sfx = {
  scoop(a) {
    noiseBurst(a, 0.7, 900, 0.5);
    blip(a, 300, 0.25, 'sine', 0.2);
  },
  drop(a) {
    noiseBurst(a, 0.9, 2400, 0.45);
  },
  fireOut(a) {
    blip(a, 523, 0.18, 'triangle', 0.25);
    blip(a, 659, 0.18, 'triangle', 0.25, 0.12);
    blip(a, 784, 0.3, 'triangle', 0.3, 0.24);
  },
  alarm(a) {
    blip(a, 880, 0.12, 'square', 0.12);
    blip(a, 660, 0.12, 'square', 0.12, 0.15);
  },
  crash(a) {
    noiseBurst(a, 1.2, 500, 0.7);
    blip(a, 70, 0.8, 'sawtooth', 0.3);
  },
  win(a) {
    [523, 659, 784, 1046].forEach((f, i) => blip(a, f, 0.35, 'triangle', 0.25, i * 0.16));
  },
  click(a) {
    blip(a, 1200, 0.06, 'sine', 0.15);
  },
};
