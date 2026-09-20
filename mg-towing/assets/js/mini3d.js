/**
 * mini3d.js
 * Small 3D objects for the service cards and the location pin.
 * These are cheap to run (no shadows, tiny geometry, hover-driven), so
 * several on one page still costs almost nothing.
 */

import { roundedBox, radialGlowTexture, track } from './scene-utils.js';

/* Shared tiny-scene scaffolding ------------------------------------------- */
function miniSetup(stage, THREE, {
  cameraPos = [0, 0.4, 3.4],
  lookAt = [0, 0, 0],
  ambient = 0.7,
  keyIntensity = 1.5,
  accent = 0xff7a2a
} = {}) {
  const { scene, camera } = stage;

  scene.add(new THREE.AmbientLight(0xffffff, ambient));

  const key = new THREE.DirectionalLight(0xffffff, keyIntensity);
  key.position.set(2.4, 3.2, 3.6);
  scene.add(key);

  const warm = new THREE.DirectionalLight(accent, 1.1);
  warm.position.set(-3, 0.8, 1.6);
  scene.add(warm);

  const cool = new THREE.DirectionalLight(0x9fc0ff, 0.5);
  cool.position.set(-1.4, -1.8, 2);
  scene.add(cool);

  camera.position.set(...cameraPos);
  camera.lookAt(...lookAt);

  return { key, warm, cool };
}

/** Hover spring shared by the mini icons; app.js sets `.target`. */
export function createHoverBridge() {
  return {
    target: 0,
    value: 0,
    update(dt) {
      this.value += (this.target - this.value) * (1 - Math.exp(-8 * dt));
      return this;
    }
  };
}

/* 1. Tow hook ------------------------------------------------------------- */
export async function createHookIcon(stage, THREE) {
  const { scene } = stage;
  miniSetup(stage, THREE, { cameraPos: [0, 0.35, 3.2] });

  const grp = new THREE.Group();
  scene.add(grp);

  const chrome = new THREE.MeshStandardMaterial({ color: 0xc6ccd6, metalness: 1, roughness: 0.18 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x737b87, metalness: 0.9, roughness: 0.32 });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 14, 1), chrome);
  shaft.position.y = 0.32;
  grp.add(shaft);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 14, 1), steel);
  collar.position.y = 0.02;
  grp.add(collar);

  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.085, 10, 20), chrome);
  eye.position.y = 1.14;
  eye.rotation.y = Math.PI / 2;
  grp.add(eye);

  const hookCurve = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.115, 10, 22, Math.PI * 1.6), chrome);
  hookCurve.position.set(0, -0.62, 0);
  hookCurve.rotation.y = Math.PI / 2;
  hookCurve.rotation.z = -0.3;
  grp.add(hookCurve);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 10), chrome);
  tip.position.set(0, -1.02, 0.28);
  tip.rotation.x = -0.5;
  grp.add(tip);

  grp.rotation.z = 0.18;

  stage.onFrame = (dt, elapsed) => {
    const hover = stage.hover ? stage.hover.update(dt).value : 0;

    grp.rotation.y = Math.sin(elapsed * 0.5) * 0.24 + hover * 0.5;
    grp.rotation.x = -0.12 + hover * 0.16;
    grp.position.y = Math.sin(elapsed * 1.1) * 0.05;
    grp.scale.setScalar(1 + hover * 0.06);
    chrome.roughness = 0.18 - hover * 0.09;
  };

  return {
    dispose: () => {
      chrome.dispose();
      steel.dispose();
    }
  };
}

