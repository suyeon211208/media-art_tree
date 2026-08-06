import * as THREE from 'three';
import { ParticleShader } from './shaders.js';

/**
 * Creates the Star Field (Distant micro-stars & cosmic dust)
 */
export function createStarField(count = 2000) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const starColors = [
    new THREE.Color('#ffffff'), // Pure White
    new THREE.Color('#f8fafc'), // Soft Pearl
    new THREE.Color('#e2e8f0'), // Silver White
    new THREE.Color('#f1f5f9'), // Diamond White
    new THREE.Color('#e0f2fe'), // Soft Ice White
  ];

  for (let i = 0; i < count; i++) {
    // Distribute in a spherical galaxy shell
    const radius = 25 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    const color = starColors[Math.floor(Math.random() * starColors.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = 0.5 + Math.random() * 1.8;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Canvas Texture for glowing star point
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(200,225,255,0.7)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    map: texture,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const starPoints = new THREE.Points(geometry, material);
  
  return {
    mesh: starPoints,
    update: (time) => {
      starPoints.rotation.y = time * 0.015;
      starPoints.rotation.x = Math.sin(time * 0.01) * 0.02;
    }
  };
}

/**
 * Interactive Particle System with Real-Time Visitor Reaction Physics
 */
export class InteractiveParticleSystem {
  constructor(scene, count = 4500) {
    this.scene = scene;
    this.count = count;
    this.mode = 'stream'; // 'stream' | 'starlight' | 'quantum' | 'vortex'
    this.interactionType = 'repulsor'; // 'repulsor' | 'attractor' | 'vortex' | 'ribbon'
    
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.initialPositions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.scales = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.speeds = new Float32Array(count);
    this.phases = new Float32Array(count);

    this.shockwaves = []; // Active shockwaves triggered by clicks/taps

    this.initParticles();
    this.initMaterial();

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.mesh);

    // Constellation lines mesh between nearest particles near pointer
    this.initConstellationLines();
  }

  initParticles() {
    const palette = [
      new THREE.Color('#ffffff'), // Pure Brilliant White
      new THREE.Color('#f8fafc'), // Soft Crystal White
      new THREE.Color('#e2e8f0'), // Luminous Silver
      new THREE.Color('#f1f5f9'), // Diamond Sparkle
      new THREE.Color('#e0f2fe'), // Pale Frost
      new THREE.Color('#dbeafe'), // Subtle Icy White
    ];

    for (let i = 0; i < this.count; i++) {
      // Golden Ratio / Spiral Galaxy distribution
      const theta = i * 0.1;
      const radius = Math.sqrt(i) * 0.28 + (Math.random() - 0.5) * 1.2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.6;

      const x = radius * Math.cos(theta);
      const y = (Math.random() - 0.5) * 8 + Math.sin(radius * 0.5) * 1.5;
      const z = radius * Math.sin(theta) + (Math.random() - 0.5) * 4;

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      this.initialPositions[i * 3] = x;
      this.initialPositions[i * 3 + 1] = y;
      this.initialPositions[i * 3 + 2] = z;

      this.velocities[i * 3] = 0;
      this.velocities[i * 3 + 1] = 0;
      this.velocities[i * 3 + 2] = 0;

      const color = palette[Math.floor(Math.random() * palette.length)];
      this.colors[i * 3] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;

      this.scales[i] = 1.5 + Math.random() * 3.5;
      this.alphas[i] = 0.5 + Math.random() * 0.5;
      this.speeds[i] = 0.4 + Math.random() * 0.8;
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aScale', new THREE.BufferAttribute(this.scales, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('aSpeed', new THREE.BufferAttribute(this.speeds, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
  }

  initMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: ParticleShader.vertexShader,
      fragmentShader: ParticleShader.fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uGlowIntensity: { value: 0.65 },
        uMousePos: { value: new THREE.Vector3(999, 999, 999) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  initConstellationLines() {
    const maxLinePoints = 120;
    const linePositions = new Float32Array(maxLinePoints * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });

    this.constellationMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    this.scene.add(this.constellationMesh);
  }

  setMode(mode) {
    this.mode = mode;
  }

  setInteractionType(type) {
    this.interactionType = type;
  }

  setGlowIntensity(value) {
    this.material.uniforms.uGlowIntensity.value = value;
  }

  triggerShockwave(worldPos) {
    this.shockwaves.push({
      position: worldPos.clone(),
      radius: 0.1,
      maxRadius: 8.0,
      strength: 0.8,
      speed: 12.0,
    });
  }

  update(time, delta, mouseWorldPos, mouseVelocity, sensitivity = 1.0) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uMousePos.value.copy(mouseWorldPos);

    const positions = this.geometry.attributes.position.array;
    const initialPositions = this.initialPositions;
    const velocities = this.velocities;

    // Update Shockwaves
    for (let s = this.shockwaves.length - 1; s >= 0; s--) {
      const sw = this.shockwaves[s];
      sw.radius += sw.speed * delta;
      if (sw.radius > sw.maxRadius) {
        this.shockwaves.splice(s, 1);
      }
    }

    const mouseDistRadius = 1.6 * sensitivity;
    let lineIdx = 0;
    const linePosAttr = this.constellationMesh.geometry.attributes.position;
    const maxLineVerts = linePosAttr.array.length / 3;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      let px = positions[idx];
      let py = positions[idx + 1];
      let pz = positions[idx + 2];

      let vx = velocities[idx];
      let vy = velocities[idx + 1];
      let vz = velocities[idx + 2];

      const ix = initialPositions[idx];
      const iy = initialPositions[idx + 1];
      const iz = initialPositions[idx + 2];

      // Distance to Visitor Pointer
      const dx = px - mouseWorldPos.x;
      const dy = py - mouseWorldPos.y;
      const dz = pz - mouseWorldPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // --- Interactive Forces ---
      if (dist < mouseDistRadius) {
        const force = (1.0 - dist / mouseDistRadius) * 0.15 * sensitivity * (1.0 + mouseVelocity * 2.0);

        if (this.interactionType === 'repulsor') {
          // Push away from cursor
          vx += (dx / (dist + 0.001)) * force;
          vy += (dy / (dist + 0.001)) * force;
          vz += (dz / (dist + 0.001)) * force;
        } else if (this.interactionType === 'attractor') {
          // Pull toward cursor
          vx -= (dx / (dist + 0.001)) * force * 0.8;
          vy -= (dy / (dist + 0.001)) * force * 0.8;
          vz -= (dz / (dist + 0.001)) * force * 0.8;
        } else if (this.interactionType === 'vortex') {
          // Tangential swirl
          vx += (-dy / (dist + 0.001)) * force * 1.2;
          vy += (dx / (dist + 0.001)) * force * 1.2;
          vz += Math.sin(time + i) * force * 0.5;
        }
      }

      // --- Shockwave Forces ---
      for (const sw of this.shockwaves) {
        const swDx = px - sw.position.x;
        const swDy = py - sw.position.y;
        const swDz = pz - sw.position.z;
        const swDist = Math.sqrt(swDx * swDx + swDy * swDy + swDz * swDz);
        const waveDiff = Math.abs(swDist - sw.radius);

        if (waveDiff < 1.0) {
          const swForce = (1.0 - waveDiff) * sw.strength * (1.0 - sw.radius / sw.maxRadius);
          vx += (swDx / (swDist + 0.001)) * swForce;
          vy += (swDy / (swDist + 0.001)) * swForce;
          vz += (swDz / (swDist + 0.001)) * swForce;
        }
      }

      // --- Mode Specific Ambient Dynamics ---
      if (this.mode === 'stream') {
        // Spiral Orbit Flow
        const orbitSpeed = 0.2;
        const angle = Math.atan2(pz, px) + orbitSpeed * delta;
        const r = Math.sqrt(px * px + pz * pz);
        const targetX = r * Math.cos(angle);
        const targetZ = r * Math.sin(angle);

        vx += (targetX - px) * 0.02;
        vz += (targetZ - pz) * 0.02;
      } else if (this.mode === 'starlight') {
        // Floating Sine Wave Drift
        vy += Math.sin(time * 0.8 + i * 0.1) * 0.002;
      } else if (this.mode === 'quantum') {
        // Lattice Grid Spring force back to initial position
        vx += (ix - px) * 0.08;
        vy += (iy - py) * 0.08;
        vz += (iz - pz) * 0.08;
      } else if (this.mode === 'vortex') {
        // Swirling vortex center
        const vortexAngle = Math.atan2(pz, px) + 1.2 * delta;
        const vr = Math.sqrt(px * px + pz * pz) * 0.99;
        vx += (vr * Math.cos(vortexAngle) - px) * 0.05;
        vz += (vr * Math.sin(vortexAngle) - pz) * 0.05;
      }

      // Return to base orbit spring force
      vx += (ix - px) * 0.012;
      vy += (iy - py) * 0.012;
      vz += (iz - pz) * 0.012;

      // Friction / Damping
      vx *= 0.92;
      vy *= 0.92;
      vz *= 0.92;

      // Apply
      positions[idx] = px + vx;
      positions[idx + 1] = py + vy;
      positions[idx + 2] = pz + vz;

      velocities[idx] = vx;
      velocities[idx + 1] = vy;
      velocities[idx + 2] = vz;

      // Constellation Links when near visitor pointer
      if (dist < 2.5 && lineIdx < maxLineVerts - 2 && i % 4 === 0) {
        linePosAttr.array[lineIdx * 3] = positions[idx];
        linePosAttr.array[lineIdx * 3 + 1] = positions[idx + 1];
        linePosAttr.array[lineIdx * 3 + 2] = positions[idx + 2];

        linePosAttr.array[(lineIdx + 1) * 3] = mouseWorldPos.x;
        linePosAttr.array[(lineIdx + 1) * 3 + 1] = mouseWorldPos.y;
        linePosAttr.array[(lineIdx + 1) * 3 + 2] = mouseWorldPos.z;

        lineIdx += 2;
      }
    }

    // Clear unused constellation line points
    for (let l = lineIdx; l < maxLineVerts; l++) {
      linePosAttr.array[l * 3] = 0;
      linePosAttr.array[l * 3 + 1] = 0;
      linePosAttr.array[l * 3 + 2] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    linePosAttr.needsUpdate = true;
  }
}

/**
 * Generates initial target coordinates for the Tree of Light partitioned into 4 Seasonal Quadrants (Spring, Summer, Autumn, Winter)
 */
function generateTreeCoordinates(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const types = new Float32Array(count); // 0 = Trunk, 1 = Branch, 2 = Canopy Leaf
  const seasonTypes = new Float32Array(count); // 0 = Spring(봄), 1 = Summer(여름), 2 = Autumn(가을), 3 = Winter(겨울)

  // Four Seasons Color Palettes
  const springPalette = [
    new THREE.Color('#f472b6'), // Cherry Blossom Pink
    new THREE.Color('#fb7185'), // Blossom Rose
    new THREE.Color('#fbcfe8'), // Soft Pink Pearl
    new THREE.Color('#fef08a'), // Warm Blossom White
    new THREE.Color('#ffffff'), // Pure White
  ];

  const summerPalette = [
    new THREE.Color('#10b981'), // Lush Emerald Green
    new THREE.Color('#34d399'), // Mint Sparkle
    new THREE.Color('#2dd4bf'), // Soft Leaf Teal
    new THREE.Color('#a7f3d0'), // Fresh Lime Dew
    new THREE.Color('#ffffff'), // Pure White
  ];

  const autumnPalette = [
    new THREE.Color('#fb923c'), // Maple Orange
    new THREE.Color('#f97316'), // Amber Flame
    new THREE.Color('#ea580c'), // Crimson Copper
    new THREE.Color('#fde047'), // Harvest Gold
    new THREE.Color('#fef3c7'), // Warm Cream White
  ];

  const winterPalette = [
    new THREE.Color('#38bdf8'), // Glacier Ice Blue
    new THREE.Color('#7dd3fc'), // Diamond Frost
    new THREE.Color('#e0f2fe'), // Polar Pale Sapphire
    new THREE.Color('#ffffff'), // Crystal White
    new THREE.Color('#cbd5e1'), // Ice Silver
  ];

  const rootCount = Math.floor(count * 0.12);
  const trunkCount = Math.floor(count * 0.15);
  const branchCount = Math.floor(count * 0.15);
  const canopyCount = count - rootCount - trunkCount - branchCount;

  let idx = 0;

  // Helper function to pick color based on X-Z quadrant angle theta
  function getSeasonalColorAndType(x, z) {
    const theta = Math.atan2(z, x); // -PI to +PI
    let season = 0;
    let palette = springPalette;

    if (theta >= 0 && theta < Math.PI / 2) {
      // Quadrant 1: Spring (봄 🌸)
      season = 0;
      palette = springPalette;
    } else if (theta >= Math.PI / 2 && theta <= Math.PI) {
      // Quadrant 2: Summer (여름 🌿)
      season = 1;
      palette = summerPalette;
    } else if (theta >= -Math.PI && theta < -Math.PI / 2) {
      // Quadrant 3: Autumn (가을 🍁)
      season = 2;
      palette = autumnPalette;
    } else {
      // Quadrant 4: Winter (겨울 ❄️)
      season = 3;
      palette = winterPalette;
    }

    const col = palette[Math.floor(Math.random() * palette.length)].clone();
    return { color: col, season };
  }

  // 0. Root Base Particles (나무 밑동 & 뿌리 입자: 왼쪽 따뜻함 Red/Orange <--> 오른쪽 차가움 Cyan/Blue)
  const warmRootPalette = [
    new THREE.Color('#ef4444'), // Flame Red
    new THREE.Color('#dc2626'), // Crimson
    new THREE.Color('#f97316'), // Bright Orange
    new THREE.Color('#fb923c'), // Amber Coral
    new THREE.Color('#fde047'), // Harvest Gold
    new THREE.Color('#ffffff'), // Pure White
  ];

  const coolRootPalette = [
    new THREE.Color('#06b6d4'), // Vibrant Cyan
    new THREE.Color('#38bdf8'), // Sky Blue
    new THREE.Color('#2563eb'), // Royal Blue
    new THREE.Color('#6366f1'), // Deep Indigo
    new THREE.Color('#e0f2fe'), // Pale Frost
    new THREE.Color('#ffffff'), // Pure White
  ];

  for (let i = 0; i < rootCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rootSpread = Math.pow(Math.random(), 1.3) * 5.8; // Radiate outward from trunk base
    const px = Math.cos(angle) * rootSpread;
    const pz = Math.sin(angle) * rootSpread;
    const py = -7.5 - Math.random() * 1.5 - (rootSpread * 0.12);

    positions[idx * 3] = px;
    positions[idx * 3 + 1] = py;
    positions[idx * 3 + 2] = pz;

    let color;
    if (px < -0.3) {
      color = warmRootPalette[Math.floor(Math.random() * warmRootPalette.length)].clone();
    } else if (px > 0.3) {
      color = coolRootPalette[Math.floor(Math.random() * coolRootPalette.length)].clone();
    } else {
      const blend = (px + 0.3) / 0.6;
      color = warmRootPalette[0].clone().lerp(coolRootPalette[0], blend);
    }

    colors[idx * 3] = color.r;
    colors[idx * 3 + 1] = color.g;
    colors[idx * 3 + 2] = color.b;

    scales[idx] = 1.3 + Math.random() * 2.2;
    types[idx] = 3; // Root base type
    seasonTypes[idx] = px < 0 ? 2 : 3;
    idx++;
  }

  // 1. Tree Trunk
  for (let i = 0; i < trunkCount; i++) {
    const progress = Math.random(); // 0 (bottom root) to 1 (trunk top)
    const y = -7.5 + progress * 7.5; // -7.5 to 0.0

    // Root flare at bottom
    const rootFlare = progress < 0.25 ? (1.0 - progress / 0.25) * 1.6 : 0;
    const radius = (0.85 * (1.0 - progress * 0.45) + rootFlare) * (0.8 + Math.random() * 0.4);
    const angle = Math.random() * Math.PI * 2;

    const curveX = Math.sin(progress * Math.PI) * 0.35;
    const curveZ = Math.cos(progress * Math.PI * 0.8) * 0.25;

    const px = curveX + radius * Math.cos(angle);
    const pz = curveZ + radius * Math.sin(angle);

    positions[idx * 3] = px;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = pz;

    const { color, season } = getSeasonalColorAndType(px, pz);
    
    if (radius < 0.45) {
      color.lerp(new THREE.Color('#ffffff'), 0.55);
    }

    colors[idx * 3] = color.r;
    colors[idx * 3 + 1] = color.g;
    colors[idx * 3 + 2] = color.b;

    scales[idx] = 1.1 + Math.random() * 1.9;
    types[idx] = 0;
    seasonTypes[idx] = season;
    idx++;
  }

  // 2. Primary Branches radiating into the 4 Quadrants
  const branchAngles = [0.35, 1.15, 1.95, 2.75, -2.75, -1.95, -1.15, -0.35];
  for (let i = 0; i < branchCount; i++) {
    const bIdx = i % branchAngles.length;
    const baseAngle = branchAngles[bIdx] + (Math.random() - 0.5) * 0.35;
    const progress = Math.random();

    const startY = -1.2 + Math.random() * 2.2;
    const branchLength = 3.2 + Math.random() * 3.2;

    const bX = Math.cos(baseAngle) * progress * branchLength;
    const bY = startY + progress * (2.2 + Math.random() * 1.8);
    const bZ = Math.sin(baseAngle) * progress * branchLength;

    const r = (1.0 - progress * 0.6) * 0.5 * Math.random();
    const subAngle = Math.random() * Math.PI * 2;

    const px = bX + r * Math.cos(subAngle);
    const pz = bZ + r * Math.sin(subAngle);

    positions[idx * 3] = px;
    positions[idx * 3 + 1] = bY + r * Math.sin(subAngle);
    positions[idx * 3 + 2] = pz;

    const { color, season } = getSeasonalColorAndType(px, pz);

    colors[idx * 3] = color.r;
    colors[idx * 3 + 1] = color.g;
    colors[idx * 3 + 2] = color.b;

    scales[idx] = 1.3 + Math.random() * 2.2;
    types[idx] = 1;
    seasonTypes[idx] = season;
    idx++;
  }

  // 3. Canopy / Foliage Crown distributed across 4 Seasonal Quadrants (EXPANDED CANOPY SIZE)
  for (let i = 0; i < canopyCount; i++) {
    const quadrant = i % 4; // 0=Spring, 1=Summer, 2=Autumn, 3=Winter
    let baseAngleOffset = 0;
    if (quadrant === 0) baseAngleOffset = Math.PI * 0.25; // Spring (+X, +Z)
    else if (quadrant === 1) baseAngleOffset = Math.PI * 0.75; // Summer (-X, +Z)
    else if (quadrant === 2) baseAngleOffset = -Math.PI * 0.75; // Autumn (-X, -Z)
    else if (quadrant === 3) baseAngleOffset = -Math.PI * 0.25; // Winter (+X, -Z)

    // Spread angle within quadrant (+/- PI/4)
    const angle = baseAngleOffset + (Math.random() - 0.5) * (Math.PI * 0.48);
    // Expand radius up to 6.8 units for a grand, impressive crown top
    const distFromCenter = 0.5 + Math.pow(Math.random(), 0.82) * 6.8;

    const px = Math.cos(angle) * distFromCenter;
    const pz = Math.sin(angle) * distFromCenter;
    
    // Dome shaped top canopy crown height profile (taller in center and upper branches, reaching y ~ 7.5)
    const domeHeight = Math.cos((distFromCenter / 7.2) * Math.PI * 0.5) * 3.8;
    const py = 0.8 + Math.random() * 5.2 + domeHeight;

    positions[idx * 3] = px;
    positions[idx * 3 + 1] = py;
    positions[idx * 3 + 2] = pz;

    const { color, season } = getSeasonalColorAndType(px, pz);

    colors[idx * 3] = color.r;
    colors[idx * 3 + 1] = color.g;
    colors[idx * 3 + 2] = color.b;

    scales[idx] = 1.6 + Math.random() * 3.2;
    types[idx] = 2;
    seasonTypes[idx] = season;
    idx++;
  }

  return { positions, colors, scales, types, seasonTypes };
}

/**
 * Majestic Tree of Light Particle System (with 4 Seasonal Quadrants)
 */
export class TreeParticleSystem {
  constructor(scene, count = 5500) {
    this.scene = scene;
    this.count = count;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.initialPositions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.scales = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.speeds = new Float32Array(count);
    this.phases = new Float32Array(count);
    this.types = new Float32Array(count);
    this.seasonTypes = new Float32Array(count);

    this.shockwaves = [];
    this.interactionType = 'repulsor'; // 'repulsor' | 'attractor' | 'vortex'
    this.visible = true;

    this.initTree();
    this.initMaterial();

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  initTree() {
    const { positions, colors, scales, types, seasonTypes } = generateTreeCoordinates(this.count);

    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3] = positions[i * 3];
      this.positions[i * 3 + 1] = positions[i * 3 + 1];
      this.positions[i * 3 + 2] = positions[i * 3 + 2];

      this.initialPositions[i * 3] = positions[i * 3];
      this.initialPositions[i * 3 + 1] = positions[i * 3 + 1];
      this.initialPositions[i * 3 + 2] = positions[i * 3 + 2];

      this.velocities[i * 3] = 0;
      this.velocities[i * 3 + 1] = 0;
      this.velocities[i * 3 + 2] = 0;

      this.colors[i * 3] = colors[i * 3];
      this.colors[i * 3 + 1] = colors[i * 3 + 1];
      this.colors[i * 3 + 2] = colors[i * 3 + 2];

      this.scales[i] = scales[i];
      this.alphas[i] = 0.6 + Math.random() * 0.35;
      this.speeds[i] = 0.5 + Math.random() * 0.8;
      this.phases[i] = Math.random() * Math.PI * 2;
      this.types[i] = types[i];
      this.seasonTypes[i] = seasonTypes[i];
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aScale', new THREE.BufferAttribute(this.scales, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('aSpeed', new THREE.BufferAttribute(this.speeds, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
  }

  initMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: ParticleShader.vertexShader,
      fragmentShader: ParticleShader.fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uGlowIntensity: { value: 0.65 },
        uMousePos: { value: new THREE.Vector3(999, 999, 999) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  setInteractionType(type) {
    this.interactionType = type;
  }

  setGlowIntensity(value) {
    this.material.uniforms.uGlowIntensity.value = value;
  }

  triggerShockwave(worldPos) {
    this.shockwaves.push({
      position: worldPos.clone(),
      radius: 0.1,
      maxRadius: 9.0,
      strength: 1.1,
      speed: 14.0,
    });
  }

  update(time, delta, mouseWorldPos, mouseVelocity, sensitivity = 1.0) {
    if (!this.visible) return;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uMousePos.value.copy(mouseWorldPos);

    const positions = this.geometry.attributes.position.array;
    const initialPositions = this.initialPositions;
    const velocities = this.velocities;

    // Update Shockwaves
    for (let s = this.shockwaves.length - 1; s >= 0; s--) {
      const sw = this.shockwaves[s];
      sw.radius += sw.speed * delta;
      if (sw.radius > sw.maxRadius) {
        this.shockwaves.splice(s, 1);
      }
    }

    const mouseDistRadius = 1.8 * sensitivity;

    // Gentle global tree sway
    const windSwayX = Math.sin(time * 0.8) * 0.12;
    const windSwayZ = Math.cos(time * 0.6) * 0.08;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      let px = positions[idx];
      let py = positions[idx + 1];
      let pz = positions[idx + 2];

      let vx = velocities[idx];
      let vy = velocities[idx + 1];
      let vz = velocities[idx + 2];

      const type = this.types[i];
      const season = this.seasonTypes[i];
      let ix = initialPositions[idx];
      let iy = initialPositions[idx + 1];
      let iz = initialPositions[idx + 2];

      // Seasonal Micro-Motion dynamics:
      // 0: Spring (봄) - Fluttering blossom wave
      // 1: Summer (여름) - Vigorous green leaf sway
      // 2: Autumn (가을) - Slow leaf drift & floating swirl
      // 3: Winter (겨울) - Crisp, slow sparkling ice float
      if (type === 2) {
        const hFactor = Math.max(0, (iy - 0.0) / 7.0);
        ix += windSwayX * hFactor;
        iz += windSwayZ * hFactor;

        if (season === 0) {
          // Spring: Flutter
          iy += Math.sin(time * 1.8 + i) * 0.003;
          ix += Math.cos(time * 1.2 + i) * 0.002;
        } else if (season === 1) {
          // Summer: Active sway
          ix += Math.sin(time * 2.2 + i) * 0.004;
          iz += Math.cos(time * 1.6 + i) * 0.003;
        } else if (season === 2) {
          // Autumn: Gentle downward drift swirl
          iy -= Math.sin(time * 0.8 + i) * 0.002;
          ix += Math.sin(time * 1.1 + i) * 0.003;
        } else if (season === 3) {
          // Winter: Frost shimmer
          iz += Math.sin(time * 0.5 + i) * 0.001;
        }
      } else if (type === 3) {
        // Root Base (나무 밑동 & 뿌리): Ground pulse wave
        iy += Math.sin(time * 1.4 + ix * 0.7) * 0.002;
        ix += Math.cos(time * 1.1 + iz * 0.7) * 0.0015;
      }

      // Distance to Visitor Pointer
      const dx = px - mouseWorldPos.x;
      const dy = py - mouseWorldPos.y;
      const dz = pz - mouseWorldPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Visitor Interactions
      if (dist < mouseDistRadius) {
        const force = (1.0 - dist / mouseDistRadius) * 0.18 * sensitivity * (1.0 + mouseVelocity * 2.2);

        if (this.interactionType === 'repulsor') {
          vx += (dx / (dist + 0.001)) * force;
          vy += (dy / (dist + 0.001)) * force;
          vz += (dz / (dist + 0.001)) * force;
        } else if (this.interactionType === 'attractor') {
          vx -= (dx / (dist + 0.001)) * force * 0.85;
          vy -= (dy / (dist + 0.001)) * force * 0.85;
          vz -= (dz / (dist + 0.001)) * force * 0.85;
        } else if (this.interactionType === 'vortex') {
          vx += (-dy / (dist + 0.001)) * force * 1.3;
          vy += (dx / (dist + 0.001)) * force * 1.3;
          vz += Math.sin(time + i) * force * 0.6;
        }
      }

      // Shockwave Reactions
      for (const sw of this.shockwaves) {
        const swDx = px - sw.position.x;
        const swDy = py - sw.position.y;
        const swDz = pz - sw.position.z;
        const swDist = Math.sqrt(swDx * swDx + swDy * swDy + swDz * swDz);
        const waveDiff = Math.abs(swDist - sw.radius);

        if (waveDiff < 1.2) {
          const swForce = (1.0 - waveDiff / 1.2) * sw.strength * (1.0 - sw.radius / sw.maxRadius);
          vx += (swDx / (swDist + 0.001)) * swForce;
          vy += (swDy / (swDist + 0.001)) * swForce;
          vz += (swDz / (swDist + 0.001)) * swForce;
        }
      }

      // Elastic Spring Force back to home tree coordinate
      vx += (ix - px) * 0.022;
      vy += (iy - py) * 0.022;
      vz += (iz - pz) * 0.022;

      // Friction / Damping
      vx *= 0.90;
      vy *= 0.90;
      vz *= 0.90;

      positions[idx] = px + vx;
      positions[idx + 1] = py + vy;
      positions[idx + 2] = pz + vz;

      velocities[idx] = vx;
      velocities[idx + 1] = vy;
      velocities[idx + 2] = vz;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }
}

