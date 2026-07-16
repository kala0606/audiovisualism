// three-app.js — the Kolam instrument rendered in three.js.
//
// Each kolam is real 3D geometry: every arc becomes a thin TubeGeometry (radius
// varies per stroke), all merged into ONE mesh per plane — built once on the GPU,
// so flying is just moving meshes (fast). A directional light + shadow maps give
// real shading and cast shadows; fog fades the depth; an afterimage pass adds
// motion blur. Flight speed is driven by FFT energy (Input.energy).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

// ── Families: colour + generation params + base tube radius ─────────────────
const FAMILIES = [
  { name: 'Mandala',    family: 'Mandala',    sub: 0.5,  spa: 1.5, color: 0xff5a6e, rad: 0.0034 },
  { name: 'Sikku',      family: 'Sikku',      sub: 0.4,  spa: 1.4, color: 0xffc45c, rad: 0.0032 },
  { name: 'Labyrinth',  family: 'Labyrinth',  sub: 0.6,  spa: 2.0, color: 0x7ce8e0, rad: 0.0038 },
  { name: 'Minimalist', family: 'Minimalist', sub: 0.45, spa: 1.3, color: 0xeeeee8, rad: 0.0040 },
];

const L = 5;              // planes in the corridor
const SP = 850;           // spacing between planes (world units)
const NEAR = 90;          // recycle a plane once it gets this close
const FOV = 60;

let renderer, scene, camera, composer, after, keyLight;
let planes = [];
let curFam = FAMILIES[0];
let W = 1200;
let lastCut = 0;

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
  const mat = new THREE.MeshStandardMaterial({
    color: curFam.color, roughness: 0.5, metalness: 0.2,
    transparent: true, opacity: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function rebuildPlane(p) {
  p.mesh.geometry.dispose();
  p.mesh.geometry = buildKolamGeometry(curFam);
  p.mesh.material.color.setHex(curFam.color);
}

function updateW() {
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = (FOV * Math.PI) / 180;
  W = 2 * SP * Math.tan(vFOV / 2) * Math.max(1, aspect) * 1.16;
}

function setFamily(family) {
  const f = FAMILIES.find((x) => x.family === family);
  if (!f) return;
  curFam = f;
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

  // Lighting: a key light (casts shadows) + soft fill.
  keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(0.5, 0.9, 0.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 4000;
  const sc = keyLight.shadow.camera;
  sc.left = -1400; sc.right = 1400; sc.top = 1400; sc.bottom = -1400;
  keyLight.shadow.bias = -0.0009;
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x101014, 0.55));
  scene.add(new THREE.AmbientLight(0x404048, 0.6));

  updateW();
  for (let i = 0; i < L; i++) {
    const p = { mesh: makeMesh(), dist: NEAR + (i + 0.5) * SP };
    p.mesh.scale.setScalar(W);
    p.mesh.position.z = -p.dist;
    planes.push(p);
  }

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  after = new AfterimagePass(0.82); // motion blur (trails)
  composer.addPass(after);

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
  composer.setSize(window.innerWidth, window.innerHeight);
  updateW();
}

function frame(nowMs) {
  Input.update(nowMs || performance.now());
  const energy = Input.energy;
  const speed = 1.6 + energy * 0.3;

  for (const p of planes) {
    p.dist -= speed;
    if (p.dist <= NEAR) { p.dist += L * SP; rebuildPlane(p); }
    p.mesh.position.z = -p.dist;
    p.mesh.scale.setScalar(W);
    // Fade a plane out as it passes the camera so it doesn't pop on recycle.
    p.mesh.material.opacity = Math.min(1, Math.max(0, (p.dist - NEAR) / (SP * 0.5)));
  }

  after.uniforms['damp'].value = 0.72 + Math.min(0.2, energy * 0.004);

  // Full-app family cycling (locked links stay put).
  if (!VJ.lockKolamFamily && VJ.sceneChange === 'timed') {
    const t = nowMs || performance.now();
    if (t - lastCut > VJ.sceneChangeEvery * 1000) { lastCut = t; window.Scenes.randomCut(); }
  }

  composer.render();
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
