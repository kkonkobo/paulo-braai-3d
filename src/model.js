// Paulo Braai — procedural 3D model.
// All dimensions in millimetres; the root group is scaled to metres (glTF convention).
// Axes: X = length (firebox on -X, potjie boom / rotisserie motor on +X),
//       Y = up, Z = depth (+Z is the front, where the fold-up table hinges).
//
// Known dimension from the maker: full grid 900 x 500. Everything else is
// proportioned from the reference photos/reels against that grid.

import * as THREE from 'three';
import { V, PI, merge, box, bmm, rod, sq, rebar, bentRod, curveRod, expandedMesh, meshPanel, brickWall, Part, mx, T, TR, resetSeed } from './geom.js';

export { createMaterials, FINISHES, applyFinish } from './materials.js';
import { createMaterials, applyFinish } from './materials.js';

// ---------------------------------------------------------------- key dimensions

export const DIM = {
  box: { x0: -530, x1: 530, z0: -300, z1: 300, base: 690, top: 980 },
  sideT: 40,           // hollow side columns
  floorTop: 726,       // top of floor firebricks
  rails: [800, 870, 940],
  legX: 500, legZ: 270,
  wheelR: 148,
  firebox: { x0: -905, x1: -545, z0: -260, z1: 300, y0: 690, y1: 1000 },
  shelfY: 1270,
  grid: { w: 900, d: 500 },
};

// ---------------------------------------------------------------- parts

function cart(M) {
  const B = new Part('Cart frame');
  const { legX: lx, legZ: lz, wheelR } = DIM;
  const s = 40, yTop = 670;
  // legs
  for (const z of [-lz, lz]) {
    B.add('frame', sq(V(-lx, wheelR - 20, z), V(-lx, 690, z), s));
    B.add('frame', sq(V(lx, 28, z), V(lx, 690, z), s));
    // levelling foot (right side)
    B.add('frame', rod(V(lx, 10, z), V(lx, 30, z), 9));
    const pad = new THREE.CylinderGeometry(38, 45, 10, 24); pad.translate(lx, 5, z);
    B.add('frame', pad);
  }
  // top rails — front & back run past the right legs as push handles
  for (const z of [-lz, lz]) B.add('frame', sq(V(-lx - 20, yTop, z), V(660, yTop, z), s));
  for (const x of [-lx, lx]) B.add('frame', sq(V(x, yTop, -lz + 20), V(x, yTop, lz - 20), s));
  // corner gussets
  const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(90, 0), new THREE.Vector2(0, -90)]);
  for (const x of [-lx, lx]) for (const z of [-lz, lz]) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: 4, bevelEnabled: false });
    const dirX = x < 0 ? 1 : -1;
    g.scale(dirX, 1, 1);
    g.translate(x + dirX * 20, yTop - 20, z + (z > 0 ? 20 : -24));
    B.add('frame', g);
  }
  // lower shelf
  const ly = 230;
  for (const z of [-lz, lz]) B.add('frame', sq(V(-lx, ly, z), V(lx, ly, z), 30));
  for (const x of [-lx, lx, -165, 165]) B.add('frame', sq(V(x, ly, -lz), V(x, ly, lz), 30, 30));
  const p = meshPanel(2 * lx - 30, 2 * lz - 30, { bar: 4, barT: 4 });
  B.add('frame', p.mesh.translate(0, ly + 16, 0));
  // axle + wheels
  B.add('frame', rod(V(-lx, wheelR, -335), V(-lx, wheelR, 335), 11));
  for (const z of [-312, 312]) {
    const prof = [[wheelR - 5, -20], [wheelR, -20], [wheelR, 20], [wheelR - 5, 20], [wheelR - 5, -20]].map(([r, y]) => new THREE.Vector2(r, y));
    const rim = new THREE.LatheGeometry(prof, 48);
    rim.rotateX(PI / 2); rim.translate(-lx, wheelR, z);
    B.add('frame', rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      B.add('frame', rod(V(-lx + 24 * Math.cos(a), wheelR + 24 * Math.sin(a), z), V(-lx + (wheelR - 4) * Math.cos(a), wheelR + (wheelR - 4) * Math.sin(a), z), 6, 8));
    }
    const hub = new THREE.CylinderGeometry(26, 26, 56, 20); hub.rotateX(PI / 2); hub.translate(-lx, wheelR, z);
    B.add('frame', hub);
    const cap = new THREE.CylinderGeometry(12, 12, 62, 12); cap.rotateX(PI / 2); cap.translate(-lx, wheelR, z);
    B.add('zinc', cap);
  }
  // firebox cantilever platform + diagonal struts
  const F = DIM.firebox;
  for (const z of [-lz, lz]) {
    B.add('frame', sq(V(F.x0 - 10, yTop, z), V(-lx - 20, yTop, z), s));
    B.add('frame', sq(V(F.x0 + 10, yTop - 20, z), V(-lx, 270, z), 40, 40));
    B.add('frame', sq(V(F.x0 + 140, yTop - 20, z), V(-lx, 420, z), 30, 30));
  }
  B.add('frame', sq(V(F.x0, yTop, -lz - 20), V(F.x0, yTop, lz + 20), s));
  // hook for the ash shovel
  B.add('frame', bentRod([V(-690, 650, lz + 20), V(-690, 620, lz + 20), V(-690, 605, lz + 40), V(-690, 625, lz + 52)], 4));
  return B.build(M);
}

