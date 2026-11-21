import * as THREE from 'three';
import { createDesertTextures } from './textures.js';
import { SoundEngine } from './audio.js';
import { buildDesertWorld, getTerrainHeight, OASIS_POS, PYRAMID_SPECS } from './world.js';
import { ExplorerPlayer } from './player.js';
import { SnakeManager } from './snakes.js';
import { TreasureManager } from './treasures.js';

// DOM Elements
const canvas = document.getElementById('game-canvas');
const hudEl = document.getElementById('hud');
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const muteBtn = document.getElementById('mute-btn');

const healthBar = document.getElementById('health-bar');
const healthText = document.getElementById('health-text');
const waterBar = document.getElementById('water-bar');
const waterText = document.getElementById('water-text');
const staminaBar = document.getElementById('stamina-bar');
const staminaText = document.getElementById('stamina-text');

const treasureCountEl = document.getElementById('treasure-count');
const treasureTotalEl = document.getElementById('treasure-total');
const snakesKilledEl = document.getElementById('snakes-killed');
const scoreValueEl = document.getElementById('score-value');
const compassHeadingEl = document.getElementById('compass-heading');
const compassHintEl = document.getElementById('compass-hint');
const toastContainer = document.getElementById('toast-container');
const damageFlashEl = document.getElementById('damage-flash');
const thirstVignetteEl = document.getElementById('thirst-vignette');

const endEyebrow = document.getElementById('end-eyebrow');
const endTitle = document.getElementById('end-title');
const endMessage = document.getElementById('end-message');
const endTreasures = document.getElementById('end-treasures');
const endSnakes = document.getElementById('end-snakes');
const endScore = document.getElementById('end-score');

const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

// Three.js Setup
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xe6be83, 0.0064);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 420);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xffe9c2, 0xb87e3c, 0.78);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff1cf, 2.15);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 170;
const shadowBound = 48;
sunLight.shadow.camera.left = -shadowBound;
sunLight.shadow.camera.right = shadowBound;
sunLight.shadow.camera.top = shadowBound;
sunLight.shadow.camera.bottom = -shadowBound;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);
scene.add(sunLight.target);

// Game Systems
const textures = createDesertTextures();
const sound = new SoundEngine();
const world = buildDesertWorld(scene, textures);
const player = new ExplorerPlayer(scene, sound);
const treasureMgr = new TreasureManager(scene, sound);
const snakeMgr = new SnakeManager(scene, textures, sound);

treasureTotalEl.textContent = String(treasureMgr.getTotalCount());

// Game State
const state = {
  mode: 'menu', // menu | playing | ended
  treasuresFound: 0,
  snakesKilled: 0,
  score: 0,
  cameraYaw: 0, // 0 looks toward -Z (Great Pyramid)
  cameraPitch: 0.34,
  cameraShake: 0,
  oasisToastCooldown: 0,
  thirstWarnCooldown: 0,
};

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  jump: false,
  camLeft: false,
  camRight: false,
};

let pointerDragging = false;
let dragMoved = false;
let lastPointerX = 0;
let lastPointerY = 0;

