/**
 * glass.js
 * Interactive automotive windshield for the vehicle-glass section.
 *
 * - realistic transparent / reflective glass with a visible laminate edge
 * - cursor movement drives a real light sweep (moving specular highlight)
 * - click tips the glass and reveals "Automotive Glass Services"
 */

import { trapezoid, radialGlowTexture, createDragController, track } from './scene-utils.js';

export async function createGlassScene(stage, THREE, options = {}) {
  const { onReveal = null } = options;
  const { scene, camera, profile } = stage;

  /* environment: bright procedural studio so the glass has something to mirror */
  if (profile.reflections) {
    const pmrem = new THREE.PMREMGenerator(stage.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x07090d);

    const softbox = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    softbox.position.set(-4, 5, 4);
    softbox.lookAt(0, 0, 0);
    envScene.add(softbox);

    const strip = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.6), new THREE.MeshBasicMaterial({ color: 0xffe9d6 }));
    strip.position.set(0, 6.5, 0);
    strip.lookAt(0, 0, 0);
    envScene.add(strip);

    const warm = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: 0x7a2418 }));
    warm.position.set(5.5, 1.2, -3);
    warm.lookAt(0, 0, 0);
    envScene.add(warm);

    const env = pmrem.fromScene(envScene, 0.03).texture;
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

  /* lighting */
  scene.add(new THREE.HemisphereLight(0x9fb6d6, 0x08090c, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-3.6, 5, 4.4);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xff7a2a, 1.1);
  rim.position.set(4.4, 1.6, -3.6);
  scene.add(rim);

  /* cursor-following light sweep */
  const sweepLight = new THREE.PointLight(0xdcecff, 6, 14, 2);
  sweepLight.position.set(0, 1.2, 3);
  scene.add(sweepLight);

  const sweepGlowTex = radialGlowTexture(THREE, 'rgba(200,230,255,0.7)', 128);
  track(stage, { dispose: () => sweepGlowTex.dispose() });

  const sweepGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sweepGlowTex,
      color: 0x9fd0ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  sweepGlow.scale.set(3.4, 3.4, 1);
  scene.add(sweepGlow);

  /* windshield ---------------------------------------------------------- */
  const glassGroup = new THREE.Group();
  scene.add(glassGroup);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fb4d8,
    metalness: 0.05,
    roughness: 0.04,
    transmission: profile.reflections ? 0.9 : 0.4,
    thickness: 0.35,
    ior: 1.52,
    reflectivity: 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transparent: true,
    opacity: profile.reflections ? 0.6 : 0.72,
    side: THREE.DoubleSide,
    envMapIntensity: profile.reflections ? 1.6 : 0.5
  });

  const glassGeo = trapezoid(THREE, {
    bottomWidth: 3.2,
    topWidth: 2.72,
    height: 1.52,
    depth: 0.07
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.castShadow = profile.shadows;
  glassGroup.add(glass);

  /* laminate edge glow reads as the glass edge */
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x2e3a4a,
    emissive: 0x2f6ea8,
    emissiveIntensity: 0.55,
    metalness: 0.7,
    roughness: 0.3
  });

  const edge = new THREE.Mesh(
    trapezoid(THREE, { bottomWidth: 3.34, topWidth: 2.86, height: 1.66, depth: 0.05 }),
    edgeMat
  );
  edge.position.z = -0.012;
  glassGroup.add(edge);

  /* rubber seal / A-pillar surround */
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, metalness: 0.2, roughness: 0.85 });
  const seal = new THREE.Mesh(
    trapezoid(THREE, { bottomWidth: 3.52, topWidth: 3.04, height: 1.84, depth: 0.14 }),
    sealMat
  );
  seal.position.z = -0.05;
  glassGroup.add(seal);

  /* wiper arc detail */
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(1.02, 0.012, 6, 26, Math.PI * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x8d97a6, metalness: 0.9, roughness: 0.35 })
  );
  arc.position.set(1.56, -0.6, 0.06);
  arc.rotation.z = -0.5;
  glassGroup.add(arc);

  /* additive gradient plane that slides across the glass = reflection sweep */
  const sweepTex = radialGlowTexture(THREE, 'rgba(255,255,255,0.75)', 256);
  track(stage, { dispose: () => sweepTex.dispose() });

  const sweepPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 3.2),
    new THREE.MeshBasicMaterial({
      map: sweepTex,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  sweepPlane.position.set(0, 0, 0.09);
  sweepPlane.rotation.z = Math.PI / 2;
  glassGroup.add(sweepPlane);

  /* camera -------------------------------------------------------------- */
  const baseCam = new THREE.Vector3(0, 0.35, 5.6);
  camera.position.copy(baseCam);
  camera.lookAt(0, 0, 0);

  const drag = createDragController(stage, {
    maxYaw: 0.34,
    maxPitch: 0,
    parallax: 0.07,
    autoRotate: 0
  });

  /* click-to-reveal + cursor light sweep -------------------------------- */
  let revealed = false;
  let revealProgress = 0;
  const baseRotationZ = -0.045;

  const sweepTarget = { x: 0, y: 0, glow: 0.25 };
  const sweepCurrent = { x: 0, y: 0, glow: 0 };

  const onMove = (e) => {
    const rect = stage.container.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / Math.max(rect.width, 1);
    const ny = (e.clientY - rect.top) / Math.max(rect.height, 1);
    sweepTarget.x = (nx - 0.5) * 4.6;
    sweepTarget.y = (0.5 - ny) * 2.6;
    sweepTarget.glow = 1;
  };

  const onLeave = () => {
    sweepTarget.x = 0;
    sweepTarget.y = 0;
    sweepTarget.glow = 0.25;
  };

  const onClick = () => {
    revealed = !revealed;
    stage.container.classList.toggle('is-revealed', revealed);
    if (onReveal) onReveal(revealed);
  };

  stage.container.addEventListener('pointermove', onMove, { passive: true });
  stage.container.addEventListener('pointerleave', onLeave);
  stage.container.addEventListener('click', onClick);
  stage._listeners.push(() => {
    stage.container.removeEventListener('pointermove', onMove);
    stage.container.removeEventListener('pointerleave', onLeave);
    stage.container.removeEventListener('click', onClick);
  });

  /* frame loop ---------------------------------------------------------- */
  const dampVal = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

  stage.onFrame = (dt, elapsed) => {
    const st = drag.update(dt);

    glassGroup.rotation.y = st.yaw;
    glassGroup.rotation.x = st.pitch * 0.7;
    glassGroup.rotation.z = baseRotationZ + revealProgress * 0.09;

    revealProgress = dampVal(revealProgress, revealed ? 1 : 0, 5, dt);
    glassGroup.position.y = Math.sin(elapsed * 0.8) * 0.03 + revealProgress * 0.05;
    glassGroup.position.z = revealProgress * 0.22;

    // light sweep follows the cursor across the glass surface
    sweepCurrent.x = dampVal(sweepCurrent.x, sweepTarget.x, 5, dt);
    sweepCurrent.y = dampVal(sweepCurrent.y, sweepTarget.y, 5, dt);
    sweepCurrent.glow = dampVal(sweepCurrent.glow, sweepTarget.glow, 4, dt);

    sweepPlane.position.x = sweepCurrent.x;
    sweepPlane.position.y = sweepCurrent.y;
    sweepPlane.material.opacity = 0.14 + sweepCurrent.glow * 0.4;

    sweepGlow.position.set(sweepCurrent.x, sweepCurrent.y, 0.6);
    sweepGlow.material.opacity = 0.08 + sweepCurrent.glow * 0.32;

    sweepLight.position.set(sweepCurrent.x, sweepCurrent.y + 0.5, 2.6);
    sweepLight.intensity = 2 + sweepCurrent.glow * 10;

    // subtle edge glow breathing
    edgeMat.emissiveIntensity = 0.45 + Math.sin(elapsed * 1.6) * 0.16 + revealProgress * 0.5;

    camera.position.x = baseCam.x + st.pointerX * 0.5;
    camera.position.y = baseCam.y + st.pointerY * 0.3;
    camera.lookAt(0, revealProgress * 0.08, 0);
  };

  return {
    dispose: () => {
      glassGeo.dispose();
      glassMat.dispose();
      edgeMat.dispose();
      sealMat.dispose();
    }
  };
}