function braaiBox(M) {
  const B = new Part('Braai box');
  const { x0, x1, z0, z1, base, top } = DIM.box;
  const t = 6, st = DIM.sideT;
  B.add('frame', bmm(x0, x1, base, base + t, z0, z1));                // floor plate
  B.add('frame', bmm(x0, x1, base + t, top, z0, z0 + t));             // back wall
  // hollow side columns, full depth
  for (const sgn of [-1, 1]) {
    const xo = sgn > 0 ? x1 : x0, xi = xo - sgn * st;
    B.add('frame', bmm(xo, xo - sgn * t, base, top, z0, z1));
    B.add('frame', bmm(xi, xi + sgn * 4, base, top, z0, z1));
    B.add('frame', bmm(xo + sgn * 3, xi - sgn * 3, top, top + 6, z0 - 3, z1 + 3));  // cap
    B.add('frame', bmm(xo, xi, base, top + 6, z1 - 6, z1));                        // front face
    // vertical socket for the potjie boom (works on both sides)
    const sock = new THREE.CylinderGeometry(24, 24, 220, 20, 1, true);
    sock.translate(xo + sgn * 26, top - 110, 190);
    B.add('frame', sock);
    B.add('frame', bmm(xo, xo + sgn * 6, top - 200, top - 20, 175, 205));
    // locking T-screw on the socket
    B.add('zinc', rod(V(xo + sgn * 50, top - 70, 190), V(xo + sgn * 80, top - 70, 190), 6));
    B.add('zinc', rod(V(xo + sgn * 80, top - 70, 160), V(xo + sgn * 80, top - 70, 220), 5));
  }
  // low front lip with rebar trim
  B.add('frame', bmm(x0 + st, x1 - st, base, base + 72, z1 - 6, z1));
  B.add('frame', rebar(V(x0 + st, base + 78, z1 - 3), V(x1 - st, base + 78, z1 - 3), 6));
  B.add('frame', rebar(V(x0 + st, top + 8, z0 + 3), V(x1 - st, top + 8, z0 + 3), 6));

  // firebrick lining
  const inX = x1 - st;                // 490
  const ft = DIM.floorTop;
  // floor tiles (laid flat): build as wall in XY, then lay down
  brickWall(B, 2 * inX, (z1 - 6) - (z0 + t), mx(TR(0, base + t, z1 - 6, -PI / 2, 0, 0)), { bw: 230, bh: 115, t: ft - base - t });
  brickWall(B, 2 * inX, top - ft, mx(T(0, ft, z0 + t)), { bw: 115, bh: 230, bond: false });
  for (const sgn of [-1, 1]) {
    const d = (z1 - 6) - (z0 + t + 25);
    brickWall(B, d, top - ft, mx(TR(sgn * inX, ft, (z0 + t + 25 + z1 - 6) / 2, 0, -sgn * PI / 2, 0)), { bw: 115, bh: 230, bond: false });
  }
  // grid slide racks: vertical flat bars + three levels of angle rails each side
  const railX = inX - 25;              // 465 — face of side bricks
  for (const sgn of [-1, 1]) {
    for (const z of [-235, 235]) B.add('zinc', bmm(sgn * railX, sgn * (railX - 6), 770, top - 10, z - 15, z + 15));
    for (const y of DIM.rails) {
      B.add('zinc', bmm(sgn * railX, sgn * (railX - 20), y - 4, y, -250, 250));
      B.add('zinc', bmm(sgn * (railX - 16), sgn * (railX - 20), y - 18, y, -250, 250));
    }
  }
  return B.build(M);
}

