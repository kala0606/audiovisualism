// engine.js — p5 lifecycle for the Kolam instrument.
//
// Thin orchestrator: pull a signal from the Input layer, derive the small set of
// values the Kolam scenes read (energy is on filteredSignal[]; ds is a gentle
// size factor), draw the active family scene, then apply the scene-change policy.

// --- Signal bus (read by scenes) -------------------------------------------
let filteredSignal = [];  // per-band energy, published by Input
let micLevel = 0;
let ds = 1.0;             // gentle size factor derived from energy

// Layout
let WIDTH, HEIGHT, DIM, M;

// Debug
let showDebug = false;

function setup() {
  // Guard a zero-size viewport (some embedded/preview contexts report 0 at load).
  const w = windowWidth || 1280;
  const h = windowHeight || 720;
  createCanvas(w, h, WEBGL);
  bezierDetail(6); // kolam curves are short arcs — low tessellation, cheap lines
  WIDTH = w; HEIGHT = h;
  DIM = Math.max(1, Math.min(WIDTH, HEIGHT));
  M = DIM / 1000.0;

  Input.setup();
  for (let i = 0; i < Input.BANDS; i++) filteredSignal[i] = 0;

  registerKolamScenes();
  if (typeof applyURLParams === 'function') applyURLParams();
  applyMode(VJ.mode);

  // A ?family=... link locks to that family (no cuts); else open on Mandala.
  let openIdx = Scenes.list.findIndex((s) => s.name === 'Mandala');
  if (VJ.lockKolamFamily) {
    const idx = Scenes.list.findIndex((s) => s.family === VJ.lockKolamFamily);
    if (idx >= 0) { openIdx = idx; VJ.sceneChange = 'manual'; }
  }
  Scenes.enter(openIdx >= 0 ? openIdx : 0);

  if (typeof onEngineReady === 'function') onEngineReady();
  console.log('audiovisualism (kolam) engine ready.');
}

function draw() {
  WIDTH = width; HEIGHT = height;
  DIM = Math.max(1, Math.min(WIDTH, HEIGHT));
  M = DIM / 1000.0;

  ambientLight(120);
  directionalLight(255, 255, 255, 0.3, 0.4, -1);

  // 1. Input -> signal bus
  Input.update();

  // 2. Gentle size factor from energy
  ds = constrain(map(filteredSignal[3], 0, 50, 0.7, 1.6), 0.6, 2.0);

  // 3. Kolam scenes clear every frame (crisp); otherwise clear only on a cut.
  const cs = Scenes.current();
  if (Scenes.clearPending || (cs && cs.clearEveryFrame)) {
    background(0);
    Scenes.clearPending = false;
  }
  Scenes.draw();
  Scenes.tick();

  if (showDebug) drawDebugInfo();
}

// --- Debug overlay ---------------------------------------------------------
function drawDebugInfo() {
  camera();
  fill(0, 0, 0, 150); noStroke();
  rect(-width / 2 + 10, -height / 2 + 10, 260, 120);
  fill(255); textSize(12); textAlign(LEFT);
  let y = -height / 2 + 30;
  const line = (t) => { text(t, -width / 2 + 20, y); y += 16; };
  const s = Scenes.current();
  line('DEBUG');
  line('family: ' + (s && s.name));
  line('mode: ' + VJ.mode + '  src: ' + VJ.motionSource + '  cut: ' + VJ.sceneChange);
  line('filtered[3]: ' + filteredSignal[3].toFixed(2) + '  ds: ' + ds.toFixed(2));
  line('strokes: ' + (s && s.strokes ? s.strokes.length : 0));
}

function keyPressed() {
  if (key === ' ') Scenes.randomCut();
  if (key === 'a') Scenes.next();
  if (key === 'd') showDebug = !showDebug;
  if (key === 'm') Input.startMic();
}

function windowResized() {
  resizeCanvas(windowWidth || 1280, windowHeight || 720);
  if (typeof Scenes !== 'undefined' && Scenes.list.length) Scenes.enter(Scenes.index);
}
