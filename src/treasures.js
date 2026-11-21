import * as THREE from 'three';
import { getTerrainHeight } from './world.js';

const TREASURE_DEFINITIONS = [
  { x: 0, z: -34, type: 'mask', name: 'Máscara de Oro del Faraón', value: 500 },
  { x: -16, z: -18, type: 'ankh', name: 'Anj Sagrado Dorado', value: 250 },
  { x: 18, z: -15, type: 'scarab', name: 'Escarabajo Real', value: 250 },
  { x: 36, z: 24, type: 'chest', name: 'Cofre del Templo en Ruinas', value: 400 },
  { x: -38, z: -18, type: 'chalice', name: 'Cáliz Canopo de Oro', value: 300 },
  { x: -58, z: -14, type: 'ankh', name: 'Anj de la Pirámide Oeste', value: 300 },
  { x: 42, z: -38, type: 'scarab', name: 'Amuleto Solar de Ra', value: 300 },
  { x: 60, z: 2, type: 'chest', name: 'Cofre de la Pirámide Este', value: 400 },
  { x: 14, z: 46, type: 'chalice', name: 'Copa Ceremonial del Nilo', value: 250 },
  { x: -16, z: 54, type: 'scarab', name: 'Escarabajo de Lapislázuli', value: 300 },
  { x: -64, z: 32, type: 'chest', name: 'Cofre de las Dunas Occidentales', value: 350 },
  { x: 64, z: 42, type: 'mask', name: 'Reliquia del Visir Antiguo', value: 450 },
];

const SUPPLY_LOCATIONS = [
  { x: -8, z: -6, kind: 'water' },
  { x: 24, z: 6, kind: 'water' },
  { x: -45, z: -3, kind: 'herb' },
  { x: 45, z: -14, kind: 'water' },
  { x: 6, z: 36, kind: 'herb' },
  { x: -48, z: 44, kind: 'water' },
  { x: 48, z: 36, kind: 'herb' },
];