function firebox(M) {
  const B = new Part('Insulated firebox');
  const F = DIM.firebox, t = 6;
  const { x0, x1, z0, z1, y0, y1 } = F;
  B.add('frame', bmm(x0, x1, y0, y0 + t, z0, z1));
  B.add('frame', bmm(x0, x1, y0, y1, z0, z0 + t));
  B.add('frame', bmm(x0, x0 + t, y0, y1, z0, z1));
  B.add('frame', bmm(x1 - t, x1, y0, y1, z0, z1));
  B.add('frame', bmm(x0, x1, y1 - t, y1, z0, z0 + 170)); // rear top plate (basket sits forward of it)
  // base channel around the bottom
  B.add('frame', bmm(x0 - 8, x1 + 8, y0 - 30, y0, z0 - 8, z1 + 8));
  // front plate with chamfered door opening
  const w = x1 - x0, h = y1 - y0;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.closePath();
  const ow = 270, oh = 235, ob = 40, c = 40;
  const hole = new THREE.Path();
  hole.moveTo(-ow / 2, ob); hole.lineTo(ow / 2, ob); hole.lineTo(ow / 2, ob + oh - c); hole.lineTo(ow / 2 - c, ob + oh);
  hole.lineTo(-ow / 2 + c, ob + oh); hole.lineTo(-ow / 2, ob + oh - c); hole.closePath();
  shape.holes.push(hole);
  const fp = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false, curveSegments: 1 });
  fp.translate((x0 + x1) / 2, y0, z1 - 6);
  B.add('frame', fp);
  // weld-dome bolt heads
  for (const [bx, by] of [[-130, h - 22], [-45, h - 25], [45, h - 25], [130, h - 22], [-155, h - 120], [155, h - 120]]) {
    const s = new THREE.SphereGeometry(9, 12, 6, 0, PI * 2, 0, PI / 2); s.rotateX(PI / 2); s.scale(1.4, 1, 1);
    s.translate((x0 + x1) / 2 + bx, y0 + by, z1);
    B.add('frame', s);
  }
  B.add('frame', rebar(V(x0 + 20, y0 + ob - 4, z1 + 4), V(x1 - 20, y0 + ob - 4, z1 + 4), 5));
  // coal grate bars across the top of the chamber
  for (const z of [150, 200]) B.add('frame', rebar(V(x0 + t, y1 - 45, z), V(x1 - t, y1 - 45, z), 7));
  // insulation: firebrick lining
  const cx = (x0 + x1) / 2, iw = w - 2 * t;
  brickWall(B, iw, z1 - 6 - (z0 + t), mx(TR(cx, y0 + t, z1 - 6, -PI / 2, 0, 0)), { t: 30 });
  brickWall(B, iw, y1 - y0 - 40, mx(T(cx, y0 + 36, z0 + t)), { bw: 115, bh: 230, bond: false });
  for (const sgn of [-1, 1]) {
    const d = (z1 - 6) - (z0 + t + 25);
    const xw = sgn < 0 ? x0 + t : x1 - t;
    brickWall(B, d, y1 - y0 - 40, mx(TR(xw, y0 + 36, (z0 + t + 25 + z1 - 6) / 2, 0, -sgn * PI / 2, 0)), { bw: 115, bh: 230, bond: false });
  }
  return B.build(M);
}

function coalBasket(M) {
  // the open "fire starter" basket that sits on top of the firebox
  const B = new Part('Coal basket / fire starter');
  const F = DIM.firebox;
  const x0 = F.x0 + 22, x1 = F.x1 - 22, z0 = F.z0 + 175, z1 = F.z1 + 10, y0 = F.y1;
  const hBack = 210, hFront = 120, t = 4;
  for (const x of [x0, x1 - t]) {
    const sh = new THREE.Shape([
      new THREE.Vector2(0, 0), new THREE.Vector2(z1 - z0, 0), new THREE.Vector2(z1 - z0, hFront),
      new THREE.Vector2(140, hBack), new THREE.Vector2(0, hBack)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
    g.rotateY(-PI / 2); g.translate(x + t, y0, z0);
    B.add('frame', g);
  }
  B.add('frame', bmm(x0, x1, y0, y0 + hBack, z0, z0 + t));
  B.add('frame', bmm(x0, x1, y0 + 60, y0 + hFront, z1 - t, z1));       // front band
  for (const y of [y0 + 14, y0 + 40]) B.add('frame', rebar(V(x0, y, z1 - 2), V(x1, y, z1 - 2), 6));
  for (let x = x0 + 30; x < x1 - 10; x += 34) B.add('frame', rebar(V(x, y0 + 4, z0 + 5), V(x, y0 + 4, z1 - 5), 5)); // floor grate
  // carry handle rod across the back corners
  B.add('zinc', rod(V(x0 - 35, y0 + 30, z0 + 40), V(x1 + 35, y0 + 30, z0 + 40), 6));
  return B.build(M);
}

function ashDrawer(M) {
  const B = new Part('Ash drawer + rebar poker');
  const F = DIM.firebox;
  const cx = (F.x0 + F.x1) / 2, y = F.y0 + 36;
  const w = 200, d = 260, h = 70, t = 3;
  B.add('frame', bmm(cx - w / 2, cx + w / 2, y, y + t, F.z1 - 40 - d, F.z1 - 40));
  B.add('frame', bmm(cx - w / 2, cx - w / 2 + t, y, y + h, F.z1 - 40 - d, F.z1 - 40));
  B.add('frame', bmm(cx + w / 2 - t, cx + w / 2, y, y + h, F.z1 - 40 - d, F.z1 - 40));
  B.add('frame', bmm(cx - w / 2, cx + w / 2, y, y + h, F.z1 - 40 - d, F.z1 - 40 - d + t));
  B.add('frame', bmm(cx - w / 2, cx + w / 2, y, y + h, F.z1 - 43, F.z1 - 40));
  // long twisted rebar handle down to the ground, ending in a twisted "cage" grip
  const a = V(cx, y + 40, F.z1 - 40), b = V(cx, 150, F.z1 + 230);
  B.add('frame', rebar(a, b, 6, 9));
  const dir = b.clone().sub(a).normalize();
  const end = b.clone().add(dir.clone().multiplyScalar(150));
  const side = V(1, 0, 0), up = new THREE.Vector3().crossVectors(dir, side).normalize();
  for (let i = 0; i < 4; i++) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, rad = 26 * Math.sin(PI * u), ang = (i / 4) * PI * 2 + u * PI * 0.9;
      pts.push(b.clone().add(dir.clone().multiplyScalar(150 * u))
        .add(side.clone().multiplyScalar(rad * Math.cos(ang))).add(up.clone().multiplyScalar(rad * Math.sin(ang))));
    }
    B.add('frame', curveRod(pts, 4.5, 30));
  }
  const tip = new THREE.SphereGeometry(7, 10, 8); tip.translate(end.x, end.y, end.z);
  B.add('frame', tip);
  return B.build(M);
}

