import * as THREE from 'three';

export const WORLD_RADIUS = 115;

export const PYRAMID_SPECS = [
  { x: 0, z: -64, base: 44, height: 32, hasEntrance: true, name: 'Gran Pirámide' },
  { x: -58, z: -38, base: 30, height: 22, hasEntrance: false, name: 'Pirámide del Oeste' },
  { x: 60, z: -24, base: 32, height: 24, hasEntrance: false, name: 'Pirámide del Este' },
];

export const OASIS_POS = { x: -30, z: 24, radius: 10.5 };

// Deterministic dune height function with smooth plateaus around spawn, pyramids, and oasis
export function getTerrainHeight(x, z) {
  let h =
    Math.sin(x * 0.042 + 0.5) * Math.cos(z * 0.036) * 2.1 +
    Math.sin(x * 0.095 - z * 0.07) * 0.72 +
    Math.cos((x + z) * 0.025) * 1.15;

  // Flatten around spawn (0, 10)
  const dSpawn = Math.hypot(x, z - 10);
  const spawnFlat = THREE.MathUtils.smoothstep(dSpawn, 6, 20);
  h *= spawnFlat;

  // Flatten around pyramids
  for (const p of PYRAMID_SPECS) {
    const dp = Math.hypot(x - p.x, z - p.z);
    const flat = THREE.MathUtils.smoothstep(dp, p.base * 0.55, p.base * 0.95);
    h *= flat;
  }

  // Slight depression for oasis basin
  const dOasis = Math.hypot(x - OASIS_POS.x, z - OASIS_POS.z);
  if (dOasis < OASIS_POS.radius + 9) {
    const basin = 1 - THREE.MathUtils.smoothstep(dOasis, OASIS_POS.radius * 0.65, OASIS_POS.radius + 8);
    h = h * (1 - basin) - basin * 1.05;
  }

  return h;
}