export class TreasureManager {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    this.treasures = [];
    this.supplies = [];

    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xffce45,
      emissive: 0x6b4503,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.9,
    });
    this.gemBlueMat = new THREE.MeshStandardMaterial({
      color: 0x22a6f2,
      emissive: 0x0a497a,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.3,
    });
    this.gemRedMat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      emissive: 0x660b14,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3718, roughness: 0.85 });
  }

  getTotalCount() {
    return TREASURE_DEFINITIONS.length;
  }

  reset() {
    for (const t of this.treasures) this.scene.remove(t.group);
    for (const s of this.supplies) this.scene.remove(s.group);
    this.treasures = [];
    this.supplies = [];

    for (const def of TREASURE_DEFINITIONS) {
      const group = this._createTreasureMesh(def.type);
      const y = getTerrainHeight(def.x, def.z);
      group.position.set(def.x, y, def.z);
      this.scene.add(group);
      this.treasures.push({
        ...def,
        group,
        baseY: y,
        collected: false,
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (const sup of SUPPLY_LOCATIONS) {
      this.spawnSupply(sup.x, sup.z, sup.kind);
    }
  }

  spawnSupply(x, z, kind = 'water') {
    const group = new THREE.Group();
    const y = getTerrainHeight(x, z);
    group.position.set(x, y, z);

    const item = new THREE.Group();
    if (kind === 'water') {
      // Leather/turquoise desert canteen flask
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0b527a,
          emissiveIntensity: 0.5,
          roughness: 0.3,
        })
      );
      body.rotation.x = Math.PI / 2;
      item.add(body);

      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.09, 0.18, 8),
        this.goldMat
      );
      neck.position.y = 0.32;
      item.add(neck);
    } else {
      // Glowing green desert healing herb
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x0b5c3e,
        emissiveIntensity: 0.5,
        roughness: 0.5,
      });
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), leafMat);
        leaf.rotation.z = 0.45;
        leaf.rotation.y = (i / 4) * Math.PI * 2;
        leaf.position.y = 0.22;
        item.add(leaf);
      }
    }

    item.position.y = 0.72;
    group.add(item);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 16),
      new THREE.MeshBasicMaterial({
        color: kind === 'water' ? 0x38bdf8 : 0x34d399,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);

    this.scene.add(group);
    this.supplies.push({
      x,
      z,
      kind,
      group,
      item,
      ring,
      collected: false,
      phase: Math.random() * Math.PI * 2,
    });
  }

  _createTreasureMesh(type) {
    const group = new THREE.Group();
    const relic = new THREE.Group();
    relic.name = 'relic';

    if (type === 'chest') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.7), this.woodMat);
      box.castShadow = true;
      relic.add(box);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.06, 8, 1, false, 0, Math.PI), this.woodMat);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.31;
      relic.add(lid);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.75), this.goldMat);
      trim.position.y = 0.24;
      relic.add(trim);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), this.gemBlueMat);
      gem.position.set(0, 0.24, 0.4);
      relic.add(gem);
    } else if (type === 'ankh') {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.075, 8, 16), this.goldMat);
      loop.position.y = 0.42;
      relic.add(loop);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.72, 0.1), this.goldMat);
      stem.position.y = -0.14;
      relic.add(stem);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.13, 0.1), this.goldMat);
      bar.position.y = 0.08;
      relic.add(bar);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), this.gemRedMat);
      gem.position.set(0, 0.08, 0.08);
      relic.add(gem);
    } else if (type === 'scarab') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), this.gemBlueMat);
      body.scale.set(0.85, 0.55, 1.25);
      relic.add(body);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.26), this.goldMat);
      wingL.position.set(-0.42, 0.02, 0);
      wingL.rotation.z = 0.2;
      relic.add(wingL);
      const wingR = wingL.clone();
      wingR.position.x = 0.42;
      wingR.rotation.z = -0.2;
      relic.add(wingR);
    } else if (type === 'mask') {
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.36), this.goldMat);
      relic.add(face);
      const headdress = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.85, 4), this.gemBlueMat);
      headdress.position.set(0, 0.05, -0.1);
      headdress.rotation.y = Math.PI / 4;
      relic.add(headdress);
      const beard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.32, 6), this.goldMat);
      beard.position.set(0, -0.45, 0.12);
      relic.add(beard);
    } else {
      // Golden Chalice
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 0.16, 12), this.goldMat);
      base.position.y = -0.32;
      relic.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 8), this.goldMat);
      stem.position.y = -0.06;
      relic.add(stem);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 0.42, 12), this.goldMat);
      cup.position.y = 0.3;
      relic.add(cup);
    }

    relic.position.y = 1.05;
    group.add(relic);

    // Golden ground halo & beacon pillar so explorer can spot glints across dunes
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.02, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffd54f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.62,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    ring.name = 'ring';
    group.add(ring);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.65, 5.5, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe28a,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 2.8;
    group.add(beam);

    return group;
  }

  getActiveTreasurePositions() {
    return this.treasures.filter((t) => !t.collected).map((t) => ({ x: t.x, z: t.z }));
  }

  update(dt, elapsed, player, callbacks) {
    // Treasures
    for (const t of this.treasures) {
      if (t.collected) continue;
      const relic = t.group.getObjectByName('relic');
      const ring = t.group.getObjectByName('ring');
      if (relic) {
        relic.rotation.y = elapsed * 1.45 + t.phase;
        relic.position.y = 1.05 + Math.sin(elapsed * 2.6 + t.phase) * 0.2;
      }
      if (ring) {
        const s = 1 + Math.sin(elapsed * 3.2 + t.phase) * 0.12;
        ring.scale.set(s, s, 1);
      }

      const dist = Math.hypot(player.position.x - t.x, player.position.z - t.z);
      if (dist < 1.85) {
        t.collected = true;
        this.scene.remove(t.group);
        this.sound.playTreasurePickup();
        callbacks.onTreasureCollected(t);
      }
    }

    // Survival supplies (water flasks & healing herbs)
    for (const s of this.supplies) {
      if (s.collected) continue;
      s.item.rotation.y = elapsed * 1.8 + s.phase;
      s.item.position.y = 0.72 + Math.sin(elapsed * 3 + s.phase) * 0.14;

      const dist = Math.hypot(player.position.x - s.x, player.position.z - s.z);
      if (dist < 1.6) {
        s.collected = true;
        this.scene.remove(s.group);
        if (s.kind === 'water') {
          player.water = Math.min(player.maxWater, player.water + 42);
          this.sound.playWaterDrink();
          callbacks.onSupplyCollected('water');
        } else {
          player.health = Math.min(player.maxHealth, player.health + 30);
          this.sound.playWaterDrink();
          callbacks.onSupplyCollected('herb');
        }
      }
    }
  }
}
