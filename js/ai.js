// Velocity Legends — AI drivers: optimal racing line, braking points from a speed profile, overtaking, mistakes
import { clamp, lerp } from './engine.js';
import { TR } from './track.js';

export const LINE = { off: [], vmax: [] };
// racing line: lateral offset per sample, smoothed to straighten corners within the track width
export function buildLine(gripG = 1.4, aero = 0.8, loose = false) {
  const S = TR.S, N = TR.N, off = new Float32Array(N), margin = 1.6;
  for (let it = 0; it < 220; it++) for (let i = 0; i < N; i++) {
    const a = (i - 3 + N) % N, b = (i + 3) % N; const pa = pt(a, off[a]), pb = pt(b, off[b]); const mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2;
    const s = S[i]; const want = (mx - s.p.x) * s.n.x + (mz - s.p.z) * s.n.z; const lim = s.w / 2 - margin; off[i] = clamp(lerp(off[i], want, 0.5), -lim, lim);
  }
  // curvature of the line → max corner speed; then backward (braking) and forward (traction) passes
  const v = new Float32Array(N), g = 9.81;
  for (let i = 0; i < N; i++) { const a = pt((i - 4 + N) % N, off[(i - 4 + N) % N]), b = pt(i, off[i]), c = pt((i + 4) % N, off[(i + 4) % N]); const k = curv(a, b, c); let mu = gripG * (loose ? 0.82 : 1);
    let vm = Math.sqrt(mu * g / Math.max(k, 1e-4)); for (let r = 0; r < 3; r++) vm = Math.sqrt(mu * g * (1 + aero * 0.0012 * vm * vm / g * 0.9) / Math.max(k, 1e-4)); v[i] = Math.min(vm, 120); }
  const dec = gripG * g * 0.85, acc = 9;
  for (let r = 0; r < 2; r++) { for (let i = N * 2; i > 0; i--) { const a = i % N, b = (i + 1) % N; v[a] = Math.min(v[a], Math.sqrt(v[b] * v[b] + 2 * dec * TR.ds)); } for (let i = 0; i < N * 2; i++) { const a = i % N, b = (i + 1) % N; v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * acc * TR.ds)); } }
  LINE.off = off; LINE.vmax = v; return LINE;
}
function pt(i, o) { const s = TR.S[i]; return { x: s.p.x + s.n.x * o, z: s.p.z + s.n.z * o }; }
function curv(a, b, c) { const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z); const cr = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)); return 2 * cr / Math.max(ab * bc * ca, 1e-6); }

export class Driver {
  constructor(veh, skill = 0.93, name = 'AI') { this.v = veh; this.skill = skill * (0.97 + Math.random() * 0.05); this.name = name; this.side = 0; this.sideT = 0; this.err = 0; this.errT = 2 + Math.random() * 6; this.stuck = 0; }
  update(dt, all, rank, playerRank) {
    const v = this.v, N = TR.N, i = v.ti < 0 ? 0 : v.ti; const sp = v.speed; const look = Math.floor((7 + sp * 0.42) / TR.ds);
    const j = (i + look) % N; const s = TR.S[j]; let o = LINE.off[j] + this.side + this.err; o = clamp(o, -(s.w / 2 - 1), s.w / 2 - 1);
    const tx = s.p.x + s.n.x * o, tz = s.p.z + s.n.z * o; const dx = tx - v.p.x, dz = tz - v.p.z;
    const want = Math.atan2(dx, dz); let e = want - v.yaw; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
    v.input.steer = clamp(e * 2.2 / Math.max(v.steerMax, 0.3), -1, 1);
    // target speed from the line's speed profile (look a little ahead), skill, light rubber-banding
    let vt = Infinity; for (let k = 0; k < 40; k += 4) vt = Math.min(vt, LINE.vmax[(i + k) % N] + k * 0.6); vt *= this.skill;
    if (playerRank !== undefined) vt *= rank < playerRank ? 0.985 : rank > playerRank + 2 ? 1.04 : 1;
    // traffic: pick a side to overtake slower cars ahead
    this.sideT -= dt; let block = null; for (const o2 of all) { if (o2 === v) continue; const rx = o2.p.x - v.p.x, rz = o2.p.z - v.p.z; const fwd = rx * Math.sin(v.yaw) + rz * Math.cos(v.yaw), lat = rx * Math.cos(v.yaw) - rz * Math.sin(v.yaw); if (fwd > 0 && fwd < 16 && Math.abs(lat) < 2.4 && o2.speed < sp + 1) { block = { fwd, lat }; break; } }
    if (block && this.sideT <= 0) { this.side = block.lat > 0 ? -2.6 : 2.6; this.sideT = 2.5; } else if (!block && this.sideT <= 0) this.side = lerp(this.side, 0, dt * 0.6);
    if (block && block.fwd < 7) vt = Math.min(vt, sp - 1);
    // small human mistakes
    this.errT -= dt; if (this.errT <= 0) { this.err = (Math.random() - 0.5) * 2.2 * (1 - this.skill) * 10; this.errT = 2 + Math.random() * 5; } this.err = lerp(this.err, 0, dt * 0.4);
    const dv = vt - sp; v.input.throttle = dv > 0 ? clamp(dv / 6 + 0.35, 0, 1) : 0; v.input.brake = dv < -1.5 ? clamp(-dv / 12, 0, 1) : 0; v.input.nitro = dv > 25 && v.nitro > v.nitroMax * 0.5 ? 1 : 0; v.input.hand = 0;
    // recover when stuck against something
    if (sp < 2 && v.input.throttle > 0.5) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 2.5) { this.stuck = 0; return 'reset'; }
    return null;
  }
}
