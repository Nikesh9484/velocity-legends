// Velocity Legends — saved profile & settings (localStorage)
import { CARS } from './data.js';
const KEY = 'vl_save_v1';
const DEF = () => ({
  name: 'Driver', coins: 25000, xp: 0, level: 1,
  owned: Object.fromEntries(CARS.filter(c => !c.price).map(c => [c.id, 1])),
  up: {}, paint: {}, custom: {}, best: {}, wins: 0, races: 0, champ: {},
  last: { cls: 'hyper', track: 'gp', car: 'chiron', laps: 3, opp: 7, diff: 1, sky: 'auto' },
  set: { quality: 0, cam: 0, units: 'kmh', steer: 'buttons', sens: 1, vol: 0.8, haptics: true, trans: 'auto', assist: true, line: false },
});
export let S = DEF();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) S = { ...DEF(), ...s, set: { ...DEF().set, ...(s.set || {}) }, last: { ...DEF().last, ...(s.last || {}) } }; } catch (e) {}
if (!S.set.steerV2) { S.set.steerV2 = 1; try { if (matchMedia('(pointer: coarse)').matches) S.set.steer = 'tilt'; } catch (e) {} }
/* v1.18: every free car is owned (new GT class starts with the 911 RSR); keep the last car in its class */
for (const c of CARS) if (!c.price) S.owned[c.id] = 1;
{ const lc = CARS.find(c => c.id === S.last.car); if (lc && lc.cls !== S.last.cls) S.last.cls = lc.cls; }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export const needXP = l => 1000 + l * 400;
export function addXP(n) { S.xp += Math.round(n); let up = 0; while (S.xp >= needXP(S.level)) { S.xp -= needXP(S.level); S.level++; up++; } save(); return up; }
export function addCoins(n) { S.coins += Math.round(n); save(); }
export const ups = id => S.up[id] || (S.up[id] = { eng: 0, turbo: 0, tyre: 0, brake: 0, weight: 0 });
export const paintOf = id => S.paint[id] || null;
export const customOf = id => ({ rim: 'chrome', tint: 'light', glow: 'off', nitro: 'blue', ride: 'stock', ...((S.custom || (S.custom = {}))[id] || {}) });
