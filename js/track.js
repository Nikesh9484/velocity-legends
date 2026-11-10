// Velocity Legends — track generator: spline circuits, terrain, kerbs, barriers, grandstands, city, forest, desert, coast
import { THREE, V3, PI, scene, pbr, clamp, lerp, rnd, Q, isTouch } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TR = { S: [], N: 0, len: 0, T: null, group: null, gantry: [], dyn: [], water: null, ds: 2 };
let seed = 1; const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// ---------- value noise (deterministic per track) ----------
const P = new Uint8Array(512); function initNoise(s) { seed = s; const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(srand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = t => t * t * (3 - 2 * t);
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const h = (a, b) => P[(P[a & 255] + b) & 255] / 255;
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1); const u = fade(xf), v = fade(zf); return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1; }
function fbm(x, z, o = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }

const SCN = { // terrain amplitude, noise scale, ground texture, shoulder (flat zone beyond the limit), runoff limits
  gp: { tint: '#5f9a3a', amp: 4, sc: 1 / 160, ground: 'leafy_grass', gRep: 90, road: 'asphalt_02', limStraight: 8, limCorner: 15, barrier: 'armco', lines: true, kerbs: true, traps: true },
  city: { tint: '#8a8f96', amp: 0, sc: 1, ground: 'asphalt_pit_lane', gRep: 120, road: 'asphalt_02', limStraight: 1.2, limCorner: 2.5, barrier: 'wall', lines: true, kerbs: true },
  coast: { tint: '#b4c28d', amp: 26, sc: 1 / 220, ground: 'aerial_grass_rock', gRep: 70, road: 'asphalt_02', limStraight: 3.5, limCorner: 5, barrier: 'armco', lines: true, kerbs: true },
  desert: { tint: '#f2d7a8', amp: 16, sc: 1 / 120, ground: 'sand_01', gRep: 110, road: 'gravelly_sand', limStraight: 22, limCorner: 26, barrier: 'none', loose: true },
  forest: { tint: '#a39c8c', amp: 20, sc: 1 / 140, ground: 'forest_ground_04', gRep: 90, road: 'brown_mud_02', limStraight: 14, limCorner: 16, barrier: 'none', loose: true },
};

// ---------- build ----------
export async function buildTrack(T, sky, onProgress = () => {}) {
  clearTrack(); TR.T = T; const C = SCN[T.scen]; TR.C = C; initNoise(T.id.length * 977 + 13);
  const g = new THREE.Group(); TR.group = g; scene.add(g);
  const SC = T.scale || 1.4; const pts = T.pts.map(p => new V3(p[0] * SC, p[2], p[1] * SC));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  const len = curve.getLength(), N = Math.floor(len / TR.ds); TR.len = len; TR.N = N;
  const S = []; const nCP = pts.length;
  for (let i = 0; i < N; i++) {
    const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u); t.y = 0; t.normalize();
    const tt = curve.getUtoTmapping(u) * nCP, a = Math.floor(tt) % nCP, b = (a + 1) % nCP, f = tt - Math.floor(tt);
    const w = lerp(T.pts[a][3], T.pts[b][3], f);
    S.push({ i, p, t, n: new V3(-t.z, 0, t.x), w, s: i * TR.ds, k: 0 });
  }
  for (let i = 0; i < N; i++) { const a = S[(i - 2 + N) % N].t, b = S[(i + 2) % N].t; const cr = a.x * b.z - a.z * b.x; S[i].k = Math.asin(clamp(cr, -1, 1)) / (4 * TR.ds); }
  for (let i = 0; i < N; i++) { let m = 0; for (let j = -6; j <= 6; j++) m += S[(i + j + N) % N].k; S[i].ks = m / 13; } // smoothed curvature
  for (const s of S) { const corner = Math.abs(s.ks) > 0.008; s.lim = s.w / 2 + (corner ? C.limCorner : C.limStraight); s.corner = corner; s.kerb = C.kerbs && Math.abs(s.ks) > 0.006; s.trap = C.traps && Math.abs(s.ks) > 0.01; }
  { // smooth the run-off width so barriers sweep round corners instead of zig-zagging
    const N = S.length, W = 14; for (let pass = 0; pass < 3; pass++) { const L = S.map(s => s.lim); for (let i = 0; i < N; i++) { let a = 0; for (let k = -W; k <= W; k++) a = Math.max(a, L[(i + k + N) % N] * (1 - Math.abs(k) / (W + 1)) + (L[i] * Math.abs(k) / (W + 1))); S[i].lim = (a + L[i]) / 2 > L[i] ? (a * 0.6 + L[i] * 0.4) : L[i]; } }
    for (let pass = 0; pass < 4; pass++) { const L = S.map(s => s.lim); for (let i = 0; i < N; i++) S[i].lim = (L[(i - 1 + N) % N] + 2 * L[i] + L[(i + 1) % N]) / 4; } }
  TR.S = S; TR.seaX = Math.max(...S.map(q => q.p.x + q.lim)) + 20; buildGrid(); onProgress(0.15);
  // ground & road
  buildTerrain(g, C); onProgress(0.35);
  const roadMat = pbr(C.road, 1, { ns: C.loose ? 1.4 : 0.8 }); if (TR.T.scen === 'desert' || TR.T.scen === 'forest') { roadMat.map = aiTex(TR.T.scen === 'desert' ? 'dirt_desert' : 'dirt_forest', 1, 1); roadMat.color.set(TR.T.scen === 'desert' ? '#e8d2bc' : '#d8d2c8'); roadMat.needsUpdate = true; } if (!C.loose) { const at = aiTex('asphalt', 1, 1); roadMat.map = at; roadMat.color.set(TR.T.scen === 'city' ? '#b9bcc0' : TR.T.scen === 'coast' ? '#b3a99e' : '#a9abae'); roadMat.needsUpdate = true; } roadMat.roughness = sky === 'rain' ? 0.35 : 1; if (sky === 'rain') roadMat.color.set('#9a9a9a');
  g.add(ribbon(0, N, -1, 1, 0.02, 0.02, roadMat, { across: s => s.w / 2, uRep: s => s.w / (C.loose ? 6 : 4), vLen: C.loose ? 6 : 4 }));
  if (C.lines) { const lm = new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
    g.add(ribbon(0, N, s => s.w / 2 - 0.55, s => s.w / 2 - 0.3, 0.035, 0.035, lm)); g.add(ribbon(0, N, s => -(s.w / 2 - 0.3), s => -(s.w / 2 - 0.55), 0.035, 0.035, lm)); }
  // shoulders: grass / dirt verge strip right beside the road blends road into terrain
  if (C.kerbs) buildKerbs(g, C); if (C.traps) buildTraps(g); onProgress(0.5);
  buildStartLine(g, C); buildBarriers(g, C, sky); onProgress(0.65);
  await buildScenery(g, C, T, sky); onProgress(0.95);
  g.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  return TR;
}
export function clearTrack() { if (TR.group) { TR.group.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.geometry.dispose(); } }); TR.group.removeFromParent(); } TR.group = null; TR.gantry = []; TR.dyn = []; TR.water = null; }

