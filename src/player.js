import * as THREE from 'three';
import { getTerrainHeight, WORLD_RADIUS } from './world.js';

export class ExplorerPlayer {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;

    this.group = new THREE.Group();
    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.facingYaw = Math.PI; // Facing -Z (toward the Great Pyramid)

    // Survival stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxWater = 100;
    this.water = 100;
    this.maxStamina = 100;
    this.stamina = 100;

    // Movement & combat state
    this.radius = 0.62;
    this.grounded = true;
    this.walkPhase = 0;
    this.stepTimer = 0;

    this.attackDuration = 0.32;
    this.attackCooldown = 0.42;
    this.attackTimer = 0;
    this.attackElapsed = 0;
    this.isAttacking = false;
    this.attackHitApplied = false;
    this.comboFlip = 1;

    this.invulnTimer = 0;
    this.hurtFlashTimer = 0;

    this._buildCharacterMesh();
    this.reset();
    scene.add(this.group);
  }

  _buildCharacterMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe3b186, roughness: 0.72 });
    const khakiMat = new THREE.MeshStandardMaterial({ color: 0xc2a16b, roughness: 0.86 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x8a6d43, roughness: 0.88 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x6b563c, roughness: 0.9 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4b2e19, roughness: 0.72 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0x9c2f23, roughness: 0.85 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xd4b67c, roughness: 0.84 });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xdbe4ee,
      roughness: 0.24,
      metalness: 0.88,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf0be43,
      roughness: 0.3,
      metalness: 0.85,
    });

    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    // Torso (explorer shirt + vest)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), khakiMat);
    torso.position.y = 1.24;
    torso.castShadow = true;
    this.bodyRoot.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.62, 0.39), vestMat);
    vest.position.y = 1.28;
    vest.castShadow = true;
    this.bodyRoot.add(vest);

    // Leather belt + buckle
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.11, 0.41), leatherMat);
    belt.position.y = 0.9;
    this.bodyRoot.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.43), goldMat);
    buckle.position.y = 0.9;
    this.bodyRoot.add(buckle);

    // Red explorer bandana / scarf around neck
    const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.14, 10), scarfMat);
    scarf.position.y = 1.66;
    this.bodyRoot.add(scarf);

    // Anthropologist backpack + rolled papyrus map tube
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.24), leatherMat);
    backpack.position.set(0, 1.28, -0.28);
    backpack.castShadow = true;
    this.bodyRoot.add(backpack);

    const scroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.56, 8),
      new THREE.MeshStandardMaterial({ color: 0xf2dfad, roughness: 0.85 })
    );
    scroll.rotation.z = Math.PI / 2;
    scroll.position.set(0, 1.6, -0.28);
    this.bodyRoot.add(scroll);

    // Satchel on left hip
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.26), leatherMat);
    satchel.position.set(-0.37, 0.86, 0);
    this.bodyRoot.add(satchel);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
    head.position.y = 1.9;
    head.castShadow = true;
    this.bodyRoot.add(head);

    // Eyes (facing +Z in local model space)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b140d });
    [-0.09, 0.09].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.03), eyeMat);
      eye.position.set(ex, 1.94, 0.2);
      this.bodyRoot.add(eye);
    });

    // Safari / Explorer Hat
    const hatGroup = new THREE.Group();
    hatGroup.position.y = 2.11;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.46, 0.05, 16), hatMat);
    brim.castShadow = true;
    hatGroup.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.22, 12), hatMat);
    crown.position.y = 0.12;
    crown.castShadow = true;
    hatGroup.add(crown);

    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.06, 12), leatherMat);
    hatBand.position.y = 0.04;
    hatGroup.add(hatBand);
    this.bodyRoot.add(hatGroup);

    // Legs (pivoted at hip)
    const makeLeg = (xOffset) => {
      const pivot = new THREE.Group();
      pivot.position.set(xOffset, 0.86, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), pantsMat);
      leg.position.y = -0.31;
      leg.castShadow = true;
      pivot.add(leg);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.3), leatherMat);
      boot.position.set(0, -0.72, 0.03);
      boot.castShadow = true;
      pivot.add(boot);
      return pivot;
    };
    this.leftLeg = makeLeg(-0.17);
    this.rightLeg = makeLeg(0.17);
    this.bodyRoot.add(this.leftLeg, this.rightLeg);

    // Left Arm (free arm)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.42, 1.54, 0);
    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.48, 0.19), khakiMat);
    lSleeve.position.y = -0.22;
    lSleeve.castShadow = true;
    this.leftArm.add(lSleeve);
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), skinMat);
    lHand.position.y = -0.5;
    this.leftArm.add(lHand);
    this.bodyRoot.add(this.leftArm);

    // Right Arm (sword arm!)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.42, 1.54, 0);
    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.48, 0.19), khakiMat);
    rSleeve.position.y = -0.22;
    rSleeve.castShadow = true;
    this.rightArm.add(rSleeve);
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), skinMat);
    rHand.position.y = -0.5;
    this.rightArm.add(rHand);

    // Detailed Explorer / Egyptian Expedition Sword held in right hand
    this.swordGroup = new THREE.Group();
    this.swordGroup.position.set(0, -0.52, 0.08);
    this.swordGroup.rotation.x = Math.PI * 0.42;

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.28, 8), leatherMat);
    this.swordGroup.add(grip);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), goldMat);
    pommel.position.y = -0.15;
    this.swordGroup.add(pommel);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.09), goldMat);
    guard.position.y = 0.15;
    this.swordGroup.add(guard);

    // Gleaming curved-tip blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.08, 0.025), steelMat);
    blade.position.y = 0.7;
    blade.castShadow = true;
    this.swordGroup.add(blade);

    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 4), steelMat);
    bladeTip.position.y = 1.34;
    bladeTip.scale.set(1, 1, 0.4);
    this.swordGroup.add(bladeTip);

    // Golden rune ridge along blade
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.72, 0.032), goldMat);
    ridge.position.y = 0.56;
    this.swordGroup.add(ridge);

    this.rightArm.add(this.swordGroup);
    this.bodyRoot.add(this.rightArm);

    // 3D Sword Slash Arc Trail visual effect
    const slashGeo = new THREE.RingGeometry(1.1, 2.55, 22, 1, -Math.PI * 0.45, Math.PI * 0.9);
    slashGeo.rotateX(-Math.PI / 2);
    this.slashMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.slashMesh = new THREE.Mesh(slashGeo, this.slashMat);
    this.slashMesh.position.set(0, 1.15, 0.45);
    this.group.add(this.slashMesh);
  }

  reset() {
    const startX = 0;
    const startZ = 10;
    this.position.set(startX, getTerrainHeight(startX, startZ), startZ);
    this.velocity.set(0, 0, 0);
    this.facingYaw = Math.PI;
    this.group.rotation.y = this.facingYaw;

    this.health = this.maxHealth;
    this.water = this.maxWater;
    this.stamina = this.maxStamina;
    this.grounded = true;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackElapsed = 0;
    this.invulnTimer = 0;
    this.slashMat.opacity = 0;
  }

  triggerAttack() {
    if (this.attackTimer > 0 || this.stamina < 8) return false;
    this.isAttacking = true;
    this.attackElapsed = 0;
    this.attackTimer = this.attackCooldown;
    this.attackHitApplied = false;
    this.comboFlip *= -1;
    this.stamina = Math.max(0, this.stamina - 10);
    this.sound.playSwordSwing();
    return true;
  }

  takeDamage(amount, knockbackDir) {
    if (this.invulnTimer > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnTimer = 0.72;
    this.hurtFlashTimer = 0.35;
    if (knockbackDir) {
      this.velocity.x += knockbackDir.x * 7.5;
      this.velocity.z += knockbackDir.z * 7.5;
      if (this.grounded) {
        this.velocity.y = 4.2;
        this.grounded = false;
      }
    }
    this.sound.playPlayerHurt();
    return true;
  }

  getSwordHitOrigin() {
    const forward = new THREE.Vector3(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
    return this.position.clone().addScaledVector(forward, 1.45);
  }

  getForwardVector() {
    return new THREE.Vector3(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
  }

  update(dt, input, cameraYaw, colliders) {
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hurtFlashTimer > 0) this.hurtFlashTimer -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;

    // Movement vector relative to cameraYaw
    const moveForward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    const moveRight = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    const moveDir = new THREE.Vector3();
    if (moveForward !== 0 || moveRight !== 0) {
      // Camera looks in (-sin(yaw), 0, -cos(yaw))
      const camFwdX = -Math.sin(cameraYaw);
      const camFwdZ = -Math.cos(cameraYaw);
      const camRightX = Math.cos(cameraYaw);
      const camRightZ = -Math.sin(cameraYaw);

      moveDir.x = camFwdX * moveForward + camRightX * moveRight;
      moveDir.z = camFwdZ * moveForward + camRightZ * moveRight;
      moveDir.normalize();
    }

    const wantsSprint = input.sprint && moveDir.lengthSq() > 0 && this.stamina > 5 && this.water > 5;
    const baseSpeed = wantsSprint ? 11.4 : 7.0;
    const moveSpeed = this.isAttacking ? baseSpeed * 0.72 : baseSpeed;

    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - dt * 22);
    } else {
      const regenRate = this.water > 15 ? 20 : 8;
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * regenRate);
    }

    // Horizontal velocity smoothing (preserves knockback briefly)
    const targetVx = moveDir.x * moveSpeed;
    const targetVz = moveDir.z * moveSpeed;
    const blend = Math.min(1, dt * 12);
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, blend);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, blend);

    // Jump
    if (input.jump && this.grounded && this.stamina >= 12) {
      this.velocity.y = 8.4;
      this.grounded = false;
      this.stamina = Math.max(0, this.stamina - 12);
    }

    // Gravity
    this.velocity.y -= 22.5 * dt;

    // Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // World boundary clamp
    const distFromCenter = Math.hypot(this.position.x, this.position.z);
    if (distFromCenter > WORLD_RADIUS) {
      const factor = WORLD_RADIUS / distFromCenter;
      this.position.x *= factor;
      this.position.z *= factor;
    }

    // Resolve collisions with rocks, pyramids, obelisks
    for (const col of colliders) {
      if (col.type === 'circle') {
        const dx = this.position.x - col.x;
        const dz = this.position.z - col.z;
        const minDist = this.radius + col.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDist * minDist && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = minDist - d;
          this.position.x += (dx / d) * push;
          this.position.z += (dz / d) * push;
        }
      } else if (col.type === 'box') {
        const minX = col.x - col.halfX - this.radius;
        const maxX = col.x + col.halfX + this.radius;
        const minZ = col.z - col.halfZ - this.radius;
        const maxZ = col.z + col.halfZ + this.radius;
        if (
          this.position.x > minX &&
          this.position.x < maxX &&
          this.position.z > minZ &&
          this.position.z < maxZ
        ) {
          const penLeft = this.position.x - minX;
          const penRight = maxX - this.position.x;
          const penTop = this.position.z - minZ;
          const penBottom = maxZ - this.position.z;
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) this.position.x = minX;
          else if (minPen === penRight) this.position.x = maxX;
          else if (minPen === penTop) this.position.z = minZ;
          else this.position.z = maxZ;
        }
      }
    }

    // Ground height snap
    const groundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.grounded = true;
    }

    // Smoothly turn explorer toward movement direction (or camera forward while attacking)
    if (moveDir.lengthSq() > 0.01) {
      const desiredYaw = Math.atan2(moveDir.x, moveDir.z);
      let diff = desiredYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingYaw += diff * Math.min(1, dt * 13);
    } else if (this.isAttacking && this.attackElapsed < 0.06) {
      // Face camera forward when slashing from standstill
      const desiredYaw = Math.atan2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
      let diff = desiredYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingYaw += diff * Math.min(1, dt * 18);
    }
    this.group.rotation.y = this.facingYaw;

    // Desert hydration drain (faster while sprinting)
    const thirstDrain = wantsSprint ? 1.55 : 0.85;
    this.water = Math.max(0, this.water - dt * thirstDrain);
    if (this.water <= 0) {
      // Dehydration slowly damages health
      this.health = Math.max(0, this.health - dt * 3.8);
    }

    // Animate walking & sword swing
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.5 && this.grounded) {
      this.walkPhase += dt * (wantsSprint ? 14 : 9.5);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.sound.playFootstep();
        this.stepTimer = wantsSprint ? 0.26 : 0.4;
      }
      const swing = Math.sin(this.walkPhase) * (wantsSprint ? 0.75 : 0.52);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.bodyRoot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.07;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, dt * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, dt * 10);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, dt * 10);
      this.bodyRoot.position.y = THREE.MathUtils.lerp(this.bodyRoot.position.y, 0, dt * 10);
    }

    // Sword arm & slash trail animation
    if (this.isAttacking) {
      this.attackElapsed += dt;
      const t = Math.min(1, this.attackElapsed / this.attackDuration);
      const swingCurve = Math.sin(t * Math.PI);

      // Sweeping slash arc
      this.rightArm.rotation.x = -1.25 - swingCurve * 0.45;
      this.rightArm.rotation.y = this.comboFlip * (-1.15 + t * 2.35);
      this.rightArm.rotation.z = -0.35;
      this.bodyRoot.rotation.y = this.comboFlip * (-0.25 + t * 0.55);

      // Slash arc mesh fade
      this.slashMat.opacity = Math.sin(t * Math.PI) * 0.72;
      this.slashMesh.rotation.y = this.comboFlip * (-0.8 + t * 1.6);
      this.slashMesh.scale.setScalar(0.85 + t * 0.35);

      if (this.attackElapsed >= this.attackDuration) {
        this.isAttacking = false;
        this.slashMat.opacity = 0;
        this.bodyRoot.rotation.y = 0;
      }
    } else {
      const idleSwing = horizSpeed > 0.5 ? Math.sin(this.walkPhase) * 0.32 : 0;
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.35 + idleSwing, dt * 10);
      this.rightArm.rotation.y = THREE.MathUtils.lerp(this.rightArm.rotation.y, 0.12, dt * 10);
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, -0.1, dt * 10);
      this.bodyRoot.rotation.y = THREE.MathUtils.lerp(this.bodyRoot.rotation.y, 0, dt * 10);
      this.slashMat.opacity = 0;
    }

    // Invulnerability blink
    this.bodyRoot.visible = this.invulnTimer <= 0 || Math.floor(this.invulnTimer * 18) % 2 === 0;
  }
}
