import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Handles mouse, touch, raycasting, camera parallax, and 360 degree OrbitControls
 */
export class InteractionManager {
  constructor(camera, renderer, scene) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;

    // Pointer Coordinates
    this.mouse = new THREE.Vector2(0, 0); // Normalized (-1 to +1)
    this.prevMouse = new THREE.Vector2(0, 0);
    this.screenMouse = new THREE.Vector2(0.5, 0.5); // Screen (0 to 1)
    
    // Velocity & World Position
    this.velocity = 0;
    this.smoothVelocity = 0;
    this.mouseWorldPos = new THREE.Vector3(0, 0, 0);

    // Raycasting Plane
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Plane perpendicular to camera

    // 360 Degree Orbit Controls
    this.initOrbitControls();

    // Touch & Move Listeners
    this.hasMoved = false;
    this.onShockwaveCallbacks = [];

    // Optional Webcam Motion & Hand Gesture Tracking
    this.isWebcamActive = false;
    this.videoElement = null;
    this.motionCanvas = null;
    this.motionCtx = null;
    this.prevFrame = null;

    // Hand Gesture State (Palm vs Fist)
    this.currentGesture = 'palm'; // 'palm' | 'fist'
    this.lastFistTime = 0;
    this.mediaPipeHands = null;
    this.usingMediaPipe = false;

