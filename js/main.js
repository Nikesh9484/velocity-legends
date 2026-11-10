// Velocity Legends — boot & main loop
import './lockview.js';
import { renderer, scene, camera, resize, applyQuality, Q, $, isTouch, prCap, initPost, render, setPR, POST, AU } from './engine.js';
const prFloor = isTouch ? 0.6 : 0.7;
import { S } from './state.js';
import { RACE, updateRace } from './race.js';
import { hudUpdate } from './hud.js';
import { initUI, show, showroom, updateShowroom, showCar } from './ui.js';
import { preloadCar } from './carmodel.js';

Q.auto = Q.level; initPost(); resize(); applyQuality(S.set.quality || Q.auto); if (isTouch) document.body.classList.add('touch');
initUI(); POST.mul = (S.set.bloom ?? 5) / 5; POST.film = S.set.film !== false; AU.eng = S.set.engVol ?? 1; document.body.classList.toggle('nomap', S.set.hudMap === false); document.body.classList.toggle('noboard', S.set.hudBoard === false); document.body.classList.toggle('notimes', S.set.hudTimes === false);
(async () => {
  const bar = $('#bootBar'), msg = $('#bootMsg'), t0 = performance.now(); bar.style.width = '18%';
  await showroom(true); bar.style.width = '50%'; msg.textContent = 'POLISHING THE PAINTWORK';
  await showCar(S.last.car); bar.style.width = '100%'; msg.textContent = 'READY';
  // let the intro breathe at least ~2.6 s, then flash into the live 3D showroom
  setTimeout(() => { const b = $('#s-boot'); b.classList.add('out'); show('title'); b.classList.add('on'); setTimeout(() => b.classList.remove('on', 'out'), 900); }, Math.max(250, 2600 - (performance.now() - t0)));
  // warm the cache for the other starter cars in the background
  setTimeout(() => ['w13', 'yaris', 'buggy'].forEach(id => preloadCar(id)), 4000);
})();
// adaptive quality: drop resolution when the frame rate sags during a race
let acc = 0, frames = 0, lastT = performance.now(), slow = 0;
function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (RACE.on) { updateRace(dt); hudUpdate(dt); } else updateShowroom(dt);
  render();
  acc += dt; frames++; if (acc > 1.0) { const fps = frames / acc; acc = 0; frames = 0;
    // too slow even at the lowest resolution: drop the glow/film effects
    if (!S.set.quality && fps < 30 && Q.pr <= prFloor + 0.01) { if (!POST.off) { POST.on = false; POST.off = true; } else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; Q.noShadow = true; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); } }
    if (!RACE.on && !S.set.quality) { if (fps < 40 && Q.mpr > prFloor) { Q.mpr = Math.max(prFloor, (Q.mpr || 1) - 0.15); setPR(Q.mpr); Q.pr = Q.mpr; } }
    if (RACE.on && !S.set.quality) { if (fps < 40 && Q.pr > prFloor) { Q.pr = Math.max(prFloor, Q.pr - (fps < 25 ? 0.2 : 0.1)); setPR(Q.pr); slow++; } else if (fps > 56 && Q.pr < prCap() && slow < 4) { Q.pr = Math.min(prCap(), Q.pr + 0.08); setPR(Q.pr); } } }
}
requestAnimationFrame(loop);
