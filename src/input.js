// input.js — the INPUT LAYER.
//
// Produces a normalized signal each frame and publishes it onto the "house bus"
// that every scene reads: the globals `filteredSignal[]` (per-band energy),
// `micLevel`, plus `ds` and `avx` computed downstream from them.
//
// Sources are pluggable: 'fake' (synthesised beat, no audio needed) and 'audio'
// (live FFT). MIDI slots in here later as another source. Multi-channel is
// modelled now — `channels[]` holds N independent {level, bands[]} — even though
// only channel 0 currently feeds the house bus. A band setup maps instruments to
// channels; scenes will opt into channels in a later phase.

const Input = {
  BANDS: 11,          // number of frequency bands the artwork expects
  channels: [],       // [{ level, bands:[...] }]
  mic: null,
  fft: null,
  _filterBuf: [],     // moving-average buffers, per band (audio smoothing)

  setup() {
    this.mic = new p5.AudioIn();
    this.fft = new p5.FFT(0.8, 512);
    this.fft.setInput(this.mic);
    this.channels = [this._blankChannel()];
    for (let i = 0; i < this.BANDS; i++) this._filterBuf[i] = [];
  },

  _blankChannel() {
    return { level: 0, bands: new Array(this.BANDS).fill(0) };
  },

  // Called once per frame from the engine. Fills channel 0 and bridges it to the
  // house bus (filteredSignal[], micLevel).
  update() {
    if (VJ.motionSource === 'fake') {
      this._fakeBeat(this.channels[0]);
    } else {
      this._analyzeAudio(this.channels[0]);
    }

    const ch = this.channels[0];
    for (let i = 0; i < this.BANDS; i++) filteredSignal[i] = ch.bands[i];
    micLevel = ch.level;
  },

  // --- Fake source: a peaky kick envelope + slow wobble, tempo-scaled. -------
  _fakeBeat(ch) {
    const t = frameCount * 0.04 * (VJ.tempo / 6.0);
    const kick = Math.pow(Math.sin(t) * 0.5 + 0.5, 5);
    const wobble = noise(frameCount * 0.015);
    const level = kick * 42 + wobble * 12;

    for (let i = 0; i < this.BANDS; i++) {
      const bandVar = 0.55 + 0.45 * noise(i * 5.3, frameCount * 0.02);
      ch.bands[i] = level * bandVar;
    }
    ch.level = level / 100;
  },

  // --- Audio source: FFT -> banded, scaled, moving-average smoothed. ---------
  _analyzeAudio(ch) {
    ch.level = this.mic ? this.mic.getLevel() : 0;
    const spectrum = this.fft.analyze();

    const audioAmp = 40.0;
    const audioMax = 100;
    let indexAmp = 0.2;
    const indexStep = 0.35;

    for (let i = 0; i < this.BANDS; i++) {
      const startBin = Math.floor(i * spectrum.length / this.BANDS);
      const endBin = Math.floor((i + 1) * spectrum.length / this.BANDS);
      let sum = 0;
      for (let j = startBin; j < endBin; j++) sum += spectrum[j];
      const avg = sum / Math.max(1, endBin - startBin);

      let val = (avg / 255.0 * audioAmp) * indexAmp;
      val = constrain(val, 0, audioMax) * 2.0 * VJ.sensitivity;
      indexAmp += indexStep;

      // moving-average smoothing (5-frame window)
      const buf = this._filterBuf[i];
      buf.push(val);
      if (buf.length > 5) buf.shift();
      ch.bands[i] = buf.reduce((a, b) => a + b, 0) / buf.length;
    }
  },

  // Live device selection (used by the console's input dropdown).
  getSources() {
    return this.mic ? this.mic.getSources() : Promise.resolve([]);
  },
  setSource(index, onOk, onErr) {
    if (!this.mic) return;
    this.mic.stop();
    this.mic.setSource(index);
    this.mic.start(onOk, onErr);
  },
  startMic(onOk, onErr) {
    if (this.mic) this.mic.start(onOk, onErr);
  },
};
