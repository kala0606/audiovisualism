// three-app.js — the Kolam instrument rendered in three.js.
//
// Each kolam is real 3D geometry: every arc becomes a thin TubeGeometry (radius
// varies per stroke), all merged into ONE mesh per plane — built once on the GPU,
// so flying is just moving meshes (fast). A directional light + shadow maps give
// real shading and cast shadows; fog fades the depth; an afterimage pass adds
// motion blur. Flight speed is driven by FFT energy (Input.energy).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── Families: colour + generation params + base tube radius ─────────────────
// Tubes are white; each family's identity comes from its LIGHTING rig
// (key = main colour, fill = shadow tint, rim = edge glow, amb = ambient tint).
const FAMILIES = [
  { name: 'Mandala',    family: 'Mandala',    sub: 0.5,  spa: 1.5, rad: 0.0034,
    key: 0xff3a58, fill: 0x401018, rim: 0xff9a86, amb: 0x1c0a10 },
  { name: 'Sikku',      family: 'Sikku',      sub: 0.4,  spa: 1.4, rad: 0.0032,
    key: 0xffb020, fill: 0x3a2408, rim: 0xffe6a0, amb: 0x1c1608 },
  { name: 'Labyrinth',  family: 'Labyrinth',  sub: 0.6,  spa: 2.0, rad: 0.0038,
    key: 0x22c8c0, fill: 0x08303a, rim: 0x9affff, amb: 0x081e22 },
  { name: 'Minimalist', family: 'Minimalist', sub: 0.45, spa: 1.3, rad: 0.0040,
    key: 0xffffff, fill: 0x2a2a34, rim: 0xc8d4ff, amb: 0x14141c },
];

const L = 5;              // planes in the corridor
const SP = 850;           // spacing between planes (world units)
const NEAR = -260;        // recycle only after a plane has flown past the camera
const FOV = 60;

let renderer, scene, camera, keyLight, fillLight, rimLight, ambient;
let planes = [];
let curFam = FAMILIES[0];
let W = 1200;
let lastCut = 0;
let travel = 0;           // cumulative distance flown — accumulates FFT energy
const SPEED_K = 0.3;      // energy → forward step per frame

const fract = (x) => x - Math.floor(x);
const hash = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);

// Build one merged tube geometry (normalised, unit-square) for a family.
function buildKolamGeometry(fam) {
  Kolam.generate(fam.family, fam.sub, fam.spa);
  const strokes = Kolam.strokes;
  const geoms = [];
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    const h = hash(i);
    const z = (h - 0.5) * 0.035; // slight depth relief → self-shadowing
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(s.x1, -s.y1, z),
      new THREE.Vector3(s.cx1, -s.cy1, z),
      new THREE.Vector3(s.cx2, -s.cy2, z),
      new THREE.Vector3(s.x2, -s.y2, z)
    );
    const r = fam.rad * (0.4 + 1.3 * h); // varying thickness
    geoms.push(new THREE.TubeGeometry(curve, 10, r, 6, false));
  }
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  return merged || new THREE.BufferGeometry();
}

function makeMesh() {
  const geo = buildKolamGeometry(curFam);
  // White, opaque — all colour comes from the lights.
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function rebuildPlane(p) {
  p.mesh.geometry.dispose();
  p.mesh.geometry = buildKolamGeometry(curFam);
}

function updateW() {
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = (FOV * Math.PI) / 180;
  W = 2 * SP * Math.tan(vFOV / 2) * Math.max(1, aspect) * 1.16;
}

function setFamilyLights(fam) {
  keyLight.color.setHex(fam.key);
  fillLight.color.setHex(fam.fill);
  rimLight.color.setHex(fam.rim);
  ambient.color.setHex(fam.amb);
}

function setFamily(family) {
  const f = FAMILIES.find((x) => x.family === family);
  if (!f) return;
  curFam = f;
  setFamilyLights(f);
  for (const p of planes) rebuildPlane(p);
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'gl';
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, SP * 1.1, NEAR + L * SP * 0.98);

  camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 1, 30000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);

  // Lighting rig — colour + shadows come from here (tubes are white).
  keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(900, 1600, 1000);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 100;
  keyLight.shadow.camera.far = 6000;
  const sc = keyLight.shadow.camera;
  sc.left = -1800; sc.right = 1800; sc.top = 1800; sc.bottom = -1800;
  keyLight.shadow.bias = -0.0008;
  scene.add(keyLight);

  fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
  fillLight.position.set(-1200, -500, 700);
  scene.add(fillLight);

  rimLight = new THREE.DirectionalLight(0xffffff, 2.4);
  rimLight.position.set(200, 400, -1800);
  scene.add(rimLight);

  ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  setFamilyLights(curFam);

  updateW();
  for (let i = 0; i < L; i++) {
    const p = { mesh: makeMesh(), dist: NEAR + (i + 0.5) * SP };
    p.mesh.scale.setScalar(W);
    p.mesh.position.z = -p.dist;
    planes.push(p);
  }

  window.addEventListener('resize', onResize);

  // Console API + family lock.
  exposeScenes();
  if (typeof applyURLParams === 'function') applyURLParams();
  applyMode(VJ.mode);
  if (VJ.lockKolamFamily) {
    VJ.sceneChange = 'manual';
    const idx = FAMILIES.findIndex((f) => f.family === VJ.lockKolamFamily);
    if (idx >= 0) window.Scenes.enter(idx);
  }
  if (typeof onEngineReady === 'function') onEngineReady();

  renderer.setAnimationLoop(frame);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateW();
}

function frame(nowMs) {
  Input.update(nowMs || performance.now());

  // Camera speed IS the music energy: accumulate it into forward travel.
  // (Silent → still; loud → surges forward.) This is the integral of energy,
  // not a function of time.
  const step = Input.energy * SPEED_K;
  travel += step;

  for (const p of planes) {
    p.dist -= step;
    if (p.dist <= NEAR) { p.dist += L * SP; rebuildPlane(p); }
    p.mesh.position.z = -p.dist;
    p.mesh.scale.setScalar(W);
  }

  // Full-app family cycling (locked links stay put).
  if (!VJ.lockKolamFamily && VJ.sceneChange === 'timed') {
    const t = nowMs || performance.now();
    if (t - lastCut > VJ.sceneChangeEvery * 1000) { lastCut = t; window.Scenes.randomCut(); }
  }

  renderer.render(scene, camera);
}

// Minimal Scenes API so the existing console keeps working.
function exposeScenes() {
  window.Scenes = {
    list: FAMILIES.map((f) => ({ name: f.name, family: f.family })),
    index: 0,
    current() { return this.list[this.index]; },
    enter(i) {
      this.index = ((i % this.list.length) + this.list.length) % this.list.length;
      setFamily(this.list[this.index].family);
    },
    next() { this.enter(this.index + 1); },
    prev() { this.enter(this.index - 1); },
    randomCut() {
      let n = this.index;
      if (this.list.length > 1) while (n === this.index) n = Math.floor(Math.random() * this.list.length);
      this.enter(n);
    },
  };
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Manual frame stepping (for headless/hidden-tab verification where rAF pauses).
window.__step = (n = 1) => { for (let i = 0; i < n; i++) frame(performance.now()); };
window.__info = () => ({
  planes: planes.map((p) => Math.round(p.dist)),
  family: curFam.family,
  W: Math.round(W),
  energy: +Input.energy.toFixed(1),
});
