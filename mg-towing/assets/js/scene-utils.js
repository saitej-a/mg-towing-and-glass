/**
 * scene-utils.js
 * Capability detection, quality tiers and shared three.js helpers for
 * MG Towing & Glass Services.
 *
 * Design goal: 3D must never block or slow the first paint. Every scene is
 * mounted lazily, three.js is imported at runtime from a CDN, and if anything
 * fails (no WebGL, slow network, import error) the caller falls back to the
 * static poster image that is already in the DOM.
 */

/* Add-ons are resolved through the page's import map (see index.html), which
   maps "three" and "three/addons/" to the vendored local copies. */

let addonsPromise = null;

/**
 * Loads three.js plus the add-ons required to render our compressed GLB
 * (meshopt decoder + WebP texture support) in one shared promise.
 */
export async function loadThreeWithAddons() {
  // Fast path: reused shared promise.
  if (addonsPromise) return addonsPromise;

  addonsPromise = (async () => {
    const [THREE, gltfMod, meshoptMod] = await Promise.all([
      loadThree(),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js')
    ]);

    const loader = new gltfMod.GLTFLoader();
    if (meshoptMod.MeshoptDecoder) loader.setMeshoptDecoder(meshoptMod.MeshoptDecoder);

    return { THREE, GLTFLoader: loader };
  })();

  // Surface failure as a rejected promise (keeps the shared-cache reset).
  addonsPromise = addonsPromise.catch((err) => {
    addonsPromise = null;
    throw err;
  });

  return addonsPromise;
}

/**
 * Computes an exact, vertex-tight bounding box in world space.
 * Avoids Three.js Box3.setFromObject inflating boxes on rotated child nodes.
 */
export function computeExactBoundingBox(obj, THREE) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
      const pos = child.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(child.matrixWorld);
        box.expandByPoint(v);
      }
    }
  });
  if (box.isEmpty()) box.setFromObject(obj);
  return box;
}

/**
 * Loads a compressed GLB and returns the parsed glTF scene root, auto-scaled
 * to a predictable height so scenes can be framed without guesswork.
 */
export function loadModel(url, THREE, loader, targetHeight = 1, onProgress = null) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;

        root.updateMatrixWorld(true);
        const box = computeExactBoundingBox(root, THREE);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const s = targetHeight / maxDim;
        root.scale.setScalar(s);

        root.updateMatrixWorld(true);
        const box2 = computeExactBoundingBox(root, THREE);
        const center = box2.getCenter(new THREE.Vector3());

        // Center on X and Z, and place the lowest point firmly on ground y = 0
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= box2.min.y;

        root.updateMatrixWorld(true);
        const finalBox = computeExactBoundingBox(root, THREE);
        const finalSize = new THREE.Vector3();
        finalBox.getSize(finalSize);

        resolve({ root, size: finalSize, box: finalBox, gltf });
      },
      onProgress || undefined,
      reject
    );
  });
}

/* ------------------------------------------------------------------ */
/* Capability detection                                                */
/* ------------------------------------------------------------------ */

let cachedProfile = null;

export function webglSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();
    return true;
  } catch (err) {
    return false;
  }
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function deviceMemory() {
  return typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null;
}

function hardwareThreads() {
  return typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : null;
}

export function isSmallScreen() {
  return typeof window !== 'undefined' && window.innerWidth <= 720;
}

/**
 * Returns { supported, tier, dpr, shadows, reflections, animated }
 * tier: 'high' | 'medium' | 'low'
 */
export function getProfile() {
  if (cachedProfile) return cachedProfile;

  const supported = webglSupported();
  const reduced = prefersReducedMotion();
  const cores = hardwareThreads();
  const mem = deviceMemory();
  const small = isSmallScreen();

  let tier = 'high';

  if (!supported || reduced) {
    tier = 'low';
  } else if ((cores !== null && cores <= 4) || (mem !== null && mem <= 4)) {
    tier = small ? 'low' : 'medium';
  } else if (small || (cores !== null && cores <= 6)) {
    tier = 'medium';
  }

  const tiers = {
    high: { dpr: Math.min(window.devicePixelRatio || 1, 2), shadows: true, reflections: true, animated: true },
    medium: { dpr: Math.min(window.devicePixelRatio || 1, 1.5), shadows: false, reflections: false, animated: true },
    low: { dpr: 1, shadows: false, reflections: false, animated: false }
  };

  cachedProfile = {
    supported,
    reducedMotion: reduced,
    tier,
    isMobile: small,
    ...tiers[tier]
  };

  return cachedProfile;
}

