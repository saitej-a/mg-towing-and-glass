/**
 * app.js
 * Boots every 3D scene on the page.
 *
 * Strategy: each scene is only created when it scrolls near the viewport, and
 * three.js itself is fetched once (shared promise) then reused. Nothing here
 * runs before the DOM is parsed, and none of it blocks first paint.
 */

import { lazyMount, getProfile, makeMaterials, loadThreeWithAddons, loadModel } from './scene-utils.js';
import { createTowTruckScene } from './tow-truck.js';
import { createGlassScene } from './glass.js';
import { createBeaconScene } from './beacon.js';
import { MINI_ICONS, createHoverBridge } from './mini3d.js';

function logRemote(msg) {
  try {
    fetch('/api/log', { method: 'POST', body: typeof msg === 'string' ? msg : JSON.stringify(msg) }).catch(() => {});
  } catch (e) {}
}
window.addEventListener('error', (e) => logRemote({ type: 'uncaught_error', message: e.message, filename: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => logRemote({ type: 'unhandled_rejection', reason: String(e.reason) }));

/* ------------------------------------------------------------------ */
/* Hero tow truck (Interactive 3D GLB model)                           */
/* ------------------------------------------------------------------ */
function bootHero() {
  const node = document.querySelector('[data-scene="tow-truck"]');
  logRemote('[bootHero] node found: ' + !!node);
  if (!node) return;

  const stageLabel = node.querySelector('[data-label]');
  const hint = node.querySelector('[data-hint]');
  const statusEl = node.querySelector('[data-load-status]');
  const fallbackEl = node.querySelector('[data-fallback]');

  const showStatus = (msg, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
    statusEl.classList.toggle('is-error', isError);
  };

  lazyMount(
    node,
    async (stage, THREE) => {
      logRemote('[bootHero] directMount triggered! Tier: ' + stage.profile.tier);

      try {
        const { GLTFLoader } = await loadThreeWithAddons();
        logRemote('[bootHero] GLTFLoader loaded! Fetching assets/models/tow-truck.glb...');

        const model = await loadModel(
          'assets/models/tow-truck.glb',
          THREE,
          GLTFLoader,
          1.15,
          (evt) => {
            if (evt.lengthComputable && evt.total > 0) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              showStatus(`Loading 3D truck… ${pct}%`);
            }
          }
        );
        logRemote('[bootHero] assets/models/tow-truck.glb loaded directly! Size: ' + JSON.stringify(model.size));

        showStatus('');

        let labelTimer = null;

        // Scroll progress of the hero itself
        const heroEl = node.closest('.hero') || node;
        const scrollProgress = () => {
          const rect = heroEl.getBoundingClientRect();
          const range = Math.max(rect.height, 1);
          return Math.min(1, Math.max(0, -rect.top / range));
        };

        const scene = await createTowTruckScene(stage, THREE, {
          model,
          scrollTarget: scrollProgress,
          onHoverChange: (hovering) => {
            if (!stageLabel) return;
            if (hovering) {
              if (labelTimer) clearTimeout(labelTimer);
              stageLabel.classList.add('is-visible');
              if (hint) hint.classList.add('is-hidden');
            } else {
              labelTimer = setTimeout(() => stageLabel.classList.remove('is-visible'), 300);
            }
          }
        });

        // 3D scene is ready — hide fallback if present
        if (fallbackEl) fallbackEl.hidden = true;
        if (stageLabel) stageLabel.classList.add('is-visible');
        node.__scene = scene;
      } catch (err) {
        showStatus('3D truck could not load. (Open via START-SITE.bat / node server.cjs)', true);
        if (window.console && console.error) console.error('[MG hero 3D]', err);
        if (fallbackEl) fallbackEl.hidden = false;
        throw err;
      }
    },
    { immediate: true }
  );
}

/* ------------------------------------------------------------------ */
/* Interactive windshield                                              */
/* ------------------------------------------------------------------ */
function bootGlass() {
  const node = document.querySelector('[data-scene="windshield"]');
  if (!node) return;

  lazyMount(node, async (stage, THREE) => {
    if (stage.profile.tier === 'low') return;

    await createGlassScene(stage, THREE, {
      onReveal: (revealed) => {
        node.setAttribute('data-revealed', revealed ? 'true' : 'false');
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Emergency beacon                                                    */
/* ------------------------------------------------------------------ */
function bootBeacon() {
  const node = document.querySelector('[data-scene="beacon"]');
  if (!node) return;

  lazyMount(node, async (stage, THREE) => {
    if (stage.profile.tier === 'low') return;
    await createBeaconScene(stage, THREE, { scrollTarget: node });
  });
}

/* ------------------------------------------------------------------ */
/* Service card icons + location pin                                   */
/* ------------------------------------------------------------------ */
function bootMinis() {
  const profile = getProfile();
  if (profile.tier === 'low') return;

  document.querySelectorAll('[data-mini]').forEach((slot) => {
    const type = slot.getAttribute('data-mini');
    const factory = MINI_ICONS[type];
    if (!factory) return;

    if (profile.tier === 'medium' && type === 'pin') return;

    const host = slot.closest('[data-mini-host]') || slot.parentElement;

    lazyMount(slot, async (stage, THREE) => {
      const hover = createHoverBridge();
      stage.hover = hover;

      await factory(stage, THREE);

      if (host && window.matchMedia('(hover: hover)').matches) {
        host.addEventListener('pointerenter', () => {
          hover.target = 1;
          host.classList.add('is-hot');
        });
        host.addEventListener('pointerleave', () => {
          hover.target = 0;
          host.classList.remove('is-hot');
        });
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Prefetch three.js when the connection looks good                    */
/* ------------------------------------------------------------------ */
function idlePrefetch() {
  const conn = navigator.connection;
  const slow = conn && (conn.saveData || /2g/.test(conn.effectiveType || ''));
  if (slow || !getProfile().supported) return;

  const warm = () => import('./scene-utils.js').then((m) => m.loadThree().catch(() => {}));
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1200);
}

export function initScenes() {
  bootHero();
  bootGlass();
  bootBeacon();
  bootMinis();
  idlePrefetch();
}

/* Exported for potential reuse/testing */
export { makeMaterials };