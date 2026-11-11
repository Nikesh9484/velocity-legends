// Velocity Legends — menus: title, hub, race setup, garage (buy, upgrade, paint), championships, settings, results, pause; 3D showroom
import { THREE, V3, PI, $, $$, scene, camera, setSky, SFX, audioInit, AU, haptic, isTouch, isApple, applyQuality, Q, clamp, followSun, renderer, menuPR, sun, hemi, setPR, POST, useCarEnv } from './engine.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CARS, CAR, CLASSES, TRACKS, TRACK, SKIES, DIFFS, PAINTS, FINISH, UPGRADES, CHAMPS, POINTS, VERSION, CUSTOM, FLAGS } from './data.js';
import { buildCar, preloadCar, isLoaded } from './carmodel.js';
import { S, save, addXP, addCoins, ups, paintOf, needXP, customOf } from './state.js';
import { startRace, endRace, RACE, setPaused, fmt } from './race.js';
import { hudShow } from './hud.js';
import { IN, bindTouch, enableTilt, calibrateTilt } from './input.js';

// ---------- 3D showroom (menus): dark cinematic studio, mirror floor, light bars, volumetric beams ----------
const SHOW = { g: null, car: null, id: null, rot: 0.6, drag: null, dist: 7.2, busy: 0, t: 0 };
function glowTex(stops) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function beamTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); }
export async function showroom(on) {
  if (!on) { if (SHOW.g) SHOW.g.visible = false; return; }
  await setSky('studio'); Q.mpr = Math.min(Q.mpr || 9, menuPR()); setPR(Q.mpr); POST.on = !POST.off; /* Android: no glow pass — its bloom blew the floor lights into big red/white blobs */
  if (!SHOW.g) { SHOW.g = new THREE.Group(); scene.add(SHOW.g); const G = SHOW.g;
    // mirror floor + dark lacquer layer that fades the reflection out to black at the edges
    const res = Math.min(1024, Math.round(innerWidth * Math.min(devicePixelRatio, 2) * 0.5));
    const mirror = !isTouch && Q.level >= 3; const mir = mirror ? new Reflector(new THREE.CircleGeometry(60, 64), { textureWidth: res, textureHeight: res, color: '#8a8f96', clipBias: 0.003 }) : new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#0f1113', metalness: 0.45, roughness: 0.42, envMapIntensity: 0.3 })); mir.rotation.x = -PI / 2; mir.position.y = -0.001; G.add(mir); SHOW.mir = mir;
    const lac = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshBasicMaterial({ color: '#030405', transparent: true, alphaMap: glowTex([[0, '#5a5a5a'], [0.08, '#808080'], [0.35, '#e6e6e6'], [1, '#ffffff']]), depthWrite: false })); lac.rotation.x = -PI / 2; lac.position.y = 0.002; G.add(lac);
    const shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.55 })); shadowFloor.rotation.x = -PI / 2; shadowFloor.position.y = 0.13; shadowFloor.receiveShadow = true; G.add(shadowFloor);
    // turntable: brushed dark metal with a glowing red edge
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.72, 0.12, 96), new THREE.MeshPhysicalMaterial({ color: '#0f1013', metalness: 0.5, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.35 })); disc.position.y = 0.06; disc.receiveShadow = true; G.add(disc); SHOW.disc = disc;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.03, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(3) })); ring.rotation.x = PI / 2; ring.position.y = 0.1; G.add(ring); SHOW.ring = ring;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: glowTex([[0, 'rgba(255,40,30,0)'], [0.6, 'rgba(255,40,30,0)'], [0.66, 'rgba(255,40,30,0.55)'], [0.78, 'rgba(255,40,30,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.rotation.x = -PI / 2; halo.position.y = 0.11; G.add(halo); SHOW.halo = halo;
    // light architecture: overhead soft-box bar and an arc of vertical light blades behind the car
    const lm = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), toneMapped: true });
    const top = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 1.4), lm('#ffffff')); top.position.set(0, 7.5, 0); G.add(top);
    for (const z of [-2.2, 2.2]) { const s = new THREE.Mesh(new THREE.BoxGeometry(12, 0.06, 0.25), lm('#dfe8ff')); s.position.set(0, 7.45, z); G.add(s); }
    SHOW.blades = [];
    for (let i = 0; i < 23; i++) { const a = -1.3 + i / 22 * 2.6 + PI, r = 17.5, h = 4.2, red = i === 11; const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.09), new THREE.MeshBasicMaterial({ color: new THREE.Color(red ? '#ff2a2a' : '#c8d2e0').multiplyScalar(red ? 2.6 : 1.1) })); b.position.set(Math.sin(a) * r, 0.6 + h / 2, Math.cos(a) * r); G.add(b); SHOW.blades.push(b); }
    for (const y of [0.35, 5.1]) { const st = new THREE.Mesh(new THREE.TorusGeometry(17.5, 0.035, 6, 160, 2.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(y < 1 ? '#ff2a2a' : '#c8d2e0').multiplyScalar(y < 1 ? 2.2 : 0.9) })); st.rotation.set(PI / 2, 0, PI / 2 - 1.3 + PI); st.position.y = y; G.add(st); }
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 14, 64, 1, true, PI - 1.4, 2.8), new THREE.MeshStandardMaterial({ color: '#0a0b0d', roughness: 0.6, metalness: 0.4, side: THREE.BackSide })); wall.position.y = 7; G.add(wall);
    // volumetric beams from the ceiling
    const bt = beamTex(); SHOW.beams = [];
    for (const [x, z, c, o] of [[0, 0, '#ffffff', 0.10], [-4.5, -2.5, '#ff4a3a', 0.07], [4.5, -2.5, '#8fb8ff', 0.07]]) { const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3.4, 7.4, 32, 1, true), new THREE.MeshBasicMaterial({ map: bt, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(x, 3.75, z); G.add(cone); SHOW.beams.push(cone); }
    // drifting dust in the light
    const N = 260, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 12; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = (Math.random() - 0.5) * 12; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    SHOW.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.035, color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex([[0, '#fff'], [1, 'rgba(255,255,255,0)']]) })); G.add(SHOW.dust);
    // lights: soft top key (with shadow), red and blue rims, low front fill
    const key = new THREE.SpotLight('#ffffff', 220, 30, 0.55, 0.7, 1.6); key.position.set(0, 9, 1); key.target.position.set(0, 0, 0); key.castShadow = !isTouch; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; G.add(key, key.target);
    for (const [x, z, c, I] of [[-7, -5, '#ff3a2a', isTouch ? 7 : 22], [7, -5, '#6aa8ff', isTouch ? 10 : 28], [0, 8, '#ffffff', 30]]) { const l = new THREE.SpotLight(c, I, 30, 0.42, 0.9, 1.5); l.position.set(x, 3.2, z); l.target.position.set(0, 0.9, 0); G.add(l, l.target); }
    // bright "infinity cove" studio for car selection (Monoposto-style), toggled with setStudio(true)
    SHOW.darkSet = G.children.filter(o => o !== SHOW.disc && o !== shadowFloor && o !== key && o !== key.target);
    const wf = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#eceef1', roughness: 0.42, metalness: 0 })); wf.rotation.x = -PI / 2; wf.position.y = -0.001; wf.receiveShadow = true;
    const cove = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24, 0, PI * 2, 0, PI / 2), new THREE.MeshBasicMaterial({ color: '#dfe2e6', side: THREE.BackSide, fog: true }));
    const hw = new THREE.HemisphereLight('#ffffff', '#b9bec4', 0.6), dw = new THREE.DirectionalLight('#ffffff', 2.4); dw.position.set(4, 10, 6);
    SHOW.whiteSet = [wf, cove, hw, dw]; SHOW.whiteSet.forEach(o => { o.visible = false; G.add(o); });
    const cv = $('#gl'); cv.addEventListener('pointerdown', e => { if (RACE.on) return; SHOW.drag = { x: e.clientX, r: SHOW.rot }; }); addEventListener('pointerup', () => SHOW.drag = null);
    addEventListener('pointermove', e => { if (SHOW.drag && !RACE.on) SHOW.rot = SHOW.drag.r + (e.clientX - SHOW.drag.x) * 0.008; });
  }
  SHOW.g.visible = true; SHOW.whiteOn = null; setStudio(false); if (POST.bloom) { POST.bloomBase = 0.3; POST.bloom.threshold = 1.0; } scene.background = new THREE.Color('#030405'); scene.fog = new THREE.Fog('#030405', 16, 34); sun.castShadow = false; sun.intensity = 0; hemi.intensity = 0.05;
}
export function setStudio(white) {
  if (!SHOW.g || SHOW.whiteOn === white) return; SHOW.whiteOn = white;
  SHOW.darkSet.forEach(o => o.visible = !white); SHOW.whiteSet.forEach(o => o.visible = white);
  const bg = white ? '#dfe2e6' : '#030405'; scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, white ? 14 : 16, white ? 30 : 34);
  useCarEnv(white ? 'white' : 'studio'); hemi.intensity = white ? 0.2 : 0.05; if (POST.bloom) { POST.bloomBase = white ? 0.12 : 0.3; POST.bloom.threshold = white ? 1.6 : 1.0; }
}
export async function showCar(id) {
  if (SHOW.id === id && SHOW.car) { applyPaint(); return; } SHOW.id = id; const my = ++SHOW.busy;
  const opts = { color: (paintOf(id) || {}).c || CAR(id).col, finish: (paintOf(id) || {}).f || 'metal' };
  const place = car => { if (my !== SHOW.busy) { car.dispose(); return false; } if (SHOW.car) SHOW.car.dispose(); SHOW.car = car; car.group.position.y = 0.12; SHOW.g.add(car.group); car.group.traverse(o => { if (o.isMesh) o.castShadow = !isTouch; }); applyPaint(); car.setHeadlights(true); car.setBrake(false, true); return true; };
  SHOW.dist = clamp(CAR(id).len * 1.42, 5.6, 9);
  // instant: show the light model first (small download), then swap in full detail when it is ready
  if (!isLoaded(id)) { $('#spin').classList.add('on'); const lo = await buildCar(id, { ...opts, lo: true }); $('#spin').classList.remove('on'); if (!place(lo)) return; SHOW.intro = Math.max(SHOW.intro || 0, 0.6); }
  const hi = await buildCar(id, opts); if (place(hi) && isLoaded(id) && !SHOW.introDone) { SHOW.intro = 1; SHOW.introDone = true; }
}
function applyPaint() { if (!SHOW.car) return; const p = paintOf(SHOW.id); if (p) SHOW.car.setPaint(p.c, p.f); SHOW.car.setCustom(customOf(SHOW.id)); }
export function updateShowroom(dt) {
  if (!SHOW.g || !SHOW.g.visible) return; SHOW.t += dt; const T = SHOW.t; if (!SHOW.drag) SHOW.rot += dt * 0.16; const r = SHOW.rot;
  if (SHOW.car) { SHOW.car.group.rotation.y = r; SHOW.disc.rotation.y = r; SHOW.car.update(dt, 0, Math.sin(T / 1.4) * 0.25); }
  SHOW.ring.material.color.setRGB(1, 0.16, 0.16).multiplyScalar(1.1 + Math.sin(T * 2.2) * 0.35); SHOW.halo.material.opacity = 0.3 + Math.sin(T * 2.2) * 0.12;
  SHOW.blades.forEach((b, i) => { const k = 0.55 + 0.45 * Math.max(0, Math.sin(T * 1.6 - i * 0.35)); b.material.color.setScalar(k * 1.3); if (i === 11) b.material.color.setRGB(2.6, 0.4, 0.4); }); SHOW.beams.forEach((b, i) => b.material.opacity = [0.1, 0.07, 0.07][i] * (0.75 + 0.25 * Math.sin(T * 0.9 + i * 2)));
  const dp = SHOW.dust.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.12; if (y > 7) y = 0; dp.setY(i, y); } dp.needsUpdate = true;
  // camera: slow cinematic drift; portrait frames the car larger and lower
  const wide = innerWidth / innerHeight, por = wide < 1; SHOW.intro = Math.max(0, (SHOW.intro || 0) - dt * 0.6); const e = SHOW.intro * SHOW.intro;
  const mode = cur === 'title' || cur === 'boot' ? 'title' : cur === 'hub' ? 'hub' : cur === 'setup' && setupStep === 2 ? 'car' : 'side';
  const k = { title: por ? 1.22 : 1.12, hub: por ? 1.15 : 0.78, car: por ? 1.3 : 0.9, side: por ? 1.55 : 1 }[mode];
  const d = SHOW.dist * k * (1 + e * 0.5), az = 0.85 + Math.sin(T * 0.11) * 0.18 + e * 0.6, el = ({ title: 1.7, hub: 1.45, car: 1.15, side: 1.25 }[mode]) + Math.sin(T * 0.17) * 0.2;
  camera.position.set(Math.sin(az) * d, el, Math.cos(az) * d);
  if (mode === 'title') camera.lookAt(0, por ? 1.15 : 0.95, 0); else if (mode === 'hub') camera.lookAt(0, por ? 0.15 : 0.3, 0); else if (mode === 'car') camera.lookAt(0, por ? 0.3 : 0.45, 0); else camera.lookAt(wide > 1.2 ? -1.1 : 0, por ? 0.2 : 0.55, 0);
  camera.fov = por ? 52 : 36;
  if (window.__kv) { const K = window.__kv; camera.position.set(...K.p); camera.lookAt(...K.l); camera.fov = K.f; if (SHOW.car && K.r != null) { SHOW.car.group.rotation.y = K.r; SHOW.disc.rotation.y = K.r; } }
  camera.updateProjectionMatrix();
}

