// three-app.js — the Kolam instrument in three.js.
//
// ONE combined flight through all families: they swap on their own, each shown
// for a Perlin-driven (smooth, varying) duration. Camera speed = accumulated
// energy — live music in manual mode, or Perlin self-motion when VJ.auto is on
// (or before a mic is granted). White tubes; a single magenta/pink/white
// lighting rig provides all the colour and the shadows.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// Families vary only the PATTERN (geometry), not colour.
const FAMILIES = [
  { family: 'Mandala',    sub: 0.5,  spa: 1.5, rad: 0.0036 },
  { family: 'Sikku',      sub: 0.4,  spa: 1.4, rad: 0.0034 },
  { family: 'Labyrinth',  sub: 0.6,  spa: 2.0, rad: 0.0040 },
  { family: 'Minimalist', sub: 0.45, spa: 1.3, rad: 0.0044 },
];

const L = 5;             // planes in the corridor
const SP = 850;          // spacing between planes
const NEAR = -260;       // recycle after a plane flies past the camera
const FOV = 60;
const SPEED_K = 0.3;     // energy → forward step per frame

let renderer, scene, camera, keyLight, fillLight, rimLight, ambient;
let planes = [];
let curFam = FAMILIES[0];
let famIdx = 0, switchCount = 0, nextSwitchMs = 4500;
let W = 1200;
let travel = 0;          // cumulative distance flown (accumulates energy)

const perlin = new ImprovedNoise();
const fract = (x) => x - Math.floor(x);
const hash = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);

// ── Geometry: continuous single-width tubes ────────────────────────────────
const SAMP = 6;
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
    while (grew) {
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
    while (grew) {
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

function buildKolamGeometry(fam) {
  Kolam.generate(fam.family, fam.sub, fam.spa);
  const paths = mergeToPaths(Kolam.strokes);
  const geoms = [];
  for (let ci = 0; ci < paths.length; ci++) {
    const pts = paths[ci];
    const closed = pts.length > 3 && nkey(pts[0]) === nkey(pts[pts.length - 1]);
    const z = (hash(ci) - 0.5) * 0.05;
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

function makeMesh(fam) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.1 });
  const mesh = new THREE.Mesh(buildKolamGeometry(fam), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function rebuildPlane(p) {
  p.mesh.geometry.dispose();
  p.mesh.geometry = buildKolamGeometry(p.fam);
}

function updateW() {
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = (FOV * Math.PI) / 180;
  W = 2 * SP * Math.tan(vFOV / 2) * Math.max(1, aspect) * 1.16;
}

// ── Motion + family scheduling (Perlin) ────────────────────────────────────
function selfEnergy(now) {
  const s = now * 0.001;
  const a = perlin.noise(s * 0.25, 0, 0);
  const b = perlin.noise(s * 0.9, 5.2, 0);
  const v = Math.max(0, Math.min(1, (a * 0.7 + b * 0.3) * 0.5 + 0.5));
  return 8 + v * 38; // smooth ~8..46
}

function updateFamily(now) {
  if (now < nextSwitchMs) return;
  switchCount++;
  famIdx = (famIdx + 1) % FAMILIES.length;
  curFam = FAMILIES[famIdx];
  const nz = Math.max(0, Math.min(1, perlin.noise(switchCount * 0.37, 20, 0) * 0.5 + 0.5));
  nextSwitchMs = now + (5 + nz * 9) * 1000; // 5..14s, smoothly varying
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

  // Single unified lighting rig: magenta key (shadows) + pink fill + white rim.
  keyLight = new THREE.DirectionalLight(0xe81ec8, 2.8); // magenta
  keyLight.position.set(1000, 1500, 950);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 100;
  keyLight.shadow.camera.far = 6000;
  const sc = keyLight.shadow.camera;
  sc.left = -1800; sc.right = 1800; sc.top = 1800; sc.bottom = -1800;
  keyLight.shadow.bias = -0.0008;
  scene.add(keyLight);

  fillLight = new THREE.DirectionalLight(0xff5aa0, 1.9); // pink
  fillLight.position.set(-1300, -700, 600);
  scene.add(fillLight);

  rimLight = new THREE.DirectionalLight(0xffffff, 2.3); // white
  rimLight.position.set(100, 700, -1700);
  scene.add(rimLight);

  ambient = new THREE.AmbientLight(0x2a0c22, 0.5); // faint magenta ambient
  scene.add(ambient);

  updateW();
  for (let i = 0; i < L; i++) {
    const p = { fam: curFam, mesh: makeMesh(curFam), dist: NEAR + (i + 0.5) * SP };
    p.mesh.scale.setScalar(W);
    p.mesh.position.z = -p.dist;
    planes.push(p);
  }

  window.addEventListener('resize', onResize);
  renderer.setAnimationLoop(frame);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateW();
}

function frame(nowMs) {
  const now = nowMs || performance.now();
  Input.update();

  // Manual (default) → live music; Auto (or no live mic) → Perlin self-motion.
  const energy = (!VJ.auto && Input.live) ? Math.max(4, Input.energy) : selfEnergy(now);
  const step = energy * SPEED_K;
  travel += step;

  updateFamily(now);

  for (const p of planes) {
    p.dist -= step;
    if (p.dist <= NEAR) { p.dist += L * SP; p.fam = curFam; rebuildPlane(p); }
    p.mesh.position.z = -p.dist;
    p.mesh.scale.setScalar(W);
  }

  renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Manual stepping for hidden-tab verification (rAF pauses when not visible).
window.__step = (n = 1) => { for (let i = 0; i < n; i++) frame(performance.now()); };
window.__info = () => ({
  planes: planes.map((p) => Math.round(p.dist)),
  families: planes.map((p) => p.fam.family),
  cur: curFam.family,
  auto: VJ.auto,
  energy: +(VJ.auto || !Input.live ? selfEnergy(performance.now()) : Input.energy).toFixed(1),
});