function upperShelf(M) {
  const B = new Part('Upper warming shelf');
  const y = DIM.shelfY, z0 = -395, z1 = -155;
  for (const x of [-330, 330]) {
    B.add('frame', sq(V(x, 860, -326), V(x, y - 4, -326), 40));
    B.add('frame', bmm(x - 30, x + 30, 870, 940, -306, -303)); // bolt-on plate to the back wall
  }
  B.add('frame', sq(V(-565, y - 20, -326), V(565, y - 20, -326), 40, 40));
  const p = meshPanel(1140, z1 - z0, { bar: 22, barT: 5 });
  B.add('frame', p.frame.translate(0, y, (z0 + z1) / 2));
  B.add('frame', p.mesh.translate(0, y, (z0 + z1) / 2));
  B.add('frame', rebar(V(-570, y + 4, z1 + 4), V(570, y + 4, z1 + 4), 6));
  // hook rail underneath the front edge
  B.add('frame', rod(V(-560, y - 32, z1 - 15), V(560, y - 32, z1 - 15), 8));
  for (const x of [-540, 0, 540]) B.add('frame', bmm(x - 3, x + 3, y - 40, y - 2, z1 - 22, z1 - 8));
  return B.build(M);
}

function sHook(x, yRail, z, len = 140, r = 3.5) {
  // S-hook: top loop over the rail, shank, bottom loop
  const a = 13, pts = [];
  for (let k = 0; k <= 8; k++) { const t = PI * (k / 8); pts.push(V(x, yRail + a * Math.sin(t), z + a * Math.cos(t))); }
  for (let k = 0; k <= 8; k++) { const t = PI * (k / 8); pts.push(V(x, yRail - len - a * Math.sin(t), z - a * Math.cos(t))); }
  pts.push(V(x, yRail - len + 10, z + a - 2));
  return curveRod(pts, r, 48);
}

function toolHooks(M) {
  const B = new Part('Tool hooks (S-hooks)');
  const y = DIM.shelfY - 32, z = -170 + 0;
  for (const cxh of [-430, -230, 40]) for (let i = 0; i < 5; i++) {
    B.add('zinc', sHook(cxh + i * 9, y, z, 130 + (i % 2) * 22));
  }
  return B.build(M);
}

function potjieBoom(M) {
  // galvanised boom pole, swings in the side socket. Pivot group is returned so it can rotate.
  const pivot = new THREE.Group();
  pivot.name = 'Potjie boom';
  const B = new Part('Potjie boom pole');
  const H = 1600, arm = 380;
  B.add('galv', rod(V(0, DIM.box.top - 230, 0), V(0, H, 0), 16.8, 18));
  const cap = new THREE.SphereGeometry(17, 12, 8, 0, PI * 2, 0, PI / 2); cap.translate(0, H, 0);
  B.add('galv', cap);
  B.add('galv', rod(V(0, H - 20, 0), V(-arm, H - 20, 0), 8));
  B.add('galv', rod(V(-14, H - 230, 0), V(-arm + 40, H - 26, 0), 7));
  // chain
  const L = 13, links = 11;
  for (let i = 0; i < links; i++) {
    const tor = new THREE.TorusGeometry(11, 3.4, 6, 14); tor.scale(1, 1.7, 1);
    if (i % 2) tor.rotateY(PI / 2);
    tor.translate(-arm + 20, H - 40 - i * 2 * L, 0);
    B.add('galv', tor);
  }
  const hy = H - 40 - links * 2 * L;
  // triple potjie hook
  B.add('galv', rod(V(-arm + 20, hy + 8, 0), V(-arm + 20, hy - 40, 0), 5));
  for (const ang of [0, (2 * PI) / 3, (4 * PI) / 3]) {
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, r = 6 + 34 * t;
      pts.push(V(-arm + 20 + r * Math.cos(ang), hy - 40 - 20 * Math.sin(PI * t) + 20 * t, r * Math.sin(ang)));
    }
    B.add('galv', curveRod(pts, 4, 16));
  }
  pivot.add(B.build(M));
  pivot.userData.hookPoint = V(-arm + 20, hy - 40, 0);
  return pivot;
}