// ---------- navigation ----------
let cur = 'title', setupStep = 0; const SET = S.last;
export function show(id) { if (id !== cur) { drawSetup.last = -1; drawGarage.last = null; } if (id !== 'setup') setStudio(false); $$('.scr').forEach(s => s.classList.toggle('on', s.id === 's-' + id)); cur = id; if (RENDER[id]) RENDER[id](); const sc = $('#s-' + id); if (sc) sc.scrollTop = 0; }
const ICON = {
  formula: '<svg viewBox="0 0 64 32"><path d="M4 20h10l4-6h10l3-4h6l3 4h10l4 6h6v4H4z" class="f"/><circle cx="14" cy="24" r="5" class="d"/><circle cx="50" cy="24" r="5" class="d"/><path d="M2 14h10v3H2zM52 12h10v4H52z" class="f"/></svg>',
  hyper: '<svg viewBox="0 0 64 32"><path d="M3 22c3-6 10-8 18-9 5-5 12-6 20-4l9 5c6 1 10 3 11 8v3H3z" class="f"/><path d="M24 13c6-4 12-4 17-1l-3 3H22z" class="d"/><circle cx="15" cy="25" r="5" class="d"/><circle cx="49" cy="25" r="5" class="d"/></svg>',
  rally: '<svg viewBox="0 0 64 32"><path d="M4 22l3-8 10-2 6-6h16l9 6 9 2 3 8v3H4z" class="f"/><path d="M25 8h13l6 5H21z" class="d"/><path d="M46 6h12v3H46z" class="f"/><circle cx="16" cy="25" r="5" class="d"/><circle cx="48" cy="25" r="5" class="d"/></svg>',
  offroad: '<svg viewBox="0 0 64 32"><path d="M4 18l4-7h14l5-6h15l5 6h11l2 7v3H4z" class="f"/><circle cx="15" cy="23" r="7" class="d"/><circle cx="49" cy="23" r="7" class="d"/><path d="M28 7h12l3 4H25z" class="d"/></svg>',
  flag: '<svg viewBox="0 0 32 32"><path d="M6 4v26M6 5h20l-4 6 4 6H6" class="s"/><path d="M8 6h4v4H8zM16 6h4v4h-4zM12 10h4v4h-4zM20 10h4v4h-4z" class="d"/></svg>',
  trophy: '<svg viewBox="0 0 32 32"><path d="M9 4h14v7a7 7 0 0 1-14 0zM6 6h3v4a3 3 0 0 1-3-3zM26 6h-3v4a3 3 0 0 0 3-3zM14 18h4v5h4v4H10v-4h4z" class="f"/></svg>',
  clock: '<svg viewBox="0 0 32 32"><circle cx="16" cy="17" r="11" class="s"/><path d="M16 10v7l5 3M13 3h6" class="s"/></svg>',
  garage: '<svg viewBox="0 0 32 32"><path d="M3 13L16 4l13 9v15H3z" class="f"/><path d="M8 16h16v12H8z" class="d"/><path d="M8 19h16M8 22h16M8 25h16" class="s2"/></svg>',
  gear: '<svg viewBox="0 0 32 32"><path d="M14 3h4l1 4 3 1 3-2 3 3-2 3 1 3 4 1v4l-4 1-1 3 2 3-3 3-3-2-3 1-1 4h-4l-1-4-3-1-3 2-3-3 2-3-1-3-4-1v-4l4-1 1-3-2-3 3-3 3 2 3-1z" class="f"/><circle cx="16" cy="16" r="5" class="d"/></svg>',
}; ICON.gt = ICON.hyper;
const RENDER = {
  title() { $('#tName').value = S.name; },
  hub() { $('#hubCoins').textContent = S.coins.toLocaleString(); $('#hubLv').textContent = 'LV ' + S.level; $('#hubXp').style.width = (S.xp / needXP(S.level) * 100) + '%'; $('#hubName').textContent = S.name; showCar(SET.car); },
  setup() { drawSetup(); },
  garage() { drawGarage(); },
  champ() { drawChamp(); },
  settings() { drawSettings(); },
};
function seg(el, opts, curv, cb) { el.innerHTML = opts.map(o => `<button class="${String(o.v) === String(curv) ? 'on' : ''}" data-v="${o.v}" ${o.dis ? 'disabled' : ''}>${o.l}</button>`).join(''); el.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.disabled) return; cb(b.dataset.v); seg(el, opts, b.dataset.v, cb); }); }
function stat(l, v) { return `<div class="st"><span>${l}</span><i><u style="width:${clamp(v, 0, 1) * 100}%"></u></i></div>`; }
function stats(C) { const pw = C.hp / C.kg; return stat('TOP SPEED', (C.top - 150) / 320) + stat('ACCELERATION', pw / 1.3) + stat('HANDLING', (C.grip - 0.8) / 1.25) + stat('BRAKING', (C.brake - 0.9) / 1.4) + stat('OFF-ROAD', C.loose); }