// ---------- spatial lookup ----------
const CELL = 24; let grid = new Map();
function buildGrid() { grid = new Map(); for (const s of TR.S) { const k = Math.floor(s.p.x / CELL) + ',' + Math.floor(s.p.z / CELL); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s.i); } }
export function nearest(x, z, hint = -1) {
  const S = TR.S, N = TR.N; let best = -1, bd = 1e18;
  if (hint >= 0) { for (let j = -25; j <= 25; j++) { const i = (hint + j + N) % N, s = S[i]; const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } if (bd < 900) return refine(best, x, z); }
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let r = 0; r <= 4 && (best < 0 || r < 2); r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const L = grid.get((cx + a) + ',' + (cz + b)); if (!L) continue; for (const i of L) { const s = S[i]; const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
  if (best < 0) { for (const s of S) { const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2; if (d < bd) { bd = d; best = s.i; } } }
  return refine(best, x, z);
}
// sub-sample position along the segment + signed lateral offset
function refine(i, x, z) { const S = TR.S, N = TR.N, s = S[i]; const dx = x - s.p.x, dz = z - s.p.z; let f = dx * s.t.x + dz * s.t.z; let j = i;
  if (f < 0) { j = (i - 1 + N) % N; f += TR.ds; } const a = S[j], b = S[(j + 1) % N], u = clamp(f / TR.ds, 0, 1);
  const px = lerp(a.p.x, b.p.x, u), pz = lerp(a.p.z, b.p.z, u), py = lerp(a.p.y, b.p.y, u); const nx = lerp(a.n.x, b.n.x, u), nz = lerp(a.n.z, b.n.z, u);
  const d = (x - px) * nx + (z - pz) * nz; return { i: j, u, d, y: py, s: a.s + u * TR.ds, seg: a }; }
// ground height at any point (road surface on the track, blended terrain elsewhere)
export function heightAt(x, z, hint = -1) {
  const r = nearest(x, z, hint); const C = TR.C, ad = Math.abs(r.d), flat = r.seg.lim + 2;
  if (ad <= r.seg.w / 2 + 0.6) return { y: r.y + 0.02, r, surf: 'road' };
  const e = clamp((ad - flat) / 45, 0, 1), es = e * e * (3 - 2 * e);
  const n = C.amp ? fbm(x * C.sc, z * C.sc) * C.amp + (T_EXTRA(x, z) * es) : 0;
  return { y: r.y - 0.04 + es * n, r, surf: surfAt(r, ad) };
}
function T_EXTRA(x, z) { return TR.T && TR.T.scen === 'coast' ? coastDrop(x, z) : 0; }
function coastDrop(x, z) { return -clamp((x - (TR.seaX || 9e9)) / 6, 0, 30); } // sea on the east side
function surfAt(r, ad) { const s = r.seg, C = TR.C; if (s.kerb && ad < s.w / 2 + 1.5) return 'kerb'; if (s.trap && ad > s.w / 2 + 1.5 && ad < s.w / 2 + 13) return 'gravel'; return C.loose ? 'loose' : TR.T.scen === 'city' ? 'road' : 'grass'; }

// ---------- geometry helpers ----------
const val = (f, s) => typeof f === 'function' ? f(s) : f;
// strip between lateral offsets a..b (functions of sample allowed) at heights ya..yb above the road, over samples [i0, i1)
function ribbon(i0, i1, a, b, ya, yb, mat, o = {}) {
  const S = TR.S, N = TR.N, cnt = ((i1 - i0 + N) % N || N) + 1; const pos = new Float32Array(cnt * 6), uv = new Float32Array(cnt * 4), idx = [];
  for (let k = 0; k < cnt; k++) { const s = S[(i0 + k) % N]; const A = o.across ? -val(o.across, s) : val(a, s), Bv = o.across ? val(o.across, s) : val(b, s);
    const yy = s.p.y; pos.set([s.p.x + s.n.x * A, yy + val(ya, s), s.p.z + s.n.z * A, s.p.x + s.n.x * Bv, yy + val(yb, s), s.p.z + s.n.z * Bv], k * 6);
    const v = (k * TR.ds) / (o.vLen || 4), ur = o.uRep ? val(o.uRep, s) : 1; uv.set([0, v, ur, v], k * 4); if (k < cnt - 1) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
}
function runs(pred) { const S = TR.S, N = TR.N, out = []; let st = -1; for (let i = 0; i <= N; i++) { const on = i < N && pred(S[i]); if (on && st < 0) st = i; if (!on && st >= 0) { out.push([st, i]); st = -1; } } return out; }
function canvasTex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t; }
const aiCache = {}, TL = new THREE.TextureLoader();
function aiTex(name, rx = 1, ry = 1) { const t = (aiCache[name] || (aiCache[name] = TL.load(name.includes('.') ? `assets/tex/ai_${name}` : `assets/tex/ai_${name}.jpg`))).clone(); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = Q.level >= 3 ? 8 : 4; t.needsUpdate = true; return t; }

// ---------- terrain ----------
function buildTerrain(g, C) {
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (const s of TR.S) { minx = Math.min(minx, s.p.x); maxx = Math.max(maxx, s.p.x); minz = Math.min(minz, s.p.z); maxz = Math.max(maxz, s.p.z); }
  const pad = 420, X0 = minx - pad, X1 = maxx + pad, Z0 = minz - pad, Z1 = maxz + pad; TR.bounds = { X0, X1, Z0, Z1 };
  const seg = Q.level >= 3 ? 220 : 150; const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, seg, seg); geo.rotateX(-PI / 2); geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const h = heightAt(x, z); pos.setY(i, h.y - 0.06); const tint = 0.82 + fbm(x / 40, z / 40, 3) * 0.25 + (h.surf === 'gravel' ? 0.1 : 0); col.set([tint, tint, tint * (C.loose ? 0.97 : 1)], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * C.gRep, uv.getY(i) * C.gRep);
  const m = pbr(C.ground, 1, { vertexColors: true, ns: 1.2 }).clone(); m.vertexColors = true; m.color.set(C.tint || '#ffffff');
  if (TR.T.scen === 'gp' || TR.T.scen === 'coast') { // photo lawn + mowing stripes, like a real Grand Prix circuit
    const gt = aiTex('grass', 1, 1); m.map = gt; m.color.set(TR.T.scen === 'coast' ? '#c9c19a' : '#c4cdb4'); m.needsUpdate = true;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.5, uv.getY(i) * 3.5);
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <map_fragment>', '#include <map_fragment>\n{ float st = sin((vWP.x * 0.8 + vWP.z * 0.6) * 0.36); diffuseColor.rgb *= 1.0 + 0.16 * smoothstep(-0.1, 0.1, st) - 0.08; }'); };
  }
  const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; g.add(mesh);
  // distant ground ring so the horizon never shows a gap
  const far = new THREE.Mesh(new THREE.RingGeometry(Math.max(X1 - X0, Z1 - Z0) * 0.55, 3500, 48, 1), new THREE.MeshStandardMaterial({ color: m.color.clone().multiplyScalar(0.55), roughness: 1, map: m.map }));
  far.rotation.x = -PI / 2; far.position.set((X0 + X1) / 2, -2.5, (Z0 + Z1) / 2); g.add(far);
  if (TR.T.scen === 'coast') buildSea(g, X1);
}
function buildSea(g, X1) {
  const geo = new THREE.PlaneGeometry(6000, 6000, 1, 1); geo.rotateX(-PI / 2);
  const nm = new THREE.TextureLoader().load('assets/tex/sand_01_nor.jpg'); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(160, 160);
  const m = new THREE.MeshPhysicalMaterial({ color: '#0c3550', roughness: 0.08, metalness: 0.1, normalMap: nm, normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 1, envMapIntensity: 1.4 });
  const sea = new THREE.Mesh(geo, m); sea.position.set(TR.seaX + 3000 + 40, -6, 0); g.add(sea); TR.water = nm;
}

