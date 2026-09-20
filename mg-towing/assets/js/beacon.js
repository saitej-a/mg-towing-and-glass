/**
 * beacon.js
 * Standalone 3D emergency beacon for the "Stranded on the Road?" section.
 * A soft, slow pulse — reassuring rather than alarming or gimmicky.
 */

import { roundedBox, radialGlowTexture, createDragController, track } from './scene-utils.js';

function beaconEnvironment(stage, THREE, scene, profile) {
  if (!profile.reflections) return;

  const pmrem = new THREE.PMREMGenerator(stage.renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0a0809);

  const white = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  white.position.set(-3, 4, 3);
  white.lookAt(0, 0, 0);
  envScene.add(white);

  const red = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshBasicMaterial({ color: 0x8a1a0e }));
  red.position.set(4, 0.5, -2);
  red.lookAt(0, 0, 0);
  envScene.add(red);

  const env = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = env;

  track(stage, {
    dispose: () => {
      env.dispose();
      pmrem.dispose();
      envScene.traverse((n) => {
        if (n.geometry) n.geometry.dispose();
        if (n.material) n.material.dispose();
      });
    }
  });
}

export async function createBeaconScene(stage, THREE, options = {}) {
  const { scrollTarget = null } = options;
  const { scene, camera, profile } = stage;

  beaconEnvironment(stage, THREE, scene, profile);

  /* lighting ------------------------------------------------------------- */
  scene.add(new THREE.HemisphereLight(0x8c9bb5, 0x0a0b0e, 0.42));

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3.5, 6, 4.5);
  if (profile.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(768, 768);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
  }
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xff6a1a, 1.6);
  rim.position.set(4.5, 1.6, -4);
  scene.add(rim);

  /* beacon unit ---------------------------------------------------------- */
  const unit = new THREE.Group();
  scene.add(unit);

  const mats = {
    dark: new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.72, roughness: 0.34 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc4cad4, metalness: 1, roughness: 0.16 }),
    base: new THREE.MeshStandardMaterial({ color: 0x0c0e13, metalness: 0.5, roughness: 0.6 }),
    red: new THREE.MeshStandardMaterial({
      color: 0xff2d20,
      emissive: 0xff2d20,
      emissiveIntensity: 1.4,
      metalness: 0.25,
      roughness: 0.4
    }),
    amber: new THREE.MeshStandardMaterial({
      color: 0xffb020,
      emissive: 0xffb020,
      emissiveIntensity: 1.1,
      metalness: 0.25,
      roughness: 0.4
    })
  };

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.94, 0.2, 24, 1), mats.base);
  base.position.y = -0.95;
  base.castShadow = true;
  unit.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.74, 0.9, 22, 1), mats.dark);
  body.position.y = -0.44;
  body.castShadow = true;
  unit.add(body);

  /* rotating lens block */
  const lensBar = new THREE.Group();
  lensBar.position.y = 0.42;
  unit.add(lensBar);

  const lensLeft = new THREE.Mesh(roundedBox(THREE, { width: 0.5, height: 0.62, depth: 1.02, radius: 0.14 }), mats.red.clone());
  lensLeft.position.set(-0.3, 0, 0);
  lensBar.add(lensLeft);

  const lensRight = new THREE.Mesh(roundedBox(THREE, { width: 0.5, height: 0.62, depth: 1.02, radius: 0.14 }), mats.red.clone());
  lensRight.position.set(0.3, 0, 0);
  lensBar.add(lensRight);

  const amberPods = [-0.62, 0.62].map((x) => {
    const pod = new THREE.Mesh(
      roundedBox(THREE, { width: 0.22, height: 0.34, depth: 0.34, radius: 0.08 }),
      mats.amber.clone()
    );
    pod.position.set(x, 0.4, 0);
    unit.add(pod);
    return pod;
  });

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.6, 0.24, 20, 1), mats.dark);
  cap.position.y = 0.86;
  unit.add(cap);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 8, 18, Math.PI), mats.chrome);
  handle.position.y = 0.98;
  handle.rotation.y = Math.PI / 2;
  unit.add(handle);

  /* glow sprites --------------------------------------------------------- */
  const glowTex = radialGlowTexture(THREE, 'rgba(255,59,31,0.85)', 128);
  track(stage, { dispose: () => glowTex.dispose() });

  const halos = [lensLeft, lensRight].map((lens) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff3b1f,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    sprite.position.copy(lens.position).add(new THREE.Vector3(0, 0.42, 0));
    sprite.scale.set(2.5, 2.5, 1);
    unit.add(sprite);
    return sprite;
  });

  const floorGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xff2d20,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  floorGlow.scale.set(9, 9, 1);
  floorGlow.position.set(0, -1.02, 0.2);
  scene.add(floorGlow);

  /* shadow catcher ------------------------------------------------------- */
  if (profile.shadows) {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.4 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = -1.05;
    catcher.receiveShadow = true;
    scene.add(catcher);
  }

  /* camera + interaction ------------------------------------------------- */
  const baseCam = new THREE.Vector3(2.9, 1.9, 4.8);
  camera.position.copy(baseCam);
  camera.lookAt(0, -0.1, 0);

  const drag = createDragController(stage, {
    maxYaw: 0.42,
    maxPitch: 0.14,
    parallax: 0.05,
    autoRotate: profile.isMobile ? 0.2 : 0.07,
    idleDelay: 1800
  });

  const scrollState = { amount: 0 };
  const updateScroll = () => {
    if (!scrollTarget) return;
    const rect = scrollTarget.getBoundingClientRect();
    scrollState.amount = Math.min(1, Math.max(0, 1 - rect.top / Math.max(window.innerHeight, 1)));
  };
  if (scrollTarget) {
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
  }

  stage.onFrame = (dt, elapsed) => {
    const st = drag.update(dt);
    const s = scrollState.amount;

    unit.rotation.y = st.yaw + st.autoAngle;
    unit.position.y = Math.sin(elapsed * 0.7) * 0.05 - s * 0.25;
    lensBar.rotation.y = elapsed * 0.85;

    // slow, reassuring pulse
    const pulse = Math.sin(elapsed * 1.9) * 0.5 + 0.5;
    lensLeft.material.emissiveIntensity = 0.9 + pulse * 2.2;
    lensRight.material.emissiveIntensity = 0.9 + (1 - pulse) * 2.2;
    amberPods.forEach((pod, i) => {
      const p = i === 0 ? pulse : 1 - pulse;
      pod.material.emissiveIntensity = 0.8 + p * 1.1;
    });

    halos.forEach((sprite, i) => {
      const p = i === 0 ? pulse : 1 - pulse;
      sprite.material.opacity = 0.18 + p * 0.55;
      const scale = 1.9 + p * 1.1;
      sprite.scale.set(scale, scale, 1);
    });

    floorGlow.material.opacity = 0.14 + pulse * 0.26;

    camera.position.x = baseCam.x + st.pointerX * 0.45;
    camera.position.y = baseCam.y - st.pointerY * 0.3 + s * 0.3;
    camera.position.z = baseCam.z + s * 1.4;
    camera.lookAt(0, -0.1 - s * 0.1, 0);
  };

  return {
    dispose: () => {
      if (scrollTarget) window.removeEventListener('scroll', updateScroll);
      Object.values(mats).forEach((m) => m.dispose());
    }
  };
}