export function potjiePot(M, size = 3) {
  // three-legged cast-iron potjie, #3 (~7.5 L)
  const B = new Part(`Potjie pot #${size}`);
  const R0 = 140, H = 200;
  const prof = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const r = 40 + (R0 - 40) * Math.sin(Math.min(1, t * 1.7) * PI / 2) - (t > 0.75 ? (t - 0.75) * 120 : 0);
    prof.push(new THREE.Vector2(r, t * H));
  }
  prof.push(new THREE.Vector2(prof.at(-1).x + 8, H), new THREE.Vector2(prof.at(-1).x + 8, H + 10), new THREE.Vector2(prof.at(-1).x - 2, H + 10));
  B.add('castiron', new THREE.LatheGeometry(prof, 36));
  const lid = new THREE.LatheGeometry([new THREE.Vector2(118, 0), new THREE.Vector2(110, 18), new THREE.Vector2(70, 34), new THREE.Vector2(0, 38)], 36);
  lid.translate(0, H + 8, 0);
  B.add('castiron', lid);
  B.add('castiron', bentRod([V(-28, H + 46, 0), V(-28, H + 62, 0), V(28, H + 62, 0), V(28, H + 46, 0)], 6));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 6;
    B.add('castiron', rod(V(55 * Math.cos(a), 10, 55 * Math.sin(a)), V(70 * Math.cos(a), -55, 70 * Math.sin(a)), 9, 8));
  }
  // lugs + wire bail
  for (const s of [-1, 1]) {
    const lug = new THREE.TorusGeometry(14, 5, 6, 12); lug.rotateY(PI / 2); lug.translate(s * (R0 - 22), H - 18, 0);
    B.add('castiron', lug);
  }
  const bail = [];
  for (let k = 0; k <= 16; k++) { const t = PI * (k / 16); bail.push(V(-(R0 - 22) * Math.cos(t), H - 18 + 175 * Math.sin(t), 0)); }
  B.add('castiron', curveRod(bail, 4, 32));
  const g = B.build(M);
  g.userData.bailTop = V(0, H - 18 + 175, 0);
  return g;
}

function flatGrid(B, w, d, mat, { handle = 'back', fine = false } = {}) {
  const p = meshPanel(w, d, { bar: 22, barT: 5, sx: fine ? 40 : 58, sz: fine ? 18 : 26 });
  B.add(mat, p.frame);
  B.add(mat, p.mesh);
  B.add(mat, rebar(V(-w / 2 + 10, -14, -d / 4), V(w / 2 - 10, -14, -d / 4), 5));
  B.add(mat, rebar(V(-w / 2 + 10, -14, d / 4), V(w / 2 - 10, -14, d / 4), 5));
  if (handle) {
    const z = handle === 'back' ? -d / 2 : d / 2;
    B.add(mat, bentRod([V(-90, 0, z), V(-90, 55, z), V(90, 55, z), V(90, 0, z)], 6));
  }
}

function fullGrid(M) {
  const B = new Part('Full grid 900 x 500');
  flatGrid(B, DIM.grid.w, DIM.grid.d, 'zinc');
  const g = B.build(M);
  g.position.set(0, DIM.rails[1] + 3, -10);
  return g;
}

export function hingedGrid(M, name, w, d, handleLen) {
  // classic South African "toeklap" double grid with long handles
  const B = new Part(name);
  for (const y of [0, 30]) {
    const p = meshPanel(w, d, { bar: 14, barT: 5, sx: 36, sz: 18, strand: 3.2, t: 2.5 });
    B.add('zinc', p.frame.translate(0, y, 0));
    B.add('zinc', p.mesh.translate(0, y, 0));
  }
  for (const s of [-1, 1]) {
    B.add('zinc', bentRod([V(s * 40, 0, d / 2), V(s * 40, 0, d / 2 + handleLen), V(s * 20, 15, d / 2 + handleLen + 30)], 5));
    B.add('zinc', bentRod([V(s * 40, 30, d / 2), V(s * 40, 30, d / 2 + handleLen), V(s * 20, 15, d / 2 + handleLen + 30)], 5));
  }
  const ring = new THREE.TorusGeometry(16, 4, 6, 14); ring.rotateX(PI / 2); ring.translate(0, 15, d / 2 + handleLen + 45);
  B.add('zinc', ring);
  return B.build(M);
}

function ribStand(M) {
  // "staan rib stand": V-cradles that hang off the back wall, height-adjustable on a T-rod
  const B = new Part('Rib stand (V-cradle)');
  const zs = [-240, -195, -150, -105];
  for (const z of zs) {
    B.add('zinc', bentRod([V(-150, 130, z), V(-55, 10, z), V(55, 10, z), V(150, 130, z)], 5));
  }
  B.add('zinc', rod(V(-55, 10, zs[0]), V(-55, 10, zs.at(-1)), 5));
  B.add('zinc', rod(V(55, 10, zs[0]), V(55, 10, zs.at(-1)), 5));
  B.add('zinc', rod(V(0, 10, zs[0]), V(0, 10, zs.at(-1)), 5));
  B.add('zinc', rod(V(0, 10, zs[0] - 10), V(0, 300, zs[0] - 10), 7));
  B.add('zinc', rod(V(-50, 300, zs[0] - 10), V(50, 300, zs[0] - 10), 6));
  // clamp bracket over the back wall
  B.add('zinc', bmm(-25, 25, 190, 205, -300, -238));
  B.add('zinc', bmm(-25, 25, 130, 205, -306, -300));
  const g = B.build(M);
  g.position.set(-230, DIM.floorTop + 50, 0);
  return g;
}