// ---------- kerbs, gravel traps, start line ----------
function buildKerbs(g) {
  const tex = aiTex('kerb', 1, 1); tex.wrapS = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const [a, b] of runs(s => s.kerb)) { g.add(ribbon(a, b, s => s.w / 2 - 0.1, s => s.w / 2 + 1.4, 0.05, 0.03, m, { vLen: 8 })); g.add(ribbon(a, b, s => -(s.w / 2 + 1.4), s => -(s.w / 2 - 0.1), 0.03, 0.05, m, { vLen: 8 })); }
}
function buildTraps(g) {
  const m = pbr('gravelly_sand', 1); m.map = aiTex('gravel', 1, 1); m.needsUpdate = true; for (const [a, b] of runs(s => s.trap)) { const side = Math.sign(TR.S[Math.floor((a + b) / 2)].ks); // outside of the corner
    if (side > 0) g.add(ribbon(a, b, s => -(s.w / 2 + 13), s => -(s.w / 2 + 1.5), 0.01, 0.01, m, { uRep: 3, vLen: 4 })); else g.add(ribbon(a, b, s => s.w / 2 + 1.5, s => s.w / 2 + 13, 0.01, 0.01, m, { uRep: 3, vLen: 4 })); }
}
function buildStartLine(g, C) {
  const tex = canvasTex(256, 32, (x, w, h) => { const n = 16; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * w / n, j * h / 2, w / n, h / 2); } });
  const s = TR.S[0]; const geo = new THREE.PlaneGeometry(s.w, 1.6); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: '#b9b9b9', roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -3 }));
  m.rotation.x = -PI / 2; m.rotation.z = Math.atan2(s.t.x, s.t.z) + PI / 2; m.position.copy(s.p).setY(s.p.y + 0.04); g.add(m);
  if (C.lines) { // grid boxes
    const gm = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let k = 0; k < 12; k++) { const i = (TR.N - 4 - k * 4) % TR.N, sm = TR.S[i], side = k % 2 ? -1 : 1; const box = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.25), gm); box.rotation.x = -PI / 2; box.rotation.z = Math.atan2(sm.t.x, sm.t.z) + PI / 2; box.position.copy(sm.p).addScaledVector(sm.n, side * sm.w / 4).setY(sm.p.y + 0.04); g.add(box); }
  }
  // start gantry with five red light pods (driven by the race countdown)
  const steel = new THREE.MeshStandardMaterial({ color: '#8a9198', metalness: 0.85, roughness: 0.32 }); const podM = new THREE.MeshStandardMaterial({ color: '#15171a', metalness: 0.4, roughness: 0.5 });
  const gx = new THREE.Group(); gx.position.copy(s.p).addScaledVector(s.t, 6); gx.rotation.y = Math.atan2(s.t.x, s.t.z); g.add(gx);
  const span = s.w + 4; for (const side of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), steel); post.position.set(side * span / 2, 3.75, 0); post.castShadow = true; gx.add(post); }
  for (const yy of [6.8, 7.6]) for (const zz of [-0.4, 0.4]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(span + 0.6, 0.12, 0.12), steel); ch.position.set(0, yy, zz); gx.add(ch); }
  { const n = Math.round(span / 1.1); for (let k = 0; k < n; k++) for (const zz of [-0.4, 0.4]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.07), steel); d.position.set(-span / 2 + (k + 0.5) * span / n, 7.2, zz); d.rotation.z = k % 2 ? 0.7 : -0.7; gx.add(d); } }
  const brand = canvasTex(1024, 96, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#16181b'); gr.addColorStop(1, '#050607'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.font = 'italic 900 64px Arial'; x.textAlign = 'center'; x.fillStyle = '#ff2a2a'; x.fillText('VELOCITY LEGENDS', w / 2, 70); });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.7, 1.4), new THREE.MeshStandardMaterial({ map: brand, roughness: 0.5, emissive: '#ffffff', emissiveMap: brand, emissiveIntensity: 0.35 })); board.position.set(0, 8.4, -0.46); board.rotation.y = PI; gx.add(board);
  const b2 = board.clone(); b2.position.z = 0.46; b2.rotation.y = 0; gx.add(b2);
  for (let k = 0; k < 5; k++) { const pod = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.5), podM); pod.position.set((k - 2) * 1.3, 6.1, -0.35); gx.add(pod);
    const lm = new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff1010', emissiveIntensity: 0, roughness: 0.3 }); for (const yy of [0.35, -0.35]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.26, 18), lm); l.position.set(0, yy, -0.26); l.rotation.y = PI; pod.add(l); } TR.gantry.push(lm); }
}