// ---------- race setup ----------
function drawSetup() {
  { const B = $('#suBody'); B.classList.toggle('noanim', drawSetup.last === setupStep); drawSetup.last = setupStep; }
  const steps = ['DISCIPLINE', 'TRACK SELECTION', 'CAR SELECTION', 'DRIVER & RACE']; $('#suTitle').textContent = steps[setupStep];
  $('#suDots').innerHTML = steps.map((x, i) => `<i class="${i === setupStep ? 'on' : i < setupStep ? 'done' : ''}" data-i="${i}"></i>`).join(''); $('#suDots').querySelectorAll('i').forEach(d => d.onclick = () => { if (+d.dataset.i < setupStep) { setupStep = +d.dataset.i; drawSetup(); } });
  const scr = $('#s-setup'); [0, 1, 2, 3].forEach(i => scr.classList.toggle('st' + i, i === setupStep)); setStudio(setupStep === 2);
  const body = $('#suBody');
  const next = () => { SFX.click(); if (setupStep < 3) { setupStep++; drawSetup(); } };
  if (setupStep === 0) { body.innerHTML = `<div class="hscroll">${Object.entries(CLASSES).map(([k, c]) => `<button class="tcard ${SET.cls === k ? 'on' : ''}" data-k="${k}"><div class="tp" style="background-image:url(assets/ui/d_${k}.webp)"></div><div class="tc-t"><b>${c.n}</b><small>${c.d}</small><em>${CARS.filter(x => x.cls === k).length} CARS · ${TRACKS.filter(t => t.cls.includes(k)).length} TRACKS</em></div></button>`).join('')}</div>`;
    body.querySelectorAll('.tcard').forEach(b => b.onclick = () => { const same = SET.cls === b.dataset.k; SET.cls = b.dataset.k; const T = TRACKS.find(t => t.cls.includes(SET.cls)); if (!TRACK(SET.track).cls.includes(SET.cls)) SET.track = T.id; const own = CARS.find(c => c.cls === SET.cls && S.owned[c.id]); if (CAR(SET.car).cls !== SET.cls) SET.car = (own || CARS.find(c => c.cls === SET.cls)).id; save(); showCar(SET.car); if (same) next(); else { body.querySelectorAll('.tcard').forEach(x => x.classList.toggle('on', x === b)); SFX.click(); } }); }
  if (setupStep === 1) { body.innerHTML = `<div class="hscroll">${TRACKS.filter(t => t.cls.includes(SET.cls)).map(t => `<button class="tcard trk ${SET.track === t.id ? 'on' : ''}" data-t="${t.id}"><div class="tp" style="background-image:url(assets/ui/trk_${t.id}.webp)"></div><i class="flag">${FLAGS[t.flag] || ''}</i><canvas data-t="${t.id}" width="180" height="110"></canvas><div class="tc-t"><b>${t.n}</b><small>${t.place || ''}</small><em>${SKIES[t.sky]} · ${trackKm(t)} KM · BEST ${fmt(S.best[t.id + '_' + SET.cls] || Infinity)}</em></div></button>`).join('')}</div>`;
    body.querySelectorAll('canvas').forEach(cv => drawTrackMap(cv, TRACK(cv.dataset.t))); body.querySelectorAll('.tcard').forEach(b => b.onclick = () => { if (SET.track === b.dataset.t) return next(); SET.track = b.dataset.t; save(); body.querySelectorAll('.tcard').forEach(x => x.classList.toggle('on', x === b)); SFX.click(); }); }
  if (setupStep === 2) { const list = CARS.filter(c => c.cls === SET.cls); const i = Math.max(0, list.findIndex(c => c.id === SET.car)); const C = list[i];
    body.innerHTML = `<div class="carsel"><div class="cbanner"><i>${ICON[C.cls] || ''}</i><b>${C.n}</b><small>${C.origin.toUpperCase()} · ${C.drive.toUpperCase()} · ${C.cyl ? C.cyl + '-CYL' : ''}</small></div>
      <button class="arr l" aria-label="Previous car"><svg viewBox="0 0 24 24"><path d="M15 4L7 12l8 8"/></svg></button><button class="arr r" aria-label="Next car"><svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8"/></svg></button>
      <div class="cpanel glass"><div class="specs"><div><b>${C.hp}</b><small>HP</small></div><div><b>${C.top}</b><small>KM/H</small></div><div><b>${C.kg}</b><small>KG</small></div></div>${stats(C)}${S.owned[C.id] ? '<div class="own">OWNED</div>' : `<button class="btn gold" id="buyC">BUY · ${C.price.toLocaleString()} CR</button>`}</div>
      <div class="cdots">${list.map((c, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const go = d => { const n = list[(i + d + list.length) % list.length]; SET.car = n.id; save(); showCar(n.id); SFX.click(); drawSetup(); };
    body.querySelector('.arr.l').onclick = () => go(-1); body.querySelector('.arr.r').onclick = () => go(1); const bb = $('#buyC'); if (bb) bb.onclick = () => buy(C);
    let sx = null; body.querySelector('.carsel').onpointerdown = e => sx = e.clientX; body.querySelector('.carsel').onpointerup = e => { if (sx != null && Math.abs(e.clientX - sx) > 60 && e.target.closest('.carsel') && !e.target.closest('button')) go(e.clientX < sx ? 1 : -1); sx = null; }; }
  if (setupStep === 3) { const D = S.drv || 'm';
    body.innerHTML = `<div class="diffwrap"><div class="drv" style="background-image:url(assets/ui/driver_${D}.webp)"><div class="drvsw"><button data-d="m" class="${D === 'm' ? 'on' : ''}">DRIVER 1</button><button data-d="f" class="${D === 'f' ? 'on' : ''}">DRIVER 2</button></div></div>
      <div class="dright"><h3>HEY ${String(S.name || 'DRIVER').toUpperCase()}</h3><p>How do you want to race today?</p>
      <div class="dbtns">${DIFFS.map((d, k) => `<button class="dbtn ${SET.diff === k ? 'on' : ''}" data-v="${k}"><i>${['<svg viewBox="0 0 40 40"><path d="M20 4l14 8v16l-14 8-14-8V12z" class="hx"/><path d="M13 21l5 5 10-11" class="ck"/></svg>', '<svg viewBox="0 0 40 40"><path d="M20 4l14 8v16l-14 8-14-8V12z" class="hx"/><circle cx="20" cy="20" r="8" class="ck"/><path d="M20 12v8l5 3" class="ck"/></svg>', '<svg viewBox="0 0 40 40"><path d="M20 4l14 8v16l-14 8-14-8V12z" class="hx"/><path d="M12 26h16M14 26l2-10 4 5 4-5 2 10" class="ck"/></svg>'][k]}</i><b>${d.n}</b><small>${['Gentle rivals, help when you need it', 'Fast rivals, a real fight', 'Flat-out legends, no mercy'][k]}</small></button>`).join('')}</div>
      <div class="opts"><div class="opt"><label>LAPS</label><div class="seg" id="oLaps"></div></div><div class="opt"><label>RIVALS</label><div class="seg" id="oOpp"></div></div>
      <div class="opt"><label>TIME & WEATHER</label><div class="seg" id="oSky"></div></div><div class="opt"><label>GEARBOX</label><div class="seg" id="oTrans"></div></div><div class="opt"><label>DRIVING ASSIST</label><div class="seg" id="oAssist"></div></div></div></div></div>`;
    body.querySelectorAll('.dbtn').forEach(b => b.onclick = () => { SET.diff = +b.dataset.v; save(); body.querySelectorAll('.dbtn').forEach(x => x.classList.toggle('on', x === b)); SFX.click(); });
    body.querySelectorAll('.drvsw button').forEach(b => b.onclick = () => { S.drv = b.dataset.d; save(); drawSetup(); });
    seg($('#oLaps'), [1, 2, 3, 5, 8].map(v => ({ v, l: v + (v === 1 ? ' LAP' : ' LAPS') })), SET.laps, v => { SET.laps = +v; save(); });
    seg($('#oOpp'), (SET.mode === 'trial' ? [0] : [3, 5, 7, 9, 11, ...(!isTouch || Q.level >= 3 ? [15, 19] : [])]).map(v => ({ v, l: v ? v + ' RIVALS' : 'SOLO' })), SET.mode === 'trial' ? 0 : SET.opp, v => { SET.opp = +v; save(); });
    seg($('#oSky'), [{ v: 'auto', l: 'TRACK DEFAULT' }, ...Object.entries(SKIES).map(([v, l]) => ({ v, l }))], SET.sky, v => { SET.sky = v; save(); });
    seg($('#oTrans'), [{ v: 'auto', l: 'AUTOMATIC' }, { v: 'manual', l: 'MANUAL' }], S.set.trans, v => { S.set.trans = v; save(); });
    seg($('#oAssist'), [{ v: 'true', l: 'ON' }, { v: 'false', l: 'OFF' }], String(S.set.assist), v => { S.set.assist = v === 'true'; save(); }); }
  const ok = S.owned[SET.car]; $('#suGo').disabled = setupStep >= 2 && !ok; $('#suGo').innerHTML = setupStep >= 2 && !ok ? 'LOCKED · BUY TO RACE' : setupStep < 3 ? 'CONTINUE' : 'START RACE ▸'; $('#suInfo').textContent = `${CLASSES[SET.cls].n} · ${TRACK(SET.track).n} · ${CAR(SET.car).n}`;
}
function carDetail(el, C) { const p = paintOf(C.id); el.innerHTML = `<h3>${C.n}</h3><p class="cd">${C.desc}</p><div class="specs"><div><b>${C.hp}</b><small>HP</small></div><div><b>${C.top}</b><small>KM/H</small></div><div><b>${C.kg}</b><small>KG</small></div><div><b>${C.drive.toUpperCase()}</b><small>DRIVE</small></div></div>${stats(C)}${S.owned[C.id] ? '' : `<button class="btn gold" id="buyC">BUY · ${C.price.toLocaleString()} CR</button>`}`;
  const b = $('#buyC'); if (b) b.onclick = () => buy(C); }
function buy(C) { if (S.coins < C.price) { toast('Not enough credits — win races to earn more'); return; } S.coins -= C.price; S.owned[C.id] = 1; save(); SFX.cash(); haptic([30, 30, 60]); toast(`${C.n} is yours!`); RENDER[cur] && RENDER[cur](); }
const trackKm = t => { let L = 0; const p = t.pts; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return (L * 1.08 * (t.scale || 1.4) / 1000).toFixed(1); };
function drawTrackMap(cv, t) { const x = cv.getContext('2d'), p = t.pts; let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const q of p) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }
  const s = Math.min((cv.width - 20) / (b - a), (cv.height - 20) / (d - c)); const P = q => [10 + (q[0] - a) * s + ((cv.width - 20) - (b - a) * s) / 2, cv.height - 10 - (q[1] - c) * s - ((cv.height - 20) - (d - c) * s) / 2];
  const curve = new THREE.CatmullRomCurve3(p.map(q => new V3(q[0], 0, q[1])), true, 'centripetal').getPoints(200); x.lineJoin = 'round'; x.beginPath(); curve.forEach((q, i) => { const [u, v] = P([q.x, q.z]); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath();
  x.strokeStyle = '#000'; x.lineWidth = 9; x.stroke(); x.strokeStyle = '#e9edf1'; x.lineWidth = 4; x.stroke(); const [u, v] = P(p[0]); x.fillStyle = '#ff2a2a'; x.beginPath(); x.arc(u, v, 5, 0, 7); x.fill(); }

// ---------- garage ----------
let gTab = 'cars';
function drawGarage() {
  { const B = $('#gBody'); B.classList.toggle('noanim', drawGarage.last === gTab); drawGarage.last = gTab; }
  $('#gCoins').textContent = S.coins.toLocaleString(); const C = CAR(SET.car); const body = $('#gBody');
  $('#gTabs').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.t === gTab); b.onclick = () => { gTab = b.dataset.t; drawGarage(); }; });
  if (gTab === 'cars') { body.innerHTML = Object.entries(CLASSES).map(([k, cl]) => `<h4>${cl.n}</h4><div class="carlist">${CARS.filter(c => c.cls === k).map(c => `<button class="crow ${SET.car === c.id ? 'on' : ''} ${S.owned[c.id] ? '' : 'lock'}" data-c="${c.id}"><b>${c.n}</b><small>${c.hp} HP · ${c.top} KM/H</small>${S.owned[c.id] ? '<em>OWNED</em>' : `<em class="pr">${c.price.toLocaleString()} CR</em>`}</button>`).join('')}</div>`).join('') + `<div class="cardet" id="cDet"></div>`;
    body.querySelectorAll('.crow').forEach(b => b.onclick = () => { SET.car = b.dataset.c; SET.cls = CAR(SET.car).cls; save(); showCar(SET.car); drawGarage(); SFX.click(); }); carDetail($('#cDet'), C); }
  if (gTab === 'tune') { const U = ups(C.id); body.innerHTML = `<h4>${C.n}</h4>` + (S.owned[C.id] ? UPGRADES.map(u => { const lv = U[u.id]; return `<div class="upg"><div><b>${u.n}</b><small>${u.d}</small><div class="pips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>${lv < 3 ? `<button class="btn" data-u="${u.id}">UPGRADE · ${u.cost[lv].toLocaleString()} CR</button>` : '<em>MAXED</em>'}</div>`; }).join('') : '<p class="hint">Buy this car first to tune it.</p>');
    body.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const u = UPGRADES.find(x => x.id === b.dataset.u), lv = U[u.id]; if (S.coins < u.cost[lv]) return toast('Not enough credits'); S.coins -= u.cost[lv]; U[u.id]++; save(); SFX.rev(); haptic(40); drawGarage(); }); }
  if (gTab === 'paint') { const p = paintOf(C.id) || { c: C.col, f: 'metal' }; body.innerHTML = `<h4>${C.n}</h4><p class="hint">Cars with a factory racing livery keep their decals; the finish still changes.</p><div class="swatches">${PAINTS.map(c => `<button style="--c:${c}" class="${p.c === c ? 'on' : ''}" data-c="${c}"></button>`).join('')}</div><div class="seg" id="pFin"></div>`;
    body.querySelectorAll('.swatches button').forEach(b => b.onclick = () => { S.paint[C.id] = { c: b.dataset.c, f: (paintOf(C.id) || p).f }; save(); applyPaint(); SFX.click(); drawGarage(); });
    seg($('#pFin'), FINISH.map(f => ({ v: f.id, l: f.n })), p.f, v => { S.paint[C.id] = { c: (paintOf(C.id) || p).c, f: v }; save(); applyPaint(); }); }
  if (gTab === 'custom') { const cu = customOf(C.id);
    body.innerHTML = `<h4>${C.n}</h4><p class="hint">Make it yours — every change shows instantly on the car and in races.</p>` + Object.entries(CUSTOM).map(([k, g]) => `<div class="cgrp"><label>${g.n}</label><div class="copts" data-k="${k}">${g.o.map(([v, n, col]) => `<button class="copt ${cu[k] === v ? 'on' : ''}" data-v="${v}" style="--c:${col}"><i></i><span>${n}</span></button>`).join('')}</div></div>`).join('') + `<button class="btn" id="cuReset">RESET TO FACTORY</button>`;
    body.querySelectorAll('.copts').forEach(g => g.querySelectorAll('.copt').forEach(b => b.onclick = () => { S.custom[C.id] = { ...customOf(C.id), [g.dataset.k]: b.dataset.v }; save(); applyPaint(); SFX.click(); g.querySelectorAll('.copt').forEach(x => x.classList.toggle('on', x === b)); if (g.dataset.k === 'nitro' || g.dataset.k === 'glow') haptic(15); }));
    $('#cuReset').onclick = () => { delete S.custom[C.id]; save(); applyPaint(); drawGarage(); }; }
}

