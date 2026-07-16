// input.js — audio input on the Web Audio API (no p5).
//
// Publishes a single smoothed `energy` value (~0..50) that drives the flight
// speed. In Auto mode a synthesised beat provides the energy (no mic needed);
// in Semi/Manual the live mic/line-in does, via an AnalyserNode FFT.

const Input = {
  ctx: null,
  analyser: null,
  data: null,
  stream: null,
  srcNode: null,
  live: false,
  energy: 0,
  floor: 0,        // adaptive ambient noise floor
  _devices: [],

  ensureCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.82;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  },

  async startMic(onOk, onErr, deviceId) {
    try {
      this.ensureCtx();
      await this.ctx.resume();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      const audio = deviceId ? { deviceId: { exact: deviceId } } : true;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
      if (this.srcNode) this.srcNode.disconnect();
      this.srcNode = this.ctx.createMediaStreamSource(this.stream);
      this.srcNode.connect(this.analyser);
      this.live = true;
      if (onOk) onOk();
    } catch (e) {
      this.live = false;
      if (onErr) onErr(e);
    }
  },

  async getSources() {
    const devs = await navigator.mediaDevices.enumerateDevices();
    this._devices = devs
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ label: d.label, deviceId: d.deviceId }));
    return this._devices;
  },

  setSource(index, onOk, onErr) {
    const d = this._devices[index];
    this.startMic(onOk, onErr, d && d.deviceId);
  },

  // Called once per frame. Updates `energy` from the live mic (0 when not live;
  // three-app substitutes Perlin self-motion in that case).
  update() {
    if (!this.live) { this.energy = 0; return 0; }
    this.analyser.getByteFrequencyData(this.data);

    // Level from the mid band, skipping the lowest bins (fan rumble / subsonic).
    const lo = 3, hi = Math.min(110, this.data.length);
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += this.data[i];
    const level = sum / (hi - lo) / 255; // 0..1

    // Adaptive noise floor: a steady sound (a fan) is tracked out; only changes
    // ABOVE the ambient floor — beats, claps, speech onsets — drive energy.
    this.floor += (level - this.floor) * 0.04;
    let dyn = level - this.floor;
    if (dyn < 0.008) dyn = 0; // gate tiny fluctuations

    const target = dyn * 320 * VJ.sensitivity;
    // Fast attack, slower release for a musical envelope.
    const rate = target > this.energy ? 0.55 : 0.12;
    this.energy += (target - this.energy) * rate;
    return this.energy;
  },
};