// ---------- barriers ----------
function buildBarriers(g, C, sky) {
  if (C.barrier === 'none') { buildMarkers(g); return; }
  if (C.barrier === 'armco') {
    const steel = new THREE.MeshStandardMaterial({ color: '#b9c0c6', metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide });
    for (const sd of [1, -1]) { g.add(ribbon(0, TR.N, s => sd * s.lim, s => sd * s.lim, 0.42, 0.78, steel, { vLen: 4 })); }
    // posts
    const post = new THREE.BoxGeometry(0.12, 0.8, 0.12), mats = []; for (let i = 0; i < TR.N; i += 2) for (const sd of [1, -1]) { const s = TR.S[i]; const m = new THREE.Matrix4().makeTranslation(s.p.x + s.n.x * (sd * s.lim + sd * 0.12), s.p.y + 0.4, s.p.z + s.n.z * (sd * s.lim + sd * 0.12)); mats.push(m); }
    const im = new THREE.InstancedMesh(post, new THREE.MeshStandardMaterial({ color: '#8a9096', metalness: 0.7, roughness: 0.4 }), mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im);
    // tyre walls on the outside of corners
    const tyT = aiTex('tyrewall', 1, 1); tyT.wrapS = THREE.ClampToEdgeWrapping; const tyM = new THREE.MeshStandardMaterial({ map: tyT, roughness: 0.85, side: THREE.DoubleSide });
    for (const [a, b] of runs(s => s.corner)) { const side = Math.sign(TR.S[Math.floor((a + b) / 2)].ks) > 0 ? -1 : 1; g.add(ribbon(a, b, s => side * (s.lim - 0.6), s => side * (s.lim - 0.6), 0.0, 1.1, tyM, { vLen: 1.05 })); g.add(ribbon(a, b, s => side * (s.lim - 0.6), s => side * (s.lim - 0.05), 1.1, 1.1, tyM, { vLen: 1.05 })); }
    for (const s of TR.S) if (s.corner) s.lim -= 1.3;
  } else if (C.barrier === 'wall') {
    const tex = aiTex('wall_night', 1, 1); tex.wrapT = THREE.ClampToEdgeWrapping;
    const wallM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: sky === 'night' ? 0.08 : 0.0, color: sky === 'night' ? '#b8bcc2' : '#ffffff', side: THREE.DoubleSide });
    const fenceT = canvasTex(128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(150,158,166,.8)'; x.lineWidth = 1.6; for (let k = -128; k < 256; k += 21) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke(); x.beginPath(); x.moveTo(k + 128, 0); x.lineTo(k, 128); x.stroke(); } x.fillStyle = 'rgba(120,128,136,1)'; x.fillRect(0, 0, 6, h); x.fillRect(0, 0, w, 4); });
    fenceT.wrapS = fenceT.wrapT = THREE.RepeatWrapping; const fenceM = new THREE.MeshStandardMaterial({ map: fenceT, transparent: true, alphaTest: 0.25, metalness: 0.6, roughness: 0.5, color: '#8d939a', side: THREE.DoubleSide, depthWrite: false });
    for (const sd of [1, -1]) g.add(ribbon(0, TR.N, s => sd * (s.lim + 0.2), s => sd * (s.lim + 0.2), 1.15, 4.6, fenceM, { vLen: 3.5 }));
    const conc = pbr('concrete_wall_008', 1);
    const wallM2 = wallM.clone(); wallM2.map = tex.clone(); wallM2.map.repeat.set(1, -1); wallM2.emissiveMap = wallM2.map; // other side: keep the lettering readable
    for (const sd of [1, -1]) { g.add(ribbon(0, TR.N, s => sd * s.lim, s => sd * s.lim, 0.0, 1.15, sd > 0 ? wallM : wallM2, { vLen: 11.8 })); g.add(ribbon(0, TR.N, s => sd * s.lim, s => sd * (s.lim + 0.45), 1.15, 1.15, conc, { vLen: 4 })); }
    // catch-fence posts
    const pg = new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), mats = []; for (let i = 0; i < TR.N; i += 3) for (const sd of [1, -1]) { const s = TR.S[i]; mats.push(new THREE.Matrix4().makeTranslation(s.p.x + s.n.x * sd * (s.lim + 0.2), s.p.y + 2.7, s.p.z + s.n.z * sd * (s.lim + 0.2))); }
    const im = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: '#555b61', metalness: 0.8, roughness: 0.4 }), mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im);
  }
}
function buildMarkers(g) { // rally/off-road course poles every 30 m
  const geo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6); const m1 = new THREE.MeshStandardMaterial({ color: '#ff5a1f', roughness: 0.6 }); const mats = [];
  for (let i = 0; i < TR.N; i += 15) for (const sd of [1, -1]) { const s = TR.S[i]; const x = s.p.x + s.n.x * sd * (s.w / 2 + 1.2), z = s.p.z + s.n.z * sd * (s.w / 2 + 1.2); mats.push(new THREE.Matrix4().makeTranslation(x, heightAt(x, z, i).y + 0.7, z)); }
  const im = new THREE.InstancedMesh(geo, m1, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im);
}