    this.initListeners();
  }

  initOrbitControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotate = true; // Smooth 360 degree ambient rotation
    this.controls.autoRotateSpeed = 0.6; // Speed of 360 degree rotation
    this.controls.target.set(0, -1.0, 0); // Pivot around the central tree trunk
    this.controls.minDistance = 6.0;
    this.controls.maxDistance = 45.0;
  }

  initListeners() {
    const onPointerMove = (e) => {
      this.hasMoved = true;
      const x = e.clientX || (e.touches && e.touches[0].clientX);
      const y = e.clientY || (e.touches && e.touches[0].clientY);

      if (x !== undefined && y !== undefined) {
        this.screenMouse.x = x / window.innerWidth;
        this.screenMouse.y = 1.0 - (y / window.innerHeight);

        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;
      }
    };

    const onPointerDown = (e) => {
      onPointerMove(e);
      this.updateWorldPos();
      
      // Trigger shockwave callbacks
      for (const cb of this.onShockwaveCallbacks) {
        cb(this.mouseWorldPos);
      }
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mousedown', onPointerDown, { passive: true });
    window.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  onShockwave(callback) {
    this.onShockwaveCallbacks.push(callback);
  }

  updateWorldPos() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Dynamic plane facing the camera direction through origin
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    this.plane.setFromNormalAndCoplanarPoint(cameraDir.clone().negate(), new THREE.Vector3(0, 0, 0));

    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, target)) {
      this.mouseWorldPos.lerp(target, 0.35);
    }
  }

  update(delta) {
    // 1. Update 360 Degree OrbitControls
    if (this.controls) {
      this.controls.update();
    }

    // 2. Calculate Pointer Velocity
    const dx = this.mouse.x - this.prevMouse.x;
    const dy = this.mouse.y - this.prevMouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.velocity = dist / (delta + 0.001);
    this.smoothVelocity += (this.velocity - this.smoothVelocity) * 0.15;

    this.prevMouse.copy(this.mouse);

    // 3. Update 3D Raycasted World Position
    this.updateWorldPos();

    // 4. Webcam Motion Processing (if enabled)
    if (this.isWebcamActive && this.motionCtx) {
      this.processWebcamFrame();
    }
  }

  triggerClickAction() {
    this.updateWorldPos();
    
    // Trigger shockwave callbacks (same as mouse click)
    for (const cb of this.onShockwaveCallbacks) {
      cb(this.mouseWorldPos);
    }
  }

  // --- Webcam Motion & Hand Gesture Detection ---
  async toggleWebcam() {
    if (this.isWebcamActive) {
      this.stopWebcam();
      return false;
    }

    const pipContainer = document.getElementById('webcam-pip');
    const pipVideo = document.getElementById('pip-video');
    const pipStatus = document.getElementById('pip-status');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('이 브라우저 환경에서는 카메라 API를 지원하지 않습니다.');
        return false;
      }

      if (pipStatus) pipStatus.textContent = '권한 요청 중...';

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
      });

      this.videoElement = pipVideo || document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.setAttribute('playsinline', '');
      this.videoElement.srcObject = stream;

      await this.videoElement.play().catch(e => console.warn('Video play auto error:', e));

      this.motionCanvas = document.createElement('canvas');
      this.motionCanvas.width = 160;
      this.motionCanvas.height = 120;
      this.motionCtx = this.motionCanvas.getContext('2d', { willReadFrequently: true });

      // Initialize MediaPipe Hands if available in window
      if (window.Hands) {
        try {
          this.mediaPipeHands = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
          });
          this.mediaPipeHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,
            minDetectionConfidence: 0.45,
            minTrackingConfidence: 0.45
          });
          this.mediaPipeHands.onResults((results) => this.handleMediaPipeResults(results));
        } catch (mpErr) {
          console.warn('MediaPipe init fallback to CV:', mpErr);
        }
      }

      if (pipContainer) pipContainer.classList.remove('hidden');
      if (pipStatus) pipStatus.textContent = '손 동작 감지 중';

      this.isWebcamActive = true;
      return true;
    } catch (err) {
      console.warn('Webcam permission denied or error:', err);
      if (pipStatus) pipStatus.textContent = '연결 실패';
      if (pipContainer) pipContainer.classList.add('hidden');
      alert('카메라 접근 권한이 거부되었거나 이용 가능한 카메라가 없습니다.\n브라우저 주소창의 카메라 권한을 [허용]으로 설정해주세요.');
      this.isWebcamActive = false;
      return false;
    }
  }

  stopWebcam() {
    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject;
      if (stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
      }
      this.videoElement.srcObject = null;
    }
    if (this.mediaPipeHands) {
      try { this.mediaPipeHands.close(); } catch (_) {}
      this.mediaPipeHands = null;
    }
    const pipContainer = document.getElementById('webcam-pip');
    if (pipContainer) pipContainer.classList.add('hidden');

    const pipDot = document.getElementById('pip-dot');
    if (pipDot) pipDot.style.opacity = '0';

    this.isWebcamActive = false;
    this.usingMediaPipe = false;
    this.prevFrame = null;
  }

  handleMediaPipeResults(results) {
    if (!this.isWebcamActive) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.usingMediaPipe = true;
      const landmarks = results.multiHandLandmarks[0];
      const wrist = landmarks[0];
      const palmCenter = landmarks[9]; // Middle finger MCP

      // Calculate finger tip curling relative to wrist and MCP joints
      const tips = [8, 12, 16, 20];
      const mcps = [5, 9, 13, 17];
      let curledFingers = 0;

      for (let i = 0; i < 4; i++) {
        const tipDist = Math.hypot(landmarks[tips[i]].x - wrist.x, landmarks[tips[i]].y - wrist.y);
        const mcpDist = Math.hypot(landmarks[mcps[i]].x - wrist.x, landmarks[mcps[i]].y - wrist.y);
        if (tipDist < mcpDist * 1.15) {
          curledFingers++;
        }
      }

      // Thumb tip (4) vs pinky MCP (17)
      const thumbTipDist = Math.hypot(landmarks[4].x - landmarks[17].x, landmarks[4].y - landmarks[17].y);
      const thumbMcpDist = Math.hypot(landmarks[2].x - landmarks[17].x, landmarks[2].y - landmarks[17].y);
      if (thumbTipDist < thumbMcpDist * 1.25) {
        curledFingers++;
      }

      const handX = palmCenter.x;
      const handY = palmCenter.y;

      // Update screen coordinates (mirrored for camera)
      this.mouse.x = (1.0 - handX) * 2 - 1;
      this.mouse.y = -(handY * 2 - 1);
      this.hasMoved = true;

      // Gesture determination: 3 or more curled fingers = FIST (주먹)
      const gesture = curledFingers >= 3 ? 'fist' : 'palm';
      this.processGestureState(gesture, handX, handY);
    } else {
      this.usingMediaPipe = false;
    }
  }

  processGestureState(gesture, handX, handY) {
    const gestureBadge = document.getElementById('gesture-badge');
    const gestureIcon = document.getElementById('gesture-icon');
    const gestureText = document.getElementById('gesture-text');
    const pipDot = document.getElementById('pip-dot');

    if (pipDot) {
      pipDot.style.opacity = '1';
      pipDot.style.left = `${(1.0 - handX) * 100}%`;
      pipDot.style.top = `${handY * 100}%`;
    }

    if (gesture === 'fist') {
      if (gestureIcon) gestureIcon.textContent = '✊';
      if (gestureText) {
        gestureText.textContent = '주먹 (클릭 파동 실행!)';
        gestureText.className = 'font-semibold text-[11px] text-amber-300';
      }
      if (gestureBadge) {
        gestureBadge.className = 'mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/90 border border-amber-500/50 text-xs text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all scale-105';
      }

      // Trigger Click Action (Shockwave) on Fist gesture with 600ms pulse cooldown
      const now = Date.now();
      if (now - this.lastFistTime > 600) {
        this.lastFistTime = now;
        this.triggerClickAction();
      }
    } else {
      // Open Palm (손바닥) -> Maintain normal hover/movement interaction
      if (gestureIcon) gestureIcon.textContent = '✋';
      if (gestureText) {
        gestureText.textContent = '손바닥 (인터랙션 유지)';
        gestureText.className = 'font-medium text-[11px] text-emerald-300';
      }
      if (gestureBadge) {
        gestureBadge.className = 'mt-2 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/90 border border-white/10 text-xs text-slate-200 transition-all';
      }
    }

    this.currentGesture = gesture;
  }

  processWebcamFrame() {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    this.motionCtx.drawImage(this.videoElement, 0, 0, 160, 120);
    const frame = this.motionCtx.getImageData(0, 0, 160, 120);

    // Send frame to MediaPipe if initialized
    if (this.mediaPipeHands && this.videoElement) {
      try {
        this.mediaPipeHands.send({ image: this.videoElement }).catch(() => {});
      } catch (_) {}
    }

    // Motion & CV Fallback processing
    if (this.prevFrame) {
      let sumX = 0, sumY = 0, count = 0;
      let minX = 160, maxX = 0, minY = 120, maxY = 0;
      const data = frame.data;
      const prevData = this.prevFrame.data;

      for (let i = 0; i < data.length; i += 12) {
        const diff = Math.abs(data[i] - prevData[i]) +
                     Math.abs(data[i+1] - prevData[i+1]) +
                     Math.abs(data[i+2] - prevData[i+2]);

        if (diff > 38) {
          const pixelIndex = i / 4;
          const x = pixelIndex % 160;
          const y = Math.floor(pixelIndex / 160);

          sumX += x;
          sumY += y;
          count++;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      if (count > 15) {
        const avgX = (sumX / count) / 160;
        const avgY = (sumY / count) / 120;

        if (!this.usingMediaPipe) {
          const targetMouseX = (1.0 - avgX) * 2 - 1;
          const targetMouseY = -(avgY * 2 - 1);

          this.mouse.x += (targetMouseX - this.mouse.x) * 0.4;
          this.mouse.y += (targetMouseY - this.mouse.y) * 0.4;

          this.velocity = Math.min(count * 0.1, 8.0);
          this.smoothVelocity += (this.velocity - this.smoothVelocity) * 0.3;
          this.hasMoved = true;

          // Computer Vision gesture ratio fallback:
          // Compact box & high fill density = Fist (주먹), Extended fingers = Open Palm (손바닥)
          const boxW = Math.max(1, maxX - minX + 1);
          const boxH = Math.max(1, maxY - minY + 1);
          const fillRatio = count / (boxW * boxH);

          const pixelGesture = fillRatio > 0.55 ? 'fist' : 'palm';
          this.processGestureState(pixelGesture, avgX, avgY);
        }
      }
    }

    this.prevFrame = frame;
  }
}
