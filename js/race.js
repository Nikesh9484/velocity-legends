// Velocity Legends — race session: grid, start lights, laps & positions, cameras, effects, sound, results
import { THREE, V3, PI, scene, camera, renderer, clamp, lerp, rnd, setSky, followSun, sunDir, SKY, engineVoice, SFX, AU, audioInit, haptic, Q, isTouch } from './engine.js';
import { CARS, CAR, TRACK, DIFFS, RIVALS, PAINTS, FINISH } from './data.js';
import { buildTrack, clearTrack, TR, gridSlot, setStartLights, updateTrack, heightAt } from './track.js';
import { buildCar } from './carmodel.js';
import { Vehicle, collideCars } from './physics.js';
import { buildLine, Driver, LINE } from './ai.js';
import { IN, readInput, resetTouch, calibrateTilt } from './input.js';
import { S, ups, paintOf, customOf } from './state.js';

export const RACE = { on: false, phase: 'idle', cars: [], me: null, t: 0, cfg: null, cam: 0, paused: false, results: null, msg: null, best: Infinity, onEnd: null, lightsN: 0, goT: 0 };
const CAMS = ['CHASE', 'FAR CHASE', 'HOOD', 'BUMPER', 'COCKPIT'];

// ---------- particles: tyre smoke, dust, sparks, nitro flame, rain ----------
function dotTex(inner, outer) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.4, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
class Pool {
  constructor(tex, blending, max) { this.max = max; this.i = 0; const g = new THREE.BufferGeometry(); this.p = new Float32Array(max * 3).fill(1e5); this.s = new Float32Array(max); this.a = new Float32Array(max); this.c = new Float32Array(max * 3).fill(1);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.s, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1)); g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max); this.grow = new Float32Array(max); this.s0 = new Float32Array(max); this.g = g;
    this.m = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, scale: { value: innerHeight } }, transparent: true, depthWrite: false, blending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=min(size*scale/-mv.z, 260.); vA*=smoothstep(1.5, 5., -mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(t.rgb*vC,t.a*vA); if(gl_FragColor.a<.01) discard; }' });
    this.pts = new THREE.Points(g, this.m); this.pts.frustumCulled = false; }
  emit(x, y, z, vx, vy, vz, size, life, grow, r = 1, gg = 1, b = 1) { const i = this.i++ % this.max; this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.s[i] = this.s0[i] = size; this.life[i] = life; this.age[i] = 0; this.grow[i] = grow; this.a[i] = 1; this.c.set([r, gg, b], i * 3); }
  update(dt) { this.m.uniforms.scale.value = innerHeight * 0.9; for (let i = 0; i < this.max; i++) { if (this.life[i] <= 0) continue; this.age[i] += dt; const k = this.age[i] / this.life[i]; if (k >= 1) { this.life[i] = 0; this.p[i * 3 + 1] = 1e5; continue; }
    this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt; this.v[i * 3 + 1] -= dt * (this.grow[i] < 0 ? 9 : -0.4); this.s[i] = this.s0[i] * (1 + Math.max(0, this.grow[i]) * k); this.a[i] = (1 - k) * (k < 0.15 ? k / 0.15 : 1); }
    this.g.attributes.position.needsUpdate = this.g.attributes.size.needsUpdate = this.g.attributes.alpha.needsUpdate = this.g.attributes.color.needsUpdate = true; }
}
let FX = null;
function initFX() { if (FX) { for (const p of Object.values(FX)) if (p.pts) scene.add(p.pts); return; }
  FX = { smoke: new Pool(dotTex('rgba(235,235,235,.9)', 'rgba(200,200,200,.35)'), THREE.NormalBlending, 700), spark: new Pool(dotTex('rgba(255,250,220,1)', 'rgba(255,170,60,.8)'), THREE.AdditiveBlending, 300), fire: new Pool(dotTex('rgba(255,255,255,1)', 'rgba(200,200,200,.7)'), THREE.AdditiveBlending, 200) };
  for (const p of Object.values(FX)) scene.add(p.pts); }
