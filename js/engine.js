// Velocity Legends — renderer, scene, image-based lighting, quality tiers, audio
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export { THREE };
export const V3 = THREE.Vector3, PI = Math.PI;
export const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
export const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
export const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
// iPhones/iPads report little memory/cores but have strong GPUs — never treat them as low-end
export const lowEnd = isTouch && !isApple && (mem <= 3 || cores <= 4);

// ---------- renderer ----------
export const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
export const Q = { level: lowEnd ? 1 : isTouch ? 2 : 3, pr: 1, shadows: true }; // 1 low · 2 medium · 3 high · 4 ultra
if (isTouch && !isApple) Q.noShadow = true; // Android phones/tablets: no real-time shadows by default — keeps the frame rate (and control response) up
const PRT = isTouch ? (isApple ? [0, 0.9, 1.25, 1.6, 2.2] : [0, 0.75, 1, 1.3, 1.8]) : [0, 0.85, 1, 1.4, 2]; // Android tablets: start lighter, adaptive code raises it when there is headroom
export function prCap() { return Math.min(window.devicePixelRatio || 1, PRT[Q.level] || 1); }
// menus/showroom are light to draw: always render them sharp
export function menuPR() { return Math.min(window.devicePixelRatio || 1, isTouch ? (Q.level >= 3 ? 1.6 : isApple ? 1.35 : 1.1) : 1.6); }
export function applyQuality(level) {
  if (level) Q.level = level; Q.pr = prCap(); setPR(Q.pr); POST.on = Q.level >= 2 && !POST.off;
  renderer.shadowMap.enabled = Q.level >= 2 && !Q.noShadow; sun.castShadow = Q.level >= 2 && !Q.noShadow; const sm = [0, 512, 1024, 2048, 4096][Q.level];
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
export function resize() { renderer.setSize(innerWidth, innerHeight, false); if (POST.composer) { POST.composer.setPixelRatio(renderer.getPixelRatio()); POST.composer.setSize(innerWidth, innerHeight); } camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth / innerHeight < 1 ? 78 : 62; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------- cinematic post: bloom on lights, film grade, vignette ----------
export const POST = { on: true, composer: null, bloom: null, off: isTouch && !isApple }; // Android: skip the glow/colour passes by default for responsiveness
const GradeShader = { uniforms: { tDiffuse: { value: null }, sat: { value: 1.2 }, con: { value: 1.13 }, vig: { value: 0.36 }, warm: { value: 0.018 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, vig, warm; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(l), col, sat); col = (col - 0.5) * con + 0.5; col = clamp(col, 0.0, 1.0); col = mix(col, col * col * (3.0 - 2.0 * col), 0.35); // gentle S-curve col.r += warm; col.b -= warm * 0.6;
      vec2 d = vUv - 0.5; col *= 1.0 - vig * smoothstep(0.25, 0.85, dot(d, d) * 2.2); gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }` };
export function initPost() {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? (isTouch ? 2 : 4) : 0 });
  const c = new EffectComposer(renderer, rt); c.addPass(new RenderPass(scene, camera));
  const b = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.42, 0.55, 0.88); c.addPass(b);
  c.addPass(new OutputPass()); const gp = new ShaderPass(GradeShader); c.addPass(gp);
  POST.composer = c; POST.bloom = b; POST.grade = gp; c.setPixelRatio(renderer.getPixelRatio()); c.setSize(innerWidth, innerHeight);
}
export function setPR(pr) { renderer.setPixelRatio(pr); if (POST.composer) { POST.composer.setPixelRatio(pr); POST.composer.setSize(innerWidth, innerHeight); } }
export function render() { if (POST.on && POST.composer) { if (POST.bloom) POST.bloom.strength = (POST.bloomBase ?? 0.3) * (POST.mul ?? 1); if (POST.grade) POST.grade.enabled = POST.film !== false; POST.composer.render(); } else renderer.render(scene, camera); }

// ---------- lights ----------
export const sun = new THREE.DirectionalLight('#fff3df', 3.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 400;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
export const hemi = new THREE.HemisphereLight('#cfe6ff', '#4a3f30', 0.35); scene.add(hemi);
export const sunDir = new V3(0.62, 0.52, 0.36).normalize(); // lower sun = longer shadows, more shape
export function followSun(p) { sun.position.copy(p).addScaledVector(sunDir, 180); sun.target.position.copy(p); }

// ---------- environment (Poly Haven HDRIs, CC0) ----------
const pmrem = new THREE.PMREMGenerator(renderer);
const envCache = {}; let ENVINFO = null;
export const SKY = { key: '', fogCol: new THREE.Color('#9fb3c8') };
const SKYCFG = {
  day: { env: 'day', exp: 0.9, sun: 3.9, sunCol: '#fff0d8', fog: '#9fb6cc', fogD: 0.0006, hemi: 0.28, envI: 0.9 },
  sunset: { env: 'sunset', exp: 1.05, sun: 2.6, sunCol: '#ffb36b', fog: '#c9a58f', fogD: 0.0011, hemi: 0.3, envI: 0.9 },
  night: { env: 'night', exp: 1.25, sun: 0.35, sunCol: '#9fb6ff', fog: '#0b1018', fogD: 0.0013, hemi: 0.12, envI: 0.35 },
  overcast: { env: 'overcast', exp: 1.05, sun: 1.2, sunCol: '#e9eef2', fog: '#a7adb2', fogD: 0.0022, hemi: 0.55, envI: 1.0 },
  clear: { env: 'clear', exp: 0.88, sun: 4.1, sunCol: '#fff1dc', fog: '#bccbd8', fogD: 0.0005, hemi: 0.28, envI: 0.9 },
  rain: { env: 'overcast', exp: 0.85, sun: 0.7, sunCol: '#d9e2ea', fog: '#7f878d', fogD: 0.006, hemi: 0.5, envI: 0.8 },
  studio: { env: 'studio', exp: 1.0, sun: 1.6, sunCol: '#ffffff', fog: '#101214', fogD: 0, hemi: 0.2, envI: 1.25 },
};
const hdr = new RGBELoader(); const tex = new THREE.TextureLoader();
async function envOf(name) {
  if (envCache[name]) return envCache[name];
  const t = await hdr.loadAsync(`assets/env/${name}.hdr`); t.mapping = THREE.EquirectangularReflectionMapping;
  const rt = pmrem.fromEquirectangular(t); t.dispose(); let bg = null;
  if (name !== 'studio') { bg = await tex.loadAsync(`assets/env/${name}_bg.jpg`); bg.mapping = THREE.EquirectangularReflectionMapping; bg.colorSpace = THREE.SRGBColorSpace; }
  return (envCache[name] = { env: rt.texture, bg });
}
export async function setSky(key) {
  const C = SKYCFG[key] || SKYCFG.day; if (!ENVINFO) ENVINFO = await fetch('assets/env/env.json').then(r => r.json()).catch(() => ({}));
  const E = await envOf(C.env); SKY.key = key; SKY.cfg = C;
  scene.environment = E.env; scene.environmentIntensity = C.envI; scene.background = E.bg || new THREE.Color('#0d0f12'); scene.backgroundIntensity = key === 'night' ? 0.7 : 1; scene.backgroundBlurriness = 0;
  renderer.toneMappingExposure = C.exp; sun.intensity = C.sun; sun.color.set(C.sunCol); hemi.intensity = C.hemi;
  const I = ENVINFO[C.env]; if (I) { const az = (I.sunAz - 90) * PI / 180, el = Math.max(key === 'sunset' ? 8 : 12, I.sunEl) * PI / 180; sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize(); }
  if (key === 'night') sunDir.set(-0.3, 0.75, 0.4).normalize();
  SKY.fogCol.set(C.fog); scene.fog = C.fogD ? new THREE.FogExp2(C.fog, C.fogD) : null;
  if (POST.bloom) { POST.bloomBase = key === 'night' ? 0.5 : 0.3; POST.bloom.threshold = key === 'night' ? 0.95 : 0.95; }
  SKY.carEnv = carEnvOf(key, E.bg); applyCarEnv(); if (key === 'studio') scene.environment = SKY.carEnv;
}

// ---------- car reflections: real sky + studio soft-box strips (gives paint the long glossy highlight lines of a car photo) ----------
export const CARMATS = new Set();
const envBox = new THREE.BoxGeometry(1, 1, 1), envSph = new THREE.SphereGeometry(50, 48, 24);
function lightformer(sc, w, h, pos, look, I, col = '#ffffff') { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); sc.add(m); }
const carEnvCache = {};
function carEnvOf(key, bg) {
  if (carEnvCache[key]) return carEnvCache[key];
  const sc = new THREE.Scene(), white = key === 'white', studio = key === 'studio' || white, night = key === 'night';
  if (bg) { const sk = new THREE.Mesh(envSph, new THREE.MeshBasicMaterial({ map: bg, side: THREE.BackSide, color: new THREE.Color(1, 1, 1).multiplyScalar(night ? 0.7 : 0.8) })); sk.rotation.y = -PI / 2; sc.add(sk); }
  else { sc.background = new THREE.Color(white ? '#a9aeb4' : '#050608'); const fl = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: white ? '#d7dade' : '#0b0c0e' })); fl.rotation.x = -PI / 2; fl.position.y = -1; sc.add(fl); }
  const k = studio ? 1 : night ? 0.35 : 0.55; // soft-box strength
  lightformer(sc, 14, 3.2, [0, 9, 0], [0, 0, 0], 4.5 * k);              // long overhead box
  lightformer(sc, 14, 1.2, [0, 8, 4], [0, 0, 0], 3.2 * k);
  lightformer(sc, 14, 1.2, [0, 8, -4], [0, 0, 0], 3.2 * k);
  lightformer(sc, 1.4, 9, [11, 2.5, 0], [0, 1, 0], 2.6 * k, night ? '#cfe0ff' : '#ffffff'); // side strips
  lightformer(sc, 1.4, 9, [-11, 2.5, 0], [0, 1, 0], 2.6 * k, night ? '#ffd9b8' : '#ffffff');
  if (studio && !white) { lightformer(sc, 6, 1.0, [0, 2, -12], [0, 1, 0], 2.4, '#ff5a3a'); lightformer(sc, 6, 1.0, [0, 2, 12], [0, 1, 0], 2.0, '#9fc8ff'); lightformer(sc, 30, 0.35, [0, 0.4, 14], [0, 0.4, 0], 1.6); lightformer(sc, 30, 0.35, [0, 0.4, -14], [0, 0.4, 0], 1.6); }
  if (!studio && !night) { const sunM = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3e0').multiplyScalar(40) })); sunM.position.copy(sunDir).multiplyScalar(45); sc.add(sunM); }
  const rt = pmrem.fromScene(sc, 0.0, 0.1, 100); sc.traverse(o => { if (o.isMesh && o.geometry !== envSph) o.geometry.dispose(); });
  return (carEnvCache[key] = rt.texture);
}
export function carEnvMap() { return SKY.carEnv || null; }
export function useCarEnv(key) { SKY.carEnv = carEnvOf(key, null); applyCarEnv(); scene.environment = SKY.carEnv; }
function applyCarEnv() { for (const m of CARMATS) { m.envMap = SKY.carEnv; m.needsUpdate = true; } }

// ---------- texture helper (Poly Haven PBR sets, CC0) ----------
const texCache = {};
export function pbr(name, repeat = 1, opts = {}) {
  const k = name + repeat; if (texCache[k]) return texCache[k];
  const L = (s, srgb) => { const t = tex.load(`assets/tex/${name}_${s}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = Q.level >= 3 ? 8 : 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ map: L('diff', true), normalMap: L('nor'), roughnessMap: L('rough'), roughness: 1, metalness: 0, ...opts });
  m.normalScale.set(opts.ns || 1, opts.ns || 1); return (texCache[k] = m);
}