// Seeded PRNG so desert rock layout is balanced & reproducible
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDesertWorld(scene, textures) {
  const colliders = []; // { type: 'circle'|'box', x, z, radius | halfX, halfZ }
  const torchLights = [];
  const palmFronds = [];

  // 1. Sky Dome (warm Egyptian desert gradient)
  const skyGeo = new THREE.SphereGeometry(280, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2a69a8) },
      midColor: { value: new THREE.Color(0xe8b578) },
      horizonColor: { value: new THREE.Color(0xf6d39c) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.24, max(h, 0.0)));
        col = mix(col, topColor, smoothstep(0.18, 0.72, max(h, 0.0)));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Blazing Desert Sun disc + halo
  const sunDir = new THREE.Vector3(65, 58, -95).normalize();
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(12, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff5cc })
  );
  sunDisc.position.copy(sunDir).multiplyScalar(230);
  scene.add(sunDisc);

  // 2. Desert Terrain Mesh
  const terrainSize = 270;
  const segments = 128;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, getTerrainHeight(vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.sandMap,
    bumpMap: textures.sandBump,
    bumpScale: 0.35,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 3. Pyramids
  const pyramidMat = new THREE.MeshStandardMaterial({
    map: textures.pyramidMap,
    bumpMap: textures.pyramidBump,
    bumpScale: 0.45,
    roughness: 0.88,
    metalness: 0.04,
  });

  const goldCapMat = new THREE.MeshStandardMaterial({
    color: 0xf7c948,
    roughness: 0.28,
    metalness: 0.85,
    emissive: 0x5c3c04,
    emissiveIntensity: 0.25,
  });

  for (const spec of PYRAMID_SPECS) {
    const group = new THREE.Group();
    const baseY = getTerrainHeight(spec.x, spec.z);
    group.position.set(spec.x, baseY, spec.z);

    // 4-sided square pyramid (ConeGeometry with 4 radial segments rotated 45 deg)
    const radius = (spec.base / 2) * Math.SQRT2;
    const bodyGeo = new THREE.ConeGeometry(radius, spec.height, 4, 1);
    bodyGeo.rotateY(Math.PI / 4);
    const bodyMesh = new THREE.Mesh(bodyGeo, pyramidMat);
    bodyMesh.position.y = spec.height / 2 - 0.8;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Stepped stone foundation rim
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(spec.base + 2.4, 2.2, spec.base + 2.4),
      pyramidMat
    );
    plinth.position.y = 0.2;
    plinth.receiveShadow = true;
    group.add(plinth);

    // Golden Pyramidion capstone
    const capH = spec.height * 0.14;
    const capR = radius * 0.145;
    const capGeo = new THREE.ConeGeometry(capR, capH, 4, 1);
    capGeo.rotateY(Math.PI / 4);
    const capMesh = new THREE.Mesh(capGeo, goldCapMat);
    capMesh.position.y = spec.height - capH / 2 - 0.72;
    capMesh.castShadow = true;
    group.add(capMesh);

    // Entrance temple gateway on the Great Pyramid
    if (spec.hasEntrance) {
      const gateZ = spec.base / 2 + 1.5;
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x160f09, roughness: 1 });
      const stoneMat = new THREE.MeshStandardMaterial({
        map: textures.hieroMap,
        roughness: 0.82,
      });

      const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7.2, 3.4), stoneMat);
      leftPillar.position.set(-3.2, 3.2, gateZ);
      leftPillar.castShadow = true;
      leftPillar.receiveShadow = true;
      group.add(leftPillar);

      const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7.2, 3.4), stoneMat);
      rightPillar.position.set(3.2, 3.2, gateZ);
      rightPillar.castShadow = true;
      rightPillar.receiveShadow = true;
      group.add(rightPillar);

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.2, 3.8), stoneMat);
      lintel.position.set(0, 7.5, gateZ);
      lintel.castShadow = true;
      group.add(lintel);

      const doorway = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6.2, 2.2), darkMat);
      doorway.position.set(0, 2.8, gateZ - 0.8);
      group.add(doorway);

      // Two fire braziers flanking the Great Pyramid entrance
      [-5.8, 5.8].forEach((bx) => {
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.65, 2.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.7, metalness: 0.4 })
        );
        bowl.position.set(bx, 1.0, gateZ + 3.2);
        bowl.castShadow = true;
        group.add(bowl);

        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.55, 1.3, 6),
          new THREE.MeshBasicMaterial({ color: 0xff9d2e })
        );
        flame.position.set(bx, 2.55, gateZ + 3.2);
        group.add(flame);

        const light = new THREE.PointLight(0xff8c24, 18, 22, 1.5);
        light.position.set(bx, 3.1, gateZ + 3.2);
        group.add(light);
        torchLights.push({ light, flame, baseIntensity: 18, phase: Math.random() * 10 });
      });
    }

    scene.add(group);
    colliders.push({
      type: 'box',
      x: spec.x,
      z: spec.z,
      halfX: spec.base / 2 + 1.1,
      halfZ: spec.base / 2 + 1.1,
    });
  }

  // 4. Obelisks & Ancient Ruin Columns along the ceremonial avenue
  const hieroMat = new THREE.MeshStandardMaterial({
    map: textures.hieroMap,
    roughness: 0.8,
  });

  function createObelisk(x, z, scale = 1) {
    const g = new THREE.Group();
    const y = getTerrainHeight(x, z);
    g.position.set(x, y, z);

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6 * scale, 1.2 * scale, 2.6 * scale), hieroMat);
    base.position.y = 0.5 * scale;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58 * scale, 1.0 * scale, 9.5 * scale, 4),
      hieroMat
    );
    shaft.rotation.y = Math.PI / 4;
    shaft.position.y = 5.6 * scale;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    g.add(shaft);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.58 * scale, 1.4 * scale, 4),
      goldCapMat
    );
    tip.rotation.y = Math.PI / 4;
    tip.position.y = 11.05 * scale;
    g.add(tip);

    scene.add(g);
    colliders.push({ type: 'circle', x, z, radius: 1.5 * scale });
  }

  createObelisk(-9, -22, 1.15);
  createObelisk(9, -22, 1.15);
  createObelisk(-12, -2, 0.95);
  createObelisk(12, -2, 0.95);
  createObelisk(32, 14, 1.0);
  createObelisk(-42, -12, 0.9);

  // Ancient broken columns (ruins temple circle at (36, 24))
  const ruinCenter = { x: 36, z: 24 };
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const cx = ruinCenter.x + Math.cos(ang) * 9.5;
    const cz = ruinCenter.z + Math.sin(ang) * 9.5;
    const h = i % 2 === 0 ? 6.2 : 3.4;
    const cy = getTerrainHeight(cx, cz);

    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.88, h, 10),
      hieroMat
    );
    col.position.set(cx, cy + h / 2 - 0.3, cz);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);
    colliders.push({ type: 'circle', x: cx, z: cz, radius: 1.05 });
  }

  // 5. Oasis (water pool + palm trees)
  const oasisWaterY = getTerrainHeight(OASIS_POS.x, OASIS_POS.z) + 0.55;
  const waterGeo = new THREE.CircleGeometry(OASIS_POS.radius - 0.8, 32);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1ea7c9,
    emissive: 0x064259,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(OASIS_POS.x, oasisWaterY, OASIS_POS.z);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  // Lush grass rim around oasis
  const grassRing = new THREE.Mesh(
    new THREE.RingGeometry(OASIS_POS.radius - 1.3, OASIS_POS.radius + 3.0, 32),
    new THREE.MeshStandardMaterial({ color: 0x5c7c32, roughness: 0.95 })
  );
  grassRing.rotation.x = -Math.PI / 2;
  grassRing.position.set(OASIS_POS.x, oasisWaterY - 0.04, OASIS_POS.z);
  grassRing.receiveShadow = true;
  scene.add(grassRing);

  // Palm trees around oasis
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c5333, roughness: 0.92 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x3b7a2c,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });

  const palmAngles = [0.4, 1.3, 2.35, 3.6, 4.7, 5.55];
  palmAngles.forEach((ang, idx) => {
    const dist = OASIS_POS.radius + 1.4 + (idx % 2) * 1.6;
    const px = OASIS_POS.x + Math.cos(ang) * dist;
    const pz = OASIS_POS.z + Math.sin(ang) * dist;
    const py = getTerrainHeight(px, pz);

    const palm = new THREE.Group();
    palm.position.set(px, py, pz);

    const height = 6.5 + (idx % 3) * 1.4;
    const leanX = Math.cos(ang) * 0.14;
    const leanZ = Math.sin(ang) * 0.14;

    // Segmented curved trunk
    let curX = 0;
    let curY = 0;
    let curZ = 0;
    const segs = 5;
    for (let s = 0; s < segs; s++) {
      const segH = height / segs;
      const rBot = 0.34 - s * 0.035;
      const rTop = 0.30 - s * 0.035;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH + 0.12, 7), trunkMat);
      seg.position.set(curX, curY + segH / 2, curZ);
      seg.rotation.z = -leanX * (s + 1) * 0.3;
      seg.rotation.x = leanZ * (s + 1) * 0.3;
      seg.castShadow = true;
      palm.add(seg);
      curX += leanX * segH * 0.45;
      curY += segH;
      curZ += leanZ * segH * 0.45;
    }

    const crown = new THREE.Group();
    crown.position.set(curX, curY, curZ);
    for (let f = 0; f < 7; f++) {
      const fa = (f / 7) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.75, 3.8, 4);
      frondGeo.scale(1, 1, 0.2);
      frondGeo.translate(0, 1.9, 0);
      frondGeo.rotateX(Math.PI * 0.62);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.rotation.y = fa;
      frond.castShadow = true;
      crown.add(frond);
    }
    palm.add(crown);
    palmFronds.push({ crown, phase: idx * 1.1 });

    scene.add(palm);
    colliders.push({ type: 'circle', x: px, z: pz, radius: 0.55 });
  });

  // 6. Desert Rocks, Boulders & Sandstone Outcrops
  const rand = mulberry32(4219);
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rockMap,
    roughness: 0.94,
    metalness: 0.03,
    flatShading: true,
  });

  const rockPoints = [];
  for (let i = 0; i < 64; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 16 + rand() * (WORLD_RADIUS - 22);
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;

    // Keep clear of spawn, oasis, pyramids, and ceremonial avenue
    if (Math.hypot(rx, rz - 10) < 12) continue;
    if (Math.hypot(rx - OASIS_POS.x, rz - OASIS_POS.z) < OASIS_POS.radius + 5) continue;
    if (Math.abs(rx) < 9 && rz < 6 && rz > -36) continue;
    let blocked = false;
    for (const p of PYRAMID_SPECS) {
      if (Math.abs(rx - p.x) < p.base / 2 + 5 && Math.abs(rz - p.z) < p.base / 2 + 5) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const scale = 1.1 + rand() * 2.4;
    const geo = new THREE.DodecahedronGeometry(scale, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      const n = 0.8 + 0.36 * Math.sin(vx * 2.1 + i) * Math.cos(vz * 1.9 - i);
      pos.setXYZ(v, vx * n * 1.15, vy * n * 0.72, vz * n);
    }
    geo.computeVertexNormals();

    const rock = new THREE.Mesh(geo, rockMat);
    const ry = getTerrainHeight(rx, rz);
    rock.position.set(rx, ry + scale * 0.35, rz);
    rock.rotation.set(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);

    colliders.push({ type: 'circle', x: rx, z: rz, radius: scale * 0.92 });
    rockPoints.push({ x: rx, z: rz, radius: scale });

    // Small companion pebbles near larger boulders
    if (scale > 2.2) {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(scale * 0.38, 0), rockMat);
      const px = rx + Math.cos(i) * (scale + 0.6);
      const pz = rz + Math.sin(i) * (scale + 0.6);
      pebble.position.set(px, getTerrainHeight(px, pz) + scale * 0.16, pz);
      pebble.receiveShadow = true;
      scene.add(pebble);
    }
  }

  // 7. Drifting Desert Sand Dust Particles
  const dustCount = 260;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 140;
    dustPositions[i * 3 + 1] = 0.6 + Math.random() * 14;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xf7dca3,
    size: 0.28,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPoints);

  function updateWorld(dt, elapsed, playerPos) {
    // Flicker pyramid entrance torches
    for (const t of torchLights) {
      const flicker = Math.sin(elapsed * 11 + t.phase) * 2.4 + Math.cos(elapsed * 19 + t.phase) * 1.4;
      t.light.intensity = t.baseIntensity + flicker;
      const s = 1 + Math.sin(elapsed * 14 + t.phase) * 0.12;
      t.flame.scale.set(s, 1 + Math.cos(elapsed * 17 + t.phase) * 0.18, s);
    }

    // Gentle desert wind in palm fronds
    for (const p of palmFronds) {
      p.crown.rotation.z = Math.sin(elapsed * 1.7 + p.phase) * 0.06;
      p.crown.rotation.x = Math.cos(elapsed * 1.3 + p.phase) * 0.04;
    }

    // Water shimmer
    waterMat.emissiveIntensity = 0.3 + Math.sin(elapsed * 2.5) * 0.08;

    // Move drifting dust around player
    const arr = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3] += dt * 4.5;
      arr[i * 3 + 1] += Math.sin(elapsed + i) * dt * 0.25;
      arr[i * 3 + 2] += dt * 1.4;

      if (arr[i * 3] > playerPos.x + 70) arr[i * 3] -= 140;
      if (arr[i * 3] < playerPos.x - 70) arr[i * 3] += 140;
      if (arr[i * 3 + 2] > playerPos.z + 70) arr[i * 3 + 2] -= 140;
      if (arr[i * 3 + 2] < playerPos.z - 70) arr[i * 3 + 2] += 140;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  return { colliders, rockPoints, updateWorld };
}
