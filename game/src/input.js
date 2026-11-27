// Keyboard and mouse. The game is played with keyboard and mouse on a
// desktop browser: stick on the arrows/WASD, throttle on Shift/Ctrl,
// Space drops water, R restarts, P pauses, M mutes. Mouse clicks menus
// and steers a little when held (a gentle bank toward the pointer).

export function newInput() {
  return {
    keys: new Set(),
    hit: new Set(), // keys pressed since the last read: a fast tap is
    // still one press even if keyup lands before the next step reads it
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: null, // {x, y} of the last click, consumed by the menu
    anyKey: false,
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    input.keys.add(e.key.toLowerCase());
    input.hit.add(e.key.toLowerCase());
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.hit.clear();
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    const r = canvas.getBoundingClientRect();
    input.clicked = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Read the current control state. pitch +1 pulls the nose up (S / Down),
// roll +1 banks right (D / Right). Returns a fresh object every call.
export function readControls(input, width) {
  const k = input.keys;
  const pitch =
    (k.has('s') || k.has('arrowdown') ? 1 : 0) -
    (k.has('w') || k.has('arrowup') ? 1 : 0);
  let roll =
    (k.has('d') || k.has('arrowright') ? 1 : 0) -
    (k.has('a') || k.has('arrowleft') ? 1 : 0);
  // Mouse steer: hold the button and the plane banks toward the pointer.
  if (input.mouseDown && width > 0) {
    const off = (input.mouseX / width - 0.5) * 2;
    roll += Math.max(-1, Math.min(1, off * 1.4));
  }
  const throttleDelta =
    (k.has('shift') ? 1 : 0) - (k.has('control') ? 1 : 0);
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttleDelta,
    drop: k.has(' '),
    pause: k.has('p'),
    restart: k.has('r'),
    mute: k.has('m'),
    enter: k.has('enter'),
  };
}

// A one-shot key: true once per press (used for pause, mute, menus).
// Reads the hit set, not the held set: a tap shorter than one step still
// counts, and holding the key does not repeat it.
export function pressed(input, key) {
  if (input.hit.has(key)) {
    input.hit.delete(key);
    return true;
  }
  return false;
}