function breadClamp(M) {
  const g = hingedGrid(M, 'Bread & coal clamp', 240, 420, 260);
  // stands up, leaning on the back wall
  g.rotation.set(-PI / 2 + 0.28, 0, 0);
  g.position.set(210, DIM.floorTop + 230, -150);
  return g;
}

function rotisserie(M) {
  const grp = new THREE.Group(); grp.name = 'Rotisserie (external motor)';
  const y = 850, z = 60, { x1 } = DIM.box;
  const motor = new Part('Rotisserie motor');
  motor.add('plastic', box(70, 150, 130, x1 + 50, y - 30, z));
  motor.add('plastic', box(74, 20, 134, x1 + 50, y + 40, z));
  motor.add('zinc', bmm(x1, x1 + 14, y - 80, y + 30, z - 50, z + 50));
  motor.add('zinc', rod(V(x1 + 14, y - 110, z + 70), V(x1 + 14, y + 10, z + 70), 6)); // mount pin
  grp.add(motor.build(M));
  const spit = new THREE.Group(); spit.name = 'Spit rod';
  const S = new Part('Spit');
  S.add('stainless', box(1160, 10, 10, -30, 0, 0));
  // handle end + bearing collar
  S.add('wood', rod(V(-640, 0, 0), V(-540, 0, 0), 14, 16));
  for (const fx of [-200, 180]) {
    const dirn = fx < 0 ? 1 : -1;
    S.add('stainless', box(40, 26, 26, fx, 0, 0));
    S.add('stainless', rod(V(fx, 13, 0), V(fx, 40, 0), 4));
    S.add('stainless', rod(V(fx - 15, 40, 0), V(fx + 15, 40, 0), 4));
    for (const s of [-1, 1]) {
      S.add('stainless', bentRod([V(fx, 0, s * 8), V(fx + dirn * 30, 0, s * 26), V(fx + dirn * 150, 0, s * 26)], 3));
    }
  }
  spit.add(S.build(M));
  spit.position.set(0, y, z);
  grp.add(spit);
  grp.userData.spit = spit;
  // coal box for rotisserie, sits on the floor under the spit
  const C = new Part('Rotisserie coal box');
  const cy = DIM.floorTop, w = 560, d = 170, h = 70;
  C.add('frame', bmm(-w / 2, w / 2, cy, cy + 3, z + 60, z + 60 + d));
  C.add('frame', bmm(-w / 2, w / 2, cy, cy + h, z + 60, z + 63));
  C.add('frame', bmm(-w / 2, w / 2, cy, cy + h * 0.6, z + 57 + d, z + 60 + d));
  for (const s of [-1, 1]) C.add('frame', bmm(s * w / 2 - 3, s * w / 2, cy, cy + h, z + 60, z + 60 + d));
  grp.add(C.build(M));
  return grp;
}

function foldTable(M) {
  const pivot = new THREE.Group(); pivot.name = 'Fold-up stainless table';
  const B = new Part('Table top');
  const w = 960, d = 320, t = 2.5, lip = 25;
  B.add('stainless', bmm(-w / 2, w / 2, -t, 0, 0, d));
  B.add('stainless', bmm(-w / 2, w / 2, -lip, 0, d - t, d));
  B.add('stainless', bmm(-w / 2, -w / 2 + t, -lip, 0, 0, d));
  B.add('stainless', bmm(w / 2 - t, w / 2, -lip, 0, 0, d));
  B.add('frame', rod(V(-w / 2, -6, 6), V(w / 2, -6, 6), 7));  // hinge pin
  // fold-out support arms (under the table when it is up)
  for (const s of [-1, 1]) B.add('frame', sq(V(s * 400, -lip - 4, 10), V(s * 400, -lip - 4, d - 30), 20, 12));
  pivot.add(B.build(M));
  pivot.position.set(30, DIM.box.base, DIM.legZ + 28);
  return pivot;
}

function storageCage(M) {
  const B = new Part('Grid & accessory storage cage (back)');
  const w = 760, h = 520, d = 120, y0 = 330, zb = -DIM.legZ - 22;
  const back = expandedMesh(w, h); back.rotateX(PI / 2); back.translate(0, y0 + h / 2, zb - d);
  B.add('frame', back);
  const bottom = expandedMesh(w, d); bottom.translate(0, y0, zb - d / 2);
  B.add('frame', bottom);
  for (const s of [-1, 1]) {
    const side = expandedMesh(d, h); side.rotateX(PI / 2); side.rotateY(PI / 2); side.translate(s * w / 2, y0 + h / 2, zb - d / 2);
    B.add('frame', side);
    B.add('frame', sq(V(s * w / 2, y0, zb - d), V(s * w / 2, y0 + h, zb - d), 20));
    B.add('frame', sq(V(s * w / 2, y0, zb), V(s * w / 2, y0 + h, zb), 20));
  }
  B.add('frame', rebar(V(-w / 2, y0 + h, zb - d), V(w / 2, y0 + h, zb - d), 6));
  B.add('frame', sq(V(-w / 2, y0, zb - d), V(w / 2, y0, zb - d), 20));
  B.add('frame', bentRod([V(-160, y0 + h - 20, zb - d - 4), V(-160, y0 + h - 20, zb - d - 30), V(160, y0 + h - 20, zb - d - 30), V(160, y0 + h - 20, zb - d - 4)], 5));
  // pigtail hooks along the bottom rail
  for (const x of [-300, -100, 100, 300]) {
    const pts = [];
    for (let k = 0; k <= 24; k++) { const a = k / 24 * PI * 3; pts.push(V(x + 12 * Math.cos(a), y0 - 10 - k * 2.2, zb - d - 12 + 12 * Math.sin(a))); }
    B.add('frame', curveRod(pts, 3.5, 48));
  }
  // mounting hooks onto the rear frame rail
  for (const s of [-1, 1]) B.add('frame', bmm(s * 300 - 15, s * 300 + 15, y0 + h - 10, y0 + h + 12, zb - d, zb + 30));
  return B.build(M);
}

