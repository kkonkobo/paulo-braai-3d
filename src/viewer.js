import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildPaulo, ACCESSORIES, PRESETS, FINISHES } from './model.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcdfe2);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;

const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(-0.1, 0.8, 0);
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.6;
controls.maxDistance = 8;

const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
sun.position.set(2.2, 4, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 2, bottom: -1, near: 0.5, far: 10 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.01;
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x8d8172, 0.6));

// paving + backdrop wall, echoing the photos
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ color: 0xa9a49c, roughness: 1 }));
wall.position.set(0, 2, -1.1);
wall.receiveShadow = true;
scene.add(wall);

const paulo = buildPaulo({ finish: params.get('finish') || 'raw' });
scene.add(paulo.root);

// ------------------------------------------------------------- views
const VIEWS = {
  'Front ¾': [1.75, 1.45, 2.85],
  Front: [-0.05, 1.0, 3.3],
  Back: [-0.4, 1.3, -2.6],
  Firebox: [-2.3, 1.25, 1.6],
  Top: [-0.05, 3.6, 0.6],
};
let tween = null;
function goView(name) {
  const to = new THREE.Vector3(...VIEWS[name]);
  tween = { from: camera.position.clone(), to, t: 0 };
}
camera.position.set(...(VIEWS[params.get('view')] || VIEWS['Front ¾']));

// ------------------------------------------------------------- UI
const ui = document.getElementById('ui');
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
  e.append(...kids);
  return e;
};
const section = (title) => { const s = el('section', {}, el('h3', {}, title)); ui.append(s); return s; };

const boxes = {};
let tableSlider;
const syncBoxes = (state) => { for (const [k, v] of Object.entries(state)) boxes[k].checked = v; };

const sFinish = section('Finish');
const finishRow = el('div', { class: 'seg' });
for (const [k, f] of Object.entries(FINISHES)) {
  const b = el('button', { 'data-k': k, onclick: () => { paulo.setFinish(k); finishRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); } }, f.label);
  if (k === (params.get('finish') || 'raw')) b.classList.add('on');
  finishRow.append(b);
}
sFinish.append(finishRow);

const sPreset = section('Setup');
const presetRow = el('div', { class: 'seg wrap' });
for (const [k, p] of Object.entries(PRESETS)) presetRow.append(el('button', { onclick: () => { syncBoxes(paulo.applyPreset(k)); tableSlider.value = (p.tableOpen ?? 1) * 100; } }, p.label));
sPreset.append(presetRow);

const sAcc = section('Accessories');
const list = el('div', { class: 'list' });
for (const { key, label } of ACCESSORIES) {
  const cb = el('input', { type: 'checkbox', onchange: (e) => { paulo.setVisible(key, e.target.checked); if (key === 'potjie' && e.target.checked) { paulo.setVisible('boom', true); boxes.boom.checked = true; } if (key === 'boom' && !e.target.checked) boxes.potjie.checked = false; } });
  boxes[key] = cb;
  list.append(el('label', {}, cb, label));
}
sAcc.append(list);

const sMove = section('Move parts');
const range = (label, min, max, val, fn) => {
  const r = el('input', { type: 'range', min, max, value: val, step: 1, oninput: (e) => fn(+e.target.value) });
  fn(val);
  return el('label', { class: 'range' }, el('span', {}, label), r);
};
let spin = true;
const tableRow = range('Table: folded ↔ up', 0, 100, 100, (v) => paulo.setTableOpen(v / 100));
tableSlider = tableRow.querySelector('input');
sMove.append(
  tableRow,
  range('Swing potjie boom', -90, 90, 0, (v) => paulo.setBoomAngle((v * Math.PI) / 180)),
  el('label', {}, el('input', { type: 'checkbox', checked: '', onchange: (e) => (spin = e.target.checked) }), 'Turn the rotisserie'),
);

const sView = section('View');
const viewRow = el('div', { class: 'seg wrap' });
for (const k of Object.keys(VIEWS)) viewRow.append(el('button', { onclick: () => goView(k) }, k));
let autoRotate = false;
viewRow.append(el('button', { onclick: (e) => { autoRotate = !autoRotate; e.target.classList.toggle('on', autoRotate); } }, 'Auto-rotate'));
sView.append(viewRow);

const sExp = section('Export');
sExp.append(el('button', {
  class: 'primary', onclick: async () => {
    const clone = paulo.root.clone(true);
    const hidden = []; clone.traverse((o) => { if (!o.visible) hidden.push(o); });
    hidden.forEach((o) => o.removeFromParent());
    const glb = await new GLTFExporter().parseAsync(clone, { binary: true });
    const a = el('a', { href: URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })), download: 'paulo-braai.glb' });
    a.click();
  },
}, 'Download current setup (.glb)'));

if (PRESETS[params.get('preset')]) { paulo.applyPreset(params.get('preset')); tableSlider.value = (PRESETS[params.get('preset')].tableOpen ?? 1) * 100; }
syncBoxes(Object.fromEntries(ACCESSORIES.map(({ key }) => [key, paulo.parts[key].visible])));

// hover: name the part under the cursor
const tip = document.getElementById('tip');
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObject(paulo.root, true).find((h) => h.object.visible);
  if (hit) {
    tip.textContent = hit.object.name.split(':')[0];
    tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
    tip.style.opacity = 1;
  } else tip.style.opacity = 0;
});
renderer.domElement.addEventListener('pointerleave', () => (tip.style.opacity = 0));

// ------------------------------------------------------------- loop
function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(app);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (spin) paulo.spin(dt);
  if (tween) {
    tween.t = Math.min(1, tween.t + dt * 1.6);
    const k = tween.t * tween.t * (3 - 2 * tween.t);
    camera.position.lerpVectors(tween.from, tween.to, k);
    if (tween.t >= 1) tween = null;
  }
  if (autoRotate) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.35);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
  renderer.render(scene, camera);
});
window.__paulo = paulo;
