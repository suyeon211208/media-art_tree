/**
 * Web Audio API Ambient Cosmic Sound Generator
 */
export class CosmicAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneGain = null;

    // Pentatonic scale frequencies in Hz
    this.pentatonicScale = [
      110.00, // A2
      130.81, // C3
      146.83, // D3
      164.81, // E3
      196.00, // G3
      220.00, // A3
      261.63, // C4
      293.66, // D4
      329.63, // E4
      392.00, // G4
      440.00, // A4
      523.25, // C5
    ];

    this.lastChimeTime = 0;
  }

  init() {
    if (this.ctx) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();

    // Drone Oscillators
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc2 = this.ctx.createOscillator();

    this.droneOsc1.type = 'sine';
    this.droneOsc2.type = 'triangle';

    this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1
    this.droneOsc2.frequency.setValueAtTime(82.41, this.ctx.currentTime); // E2

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // Lowpass Filter for warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    this.droneOsc1.connect(this.droneGain);
    this.droneOsc2.connect(this.droneGain);
    this.droneGain.connect(filter);
    filter.connect(this.ctx.destination);

    this.droneOsc1.start();
    this.droneOsc2.start();
  }

  toggleSound() {
    if (!this.ctx) {
      this.init();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;

    if (!this.isMuted) {
      this.droneGain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.5);
    } else {
      this.droneGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.3);
    }

    return !this.isMuted;
  }

  update(mouseYNorm, speedNorm) {
    if (!this.ctx || this.isMuted) return;

    // Pitch modulation based on cursor height
    const targetFreq = 55 + mouseYNorm * 30;
    this.droneOsc1.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.2);

    // Play subtle chimes when moving quickly
    if (speedNorm > 0.4 && this.ctx.currentTime - this.lastChimeTime > 0.35) {
      this.playChime(mouseYNorm);
      this.lastChimeTime = this.ctx.currentTime;
    }
  }

  playChime(heightFactor = 0.5) {
    if (!this.ctx || this.isMuted) return;

    const idx = Math.floor(heightFactor * (this.pentatonicScale.length - 1));
    const freq = this.pentatonicScale[Math.max(0, Math.min(idx, this.pentatonicScale.length - 1))];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    // Envelope
    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.9);
  }
}
