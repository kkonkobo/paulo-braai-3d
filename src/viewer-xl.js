import * as THREE from 'three';
import { createStage, el, section, segmented, slider, checkbox, downloadGLB } from './stage.js';
import { buildPauloXL, XL_ACCESSORIES, XL_PRESETS, HALF_TYPES, HEIGHTS, FINISHES } from './model-xl.js';

const params = new URLSearchParams(location.search);
const VIEWS = {
  'Front ¾': [2.1, 1.75, 3.3],
  Front: [0, 1.15, 3.8],
  Back: [-0.6, 1.6, -3.1],
  Side: [3.6, 1.3, 0.6],
  Top: [0, 4.0, 0.7],
};
const stage = createStage({ views: VIEWS, initialView: params.get('view'), target: [0.05, 0.85, 0], shadowBox: 1.9 });
const paulo = buildPauloXL({ finish: params.get('finish') || 'black' });
stage.scene.add(paulo.root);
stage.setPickRoot(paulo.root);
if (XL_PRESETS[params.get('preset')]) paulo.applyPreset(params.get('preset'));

// ---------------------------------------------------------------- airflow (oven mode)
const flow = new THREE.Group();
flow.visible = params.has('airflow');
stage.scene.add(flow);
const flowSets = paulo.airflowPaths().map((pts) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().multiplyScalar(0.001)));
  const N = 22;
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false }), N);
  const cold = new THREE.Color(0x3b82c4), hot = new THREE.Color(0xe8552a), c = new THREE.Color();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, c.copy(cold).lerp(hot, Math.min(1, (i / N) * 1.6)));
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  flow.add(mesh);
  return { curve, mesh, N, t: 0 };
});
const m4 = new THREE.Matrix4();
const col = new THREE.Color();
stage.onTick((dt) => {
  if (!flow.visible) return;
  const s = paulo.state, rate = 0.05 + 0.25 * Math.min(s.intake, s.exhaust) + 0.04 * s.lid;
  for (const f of flowSets) {
    f.t = (f.t + dt * rate) % 1;
    for (let i = 0; i < f.N; i++) {
      const u = (f.t + i / f.N) % 1;
      f.mesh.setMatrixAt(i, m4.makeTranslation(f.curve.getPointAt(u)));
      f.mesh.setColorAt(i, col.setHex(0x3b82c4).lerp(new THREE.Color(0xe8552a), Math.min(1, u * 1.7)));
    }
    f.mesh.instanceMatrix.needsUpdate = true;
    f.mesh.instanceColor.needsUpdate = true;
  }
});

let spin = true;
stage.onTick((dt) => { if (spin) paulo.spin(dt); });

// ---------------------------------------------------------------- UI
const pct = (v) => v / 100;
const ctl = {};

section('Mode',
  el('div', { class: 'seg' }, ...Object.entries(XL_PRESETS).map(([k, p]) => el('button', { onclick: () => sync(paulo.applyPreset(k)) }, p.label))));

const halfUI = (side, title) => {
  const sel = el('select', { onchange: (e) => paulo.setHalf(side, e.target.value) },
    ...Object.entries(HALF_TYPES).map(([k, label]) => el('option', { value: k }, label)));
  const lvl = segmented(HEIGHTS.map((h, i) => [i, h]), 1, (i) => paulo.setHalfLevel(side, i));
  ctl[side] = { sel, lvl };
  return el('div', { class: 'half' }, el('span', { class: 'lbl' }, title), sel, lvl);
};
section('Cooking surfaces — each takes half the length',
  halfUI('left', 'Left half'), halfUI('right', 'Right half'));

ctl.lid = slider('Lid: closed ↔ open', 100, (v) => paulo.setLid(pct(v)));
ctl.intake = slider('Front air intakes (one per zone)', 50, (v) => paulo.setIntake(pct(v)));
ctl.exhaust = slider('Rear flue dampers (one per zone)', 50, (v) => paulo.setExhaust(pct(v)));
ctl.airflow = checkbox('Show oven airflow', flow.visible, (v) => (flow.visible = v));
section('Lid, oven & vents', ctl.lid, ctl.intake, ctl.exhaust, ctl.airflow,
  el('p', { class: 'note' },
    'Closed, the lid seals on a rope gasket and the firebrick on all sides stores the heat. ',
    'Air comes in low at the front, straight onto the coals, rises under the arched lid and leaves through the high rear flues, so each zone gets a full sweep of heat. ',
    'Intakes control how hard the fire burns, flues hold the heat in; each zone has its own pair and thermometer.'));

ctl.press = slider('Sandwich press: closed ↔ open', 45, (v) => paulo.setPress(pct(v)));
ctl.brazier = slider('Slide the brazier along the shelf', 50, (v) => paulo.setBrazier((v - 50) / 50));
ctl.table = slider('Table: folded ↔ up', 100, (v) => paulo.setTableOpen(pct(v)));
ctl.boom = slider('Swing potjie boom', 0, (v) => paulo.setBoomAngle((v * Math.PI) / 180), { min: -90, max: 90 });
ctl.spin = checkbox('Turn the spits', true, (v) => (spin = v));
section('Move parts', ctl.press, ctl.brazier, ctl.table, ctl.boom, ctl.spin);

ctl.vis = {};
const list = el('div', { class: 'list' });
for (const { key, label } of XL_ACCESSORIES) {
  const cb = checkbox(label, paulo.parts[key].visible, (v) => {
    paulo.setVisible(key, v);
    if (key === 'potjie' && v) ctl.vis.boom.input.checked = true;
    if (key === 'boom' && !v) ctl.vis.potjie.input.checked = false;
  });
  ctl.vis[key] = cb;
  list.append(cb);
}
section('Accessories', list);

section('Finish', segmented(Object.entries(FINISHES).map(([k, f]) => [k, f.label]), params.get('finish') || 'black', (k) => paulo.setFinish(k)));
section('View', el('div', { class: 'seg' },
  ...Object.keys(VIEWS).map((k) => el('button', { onclick: () => stage.goView(k) }, k)),
  el('button', { onclick: (e) => e.target.classList.toggle('on', stage.toggleAutoRotate()) }, 'Auto-rotate')));
section('Export', el('button', { class: 'primary', onclick: () => downloadGLB(paulo.root, 'paulo-xl.glb') }, 'Download current setup (.glb)'));

function sync(s) {
  for (const side of ['left', 'right']) { ctl[side].sel.value = s[side].type; ctl[side].lvl.set(s[side].level); }
  ctl.lid.input.value = s.lid * 100;
  ctl.intake.input.value = s.intake * 100;
  ctl.exhaust.input.value = s.exhaust * 100;
  ctl.press.input.value = s.press * 100;
  ctl.table.input.value = s.table * 100;
  ctl.boom.input.value = 0;
  ctl.brazier.input.value = s.brazier * 50 + 50;
  for (const [k, v] of Object.entries(s.vis)) ctl.vis[k].input.checked = v;
}
sync(paulo.snapshot());
window.__paulo = paulo;