// ---------- championships ----------
function drawChamp() {
  $('#chBody').innerHTML = CHAMPS.map(ch => { const st = S.champ[ch.id] || { r: 0, pts: {} }; const done = st.r >= ch.races.length; const myPts = st.pts[S.name] || 0;
    return `<div class="champ"><div class="ico">${ICON[ch.cls]}</div><div class="ci"><b>${ch.n}</b><small>${CLASSES[ch.cls].n} · ${ch.races.length} ROUNDS · PRIZE ${ch.prize.toLocaleString()} CR</small><div class="rounds">${ch.races.map((r, i) => `<span class="${i < st.r ? 'done' : i === st.r ? 'next' : ''}">${i + 1}. ${TRACK(r[0]).n.split(' ')[0]} · ${SKIES[r[1]] || 'CLEAR'}</span>`).join('')}</div><small>YOUR POINTS: <b>${myPts}</b></small></div>
    <button class="btn ${done ? '' : 'gold'}" data-ch="${ch.id}">${done ? 'RESTART' : st.r ? 'NEXT ROUND ▸' : 'START ▸'}</button></div>`; }).join('');
  $$('#chBody [data-ch]').forEach(b => b.onclick = () => { const ch = CHAMPS.find(c => c.id === b.dataset.ch); let st = S.champ[ch.id]; if (!st || st.r >= ch.races.length) st = S.champ[ch.id] = { r: 0, pts: {} };
    const car = CAR(SET.car).cls === ch.cls && S.owned[SET.car] ? SET.car : (CARS.find(c => c.cls === ch.cls && S.owned[c.id]) || {}).id; if (!car) return toast('You need a ' + CLASSES[ch.cls].n + ' car — check the Garage');
    const [trk, sky] = ch.races[st.r]; go({ mode: 'champ', champ: ch.id, cls: ch.cls, track: trk, sky, car, laps: 3, opp: 9, diff: SET.diff }); });
}

