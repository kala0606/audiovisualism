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

  // Called once per frame. Updates `energy`.
  update(nowMs) {
    if (VJ.motionSource === 'fake' || !this.live) {
      const t = (nowMs / 1000) * (0.35 + VJ.tempo * 0.11);
      const kick = Math.pow(Math.sin(t * Math.PI * 2) * 0.5 + 0.5, 5);
      this.energy = kick * 40 + 6; // 6..46
    } else {
      this.analyser.getByteFrequencyData(this.data);
      const n = Math.min(64, this.data.length);
      let sum = 0;
      for (let i = 2; i < n; i++) sum += this.data[i];
      const avg = sum / (n - 2) / 255; // 0..1
      this.energy = avg * 95 * VJ.sensitivity;
    }
    return this.energy;
  },
};
