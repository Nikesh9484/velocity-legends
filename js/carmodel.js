// Velocity Legends — photo-real car models (Sketchfab, CC-BY): load, normalise, showroom paint, spinning wheels, driver, lights
import { THREE, V3, PI, scene, CARMATS, carEnvMap } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR, customCol } from './data.js';
const loader = new GLTFLoader();
const cache = {};
const GLASS = /glass|window|windshield|windscreen|transparent|mirror_?glass/i, HEAD = /head_?light|headlight|LightA|Light_SetA|^Light$|M_Light|light_glass|Lights?$/i, TAIL = /tail|rear_?light|brake_light|RED_GLASS|Red_Glass|GlassRed|Light_Rear|Red_Suns/i, CHROME = /chrome|exhaust|metal|alu/i, TYRE = /tire|tyre|tread|reif/i;

async function loadRaw(file, drop, wheelRx) {
  if (!cache[file]) cache[file] = loader.loadAsync(`assets/cars/${file}.glb`).then(g => { if (drop) { const rm = []; g.scene.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m && drop.test(m.name))) rm.push(o); }); rm.forEach(o => o.removeFromParent()); } return prepare(g.scene, wheelRx); });
  return cache[file];
}
// bake every mesh into one flat car-space group, nose along +Z, wheels resting on y=0, real-world length
function prepare(root, wheelRx) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new V3()), ctr = box.getCenter(new V3());
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  const flat = new THREE.Group();
  // bake transforms; merge everything that shares a material into one mesh (far fewer draw calls). Wheel parts stay separate so they can spin.
  const groups = new Map();
  for (const m of meshes) { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.translate(-ctr.x, -box.min.y, -ctr.z);
    const mn = [].concat(m.material).map(x => x && x.name || '').join('|'); const isW = !!(wheelRx && (wheelRx.test(mn) || wheelRx.test(m.name)));
    if (Array.isArray(m.material)) { const n = new THREE.Mesh(g, m.material); n.name = m.name; n.userData.wheel = isW; flat.add(n); continue; }
    for (const k of Object.keys(g.attributes)) { const at = g.attributes[k]; if (!['position', 'normal', 'uv', 'uv1', 'tangent', 'color'].includes(k)) g.deleteAttribute(k); else if (at.isInterleavedBufferAttribute) g.setAttribute(k, at.clone()); }
    const key = (isW ? 'W|' : '') + m.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + !!g.index; if (!groups.has(key)) groups.set(key, { mat: m.material, list: [], name: m.name, w: isW }); groups.get(key).list.push(g); }
  for (const G of groups.values()) { let geo = G.list.length > 1 ? mergeGeometries(G.list) : G.list[0]; if (!geo) { for (const g of G.list) { const n = new THREE.Mesh(g, G.mat); n.name = G.name; n.userData.wheel = G.w; flat.add(n); } continue; } const n = new THREE.Mesh(geo, G.mat); n.name = G.name; n.userData.wheel = G.w; flat.add(n); }
  flat.userData.sz = sz; flat.userData.swap = sz.x > sz.z; // length along X → rotate later
  return flat;
}
function paintMat(src, col, finish) {
  const m = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 });
  if (src && src.map) { m.map = src.map; m.color.set('#ffffff'); }
  if (src && src.normalMap) { m.normalMap = src.normalMap; }
  setFinish(m, finish); return m;
}
export function setFinish(m, f = 'metal') {
  const F = { gloss: [0.05, 0.3], metal: [0.72, 0.3], pearl: [0.45, 0.22], matte: [0.3, 0.6], chrome: [1, 0.04] }[f] || [0.72, 0.3];
  m.metalness = F[0]; m.roughness = F[1]; m.clearcoat = f === 'matte' ? 0 : 1; m.clearcoatRoughness = 0.03; m.sheen = f === 'pearl' ? 1 : 0; m.sheenColor = new THREE.Color('#ffffff'); m.sheenRoughness = 0.3; m.needsUpdate = true;
}
// split one wheel mesh (often all four wheels in one mesh) into four pivots by quadrant
function splitWheels(mesh, Lz) {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry; const pos = g.attributes.position; const n = pos.count / 3;
  const quads = [[], [], [], []]; const tmp = new V3();
  for (let t = 0; t < n; t++) { tmp.set(0, 0, 0); for (let k = 0; k < 3; k++) { tmp.x += pos.getX(t * 3 + k); tmp.z += pos.getZ(t * 3 + k); } const q = (tmp.x > 0 ? 1 : 0) + (tmp.z > 0 ? 2 : 0); quads[q].push(t); }
  const out = [];
  for (let q = 0; q < 4; q++) {
    if (!quads[q].length) continue; const ng = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) { const sz = attr.itemSize, arr = new attr.array.constructor(quads[q].length * 3 * sz); let o = 0; for (const t of quads[q]) for (let k = 0; k < 3; k++) for (let c = 0; c < sz; c++) arr[o++] = attr.array[(t * 3 + k) * sz + c]; ng.setAttribute(name, new THREE.BufferAttribute(arr, sz, attr.normalized)); }
    ng.computeBoundingBox(); const c = ng.boundingBox.getCenter(new V3()); ng.translate(-c.x, -c.y, -c.z);
    out.push({ q, c, geo: ng, front: c.z > 0 });
  }
  return out;
}
function gClone(m) { if (!buildCar._g) return m; let c = buildCar._g.get(m); if (!c) { c = m.clone(); c.userData.glass = true; buildCar._g.set(m, c); buildCar._glass.push(c); } return c; }
const BLURG = new THREE.CircleGeometry(1, 40); let BLURT = null;
function blurMat() { if (!BLURT) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(120,120,125,.95)'); g.addColorStop(0.12, 'rgba(45,46,50,.9)'); g.addColorStop(0.5, 'rgba(95,97,102,.7)'); g.addColorStop(0.66, 'rgba(55,57,60,.85)'); g.addColorStop(0.7, 'rgba(14,14,15,.97)'); g.addColorStop(1, 'rgba(10,10,10,.98)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 90; k++) { const a = Math.random() * 6.283, r0 = 30 + Math.random() * 120; x.strokeStyle = `rgba(${Math.random() < 0.5 ? '200,200,205' : '20,20,22'},.10)`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.arc(128, 128, r0, a, a + 0.6 + Math.random()); x.stroke(); }
    BLURT = new THREE.CanvasTexture(c); BLURT.colorSpace = THREE.SRGBColorSpace; }
  return new THREE.MeshStandardMaterial({ map: BLURT, transparent: true, opacity: 0, roughness: 0.5, metalness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
function rimMat(mat) { const conv = m => { if (!m || !m.isMeshStandardMaterial) return m; const n = m.name || ''; if (TYRE.test(n) || /rubber|tire|tyre/i.test(n) || (m.color && m.color.r + m.color.g + m.color.b < 0.45 && m.metalness < 0.3 && !m.map)) { let r = buildCar._r.get(m); if (!r) { r = m.clone(); r.roughness = 0.86; r.metalness = 0; r.envMapIntensity = 0.35; if (!r.map) r.color.setRGB(0.035, 0.035, 0.038); buildCar._r.set(m, r); } return r; } if (/brake|disc|caliper/i.test(n)) return m; /* tyres: matte rubber, not plastic */ let c = buildCar._r.get(m); if (!c) { c = m.clone(); if (c.metalness > 0.5) { c.roughness = Math.min(c.roughness, 0.28); c.envMapIntensity = 1.6; } c.userData.base = m.color.clone(); c.userData.bm = m.metalness; c.userData.br = m.roughness; buildCar._r.set(m, c); buildCar._rims.push(c); } return c; };
  return Array.isArray(mat) ? mat.map(conv) : conv(mat); }
let _glowT = null; function glowTexture() { if (_glowT) return _glowT; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return (_glowT = new THREE.CanvasTexture(c)); }
// build a ready-to-drive car: { group, body, wheels:[{pivot,steer,front,r}], paint, setPaint, lights }
export async function buildCar(id, opts = {}) {
  const C = CAR(id); const raw = await loadRaw(opts.lo ? C.f + '_lo' : C.f, C.drop, C.wheel); buildCar._g = new Map(); buildCar._glass = []; buildCar._r = new Map(); buildCar._rims = [];
  const car = new THREE.Group(); const body = new THREE.Group(); car.add(body);
  const s = C.len / Math.max(raw.userData.sz.x, raw.userData.sz.z);
  const holder = new THREE.Group(); holder.scale.setScalar(s); holder.rotation.y = (raw.userData.swap ? -PI / 2 : 0) + (C.ry || 0); body.add(holder);
  const paint = paintMat(null, opts.color || C.col, opts.finish || 'metal'); const paints = [];
  const tail = []; const head = [];
  for (const src of raw.children) {
    const mats = [].concat(src.material); const mn = mats.map(m => m && m.name || '').join('|');
    let mat = src.material;
    if (C.paint.test(mn)) { const pm = mats[0] && mats[0].map ? paintMat(mats[0], '#ffffff', opts.finish || 'metal') : paint; if (pm !== paint) paints.push(pm); mat = pm; }
    else { mat = upgrade(src.material, mn, tail, head); if ([].concat(mat).some(m => m && m.userData.glass)) { mat = Array.isArray(mat) ? mat.map(m => m && m.userData.glass ? gClone(m) : m) : gClone(mat); } }
    const m = new THREE.Mesh(src.geometry, mat); m.name = src.name; m.castShadow = !opts.lo; m.receiveShadow = false; m.userData.mn = mn; m.userData.wheel = src.userData.wheel; holder.add(m);
  }
  holder.updateMatrixWorld(true);
  // wheels: find meshes, split by quadrant, re-parent into spinning pivots (car space)
  const wheels = [];
  if (C.wheel) {
    const wm = holder.children.filter(m => m.userData.wheel);
    const groups = {};
    for (const m of wm) {
      const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); // car space
      const parts = splitWheels(new THREE.Mesh(g), C.len);
      for (const p of parts) { const key = p.q; if (!groups[key]) { const pivot = new THREE.Group(); const steer = new THREE.Group(); steer.add(pivot); groups[key] = { steer, pivot, c: p.c.clone(), n: 0, front: p.front, r: 0 }; body.add(steer); }
        const G = groups[key]; const off = p.c.clone().sub(G.c); const mesh = new THREE.Mesh(p.geo, rimMat(m.material)); mesh.position.copy(off); mesh.castShadow = !opts.lo; G.pivot.add(mesh); p.geo.computeBoundingBox(); G.r = Math.max(G.r, (p.geo.boundingBox.max.y - p.geo.boundingBox.min.y) / 2); }
      m.removeFromParent();
    }
    for (const G of Object.values(groups)) { G.steer.position.copy(G.c); const r = G.r || 0.34;
      // speed blur: at pace the spokes smear into a disc, like on TV / in console racers
      const bb = new THREE.Box3(); for (const ch of G.pivot.children) { ch.geometry.computeBoundingBox(); const b = ch.geometry.boundingBox.clone().translate(ch.position); bb.union(b); }
      const outX = G.c.x >= 0 ? bb.max.x + 0.004 : bb.min.x - 0.004; const disc = new THREE.Mesh(BLURG, blurMat()); disc.scale.setScalar(r * 0.97); disc.position.x = outX; disc.rotation.y = G.c.x >= 0 ? PI / 2 : -PI / 2; disc.renderOrder = 3; disc.visible = false; G.steer.add(disc);
      wheels.push({ pivot: G.pivot, steer: G.steer, front: G.front, r, blur: disc }); }
  }
  // driver: helmet + race suit shoulders, seated in the cockpit
  const drv = !opts.lo && !opts.noDriver ? addDriver(car, C, holder) : null;
  // soft contact shadow so the car always sits on the road
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, C.len * 1.08), shadowMat()); sh.rotation.x = -PI / 2; sh.position.y = 0.03; sh.renderOrder = -1; car.add(sh);
  // every car surface reflects the car-studio environment (sky + soft-box strips)
  const env = carEnvMap(), mine = new Set([paint, ...paints]);
  car.traverse(o => { if (!o.isMesh || o.material === _sm) return; for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial) { CARMATS.add(m); m.envMap = env; m.needsUpdate = true; } });
  const glassM = buildCar._glass, rimsM = buildCar._rims;
  // underglow neon: additive light pool under the car
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, C.len * 1.15), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#000000' })); glow.rotation.x = -PI / 2; glow.position.y = 0.04; glow.renderOrder = 1; glow.visible = false; car.add(glow);
  const holderY = holder.position.y;
  const hb = new THREE.Box3().setFromObject(holder); const api = { driver: drv, group: car, body, wheels, C, paint, paints, tail, head, spin: 0, h: hb.max.y, front: hb.max.z,
    setPaint(col, finish) { paint.color.set(col); setFinish(paint, finish); for (const p of paints) setFinish(p, finish); },
    custom: null,
    setCustom(cu) { api.custom = cu;
      const rc = new THREE.Color(customCol('rim', cu.rim)); for (const m of rimsM) { if (cu.rim === 'chrome') { m.color.copy(m.userData.base); m.metalness = m.userData.bm; m.roughness = m.userData.br; } else { m.color.copy(rc); m.metalness = cu.rim === 'gold' || cu.rim === 'bronze' ? 1 : 0.55; m.roughness = cu.rim === 'black' ? 0.25 : 0.3; } m.needsUpdate = true; }
      const tO = { clear: 0.22, light: 0.5, dark: 0.75, limo: 0.92 }[cu.tint] ?? 0.55; for (const m of glassM) { m.color.set(customCol('tint', cu.tint)).multiplyScalar(0.25); m.opacity = tO; }
      glow.visible = cu.glow !== 'off'; glow.material.color.set(customCol('glow', cu.glow)).multiplyScalar(1.6);
      holder.position.y = holderY - ({ stock: 0, low: 0.035, slam: 0.07 }[cu.ride] || 0); },
    nitroRGB() { const c = new THREE.Color(customCol('nitro', (api.custom || {}).nitro || 'blue')); return [c.r, c.g, c.b]; },
    setBrake(on, night) { for (const m of tail) { m.emissiveIntensity = on ? 3.2 : night ? 1.1 : 0.35; } },
    setHeadlights(on) { for (const m of head) m.emissiveIntensity = on ? 2.5 : 0.25; },
    update(dt, speed, steer) { api.spin += speed * dt / 0.34; const bo = Math.min(0.92, Math.max(0, (Math.abs(speed) - 7) / 22)); for (const w of wheels) { w.pivot.rotation.x = api.spin * (0.34 / w.r); if (w.front) w.steer.rotation.y = steer; if (w.blur) { w.blur.visible = bo > 0.02; w.blur.material.opacity = bo; w.blur.rotation.z = api.spin; } } },
    dispose() { car.removeFromParent(); for (const m of mine) CARMATS.delete(m); },
  };
  return api;
}
let _sm = null;
function shadowMat() {
  if (_sm) return _sm; const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 64, 4, 32, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(0.55, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); return (_sm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 }));
}
const upCache = new Map();
function upgrade(mat, mn, tail, head) {
  const arr = [].concat(mat); const res = arr.map(m => {
    if (!m) return m; if (upCache.has(m)) { const u = upCache.get(m); if (u.userData.tail) tail.includes(u) || tail.push(u); if (u.userData.head) head.includes(u) || head.push(u); return u; }
    const n = m.name || ''; let u = m;
    if (/Raptor_2017_Badge/.test(n)) { u = m.clone(); u.visible = false; upCache.set(m, u); return u; } // hide real FORD / F150 / RAPTOR lettering
    if (GLASS.test(n) && !TAIL.test(n)) { u = new THREE.MeshPhysicalMaterial({ userData: { glass: true }, color: '#06080a', metalness: 0.1, roughness: 0.0, transparent: true, opacity: 0.55, envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false }); }
    else if (TAIL.test(n)) { u = m.clone(); u.emissive = new THREE.Color('#ff1a1a'); u.emissiveIntensity = 0.35; u.userData.tail = true; tail.push(u); }
    else if (HEAD.test(n)) { u = m.clone(); u.emissive = new THREE.Color('#fff4e0'); u.emissiveIntensity = 0.25; u.userData.head = true; head.push(u); }
    else { u = m; if (u.isMeshStandardMaterial) { u.envMapIntensity = 1.1; if (CHROME.test(n)) { u.metalness = Math.max(u.metalness, 0.9); u.roughness = Math.min(u.roughness, 0.2); } if (TYRE.test(n)) { u.roughness = Math.max(u.roughness, 0.8); u.metalness = 0; } } }
    upCache.set(m, u); return u;
  });
  return Array.isArray(mat) ? res : res[0];
}
let helmetP = null;
function addDriver(car, C, holder) {
  const box = new THREE.Box3().setFromObject(holder), H = box.max.y;
  const open = !!C.open || C.cls === 'formula';
  const y = open ? (C.cls === 'formula' ? 0.66 : 0.95) : H - 0.42, z = open && C.cls === 'formula' ? -C.len * 0.06 : -C.len * 0.05, x = open || C.cls === 'formula' ? 0 : -0.36;
  const d = new THREE.Group(); d.position.set(x, y, z); car.add(d);
  const suit = new THREE.MeshStandardMaterial({ color: C.cls === 'formula' ? '#1b1f24' : '#20242a', roughness: 0.75 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.25, 4, 10), suit); torso.position.set(0, -0.32, -0.06); torso.scale.set(1.2, 1, 0.8); d.add(torso);
  if (!helmetP) helmetP = loader.loadAsync('assets/cars/helmet_lo.glb').then(g => { const h = g.scene; const b = new THREE.Box3().setFromObject(h); const s = 0.29 / b.getSize(new V3()).y; h.scale.setScalar(s); const c = b.getCenter(new V3()); h.position.set(-c.x * s, -c.y * s, -c.z * s); return h; }).catch(() => null);
  helmetP.then(h => { if (!h) return; const hc = h.clone(); hc.traverse(o => { if (o.isMesh) o.castShadow = false; }); d.add(hc); });
  return d;
}
export function isLoaded(id, lo) { return !!cache[lo ? CAR(id).f + '_lo' : CAR(id).f]; }
export function preloadCar(id, lo) { return loadRaw(lo ? CAR(id).f + '_lo' : CAR(id).f, CAR(id).drop, CAR(id).wheel).catch(() => null); }