/* ------------------------------------------------------------------ */
/* Lazy three.js import                                                */
/* ------------------------------------------------------------------ */

let threePromise = null;

export function loadThree() {
  if (!threePromise) {
    // Resolved via the import map in index.html (vendored copy of three.js).
    threePromise = import('three').catch((err) => {
      threePromise = null;
      throw err;
    });
  }
  return threePromise;
}

/* ------------------------------------------------------------------ */
/* Stage lifecycle                                                     */
/* ------------------------------------------------------------------ */

export function createStage(container, opts = {}) {
  const profile = getProfile();
  return {
    container,
    profile,
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    THREE: null,
    running: false,
    inView: true,
    rafId: null,
    onFrame: opts.onFrame || null,
    _disposables: [],
    _listeners: []
  };
}

export function track(stage, obj) {
  stage._disposables.push(obj);
  return obj;
}

export function listen(stage, target, type, handler, options) {
  target.addEventListener(type, handler, options);
  stage._listeners.push(() => target.removeEventListener(type, handler, options));
}

export function mountStage(stage, THREE) {
  const { container, profile } = stage;
  stage.THREE = THREE;

  const renderer = new THREE.WebGLRenderer({
    antialias: profile.tier === 'high',
    alpha: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(profile.dpr);
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  if (profile.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  container.appendChild(renderer.domElement);
  stage.renderer = renderer;
  stage.scene = new THREE.Scene();
  stage.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  stage.clock = new THREE.Clock();

  resizeStage(stage);
  return stage;
}

export function resizeStage(stage) {
  const { container, renderer, camera } = stage;
  if (!renderer || !container) return;

  const rect = container.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  try {
    fetch('/api/log', { method: 'POST', body: `[resizeStage] container: ${container.className || container.tagName} w:${w} h:${h}` }).catch(() => { });
  } catch (e) { }

  if (stage.onResize) stage.onResize(w, h);
}

export function startLoop(stage) {
  if (stage.running) return;
  stage.running = true;
  stage.clock.start();

  const tick = () => {
    if (!stage.running) return;
    stage.rafId = requestAnimationFrame(tick);
    if (!stage.inView) return;

    const dt = Math.min(stage.clock.getDelta(), 0.05);
    const elapsed = stage.clock.elapsedTime;
    if (stage.onFrame) stage.onFrame(dt, elapsed, stage);
    stage.renderer.render(stage.scene, stage.camera);
  };

  stage.rafId = requestAnimationFrame(tick);
}

export function stopLoop(stage) {
  stage.running = false;
  if (stage.rafId) cancelAnimationFrame(stage.rafId);
  stage.rafId = null;
}

/** Pauses rendering while off-screen; keeps mobile batteries happy. */
export function observeVisibility(stage, rootMargin = '180px') {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          stage.inView = entry.isIntersecting;
        });
      },
      { rootMargin }
    );
    io.observe(stage.container);
    stage._disposables.push({ dispose: () => io.disconnect() });
  }

  listen(stage, document, 'visibilitychange', () => {
    stage.inView = !document.hidden;
  });

  const onResize = () => resizeStage(stage);
  listen(stage, window, 'resize', onResize);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => resizeStage(stage));
    ro.observe(stage.container);
    stage._disposables.push({ dispose: () => ro.disconnect() });
  }
}

export function disposeStage(stage) {
  stopLoop(stage);
  stage._listeners.forEach((off) => off());
  stage._listeners = [];

  stage._disposables.forEach((obj) => {
    if (obj && typeof obj.dispose === 'function') obj.dispose();
  });
  stage._disposables = [];

  if (stage.renderer) {
    if (stage.scene) {
      stage.scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((m) => m.dispose && m.dispose());
        }
      });
    }
    stage.renderer.dispose();
    const el = stage.renderer.domElement;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Rounded box — used heavily so the truck reads as machined metal. */
