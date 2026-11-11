// Velocity Legends — vehicle dynamics: engine & gearbox, grip & drift, downforce, surfaces, jumps, barriers, car-to-car contact
import { V3, PI, clamp, lerp } from './engine.js';
import { TR, nearest, heightAt } from './track.js';
const G = 9.81;
const SURF = { road: { mu: 1, drag: 0 }, kerb: { mu: 0.92, drag: 0.02 }, grass: { mu: 0.55, drag: 0.6 }, gravel: { mu: 0.45, drag: 1.8 }, loose: { mu: 0.68, drag: 0.25 } };

export class Vehicle {
  constructor(C, up = {}) {
    this.C = C; const L = k => up[k] || 0;
    this.power = C.hp * 745.7 * (1 + 0.06 * L('eng')); this.mass = C.kg * (1 - 0.04 * L('weight')); this.gripG = C.grip * (1 + 0.05 * L('tyre')); this.brakeG = C.brake * (1 + 0.08 * L('brake'));
    this.top = C.top / 3.6; this.aero = C.aero; this.loose = C.loose; this.wb = C.wb; this.steerMax = C.steer;
    this.nitroMax = 4 + L('turbo') * 1.5; this.nitro = this.nitroMax; this.nitroRefill = 0.12 + L('turbo') * 0.05;
    // drag chosen so that full power balances drag at top speed
    this.cd = this.power / Math.pow(this.top, 3) * 0.92; this.gears = C.gears; this.redline = C.redline; this.idle = 900;
    this.p = new V3(); this.y = 0; this.vy = 0; this.yaw = 0; this.v = new V3(); this.yawRate = 0; this.steer = 0; this.speed = 0; this.vF = 0; this.vL = 0;
    this.gear = 1; this.rpm = this.idle; this.shiftT = 0; this.slip = 0; this.air = false; this.pitch = 0; this.roll = 0; this.ti = -1; this.surf = 'road'; this.d = 0; this.hit = 0; this.boost = false; this.groundN = new V3(0, 1, 0);
    this.input = { throttle: 0, brake: 0, steer: 0, hand: 0, nitro: 0 }; this.auto = true; this.events = [];
  }
  place(p, yaw) { this.p.copy(p); this.yaw = yaw; this.v.set(0, 0, 0); this.yawRate = 0; const h = heightAt(p.x, p.z); this.y = h.y; this.ti = h.r.i; this.vy = 0; }
  uturn(dir) { if (this.ut > 0) return; this.ut = 0.8; this.utDir = dir || (this.steer < 0 ? -1 : 1); this.events.push({ k: 'uturn' }); }
  gearRatio(g) { return 3.4 * Math.pow(0.74, g - 1) * (this.top < 60 ? 1.2 : 1); }
  step(dt) {
    const I = this.input, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let vF = this.v.x * fx + this.v.z * fz, vL = this.v.x * fz - this.v.z * fx; const sp = Math.hypot(vF, vL);
    // surface under the car
    const h = heightAt(this.p.x, this.p.z, this.ti); this.ti = h.r.i; this.d = h.r.d; this.s = h.r.s;
    const S = SURF[h.surf] || SURF.road; let mu = S.mu; if (h.surf === 'loose' || (TR.C && TR.C.loose && h.surf === 'road')) mu = this.loose; this.surf = h.surf;
    if (TR.C && TR.C.loose && h.surf === 'road') mu = this.loose * 1.08;
    const grounded = this.y <= h.y + 0.05; this.air = !grounded;
    const down = this.aero * 0.0012 * vF * vF * (grounded ? 1 : 0); // downforce (as extra g)
    const gripA = this.gripG * G * mu * (1 + down / 9.81 * 0.9);
    // ----- longitudinal -----
    let F = 0; const m = this.mass;
    if (grounded) {
      const boost = I.nitro && this.nitro > 0 && I.throttle > 0.1; this.boost = boost; if (boost) this.nitro = Math.max(0, this.nitro - dt); else this.nitro = Math.min(this.nitroMax, this.nitro + this.nitroRefill * dt);
      const P = this.power * (boost ? 1.35 : 1) * (this.shiftT > 0 ? 0.15 : 1);
      const drive = I.throttle * P / Math.max(Math.abs(vF), 4.5); const tract = gripA * m * (this.C.drive === 'awd' ? 1 : 0.62) * (1 + down / 9.81 * 0.5);
      if (vF > -0.5 || !I.reverse) F += Math.min(drive, tract);
      if (I.reverse && vF < 1.5) F = -Math.min(I.throttle * P / 6, m * 4) * 0.5;
      if (I.brake > 0) { if (vF > 0.8) F -= I.brake * this.brakeG * G * m * (1 + down / 9.81 * 0.7) * Math.min(1, mu * 1.1); else F -= I.brake * 6 * m; }
      F -= this.cd * vF * Math.abs(vF) + (0.014 + S.drag * 0.25) * m * G * Math.sign(vF) * Math.min(1, Math.abs(vF)) + S.drag * 0.04 * m * vF;
      if (I.hand) F -= Math.sign(vF) * 0.22 * m * G * Math.min(1, Math.abs(vF));
    }
    vF += F / m * dt;
    // ----- steering & yaw -----
    const steerLim = this.steerMax * clamp(1.25 - sp / 120, 0.45, 1); // less lock at speed
    this.steer = lerp(this.steer, I.steer * steerLim, Math.min(1, dt * 22)); // fast but smooth (full lock in ~0.1 s) response to the controls
    let rT = vF / this.wb * Math.tan(this.steer); const maxR = gripA / Math.max(Math.abs(vF), 1); { const mk = TR.C && TR.C.loose ? 1.3 : 1.75; rT = clamp(rT, -maxR * mk, maxR * mk); } /* arcade: turns harder than real grip allows */
    const handle = grounded ? (I.hand ? 5 : 26) * mu : 0.4; this.yawRate = lerp(this.yawRate, rT + (I.hand ? Math.sign(this.steer) * Math.min(1.2, Math.abs(vF) / 14) * Math.abs(I.steer) : 0), Math.min(1, dt * handle));
    if (this.ut > 0) { const s = Math.min(dt, this.ut); this.ut -= dt; this.yawRate = this.utDir * Math.PI / 0.8 * s / dt; vF *= Math.exp(-dt * 2.2); if (this.ut <= 0) this.yawRate = 0; } /* one-tap 180° turn */
    this.yaw += this.yawRate * dt;
    // ----- lateral grip (drift happens when this can't keep up) -----
    this.driftT = I.hand ? 1 : Math.max(0, (this.driftT || 0) - dt * 1.1); /* grip comes back gradually after the handbrake → long, controllable drifts */
    const latGrip = this.ut > 0 ? 40 : grounded ? (I.hand ? 1.1 : (1 - 0.7 * this.driftT) * (TR.C && TR.C.loose ? 7.5 : 13)) * mu * (this.loose > 0.8 && TR.C && TR.C.loose ? 0.85 : 1) : 0.05;
    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw);
    const vx = fx * vF + fz * vL, vz = fz * vF - fx * vL; // world velocity keeps its direction while the body yaws → slip angle
    vF = vx * nfx + vz * nfz; vL = vx * nfz - vz * nfx; vL *= Math.exp(-latGrip * dt);
    this.slip = clamp(Math.abs(vL) / 6 + (I.hand && Math.abs(vF) > 6 ? 0.4 : 0) + (I.brake > 0.8 && Math.abs(vF) > 30 && mu < 0.8 ? 0.3 : 0), 0, 1.5);
    this.v.set(nfx * vF + nfz * vL, 0, nfz * vF - nfx * vL); this.vF = vF; this.vL = vL; this.speed = Math.hypot(vF, vL);
    this.p.x += this.v.x * dt; this.p.z += this.v.z * dt;
    // ----- vertical: follow ground, launch off crests -----
    const h2 = heightAt(this.p.x, this.p.z, this.ti);
    if (grounded) { const want = h2.y; const vyGround = (want - this.y) / dt; if (vyGround < -4 && this.speed > 12) { this.vy = this.vy * 0.5; this.air = true; } else { this.vy = vyGround; this.y = want; } }
    if (this.air || this.y > h2.y + 0.05) { this.vy -= G * dt; this.y += this.vy * dt; if (this.y <= h2.y) { if (this.vy < -6) this.events.push({ k: 'land', v: -this.vy }); this.y = h2.y; this.vy = 0; } }
    // ground tilt (pitch & roll) from heights under the wheels
    const ax = this.wb / 2, aw = 0.85; const hf = heightAt(this.p.x + nfx * ax, this.p.z + nfz * ax, this.ti).y, hb = heightAt(this.p.x - nfx * ax, this.p.z - nfz * ax, this.ti).y;
    const hl = heightAt(this.p.x - nfz * aw, this.p.z + nfx * aw, this.ti).y, hr = heightAt(this.p.x + nfz * aw, this.p.z - nfx * aw, this.ti).y;
    const tp = Math.atan2(hf - hb, this.wb), tr = Math.atan2(hl - hr, aw * 2);
    const accel = F / m; this.pitch = lerp(this.pitch, -tp + clamp(-accel * 0.004, -0.04, 0.05), Math.min(1, dt * 8)); this.roll = lerp(this.roll, tr + clamp(this.vF * this.yawRate * 0.0035, -0.07, 0.07), Math.min(1, dt * 8));
    // ----- barriers / track limits -----
    const r = h2.r, lim = r.seg.lim;
    if (Math.abs(r.d) > lim - 1.0) { const side = Math.sign(r.d), nx = r.seg.n.x * side, nz = r.seg.n.z * side; const pen = Math.abs(r.d) - (lim - 1.0);
      this.p.x -= nx * pen; this.p.z -= nz * pen; const into = this.v.x * nx + this.v.z * nz;
      if (into > 0) { this.v.x -= nx * into * 1.15; this.v.z -= nz * into * 1.15; const loss = clamp(into / 45, 0.02, 0.22); this.v.multiplyScalar(1 - loss); /* glance off the barrier and keep going: nose turns along the wall */ if (this.vF > 5) { const ty = Math.atan2(this.v.x, this.v.z); let dy = ty - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * 0.35; } this.hit = Math.max(this.hit, into); this.events.push({ k: into > 6 ? 'crash' : 'scrape', v: into }); this.yawRate *= 0.5; } }
    // ----- engine rpm & automatic gearbox -----
    this.shiftT = Math.max(0, this.shiftT - dt); const wheelV = Math.abs(vF);
    const rpmOf = g => this.idle + wheelV / this.top * (this.redline - this.idle) * this.gearRatio(g) / this.gearRatio(this.gears) * 1.02 / (1 + 0.0 * g);
    let rpm = rpmOf(this.gear); if (I.throttle > 0.05 && grounded && wheelV < 3) rpm = Math.max(rpm, this.idle + I.throttle * 3500);
    if (this.auto) { if (rpm > this.redline * 0.94 && this.gear < this.gears) { this.gear++; this.shiftT = 0.12; this.events.push({ k: 'shift' }); } else if (this.gear > 1 && rpmOf(this.gear - 1) < this.redline * 0.7) { this.gear--; this.events.push({ k: 'down' }); } }
    this.rpm = lerp(this.rpm, clamp(rpm, this.idle, this.redline), Math.min(1, dt * 12));
  }
  shiftUp() { if (this.gear < this.gears) { this.gear++; this.shiftT = 0.12; this.events.push({ k: 'shift' }); } }
  shiftDown() { if (this.gear > 1) { this.gear--; this.events.push({ k: 'down' }); } }
}
// car-to-car contact (two circles per car)
export function collideCars(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z, d2 = dx * dx + dz * dz; if (d2 > 49) continue;
    for (const oa of [-1, 1]) for (const ob of [-1, 1]) {
      const ax = a.p.x + Math.sin(a.yaw) * oa * a.C.len * 0.25, az = a.p.z + Math.cos(a.yaw) * oa * a.C.len * 0.25, bx = b.p.x + Math.sin(b.yaw) * ob * b.C.len * 0.25, bz = b.p.z + Math.cos(b.yaw) * ob * b.C.len * 0.25;
      const ex = bx - ax, ez = bz - az, dd = Math.hypot(ex, ez), R = 1.05 + 1.05; if (dd >= R || dd < 1e-4) continue;
      const nx = ex / dd, nz = ez / dd, pen = (R - dd) / 2; a.p.x -= nx * pen; a.p.z -= nz * pen; b.p.x += nx * pen; b.p.z += nz * pen;
      const rv = (b.v.x - a.v.x) * nx + (b.v.z - a.v.z) * nz; if (rv < 0) { const imp = -rv * 0.6, ma = a.mass, mb = b.mass, ia = imp * mb / (ma + mb), ib = imp * ma / (ma + mb); a.v.x -= nx * ia; a.v.z -= nz * ia; b.v.x += nx * ib; b.v.z += nz * ib; a.yawRate += (Math.random() - 0.5) * 0.4 * Math.min(1, -rv / 10); b.yawRate += (Math.random() - 0.5) * 0.4 * Math.min(1, -rv / 10); if (-rv > 2) { a.events.push({ k: 'bump', v: -rv }); b.events.push({ k: 'bump', v: -rv }); } }
    }
  }
}
