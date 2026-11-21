import * as THREE from 'three';
import { getTerrainHeight, OASIS_POS, PYRAMID_SPECS, WORLD_RADIUS } from './world.js';

export class SnakeManager {
  constructor(scene, textures, sound) {
    this.scene = scene;
    this.textures = textures;
    this.sound = sound;
    this.snakes = [];
    this.particles = [];
    this.spawnTimer = 0;

    this.baseMat = new THREE.MeshStandardMaterial({
      map: textures.snakeMap,
      roughness: 0.62,
      metalness: 0.08,
    });
    this.hitMat = new THREE.MeshStandardMaterial({
      color: 0xff5a36,
      emissive: 0xaa1100,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    this.tongueMat = new THREE.MeshBasicMaterial({ color: 0xe62222 });
  }

  reset(treasurePositions) {
    for (const s of this.snakes) {
      this.scene.remove(s.group);
    }
    this.snakes = [];

    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];

    // Spawn initial cobras near treasures and desert outcrops
    const initialCount = 12;
    for (let i = 0; i < initialCount; i++) {
      let sx, sz;
      if (i < treasurePositions.length && i % 2 === 0) {
        const tp = treasurePositions[i];
        const ang = Math.random() * Math.PI * 2;
        sx = tp.x + Math.cos(ang) * 7.5;
        sz = tp.z + Math.sin(ang) * 7.5;
      } else {
        const pos = this._randomValidSpawn(24);
        sx = pos.x;
        sz = pos.z;
      }
      this.spawnSnake(sx, sz);
    }
  }

  _randomValidSpawn(minDistFromOrigin = 26) {
    for (let tries = 0; tries < 40; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const r = minDistFromOrigin + Math.random() * (WORLD_RADIUS - minDistFromOrigin - 10);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;

      if (Math.hypot(x - OASIS_POS.x, z - OASIS_POS.z) < OASIS_POS.radius + 5) continue;
      let inPyramid = false;
      for (const p of PYRAMID_SPECS) {
        if (Math.abs(x - p.x) < p.base / 2 + 4 && Math.abs(z - p.z) < p.base / 2 + 4) {
          inPyramid = true;
          break;
        }
      }
      if (!inPyramid) return { x, z };
    }
    return { x: 25, z: -15 };
  }

  spawnSnake(x, z) {
    const group = new THREE.Group();
    const y = getTerrainHeight(x, z);
    group.position.set(x, y, z);

    const isKingCobra = Math.random() < 0.35;
    const scale = isKingCobra ? 1.28 : 1.0;

    // Articulated head + cobra hood
    const headGroup = new THREE.Group();
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.24 * scale, 0.52 * scale), this.baseMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Flared cobra hood
    const hoodGeo = new THREE.SphereGeometry(0.38 * scale, 10, 8);
    hoodGeo.scale(1.25, 0.9, 0.28);
    const hoodMesh = new THREE.Mesh(hoodGeo, this.baseMat);
    hoodMesh.position.set(0, -0.05 * scale, -0.22 * scale);
    hoodMesh.castShadow = true;
    headGroup.add(hoodMesh);

    // Glowing eyes
    [-0.12, 0.12].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 6, 6), this.eyeMat);
      eye.position.set(ex * scale, 0.06 * scale, 0.18 * scale);
      headGroup.add(eye);
    });

    // Forked tongue
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 0.02 * scale, 0.28 * scale), this.tongueMat);
    tongue.position.set(0, -0.04 * scale, 0.36 * scale);
    headGroup.add(tongue);

    headGroup.position.set(0, 0.55 * scale, 0);
    group.add(headGroup);

    // 9 undulating body segments
    const segments = [];
    const segCount = 9;
    for (let i = 0; i < segCount; i++) {
      const t = i / (segCount - 1);
      const r = THREE.MathUtils.lerp(0.22, 0.07, t) * scale;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), this.baseMat);
      seg.scale.set(1, 0.85, 1.35);
      seg.castShadow = i < 4;
      group.add(seg);
      segments.push(seg);
    }

    this.scene.add(group);

    const snake = {
      group,
      headGroup,
      hoodMesh,
      tongue,
      segments,
      scale,
      hp: isKingCobra ? 3 : 2,
      maxHp: isKingCobra ? 3 : 2,
      speed: isKingCobra ? 4.8 : 5.4,
      yaw: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      homeX: x,
      homeZ: z,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 1 + Math.random() * 2.5,
      state: 'patrol', // patrol | chase | lunge
      biteCooldown: 0,
      hissCooldown: 0,
      hitFlash: 0,
      knockback: new THREE.Vector3(),
      alive: true,
    };

    this.snakes.push(snake);
    return snake;
  }

  _spawnBurst(pos, color, count = 10) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mat);
      mesh.position.copy(pos);
      mesh.position.y += 0.4;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 7,
          2.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 7
        ),
        life: 0.45 + Math.random() * 0.25,
      });
    }
  }

  // Called during explorer's sword swing window
  checkSwordHits(player, onSnakeKilled) {
    const hitCenter = player.getSwordHitOrigin();
    const playerFwd = player.getForwardVector();
    const slashRadius = 2.65;
    let hits = 0;

    for (const s of this.snakes) {
      if (!s.alive) continue;
      const toSnake = new THREE.Vector3().subVectors(s.group.position, player.position);
      toSnake.y = 0;
      const distToOrigin = Math.hypot(
        s.group.position.x - hitCenter.x,
        s.group.position.z - hitCenter.z
      );
      const distToPlayer = toSnake.length();

      if (distToOrigin <= slashRadius || (distToPlayer <= 2.7 && toSnake.normalize().dot(playerFwd) > 0.1)) {
        s.hp -= 1;
        s.hitFlash = 0.22;
        hits++;

        const pushDir = new THREE.Vector3()
          .subVectors(s.group.position, player.position)
          .setY(0)
          .normalize();
        s.knockback.copy(pushDir).multiplyScalar(11.5);

        if (s.hp <= 0) {
          s.alive = false;
          this.sound.playSnakeHit(true);
          this._spawnBurst(s.group.position, 0x9ec94b, 14);
          this._spawnBurst(s.group.position, 0xe8c474, 8);
          this.scene.remove(s.group);
          onSnakeKilled(s.group.position.clone());
        } else {
          this.sound.playSnakeHit(false);
          this._spawnBurst(s.group.position, 0xffd166, 7);
        }
      }
    }

    if (hits > 0) {
      this.snakes = this.snakes.filter((s) => s.alive);
    }
    return hits;
  }

  update(dt, elapsed, player, onPlayerBitten) {
    // Respawn snakes gently over time so the desert stays alive & dangerous
    this.spawnTimer += dt;
    if (this.spawnTimer > 12 && this.snakes.length < 13) {
      this.spawnTimer = 0;
      const pos = this._randomValidSpawn(22);
      if (Math.hypot(pos.x - player.position.x, pos.z - player.position.z) > 26) {
        this.spawnSnake(pos.x, pos.z);
      }
    }

    for (const s of this.snakes) {
      if (!s.alive) continue;

      if (s.biteCooldown > 0) s.biteCooldown -= dt;
      if (s.hissCooldown > 0) s.hissCooldown -= dt;

      // Hit flash material swap
      if (s.hitFlash > 0) {
        s.hitFlash -= dt;
        const mat = s.hitFlash > 0 ? this.hitMat : this.baseMat;
        s.headGroup.children[0].material = mat;
        s.hoodMesh.material = mat;
        for (const seg of s.segments) seg.material = mat;
      }

      const dx = player.position.x - s.group.position.x;
      const dz = player.position.z - s.group.position.z;
      const dist = Math.hypot(dx, dz);

      const aggroRange = 17.5;
      const loseRange = 25;

      if (dist < aggroRange) {
        if (s.state === 'patrol' && s.hissCooldown <= 0) {
          this.sound.playSnakeHiss();
          s.hissCooldown = 4.0;
        }
        s.state = 'chase';
      } else if (dist > loseRange) {
        s.state = 'patrol';
      }

      let moveSpeed = 0;
      let targetYaw = s.yaw;

      if (s.state === 'chase') {
        targetYaw = Math.atan2(dx, dz);
        moveSpeed = dist > 1.7 ? s.speed : 1.5;

        // Strike bite when close
        if (dist < 1.85 && s.biteCooldown <= 0) {
          s.biteCooldown = 1.25;
          this.sound.playSnakeHiss();
          const dir = new THREE.Vector3(dx, 0, dz).normalize();
          const dmg = s.maxHp > 2 ? 18 : 13;
          if (player.takeDamage(dmg, dir)) {
            onPlayerBitten(dmg);
          }
        }
      } else {
        // Patrol near home area
        s.wanderTimer -= dt;
        if (s.wanderTimer <= 0) {
          s.wanderTimer = 1.6 + Math.random() * 2.5;
          const distHome = Math.hypot(s.group.position.x - s.homeX, s.group.position.z - s.homeZ);
          if (distHome > 12) {
            s.wanderAngle = Math.atan2(s.homeX - s.group.position.x, s.homeZ - s.group.position.z);
          } else {
            s.wanderAngle += (Math.random() - 0.5) * 1.9;
          }
        }
        targetYaw = s.wanderAngle;
        moveSpeed = s.speed * 0.42;
      }

      // Smooth turn
      let diff = targetYaw - s.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.yaw += diff * Math.min(1, dt * 6.5);

      // Apply movement + knockback
      s.group.position.x += (Math.sin(s.yaw) * moveSpeed + s.knockback.x) * dt;
      s.group.position.z += (Math.cos(s.yaw) * moveSpeed + s.knockback.z) * dt;
      s.knockback.multiplyScalar(Math.max(0, 1 - dt * 8));

      // Keep snakes out of the safe oasis water
      const dOasis = Math.hypot(s.group.position.x - OASIS_POS.x, s.group.position.z - OASIS_POS.z);
      if (dOasis < OASIS_POS.radius + 1.4) {
        const pushX = (s.group.position.x - OASIS_POS.x) / (dOasis || 1);
        const pushZ = (s.group.position.z - OASIS_POS.z) / (dOasis || 1);
        s.group.position.x = OASIS_POS.x + pushX * (OASIS_POS.radius + 1.5);
        s.group.position.z = OASIS_POS.z + pushZ * (OASIS_POS.radius + 1.5);
      }

      // Snap to desert dune height
      s.group.position.y = getTerrainHeight(s.group.position.x, s.group.position.z);
      s.group.rotation.y = s.yaw;

      // Animate slithering segments & raised menacing cobra head
      s.phase += dt * (s.state === 'chase' ? 11.5 : 6.2);
      const headRaise = s.state === 'chase' ? 0.85 * s.scale : 0.42 * s.scale;
      s.headGroup.position.y = THREE.MathUtils.lerp(s.headGroup.position.y, headRaise, dt * 6);
      s.headGroup.position.x = Math.sin(s.phase) * 0.14;
      s.hoodMesh.scale.x = s.state === 'chase' ? 1.55 : 0.95;
      s.tongue.visible = Math.sin(elapsed * 9 + s.phase) > 0.35;

      for (let i = 0; i < s.segments.length; i++) {
        const seg = s.segments[i];
        const wave = Math.sin(s.phase - i * 0.65) * (0.28 + i * 0.03) * s.scale;
        const lift = i === 0 ? headRaise * 0.65 : i === 1 ? headRaise * 0.32 : 0.16 * s.scale;
        seg.position.set(wave, lift, -(i + 1) * 0.3 * s.scale);
      }
    }

    // Update burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 16 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 7;
      p.mesh.rotation.y += dt * 5;
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 1.8));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}
