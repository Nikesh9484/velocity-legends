// Velocity Legends — in-race HUD: speedometer & rev gauge, gear, nitro, position, laps, times, standings, mini-map, start lights
import { $, clamp, isTouch } from './engine.js';
import { RACE, fmt } from './race.js';
import { TR } from './track.js';
import { S } from './state.js';
let mm = null, mmCtx = null, mmBase = null, last = 0;
export function hudShow(on) { $('#hud').classList.toggle('on', on); $('#touch').classList.toggle('on', on && isTouch); if (on) { mmBase = null; buildGauge(); } }
function buildGauge() {
  const el = $('#tach'); if (el.dataset.ok) return; el.dataset.ok = 1; let ticks = '';
  for (let i = 0; i <= 10; i++) { const a = (-225 + i * 27) * Math.PI / 180; const r0 = 86, r1 = i % 1 ? 80 : 74; ticks += `<line x1="${100 + Math.cos(a) * r0}" y1="${100 + Math.sin(a) * r0}" x2="${100 + Math.cos(a) * r1}" y2="${100 + Math.sin(a) * r1}" class="${i >= 8 ? 'red' : ''}"/>`; ticks += `<text x="${100 + Math.cos(a) * 62}" y="${100 + Math.sin(a) * 62 + 4}">${i}</text>`; }
  el.innerHTML = `<svg viewBox="0 0 200 200"><defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="#3ad1ff"/><stop offset=".7" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff2a2a"/></linearGradient></defs>
  <circle cx="100" cy="100" r="96" class="bez"/><circle cx="100" cy="100" r="88" class="face"/><path id="tArc" class="arc" d=""/>${ticks}<g id="tNeedle"><line x1="100" y1="100" x2="100" y2="22"/><circle cx="100" cy="100" r="7"/></g></svg>
  <div class="spd"><b id="hSpd">0</b><small id="hUnit">KM/H</small></div><div class="gear" id="hGear">N</div><div class="nit"><i id="hNit"></i><span>NITRO</span></div>`;
}
function arc(frac) { const a0 = -225, a1 = a0 + 270 * frac; const r = 88, P = a => [100 + Math.cos(a * Math.PI / 180) * r, 100 + Math.sin(a * Math.PI / 180) * r]; const [x0, y0] = P(a0), [x1, y1] = P(a1); return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`; }
export function hudUpdate(dt) {
  if (!RACE.on) return; const me = RACE.me, v = me.veh; const now = performance.now();
  // gauge every frame (smooth needle), text ~20 Hz
  const f = clamp((v.rpm - 0) / (v.redline * 1.05), 0, 1); $('#tNeedle').setAttribute('transform', `rotate(${-135 + f * 270} 100 100)`); $('#tArc').setAttribute('d', arc(f));
  $('#tach').classList.toggle('limit', v.rpm > v.redline * 0.93);
  if (now - last < 50) return; last = now;
  const kmh = v.speed * 3.6, sp = S.set.units === 'mph' ? kmh * 0.621 : kmh; $('#hSpd').textContent = Math.round(sp); $('#hUnit').textContent = S.set.units === 'mph' ? 'MPH' : 'KM/H';
  $('#hGear').textContent = v.input.reverse && v.vF < 0.5 ? 'R' : v.speed < 0.5 && v.input.throttle < 0.1 ? 'N' : v.gear; $('#hNit').style.width = (v.nitro / v.nitroMax * 100) + '%'; $('#hNit').parentElement.classList.toggle('on', v.boost);
  const n = RACE.cars.length, laps = RACE.cfg.laps; $('#hPos').innerHTML = `<b>${me.rank + 1}</b><small>/${n}</small>`;
  $('#hLap').innerHTML = `LAP <b>${clamp(me.lap, 1, laps)}</b>/${laps}`;
  const cur = RACE.phase === 'race' && me.lap > 0 ? RACE.t - me.lapStart : 0; $('#hTimes').innerHTML = `<div><span>LAP</span><b>${fmt(cur)}</b></div><div><span>BEST</span><b>${fmt(me.best)}</b></div><div><span>LAST</span><b>${fmt(me.lastLap || Infinity)}</b></div>`;
  const order = [...RACE.cars].sort((a, b) => a.rank - b.rank); const lead = order[0];
  const maxR = innerHeight < 520 ? 8 : 12; let rows = order.slice(0, maxR); if (!rows.includes(me)) rows = [...rows.slice(0, maxR - 1), me];
  $('#hBoard').innerHTML = `<div class="bh"><b>LAP ${clamp(me.lap, 1, laps)}/${laps}</b><span>${RACE.phase === 'race' ? 'RACE' : RACE.phase === 'count' ? 'GRID' : 'FINISH'}</span></div>` + rows.map(c => { const i = order.indexOf(c); const code = esc(c.name.replace(/^[A-Z]\.\s*/, '').slice(0, 3).toUpperCase()); return `<div class="${c.me ? 'me' : ''}"><i>${String(i + 1).padStart(2, '0')}</i><u style="background:${c.col}"></u><span>${code}</span><em>${i === 0 ? 'LEADER' : gap(c, lead)}</em></div>`; }).join('');
  // centre messages, start lights, wrong way
  const m = RACE.msg; const ce = $('#hMsg'); if (m) { ce.textContent = m.t; ce.className = 'on' + (m.big ? ' big' : ''); } else ce.className = '';
  $('#hWrong').classList.toggle('on', !!RACE.wrong);
  const L = $('#hLights'); L.classList.toggle('on', RACE.phase === 'count'); if (RACE.phase === 'count') L.querySelectorAll('i').forEach((e, k) => e.classList.toggle('lit', k < RACE.lightsN));
  drawMini();
}
function gap(c, lead) { const d = (lead.lap * TR.len + lead.veh.s) - (c.lap * TR.len + c.veh.s); const t = d / Math.max(20, c.veh.speed || 20); return d > TR.len ? `+${Math.floor(d / TR.len)} LAP` : '+' + t.toFixed(1); }
const esc = s => String(s).replace(/[<>&]/g, '');
function drawMini() {
  const cv = $('#hMini'); if (!mmCtx) { mmCtx = cv.getContext('2d'); }
  const W = cv.width = cv.clientWidth * (devicePixelRatio > 1 ? 2 : 1), H = cv.height = cv.clientHeight * (devicePixelRatio > 1 ? 2 : 1); if (!W) return; const x = mmCtx;
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (const s of TR.S) { minx = Math.min(minx, s.p.x); maxx = Math.max(maxx, s.p.x); minz = Math.min(minz, s.p.z); maxz = Math.max(maxz, s.p.z); }
  const sc = Math.min(W / (maxx - minx), H / (maxz - minz)) * 0.86, ox = W / 2 - (minx + maxx) / 2 * sc, oz = H / 2 + (minz + maxz) / 2 * sc; const P = p => [ox + p.x * sc, oz - p.z * sc];
  x.clearRect(0, 0, W, H); x.lineJoin = 'round'; x.beginPath(); TR.S.forEach((s, i) => { const [a, b] = P(s.p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath();
  x.strokeStyle = 'rgba(0,0,0,.65)'; x.lineWidth = W * 0.055; x.stroke(); x.strokeStyle = 'rgba(235,240,245,.9)'; x.lineWidth = W * 0.025; x.stroke();
  const [sx, sy] = P(TR.S[0].p); x.fillStyle = '#fff'; x.fillRect(sx - W * 0.03, sy - 2, W * 0.06, 4);
  for (const c of RACE.cars) { const [a, b] = P(c.veh.p); x.beginPath(); x.arc(a, b, c.me ? W * 0.035 : W * 0.024, 0, 7); x.fillStyle = c.me ? '#ffd23f' : c.col || '#ff3b3b'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#000'; x.stroke(); }
}