// ---------- scenery ----------
const texLoader = new THREE.TextureLoader(), gl = new GLTFLoader();
function spriteMesh(file, list, wScale = 1) { // crossed-quad impostors (trees), instanced
  if (!list.length) return null; const t = texLoader.load(`assets/props/${file}.webp`); t.colorSpace = THREE.SRGBColorSpace;
  const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(PI / 2); const geo = mergeGeometries([a, b]);
  const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: file.startsWith('ai_') ? 0.28 : 0.12 });
  const im = new THREE.InstancedMesh(geo, m, list.length); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3();
  list.forEach((p, i) => { q.setFromAxisAngle(new V3(0, 1, 0), p[4] || srand() * PI); sc.set(p[3] * wScale, p[3], p[3] * wScale); M.compose(new V3(p[0], p[1], p[2]), q, sc); im.setMatrixAt(i, M); });
  im.castShadow = Q.level >= 3; return im;
}
function scatter(count, minD, maxD, fn) { const out = []; let tries = 0; const { X0, X1, Z0, Z1 } = TR.bounds;
  while (out.length < count && tries++ < count * 20) { const x = lerp(X0 + 30, X1 - 30, srand()), z = lerp(Z0 + 30, Z1 - 30, srand()); const r = nearest(x, z); const ad = Math.abs(r.d); if (ad < r.seg.lim + minD || ad > maxD) continue; const h = heightAt(x, z, r.i).y; const o = fn(x, h, z, ad); if (o) out.push(o); }
  return out; }
async function buildScenery(g, C, T, sky) {
  const many = Q.level >= 3 ? 1 : Q.level === 2 ? 0.6 : 0.35;
  const plant = (file, n, d0, d1, h0, h1, w = 1) => { const L = scatter(Math.round(n * many), d0, d1, (x, y, z) => [x, y - 0.25, z, h0 + srand() * (h1 - h0)]); const mm = spriteMesh(file, L, w); if (mm) g.add(mm); };
  if (T.scen === 'gp') { plant('ai_umbrella', 420, 40, 420, 11, 16); plant('ai_broad', 380, 40, 400, 10, 15); plant('ai_cypress', 260, 36, 300, 12, 17); plant('ai_bush', 260, 48, 220, 2, 3.5); }
  if (T.scen === 'coast') { plant('ai_palm', 380, 12, 300, 9, 14); plant('ai_umbrella', 260, 25, 340, 11, 15); plant('ai_cypress', 160, 20, 260, 11, 16); plant('ai_bush', 600, 8, 220, 1.8, 3.2); }
  if (T.scen === 'gp') { buildGrandstands(g); buildPits(g); buildBillboards(g); }
  if (T.scen === 'coast') { buildVillas(g); }
  if (T.scen === 'city') buildCity(g, sky);
  if (T.scen === 'desert') {
    const q = scatter(Math.round(260 * many), 8, 380, (x, y, z) => [x, y - 0.2, z, 3 + srand() * 3]); const qm = spriteMesh('quiver', q, 0.8); if (qm) g.add(qm);
    await rocks(g, Math.round(320 * many), 4, 300, 1.2, 5); buildCamp(g);
  }
  if (T.scen === 'forest') {
    plant('ai_pine', 2000, 4, 330, 16, 27); plant('ai_bush', 700, 3, 160, 1.5, 3);
    const f0 = scatter(Math.round(900 * many), 6, 330, (x, y, z) => [x, y - 0.3, z, 16 + srand() * 10]); const fm = spriteMesh('fir0', f0, 0.75); if (fm) g.add(fm);
    const f1 = scatter(Math.round(400 * many), 2, 220, (x, y, z) => [x, y - 0.3, z, 13 + srand() * 8]); const fm1 = spriteMesh('fir1', f1, 0.7); if (fm1) g.add(fm1);
    await rocks(g, Math.round(260 * many), 2, 200, 0.8, 3.5);
  }
  await buildBackdrop(g, T, sky);
}
// distant horizon: AI panorama (Picsart) cut out and wrapped round the circuit, tinted to the sky
async function buildBackdrop(g, T, sky) {
  const night = sky === 'night' || sky === 'rain'; const file = { gp: 'gp', coast: 'coast', forest: 'forest', desert: 'dunes', city: night ? 'street' : null }[T.scen]; if (!file) return;
  let tex; try { tex = await TL.loadAsync(`assets/tex/ai_pan_${file}.webp`); } catch (e) { return; }
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.MirroredRepeatWrapping; const tiles = 6; tex.repeat.set(tiles, 1); tex.anisotropy = 4;
  const { X0, X1, Z0, Z1 } = TR.bounds, size = Math.max(X1 - X0, Z1 - Z0), R = size * 0.55 + 160, Hh = (2 * PI * R / tiles) * tex.image.height / tex.image.width;
  const tint = file === 'street' ? new THREE.Color(1, 1, 1) : new THREE.Color({ day: '#ffffff', clear: '#ffffff', sunset: '#ffc9a6', overcast: '#c9ced2', rain: '#5a6066', night: '#2a3140' }[sky] || '#ffffff');
  const m = new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, blending: THREE.NormalBlending });
  let y0 = 0; for (const s of TR.S) y0 += s.p.y; y0 /= TR.N;
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Hh, 160, 1, true), m); cyl.position.set((X0 + X1) / 2, y0 + Hh / 2 - Hh * 0.16, (Z0 + Z1) / 2); cyl.renderOrder = -2; g.add(cyl);
}
async function rocks(g, n, minD, maxD, s0, s1) {
  let geo, mat; try { const gg = await gl.loadAsync('assets/props/rock.glb'); gg.scene.traverse(o => { if (o.isMesh && !geo) { geo = o.geometry; mat = o.material; } }); } catch (e) { return; }
  const list = scatter(n, minD, maxD, (x, y, z) => [x, y, z, s0 + srand() * (s1 - s0)]); const im = new THREE.InstancedMesh(geo, mat, list.length); const M = new THREE.Matrix4(), q = new THREE.Quaternion();
  list.forEach((p, i) => { q.setFromEuler(new THREE.Euler(srand() * 0.4, srand() * PI * 2, srand() * 0.4)); M.compose(new V3(p[0], p[1] - p[3] * 0.25, p[2]), q, new V3(p[3], p[3] * (0.6 + srand() * 0.6), p[3])); im.setMatrixAt(i, M); });
  im.castShadow = Q.level >= 3; im.receiveShadow = true; g.add(im);
}
function crowdTex() { return canvasTex(512, 256, (x, w, h) => { x.fillStyle = '#20242a'; x.fillRect(0, 0, w, h); const cols = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#ffb703', '#fb8500', '#2a9d8f', '#e9c46a', '#ffffff', '#d62828'];
  for (let r = 0; r < 16; r++) for (let c = 0; c < 64; c++) { if (Math.random() < 0.12) continue; const px = c * 8 + (r % 2) * 4, py = r * 16 + 3; x.fillStyle = cols[Math.floor(Math.random() * cols.length)]; x.fillRect(px + 1, py + 5, 6, 9); x.fillStyle = '#e0b48a'; x.beginPath(); x.arc(px + 4, py + 3, 2.6, 0, 7); x.fill(); } }, [6, 1]); }
