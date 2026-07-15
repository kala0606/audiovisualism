// engine.js — p5 lifecycle + the "house bus" the visuals read.
//
// Thin orchestrator: each frame it pulls a signal from the Input layer, derives
// the house-bus values (ds, avx) the artwork expects, draws the active Scene,
// then lets the Scene manager apply its scene-change policy.

// --- House bus (globals the visual primitives read) ------------------------
let filteredSignal = [];   // per-band energy, published by Input
let micLevel = 0;
let ds = 1.0;              // dynamic size multiplier (from energy)
let avx = 0.0;             // accumulated rotation phase (from energy)

// Palette lookup tables (built from VJ.palette)
let clr1A = [];
let clr1B = [];
let clr1Num = 160;
let clr1Cnt = -1, clr2Cnt = -1;

// Visual element handles + variant selectors (house style)
let boids = [], whiteBoids = [];
let grid, gridCh;
let sine, sineCh;
let boidCh;
let rx, ry, rz;
let rotCray = false;

// Layout globals
let WIDTH, HEIGHT, DIM, M;
let s = 10;

// Debug
let showDebug = false;
let spectrumSum = 0;

function setup() {
  // Guard against a zero-size viewport (some embedded/preview contexts report
  // 0 innerWidth at load): fall back to a sane default so element scale (M) is
  // never 0 — an M of 0 makes Grid/Sine step sizes 0 and would hang the loop.
  const w = windowWidth || 1280;
  const h = windowHeight || 720;
  createCanvas(w, h, WEBGL);
  WIDTH = w; HEIGHT = h;
  DIM = Math.max(1, Math.min(WIDTH, HEIGHT));
  M = DIM / 1000.0;

  Input.setup();
  for (let i = 0; i < Input.BANDS; i++) filteredSignal[i] = 0;

  setColourTables();

  registerHouseScenes();
  applyMode(VJ.mode);
  Scenes.enter(VJ.activeScene);

  if (typeof onEngineReady === 'function') onEngineReady();
  console.log('audiovisualism engine ready.');
}

function draw() {
  WIDTH = width; HEIGHT = height;
  DIM = Math.max(1, Math.min(WIDTH, HEIGHT));
  M = DIM / 1000.0;
  rectMode(CENTER);

  ambientLight(100);
  directionalLight(255, 255, 255, 0.5, 0.5, -1);

  // 1. Input -> house bus
  Input.update();

  // 2. Derive house-bus motion values from energy
  ds = constrain(map(filteredSignal[3], 0, 50, 0.5, 3.0), 0.3, 4.0);
  avx += filteredSignal[3] / 500.0;
  if (frameCount % 120 === 0) s = 1 + abs(noise(frameCount * 10) * 10);

  // 3. Render active scene, then apply scene-change policy
  Scenes.draw();
  Scenes.tick();

  if (showDebug) drawDebugInfo();
}

// --- House-style element initialisers --------------------------------------
function initializeBoids(count = null, yPos = null) {
  boids = [];
  boidCh = Math.floor(random(0, 3));
  const boidCount = count || Math.floor(random(100, 300));
  rx = random() < 0.5; ry = random() < 0.5; rz = random() < 0.5;

  for (let i = 0; i < boidCount; i++) {
    const x = random(-width / 2, width / 2);
    const y = yPos !== null ? yPos - height / 2 : random(-height / 2, height / 2);
    const z = random(-1000, 1000);
    boids.push(new Boid(x, y, z));
  }

  whiteBoids = [];
  const whiteCount = Math.floor(random(10, 50));
  for (let i = 0; i < whiteCount; i++) {
    const x = random(-width / 2, width / 2);
    const y = random(-height / 2, height / 2);
    const z = random(-1000, 1000);
    whiteBoids.push(new WhiteBoid(x, y, z));
  }
}

function initializeGrid() {
  gridCh = Math.floor(random(0, 3));
  grid = new Grid();
}

function initializeSine() {
  sineCh = Math.floor(random(0, 3));
  sine = new Sine();
}

function updateAndDisplayBoids() {
  for (const b of boids) { b.applyBehaviors(boids); b.update(); b.display(); b.edges(); }
  for (const w of whiteBoids) { w.applyBehaviors(whiteBoids); w.update(); w.display(); w.edges(); }
}

// --- Palette ---------------------------------------------------------------
function setColourTables() {
  const pal = VJ.palette;
  const len = pal.length;
  const blk = Math.floor(clr1Num / len);
  clr1A = []; clr1B = [];
  clr1Cnt = -1; clr2Cnt = -1;

  for (let i = 0; i < clr1Num; i++) {
    if (i % blk === 0) clr1Cnt = (clr1Cnt + 1) % len;
    const c1 = color(pal[clr1Cnt][0], pal[clr1Cnt][1], pal[clr1Cnt][2]);
    const nxt = (clr1Cnt + 1) % len;
    const c2 = color(pal[nxt][0], pal[nxt][1], pal[nxt][2]);
    clr1A[i] = lerpColor(c1, c2, map(i, clr1Cnt * blk, (clr1Cnt + 1) * blk, 0.0, 1.0));
  }
  for (let i = 0; i < clr1Num; i++) {
    if (i % blk === 0) clr2Cnt = (clr2Cnt + 1) % len;
    const c1 = color(pal[clr2Cnt][0], pal[clr2Cnt][1], pal[clr2Cnt][2]);
    const nxt = (clr2Cnt + 1) % len;
    const c2 = color(pal[nxt][0], pal[nxt][1], pal[nxt][2]);
    clr1B[i] = lerpColor(c1, c2, map(i, clr2Cnt * blk, (clr2Cnt + 1) * blk, 0.0, 1.0));
  }
}

function getRandomChoice(choices) {
  return choices.length ? choices[Math.floor(random(choices.length))] : 0.0;
}

function strobe() { /* reserved: high-contrast flash hook for scene cuts */ }

// --- Debug overlay ---------------------------------------------------------
function drawDebugInfo() {
  camera();
  fill(0, 0, 0, 150); noStroke();
  rect(-width / 2 + 10, -height / 2 + 10, 260, 150);
  fill(255); textSize(12); textAlign(LEFT);
  let y = -height / 2 + 30;
  const line = (t) => { text(t, -width / 2 + 20, y); y += 16; };
  line('DEBUG');
  line('mode: ' + VJ.mode + '  src: ' + VJ.motionSource);
  line('scene: ' + Scenes.index + ' (' + (Scenes.current() && Scenes.current().name) + ')');
  line('filtered[3]: ' + filteredSignal[3].toFixed(2));
  line('ds: ' + ds.toFixed(2) + '  avx: ' + avx.toFixed(1));
  line('tempo: ' + VJ.tempo + '  sceneChange: ' + VJ.sceneChange);
}

function keyPressed() {
  if (key === ' ') Scenes.randomCut();
  if (key === 'a') Scenes.next();
  if (key === 'r') rotCray = !rotCray;
  if (key === 'd') showDebug = !showDebug;
  if (key === 'm') Input.startMic();
}

function windowResized() {
  const w = windowWidth || 1280;
  const h = windowHeight || 720;
  resizeCanvas(w, h);
  // Rebuild the active scene at the correct scale (elements sized from M).
  if (typeof Scenes !== 'undefined' && Scenes.list.length) Scenes.enter(Scenes.index);
}