// ---------- audio: engines, tyres, wind, impacts (synthesized) ----------
export const AU = { ctx: null, master: null, vol: 0.8, eng: 1 };
export function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return; AU.ctx = new C();
  AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.vol; const comp = AU.ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; AU.master.connect(comp); comp.connect(AU.ctx.destination);
  const len = AU.ctx.sampleRate * 2, b = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = b; loadEngine();
}
function noiseSrc() { const s = AU.ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true; return s; }
// engine sound: steady-RPM engine loops (ElevenLabs SFX via Picsart) layered and crossfaded by RPM, like console racers
export const ENG = { buf: {}, p: null };
const ENGFILES = ['v8_idle', 'v8_mid', 'v8_high', 'v8_off', 'v12_high', 'i4_turbo'];
function loadEngine() { if (ENG.p || !AU.ctx) return ENG.p; const get = n => fetch(`assets/eng_${n}.wav`).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => AU.ctx.decodeAudioData(b, res, rej))).then(x => { ENG.buf[n] = x; });
  ENG.p = Promise.all(ENGFILES.map(get)).catch(e => console.warn('engine audio', e)); return ENG.p; }
// [loop, rpm it was recorded at] per engine family
function engineSet(cyl, kind) {
  if (kind === 'formula') return { pm: 1.12, L: [['v8_idle', 1100], ['v8_mid', 3600], ['v12_high', 9000]] };
  if (cyl <= 4) return { pm: 1.18, L: [['v8_idle', 1000], ['i4_turbo', 4200], ['v8_high', 9800]] };
  if (cyl >= 10) return { pm: cyl >= 16 ? 0.9 : 0.97, L: [['v8_idle', 900], ['v8_mid', 3400], ['v12_high', 8200]] };
  return { pm: cyl === 6 ? 1.08 : 1, L: [['v8_idle', 900], ['v8_mid', 3400], ['v8_high', 8000]] };
}
export function engineVoice(cyl = 8, loud = 1, kind = '') {
  if (!AU.ctx) return null; loadEngine(); const c = AU.ctx, out = c.createGain(); out.gain.value = 0; const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  const SET = engineSet(cyl, kind), pm = SET.pm;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.5; const bus = c.createGain(); bus.connect(lp); lp.connect(out);
  const layers = SET.L.map(([n, base]) => ({ n, base, g: c.createGain(), s: null })), off = { n: 'v8_off', base: 4000, g: c.createGain(), s: null };
  const all = [...layers, off]; all.forEach(l => { l.g.gain.value = 0; l.g.connect(bus); });
  const start = () => { for (const l of all) { if (l.s || !ENG.buf[l.n]) continue; l.s = c.createBufferSource(); l.s.buffer = ENG.buf[l.n]; l.s.loop = true; l.s.connect(l.g); l.s.start(0, Math.random() * 4); } };
  start(); if (ENG.p) ENG.p.then(start);
  const noiseSrc2 = () => { const s = c.createBufferSource(); s.buffer = AU.noise; s.loop = true; return s; };
  const tn = noiseSrc2(), tbp = c.createBiquadFilter(); tbp.type = 'bandpass'; tbp.frequency.value = 3000; tbp.Q.value = 12; const tg = c.createGain(); tg.gain.value = 0; tn.connect(tbp); tbp.connect(tg); tg.connect(out); tn.start();
  const sq = noiseSrc2(), sbp = c.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 1100; sbp.Q.value = 6; const sg = c.createGain(); sg.gain.value = 0; sq.connect(sbp); sbp.connect(sg); sg.connect(out); sq.start();
  const wn = noiseSrc2(), wlp = c.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 600; const wg = c.createGain(); wg.gain.value = 0; wn.connect(wlp); wlp.connect(wg); wg.connect(out); wn.start();
  if (pan) { out.connect(pan); pan.connect(AU.master); } else out.connect(AU.master);
  let thrS = 0;
  return {
    set(rpm, throttle, slip, speed, dist = 0, p = 0) {
      const t = c.currentTime, fall = loud / (1 + dist * 0.06), r = Math.max(600, rpm); thrS += (throttle - thrS) * 0.25;
      // equal-power crossfade between the two loops whose recorded RPM brackets the current RPM (in log space)
      const lr = Math.log(r); let w = layers.map(() => 0); const B = layers.map(l => Math.log(l.base));
      if (lr <= B[0]) w[0] = 1; else if (lr >= B[B.length - 1]) w[B.length - 1] = 1; else for (let k = 0; k < B.length - 1; k++) if (lr >= B[k] && lr <= B[k + 1]) { const f = (lr - B[k]) / (B[k + 1] - B[k]); w[k] = Math.cos(f * Math.PI / 2); w[k + 1] = Math.sin(f * Math.PI / 2); }
      const onAmt = 0.45 + 0.55 * thrS, offAmt = (1 - thrS) * Math.min(1, Math.max(0, (r - 1800) / 2500));
      layers.forEach((l, k) => { if (l.s) l.s.playbackRate.setTargetAtTime(Math.min(2.2, Math.max(0.5, r / l.base)) * pm, t, 0.025); l.g.gain.setTargetAtTime(w[k] * onAmt, t, 0.04); });
      if (off.s) off.s.playbackRate.setTargetAtTime(Math.min(2, Math.max(0.5, r / off.base)) * pm, t, 0.025); off.g.gain.setTargetAtTime(offAmt * 0.8, t, 0.06);
      lp.frequency.setTargetAtTime(2200 + thrS * 9000, t, 0.05);
      out.gain.setTargetAtTime((0.55 + thrS * 0.35) * fall * AU.eng, t, 0.05);
      tg.gain.setTargetAtTime(throttle * Math.min(r / 8000, 1) * 0.035 * fall, t, 0.08); tbp.frequency.setTargetAtTime(2200 + r * 0.35, t, 0.1);
      sg.gain.setTargetAtTime(Math.min(1, slip) * 0.22 * fall, t, 0.05);
      wg.gain.setTargetAtTime(Math.min(1, speed / 90) * 0.16 * (dist ? 0 : 1), t, 0.2);
      if (pan) pan.pan.setTargetAtTime(p, t, 0.05);
    },
    stop() { try { out.gain.setTargetAtTime(0, c.currentTime, 0.05); setTimeout(() => { out.disconnect(); for (const l of all) { try { l.s && l.s.stop(); } catch (e) {} } tn.stop(); sq.stop(); wn.stop(); }, 300); } catch (e) {} },
  };
}
function blip(f1, f2, dur, g, type = 'sine', delay = 0) { if (!AU.ctx) return; const c = AU.ctx, t = c.currentTime + delay, o = c.createOscillator(), gg = c.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); gg.gain.setValueAtTime(g, t); gg.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(gg); gg.connect(AU.master); o.start(t); o.stop(t + dur + 0.05); }
function burst(dur, f, g, type = 'lowpass', delay = 0) { if (!AU.ctx) return; const c = AU.ctx, t = c.currentTime + delay, s = noiseSrc(), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const gg = c.createGain(); gg.gain.setValueAtTime(g, t); gg.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(gg); gg.connect(AU.master); s.start(t); s.stop(t + dur + 0.05); }
export const SFX = {
  light() { blip(880, 880, 0.18, 0.25, 'square'); }, go() { blip(1320, 1320, 0.5, 0.3, 'square'); },
  shift() { burst(0.07, 1800, 0.25, 'bandpass'); blip(220, 90, 0.08, 0.2, 'triangle'); },
  pop() { burst(0.06, 900, 0.35, 'lowpass'); }, crash(k = 1) { burst(0.4 * k, 600, 0.9 * Math.min(1, k), 'lowpass'); blip(120, 40, 0.3, 0.6 * Math.min(1, k)); burst(0.25, 3500, 0.25 * k, 'highpass', 0.02); },
  scrape() { burst(0.15, 2500, 0.18, 'bandpass'); }, nitro() { burst(0.8, 400, 0.4, 'lowpass'); blip(200, 600, 0.6, 0.12, 'sawtooth'); },
  click() { burst(0.04, 2400, 0.3, 'bandpass'); blip(320, 140, 0.06, 0.2, 'square'); }, rev() { const b = ENG.buf.v8_mid; if (!AU.ctx || !b) { loadEngine(); return; } const c = AU.ctx, t = c.currentTime, src = c.createBufferSource(), g = c.createGain(); src.buffer = b; src.loop = true;
    src.playbackRate.setValueAtTime(0.42, t); src.playbackRate.linearRampToValueAtTime(1.55, t + 0.45); src.playbackRate.exponentialRampToValueAtTime(0.5, t + 1.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.08); g.gain.setValueAtTime(0.9, t + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    src.connect(g); g.connect(AU.master); src.start(t, Math.random() * 3); src.stop(t + 1.6); },
  lap() { blip(660, 990, 0.25, 0.2, 'triangle'); blip(990, 1320, 0.3, 0.18, 'triangle', 0.15); }, cash() { blip(1500, 1500, 0.08, 0.15, 'square'); blip(2000, 2000, 0.12, 0.15, 'square', 0.08); },
};
export function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
