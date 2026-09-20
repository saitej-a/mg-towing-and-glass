/**
 * tow-truck.js
 * Hero 3D scene — the real GLB recovery truck, presented directly on the
 * open hero background (no card frame). Studio lighting, soft contact
 * shadow, pulsing emergency bar, drag-to-rotate + cursor parallax.
 *
 * Model space is normalised in scene-utils.loadModel(): truck length = 1,
 * lowest point sits on y = 0. Anchor positions below were derived from the
 * GLB node bounds (headlights, beacon bar) so lights land where they should.
 */

import { radialGlowTexture, createDragController, listen } from './scene-utils.js';

const ROOM_ENV_URL = 'three/addons/environments/RoomEnvironment.js';

/* Normalised-space anchors (truck length = 1.15, ground = y 0) */
const ANCHORS = {
  headlightX: 0.085,
  headlightY: 0.105,
  noseZ: 0.548,
  beaconX: 0.045,
  beaconY: 0.300,
  beaconZ: 0.274
};

const BASE_YAW = -0.62; // nose angled toward the headline / viewer

/* Soft black blob used as the ground-contact shadow (cheap tiers). */
function makeBlobTexture(THREE) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.66)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.38)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/* Beacon glow sprites (attached to the truck rig). */
function buildBeaconGlows(THREE, rig) {
  const glowTex = radialGlowTexture(THREE, 'rgba(255,64,40,0.85)', 128);
  return [1, -1].map((side) => {
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color: side > 0 ? 0xff4028 : 0xffa63a,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(side * ANCHORS.beaconX, ANCHORS.beaconY + 0.008, ANCHORS.beaconZ);
    sprite.scale.set(0.12, 0.12, 1);
    rig.add(sprite);
    return sprite;
  });
}