let rain = null;
function makeRain(on) { if (rain) { scene.remove(rain); rain = null; } if (!on) return; const n = 2500, g = new THREE.BufferGeometry(), p = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = rnd(-40, 40), y = rnd(0, 30), z = rnd(-40, 40); p.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); } g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c9d6e2', transparent: true, opacity: 0.35 })); rain.frustumCulled = false; scene.add(rain); }

// ---------- session ----------
export async function startRace(cfg, onProgress = () => {}) {
  endRace(); audioInit(); RACE.cfg = cfg; RACE.phase = 'load'; const T = TRACK(cfg.track); const sky = cfg.sky === 'auto' || !cfg.sky ? T.sky : cfg.sky; RACE.sky = sky;
  await setSky(sky); onProgress(0.08);
  await buildTrack(T, sky, f => onProgress(0.08 + f * 0.5)); initFX(); makeRain(sky === 'rain');
  const mine = CAR(cfg.car); const pool = CARS.filter(c => c.cls === mine.cls); const n = clamp(cfg.opp ?? 7, 0, 19);
  buildLine(mine.grip * (sky === 'rain' ? 0.85 : 1), mine.aero, !!TR.C.loose);
  const names = [...RIVALS].sort(() => Math.random() - 0.5); const myslot = Math.min(n, Math.max(0, Math.round(n * 0.55)));
  const list = []; let k = 0;
  for (let slot = 0; slot <= n; slot++) {
    const isMe = slot === myslot; const C = isMe ? mine : pool[(k++ + (pool.length > 1 ? 1 : 0)) % pool.length];
    const up = isMe ? ups(C.id) : {}; const veh = new Vehicle(C, up); if (sky === 'rain') veh.gripG *= 0.82;
    const gs = gridSlot(slot); veh.place(gs.p, gs.yaw); veh.grid = { p: gs.p.clone ? gs.p.clone() : { ...gs.p }, yaw: gs.yaw }; veh.auto = isMe ? S.set.trans !== 'manual' : true;
    const pp = isMe ? paintOf(C.id) : null; const col = pp ? pp.c : isMe ? C.col : PAINTS[(slot * 5 + 3) % PAINTS.length]; const fin = pp ? pp.f : ['metal', 'gloss', 'pearl'][slot % 3];
    const car = { veh, C, me: isMe, name: isMe ? S.name : names[slot % names.length], lap: 0, half: false, best: Infinity, lapStart: 0, lastLap: 0, fin: 0, finT: 0, total: 0, rank: slot, voice: null, col, finCls: fin };
    const light = !isMe && isTouch && Q.level < 3; // phones/tablets: opponents use the light model only
    car.model = await buildCar(C.id, { color: col, finish: fin, lo: light, noDriver: light }); scene.add(car.model.group); if (isMe) car.model.setCustom(customOf(C.id));
    if (!isMe && !light) { car.lo = await buildCar(C.id, { lo: true, color: col, finish: fin, noDriver: true }); scene.add(car.lo.group); }
    if (!isMe) { car.driver = new Driver(veh, DIFFS[cfg.diff ?? 1].pace * (0.95 + slot / n * 0.05), car.name); }
    list.push(car); onProgress(0.6 + 0.38 * slot / (n + 1));
  }
  RACE.cars = list; RACE.me = list.find(c => c.me); RACE.cam = S.set.cam || 0; RACE.t = 0; RACE.best = Infinity; RACE.results = null; RACE.paused = false;
  RACE.me.voice = engineVoice(mine.cyl, 1, mine.cls); for (const c of list) if (!c.me) c.voice = null;
  for (const c of list) placeModel(c, 0);
  const night = sky === 'night' || sky === 'rain'; for (const c of list) { c.model.setHeadlights(night); c.model.setBrake(false, night); }
  RACE.cam = RACE.cam % CAMS.length; makeWheel(RACE.me);
  // qualifying times + intro sequence (front-runners, then you), then the race title over the grid
  const avg = { formula: 52, hyper: 46, gt: 47, rally: 30, offroad: 27 }[mine.cls] || 42, base = TR.len / avg; list.forEach((c, k) => { c.qt = base * (1 + k * 0.0035 + Math.random() * 0.002); });
  const seq = list.slice(0, 3); if (!seq.includes(RACE.me)) seq.push(RACE.me); RACE.intro = { seq, t: 0, per: 1.7, title: 2.6 };
  RACE.on = true; RACE.phase = 'intro'; RACE.lightsN = 0; RACE.cT = 0; RACE.goT = 1 + Math.random() * 1.2; setStartLights(0); snapCamera(); onProgress(1);
  IN.onSkip = () => { if (RACE.phase === 'intro') endIntro(); };
  IN.onCam = () => { RACE.cam = (RACE.cam + 1) % CAMS.length; S.set.cam = RACE.cam; RACE.msg = { t: CAMS[RACE.cam] + ' CAMERA', life: 1.2 }; };
  IN.onUturn = () => { if (RACE.phase === 'race' && RACE.me) { const v = RACE.me.veh; v.uturn(IN.steer < -0.1 ? -1 : IN.steer > 0.1 ? 1 : 0); RACE.msg = { t: 'U-TURN', life: 0.8 }; } };
  IN.onReset = () => resetCar(RACE.me); IN.onShift = d => { if (RACE.me && !RACE.me.veh.auto) d > 0 ? RACE.me.veh.shiftUp() : RACE.me.veh.shiftDown(); };
  return RACE;
}
export function endRace() { for (const c of RACE.cars) { c.model && c.model.dispose(); c.lo && c.lo.dispose(); c.voice && c.voice.stop(); } RACE.cars = []; RACE.me = null; RACE.on = false; RACE.phase = 'idle'; clearTrack(); makeRain(false); resetTouch(); }
function resetCar(c) { const v = c.veh, s = TR.S[(v.ti + 2) % TR.N]; const p = s.p.clone().addScaledVector(s.n, clamp(LINE.off[s.i] || 0, -s.w / 4, s.w / 4)); v.place(p, Math.atan2(s.t.x, s.t.z)); v.yawRate = 0; if (c.me) { RACE.msg = { t: 'RECOVERED', life: 1 }; snapCamera(); } }