function storedGrids(M) {
  const grp = new THREE.Group(); grp.name = 'Grids in storage';
  const big = hingedGrid(M, 'Large zinc-plated grid', 480, 340, 300);
  big.rotation.set(PI / 2, 0, 0);
  big.position.set(-140, 360 + 170, -DIM.legZ - 22 - 70);
  const small = hingedGrid(M, 'Small zinc-plated grid', 330, 250, 260);
  small.rotation.set(PI / 2, 0, 0.08);
  small.position.set(230, 360 + 125, -DIM.legZ - 22 - 40);
  grp.add(big, small);
  return grp;
}

function ashShovel(M) {
  const B = new Part('Ash shovel');
  const w = 150, l = 190;
  B.add('frame', bmm(-w / 2, w / 2, 0, 3, 0, l));
  for (const s of [-1, 1]) B.add('frame', bmm(s * w / 2 - s * 3, s * w / 2, 0, 30, 0, l));
  B.add('frame', bmm(-w / 2, w / 2, 0, 30, 0, 3));
  B.add('frame', rebar(V(0, 15, 0), V(0, 15, -430), 6, 9));
  const loop = new THREE.TorusGeometry(18, 4, 6, 14); loop.rotateY(PI / 2); loop.translate(0, 15, -450);
  B.add('frame', loop);
  const g = B.build(M);
  // hangs vertically from the hook under the firebox platform
  g.rotation.set(PI / 2, 0, 0);
  g.position.set(-690, 615 - 470, DIM.legZ + 52);
  return g;
}

function wok(M) {
  const B = new Part('Wok');
  const prof = [];
  for (let k = 0; k <= 16; k++) { const a = (k / 16) * (PI / 2) * 0.95; prof.push(new THREE.Vector2(190 * Math.sin(a), 105 * (1 - Math.cos(a)))); }
  B.add('castiron', new THREE.LatheGeometry(prof, 40));
  B.add('frame', rod(V(185, 85, 0), V(260, 120, 0), 7));
  B.add('wood', rod(V(260, 120, 0), V(420, 175, 0), 15, 14));
  B.add('frame', rod(V(-185, 85, 0), V(-215, 95, 0), 6));
  B.add('wood', rod(V(-215, 95, 0), V(-275, 112, 0), 13, 12));
  const g = B.build(M);
  g.position.set(-300, DIM.shelfY + 6, -270);
  g.rotation.y = -0.15;
  return g;
}

function panStand(M) {
  const B = new Part('Round pan on stand');
  const r = 125;
  B.add('castiron', new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r + 4, 45), new THREE.Vector2(r + 1, 45), new THREE.Vector2(r - 3, 3), new THREE.Vector2(0, 3)], 36).translate(0, 120, 0));
  B.add('castiron', rod(V(r, 140, 0), V(r + 240, 150, 0), 6));
  const ring = new THREE.TorusGeometry(r + 6, 5, 6, 32); ring.rotateX(PI / 2); ring.translate(0, 118, 0);
  B.add('frame', ring);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2 + PI / 2; B.add('frame', rebar(V((r + 6) * Math.cos(a), 118, (r + 6) * Math.sin(a)), V((r + 6) * Math.cos(a), 0, (r + 6) * Math.sin(a)), 5)); }
  const g = B.build(M);
  g.position.set(250, DIM.shelfY + 5, -275);
  return g;
}

function lidHolder(M) {
  // the rack in the accessory line-up photo; interpreted as the potjie lid holder / grid stand
  const B = new Part('Potjie lid holder');
  const w = 380, h = 560;
  B.add('frame', bentRod([V(-w / 2, 0, 0), V(-w / 2, h, 0), V(w / 2, h, 0), V(w / 2, 0, 0)], 6));
  B.add('frame', rod(V(-w / 2, 0, 0), V(w / 2, 0, 0), 6));
  for (const x of [-60, 60]) B.add('frame', rod(V(x, 0, 0), V(x, h, 0), 5));
  B.add('frame', bentRod([V(-90, h, 0), V(-90, h + 180, -20), V(90, h + 180, -20), V(90, h, 0)], 6));
  const g = B.build(M);
  // leaning against the right-hand legs
  g.rotation.set(0, PI / 2, 0);
  g.rotateX(-0.2);
  g.position.set(DIM.legX + 150, 0, 0);
  return g;
}

