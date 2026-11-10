// Velocity Legends — controls: keyboard, game controller, touch pedals + steering (buttons / tilt / wheel)
import { $, clamp, lerp, isTouch, haptic } from './engine.js';
import { S } from './state.js';
export const IN = { throttle: 0, brake: 0, steer: 0, hand: 0, nitro: 0, reverse: false, tilt: 0, onCam: null, onPause: null, onReset: null, onShift: null, onLook: null };
const K = {}; let tiltZero = null, tilt = 0, padSteer = 0, touch = { left: 0, right: 0, gas: 0, brake: 0, hand: 0, nitro: 0, wheel: 0 };
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; K[e.code] = true; if (IN.onSkip && !e.repeat) IN.onSkip();
  if (e.code === 'KeyC') IN.onCam && IN.onCam(); if (e.code === 'Escape' || e.code === 'KeyP') IN.onPause && IN.onPause(); if (e.code === 'KeyR') IN.onReset && IN.onReset();
  if (e.code === 'KeyE') IN.onShift && IN.onShift(1); if (e.code === 'KeyQ') IN.onShift && IN.onShift(-1);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { K[e.code] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; });
let ks = 0, tInd = null;
export function readInput(dt) {
  // keyboard
  const kl = K.ArrowLeft || K.KeyA, kr = K.ArrowRight || K.KeyD; const target = (kr ? 1 : 0) - (kl ? 1 : 0);
  ks = target === 0 ? lerp(ks, 0, Math.min(1, dt * 10)) : clamp(ks + target * dt * 3.2, -1, 1); // smooth keyboard steering
  let thr = K.ArrowUp || K.KeyW ? 1 : 0, brk = K.ArrowDown || K.KeyS ? 1 : 0, hand = K.Space ? 1 : 0, nit = K.ShiftLeft || K.ShiftRight || K.KeyN ? 1 : 0, steer = ks;
  // game controller
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null;
  if (gp) { const ax = gp.axes[0] || 0; const dz = Math.abs(ax) < 0.08 ? 0 : (ax - Math.sign(ax) * 0.08) / 0.92; if (Math.abs(dz) > 0.01) steer = Math.sign(dz) * dz * dz;
    const rt = gp.buttons[7]?.value || 0, lt = gp.buttons[6]?.value || 0; thr = Math.max(thr, rt); brk = Math.max(brk, lt); if (gp.buttons[0]?.pressed) nit = 1; if (gp.buttons[2]?.pressed || gp.buttons[1]?.pressed) hand = 1;
    padBtn(gp, 3, () => IN.onCam && IN.onCam()); padBtn(gp, 9, () => IN.onPause && IN.onPause()); padBtn(gp, 5, () => IN.onShift && IN.onShift(1)); padBtn(gp, 4, () => IN.onShift && IN.onShift(-1)); }
  // touch
  if (isTouch) { if (S.set.steer === 'tilt' && tiltZero !== null) { const lock = 24 / Math.sqrt(S.set.sens || 1), dz = 1.5, a = Math.abs(tilt) < dz ? 0 : (tilt - Math.sign(tilt) * dz) / (lock - dz); const fb = touch.right - touch.left; steer = fb ? fb : clamp(Math.sign(a) * Math.pow(Math.min(1, Math.abs(a)), 1.25), -1, 1); // a finger on an arrow always wins over tilt IN.tilt = clamp(a, -1, 1); if (!tInd) tInd = document.getElementById('tiltInd'); if (tInd) tInd.style.setProperty('--t', IN.tilt.toFixed(3)); }
    else if (S.set.steer === 'wheel') steer = touch.wheel; else steer = clamp(steer + (touch.right - touch.left), -1, 1);
    thr = Math.max(thr, touch.gas); brk = Math.max(brk, touch.brake); hand = Math.max(hand, touch.hand); nit = Math.max(nit, touch.nitro); }
  IN.throttle = thr; IN.brake = brk; IN.steer = -clamp(S.set.steer === 'tilt' && isTouch ? steer : steer * (S.set.sens || 1), -1, 1); IN.hand = hand; IN.nitro = nit; // physics: +steer turns left, controls: +steer means right
}
const padPrev = {}; function padBtn(gp, i, fn) { const p = !!gp.buttons[i]?.pressed; if (p && !padPrev[i]) fn(); padPrev[i] = p; }
// ---- tilt steering: turn the phone like a steering wheel ----
// Uses the gravity vector (devicemotion) projected onto the screen, so it works in either landscape
// direction, at any holding angle, and on both iOS and Android (sign is auto-detected).
let tiltOn = false, gSign = 0, gLat = 0, gHas = false;
function scrAngle() { const a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 0); return ((a % 360) + 360) % 360 * Math.PI / 180; }
function onMotion(e) { const g = e.accelerationIncludingGravity; if (!g || g.x == null) return; const th = scrAngle(), c = Math.cos(th), s = Math.sin(th);
  const sx = g.x * c - g.y * s, sy = g.x * s + g.y * c, sz = g.z || 0;
  if (!gSign && Math.abs(sy + sz) > 3) gSign = Math.sign(sy + sz); // spec: reaction vector points up/out of screen
  const n = Math.hypot(sx, sy, sz) || 9.81; const lat = -(gSign || 1) * sx / Math.max(Math.hypot(sx, sy), 0.35 * n); // wheel-like rotation, independent of how far the phone is tilted back // >0 = phone turned clockwise = steer right
  const flat = Math.hypot(sx, sy) < 0.3 * n; const deg = flat ? (tiltZero ?? 0) : Math.asin(clamp(lat, -1, 1)) * 57.3; gLat = gLat ? lerp(gLat, deg, 0.5) : deg; gHas = true; tilt = gLat - (tiltZero ?? gLat); if (tiltZero === null) tiltZero = gLat; }
