// Velocity Legends — "install before play": downloads the whole game (cars, tracks, sounds) into the
// device once, with a progress screen. After that every screen and race loads from storage, offline too.
const CACHE = 'vl-game', KEY = 'vl_inst';
let promptEv = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEv = e; const b = document.getElementById('instHome'); if (b) b.style.display = ''; });

const css = `#inst{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(40,8,10,.82),rgba(3,4,6,.96) 70%);font-family:'Rajdhani','Orbitron',system-ui,sans-serif;color:#fff}
#inst .bx{width:min(560px,88vw);padding:28px 30px;border-radius:18px;background:linear-gradient(180deg,rgba(28,30,34,.92),rgba(10,11,13,.95));border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,42,42,.25)}
#inst h2{margin:0 0 4px;font:italic 900 clamp(22px,3.4vw,34px) 'Orbitron',system-ui;letter-spacing:1px;text-transform:uppercase}#inst h2 b{color:#ff2a2a}
#inst p{margin:0 0 18px;color:#b9c0c7;font-size:15px;letter-spacing:.5px}
#inst .bar{height:14px;border-radius:8px;background:#15171a;overflow:hidden;border:1px solid #2b2f34}#inst .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b3121a,#ff3a2a,#ffb35a);transition:width .25s}
#inst .st{display:flex;justify-content:space-between;margin-top:8px;font-weight:700;font-size:14px;color:#d6dbe0;letter-spacing:1px}
#inst .row{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap}#inst button{flex:1;min-width:150px;padding:13px 16px;border:0;border-radius:10px;font:800 15px system-ui;letter-spacing:1.5px;color:#fff;background:linear-gradient(180deg,#ff4a3e,#b3121a);box-shadow:0 5px 0 #5a0a0d;cursor:pointer}
#inst button.g{background:linear-gradient(180deg,#3a3f46,#1d2024);box-shadow:0 5px 0 #000}#inst .tip{margin-top:14px;font-size:12px;color:#8b949b;letter-spacing:.5px}`;

function ui() {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'inst';
  d.innerHTML = `<div class="bx"><h2>Install <b>Velocity</b> Legends</h2><p id="instTxt">Downloading every car, track and sound to this device once, so the game starts fast and races never wait for loading.</p>
  <div class="bar"><i id="instBar"></i></div><div class="st"><span id="instMB">0 MB</span><span id="instPc">0%</span></div>
  <div class="row"><button id="instHome" style="display:none">ADD TO HOME SCREEN</button><button id="instRetry" class="g" style="display:none">RETRY</button><button id="instSkip" class="g" style="display:none">PLAY ONLINE</button></div>
  <div class="tip" id="instTip">Keep this screen open. Wi-Fi recommended.</div></div>`;
  document.body.appendChild(d);
  d.querySelector('#instHome').onclick = homeScreen; if (promptEv) d.querySelector('#instHome').style.display = '';
  return d;
}
export async function homeScreen() { if (promptEv) { promptEv.prompt(); try { await promptEv.userChoice; } catch (e) {} promptEv = null; const b = document.getElementById('instHome'); if (b) b.style.display = 'none'; } }

export async function ensureInstalled() {
  if (!('caches' in window) || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try { await navigator.serviceWorker.register('sw.js'); } catch (e) { return; }
  let list; try { list = await (await fetch('files.json', { cache: 'no-store' })).json(); } catch (e) { return; } // offline: play what is stored
  let done = {}; try { done = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const cache = await caches.open(CACHE), base = new URL('./', location.href);
  const keys = new Set((await cache.keys()).map(r => r.url));
  const need = list.files.filter(([p, , h]) => done[p] !== h || !keys.has(new URL(p, base).href));
  if (!need.length) return; for (const f of need) delete done[f[0]];
  const first = !Object.keys(done).length; const total = need.reduce((s, f) => s + f[1], 0);
  if (total < 3e5 && !first) { await fetchAll(need, cache, base, done, () => {}); return; } // tiny update: silent
  const d = ui(); if (!first) { d.querySelector('h2').innerHTML = 'Updating <b>Velocity</b> Legends'; d.querySelector('#instTxt').textContent = 'A new version is out. Downloading only the changed files.'; }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  const bar = d.querySelector('#instBar'), mb = d.querySelector('#instMB'), pc = d.querySelector('#instPc');
  let gotAll = 0; const show = add => { const got = (gotAll += add); const f = Math.min(1, got / total); bar.style.width = (f * 100).toFixed(1) + '%'; pc.textContent = Math.floor(f * 100) + '%'; mb.textContent = `${(got / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`; };
  for (;;) {
    const failed = await fetchAll(need.filter(f => done[f[0]] !== f[2]), cache, base, done, show);
    if (!failed) break;
    d.querySelector('#instTxt').textContent = `Download interrupted (${failed} file${failed > 1 ? 's' : ''} left). Check the internet and tap RETRY.`;
    const r = d.querySelector('#instRetry'), s = d.querySelector('#instSkip'); r.style.display = s.style.display = '';
    const skip = await new Promise(res => { r.onclick = () => res(false); s.onclick = () => res(true); }); r.style.display = s.style.display = 'none';
    if (skip) break; d.querySelector('#instTxt').textContent = 'Resuming download…';
  }
  bar.style.width = '100%'; pc.textContent = '100%'; d.querySelector('#instTxt').textContent = 'Installed. The game now loads from this device.';
  d.querySelector('#instTip').textContent = promptEv ? 'Tip: tap ADD TO HOME SCREEN to open it like a normal app, full screen.' : /iPad|iPhone/.test(navigator.userAgent) ? 'Tip: Share → Add to Home Screen to open it like an app.' : 'Tip: browser menu ⋮ → Install app / Add to Home screen.';
  await new Promise(r => setTimeout(r, promptEv ? 2600 : 1400)); d.style.transition = 'opacity .5s'; d.style.opacity = 0; setTimeout(() => d.remove(), 520);
}
async function fetchAll(files, cache, base, done, show) {
  let got = 0, failed = 0, i = 0; const already = files.length; const q = files.slice();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} };
  const work = async () => {
    while (q.length) { const [p, size, h] = q.shift(); let ok = false;
      for (let a = 0; a < 3 && !ok; a++) { try { const res = await fetch(p, { cache: 'reload' }); if (!res.ok) throw 0; await cache.put(new URL(p, base).href, res); ok = true; } catch (e) { await new Promise(r => setTimeout(r, 800 * (a + 1))); } }
      if (ok) { done[p] = h; got += size; show(size); if (++i % 5 === 0) save(); } else failed++; }
  };
  await Promise.all([work(), work(), work(), work()]); save(); return failed;
}