function cover(M) {
  const B = new Part('Heavy-duty waterproof cover');
  const g = new THREE.BoxGeometry(1700, 1340, 760, 16, 12, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sag = (y > 600 ? 0 : 1) * 12 * Math.sin(x / 120) * Math.sin(y / 140);
    p.setXYZ(i, x * (1 + 0.012 * Math.sin(y / 90)), y, z + Math.sign(z) * sag);
  }
  g.computeVertexNormals();
  g.translate(-120, 1340 / 2 + 2, -30);
  B.add('fabric', g);
  return B.build(M);
}

// ---------------------------------------------------------------- assembly

export const ACCESSORIES = [
  { key: 'fullGrid', label: 'Full grid 900 × 500' },
  { key: 'rotisserie', label: 'Rotisserie + coal box (external motor)' },
  { key: 'ribStand', label: 'Staan rib stand' },
  { key: 'breadClamp', label: 'Bread & coal clamp' },
  { key: 'boom', label: 'Potjie boom (chain + hook)' },
  { key: 'potjie', label: 'Potjie pot #3 on the boom' },
  { key: 'coalBasket', label: 'Coal basket / fire starter' },
  { key: 'ashDrawer', label: 'Ash drawer + rebar poker' },
  { key: 'shelf', label: 'Upper warming shelf' },
  { key: 'hooks', label: 'Tool hooks' },
  { key: 'wok', label: 'Wok' },
  { key: 'panStand', label: 'Round pan on stand' },
  { key: 'table', label: 'Fold-up stainless table' },
  { key: 'cage', label: 'Back storage cage' },
  { key: 'storedGrids', label: 'Large & small zinc grids (stored)' },
  { key: 'shovel', label: 'Ash shovel' },
  { key: 'lidHolder', label: 'Potjie lid holder' },
  { key: 'cover', label: 'Waterproof cover' },
];

export const PRESETS = {
  everything: { label: 'Showcase (all accessories)', off: ['fullGrid', 'cover'] },
  fullGrid: { label: 'Full grid braai', off: ['rotisserie', 'ribStand', 'breadClamp', 'potjie', 'cover', 'wok', 'panStand', 'lidHolder'] },
  bare: { label: 'Bare unit', on: ['coalBasket', 'shelf', 'table'] },
  covered: { label: 'Covered', on: ['cover', 'shelf', 'table', 'cage', 'coalBasket'], tableOpen: 0 },
};

export function buildPaulo({ finish = 'raw' } = {}) {
  resetSeed();
  const M = createMaterials();
  applyFinish(M, finish);
  const root = new THREE.Group();
  root.name = 'Paulo Braai';
  root.scale.setScalar(0.001);

  const body = new THREE.Group(); body.name = 'Paulo body';
  body.add(cart(M), braaiBox(M), firebox(M));
  root.add(body);

  const parts = {};
  const put = (key, obj) => { parts[key] = obj; root.add(obj); };

  put('fullGrid', fullGrid(M));
  put('rotisserie', rotisserie(M));
  put('ribStand', ribStand(M));
  put('breadClamp', breadClamp(M));
  const boom = potjieBoom(M);
  boom.position.set(DIM.box.x1 + 26, 0, 190);
  put('boom', boom);
  const pot = potjiePot(M);
  boom.add(pot);
  const hp = boom.userData.hookPoint;
  pot.position.set(hp.x, hp.y - pot.userData.bailTop.y + 6, hp.z);
  parts.potjie = pot;
  put('coalBasket', coalBasket(M));
  put('ashDrawer', ashDrawer(M));
  put('shelf', upperShelf(M));
  put('hooks', toolHooks(M));
  put('wok', wok(M));
  put('panStand', panStand(M));
  put('table', foldTable(M));
  put('cage', storageCage(M));
  put('storedGrids', storedGrids(M));
  put('shovel', ashShovel(M));
  put('lidHolder', lidHolder(M));
  put('cover', cover(M));

  const state = { tableUp: true, boomAngle: 0 };
  const api = {
    root, parts, materials: M, body,
    setFinish: (k) => applyFinish(M, k),
    setVisible: (key, v) => {
      if (!parts[key]) return;
      parts[key].visible = v;
      if (key === 'boom' && !v) parts.potjie.visible = false;
    },
    applyPreset(name) {
      const p = PRESETS[name];
      for (const { key } of ACCESSORIES) {
        const on = p.on ? p.on.includes(key) : !p.off.includes(key);
        parts[key].visible = on;
      }
      if (parts.potjie.visible) parts.boom.visible = true;
      api.setTableOpen(p.tableOpen ?? 1);
      return Object.fromEntries(ACCESSORIES.map(({ key }) => [key, parts[key].visible]));
    },
    // table: 0 = folded down, 1 = up
    setTableOpen: (f) => { parts.table.rotation.x = (1 - f) * (PI / 2); },
    // boom swing, radians (0 = over the fire)
    setBoomAngle: (a) => { parts.boom.rotation.y = a; },
    spin: (dt) => { parts.rotisserie.userData.spit.rotation.x += dt * 1.2; },
  };
  api.applyPreset('everything');
  return api;
}