export function roundedBox(THREE, {
  width = 1, height = 1, depth = 1, radius = 0.06
} = {}) {
  const geo = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
  const pos = geo.attributes.position;
  const r = Math.min(radius, Math.min(width, height, depth) / 2.2);
  const half = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const cx = Math.abs(v.x) > half.x - r ? Math.sign(v.x) * (half.x - r) : v.x;
    const cy = Math.abs(v.y) > half.y - r ? Math.sign(v.y) * (half.y - r) : v.y;
    const cz = Math.abs(v.z) > half.z - r ? Math.sign(v.z) * (half.z - r) : v.z;
    v.set(cx, cy, cz);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/** Cutaway box: like a rounded box but you can taper/trim it (windshield glass). */
export function trapezoid(THREE, {
  bottomWidth = 1, topWidth = 0.82, height = 0.6, depth = 0.05, topOffset = 0
} = {}) {
  const shape = new THREE.Shape();
  const bw = bottomWidth / 2;
  const tw = topWidth / 2;

  shape.moveTo(-bw, -height / 2);
  shape.lineTo(bw, -height / 2);
  shape.lineTo(tw + topOffset, height / 2);
  shape.lineTo(-tw + topOffset, height / 2);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 2
  });
  geo.center();
  return geo;
}

/** Soft radial sprite used for glows / light pools. */
export function radialGlowTexture(THREE, color = 'rgba(255,59,31,0.9)', size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.22, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/* ------------------------------------------------------------------ */
/* Pointer / drag controller                                           */
/* ------------------------------------------------------------------ */

/**
 * Drag rotates within clamped bounds (never spins uncontrollably), cursor
 * position adds gentle parallax, and touch devices get a very slow
 * auto-rotation once the user stops interacting.
 */
export function createDragController(stage, {
  maxYaw = 0.5,
  maxPitch = 0.14,
  parallax = 0.045,
  autoRotate = 0,
  idleDelay = 2600,
  onHoverChange = null
} = {}) {
  const el = stage.container;
  const state = {
    targetYaw: 0,
    targetPitch: 0,
    yaw: 0,
    pitch: 0,
    pointerX: 0,
    pointerY: 0,
    hoverAmount: 0,
    hovering: false,
    dragging: false,
    lastInteract: performance.now(),
    autoAngle: 0
  };

  let startX = 0;
  let startY = 0;
  let startYaw = 0;
  let startPitch = 0;

  const pointFrom = (e) =>
    e.touches && e.touches[0]
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

  const onDown = (e) => {
    state.dragging = true;
    state.lastInteract = performance.now();
    const p = pointFrom(e);
    startX = p.x;
    startY = p.y;
    startYaw = state.targetYaw;
    startPitch = state.targetPitch;
  };

  const onMove = (e) => {
    const rect = el.getBoundingClientRect();
    const p = pointFrom(e);

    if (state.dragging) {
      const dx = (p.x - startX) / Math.max(rect.width, 1);
      const dy = (p.y - startY) / Math.max(rect.height, 1);
      state.targetYaw = clamp(startYaw + dx * 1.6, -maxYaw, maxYaw);
      state.targetPitch = clamp(startPitch + dy * 0.6, -maxPitch, maxPitch);
      state.lastInteract = performance.now();
    } else {
      state.pointerX = clamp((p.x - rect.left) / rect.width - 0.5, -0.5, 0.5);
      state.pointerY = clamp((p.y - rect.top) / rect.height - 0.5, -0.5, 0.5);
    }
  };

  const onUp = () => {
    state.dragging = false;
    state.lastInteract = performance.now();
  };

  const onEnter = () => {
    state.hovering = true;
    if (onHoverChange) onHoverChange(true);
  };

  const onLeave = () => {
    state.hovering = false;
    state.targetYaw = 0;
    state.targetPitch = 0;
    state.pointerX = 0;
    state.pointerY = 0;
    if (onHoverChange) onHoverChange(false);
  };

  listen(stage, el, 'pointerdown', onDown);
  listen(stage, window, 'pointermove', onMove, { passive: true });
  listen(stage, window, 'pointerup', onUp);
  listen(stage, window, 'pointercancel', onUp);
  listen(stage, el, 'pointerenter', onEnter);
  listen(stage, el, 'pointerleave', onLeave);

  if (!('PointerEvent' in window)) {
    listen(stage, el, 'touchstart', onDown, { passive: true });
    listen(stage, el, 'touchmove', onMove, { passive: true });
    listen(stage, el, 'touchend', onUp);
  }

  state.update = (dt) => {
    if (autoRotate > 0 && !state.dragging) {
      const idle = performance.now() - state.lastInteract;
      if (idle > idleDelay) state.autoAngle += dt * autoRotate;
    }

    const yawGoal = state.targetYaw + state.pointerX * parallax * Math.PI;
    const pitchGoal = state.targetPitch + state.pointerY * parallax * Math.PI * 0.42;

    state.yaw = damp(state.yaw, yawGoal, 5.5, dt);
    state.pitch = damp(state.pitch, pitchGoal, 5.5, dt);
    state.hoverAmount = damp(state.hoverAmount, state.hovering ? 1 : 0, 6, dt);

    return state;
  };

  return state;
}

/* ------------------------------------------------------------------ */
/* Lazy mount with graceful fallback                                   */
/* ------------------------------------------------------------------ */

/**
 * Mounts `factory(stage, THREE)` only when the element scrolls near the
 * viewport. On any failure the pre-rendered static fallback stays visible.
 */
export function lazyMount(selector, factory, { rootMargin = '320px', immediate = false } = {}) {
  const nodes =
    typeof selector === 'string' ? Array.from(document.querySelectorAll(selector)) : [selector];

  nodes.forEach((node) => {
    const container = node.querySelector('[data-canvas]') || node;
    const fallbackEl = node.querySelector('[data-fallback]');

    const run = () => {
      let cancelled = false;

      const boot = async () => {
        const profile = getProfile();

        if (!profile.supported) {
          if (fallbackEl) fallbackEl.hidden = false;
          return;
        }

        try {
          const stage = createStage(container);
          const THREE = await loadThree();
          if (cancelled) return;

          mountStage(stage, THREE);
          await factory(stage, THREE);
          if (cancelled) {
            disposeStage(stage);
            return;
          }

          observeVisibility(stage);
          startLoop(stage);
          if (fallbackEl) fallbackEl.hidden = true;
          node.classList.add('is-live');
        } catch (err) {
          if (fallbackEl) fallbackEl.hidden = false;
          if (window.console && console.warn) console.warn('[MG 3D] static fallback used:', err);
        }
      };

      boot();
      node.__mgSceneTeardown = () => { cancelled = true; };
    };

    if (immediate || !('IntersectionObserver' in window)) {
      run();
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              io.disconnect();
              run();
            }
          });
        },
        { rootMargin }
      );
      io.observe(node);
    }
  });
}