// ---------- per-frame ----------
const _c1 = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new V3(), _o = new V3(), camPos = new V3(), camLook = new V3(), camOff = new V3();
export function updateRace(dt) {
  if (!RACE.on || RACE.paused) return; dt = Math.min(dt, 1 / 10); RACE.t += dt; const me = RACE.me;
  readInput(dt); if (RACE.phase !== 'race' && isTouch) calibrateTilt(); // tilt: whatever angle you hold the phone at the start is 'straight'
  // start procedure: five red lights, then lights out
  if (RACE.phase === 'intro') { updateIntro(dt); return; }
  if (RACE.phase === 'count') { RACE.cT += dt; const n = Math.min(5, Math.floor(RACE.cT / 0.9)); if (n > RACE.lightsN) { RACE.lightsN = n; setStartLights(n); SFX.light(); if (S.set.haptics) haptic(15); }
    if (RACE.cT > 4.5 + RACE.goT) { RACE.phase = 'race'; setStartLights(0); SFX.go(); if (S.set.haptics) haptic([60, 40, 60]); RACE.msg = { t: 'GO!', life: 1.2, big: true }; RACE.raceT0 = RACE.t; for (const c of RACE.cars) c.lapStart = RACE.t; } }
  const racing = RACE.phase === 'race' || RACE.phase === 'done';
  // controls
  const mv = me.veh; mv.input.throttle = IN.throttle; mv.input.brake = IN.brake; mv.input.steer = IN.steer; mv.input.hand = IN.hand; mv.input.nitro = IN.nitro;
  if (S.set.assist && racing) { const lim = (LINE.vmax[(mv.ti + 10) % TR.N] || 99) * 1.06; if (mv.speed > lim + 4 && IN.brake < 0.2 && Math.abs(IN.steer) > 0.25) mv.input.throttle *= 0.6; } // gentle traction/corner assist
  RACE.revT = IN.brake > 0.5 && mv.vF < 1 && IN.throttle < 0.1 && racing && RACE.t - (RACE.raceT0 || 0) > 4 ? (RACE.revT || 0) + dt : 0; mv.input.reverse = RACE.revT > 0.8; /* reverse only after holding brake while stopped */ if (mv.input.reverse) { mv.input.throttle = IN.brake; mv.input.brake = 0; }
  if (me.fin) { mv.input.throttle = 0.25; mv.input.brake = 0; mv.input.steer = 0; }
  const ranks = RACE.cars.map(c => c.rank);
  for (const c of RACE.cars) if (c.driver) { if (!racing) { c.veh.input.throttle = 0; c.veh.input.brake = 1; continue; } const r = c.driver.update(dt, RACE.cars.map(o => o.veh), c.rank, me.rank); if (r === 'reset') resetCar(c); }
  if (!racing) { mv.input.brake = 1; mv.input.throttle = 0; mv.input.steer = 0; mv.input.hand = 0; mv.input.nitro = 0; mv.input.reverse = false; mv.rpmFree = IN.throttle; } // car is held still on the grid: gas only revs the engine
  // physics substeps
  const sub = clamp(Math.ceil(dt / 0.0125), 2, 8), h = dt / sub; for (let k = 0; k < sub; k++) { for (const c of RACE.cars) c.veh.step(h); collideCars(RACE.cars.map(c => c.veh)); }
  if (!racing) for (const c of RACE.cars) { const g = c.veh.grid; if (g) { c.veh.place(g.p, g.yaw); c.veh.vF = 0; } } /* every car is locked on its grid slot until GO — no rolling, turning or reversing */
  if (!racing) { mv.rpm = lerp(mv.rpm, 900 + IN.throttle * (mv.redline - 1500), Math.min(1, dt * 6)); }
  // laps & positions
  for (const c of RACE.cars) progress(c);
  const order = [...RACE.cars].sort((a, b) => (b.fin ? 1e9 - b.finT : 0) - (a.fin ? 1e9 - a.finT : 0) || score(b) - score(a)); order.forEach((c, i) => c.rank = i);
  // events → sound, haptics, camera shake
  for (const c of RACE.cars) { for (const e of c.veh.events) if (c.me) { if (e.k === 'crash') { SFX.crash(Math.min(1.5, e.v / 15)); RACE.shake = Math.min(1, e.v / 18); if (S.set.haptics) haptic(Math.min(120, e.v * 6)); } else if (e.k === 'scrape') { SFX.scrape(); sparks(c); } else if (e.k === 'bump') { SFX.crash(Math.min(0.8, e.v / 12)); RACE.shake = 0.4; if (S.set.haptics) haptic(30); } else if (e.k === 'shift') { SFX.shift(); } else if (e.k === 'land') { SFX.crash(0.4); RACE.shake = 0.5; if (S.set.haptics) haptic(40); } } c.veh.events.length = 0; }
  if (mv.boost && !RACE._boost) SFX.nitro(); RACE._boost = mv.boost;
  // visuals
  const night = RACE.sky === 'night' || RACE.sky === 'rain';
  for (const c of RACE.cars) { placeModel(c, dt); c.model.setBrake(c.veh.input.brake > 0.1 && c.veh.speed > 1, night); effects(c, dt); }
  for (const p of Object.values(FX)) p.update(dt); updateTrack(dt);
  if (rain) { rain.position.copy(camera.position); rain.position.y -= 8; const pa = rain.geometry.attributes.position; for (let i = 0; i < pa.count; i += 2) { let y = pa.getY(i) - dt * 28; if (y < -2) y += 32; pa.setY(i, y); pa.setY(i + 1, y - 0.7); } pa.needsUpdate = true; }
  { const ck = RACE.cam === 4 && !!me.model.driver; if (me.model.driver) me.model.driver.visible = !ck; if (me.wheelUI) { me.wheelUI.g.visible = ck; if (ck) drawWheel(me, dt); } camera.near = ck ? 0.03 : 0.1; }
  updateCamera(dt); followSun(me.veh.p);
  // audio
  if (me.voice) me.voice.set(mv.rpm, racing ? mv.input.throttle : IN.throttle, mv.slip * (mv.air ? 0 : 1) * (mv.speed > 4 ? 1 : 0), mv.speed);
  const near = RACE.cars.filter(c => !c.me).map(c => ({ c, d: c.veh.p.distanceTo(mv.p) })).sort((a, b) => a.d - b.d);
  near.forEach(({ c, d }, i) => { if (i < 3 && d < 120 && AU.ctx) { if (!c.voice) c.voice = engineVoice(c.C.cyl, 0.55, c.C.cls); const right = _p.set(Math.cos(mv.yaw), 0, -Math.sin(mv.yaw)); const rel = c.veh.p.clone().sub(mv.p).normalize(); c.voice.set(c.veh.rpm, c.veh.input.throttle, c.veh.slip, c.veh.speed, d, clamp(rel.dot(right), -1, 1) * 0.8); } else if (c.voice) { c.voice.stop(); c.voice = null; } });
  if (RACE.msg) { RACE.msg.life -= dt; if (RACE.msg.life <= 0) RACE.msg = null; }
  RACE.shake = Math.max(0, (RACE.shake || 0) - dt * 2.5);
  // end of race
  if (RACE.phase === 'done') { RACE.doneT += dt; if (RACE.doneT > 6 || RACE.cars.every(c => c.fin)) finishAll(); }
}
const score = c => c.lap * TR.len + (c.lap === 0 ? c.veh.s - TR.len : c.veh.s);
function progress(c) {
  const v = c.veh, s = v.s, L = TR.len; if (c.prevS === undefined) c.prevS = s;
  if (s > L * 0.4 && s < L * 0.6) c.half = true;
  if (c.prevS > L * 0.8 && s < L * 0.2) { // crossed the line forwards
    if (c.lap === 0 || c.half) { if (c.lap > 0) { const lt = RACE.t - c.lapStart; c.lastLap = lt; if (lt < c.best) c.best = lt; if (c.me) { if (lt < RACE.best) { RACE.best = lt; RACE.msg = { t: 'BEST LAP ' + fmt(lt), life: 2.5 }; } SFX.lap(); } }
      c.lap++; c.half = false; c.lapStart = RACE.t; const laps = RACE.cfg.laps;
      if (c.me && c.lap === laps && laps > 1) RACE.msg = { t: 'FINAL LAP', life: 2.5, big: true };
      if (c.lap > laps && !c.fin) { c.fin = 1; c.finT = RACE.t - RACE.raceT0; if (c.me) { RACE.phase = 'done'; RACE.doneT = 0; RACE.msg = { t: 'FINISH', life: 4, big: true }; SFX.lap(); } } } }
  if (c.prevS < L * 0.2 && s > L * 0.8 && c.lap > 0 && !c.half) c.lap = Math.max(0, c.lap - 1); // reversed over the line
  c.prevS = s;
  if (c.me) { const fw = v.v.x * TR.S[v.ti].t.x + v.v.z * TR.S[v.ti].t.z; RACE.wrong = RACE.phase === 'race' && fw < -3; }
}
function finishAll() {
  if (RACE.results) return; const laps = RACE.cfg.laps;
  for (const c of RACE.cars) if (!c.fin) { const left = (laps + 1 - c.lap) * TR.len - c.veh.s; c.finT = RACE.t - RACE.raceT0 + Math.max(0, left) / Math.max(30, c.veh.speed || 30); c.fin = 1; c.est = true; }
  const order = [...RACE.cars].sort((a, b) => a.finT - b.finT); RACE.results = order.map((c, i) => ({ pos: i + 1, name: c.name, car: c.C.n, me: c.me, time: c.finT, best: c.best, est: !!c.est }));
  RACE.phase = 'results'; RACE.onEnd && RACE.onEnd(RACE.results);
}
export function fmt(t) { if (!isFinite(t)) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`; }

function placeModel(c, dt) {
  const v = c.veh, near = c.me || (!isTouch || Q.level >= 3) && camera.position.distanceTo(v.p) < 20; const M = c.lo && !near ? c.lo : c.model; if (c.lo) { c.model.group.visible = M === c.model; c.lo.group.visible = M === c.lo; }
  const g = M.group; g.position.set(v.p.x, v.y, v.p.z); _e.set(v.pitch, v.yaw, -v.roll); g.quaternion.setFromEuler(_e);
  M.body.position.y = Math.sin(RACE.t * 30 + v.p.x) * 0.004 * Math.min(1, v.speed / 30) * (TR.C.loose ? 4 : 1); // vibration
  M.update(dt, v.vF, v.steer);
}
function effects(c, dt) {
  const v = c.veh; if (v.speed < 2 && !v.boost) return; const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); const back = c.C.len * 0.42;
  const rx = v.p.x - fx * back, rz = v.p.z - fz * back; const loose = v.surf === 'loose' || v.surf === 'gravel' || v.surf === 'grass';
  if (loose && v.speed > 6 && !v.air) { const n = Math.min(3, Math.floor(v.speed / 12) + 1); const col = TR.T.scen === 'forest' ? [0.45, 0.36, 0.27] : TR.T.scen === 'desert' ? [0.86, 0.72, 0.52] : [0.6, 0.55, 0.45];
    for (let k = 0; k < n; k++) FX.smoke.emit(rx + rnd(-1, 1), v.y + 0.3, rz + rnd(-1, 1), -v.v.x * 0.1 + rnd(-1, 1), rnd(0.5, 2), -v.v.z * 0.1 + rnd(-1, 1), 1.6 + v.speed * 0.04, 1.4, 3, ...col); }
  else if (v.slip > 0.45 && !v.air && v.speed > 4) { for (const sd of [-0.8, 0.8]) FX.smoke.emit(rx + fz * sd, v.y + 0.25, rz - fx * sd, rnd(-0.5, 0.5), rnd(0.3, 1), rnd(-0.5, 0.5), 1.1, 1.6, 4, 0.92, 0.92, 0.92); }
  if (v.boost) for (const sd of [-0.3, 0.3]) { const nc = (c.model.custom ? c.model.nitroRGB() : [0.45, 0.65, 1]); FX.fire.emit(rx - fx * 0.3 + fz * sd, v.y + 0.45, rz - fz * 0.3 - fx * sd, -fx * 6, 0, -fz * 6, 0.5, 0.18, 1.5, nc[0], nc[1], nc[2]); }
}
function sparks(c) { const v = c.veh; for (let k = 0; k < 10; k++) FX.spark.emit(v.p.x + rnd(-1, 1), v.y + 0.4, v.p.z + rnd(-1, 1), rnd(-5, 5) - v.v.x * 0.2, rnd(1, 4), rnd(-5, 5) - v.v.z * 0.2, 0.18, 0.4, -1); }

function camTarget(out, look) {
  const v = RACE.me.veh, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), L = RACE.me.C.len; const vd = Math.atan2(v.v.x, v.v.z); const dir = v.speed > 3 ? vd : v.yaw;
  const lag = RACE.cam <= 1 ? lerpAng(v.yaw, dir, 0.12) : v.yaw; const bx = Math.sin(lag), bz = Math.cos(lag);
  if (RACE.cam === 0) { const D = L * 0.5 + 2.3 - Math.min(0.5, v.speed / 140); out.set(v.p.x - bx * D, v.y + 1.25 + L * 0.04, v.p.z - bz * D); look.set(v.p.x + fx * 4, v.y + 0.95, v.p.z + fz * 4); }
  else if (RACE.cam === 1) { out.set(v.p.x - bx * (L * 1.0 + 5), v.y + 2.6, v.p.z - bz * (L * 1.0 + 5)); look.set(v.p.x + fx * 6, v.y + 1.1, v.p.z + fz * 6); }
  else if (RACE.cam === 2) { const H = RACE.me.model.h || 1.2, fo = RACE.me.C.cls === 'formula' ? -0.05 : 0.12; out.set(v.p.x + fx * L * fo, v.y + (RACE.me.C.cls === 'formula' ? 1.05 : H + 0.12), v.p.z + fz * L * fo); look.set(v.p.x + fx * 30, v.y + H * 0.8, v.p.z + fz * 30); }
  else if (RACE.cam === 3 || !RACE.me.model.driver) { out.set(v.p.x + fx * L * 0.48, v.y + 0.55, v.p.z + fz * L * 0.48); look.set(v.p.x + fx * 30, v.y + 0.5, v.p.z + fz * 30); }
  else { const d = RACE.me.model.driver, g = RACE.me.model.group; g.updateMatrixWorld(true); d.getWorldPosition(out); const up = 0.13 * (RACE.me.C.len / 4.5); out.y += up; out.x += fx * 0.12; out.z += fz * 0.12; /* eye height above the helmet centre, in world space (driver may sit inside a scaled holder) */ look.set(out.x + fx * 30, out.y - 1.0, out.z + fz * 30); }
}
// ---------- grid intro cinematic ----------
const fmtQ = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
function introCard(c, k) { const el = document.getElementById('intro'); if (!el) return; const pos = RACE.cars.indexOf(c) + 1;
  el.className = 'on card'; el.innerHTML = `<div class="ic" style="--tc:${c.col}"><div class="num">${pos}</div><div class="nm"><b>${c.name.toUpperCase()}</b><span>${c.C.n.toUpperCase()}</span><em>${fmtQ(c.qt)}</em></div></div><div class="ib">STARTING GRID</div><button class="skip">SKIP ▸</button>`;
  el.querySelector('.skip').onclick = e => { e.stopPropagation(); endIntro(); }; }
function introTitle() { const el = document.getElementById('intro'); if (!el) return; const T = TRACK(RACE.cfg.track);
  el.className = 'on title'; el.innerHTML = `<div class="it"><small>${(T.place || '').toUpperCase()}</small><b>${T.n.toUpperCase()}</b><span>RACE · ${RACE.cfg.laps} ${RACE.cfg.laps === 1 ? 'LAP' : 'LAPS'} · ${RACE.cars.length} CARS</span></div><button class="skip">SKIP ▸</button>`; el.querySelector('.skip').onclick = e => { e.stopPropagation(); endIntro(); }; }
function endIntro() { const el = document.getElementById('intro'); if (el) { el.className = ''; el.innerHTML = ''; } document.body.classList.remove('intro'); RACE.phase = 'count'; RACE.cT = 0; snapCamera(); }
function updateIntro(dt) {
  const I = RACE.intro; I.t += dt; RACE.t += dt; document.body.classList.add('intro'); for (const c of RACE.cars) { placeModel(c, dt); c.model.update(dt, 0, 0); }
  const k = Math.floor(I.t / I.per), lt = (I.t % I.per) / I.per;
  if (k < I.seq.length) { const c = I.seq[k], v = c.veh; if (I.k !== k) { I.k = k; introCard(c, k); SFX.shift(); }
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), S0 = TR.S[v.ti], toC = -Math.sign((v.p.x - S0.p.x) * S0.n.x + (v.p.z - S0.p.z) * S0.n.z) || 1, f = 4.4 - lt * 1.4, s = 2.6 - lt * 0.6;
    camera.position.set(v.p.x + fx * f + S0.n.x * s * toC, v.y + 0.7 + lt * 0.25, v.p.z + fz * f + S0.n.z * s * toC); camera.lookAt(v.p.x - fx * 0.4, v.y + 0.55, v.p.z - fz * 0.4); camera.fov = 44; camera.updateProjectionMatrix(); return; }
  const tt = I.t - I.seq.length * I.per; if (I.k !== 'title') { I.k = 'title'; introTitle(); SFX.rev(); }
  const pole = RACE.cars[0].veh, fx = Math.sin(pole.yaw), fz = Math.cos(pole.yaw), u = Math.min(1, tt / I.title);
  camera.position.set(pole.p.x + fx * (14 - u * 10), pole.y + 7 + u * 4, pole.p.z + fz * (14 - u * 10)); camera.lookAt(pole.p.x - fx * 18, pole.y, pole.p.z - fz * 18); camera.fov = 55; camera.updateProjectionMatrix();
  if (tt > I.title) endIntro();
}
// ---------- cockpit: F1-style steering wheel with live display ----------
function makeWheel(car) { const d = car.model.driver; if (!d) return; const g = new THREE.Group(); const carbon = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.35, metalness: 0.4 }), grip = new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.13, 0.035), carbon); g.add(body);
  for (const x of [-0.15, 0.15]) { const gr = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.1, 4, 8), grip); gr.position.set(x, -0.01, 0); g.add(gr); }
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); disp.position.set(0, 0.01, -0.019); disp.rotation.y = PI; g.add(disp);
  const btn = new THREE.MeshStandardMaterial({ color: '#c4161c', emissive: '#c4161c', emissiveIntensity: 0.6 }); for (const [x, y] of [[-0.1, 0.035], [0.1, 0.035], [-0.1, -0.035], [0.1, -0.035]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 10), btn); b.rotation.x = PI / 2; b.position.set(x, y, -0.02); g.add(b); }
  const formula = car.C.cls === 'formula'; g.position.set(d.position.x, d.position.y + (formula ? 0.0 : -0.1), d.position.z + (formula ? 0.32 : 0.4)); g.rotation.x = formula ? -0.5 : -0.6; g.visible = false; car.model.group.add(g);
  car.wheelUI = { g, cv, tex, ctx: cv.getContext('2d'), t: 0 }; }
function drawWheel(car, dt) { const W = car.wheelUI; if (!W) return; W.g.rotation.z = -car.veh.steer * 2.2; W.t += dt; if (W.t < 0.08) return; W.t = 0; const x = W.ctx, v = car.veh;
  x.fillStyle = '#040506'; x.fillRect(0, 0, 256, 128); const n = 12, lit = Math.round(clamp(v.rpm / (v.redline || 8000), 0, 1) * n); for (let i = 0; i < n; i++) { x.fillStyle = i < lit ? (i < 4 ? '#2aff6a' : i < 8 ? '#ff2a2a' : '#5a8cff') : '#1a1c1f'; x.beginPath(); x.arc(22 + i * 19.5, 14, 7, 0, 7); x.fill(); }
  x.fillStyle = '#fff'; x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.fillText(v.input.reverse && v.vF < 0.5 ? 'R' : v.speed < 0.5 && v.input.throttle < 0.1 ? 'N' : v.gear, 128, 92);
  x.font = 'bold 26px Arial'; x.textAlign = 'left'; x.fillText(Math.round(v.speed * 3.6), 12, 112); x.textAlign = 'right'; x.fillStyle = '#ffb35c'; x.fillText('P' + (car.rank + 1), 244, 112); W.tex.needsUpdate = true; }
function lerpAng(a, b, t) { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * t; }
function snapCamera() { camTarget(camPos, camLook); const v = RACE.me.veh; camOff.set(camPos.x - v.p.x, camPos.y - v.y, camPos.z - v.p.z); camera.position.copy(camPos); camera.lookAt(camLook); }
function updateCamera(dt) {
  const v = RACE.me.veh; camTarget(_p, camLook); const k = RACE.cam <= 1 ? 1 - Math.exp(-dt * 20) : 1; const carP = _o.set(v.p.x, v.y, v.p.z); camOff.lerp(_p.sub(carP), k); camPos.copy(carP).add(camOff);
  const gh = heightAt(camPos.x, camPos.z, v.ti).y + 0.4; if (camPos.y < gh) camPos.y = gh;
  camera.position.copy(camPos); const sh = (RACE.shake || 0) + (TR.C.loose ? Math.min(0.15, v.speed / 400) : 0) + (v.boost ? 0.08 : 0);
  if (sh > 0) camera.position.add(_p.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(sh * 0.06));
  camera.lookAt(camLook); if (RACE.cam >= 2) camera.rotateZ(v.roll * 0.6);
  const baseF = (innerWidth / innerHeight < 1 ? 78 : 62) + (RACE.cam === 4 ? 10 : 0); camera.fov = lerp(camera.fov, baseF + Math.min(22, v.speed / 4.5) + (v.boost ? 8 : 0), Math.min(1, dt * 4)); { const sf = document.getElementById('speedfx'); if (sf) sf.style.opacity = Math.max(0, Math.min(0.55, (v.speed * 3.6 - 130) / 200 + (v.boost ? 0.3 : 0))).toFixed(2); } camera.updateProjectionMatrix();
}
export function setPaused(p) { RACE.paused = p; if (p) { for (const c of RACE.cars) if (c.voice) c.voice.set(900, 0, 0, 0, 999); } }
export { CAMS };