/* 2. Windshield glass ----------------------------------------------------- */
export async function createGlassIcon(stage, THREE) {
  const { scene } = stage;
  miniSetup(stage, THREE, { cameraPos: [0.4, 0.3, 3.1], accent: 0x66a8ff });

  const grp = new THREE.Group();
  scene.add(grp);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9dc4ea,
    metalness: 0.65,
    roughness: 0.06,
    transparent: true,
    opacity: 0.72
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x101319, metalness: 0.5, roughness: 0.6 });

  const shape = new THREE.Shape();
  shape.moveTo(-1.05, -0.72);
  shape.lineTo(1.05, -0.72);
  shape.lineTo(0.82, 0.72);
  shape.lineTo(-0.82, 0.72);
  shape.closePath();

  const glassGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 1
  });
  glassGeo.center();

  const glass = new THREE.Mesh(glassGeo, glassMat);
  grp.add(glass);

  const frameGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 1 });
  frameGeo.center();
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.scale.set(1.1, 1.14, 1);
  frame.position.z = -0.05;
  grp.add(frame);

  /* sweeping reflection highlight */
  const sweepTex = radialGlowTexture(THREE, 'rgba(255,255,255,0.8)', 128);
  track(stage, { dispose: () => sweepTex.dispose() });

  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 2.4),
    new THREE.MeshBasicMaterial({
      map: sweepTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  sweep.position.z = 0.09;
  sweep.rotation.z = Math.PI / 2;
  grp.add(sweep);

  stage.onFrame = (dt, elapsed) => {
    const hover = stage.hover ? stage.hover.update(dt).value : 0;

    grp.rotation.y = -0.34 + Math.sin(elapsed * 0.45) * 0.16 + hover * 0.5;
    grp.rotation.x = 0.06 - hover * 0.1;
    grp.position.y = Math.sin(elapsed * 0.9) * 0.04;
    grp.scale.setScalar(1 + hover * 0.05);

    // reflection travels across the glass
    const travel = Math.sin(elapsed * 1.2) * (0.35 + hover * 0.75);
    sweep.position.x = travel * 1.5;
    sweep.material.opacity = 0.1 + hover * 0.5;
    glassMat.opacity = 0.72 + hover * 0.16;
  };

  return {
    dispose: () => {
      glassGeo.dispose();
      frameGeo.dispose();
      glassMat.dispose();
      frameMat.dispose();
    }
  };
}

/* 3. Emergency beacon ---------------------------------------------------- */
export async function createBeaconIcon(stage, THREE) {
  const { scene } = stage;
  miniSetup(stage, THREE, { cameraPos: [1.5, 1.1, 3.1] });

  const grp = new THREE.Group();
  scene.add(grp);

  const dark = new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.7, roughness: 0.34 });
  const red = new THREE.MeshStandardMaterial({
    color: 0xff2d20,
    emissive: 0xff2d20,
    emissiveIntensity: 1.3,
    metalness: 0.25,
    roughness: 0.4
  });
  const amber = new THREE.MeshStandardMaterial({
    color: 0xffb020,
    emissive: 0xffb020,
    emissiveIntensity: 1,
    metalness: 0.25,
    roughness: 0.4
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.16, 20, 1), dark);
  base.position.y = -0.86;
  grp.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.72, 18, 1), dark);
  body.position.y = -0.4;
  grp.add(body);

  const lenses = [-0.24, 0.24].map((x) => {
    const lens = new THREE.Mesh(
      roundedBox(THREE, { width: 0.4, height: 0.5, depth: 0.84, radius: 0.12 }),
      red.clone()
    );
    lens.position.set(x, 0.4, 0);
    grp.add(lens);
    return lens;
  });

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.2, 16, 1), dark);
  cap.position.y = 0.76;
  grp.add(cap);

  const pods = [-0.5, 0.5].map((x) => {
    const pod = new THREE.Mesh(
      roundedBox(THREE, { width: 0.18, height: 0.28, depth: 0.28, radius: 0.06 }),
      amber.clone()
    );
    pod.position.set(x, 0.36, 0);
    grp.add(pod);
    return pod;
  });

  const glowTex = radialGlowTexture(THREE, 'rgba(255,59,31,0.85)', 96);
  track(stage, { dispose: () => glowTex.dispose() });

  const halos = lenses.map((lens) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff3b1f,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    sprite.position.copy(lens.position);
    sprite.scale.set(1.8, 1.8, 1);
    grp.add(sprite);
    return sprite;
  });

  stage.onFrame = (dt, elapsed) => {
    const hover = stage.hover ? stage.hover.update(dt).value : 0;

    grp.rotation.y = -0.2 + Math.sin(elapsed * 0.5) * 0.2 + hover * 0.45;
    grp.position.y = Math.sin(elapsed * 1.0) * 0.05;
    grp.scale.setScalar(1 + hover * 0.05);

    const pulse = Math.sin(elapsed * 2.2) * 0.5 + 0.5;
    const boost = 1 + hover * 0.9;

    lenses[0].material.emissiveIntensity = (0.8 + pulse * 1.8) * boost;
    lenses[1].material.emissiveIntensity = (0.8 + (1 - pulse) * 1.8) * boost;
    pods.forEach((pod, i) => {
      pod.material.emissiveIntensity = 0.7 + (i === 0 ? pulse : 1 - pulse) * 0.8 * boost;
    });

    halos.forEach((sprite, i) => {
      const p = i === 0 ? pulse : 1 - pulse;
      sprite.material.opacity = (0.12 + p * 0.42) * (1 + hover * 0.6);
      const scale = 1.3 + p * 0.8 + hover * 0.5;
      sprite.scale.set(scale, scale, 1);
    });
  };

  return {
    dispose: () => {
      dark.dispose();
      red.dispose();
      amber.dispose();
      lenses.forEach((l) => l.material.dispose());
      pods.forEach((p) => p.material.dispose());
    }
  };
}

/* 4. Location pin -------------------------------------------------------- */
export async function createPinIcon(stage, THREE) {
  const { scene } = stage;
  miniSetup(stage, THREE, { cameraPos: [0, 0.3, 3.4], accent: 0xff6a1a });

  const grp = new THREE.Group();
  scene.add(grp);

  const red = new THREE.MeshStandardMaterial({
    color: 0xff2d20,
    emissive: 0x8a1109,
    emissiveIntensity: 0.5,
    metalness: 0.55,
    roughness: 0.28
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101319, metalness: 0.6, roughness: 0.4 });
  const ring = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff6a1a,
    emissiveIntensity: 0.7,
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: 0.85
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 16), red);
  head.position.y = 0.5;
  grp.add(head);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.96, 20), red);
  tail.position.y = -0.28;
  tail.rotation.y = Math.PI / 4;
  grp.add(tail);

  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 16, 1), dark);
  hole.position.y = 0.5;
  hole.rotation.x = Math.PI / 2;
  grp.add(hole);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 28), ring);
  halo.position.y = -0.86;
  halo.rotation.x = Math.PI / 2;
  grp.add(halo);

  stage.onFrame = (dt, elapsed) => {
    const hover = stage.hover ? stage.hover.update(dt).value : 0;

    grp.rotation.y = Math.sin(elapsed * 0.42) * 0.42 + hover * 0.4;
    grp.position.y = Math.sin(elapsed * 1.05) * 0.07;
    grp.scale.setScalar(0.92 + hover * 0.08);

    const pulse = Math.sin(elapsed * 1.7) * 0.5 + 0.5;
    halo.scale.setScalar(1 + pulse * 0.16 + hover * 0.1);
    ring.opacity = 0.5 + pulse * 0.35;
  };

  return {
    dispose: () => {
      red.dispose();
      dark.dispose();
      ring.dispose();
    }
  };
}

/* Factory lookup used by app.js ------------------------------------------ */
export const MINI_ICONS = {
  hook: createHookIcon,
  glass: createGlassIcon,
  beacon: createBeaconIcon,
  pin: createPinIcon
};