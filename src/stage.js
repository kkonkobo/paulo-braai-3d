// Shared scene, camera, controls, UI helpers and part-naming for both viewers.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function createStage({ views, initialView, target = [-0.1, 0.8, 0], shadowBox = 1.6 }) {
  const app = document.getElementById('app');
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
  controls.target.set(...target);
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 0.6;
  controls.maxDistance = 9;

  const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
  sun.position.set(2.2, 4, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -shadowBox, right: shadowBox, top: 2.2, bottom: -1.2, near: 0.5, far: 10 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x8d8172, 0.6));

  const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ color: 0xa9a49c, roughness: 1 }));
  wall.position.set(0, 2.25, -1.25);
  wall.receiveShadow = true;
  scene.add(ground, wall);

  let tween = null, autoRotate = false;
  const goView = (name) => { tween = { from: camera.position.clone(), to: new THREE.Vector3(...views[name]), t: 0 }; };
  // phones are portrait: pull the camera back so the whole unit fits
  const fit = () => Math.max(1, 1.12 / (app.clientWidth / app.clientHeight));
  const start = new THREE.Vector3(...(views[initialView] || Object.values(views)[0]));
  camera.position.copy(start.clone().sub(controls.target).multiplyScalar(fit()).add(controls.target));

  function resize() {
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(app);
  resize();

  // name the part under the pointer (hover on desktop, tap on touch)
  const tip = document.getElementById('tip');
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let pickRoot = null, tipTimer = 0, down = null;
  function pick(e, sticky) {
    if (!pickRoot) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(pickRoot, true).find((h) => {
      for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
      return true;
    });
    if (hit) {
      tip.textContent = hit.object.name.split(':')[0];
      const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 8);
      tip.style.transform = `translate(${Math.max(8, x)}px, ${e.clientY - r.top + 14}px)`;
      tip.style.opacity = 1;
      clearTimeout(tipTimer);
      if (sticky) tipTimer = setTimeout(() => (tip.style.opacity = 0), 2200);
    } else if (!sticky) tip.style.opacity = 0;
  }
  renderer.domElement.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pick(e, false); });
  renderer.domElement.addEventListener('pointerleave', () => (tip.style.opacity = 0));
  renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse' && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 8) pick(e, true);
  });

  const clock = new THREE.Clock();
  const ticks = [];
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    ticks.forEach((f) => f(dt));
    if (tween) {
      tween.t = Math.min(1, tween.t + dt * 1.6);
      const k = tween.t * tween.t * (3 - 2 * tween.t);
      const to = tween.to.clone().sub(controls.target).multiplyScalar(fit()).add(controls.target);
      camera.position.lerpVectors(tween.from, to, k);
      if (tween.t >= 1) tween = null;
    }
    if (autoRotate) camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.35).add(controls.target);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    THREE, scene, camera, renderer, controls, goView,
    setPickRoot: (o) => (pickRoot = o),
    onTick: (f) => ticks.push(f),
    toggleAutoRotate: () => (autoRotate = !autoRotate),
  };
}

// ---------------------------------------------------------------- tiny UI kit

export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids);
  return e;
};
export const section = (title, ...kids) => {
  const s = el('section', {}, el('h3', {}, title), ...kids);
  document.getElementById('ui').append(s);
  return s;
};
export function segmented(options, value, onPick) {
  const row = el('div', { class: 'seg' });
  const btns = options.map(([k, label]) => el('button', { onclick: () => { set(k); onPick(k); } }, label));
  const set = (k) => btns.forEach((b, i) => b.classList.toggle('on', options[i][0] === k));
  row.append(...btns);
  set(value);
  row.set = set;
  return row;
}
export function slider(label, value, onInput, { min = 0, max = 100 } = {}) {
  const input = el('input', { type: 'range', min, max, step: 1, value, oninput: (e) => onInput(+e.target.value) });
  const wrap = el('label', { class: 'range' }, el('span', {}, label), input);
  wrap.input = input;
  return wrap;
}
export function checkbox(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) });
  const wrap = el('label', {}, input, label);
  wrap.input = input;
  return wrap;
}

export async function downloadGLB(root, filename) {
  const clone = root.clone(true);
  const hidden = [];
  clone.traverse((o) => { if (!o.visible) hidden.push(o); });
  hidden.forEach((o) => o.removeFromParent());
  const glb = await new GLTFExporter().parseAsync(clone, { binary: true });
  el('a', { href: URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })), download: filename }).click();
}
