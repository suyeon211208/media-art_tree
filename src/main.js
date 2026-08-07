import * as THREE from 'three';
import { BackgroundShader } from './shaders.js';
import { createStarField, InteractiveParticleSystem, TreeParticleSystem } from './particles.js';
import { InteractionManager } from './interaction.js';
import { CosmicAudioEngine } from './audio.js';
import { RootGlowCanvas } from './rootGlow.js';

class CosmicMediaArtApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.canvas = document.getElementById('webgl-canvas');

    // Stats / Settings
    this.sensitivity = 1.0;
    this.clock = new THREE.Clock();

    this.initThree();
    this.initBackgroundMesh();
    this.initParticleSystems();
    this.initRootGlowCanvas();
    this.initInteraction();
    this.initAudio();
    this.initDOMControls();

    // Start Animation Loop
    this.animate();

    // Handle Resize
    window.addEventListener('resize', () => this.onResize(), { passive: true });
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 20);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  initBackgroundMesh() {
    // Background Fullscreen Quad Mesh
    this.bgMaterial = new THREE.ShaderMaterial({
      vertexShader: BackgroundShader.vertexShader,
      fragmentShader: BackgroundShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(BackgroundShader.uniforms),
      depthWrite: false,
      depthTest: false,
    });

    const bgPlane = new THREE.PlaneGeometry(2, 2);
    this.bgMesh = new THREE.Mesh(bgPlane, this.bgMaterial);
    
    // Create secondary background scene to render quad seamlessly
    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.bgScene.add(this.bgMesh);
  }

  initParticleSystems() {
    // 1. Distant Starfield & Dust
    this.starField = createStarField(2200);
    this.scene.add(this.starField.mesh);

    // 2. Majestic Central Particle Tree (Tree of Light)
    this.treeParticles = new TreeParticleSystem(this.scene, 14000);

    // 3. Ambient Flow Particle System
    this.particles = new InteractiveParticleSystem(this.scene, 3500);
  }

  initRootGlowCanvas() {
    this.rootGlow = new RootGlowCanvas('glow-canvas');
  }

  initInteraction() {
    this.interaction = new InteractionManager(this.camera, this.renderer, this.scene);

    // Shockwave on click / touch
    this.interaction.onShockwave((worldPos) => {
      this.particles.triggerShockwave(worldPos);
      this.treeParticles.triggerShockwave(worldPos);
      if (this.audio) {
        this.audio.playChime(Math.random());
      }
    });
  }

  initAudio() {
    this.audio = new CosmicAudioEngine();
  }

  initDOMControls() {
    const guidePrompt = document.getElementById('guide-prompt');

    // Hide initial guide prompt on first movement
    const onFirstMove = () => {
      if (this.interaction.hasMoved && guidePrompt) {
        guidePrompt.classList.add('fade-out');
        window.removeEventListener('mousemove', onFirstMove);
        window.removeEventListener('touchmove', onFirstMove);
      }
    };
    window.addEventListener('mousemove', onFirstMove);
    window.addEventListener('touchmove', onFirstMove);

    // Preset Buttons
    const modeButtons = document.querySelectorAll('[data-mode]');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        modeButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.getAttribute('data-mode');
        this.particles.setMode(mode);
      });
    });

    // Interaction Force Buttons
    const forceButtons = document.querySelectorAll('[data-force]');
    forceButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        forceButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const force = e.currentTarget.getAttribute('data-force');
        this.particles.setInteractionType(force);
        this.treeParticles.setInteractionType(force);
      });
    });

    // Sliders
    const glowSlider = document.getElementById('glow-slider');
    if (glowSlider) {
      glowSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.particles.setGlowIntensity(val);
        this.treeParticles.setGlowIntensity(val);
        if (this.rootGlow) {
          this.rootGlow.setGlowIntensity(val);
        }
      });
    }

    const sensSlider = document.getElementById('sensitivity-slider');
    if (sensSlider) {
      sensSlider.addEventListener('input', (e) => {
        this.sensitivity = parseFloat(e.target.value);
      });
    }

    // Audio Toggle
    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isPlaying = this.audio.toggleSound();
        audioBtn.classList.toggle('active', isPlaying);
        const textSpan = audioBtn.querySelector('.btn-text');
        if (textSpan) {
          textSpan.textContent = isPlaying ? '사운드 On' : '사운드 Off';
        }
      });
    }

    // Webcam Toggle
    const webcamBtn = document.getElementById('btn-webcam');
    if (webcamBtn) {
      webcamBtn.addEventListener('click', async () => {
        const active = await this.interaction.toggleWebcam();
        webcamBtn.classList.toggle('active', active);
        const textSpan = webcamBtn.querySelector('.btn-text');
        if (textSpan) {
          textSpan.textContent = active ? '카메라 감지 중' : '모션 카메라';
        }
      });
    }

    // Fullscreen Toggle
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => console.warn(err));
        } else {
          document.exitFullscreen().catch(err => console.warn(err));
        }
      });
    }

    // Hide HUD Toggle & Reveal on Hover in Top-Right Corner
    const toggleHudBtn = document.getElementById('btn-toggle-hud');
    const overlay = document.getElementById('ui-overlay');
    if (toggleHudBtn && overlay) {
      const updateToggleBtnState = () => {
        const isHidden = overlay.classList.contains('hidden-hud');
        toggleHudBtn.title = isHidden ? 'UI 보이기' : 'UI 숨기기';
      };

      toggleHudBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.classList.toggle('hidden-hud');
        if (!overlay.classList.contains('hidden-hud')) {
          toggleHudBtn.classList.remove('reveal-on-hover');
        }
        updateToggleBtnState();
      });

      const handleTopRightHover = (clientX, clientY) => {
        if (overlay.classList.contains('hidden-hud')) {
          const isTopRightCorner = (clientX >= window.innerWidth - 220) && (clientY <= 110);
          if (isTopRightCorner) {
            toggleHudBtn.classList.add('reveal-on-hover');
          } else {
            toggleHudBtn.classList.remove('reveal-on-hover');
          }
        } else {
          toggleHudBtn.classList.remove('reveal-on-hover');
        }
      };

      window.addEventListener('mousemove', (e) => {
        handleTopRightHover(e.clientX, e.clientY);
      });

      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          handleTopRightHover(e.touches[0].clientX, e.touches[0].clientY);
        }
      });
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.bgMaterial.uniforms.uResolution.value.set(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Interaction physics & velocities
    this.interaction.update(delta);

    // 2. Update Background Shader Uniforms
    this.bgMaterial.uniforms.uTime.value = elapsedTime;
    this.bgMaterial.uniforms.uMouse.value.set(
      this.interaction.screenMouse.x,
      this.interaction.screenMouse.y
    );
    this.bgMaterial.uniforms.uMouseVelocity.value = this.interaction.smoothVelocity;

    // 3. Update Starfield
    this.starField.update(elapsedTime);

    // 4. Update Particle Systems
    this.treeParticles.update(
      elapsedTime,
      delta,
      this.interaction.mouseWorldPos,
      this.interaction.smoothVelocity,
      this.sensitivity
    );

    this.particles.update(
      elapsedTime,
      delta,
      this.interaction.mouseWorldPos,
      this.interaction.smoothVelocity,
      this.sensitivity
    );

    // 5. Update Audio Engine
    if (this.audio) {
      this.audio.update(this.interaction.screenMouse.y, this.interaction.smoothVelocity);
    }

    // 6. Update 2D Canvas Root Glow
    if (this.rootGlow) {
      const treeBase3D = new THREE.Vector3(0, -7.5, 0);
      treeBase3D.project(this.camera);
      const screenX = (treeBase3D.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-treeBase3D.y * 0.5 + 0.5) * window.innerHeight;

      const mouseX = (this.interaction.screenMouse.x * 0.5 + 0.5) * window.innerWidth;
      const mouseY = (-this.interaction.screenMouse.y * 0.5 + 0.5) * window.innerHeight;
      this.rootGlow.updateMouse(mouseX, mouseY);

      this.rootGlow.render(elapsedTime, { x: screenX, y: screenY });
    }

    // 7. Render Pass
    this.renderer.autoClear = false;
    this.renderer.clear();
    
    // Render Background Quad first
    this.renderer.render(this.bgScene, this.bgCamera);
    
    // Render 3D Scene (Tree, Particles, Stars, Constellations)
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new CosmicMediaArtApp();
});