export async function createTowTruckScene(stage, THREE, opts = {}) {
  const { profile, scene, camera, renderer } = stage;
  const { model, scrollTarget = null, onHoverChange = null } = opts;
  if (!model) throw new Error('tow-truck: GLB model missing');

  /* Tone mapping for a premium, filmic metal look -------------------- */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  /* --- Model rig ---------------------------------------------------- */
  const truck = model.root;

  truck.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          if ('envMapIntensity' in m) m.envMapIntensity = 1.35;
          // Ensure metallic parts and dark materials are luminous and distinct
          if (m.metalness > 0.75) m.metalness = 0.68;
          if (m.roughness < 0.2) m.roughness = 0.28;
          m.needsUpdate = true;
        });
      }
    }
  });

  const rig = new THREE.Group();
  rig.add(truck);
  rig.rotation.y = BASE_YAW;
  rig.position.set(0, 0, 0); // cleanly centered on stage
  scene.add(rig);

  /* --- Ambient & studio lighting for full visibility ---------------- */
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));

  const frontLight = new THREE.DirectionalLight(0xffffff, 2.2);
  frontLight.position.set(0.5, 2.5, 3.2);
  scene.add(frontLight);

  /* --- Environment reflections (studio room) ------------------------ */
  try {
    const { RoomEnvironment } = await import(ROOM_ENV_URL);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();
  } catch (err) {
    // Environment map is an enhancement — lights alone still carry the scene.
    if (window.console && console.warn) console.warn('[MG 3D] env map skipped:', err);
  }

  /* --- Studio lighting ---------------------------------------------- */
  const keyLight = new THREE.DirectionalLight(0xfff5ea, profile.tier === 'high' ? 2.8 : 2.4);
  keyLight.position.set(2.0, 3.0, 2.2);
  if (profile.shadows) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(profile.tier === 'high' ? 2048 : 1024, profile.tier === 'high' ? 2048 : 1024);
    keyLight.shadow.camera.left = -1.4;
    keyLight.shadow.camera.right = 1.4;
    keyLight.shadow.camera.top = 1.4;
    keyLight.shadow.camera.bottom = -1.4;
    keyLight.shadow.camera.far = 8;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.radius = 5;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xaad0ff, 1.6);
  rimLight.position.set(-2.4, 2.0, -1.8);
  scene.add(rimLight);

  const fillLight = new THREE.HemisphereLight(0x4a5568, 0x1a202c, 1.2);
  scene.add(fillLight);

  /* Emergency bar illumination — pulses with the beacon glows. */
  const beaconLight = new THREE.PointLight(0xff3220, 0, 2.4, 1.8);
  beaconLight.position.set(0, ANCHORS.beaconY + 0.02, ANCHORS.beaconZ);
  rig.add(beaconLight);

  /* Headlight spill onto the ground ahead of the nose. */
  const headLight = new THREE.SpotLight(0xfff2dc, profile.tier === 'high' ? 14 : 9, 3.2, 0.5, 0.55, 1.6);
  headLight.position.set(0, ANCHORS.headlightY, ANCHORS.noseZ + 0.02);
  headLight.target.position.set(0, 0, ANCHORS.noseZ + 1.1);
  rig.add(headLight);
  rig.add(headLight.target);

  /* --- Ground: receives the soft shadow, invisible itself ----------- */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 48),
    new THREE.ShadowMaterial({ opacity: 0.42 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* Cheap-tier contact shadow blob (no real shadow maps). */
  let contactBlob = null;
  if (!profile.shadows) {
    contactBlob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: makeBlobTexture(THREE),
        transparent: true,
        depthWrite: false
      })
    );
    contactBlob.rotation.x = -Math.PI / 2;
    contactBlob.position.y = 0.002;
    scene.add(contactBlob);
  }

  /* Beacon glow sprites */
  const beaconGlows = buildBeaconGlows(THREE, rig);

  /* --- Camera framing (centered in hero stage) -------------------- */
  const frame = (w, h) => {
    const aspect = w / Math.max(h, 1);
    camera.position.set(0, 0.36, aspect > 1 ? 1.45 : 1.9);
    camera.lookAt(0, 0.16, 0);
  };
  frame(stage.renderer.domElement.width, stage.renderer.domElement.height);
  stage.onResize = frame;

  /* --- Interaction --------------------------------------------------- */
  const drag = createDragController(stage, {
    maxYaw: 0.6,
    maxPitch: 0.12,
    parallax: 0.05,
    autoRotate: 0.1,
    onHoverChange
  });
  stage.container.style.touchAction = 'pan-y';

  /* Scroll link: truck eases back / camera lifts as the hero scrolls. */
  let scrollAmt = 0;

  /* --- Frame loop ----------------------------------------------------- */
  stage.onFrame = (dt, elapsed) => {
    const s = drag.update(dt);
    const yaw = BASE_YAW + s.yaw + s.autoAngle;
    rig.rotation.y = yaw + (scrollAmt * -0.18);
    rig.rotation.x = s.pitch;

    // Gentle body float + scroll push-back
    rig.position.z = scrollAmt * 0.55;
    rig.position.y = Math.sin(elapsed * 0.8) * 0.006;

    // Camera parallax + scroll lift
    const px = s.pointerX * 0.1;
    const py = s.pointerY * 0.06;
    camera.position.x += (px - camera.position.x) * Math.min(dt * 3, 1);
    camera.position.y += (0.36 + py + scrollAmt * 0.25 - camera.position.y) * Math.min(dt * 3, 1);
    camera.lookAt(0, 0.16, 0);

    // Emergency beacon pulse (soft, professional cadence)
    const pulse = (Math.sin(elapsed * 3.4) * 0.5 + 0.5) ** 2;
    beaconLight.intensity = 0.5 + pulse * 2.2;
    beaconGlows.forEach((g, i) => {
      const phase = Math.sin(elapsed * 3.4 + i * Math.PI) * 0.5 + 0.5;
      g.material.opacity = 0.12 + phase * 0.4;
      const sc = 0.18 + phase * 0.1;
      g.scale.set(sc, sc, 1);
    });
    beaconLight.color.setHSL(0.015 + pulse * 0.02, 0.95, 0.5);

    // Hover brightening
    const hoverBoost = 1 + s.hoverAmount * 0.35;
    keyLight.intensity = (profile.tier === 'high' ? 2.6 : 2.2) * hoverBoost;

    // Scroll easing toward target progress (0..1)
    if (scrollTarget) {
      const target = clamp01(scrollTarget());
      scrollAmt += (target - scrollAmt) * Math.min(dt * 4, 1);
    }
  };

  return { rig, drag };
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
