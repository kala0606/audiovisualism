// scenes.js — the SCENE LAYER.
//
// A scene is a small self-contained object:
//   { name, enter(), draw() }
// Scenes read only the "house bus" — filteredSignal[] (energy), ds (size),
// ds (energy size factor). Kolam scenes carry their own per-family palette. That
// keeps every scene coherent in form + speed, and what makes adding new ones
// cheap. enter() (re)seeds the elements a scene needs; draw() renders a frame.
//
// The manager owns the active scene and the scene-change policy driven by
// VJ.sceneChange ('timed' | 'manual' | 'audio').

const Scenes = {
  list: [],
  index: 0,
  lastSwitchFrame: 0,

  register(scene) {
    this.list.push(scene);
    return this.list.length - 1;
  },

  current() {
    return this.list[this.index];
  },

  enter(i) {
    this.index = ((i % this.list.length) + this.list.length) % this.list.length;
    this.lastSwitchFrame = frameCount;
    VJ.activeScene = this.index;
    // Request a framebuffer clear on the next draw so scenes don't ghost into
    // each other. Deferring to draw() guarantees it runs inside the GL cycle.
    // (Within a scene we deliberately don't clear — that's the house trails.)
    this.clearPending = true;
    const s = this.current();
    if (s && s.enter) s.enter();
  },

  next() { this.enter(this.index + 1); },
  prev() { this.enter(this.index - 1); },
  randomCut() {
    if (this.list.length <= 1) return this.enter(this.index);
    let n = this.index;
    while (n === this.index) n = Math.floor(random(this.list.length));
    this.enter(n);
  },

  draw() {
    const s = this.current();
    if (s && s.draw) s.draw();
  },

  // Scene-change policy, evaluated once per frame after draw().
  tick() {
    if (VJ.sceneChange === 'timed') {
      const everyFrames = Math.max(30, Math.round(VJ.sceneChangeEvery * 60));
      if (frameCount - this.lastSwitchFrame >= everyFrames) this.randomCut();
    } else if (VJ.sceneChange === 'audio') {
      if (filteredSignal[3] > 1 && frameCount - this.lastSwitchFrame > 90 &&
          frameCount % 30 === 0 && random() < 0.15) {
        this.randomCut();
      }
    }
    // 'manual' → no automatic cuts.
  },
};
