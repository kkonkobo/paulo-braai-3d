// Builds the Paulo model in Node and writes GLB files to dist/.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
import { buildPaulo } from './src/model.js';
import { buildPauloXL } from './src/model-xl.js';

// GLTFExporter reads Blobs through FileReader, which Node lacks
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};

async function exportVariant(file, { finish, preset, xl = false }) {
  const p = (xl ? buildPauloXL : buildPaulo)({ finish });
  p.applyPreset(preset);
  const scene = new THREE.Scene();
  scene.add(p.root);
  // drop hidden parts so the file only holds what is shown
  const hidden = [];
  p.root.traverse((o) => { if (!o.visible) hidden.push(o); });
  hidden.forEach((o) => o.removeFromParent());
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  writeFileSync(file, Buffer.from(glb));
  let tris = 0, meshes = 0;
  scene.traverse((o) => { if (o.isMesh) { meshes++; tris += o.geometry.attributes.position.count / 3; } });
  const bb = new THREE.Box3().setFromObject(scene);
  const s = bb.getSize(new THREE.Vector3()).multiplyScalar(1000);
  console.log(file, (glb.byteLength / 1e6).toFixed(1) + ' MB', meshes + ' meshes', Math.round(tris) + ' tris',
    `bbox ${s.x.toFixed(0)} x ${s.y.toFixed(0)} x ${s.z.toFixed(0)} mm`);
}

await exportVariant('dist/paulo-braai-showcase-raw.glb', { finish: 'raw', preset: 'everything' });
await exportVariant('dist/paulo-braai-showcase-black.glb', { finish: 'black', preset: 'everything' });
await exportVariant('dist/paulo-braai-fullgrid-black.glb', { finish: 'black', preset: 'fullGrid' });
await exportVariant('dist/paulo-xl-showcase-black.glb', { finish: 'black', preset: 'showcase', xl: true });
await exportVariant('dist/paulo-xl-oven-black.glb', { finish: 'black', preset: 'oven', xl: true });
await exportVariant('dist/paulo-xl-plancha-press-raw.glb', { finish: 'raw', preset: 'plancha', xl: true });