function showToast(message, variant = '') {
  const el = document.createElement('div');
  el.className = `toast ${variant}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  while (toastContainer.children.length > 3) {
    toastContainer.removeChild(toastContainer.firstChild);
  }
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2700);
}

function startNewExpedition() {
  sound.init();
  player.reset();
  treasureMgr.reset();
  snakeMgr.reset(treasureMgr.getActiveTreasurePositions());

  state.mode = 'playing';
  state.treasuresFound = 0;
  state.snakesKilled = 0;
  state.score = 0;
  state.cameraYaw = 0;
  state.cameraPitch = 0.34;
  state.cameraShake = 0;
  state.oasisToastCooldown = 0;
  state.thirstWarnCooldown = 0;

  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  hudEl.classList.remove('hidden');
  damageFlashEl.style.opacity = '0';
  thirstVignetteEl.style.opacity = '0';

  updateHUD();
  showToast('¡Encuentra los 12 tesoros y sobrevive al desierto!');

  // Attempt pointer lock gracefully (works even if blocked by iframe)
  try {
    canvas.requestPointerLock?.();
  } catch (_) {}
}

function finishExpedition(victory, reason) {
  state.mode = 'ended';
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }

  hudEl.classList.add('hidden');
  endScreen.classList.remove('hidden');

  if (victory) {
    endEyebrow.textContent = '¡EXPEDICIÓN TRIUNFAL!';
    endTitle.textContent = 'TESOROS DE EGIPTO RECUPERADOS';
    endMessage.textContent =
      'Has sobrevivido a las arenas ardientes y a las víboras del desierto, recuperando todas las reliquias sagradas.';
  } else {
    endEyebrow.textContent = 'EXPEDICIÓN FALLIDA';
    endTitle.textContent = 'HAS CAÍDO EN LAS ARENAS';
    endMessage.textContent = reason;
  }

  endTreasures.textContent = `${state.treasuresFound}/${treasureMgr.getTotalCount()}`;
  endSnakes.textContent = String(state.snakesKilled);
  endScore.textContent = String(state.score);
}

function updateHUD() {
  const hpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100));
  const waterPct = Math.max(0, Math.round((player.water / player.maxWater) * 100));
  const stamPct = Math.max(0, Math.round((player.stamina / player.maxStamina) * 100));

  healthBar.style.width = `${hpPct}%`;
  healthText.textContent = String(Math.ceil(player.health));

  waterBar.style.width = `${waterPct}%`;
  waterText.textContent = `${waterPct}%`;

  staminaBar.style.width = `${stamPct}%`;
  staminaText.textContent = String(Math.round(player.stamina));

  treasureCountEl.textContent = String(state.treasuresFound);
  snakesKilledEl.textContent = String(state.snakesKilled);
  scoreValueEl.textContent = String(state.score);

  // Compass cardinal direction based on camera look direction (-sin(yaw), -cos(yaw))
  const deg = (((-state.cameraYaw * 180) / Math.PI) % 360 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  compassHeadingEl.textContent = dirs[Math.round(deg / 45) % 8];

  // Nearest uncollected treasure distance
  let nearestDist = Infinity;
  for (const t of treasureMgr.treasures) {
    if (t.collected) continue;
    const d = Math.hypot(t.x - player.position.x, t.z - player.position.z);
    if (d < nearestDist) nearestDist = d;
  }
  if (Number.isFinite(nearestDist)) {
    compassHintEl.textContent = `Reliquia cercana: ${Math.round(nearestDist)} m`;
  } else {
    compassHintEl.textContent = '¡Todas las reliquias halladas!';
  }

  // Vignettes
  damageFlashEl.style.opacity = player.hurtFlashTimer > 0 ? String(Math.min(1, player.hurtFlashTimer * 2.8)) : '0';
  thirstVignetteEl.style.opacity = player.water < 25 ? String(((25 - player.water) / 25) * 0.85) : '0';
}

function drawRadar() {
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radarRadius = w / 2 - 4;
  const maxWorldRange = 72;

  radarCtx.clearRect(0, 0, w, h);

  // Subtle concentric rings
  radarCtx.strokeStyle = 'rgba(244, 193, 78, 0.2)';
  radarCtx.lineWidth = 1;
  [0.35, 0.68, 1].forEach((r) => {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, radarRadius * r, 0, Math.PI * 2);
    radarCtx.stroke();
  });

  // Rotate world points relative to cameraYaw so UP on radar = camera forward
  const cos = Math.cos(-state.cameraYaw);
  const sin = Math.sin(-state.cameraYaw);

  const toRadar = (wx, wz) => {
    const dx = wx - player.position.x;
    const dz = wz - player.position.z;
    // Rotate into camera frame where forward is -Z -> up on radar is -Y
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    const sx = (rx / maxWorldRange) * radarRadius;
    const sy = (rz / maxWorldRange) * radarRadius;
    const mag = Math.hypot(sx, sy);
    if (mag > radarRadius - 3) {
      const k = (radarRadius - 3) / mag;
      return { x: cx + sx * k, y: cy + sy * k, clamped: true };
    }
    return { x: cx + sx, y: cy + sy, clamped: false };
  };

  // Pyramids (warm sand diamonds)
  radarCtx.fillStyle = 'rgba(216, 174, 108, 0.45)';
  for (const p of PYRAMID_SPECS) {
    const pt = toRadar(p.x, p.z);
    radarCtx.beginPath();
    radarCtx.moveTo(pt.x, pt.y - 6);
    radarCtx.lineTo(pt.x + 6, pt.y);
    radarCtx.lineTo(pt.x, pt.y + 6);
    radarCtx.lineTo(pt.x - 6, pt.y);
    radarCtx.closePath();
    radarCtx.fill();
  }

  // Oasis (blue)
  const oasisPt = toRadar(OASIS_POS.x, OASIS_POS.z);
  radarCtx.fillStyle = '#38bdf8';
  radarCtx.beginPath();
  radarCtx.arc(oasisPt.x, oasisPt.y, 4.5, 0, Math.PI * 2);
  radarCtx.fill();

  // Treasures (gold)
  radarCtx.fillStyle = '#facc15';
  for (const t of treasureMgr.treasures) {
    if (t.collected) continue;
    const pt = toRadar(t.x, t.z);
    radarCtx.beginPath();
    radarCtx.arc(pt.x, pt.y, pt.clamped ? 2.6 : 3.6, 0, Math.PI * 2);
    radarCtx.fill();
  }

  // Snakes (red)
  radarCtx.fillStyle = '#f87171';
  for (const s of snakeMgr.snakes) {
    if (!s.alive) continue;
    const dist = Math.hypot(s.group.position.x - player.position.x, s.group.position.z - player.position.z);
    if (dist > maxWorldRange) continue;
    const pt = toRadar(s.group.position.x, s.group.position.z);
    radarCtx.beginPath();
    radarCtx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
    radarCtx.fill();
  }

  // Player center arrow
  radarCtx.fillStyle = '#ffffff';
  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy - 5);
  radarCtx.lineTo(cx + 4, cy + 4);
  radarCtx.lineTo(cx, cy + 2);
  radarCtx.lineTo(cx - 4, cy + 4);
  radarCtx.closePath();
  radarCtx.fill();
}

// Input Listeners
window.addEventListener('keydown', (e) => {
  if (state.mode !== 'playing') return;
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      input.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      input.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      input.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      input.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      input.sprint = true;
      break;
    case 'Space':
      input.jump = true;
      e.preventDefault();
      break;
    case 'KeyQ':
      input.camLeft = true;
      break;
    case 'KeyE':
      input.camRight = true;
      break;
    case 'KeyF':
    case 'KeyJ':
    case 'Enter':
      player.triggerAttack();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      input.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      input.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      input.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      input.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      input.sprint = false;
      break;
    case 'Space':
      input.jump = false;
      break;
    case 'KeyQ':
      input.camLeft = false;
      break;
    case 'KeyE':
      input.camRight = false;
      break;
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'playing') return;
  sound.init();

  if (document.pointerLockElement === canvas) {
    if (e.button === 0) {
      player.triggerAttack();
    }
    return;
  }

  // Fallback when pointer lock is not active: click to attack, drag to orbit camera
  pointerDragging = true;
  dragMoved = false;
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (state.mode !== 'playing') return;
  const sens = 0.0032;

  if (document.pointerLockElement === canvas) {
    state.cameraYaw -= e.movementX * sens;
    state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch + e.movementY * sens, 0.12, 1.05);
  } else if (pointerDragging) {
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    state.cameraYaw -= dx * sens * 1.4;
    state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch + dy * sens * 1.2, 0.12, 1.05);
  }
});

window.addEventListener('mouseup', (e) => {
  if (state.mode !== 'playing') return;
  if (pointerDragging) {
    pointerDragging = false;
    if (!dragMoved && e.button === 0) {
      player.triggerAttack();
    }
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

startBtn.addEventListener('click', startNewExpedition);
restartBtn.addEventListener('click', startNewExpedition);
muteBtn.addEventListener('click', () => {
  sound.init();
  const muted = sound.toggleMute();
  muteBtn.textContent = muted ? '🔇' : '🔊';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize preview treasures & snakes for the menu backdrop
treasureMgr.reset();
snakeMgr.reset(treasureMgr.getActiveTreasurePositions());

// Main Loop
const clock = new THREE.Clock();
const camTargetPos = new THREE.Vector3();
const camLookAt = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (state.mode === 'playing') {
    // Keyboard camera rotation (Q / E)
    if (input.camLeft) state.cameraYaw += dt * 2.1;
    if (input.camRight) state.cameraYaw -= dt * 2.1;

    // Update explorer
    player.update(dt, input, state.cameraYaw, world.colliders);

    // Apply sword damage at active swing midpoint
    if (player.isAttacking && !player.attackHitApplied && player.attackElapsed >= 0.09) {
      player.attackHitApplied = true;
      const hits = snakeMgr.checkSwordHits(player, (killPos) => {
        state.snakesKilled += 1;
        state.score += 120;
        showToast('¡Serpiente derrotada! +120 pts');
        // 35% chance to drop a survival item
        if (Math.random() < 0.35) {
          treasureMgr.spawnSupply(killPos.x, killPos.z, Math.random() < 0.55 ? 'water' : 'herb');
        }
      });
      if (hits > 0) {
        state.cameraShake = 0.22;
      }
    }

    // Update snakes
    snakeMgr.update(dt, elapsed, player, (dmg) => {
      state.cameraShake = 0.34;
      showToast(`¡Mordida de víbora! -${dmg} salud`, 'danger');
    });

    // Update treasures & pickups
    treasureMgr.update(dt, elapsed, player, {
      onTreasureCollected: (t) => {
        state.treasuresFound += 1;
        state.score += t.value;
        showToast(`✨ ${t.name} (+${t.value} pts)`);
        if (state.treasuresFound >= treasureMgr.getTotalCount()) {
          finishExpedition(true, '');
        }
      },
      onSupplyCollected: (kind) => {
        if (kind === 'water') {
          showToast('💧 Cantimplora recogida (+42% agua)', 'water');
        } else {
          showToast('🌿 Hierba curativa (+30 salud)');
        }
      },
    });

    // Oasis drinking zone check
    if (state.oasisToastCooldown > 0) state.oasisToastCooldown -= dt;
    const dOasis = Math.hypot(player.position.x - OASIS_POS.x, player.position.z - OASIS_POS.z);
    if (dOasis < OASIS_POS.radius + 1.8 && player.water < player.maxWater) {
      player.water = Math.min(player.maxWater, player.water + dt * 28);
      if (state.oasisToastCooldown <= 0) {
        sound.playWaterDrink();
        showToast('💧 Hidratándote en el Oasis...', 'water');
        state.oasisToastCooldown = 3.5;
      }
    }

    // Low thirst alert
    if (state.thirstWarnCooldown > 0) state.thirstWarnCooldown -= dt;
    if (player.water < 18 && state.thirstWarnCooldown <= 0) {
      showToast('⚠️ ¡Sed extrema! Busca el Oasis o una cantimplora', 'danger');
      state.thirstWarnCooldown = 7.5;
    }

    // Check death
    if (player.health <= 0 && state.mode === 'playing') {
      const reason =
        player.water <= 0
          ? 'La deshidratación del desierto agotó tus fuerzas.'
          : 'El veneno de las serpientes acabó con tu expedición.';
      finishExpedition(false, reason);
    }

    // Third-person camera follow
    const camDist = 7.2;
    const horizDist = Math.cos(state.cameraPitch) * camDist;
    const camYOffset = Math.sin(state.cameraPitch) * camDist + 1.75;

    camTargetPos.set(
      player.position.x + Math.sin(state.cameraYaw) * horizDist,
      player.position.y + camYOffset,
      player.position.z + Math.cos(state.cameraYaw) * horizDist
    );

    // Prevent camera from dipping under desert sand dunes
    const camGround = getTerrainHeight(camTargetPos.x, camTargetPos.z) + 0.85;
    if (camTargetPos.y < camGround) camTargetPos.y = camGround;

    camera.position.lerp(camTargetPos, Math.min(1, dt * 11));

    // Apply subtle impact camera shake
    if (state.cameraShake > 0) {
      state.cameraShake = Math.max(0, state.cameraShake - dt * 1.4);
      const mag = state.cameraShake * 0.45;
      camera.position.x += (Math.random() - 0.5) * mag;
      camera.position.y += (Math.random() - 0.5) * mag;
    }

    camLookAt.set(player.position.x, player.position.y + 1.55, player.position.z);
    camera.lookAt(camLookAt);

    // Keep sun shadow frustum centered on explorer
    sunLight.position.set(player.position.x + 48, player.position.y + 52, player.position.z - 55);
    sunLight.target.position.copy(player.position);

    world.updateWorld(dt, elapsed, player.position);
    updateHUD();
    drawRadar();
  } else {
    // Cinematic slow desert pan behind start / end screen
    const angle = elapsed * 0.14;
    const camX = Math.sin(angle) * 24;
    const camZ = 18 + Math.cos(angle) * 14;
    camera.position.set(camX, getTerrainHeight(camX, camZ) + 11, camZ);
    camera.lookAt(0, 6, -42);

    sunLight.position.set(48, 56, -55);
    sunLight.target.position.set(0, 0, -20);
    world.updateWorld(dt, elapsed, camera.position);
  }

  renderer.render(scene, camera);
}

animate();
