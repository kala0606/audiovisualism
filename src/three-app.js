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
// Tubes are white; each family's identity is a 3-SHADE lighting scheme
// (key + fill + rim are distinct shades of the family's palette). `rad` is the
// single uniform tube width for that family.
const FAMILIES = [
  { name: 'Mandala',    family: 'Mandala',    sub: 0.5,  spa: 1.5, rad: 0.0036,
    key: 0xff2d4a, fill: 0xb0286a, rim: 0xff8a3a, amb: 0x1a0810 }, // crimson / magenta / orange
  { name: 'Sikku',      family: 'Sikku',      sub: 0.4,  spa: 1.4, rad: 0.0034,
    key: 0xffa81f, fill: 0xc4571a, rim: 0xfff08a, amb: 0x1a1206 }, // amber / bronze / pale gold
  { name: 'Labyrinth',  family: 'Labyrinth',  sub: 0.6,  spa: 2.0, rad: 0.0040,
    key: 0x18b8b0, fill: 0x2060c0, rim: 0x8ffff0, amb: 0x06181e }, // teal / blue / cyan
  { name: 'Minimalist', family: 'Minimalist', sub: 0.45, spa: 1.3, rad: 0.0044,
    key: 0xffffff, fill: 0xd0b0ff, rim: 0xa8c8ff, amb: 0x14141e }, // white / lavender / cool blue
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

const SAMP = 6;
// Sample a bezier stroke into a small polyline (unit-square coords).
function sampleStroke(s) {
  const pts = [];
  for (let k = 0; k <= SAMP; k++) {
    const t = k / SAMP, u = 1 - t;
    pts.push([
      u * u * u * s.x1 + 3 * u * u * t * s.cx1 + 3 * u * t * t * s.cx2 + t * t * t * s.x2,
      u * u * u * s.y1 + 3 * u * u * t * s.cy1 + 3 * u * t * t * s.cy2 + t * t * t * s.y2,
    ]);
  }
  return pts;
}
const nkey = (p) => Math.round(p[0] * 2000) + '_' + Math.round(p[1] * 2000);

// Merge strokes that share endpoints into continuous polyline chains, so a
// kolam draws as a few long connected paths (like a single-line plot).
function mergeToPaths(strokes) {
  const items = strokes.map((s) => ({ pts: sampleStroke(s), used: false }));
  const nodes = new Map();
  const add = (k, i) => { (nodes.get(k) || nodes.set(k, []).get(k)).push(i); };
  items.forEach((it, i) => { add(nkey(it.pts[0]), i); add(nkey(it.pts[it.pts.length - 1]), i); });

  const findNext = (k) => {
    const list = nodes.get(k) || [];
    for (const i of list) if (!items[i].used) return i;
    return -1;
  };

  const paths = [];
  for (let si = 0; si < items.length; si++) {
    if (items[si].used) continue;
    items[si].used = true;
    let chain = items[si].pts.slice();
    let grew = true;
    while (grew) { // extend the tail
      grew = false;
      const tk = nkey(chain[chain.length - 1]);
      const ni = findNext(tk);
      if (ni >= 0) {
        items[ni].used = true;
        const seg = items[ni].pts.slice();
        if (nkey(seg[0]) !== tk) seg.reverse();
        for (let j = 1; j < seg.length; j++) chain.push(seg[j]);
        grew = true;
      }
    }
    grew = true;
    while (grew) { // extend the head
      grew = false;
      const hk = nkey(chain[0]);
      const ni = findNext(hk);
      if (ni >= 0) {
        items[ni].used = true;
        const seg = items[ni].pts.slice();
        if (nkey(seg[seg.length - 1]) !== hk) seg.reverse();
        chain = seg.slice(0, seg.length - 1).concat(chain);
        grew = true;
      }
    }
    paths.push(chain);
  }
  return paths;
}

// Build one merged tube geometry (normalised) — continuous paths, ONE width.
function buildKolamGeometry(fam) {
  Kolam.generate(fam.family, fam.sub, fam.spa);
  const paths = mergeToPaths(Kolam.strokes);
  const geoms = [];
  for (let ci = 0; ci < paths.length; ci++) {
    const pts = paths[ci];
    const closed = pts.length > 3 && nkey(pts[0]) === nkey(pts[pts.length - 1]);
    const z = (hash(ci) - 0.5) * 0.05; // per-chain relief (constant → stays continuous)
    const n = closed ? pts.length - 1 : pts.length;
    const vecs = [];
    for (let j = 0; j < n; j++) vecs.push(new THREE.Vector3(pts[j][0], -pts[j][1], z));
    if (vecs.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(vecs, closed, 'catmullrom', 0.5);
    const tubular = Math.max(8, Math.min(700, vecs.length * 2));
    geoms.push(new THREE.TubeGeometry(curve, tubular, fam.rad, 6, closed));
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
  keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(1000, 1500, 950);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 100;
  keyLight.shadow.camera.far = 6000;
  const sc = keyLight.shadow.camera;
  sc.left = -1800; sc.right = 1800; sc.top = 1800; sc.bottom = -1800;
  keyLight.shadow.bias = -0.0008;
  scene.add(keyLight);

  // Fill from the opposite side — a second, visible shade.
  fillLight = new THREE.DirectionalLight(0xffffff, 1.8);
  fillLight.position.set(-1300, -700, 600);
  scene.add(fillLight);

  // Rim from behind — the third shade, edge glow.
  rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
  rimLight.position.set(100, 700, -1700);
  scene.add(rimLight);

  ambient = new THREE.AmbientLight(0xffffff, 0.28);
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