// ---------- settings ----------
// ---------- settings: tabbed, slider knobs + glowing toggles ----------
let sTab = 'gameplay';
function knob(el, opts, curv, cb) { // discrete slider: red fill + round knob showing the value; tap or drag
  let i = Math.max(0, opts.findIndex(o => String(o.v) === String(curv))); el.classList.add('knob');
  el.innerHTML = `<div class="kt"><u></u><b></b></div>`; const tr = el.firstChild, fill = tr.firstChild, kb = tr.lastChild;
  const paint = () => { const f = opts.length > 1 ? i / (opts.length - 1) : 0; fill.style.width = f * 100 + '%'; kb.style.left = f * 100 + '%'; kb.textContent = opts[i].l; };
  const pick = x => { const r = tr.getBoundingClientRect(); const n = Math.round(clamp((x - r.left) / r.width, 0, 1) * (opts.length - 1)); if (n !== i) { i = n; paint(); cb(opts[i].v); SFX.click(); if (S.set.haptics) haptic(6); } };
  let drag = false; tr.onpointerdown = e => { drag = true; try { tr.setPointerCapture(e.pointerId); } catch (_) {} pick(e.clientX); }; tr.onpointermove = e => { if (drag) pick(e.clientX); }; tr.onpointerup = tr.onpointercancel = () => drag = false; paint(); }