// true when none of the given local points (of obj) lands on or near ANY part of the circuit
function clearOfTrack(obj, pts, margin = 2.5) { obj.updateMatrixWorld(true); const v = new V3(); for (const [x, y, z] of pts) { v.set(x, y, z); obj.localToWorld(v); const r = nearest(v.x, v.z); if (Math.abs(r.d) < r.seg.lim + margin) return false; } return true; }
function placeAlong(i, side, off, y = 0) { const s = TR.S[(i + TR.N) % TR.N]; return { p: s.p.clone().addScaledVector(s.n, side * (s.lim + off)).setY(s.p.y + y), rot: Math.atan2(s.t.x, s.t.z), s }; }
// stepped terraces: risers + treads with one continuous crowd photo across them (life-size people, ~12 rows)
function terraceGeo(L, rows, rise, run, side) {
  const pos = [], uv = [], idx = []; let y = 0.6, z = 0.8, v = 0; const total = rows * (rise + run), vScale = 0.42 / total; const ru = L * 0.0141;
  const quad = (y0, z0, y1, z1, v0, v1) => { const n = pos.length / 3; pos.push(-L / 2, y0, side * z0, L / 2, y0, side * z0, L / 2, y1, side * z1, -L / 2, y1, side * z1); uv.push(0, 0.05 + v0, ru, 0.05 + v0, ru, 0.05 + v1, 0, 0.05 + v1); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (let r = 0; r < rows; r++) { quad(y, z, y + rise, z, v * vScale, (v + rise) * vScale); v += rise; y += rise; quad(y, z, y, z + run, v * vScale, (v + run) * vScale); v += run; z += run; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildGrandstands(g) {
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.75, roughness: 0.38 }); const dark = new THREE.MeshStandardMaterial({ color: '#a7a9a8', metalness: 0.05, roughness: 0.85 });
  const roofTop = new THREE.MeshStandardMaterial({ color: '#d9dde1', metalness: 0.5, roughness: 0.35 }), roofUnder = new THREE.MeshStandardMaterial({ color: '#6b7177', metalness: 0.3, roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#9fb8c8', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false });
  for (const [i0, side, L] of [[-60, -1, 150], [40, -1, 90], [Math.floor(TR.N * 0.45), 1, 110]]) {
    const A = placeAlong(i0 + Math.floor(L / 4), side, 9); const G0 = new THREE.Group(); G0.position.copy(A.p); G0.rotation.y = A.rot; const gs = new THREE.Group(); gs.rotation.y = -PI / 2; G0.add(gs); // inner: x along the track, +z away from it on side +1
    const rows = 12, rise = 0.55, run = 0.85;
    const crowd = new THREE.MeshStandardMaterial({ map: aiTex('crowd', 1, 1), roughness: 0.92, side: THREE.DoubleSide }); crowd.map.wrapT = THREE.ClampToEdgeWrapping;
    const ter = new THREE.Mesh(terraceGeo(L, rows, rise, run, side), crowd); ter.receiveShadow = true; gs.add(ter);
    const topY = 0.6 + rows * rise, backZ = 0.8 + rows * run;
    // sponsor wall, glass railing and handrail at the front
    const wallF = new THREE.Mesh(new THREE.BoxGeometry(L, 1.0, 0.3), new THREE.MeshStandardMaterial({ map: aiTex(['board1', 'board2', 'board3'][Math.abs(i0) % 3], Math.round(L / 10), 1), roughness: 0.5 })); wallF.position.set(0, 0.5, side * 0.55); gs.add(wallF);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.1), glass); gl.position.set(0, 1.55, side * 0.55); gs.add(gl);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.07), steel); rail.position.set(0, 2.1, side * 0.55); gs.add(rail);
    // back wall, side walls, columns
    const back = new THREE.Mesh(new THREE.BoxGeometry(L, topY + 4.5, 0.5), dark); back.position.set(0, (topY + 4.5) / 2, side * (backZ + 0.3)); gs.add(back);
    for (const x of [-L / 2, L / 2]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(0.5, topY + 1.2, backZ), dark); sw.position.set(x, (topY + 1.2) / 2, side * backZ / 2); gs.add(sw); }
    // cantilever roof with trusses: light top, dark underside
    const RW = backZ + 4, roofY = topY + 4.6;
    const rt = new THREE.Mesh(new THREE.BoxGeometry(L + 3, 0.12, RW), roofTop); rt.position.set(0, roofY + 0.45, side * (backZ + 0.3 - RW / 2)); rt.rotation.x = side * 0.05; rt.castShadow = true; gs.add(rt);
    const ru = new THREE.Mesh(new THREE.BoxGeometry(L + 3, 0.1, RW), roofUnder); ru.position.set(0, roofY, side * (backZ + 0.3 - RW / 2)); ru.rotation.x = side * 0.05; gs.add(ru);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(L + 3, 0.6, 0.25), steel); edge.position.set(0, roofY + 0.05 + side * 0, side * (backZ + 0.3 - RW)); gs.add(edge);
    for (let k = -L / 2; k <= L / 2 + 0.1; k += 12) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, roofY + 0.5, 0.45), steel); col.position.set(k, (roofY + 0.5) / 2, side * (backZ + 0.3)); gs.add(col);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, RW), steel); truss.position.set(k, roofY + 0.9, side * (backZ + 0.3 - RW / 2)); truss.rotation.x = side * 0.05; gs.add(truss);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, Math.hypot(RW, 3.2)), steel); tie.position.set(k, roofY + 2.4, side * (backZ + 0.3 - RW / 2)); tie.rotation.x = side * Math.atan2(3.2, RW); gs.add(tie);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), steel); mast.position.set(k, roofY + 2, side * (backZ + 0.3)); gs.add(mast);
    }
    const pts = []; for (let k = -L / 2; k <= L / 2; k += 8) for (const z of [0.4, 6, backZ + 0.5]) pts.push([k, 0, side * z]);
    if (clearOfTrack(gs, pts)) g.add(G0);
  }
}
function buildPitWall(g) { // concrete pit wall with sponsor panels + debris fence between the start straight and the pit lane
  const t = aiTex('pitwall.webp', 1, 1); t.wrapS = THREE.ClampToEdgeWrapping; const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, roughness: 0.8, side: THREE.DoubleSide });
  const N = TR.N; for (const [a, b] of [[N - 45, N - 1], [0, 70]]) g.add(ribbon(a, b, s => s.lim + 0.35, s => s.lim + 0.35, 0.0, 3.2, m, { vLen: 6.8 }));
}
function buildPits(g) { buildPitWall(g);
  const A = placeAlong(-30, 1, 12); const pit = new THREE.Group(); pit.position.copy(A.p); pit.rotation.y = A.rot;
  { const pts = []; for (let z = -71; z <= 89; z += 8) for (const x of [-7, 0, 7]) pts.push([x, 0, z]); if (!clearOfTrack(pit, pts.map(([x, y, z]) => [x, y, z]), 1.5)) return; } g.add(pit);
  const H = 12, Lp = 160, white = new THREE.MeshStandardMaterial({ color: '#e8eaec', roughness: 0.4 }), face = new THREE.MeshStandardMaterial({ map: aiTex('pits', Math.round(Lp / (H * 3)), 1), roughness: 0.35, metalness: 0.1, envMapIntensity: 1.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(Lp, H, 14), [white, white, white, white, face, face]);
  body.rotation.y = PI / 2; body.position.set(0, H / 2, 9); body.castShadow = true; pit.add(body);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, Lp + 2), new THREE.MeshStandardMaterial({ color: '#202428', metalness: 0.6, roughness: 0.3 })); lip.position.set(-1, H + 0.25, 9); pit.add(lip);
}
function buildBillboards(g) {
  const post = new THREE.MeshStandardMaterial({ color: '#2a2e33', metalness: 0.7, roughness: 0.35 }); const mats = ['board1', 'board2', 'board3'].map(n => new THREE.MeshStandardMaterial({ map: aiTex(n), roughness: 0.4, emissive: '#ffffff', emissiveMap: aiTex(n), emissiveIntensity: 0.12 }));
  for (let k = 0; k < 12; k++) { const i = Math.floor(TR.N * (k + 0.5) / 12); const s = TR.S[i]; const side = s.ks > 0 ? -1 : 1; const A = placeAlong(i, side, 5);
    const bb = new THREE.Group(); bb.position.copy(A.p); bb.rotation.y = A.rot + (side > 0 ? -PI / 2 : PI / 2); g.add(bb);
    const b = new THREE.Mesh(new THREE.BoxGeometry(12, 5.1, 0.25), [post, post, post, post, post, mats[k % 3]]); b.position.y = 4.6; b.castShadow = Q.level >= 3; bb.add(b);
    for (const x of [-4.5, 4.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.1, 0.3), post); p.position.set(x, 1.05, -0.2); bb.add(p); }
    if (!clearOfTrack(bb, [[-6, 0, 0], [0, 0, 0], [6, 0, 0]], 1)) bb.removeFromParent(); }
}
function buildVillas(g) {
  const roof = new THREE.MeshStandardMaterial({ color: '#a4502c', roughness: 0.7 }); const list = scatter(70, 30, 260, (x, y, z) => [x, y, z]);
  const wallTex = aiTex('villa', 1, 1); const geos = [];
  for (const [x, y, z] of list) { const w = 10 + srand() * 8, d = 9 + srand() * 6, h = 7 + srand() * 3; const box = new THREE.BoxGeometry(w, h, d); const uv = box.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(w / 12)), uv.getY(k)); const ry = srand() * PI; box.rotateY(ry); box.translate(x, y + h / 2 - 0.5, z); geos.push(box);
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 2.6, 4), roof); r.position.set(x, y + h + 0.8, z); r.rotation.y = ry + PI / 4; g.add(r); }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 })); m.castShadow = Q.level >= 3; g.add(m);
}
function buildCamp(g) { // rally service park near the start
  const cols = ['#c1121f', '#f2f2f2', '#1f4fd1', '#ffb703']; for (let k = 0; k < 6; k++) { const A = placeAlong(-20 + k * 8, 1, 6); const t = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 4), new THREE.MeshStandardMaterial({ color: cols[k % 4], roughness: 0.7 })); t.position.copy(A.p).setY(heightAt(A.p.x, A.p.z).y + 1.5); t.rotation.y = PI / 4 + A.rot; t.castShadow = true; g.add(t); }
}
function buildCity(g, sky) {
  const night = sky === 'night' || sky === 'rain';
  const FAC = night ? ['towerA', 'towerB', 'towerC', 'tower'] : ['tower', 'towerA', 'towerB', 'towerC'];
  const DARK = { towerA: [0.65, 0.31], towerB: [0.342, 0.02], towerC: [0.652, 0.965], tower: [0.02, 0.02] }; // darkest spot of each facade: used for roofs
  const mats = FAC.map(n => { const t = aiTex(n, 1, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.22, metalness: 0.5, color: night ? '#9aa3ad' : '#c3ccd6', emissive: '#ffffff', emissiveMap: t, emissiveIntensity: night ? 0.75 : 0.0, envMapIntensity: night ? 0.8 : 1.3 }); });
  const geos = [[], [], [], []];
  for (let i = 0; i < TR.N; i += 9) for (const side of [-1, 1]) { const s = TR.S[i]; const w = 18 + srand() * 16, d = 14 + srand() * 14, h = 34 + srand() * (srand() < 0.3 ? 120 : 50); const off = s.lim + 8 + d / 2 + srand() * 12;
    if (nearestOther(s.p.x + s.n.x * side * off, s.p.z + s.n.z * side * off, off)) continue;
    const k = Math.floor(srand() * 4), dk = DARK[FAC[k]];
    const box = new THREE.BoxGeometry(w, h, d); const uv = box.attributes.uv, nm = box.attributes.normal;
    const u0 = srand(), v0 = srand() * 0.5; // vary which part of the facade each building shows
    for (let q = 0; q < uv.count; q++) { if (Math.abs(nm.getY(q)) > 0.5) { uv.setXY(q, dk[0], dk[1]); continue; } const side = Math.abs(nm.getX(q)) > 0.5 ? d : w; uv.setXY(q, u0 + uv.getX(q) * side / 26, v0 + uv.getY(q) * h / 48); }
    box.rotateY(Math.atan2(s.t.x, s.t.z)); box.translate(s.p.x + s.n.x * side * off, s.p.y + h / 2, s.p.z + s.n.z * side * off); geos[k].push(box); }
  geos.forEach((list, k) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), mats[k]); m.castShadow = Q.level >= 3; g.add(m); });
  // street lamps with warm light pools on the road (cheap fake lighting)
  const pole = new THREE.CylinderGeometry(0.09, 0.12, 9, 6), headG = new THREE.BoxGeometry(1.4, 0.18, 0.4); const pm = new THREE.MeshStandardMaterial({ color: '#30353a', metalness: 0.7, roughness: 0.4 }), hm = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffd59a', emissiveIntensity: night ? 4 : 0.2 });
  const poolT = canvasTex(128, 128, (x, w, h) => { const gr = x.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,200,130,.55)'); gr.addColorStop(1, 'rgba(255,200,130,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const poolM = new THREE.MeshBasicMaterial({ map: poolT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: night ? 0.5 : 0 });
  const P1 = [], H1 = [], L1 = []; for (let i = 0; i < TR.N; i += 14) { const side = (i / 14) % 2 ? 1 : -1; const s = TR.S[i]; const x = s.p.x + s.n.x * side * (s.lim + 0.6), z = s.p.z + s.n.z * side * (s.lim + 0.6); P1.push(new THREE.Matrix4().makeTranslation(x, s.p.y + 4.5, z)); const hx = s.p.x + s.n.x * side * (s.lim - 0.4), hz = s.p.z + s.n.z * side * (s.lim - 0.4); H1.push(new THREE.Matrix4().makeRotationY(Math.atan2(s.n.x, s.n.z)).setPosition(hx, s.p.y + 8.9, hz)); L1.push([s.p.x + s.n.x * side * (s.lim - 4), s.p.y + 0.06, s.p.z + s.n.z * side * (s.lim - 4)]); }
  const ip = new THREE.InstancedMesh(pole, pm, P1.length); P1.forEach((m, k) => ip.setMatrixAt(k, m)); g.add(ip);
  const ih = new THREE.InstancedMesh(headG, hm, H1.length); H1.forEach((m, k) => ih.setMatrixAt(k, m)); g.add(ih);
  if (night) { const pg = new THREE.PlaneGeometry(16, 16); pg.rotateX(-PI / 2); const ipool = new THREE.InstancedMesh(pg, poolM, L1.length); const M = new THREE.Matrix4(); L1.forEach((p, k) => { M.makeTranslation(p[0], p[1], p[2]); ipool.setMatrixAt(k, M); }); ipool.renderOrder = 2; g.add(ipool); }
  // marina water on one side of the track
  const { X0, X1, Z0, Z1 } = TR.bounds; const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 1600), new THREE.MeshPhysicalMaterial({ color: '#06121c', roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.5 })); water.rotation.x = -PI / 2; water.position.set(X0 - 380, -0.8, (Z0 + Z1) / 2); g.add(water);
}
function nearestOther(x, z, off) { const r = nearest(x, z); return Math.abs(r.d) < r.seg.lim + 4; }

// ---------- per-frame: start lights, water ripple ----------
export function setStartLights(n) { TR.gantry.forEach((m, k) => { m.emissiveIntensity = k < n ? 6 : 0; m.color.set(k < n ? '#ff2020' : '#330000'); }); }
export function updateTrack(dt) { if (TR.water) TR.water.offset.x += dt * 0.004; }
export function gridSlot(k) { const N = TR.N; const i = (N - 4 - k * 4 + N * 4) % N; const s = TR.S[i]; const side = k % 2 ? -1 : 1; return { p: s.p.clone().addScaledVector(s.n, side * s.w / 4), yaw: Math.atan2(s.t.x, s.t.z), i }; }