function onOrient(e) { if (gHas) return; const land = Math.abs(scrAngle() * 57.3 - 180) === 90; const a = Math.round(scrAngle() * 57.3); const v = land ? (e.beta || 0) * (a === 270 ? -1 : 1) : (e.gamma || 0); if (tiltZero === null) tiltZero = v; tilt = v - tiltZero; }
function listen() { if (tiltOn) return; tiltOn = true; addEventListener('devicemotion', onMotion); addEventListener('deviceorientation', onOrient); }
if (isTouch && !(window.DeviceMotionEvent && DeviceMotionEvent.requestPermission)) listen(); // Android: no permission needed
export function tiltReady() { return gHas || tiltZero !== null; }
// must be called from a tap (iOS asks for motion permission)
export function enableTilt() { const ps = []; try { if (window.DeviceMotionEvent && DeviceMotionEvent.requestPermission) ps.push(DeviceMotionEvent.requestPermission()); if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) ps.push(DeviceOrientationEvent.requestPermission()); } catch (e) {}
  listen(); tiltZero = null; return Promise.allSettled(ps); }
export function calibrateTilt() { tiltZero = gHas ? gLat : null; tilt = 0; }
export function tiltValue() { return tilt; }
// on-screen pedals & steering
export function bindTouch() {
  document.getElementById('gl').addEventListener('pointerdown', () => { if (IN.onSkip) IN.onSkip(); });
  const hold = (el, key, val = 1) => { if (!el) return; const on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} touch[key] = val; el.classList.add('on'); if (S.set.haptics) haptic(8); }; const off = e => { e && e.preventDefault(); touch[key] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off); };
  hold($('#tLeft'), 'left'); hold($('#tRight'), 'right'); hold($('#tGas'), 'gas'); hold($('#tBrake'), 'brake'); hold($('#tHand'), 'hand'); hold($('#tNitro'), 'nitro');
  // analog pedal: further up the pedal = more throttle
  // pedals are full on/off: instant response like a console racer
  // steering wheel mode
  const wh = $('#tWheel'); if (wh) { let id = null, c = null; wh.addEventListener('pointerdown', e => { id = e.pointerId; wh.setPointerCapture(id); const r = wh.getBoundingClientRect(); c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; mv(e); });
    const mv = e => { if (e.pointerId !== id) return; const a = Math.atan2(e.clientX - c.x, -(e.clientY - c.y)); touch.wheel = clamp(a / 1.6, -1, 1); wh.style.setProperty('--rot', (touch.wheel * 92) + 'deg'); };
    wh.addEventListener('pointermove', mv); const up = e => { if (e.pointerId !== id) return; id = null; touch.wheel = 0; wh.style.setProperty('--rot', '0deg'); }; wh.addEventListener('pointerup', up); wh.addEventListener('pointercancel', up); }
  const cam = $('#tCam'); if (cam) cam.onpointerdown = e => { e.preventDefault(); IN.onCam && IN.onCam(); };
  const ts = $('#tSteer'); const lbl = () => { if (ts) ts.textContent = S.set.steer === 'tilt' ? 'TILT ON' : S.set.steer === 'wheel' ? 'WHEEL' : 'TILT OFF'; }; lbl();
  if (ts) ts.onpointerdown = e => { e.preventDefault(); S.set.steer = S.set.steer === 'tilt' ? 'buttons' : 'tilt'; if (S.set.steer === 'tilt') { enableTilt(); calibrateTilt(); } try { localStorage.setItem('vl_save_v1', JSON.stringify(S)); } catch (_) {} document.body.dataset.steer = S.set.steer; lbl(); };
  IN.steerLabel = lbl;
  const pz = $('#tPause'); if (pz) pz.onpointerdown = e => { e.preventDefault(); IN.onPause && IN.onPause(); };
}
export function resetTouch() { for (const k in touch) touch[k] = 0; document.querySelectorAll('#touch .on').forEach(e => e.classList.remove('on')); }