/** Shared material palette so every scene feels like one brand. */
export function makeMaterials(THREE, profile) {
  const envIntensity = profile.reflections ? 1.1 : 0.35;

  return {
    body: new THREE.MeshStandardMaterial({ color: 0xf1f4f8, metalness: 0.5, roughness: 0.33, envMapIntensity: envIntensity }),
    bodyDark: new THREE.MeshStandardMaterial({ color: 0x14171e, metalness: 0.66, roughness: 0.32, envMapIntensity: envIntensity }),
    chassis: new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.55, roughness: 0.62 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc9ced9, metalness: 1, roughness: 0.14, envMapIntensity: envIntensity }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8d949f, metalness: 0.92, roughness: 0.3, envMapIntensity: envIntensity }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x090a0d, metalness: 0.1, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xb9bfc9, metalness: 0.95, roughness: 0.22, envMapIntensity: envIntensity }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1119,
      metalness: 0.55,
      roughness: 0.05,
      transparent: true,
      opacity: 0.66,
      envMapIntensity: envIntensity
    }),
    emergency: new THREE.MeshStandardMaterial({
      color: 0xff2d20,
      emissive: 0xff2d20,
      emissiveIntensity: 1.6,
      metalness: 0.25,
      roughness: 0.38
    }),
    amber: new THREE.MeshStandardMaterial({
      color: 0xffb020,
      emissive: 0xff9b0f,
      emissiveIntensity: 1.25,
      metalness: 0.25,
      roughness: 0.38
    }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xfff4e2,
      emissive: 0xffe9c4,
      emissiveIntensity: 1.1,
      metalness: 0.1,
      roughness: 0.24
    })
  };
}