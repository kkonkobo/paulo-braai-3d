// Shared materials for the Paulo models.
import * as THREE from 'three';


export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    frame: std({ color: 0x5f6366, metalness: 0.85, roughness: 0.42, name: 'frame' }),
    zinc: std({ color: 0xb4b8bb, metalness: 0.9, roughness: 0.32, name: 'zinc-plated' }),
    galv: std({ color: 0xc7cbcd, metalness: 0.8, roughness: 0.38, name: 'galvanised' }),
    stainless: std({ color: 0xd3d6d8, metalness: 1.0, roughness: 0.22, name: 'stainless' }),
    brick0: std({ color: 0xc58a65, roughness: 0.95, name: 'firebrick-a' }),
    brick1: std({ color: 0xb87957, roughness: 0.95, name: 'firebrick-b' }),
    brick2: std({ color: 0xd29d7a, roughness: 0.95, name: 'firebrick-c' }),
    mortar: std({ color: 0x5a4a40, roughness: 1.0, name: 'mortar' }),
    castiron: std({ color: 0x1b1b1c, metalness: 0.55, roughness: 0.7, name: 'cast-iron' }),
    wood: std({ color: 0xc08a47, roughness: 0.6, name: 'wood' }),
    plastic: std({ color: 0x1e1f21, roughness: 0.55, name: 'motor-housing' }),
    fabric: std({ color: 0x2b302b, roughness: 0.95, name: 'cover-fabric', side: THREE.DoubleSide }),
    plancha: std({ color: 0x2e2c2a, metalness: 0.7, roughness: 0.42, name: 'plancha-steel' }),
    dial: std({ color: 0xf2efe8, roughness: 0.4, name: 'thermometer-dial' }),
    needle: std({ color: 0xc23b22, roughness: 0.4, name: 'thermometer-needle' }),
    void: std({ color: 0x0a0a0a, roughness: 1.0, name: 'opening' }),
    gasket: std({ color: 0x9c988f, roughness: 1.0, name: 'rope-gasket' }),
  };
  return M;
}

export const FINISHES = {
  raw: { label: 'Raw steel (before coating)', color: 0x5f6366, metalness: 0.85, roughness: 0.42 },
  black: { label: 'Black powder coat', color: 0x131415, metalness: 0.3, roughness: 0.58 },
};

export function applyFinish(M, key) {
  const f = FINISHES[key];
  M.frame.color.setHex(f.color);
  M.frame.metalness = f.metalness;
  M.frame.roughness = f.roughness;
}

