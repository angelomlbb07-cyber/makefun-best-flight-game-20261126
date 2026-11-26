// Minimal WebGL renderer: one shader, one mesh type, no textures.
// Everything is vertex-coloured geometry with a single sun and distance fog,
// which is all a golden-hour valley needs — and it runs on SwiftShader too.

// --- matrices (column-major Float32Array(16), like WebGL expects) ---
export function matIdentity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function matMultiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function matPerspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

// Camera looking from eye toward target, Y up.
export function matLookAt(eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx;
  m[1] = yx;
  m[2] = zx;
  m[4] = xy;
  m[5] = yy;
  m[6] = zy;
  m[8] = xz;
  m[9] = yz;
  m[10] = zz;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}

export function matTranslate(x, y, z) {
  const m = matIdentity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function matScale(x, y, z) {
  const m = matIdentity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

export function matRotateX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = matIdentity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function matRotateY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = matIdentity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function matRotateZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = matIdentity();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

// --- shaders ---
const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uEmissive;
uniform float uAlpha;
varying vec3 vColor;
varying float vFog;
varying float vAlpha;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(uModel) * aNormal);
  float lam = max(dot(n, normalize(uSunDir)), 0.0);
  float light = 0.52 + 0.48 * lam;
  vColor = aColor * light + aColor * uEmissive;
  vec4 vp = uView * wp;
  float dist = -vp.z;
  vFog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  vFog = vFog * vFog * (3.0 - 2.0 * vFog);
  vAlpha = uAlpha;
  gl_Position = uProj * vp;
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uFogColor;
varying vec3 vColor;
varying float vFog;
varying float vAlpha;
void main() {
  vec3 c = mix(vColor, uFogColor, vFog);
  gl_FragColor = vec4(c, vAlpha);
}
`;

export function createProgram(gl) {
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  const loc = {};
  for (const name of [
    'aPos',
    'aNormal',
    'aColor',
    'uProj',
    'uView',
    'uModel',
    'uSunDir',
    'uFogColor',
    'uFogNear',
    'uFogFar',
    'uEmissive',
    'uAlpha',
  ]) {
    loc[name] =
      name[0] === 'a'
        ? gl.getAttribLocation(prog, name)
        : gl.getUniformLocation(prog, name);
  }
  return { prog, loc };
}

// A mesh: positions, per-vertex normals, per-vertex colours, triangle indices.
export class Mesh {
  constructor(gl, positions, normals, colors, indices) {
    this.gl = gl;
    this.count = indices.length;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const stride = 9;
    const data = new Float32Array((positions.length / 3) * stride);
    for (let i = 0; i < positions.length / 3; i++) {
      data[i * stride + 0] = positions[i * 3 + 0];
      data[i * stride + 1] = positions[i * 3 + 1];
      data[i * stride + 2] = positions[i * 3 + 2];
      data[i * stride + 3] = normals[i * 3 + 0];
      data[i * stride + 4] = normals[i * 3 + 1];
      data[i * stride + 5] = normals[i * 3 + 2];
      data[i * stride + 6] = colors[i * 3 + 0];
      data[i * stride + 7] = colors[i * 3 + 1];
      data[i * stride + 8] = colors[i * 3 + 2];
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  draw(program, model) {
    const gl = this.gl;
    const loc = program.loc;
    gl.uniformMatrix4fv(loc.uModel, false, model);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.enableVertexAttribArray(loc.aPos);
    gl.enableVertexAttribArray(loc.aNormal);
    gl.enableVertexAttribArray(loc.aColor);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, 36, 24);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  }
}

// MeshBuilder: push triangles and quads with flat face normals; the mesh is
// built once and drawn many times. Colours are per-vertex [r,g,b] 0..1.
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
  }

  // Add one triangle; normal is computed from its winding.
  tri(a, b, c, color) {
    const base = this.pos.length / 3;
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color[0], color[1], color[2]);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  quad(a, b, c, d, color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  // Axis-aligned box centred at (cx,cy,cz) with size (sx,sy,sz), one colour.
  // Faces are wound counter-clockwise seen from outside.
  box(cx, cy, cz, sx, sy, sz, color) {
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color); // top
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color); // bottom
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color); // front
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color); // back
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color); // right
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color); // left
  }

  // A 4-sided pyramid (cone) with a square base: a pine tree crown.
  pyramid(cx, cy, cz, r, h, color) {
    const apex = [cx, cy + h, cz];
    const b = [
      [cx - r, cy, cz - r],
      [cx + r, cy, cz - r],
      [cx + r, cy, cz + r],
      [cx - r, cy, cz + r],
    ];
    for (let i = 0; i < 4; i++) {
      this.tri(b[i], b[(i + 1) % 4], apex, color);
    }
  }

  build(gl) {
    return new Mesh(
      gl,
      this.pos,
      this.nor,
      this.col,
      this.idx,
    );
  }
}
