/**
 * Canvas 2D Glowing Bezier Curve Root System
 * Renders glowing organic root curves spreading outward from the tree base.
 * Left Side: Warm Colors (Red / Orange / Gold)
 * Right Side: Cool Colors (Cyan / Blue / Indigo)
 * Uses Canvas 2D bezierCurveTo and shadowBlur for a smooth glow effect.
 */
export class RootGlowCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.time = 0;
    this.glowIntensity = 0.65;
    this.mousePos = { x: -9999, y: -9999 };

    this.initCurves();
    this.resize();

    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  initCurves() {
    this.leftCurves = [];
    this.rightCurves = [];

    const curveCount = 14;

    // Generate Left Curves (Warm: Red / Orange / Amber)
    for (let i = 0; i < curveCount; i++) {
      const angle = Math.PI * 0.5 + (i / (curveCount - 1)) * (Math.PI * 0.45); // Spread down and left
      const length = 180 + Math.random() * 260;
      this.leftCurves.push({
        angle,
        length,
        width: 1.5 + Math.random() * 2.5,
        cp1Offset: (Math.random() - 0.5) * 60,
        cp2Offset: (Math.random() - 0.5) * 80,
        speed: 0.6 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        colorStart: `rgba(255, ${Math.floor(40 + Math.random() * 80)}, 0, `, // Red to Orange
        colorEnd: `rgba(255, ${Math.floor(140 + Math.random() * 100)}, 0, `, // Gold
      });
    }

    // Generate Right Curves (Cool: Cyan / Blue / Indigo)
    for (let i = 0; i < curveCount; i++) {
      const angle = Math.PI * 0.5 - (i / (curveCount - 1)) * (Math.PI * 0.45); // Spread down and right
      const length = 180 + Math.random() * 260;
      this.rightCurves.push({
        angle,
        length,
        width: 1.5 + Math.random() * 2.5,
        cp1Offset: (Math.random() - 0.5) * 60,
        cp2Offset: (Math.random() - 0.5) * 80,
        speed: 0.6 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        colorStart: `rgba(0, ${Math.floor(180 + Math.random() * 75)}, 255, `, // Cyan / Sky Blue
        colorEnd: `rgba(${Math.floor(90 + Math.random() * 60)}, 100, 255, `, // Indigo / Deep Blue
      });
    }
  }

  resize() {
    if (!this.canvas) return;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(this.dpr, this.dpr);
  }

  setGlowIntensity(val) {
    this.glowIntensity = val;
  }

  updateMouse(x, y) {
    this.mousePos.x = x;
    this.mousePos.y = y;
  }

  render(time, treeBaseScreenPos = null) {
    if (!this.canvas || !this.ctx) return;

    this.time = time;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Default tree base screen coordinate if projection not provided
    const centerX = treeBaseScreenPos ? treeBaseScreenPos.x : this.width * 0.5;
    const centerY = treeBaseScreenPos ? treeBaseScreenPos.y : this.height * 0.81;

    // 1. Large Ambient Floor Glow Gradient (Left Warm Red/Orange -> Right Cool Blue)
    const floorGradient = this.ctx.createLinearGradient(
      centerX - 350, centerY,
      centerX + 350, centerY
    );
    floorGradient.addColorStop(0, 'rgba(239, 68, 68, 0.12)'); // Left Red
    floorGradient.addColorStop(0.35, 'rgba(249, 115, 22, 0.08)'); // Orange
    floorGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)'); // Neutral Core
    floorGradient.addColorStop(0.65, 'rgba(56, 189, 248, 0.08)'); // Sky Blue
    floorGradient.addColorStop(1, 'rgba(99, 102, 241, 0.12)'); // Right Indigo

    this.ctx.save();
    this.ctx.fillStyle = floorGradient;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY + 20, 380, 75, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // 2. Render Left Bezier Curves (Warm Red / Orange Glow)
    this.renderCurveGroup(this.leftCurves, centerX, centerY, -1);

    // 3. Render Right Bezier Curves (Cool Cyan / Blue Glow)
    this.renderCurveGroup(this.rightCurves, centerX, centerY, 1);

    // 4. Central Glowing Root Node Aura
    this.ctx.save();
    const coreGlow = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, 45 * this.glowIntensity
    );
    coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    coreGlow.addColorStop(0.4, 'rgba(255, 180, 120, 0.4)');
    coreGlow.addColorStop(0.7, 'rgba(120, 200, 255, 0.2)');
    coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.ctx.fillStyle = coreGlow;
    this.ctx.shadowBlur = 25 * this.glowIntensity;
    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 40 * this.glowIntensity, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  renderCurveGroup(curves, centerX, centerY, sideSign) {
    curves.forEach((curve, i) => {
      const pulse = Math.sin(this.time * curve.speed + curve.phase);
      const waveAngle = curve.angle + Math.sin(this.time * 0.8 + i) * 0.08;
      const curLength = curve.length * (0.9 + 0.1 * pulse);

      const endX = centerX + Math.cos(waveAngle) * curLength;
      const endY = centerY + Math.sin(waveAngle) * curLength * 0.42;

      // Control points for Bezier curve
      const cp1x = centerX + (endX - centerX) * 0.35 + curve.cp1Offset * sideSign + Math.sin(this.time + i) * 15;
      const cp1y = centerY + (endY - centerY) * 0.2 - 20;

      const cp2x = centerX + (endX - centerX) * 0.75 + curve.cp2Offset * sideSign + Math.cos(this.time * 1.2 + i) * 20;
      const cp2y = centerY + (endY - centerY) * 0.85 + 15;

      // Distance to mouse for visitor interaction
      const midX = (centerX + endX) * 0.5;
      const midY = (centerY + endY) * 0.5;
      const mouseDist = Math.hypot(this.mousePos.x - midX, this.mousePos.y - midY);
      const mouseBoost = Math.max(0, 1.0 - mouseDist / 90);

      const alpha = (0.45 + 0.35 * pulse + mouseBoost * 0.4) * Math.min(1.0, this.glowIntensity * 1.2);

      // Create Gradient along the Bezier curve path
      const grad = this.ctx.createLinearGradient(centerX, centerY, endX, endY);
      grad.addColorStop(0, `${curve.colorStart}${alpha})`);
      grad.addColorStop(1, `${curve.colorEnd}${alpha * 0.2})`);

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);

      // Canvas 2D shadowBlur Glow
      this.ctx.shadowBlur = (12 + 10 * mouseBoost) * this.glowIntensity;
      this.ctx.shadowColor = sideSign < 0 ? '#ff5500' : '#00bfff';
      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = (curve.width + mouseBoost * 2.0) * this.glowIntensity;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();

      // Traveling Light Energy Particle along the Bezier curve
      const progress = (this.time * 0.4 * curve.speed + curve.phase / Math.PI) % 1.0;
      const t = progress;
      const px = Math.pow(1 - t, 3) * centerX +
                 3 * Math.pow(1 - t, 2) * t * cp1x +
                 3 * (1 - t) * Math.pow(t, 2) * cp2x +
                 Math.pow(t, 3) * endX;
      const py = Math.pow(1 - t, 3) * centerY +
                 3 * Math.pow(1 - t, 2) * t * cp1y +
                 3 * (1 - t) * Math.pow(t, 2) * cp2y +
                 Math.pow(t, 3) * endY;

      this.ctx.fillStyle = sideSign < 0 ? '#ffea00' : '#ffffff';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = sideSign < 0 ? '#ff3300' : '#00e5ff';
      this.ctx.beginPath();
      this.ctx.arc(px, py, (2.0 + Math.sin(t * Math.PI) * 2.0) * this.glowIntensity, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }
}