function toggle(el, on, cb) { el.classList.add('tgl'); el.classList.toggle('on', !!on); el.onclick = () => { on = !on; el.classList.toggle('on', on); cb(on); SFX.click(); if (S.set.haptics) haptic(8); }; }
const pct = (a, b, n) => Array.from({ length: n }, (_, k) => +(a + (b - a) * k / (n - 1)).toFixed(2));
function drawSettings() {
  const tabs = [['gameplay', 'GAMEPLAY'], ['controls', 'CONTROLS'], ['video', 'VIDEO'], ['audio', 'AUDIO'], ['display', 'DISPLAY'], ['about', 'ABOUT']];
  const b = $('#setBody'); const row = (id, l, kind = 'k') => `<div class="srow"><label>${l}</label><div class="sctl ${kind}" id="${id}"></div></div>`;
  let body = '';
  if (sTab === 'gameplay') body = `<div class="srow"><label>Driver Name</label><input id="sName" maxlength="16" value="${S.name.replace(/"/g, '')}"></div>` + row('sDiff', 'Opponents Level') + row('sAssist', 'Driving Help', 't') + row('sTrans', 'Manual Gearbox', 't') + row('sU', 'Speed Units');
  if (sTab === 'controls') body = `<div class="srow"><label>Control Mode</label><div class="cmodes" id="sSt">${[['buttons', '<svg viewBox="0 0 48 32"><circle cx="12" cy="16" r="10"/><circle cx="36" cy="16" r="10"/><path d="M14 11l-5 5 5 5M34 11l5 5-5 5"/></svg>', 'BUTTONS'], ['tilt', '<svg viewBox="0 0 48 32"><rect x="16" y="4" width="16" height="24" rx="3"/><path d="M8 8a14 14 0 0 0 0 16M40 8a14 14 0 0 1 0 16"/></svg>', 'TILT'], ['wheel', '<svg viewBox="0 0 48 32"><circle cx="24" cy="16" r="13"/><circle cx="24" cy="16" r="3"/><path d="M11 16h10M27 16h10M24 19v10"/></svg>', 'WHEEL']].map(([v, ic, l]) => `<button data-v="${v}" class="${S.set.steer === v ? 'on' : ''}">${ic}<small>${l}</small></button>`).join('')}</div></div>` + row('sSens', 'Steer Sensitivity') + row('sHap', 'Vibration', 't') + row('sCam', 'Default Camera');
  if (sTab === 'video') body = row('sQ', 'Graphic Level') + row('sBloom', 'Bloom Effect') + row('sFilm', 'Cinematic Colour Grade', 't');
  if (sTab === 'audio') body = row('sVol', 'Master Volume') + row('sEng', 'Engine Volume');
  if (sTab === 'display') body = row('sMap', 'Map', 't') + row('sBoard', 'Timing Tower & Gaps', 't') + row('sTimes', 'Lap Times', 't');
  if (sTab === 'about') body = `<div class="keys"><label>KEYBOARD</label><p>↑ / W accelerate · ↓ / S brake & reverse · ← → / A D steer · SPACE handbrake · SHIFT nitro · C camera · R recover car · Q / E manual gears · ESC pause</p><label>CONTROLLER</label><p>Left stick steer · RT accelerate · LT brake · A nitro · X handbrake · Y camera · LB / RB gears · START pause</p><label>CREDITS</label><p><a href="credits.html" target="_blank">3D models, artwork and sound credits</a> · Version ${VERSION}</p></div>`;
  b.innerHTML = `<div class="stabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${k === sTab ? 'on' : ''}">${l}</button>`).join('')}</div><div class="spanel glass">${body}</div>`;
  b.querySelectorAll('.stabs button').forEach(x => x.onclick = () => { sTab = x.dataset.t; SFX.click(); drawSettings(); });
  const E = id => $('#' + id);
  if (E('sName')) E('sName').onchange = e => { S.name = e.target.value.trim().slice(0, 16) || 'Driver'; save(); };
  if (E('sDiff')) knob(E('sDiff'), DIFFS.map((d, i) => ({ v: i, l: ['Easy', 'Hard', 'Pro'][i] })), SET.diff ?? 1, v => { SET.diff = +v; save(); });
  if (E('sAssist')) toggle(E('sAssist'), S.set.assist, v => { S.set.assist = v; save(); });
  if (E('sTrans')) toggle(E('sTrans'), S.set.trans === 'manual', v => { S.set.trans = v ? 'manual' : 'auto'; save(); });
  if (E('sU')) knob(E('sU'), [{ v: 'kmh', l: 'KMH' }, { v: 'mph', l: 'MPH' }], S.set.units, v => { S.set.units = v; save(); });
  if (E('sSt')) E('sSt').querySelectorAll('button').forEach(x => x.onclick = async () => { S.set.steer = x.dataset.v; save(); E('sSt').querySelectorAll('button').forEach(y => y.classList.toggle('on', y === x)); SFX.click(); if (x.dataset.v === 'tilt') await enableTilt(); });
  if (E('sSens')) knob(E('sSens'), pct(0.5, 1.5, 11).map(v => ({ v, l: Math.round(v * 100) })), S.set.sens, v => { S.set.sens = +v; save(); });
  if (E('sHap')) toggle(E('sHap'), S.set.haptics, v => { S.set.haptics = v; save(); });
  if (E('sCam')) knob(E('sCam'), ['Chase', 'Far', 'Hood', 'Bumper'].map((l, i) => ({ v: i, l })), S.set.cam, v => { S.set.cam = +v; save(); });
  if (E('sQ')) knob(E('sQ'), [{ v: 0, l: 'Auto' }, { v: 1, l: 'Low' }, { v: 2, l: 'Mid' }, { v: 3, l: 'High' }, { v: 4, l: 'Ultra' }], S.set.quality, v => { S.set.quality = +v; save(); POST.off = !+v && isTouch && !isApple; Q.noShadow = !+v && isTouch && !isApple; applyQuality(+v || Q.auto); });
  if (E('sBloom')) knob(E('sBloom'), Array.from({ length: 11 }, (_, k) => ({ v: k, l: k })), S.set.bloom ?? 5, v => { S.set.bloom = +v; POST.mul = +v / 5; save(); });
  if (E('sFilm')) toggle(E('sFilm'), S.set.film !== false, v => { S.set.film = v; POST.film = v; save(); });
  if (E('sVol')) knob(E('sVol'), Array.from({ length: 11 }, (_, k) => ({ v: k / 10 * 1.2, l: k * 10 })), Math.round((S.set.vol / 1.2) * 10) / 10 * 1.2, v => { S.set.vol = +v; save(); if (AU.master) AU.master.gain.value = +v; });
  if (E('sEng')) knob(E('sEng'), Array.from({ length: 11 }, (_, k) => ({ v: k / 10 * 1.5, l: k * 10 })), Math.round(((S.set.engVol ?? 1) / 1.5) * 10) / 10 * 1.5, v => { S.set.engVol = +v; AU.eng = +v; save(); });
  const hud = (id, key, cls) => { if (E(id)) toggle(E(id), S.set[key] !== false, v => { S.set[key] = v; save(); document.body.classList.toggle(cls, !v); }); };
  hud('sMap', 'hudMap', 'nomap'); hud('sBoard', 'hudBoard', 'noboard'); hud('sTimes', 'hudTimes', 'notimes');
}

// ---------- race flow ----------
let lastCfg = null;
export async function go(cfg) {
  cfg = { ...SET, ...cfg }; lastCfg = cfg; if (isTouch && S.set.steer === 'tilt') enableTilt(); audioInit(); if (AU.master) AU.master.gain.value = S.set.vol; showroom(false); applyQuality(); show('load'); SFX.rev();
  const bar = $('#ldBar'); $('#ldTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; $('#ldTitle').textContent = TRACK(cfg.track).n; $('#ldKv').style.backgroundImage = `url(assets/ui/trk_${cfg.track}.webp)`;
  const sk = SKIES[cfg.sky] || (cfg.sky === 'auto' ? '' : cfg.sky); $('#ldChips').innerHTML = [CAR(cfg.car).n, (CLASSES[cfg.cls] || {}).n, cfg.laps + ' LAPS', sk, cfg.mode === 'trial' ? 'TIME TRIAL' : (cfg.opp || 0) + 1 + ' CARS'].filter(Boolean).map(t => `<span>${String(t).toUpperCase()}</span>`).join('');
  try { await startRace(cfg, f => bar.style.width = Math.round(f * 100) + '%'); } catch (e) { console.error(e); toast('Could not load the race: ' + e.message); show('hub'); showroom(true); return; }
  RACE.onEnd = results; document.body.dataset.steer = S.set.steer; if (IN.steerLabel) IN.steerLabel(); document.body.classList.add('racing'); show('race'); hudShow(true); if (isTouch) { calibrateTilt(); if (S.set.steer === 'tilt' && !S.tiltHint) { S.tiltHint = 1; save(); setTimeout(() => toast('Steer with the arrow buttons or by turning the device · TILT button at the top switches tilt on/off'), 1500); } try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }
}
const TIPS = ['Brake before the corner, not in it — then power out.', 'Hold SHIFT (or the NITRO button) on long straights for a boost.', 'On gravel and mud, a tap of the handbrake swings the car into tight turns.', 'Press C to change camera. Hood and bumper views feel the fastest.', 'Win races to earn credits for new cars and upgrades.', 'Stuck against a wall? Press R to recover your car.', 'Formula cars brake incredibly late — trust the downforce.'];
function results(res) {
  hudShow(false); document.body.classList.remove('racing'); const me = res.find(r => r.me); const cfg = lastCfg; const n = res.length;
  const coins = Math.round((n > 1 ? [12000, 8000, 6000, 4500, 3500, 2800, 2200, 1800, 1500, 1200, 1000, 800][me.pos - 1] || 600 : 3000) * (1 + (cfg.diff || 0) * 0.35) * (cfg.laps / 3 * 0.6 + 0.4));
  const xp = 200 + (n - me.pos) * 60 + cfg.laps * 40; addCoins(coins); const lv = addXP(xp); S.races++; if (me.pos === 1 && n > 1) S.wins++;
  const key = cfg.track + '_' + cfg.cls; if (me.best < (S.best[key] || Infinity)) S.best[key] = me.best;
  let champTxt = ''; if (cfg.mode === 'champ') { const ch = CHAMPS.find(c => c.id === cfg.champ); const st = S.champ[ch.id]; res.forEach(r => { st.pts[r.name] = (st.pts[r.name] || 0) + (POINTS[r.pos - 1] || 0); }); st.r++;
    const table = Object.entries(st.pts).sort((a, b) => b[1] - a[1]); const myRank = table.findIndex(t => t[0] === S.name) + 1;
    champTxt = `<div class="chres"><b>${ch.n}</b> · ROUND ${st.r}/${ch.races.length} · YOU ARE P${myRank} WITH ${st.pts[S.name] || 0} PTS</div>`;
    if (st.r >= ch.races.length && myRank === 1) { addCoins(ch.prize); champTxt += `<div class="chres win">CHAMPION! PRIZE +${ch.prize.toLocaleString()} CR</div>`; } }
  $('#rPos').textContent = n > 1 ? me.pos : fmt(me.best); $('#rPosL').textContent = n > 1 ? 'OF ' + n + ' · POSITION' : 'BEST LAP'; $('#s-results').classList.toggle('win', me.pos === 1 && n > 1);
  save(); $('#rTitle').textContent = me.pos === 1 && n > 1 ? 'VICTORY' : n === 1 ? 'TIME TRIAL COMPLETE' : `P${me.pos} FINISH`;
  $('#rTable').innerHTML = res.map(r => `<div class="${r.me ? 'me' : ''}"><i>${r.pos}</i><b>${r.name}</b><span>${r.car}</span><em>${fmt(r.time)}${r.est ? '*' : ''}</em><small>${fmt(r.best)}</small></div>`).join('');
  $('#rRew').innerHTML = `<div><b>+${coins.toLocaleString()}</b><small>CREDITS</small></div><div><b>+${xp}</b><small>XP${lv ? ' · LEVEL UP!' : ''}</small></div><div><b>${fmt(me.best)}</b><small>BEST LAP</small></div>` + champTxt;
  const champNext = cfg.mode === 'champ' && S.champ[cfg.champ].r < CHAMPS.find(c => c.id === cfg.champ).races.length; $('#rNext').style.display = champNext ? '' : 'none';
  show('results'); SFX.cash(); if (me.pos === 1) haptic([60, 40, 120]);
}
export function quitToMenu() { document.body.classList.remove('racing'); setPaused(false); endRace(); hudShow(false); $('#pause').classList.remove('on'); show('hub'); showroom(true); }
export function togglePause(on) { if (!RACE.on || RACE.phase === 'results') return; on = on ?? !RACE.paused; setPaused(on); $('#pause').classList.toggle('on', on); }
export function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2600); }

export function initUI() {
  document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('button'); if (!b) return; audioInit(); SFX.click(); if (S.set.haptics) haptic(10); }, true);
  $('#tGo').onclick = () => { S.name = ($('#tName').value || 'Driver').trim().slice(0, 16); save(); audioInit(); SFX.rev(); show('hub'); };
  $$('[data-go]').forEach(b => b.onclick = () => { const id = b.dataset.go; if (id === 'custom' || id === 'tune') { gTab = id; show('garage'); return; } if (id === 'garage') gTab = 'cars'; if (id === 'quick') { SET.mode = 'quick'; setupStep = 0; show('setup'); } else if (id === 'trial') { SET.mode = 'trial'; setupStep = 0; show('setup'); } else show(id); });
  $$('.back').forEach(b => b.onclick = () => { if (cur === 'setup' && setupStep > 0) { setupStep--; drawSetup(); } else show('hub'); });
  $('#suGo').onclick = () => { if (setupStep < 3) { setupStep++; drawSetup(); return; } go(SET.mode === 'trial' ? { opp: 0 } : {}); };
  $('#pRes').onclick = () => togglePause(false); if ($('#pTilt')) $('#pTilt').onclick = () => { calibrateTilt(); SFX.click(); toast('Steering centred'); togglePause(false); }; $('#pRestart').onclick = () => { $('#pause').classList.remove('on'); setPaused(false); go(lastCfg); }; $('#pQuit').onclick = quitToMenu;
  $('#rCont').onclick = () => { endRace(); show('hub'); showroom(true); }; $('#rAgain').onclick = () => { if (lastCfg.mode === 'champ') { const st = S.champ[lastCfg.champ]; st.r = Math.max(0, st.r - 1); save(); } go(lastCfg); };
  $('#rNext').onclick = () => { const ch = CHAMPS.find(c => c.id === lastCfg.champ), st = S.champ[ch.id]; const [trk, sky] = ch.races[st.r]; go({ ...lastCfg, track: trk, sky }); };
  IN.onPause = () => togglePause();
  $$('[data-ic]').forEach(e => e.innerHTML = ICON[e.dataset.ic] || ''); $$('.hb').forEach(b => b.style.setProperty('--img', `url(${new URL("assets/ui/", location.href).href}h_${b.dataset.go}.webp)`)); $('#ver').textContent = 'v' + VERSION;
  bindTouch();
  // laurel wreath (results)
  { let p = ''; for (const sd of [-1, 1]) for (let k = 0; k < 9; k++) { const a = (200 - k * 17) * Math.PI / 180, r = 52, x = 100 + sd * Math.cos(a) * r * -1, y = 78 + Math.sin(a) * r * -1; const rot = sd * (k * 17 - 110); p += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="11" ry="4.6" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }
    $('#laurelSvg').innerHTML = `<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e2b04a"/><stop offset="1" stop-color="#8a5a12"/></linearGradient></defs><g fill="url(#lg)">${p}</g>`; }
}
export { cur as curScreen };
