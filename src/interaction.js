import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Hands } from '@mediapipe/hands';

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

    // Hand Gesture State (Palm vs Fist vs Pinch/2-finger)
    this.currentGesture = 'palm'; // 'palm' | 'fist' | 'pinch'
    this.fistScore = 0;
    this.pinchScore = 0;
    this.lastFistTime = 0;

    // Previous pinch coordinates for space rotation tracking
    this.prevPinchX = null;
    this.prevPinchY = null;
    this.prevTwoHandDist = null;

    // MediaPipe Hands Detector
    this.handsDetector = null;
    this.usingMediaPipe = false;
    this.isProcessingHandFrame = false;
    this.extendedFingerCount = 5;

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
  initMediaPipeHands() {
    if (this.handsDetector) return;

    try {
      this.handsDetector = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });
      this.handsDetector.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.handsDetector.onResults((results) => this.onHandResults(results));
    } catch (err) {
      console.warn('MediaPipe Hands init fallback:', err);
      this.handsDetector = null;
    }
  }

  onHandResults(results) {
    if (!this.isWebcamActive) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.usingMediaPipe = true;

      // Distance helper
      const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z - p2.z) || 0);

      const analyzeHand = (landmarks) => {
        const wrist = landmarks[0];

        const indexExtended = dist(landmarks[8], wrist) > dist(landmarks[6], wrist) * 1.08;
        const middleExtended = dist(landmarks[12], wrist) > dist(landmarks[10], wrist) * 1.08;
        const ringExtended = dist(landmarks[16], wrist) > dist(landmarks[14], wrist) * 1.08;
        const pinkyExtended = dist(landmarks[20], wrist) > dist(landmarks[18], wrist) * 1.08;
        const thumbExtended = dist(landmarks[4], landmarks[17]) > dist(landmarks[2], landmarks[17]) * 1.12;

        let extendedCount = 0;
        if (indexExtended) extendedCount++;
        if (middleExtended) extendedCount++;
        if (ringExtended) extendedCount++;
        if (pinkyExtended) extendedCount++;
        if (thumbExtended) extendedCount++;

        const pinchTipDist = dist(landmarks[4], landmarks[8]);
        const handSize = dist(landmarks[0], landmarks[9]); // Wrist to middle MCP
        const isPinchTips = pinchTipDist < handSize * 0.45;
        const isPinch = (extendedCount === 2) || (isPinchTips && extendedCount <= 3);

        const palmCenter = landmarks[9];
        return { extendedCount, isPinch, palmCenter };
      };

      const hand0 = analyzeHand(results.multiHandLandmarks[0]);
      let hand1 = null;
      if (results.multiHandLandmarks.length >= 2) {
        hand1 = analyzeHand(results.multiHandLandmarks[1]);
      }

      // Check if BOTH hands are making the 2-finger pinch gesture
      if (hand0 && hand1 && hand0.isPinch && hand1.isPinch) {
        const currentTwoHandDist = Math.hypot(
          hand0.palmCenter.x - hand1.palmCenter.x,
          hand0.palmCenter.y - hand1.palmCenter.y
        );

        if (this.prevTwoHandDist !== null) {
          const distDelta = currentTwoHandDist - this.prevTwoHandDist;

          // If distance between hands changed
          if (Math.abs(distDelta) > 0.002) {
            // Spreading hands apart (distDelta > 0) -> Zoom IN (bring camera closer)
            // Bringing hands together (distDelta < 0) -> Zoom OUT
            if (this.camera && this.controls) {
              const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
              const currentDist = dir.length();
              const zoomFactor = distDelta * 22.0;
              const newDist = Math.max(3.0, Math.min(45.0, currentDist - zoomFactor));
              if (currentDist > 0.001) {
                dir.setLength(newDist);
                this.camera.position.addVectors(this.controls.target, dir);
                this.controls.update();
              }
            }
          }
        }
        this.prevTwoHandDist = currentTwoHandDist;

        // Pointer location is middle between both hands
        const avgHandX = (hand0.palmCenter.x + hand1.palmCenter.x) * 0.5;
        const avgHandY = (hand0.palmCenter.y + hand1.palmCenter.y) * 0.5;

        const targetMouseX = (1.0 - avgHandX) * 2 - 1;
        const targetMouseY = -(avgHandY * 2 - 1);

        this.mouse.x += (targetMouseX - this.mouse.x) * 0.4;
        this.mouse.y += (targetMouseY - this.mouse.y) * 0.4;
        this.hasMoved = true;

        this.processGestureState('two_hand_zoom', avgHandX, avgHandY, 2);
        return;
      }

      // Reset two hand distance when not performing two hand pinch gesture
      this.prevTwoHandDist = null;

      // Single hand processing
      this.extendedFingerCount = hand0.extendedCount;
      const handX = hand0.palmCenter.x;
      const handY = hand0.palmCenter.y;

      const targetMouseX = (1.0 - handX) * 2 - 1;
      const targetMouseY = -(handY * 2 - 1);

      this.mouse.x += (targetMouseX - this.mouse.x) * 0.4;
      this.mouse.y += (targetMouseY - this.mouse.y) * 0.4;
      this.hasMoved = true;

      if (hand0.isPinch) {
        this.pinchScore = Math.min(this.pinchScore + 1, 4);
        this.fistScore = 0;
      } else if (hand0.extendedCount <= 1) {
        this.fistScore = Math.min(this.fistScore + 1, 4);
        this.pinchScore = 0;
      } else if (hand0.extendedCount >= 3) {
        this.fistScore = 0;
        this.pinchScore = 0;
      } else {
        this.fistScore = Math.max(this.fistScore - 1, 0);
        this.pinchScore = Math.max(this.pinchScore - 1, 0);
      }

      let gesture = 'palm';
      if (this.pinchScore >= 2) {
        gesture = 'pinch';
      } else if (this.fistScore >= 2) {
        gesture = 'fist';
      }

      // Rotate 360 scene when 2-finger pinch gesture is active on single hand
      if (gesture === 'pinch') {
        if (this.prevPinchX !== null && this.prevPinchY !== null) {
          const deltaX = handX - this.prevPinchX;
          const deltaY = handY - this.prevPinchY;

          if (this.controls) {
            this.controls.rotateLeft(-deltaX * 4.5);
            this.controls.rotateUp(-deltaY * 3.5);
            this.controls.update();
          }
        }
        this.prevPinchX = handX;
        this.prevPinchY = handY;
      } else {
        this.prevPinchX = null;
        this.prevPinchY = null;
      }

      this.processGestureState(gesture, handX, handY, hand0.extendedCount);
    } else {
      this.usingMediaPipe = false;
      this.prevPinchX = null;
      this.prevPinchY = null;
      this.prevTwoHandDist = null;
    }
  }

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

      this.initMediaPipeHands();

      if (pipContainer) pipContainer.classList.remove('hidden');
      if (pipStatus) pipStatus.textContent = '손가락 인식 중';

      this.isWebcamActive = true;
      this.fistScore = 0;
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

    const pipContainer = document.getElementById('webcam-pip');
    if (pipContainer) pipContainer.classList.add('hidden');

    const pipDot = document.getElementById('pip-dot');
    if (pipDot) pipDot.style.opacity = '0';

    this.isWebcamActive = false;
    this.usingMediaPipe = false;
    this.prevFrame = null;
    this.fistScore = 0;
    this.pinchScore = 0;
    this.prevPinchX = null;
    this.prevPinchY = null;
    this.prevTwoHandDist = null;
  }

  processGestureState(gesture, handX, handY, fingerCount) {
    const gestureBadge = document.getElementById('gesture-badge');
    const gestureIcon = document.getElementById('gesture-icon');
    const gestureText = document.getElementById('gesture-text');
    const pipDot = document.getElementById('pip-dot');

    if (pipDot) {
      pipDot.style.opacity = '1';
      pipDot.style.left = `${(1.0 - handX) * 100}%`;
      pipDot.style.top = `${handY * 100}%`;
    }

    if (gesture === 'two_hand_zoom') {
      if (gestureIcon) gestureIcon.textContent = '👐';
      if (gestureText) {
        gestureText.textContent = '양손 2손가락 (화면 확대 / 줌인 🔍)';
        gestureText.className = 'font-semibold text-[11px] text-indigo-300';
      }
      if (gestureBadge) {
        gestureBadge.className = 'mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-950/90 border border-indigo-500/50 text-xs text-indigo-200 shadow-[0_0_14px_rgba(99,102,241,0.5)] transition-all scale-105';
      }
    } else if (gesture === 'pinch') {
      if (gestureIcon) gestureIcon.textContent = '🤌';
      if (gestureText) {
        gestureText.textContent = '2손가락 집기 (공간 360도 회전 중)';
        gestureText.className = 'font-semibold text-[11px] text-cyan-300';
      }
      if (gestureBadge) {
        gestureBadge.className = 'mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/90 border border-cyan-500/50 text-xs text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.5)] transition-all scale-105';
      }
    } else if (gesture === 'fist') {
      if (gestureIcon) gestureIcon.textContent = '✊';
      if (gestureText) {
        gestureText.textContent = '주먹 (모든 손가락 접힘 - 클릭!)';
        gestureText.className = 'font-semibold text-[11px] text-amber-300';
      }
      if (gestureBadge) {
        gestureBadge.className = 'mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/90 border border-amber-500/50 text-xs text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.5)] transition-all scale-105';
      }

      // Trigger Click Action (Shockwave) on Fist gesture with 500ms pulse cooldown
      const now = Date.now();
      if (now - this.lastFistTime > 500) {
        this.lastFistTime = now;
        this.triggerClickAction();
      }
    } else {
      // Open Palm (손바닥) -> Maintain normal hover/movement interaction
      if (gestureIcon) gestureIcon.textContent = '✋';
      if (gestureText) {
        const countStr = fingerCount !== undefined ? ` (${fingerCount}개 펴짐)` : '';
        gestureText.textContent = `손바닥${countStr} - 이동 중`;
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

    // Send frame to MediaPipe if initialized
    if (this.handsDetector && !this.isProcessingHandFrame) {
      this.isProcessingHandFrame = true;
      this.handsDetector.send({ image: this.videoElement })
        .then(() => { this.isProcessingHandFrame = false; })
        .catch(() => { this.isProcessingHandFrame = false; });
    }

    // Fallback Computer Vision process if MediaPipe is not tracking
    if (!this.usingMediaPipe) {
      this.motionCtx.drawImage(this.videoElement, 0, 0, 160, 120);
      const frame = this.motionCtx.getImageData(0, 0, 160, 120);
      const data = frame.data;

      let sumX = 0, sumY = 0, count = 0;
      let minX = 160, maxX = 0, minY = 120, maxY = 0;
      const handCoordsX = [];
      const handCoordsY = [];
      const prevData = this.prevFrame ? this.prevFrame.data : null;

      for (let i = 0; i < data.length; i += 12) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let isMotion = false;
        if (prevData) {
          const diff = Math.abs(r - prevData[i]) + Math.abs(g - prevData[i + 1]) + Math.abs(b - prevData[i + 2]);
          if (diff > 28) isMotion = true;
        }

        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        const isSkin = (r > 40 && g > 25 && b > 15 && r > g && g > b && (maxC - minC > 12) && Math.abs(r - g) >= 6);

        if (isMotion && isSkin) {
          const pixelIndex = i / 4;
          const x = pixelIndex % 160;
          const y = Math.floor(pixelIndex / 160);

          sumX += x; sumY += y; count++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          handCoordsX.push(x); handCoordsY.push(y);
        }
      }

      if (count >= 16) {
        const cx = sumX / count, cy = sumY / count;
        const avgX = cx / 160, avgY = cy / 120;

        const targetMouseX = (1.0 - avgX) * 2 - 1;
        const targetMouseY = -(avgY * 2 - 1);

        this.mouse.x += (targetMouseX - this.mouse.x) * 0.35;
        this.mouse.y += (targetMouseY - this.mouse.y) * 0.35;

        this.velocity = Math.min(count * 0.12, 8.0);
        this.smoothVelocity += (this.velocity - this.smoothVelocity) * 0.3;
        this.hasMoved = true;

        const boxW = Math.max(1, maxX - minX + 1);
        const boxH = Math.max(1, maxY - minY + 1);
        const aspect = Math.min(boxW, boxH) / Math.max(boxW, boxH);
        const density = count / (boxW * boxH);

        let maxDist = 0, sumDist = 0;
        const dists = [];
        const sampleStep = Math.max(1, Math.floor(handCoordsX.length / 80));

        for (let k = 0; k < handCoordsX.length; k += sampleStep) {
          const dist = Math.hypot(handCoordsX[k] - cx, handCoordsY[k] - cy);
          dists.push(dist);
          sumDist += dist;
          if (dist > maxDist) maxDist = dist;
        }

        const sampledCount = dists.length;
        if (sampledCount > 5) {
          const meanDist = sumDist / sampledCount;
          const spreadRatio = maxDist / (meanDist + 0.001);

          let varianceSum = 0;
          for (let k = 0; k < sampledCount; k++) {
            const diff = dists[k] - meanDist;
            varianceSum += diff * diff;
          }
          const stdDev = Math.sqrt(varianceSum / sampledCount);
          const varRatio = stdDev / (meanDist + 0.001);

          const isFist = (density >= 0.46) && (aspect >= 0.55) && (spreadRatio <= 1.48) && (varRatio <= 0.32);
          const isOpenPalm = (spreadRatio > 1.52) || (varRatio > 0.35) || (density < 0.38);

          if (isFist) {
            this.fistScore = Math.min(this.fistScore + 1, 5);
          } else if (isOpenPalm) {
            this.fistScore = 0;
          } else {
            this.fistScore = Math.max(this.fistScore - 1, 0);
          }

          const gesture = this.fistScore >= 3 ? 'fist' : 'palm';
          this.processGestureState(gesture, avgX, avgY);
        }
      } else {
        this.fistScore = Math.max(this.fistScore - 1, 0);
      }

      this.prevFrame = frame;
    }
  }
}
