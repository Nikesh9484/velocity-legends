// Strike Force Legends — keep the screen fixed like an app: no pinch/double-tap zoom, no page scroll,
// auto-undo an accidental zoom, full screen + lock rotation on phones/tablets.
const meta = document.querySelector('meta[name=viewport]');
const VP = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
const stop = e => { if (e.cancelable) e.preventDefault(); };

// iOS Safari ignores user-scalable=no, so block the gestures directly
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, stop, { passive: false }));
// two-finger pinch on the page (the game's own two-thumb controls use separate touches on buttons/sticks and still work)
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) stop(e); }, { passive: false });
// double-tap zoom is blocked by CSS touch-action (see sfl.css)
document.addEventListener('dblclick', stop, { passive: false });
// laptop: Ctrl + mouse-wheel / trackpad pinch, Ctrl +/-/0
window.addEventListener('wheel', e => { if (e.ctrlKey) stop(e); }, { passive: false });
window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) stop(e); });
// page must never scroll
window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });

// if it got zoomed anyway (e.g. keyboard focus), snap back to normal size
function unzoom() {
  const vv = window.visualViewport; if (!vv || vv.scale <= 1.01) return;
  if (document.activeElement && typing({ target: document.activeElement })) return; // wait until typing ends
  if (meta) { meta.setAttribute('content', VP.replace('maximum-scale=1', 'maximum-scale=1.01')); requestAnimationFrame(() => meta.setAttribute('content', VP)); }
  window.scrollTo(0, 0);
}
if (meta) meta.setAttribute('content', VP);
if (window.visualViewport) { visualViewport.addEventListener('resize', () => setTimeout(unzoom, 250)); }
document.addEventListener('focusout', () => setTimeout(unzoom, 300));
setInterval(unzoom, 1500);

// phones/tablets: go full screen and lock the screen in its current position on the first tap
const touchDev = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
async function lockScreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  } catch (e) {}
  try { const o = screen.orientation; if (o && o.lock) await o.lock(o.type.startsWith('portrait') ? 'portrait' : 'landscape'); } catch (e) {}
}
if (touchDev) {
  const first = () => { lockScreen(); };
  document.addEventListener('pointerup', first, { once: true });
  // re-lock after leaving full screen and tapping again
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.addEventListener('pointerup', first, { once: true }); });
}
export { lockScreen };
