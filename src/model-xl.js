// Paulo XL — concept redesign of the Paulo braai.
//  · no side firebox; the braai box is longer, wider and deeper, firebrick-lined on all five faces
//  · two half-length cooking positions (V-channel grate, round-bar grate, plancha, sandwich press)
//  · two removable rotisseries side by side (motors on opposite ends)
//  · hinged brick-lined lid with gasket, twin thermometers, low front intakes and high rear flues,
//    turning the braai into a dual-zone wood-fired oven
//  · mobile coal brazier ("makeshift firebox") that rolls on the bottom shelf
// Units: mm. Axes: X length (+X right), Y up, Z depth (+Z front).

import * as THREE from 'three';
import { V, PI, merge, box, bmm, rod, sq, rebar, bentRod, curveRod, expandedMesh, meshPanel, brickWall, Part, mx, T, TR, resetSeed } from './geom.js';
import { createMaterials, applyFinish, FINISHES } from './materials.js';
import { potjiePot, hingedGrid } from './model.js';

export { FINISHES };

export const XL = {
  xi: 700, xb: 730, xo: 770,   // brick face, brick back / column inner, column outer (half-length)
  zi: 300, zb: 330, zo: 336,   // same, front-to-back (half-depth)
  base: 690, yF: 736,          // box floor plate, top of 40 mm floor bricks
  yFront: 996, yBack: 1176,    // wall tops: front 260 mm above the bricks, back 440 mm
  rails: [100, 170, 240],      // grid rail heights above the floor bricks
  legX: 740, legZ: 300, wheelR: 148,
  spitY: 1000, spitZ: [150, -150],
  gasket: 10,
  vents: [-350, 350],
};
const X = XL;
const slopeY = (z) => X.yFront + ((X.zo - z) / (2 * X.zo)) * (X.yBack - X.yFront);
export const railY = (i) => X.yF + X.rails[i];

// polygon in the YZ plane ([z, y] pairs) extruded along X from x0 to x1
function yzPrism(pts, x0, x1) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(PI / 2);
  g.translate(x0, 0, 0);
  return g;
}
// polygon in the XY plane extruded along Z from z0 to z1, with optional holes
function xyPrism(pts, z0, z1, holes = []) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z0);
  return g;
}
const span = (a, b) => [Math.min(a, b), Math.max(a, b)];
const bx = (xa, xb, y0, y1, z0, z1) => { const [p, q] = span(xa, xb); return bmm(p, q, y0, y1, z0, z1); };

// offset an open polyline ([z, y]) toward its inside (tangent rotated counter-clockwise)
function offsetPath(path, d) {
  const nrm = (a, b) => { const tz = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tz, ty); return [-ty / L, tz / L]; };
  return path.map((p, i) => {
    const n1 = i > 0 ? nrm(path[i - 1], p) : null, n2 = i < path.length - 1 ? nrm(p, path[i + 1]) : null;
    if (n1 && n2) {
      const sz = n1[0] + n2[0], sy = n1[1] + n2[1], L = Math.hypot(sz, sy), m = [sz / L, sy / L];
      const k = d / (m[0] * n1[0] + m[1] * n1[1]);
      return [p[0] + m[0] * k, p[1] + m[1] * k];
    }
    const m = n1 || n2;
    return [p[0] + m[0] * d, p[1] + m[1] * d];
  });
}

// ---------------------------------------------------------------- cart

function cart(M) {
  const B = new Part('Cart frame');
  const { legX: lx, legZ: lz, wheelR } = X;
  const s = 40, yTop = 670, ly = 230;
  for (const z of [-lz, lz]) {
    B.add('frame', sq(V(-lx, wheelR - 20, z), V(-lx, 690, z), s));
    B.add('frame', sq(V(lx, 28, z), V(lx, 690, z), s));
    B.add('frame', rod(V(lx, 10, z), V(lx, 30, z), 9));
    B.add('frame', new THREE.CylinderGeometry(38, 45, 10, 24).translate(lx, 5, z));
    B.add('frame', sq(V(-lx - 20, yTop, z), V(920, yTop, z), s));          // top rails run out as handles
    B.add('frame', sq(V(-lx, ly, z), V(lx, ly, z), 30));                   // lower shelf rails
    B.add('frame', bmm(-lx + 30, lx - 30, ly + 18, ly + 34, z * 0.58 - 3, z * 0.58 + 3)); // brazier guide rails
  }
  for (const x of [-lx, lx]) B.add('frame', sq(V(x, yTop, -lz + 20), V(x, yTop, lz - 20), s));
  for (const x of [-lx, -250, 250, lx]) B.add('frame', sq(V(x, ly, -lz), V(x, ly, lz), 30));
  B.add('frame', rod(V(905, yTop, -lz - 20), V(905, yTop, lz + 20), 10)); // tool rail across the handle ends
  const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(110, 0), new THREE.Vector2(0, -110)]);
  for (const x of [-lx, lx]) for (const z of [-lz, lz]) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: 4, bevelEnabled: false });
    const d = x < 0 ? 1 : -1;
    g.scale(d, 1, 1);
    g.translate(x + d * 20, yTop - 20, z + (z > 0 ? 20 : -24));
    B.add('frame', g);
  }
  B.add('frame', expandedMesh(2 * lx - 30, 2 * lz - 30, {}).translate(0, ly + 16, 0));
  // axle + spoked wheels
  B.add('frame', rod(V(-lx, wheelR, -lz - 70), V(-lx, wheelR, lz + 70), 11));
  for (const z of [-lz - 42, lz + 42]) {
    const prof = [[wheelR - 5, -20], [wheelR, -20], [wheelR, 20], [wheelR - 5, 20], [wheelR - 5, -20]].map(([r, y]) => new THREE.Vector2(r, y));
    B.add('frame', new THREE.LatheGeometry(prof, 48).rotateX(PI / 2).translate(-lx, wheelR, z));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      B.add('frame', rod(V(-lx + 24 * Math.cos(a), wheelR + 24 * Math.sin(a), z), V(-lx + (wheelR - 4) * Math.cos(a), wheelR + (wheelR - 4) * Math.sin(a), z), 6, 8));
    }
    B.add('frame', new THREE.CylinderGeometry(26, 26, 56, 20).rotateX(PI / 2).translate(-lx, wheelR, z));
    B.add('zinc', new THREE.CylinderGeometry(12, 12, 62, 12).rotateX(PI / 2).translate(-lx, wheelR, z));
  }
  // shovel hook on the left end
  B.add('frame', bentRod([V(-lx - 20, 650, 100), V(-lx - 58, 650, 100), V(-lx - 58, 612, 100), V(-lx - 44, 600, 100), V(-lx - 36, 614, 100)], 4));
  return B.build(M);
}

// ---------------------------------------------------------------- braai box

function braaiBox(M) {
  const B = new Part('Braai box (fully brick-lined)');
  const { xi, xb, xo, zi, zb, zo, base, yF, yFront, yBack } = X;
  B.add('frame', bmm(-xo, xo, base, base + 6, -zo, zo));                         // floor plate
  B.add('frame', bmm(-xo - 8, xo + 8, base - 30, base, -zo - 8, zo + 8));        // base channel
  B.add('frame', bmm(-xb, xb, base + 6, yBack, -zo, -zb));                       // back wall
  B.add('frame', bmm(-xb, xb, yBack, yBack + 6, -zo, -zi));                      // back cap
  // front wall with the two low air intakes (one per cooking zone)
  const port = (cx) => [[cx - 120, 60], [cx + 120, 60], [cx + 120, 110], [cx - 120, 110]];
  B.add('frame', xyPrism([[-xb, 0], [xb, 0], [xb, yFront - base], [-xb, yFront - base]], zb, zo, X.vents.map(port)).translate(0, base, 0));
  B.add('frame', bmm(-xb, xb, yFront, yFront + 6, zi, zo + 4));
  B.add('frame', rebar(V(-xb, yFront - 16, zo + 5), V(xb, yFront - 16, zo + 5), 6));
  for (const cx of X.vents) {
    B.add('void', bmm(cx - 118, cx + 118, base + 62, base + 108, zi - 1, zb + 1));  // port through the bricks
    for (const y of [base + 50, base + 120]) B.add('zinc', bx(cx - Math.sign(cx) * 130, cx + Math.sign(cx) * 380, y - 4, y + 4, zo, zo + 10)); // damper guides
  }
  // hollow side columns with sloped tops (the lid's end caps land on these)
  const trap = [[-zo, base], [zo, base], [zo, yFront], [-zo, yBack]];
  for (const sgn of [-1, 1]) {
    const xs = (a) => sgn * a;
    B.add('frame', yzPrism(trap, ...span(xs(xo - 6), xs(xo))));
    B.add('frame', yzPrism(trap, ...span(xs(xb), xs(xb + 4))));
    B.add('frame', yzPrism([[zo, yFront], [-zo, yBack], [-zo, yBack + 6], [zo, yFront + 6]], ...span(xs(xb), xs(xo))));
    B.add('frame', bx(xs(xb), xs(xo), base, yFront, zo - 6, zo));
    B.add('frame', bx(xs(xb), xs(xo), base, yBack, -zo, -zo + 6));
    // potjie-boom socket (either side) + locking T-screw
    B.add('frame', new THREE.CylinderGeometry(24, 24, 210, 20, 1, true).translate(xs(xo + 26), 905, 200));
    B.add('frame', bx(xs(xo), xs(xo + 6), 820, 990, 185, 215));
    B.add('zinc', rod(V(xs(xo + 50), 950, 200), V(xs(xo + 80), 950, 200), 6));
    B.add('zinc', rod(V(xs(xo + 80), 950, 170), V(xs(xo + 80), 950, 230), 5));
    // spit ports through the column, both spits
    for (const z of X.spitZ) {
      B.add('zinc', new THREE.CylinderGeometry(17, 17, 12, 18).rotateZ(PI / 2).translate(xs(xo + 4), X.spitY, z));
      B.add('void', new THREE.CylinderGeometry(8, 8, 14, 12).rotateZ(PI / 2).translate(xs(xo + 5), X.spitY, z));
      B.add('void', new THREE.CylinderGeometry(9, 9, 4, 12).rotateZ(PI / 2).translate(xs(xi - 1), X.spitY, z));
    }
    // gas-strut anchor
    B.add('frame', bx(xs(xo), xs(xo + 8), 870, 930, -320, -280));
    B.add('zinc', rod(V(xs(xo), 900, -300), V(xs(xo + 16), 900, -300), 7));
    // rope gasket along the sloped top
    B.add('gasket', rod(V(xs(xo - 20), slopeY(zo - 12) + 11, zo - 12), V(xs(xo - 20), slopeY(-zo + 12) + 11, -zo + 12), 5, 8));
  }
  B.add('gasket', rod(V(-xo + 12, yFront + 11, zo - 16), V(xo - 12, yFront + 11, zo - 16), 5, 8));
  B.add('gasket', rod(V(-xo + 12, yBack + 11, -zo + 16), V(xo - 12, yBack + 11, -zo + 16), 5, 8));
  // lid hinge: body knuckles + pin
  const hy = X.yBack + 20, hz = -X.zo - 12;
  B.add('zinc', rod(V(-720, hy, hz), V(720, hy, hz), 5));
  for (const x of [-330, 330]) {
    B.add('frame', new THREE.CylinderGeometry(13, 13, 110, 16).rotateZ(PI / 2).translate(x, hy, hz));
    B.add('frame', bmm(x - 50, x + 50, hy - 60, hy - 8, hz - 2, -zo));
  }

  // ---- firebrick lining: floor, back, front and both (sloped) sides
  brickWall(B, 2 * xb, 2 * zb, mx(TR(0, base + 6, zb, -PI / 2, 0, 0)), { bw: 230, bh: 115, t: 40 });
  brickWall(B, 2 * xb, yBack - yF, mx(T(0, yF, -zb)), { bw: 115, bh: 230, bond: false, t: 30 });
  brickWall(B, 2 * xb, yFront - yF, mx(TR(0, yF, zb, 0, PI, 0)), { bw: 115, bh: 230, bond: false, t: 30 });
  for (const sgn of [-1, 1]) {
    brickWall(B, 2 * zi, 0, mx(TR(sgn * xb, yF, 0, 0, -sgn * PI / 2, 0)),
      { bw: 115, bh: 230, bond: false, t: 30, top: (xl) => slopeY(sgn * xl) - yF - 4 });
  }
  // grid rails on both side walls + centre-bar brackets on the front and back bricks
  for (const sgn of [-1, 1]) {
    for (const z of [-260, 260]) B.add('zinc', bx(sgn * xi, sgn * (xi - 6), yF + 60, yF + 255, z - 15, z + 15));
    for (const r of X.rails) {
      const y = yF + r;
      B.add('zinc', bx(sgn * xi, sgn * (xi - 20), y - 4, y, -280, 280));
      B.add('zinc', bx(sgn * (xi - 16), sgn * (xi - 20), y - 18, y, -280, 280));
    }
  }
  for (const r of X.rails) for (const z of [-zi, zi]) B.add('zinc', bmm(-25, 25, yF + r - 18, yF + r - 6, Math.min(z, z - Math.sign(z) * 14), Math.max(z, z - Math.sign(z) * 14)));
  return B.build(M);
}

// ---------------------------------------------------------------- lid / oven hood

function hood(M) {
  const pivot = new THREE.Group();
  pivot.name = 'Brick-insulated lid';
  const H = V(0, X.yBack + 20, -X.zo - 12);
  const inner = new THREE.Group();
  inner.position.set(0, -H.y, -H.z);
  pivot.position.copy(H);
  pivot.add(inner);

  const zf = X.zo + 4, zk = -X.zo - 4;
  const yfb = X.yFront + 6 + X.gasket, ybb = X.yBack + 6 + X.gasket, yc0 = ybb + 60, rise = 110;
  const c = zf - zk, Rr = (c * c / 4 + rise * rise) / (2 * rise), yc = yc0 + rise - Rr;
  const arcY = (z) => yc + Math.sqrt(Rr * Rr - z * z);
  const path = [[zf, yfb], [zf, yc0]];
  for (let i = 1; i < 28; i++) { const z = zf - (i / 28) * c; path.push([z, arcY(z)]); }
  path.push([zk, yc0], [zk, ybb]);
  const band = (a, b) => [...offsetPath(path, a), ...offsetPath(path, b).reverse()];

  const B = new Part('Lid shell + firebrick lining');
  B.add('frame', yzPrism(band(0, 5), -X.xo, X.xo));
  B.add('brick0', yzPrism(band(5, 35), -X.xo + 6, X.xo - 6));
  // mortar joints on the lining: across the arch every brick length, and along it
  for (let x = -X.xo + 6 + 230; x < X.xo - 30; x += 230) B.add('mortar', yzPrism(band(34, 36.5), x - 2, x + 2));
  const ring = offsetPath(path, 36);
  for (let i = 2; i < ring.length - 1; i += 4) B.add('mortar', bmm(-X.xo + 36, X.xo - 36, ring[i][1] - 1.5, ring[i][1] + 1.5, ring[i][0] - 1.5, ring[i][0] + 1.5));
  for (const sgn of [-1, 1]) {
    B.add('frame', yzPrism(path, ...span(sgn * (X.xo - 6), sgn * X.xo)));
    B.add('brick1', yzPrism(offsetPath(path, 5), ...span(sgn * (X.xo - 36), sgn * (X.xo - 6))));
    // gas-strut ball stud
    B.add('zinc', rod(V(sgn * X.xo, 1240, -150), V(sgn * (X.xo + 16), 1240, -150), 6));
  }
  // lid knuckles (between the body knuckles)
  for (const x of [-620, 0, 620]) {
    B.add('frame', new THREE.CylinderGeometry(13, 13, 120, 16).rotateZ(PI / 2).translate(x, H.y, H.z));
    B.add('frame', bmm(x - 55, x + 55, H.y - 8, ybb + 40, zk - 8, zk));
  }
  // handle
  B.add('wood', rod(V(-520, 1090, zf + 62), V(520, 1090, zf + 62), 16, 16));
  for (const x of [-480, 480]) B.add('frame', rod(V(x, 1090, zf), V(x, 1090, zf + 62), 7));
  // two thermometers, one per zone
  for (const x of X.vents) {
    const y = 1190, z = zf;
    B.add('stainless', new THREE.CylinderGeometry(44, 44, 16, 32).rotateX(PI / 2).translate(x, y, z + 8));
    B.add('dial', new THREE.CylinderGeometry(37, 37, 2, 32).rotateX(PI / 2).translate(x, y, z + 17));
    for (let i = 0; i <= 8; i++) {
      const a = (-135 + i * 33.75) * PI / 180;
      B.add('castiron', box(2, i % 2 ? 6 : 10, 1).translate(0, 30, 0).rotateZ(-a).translate(x, y, z + 18.5));
    }
    B.add('needle', box(2.6, 30, 1).translate(0, 12, 0).rotateZ(-0.24).translate(x, y, z + 19.5));
    B.add('stainless', new THREE.CylinderGeometry(4, 4, 4, 12).rotateX(PI / 2).translate(x, y, z + 20));
    B.add('stainless', new THREE.CylinderGeometry(5, 5, 40, 10).rotateX(PI / 2).translate(x, y, z - 20)); // probe stem
  }
  // two exhaust flues at the high rear of the arch, with rain caps
  const dampers = [];
  for (const x of [-450, 450]) {
    const z = -180, yt = arcY(z);
    B.add('frame', new THREE.CylinderGeometry(45, 45, 210, 24, 1, true).translate(x, yt + 70, z));
    B.add('frame', new THREE.CylinderGeometry(62, 62, 8, 24).translate(x, yt - 2, z));
    B.add('frame', new THREE.ConeGeometry(80, 42, 24).translate(x, yt + 222, z));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      B.add('frame', rod(V(x + 44 * Math.cos(a), yt + 170, z + 44 * Math.sin(a)), V(x + 60 * Math.cos(a), yt + 204, z + 60 * Math.sin(a)), 3));
    }
    const D = new Part('Flue damper');
    D.add('zinc', new THREE.CylinderGeometry(43, 43, 3, 24));
    D.add('zinc', rod(V(-60, 0, 0), V(60, 0, 0), 4));
    D.add('frame', bmm(55, 61, -6, 6, 0, 70));
    D.add('wood', rod(V(58, 0, 70), V(58, 0, 110), 8));
    const dg = D.build(M);
    dg.position.set(x, yt + 90, z);
    dampers.push(dg);
    inner.add(dg);
  }
  inner.add(B.build(M));
  pivot.userData = { H, dampers, studs: [-1, 1].map((s) => V(s * (X.xo + 16), 1240, -150)) };
  return pivot;
}

// gas strut drawn between a body anchor and a point on the lid
function makeStrut(M) {
  const g = new THREE.Group();
  g.name = 'Lid gas strut';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 1, 16), M.plastic);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1, 12), M.stainless);
  body.castShadow = shaft.castShadow = true;
  g.add(body, shaft);
  const up = V(0, 1, 0);
  g.userData.update = (a, b) => {
    const dir = b.clone().sub(a), L = dir.length();
    dir.normalize();
    const bl = Math.min(260, L - 30);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    body.quaternion.copy(q); shaft.quaternion.copy(q);
    body.scale.y = bl; body.position.copy(a).addScaledVector(dir, bl / 2);
    shaft.scale.y = L - bl; shaft.position.copy(a).addScaledVector(dir, bl + (L - bl) / 2);
  };
  return g;
}

function intakeDamper(M, cx) {
  const D = new Part('Intake damper');
  D.add('zinc', bmm(-130, 130, -32, 32, 0, 4));
  D.add('wood', rod(V(0, 0, 4), V(0, 0, 34), 10, 14));
  const g = D.build(M);
  g.position.set(cx, X.base + 85, X.zo + 4);
  g.userData.x0 = cx;
  return g;
}

// ---------------------------------------------------------------- half-length cooking attachments
// local origin: centre of the half, y = 0 on top of the rails

const HW = 690, HD = 590;

function endHandles(B, mat, y) {
  for (const s of [-1, 1]) B.add(mat, bentRod([V(s * (HW / 2 - 18), y, -70), V(s * (HW / 2 - 18), y + 48, -70), V(s * (HW / 2 - 18), y + 48, 70), V(s * (HW / 2 - 18), y, 70)], 5));
}
function frameBars(B, mat, h) {
  B.add(mat, bmm(-HW / 2, HW / 2, 0, h, HD / 2 - 6, HD / 2));
  B.add(mat, bmm(-HW / 2, HW / 2, 0, h, -HD / 2, -HD / 2 + 6));
  B.add(mat, bmm(-HW / 2, -HW / 2 + 6, 0, h, -HD / 2, HD / 2));
  B.add(mat, bmm(HW / 2 - 6, HW / 2, 0, h, -HD / 2, HD / 2));
}

function grateV(M) {
  const B = new Part('Grill grate — V-channel (parrilla)');
  frameBars(B, 'stainless', 32);
  const L = HD - 12;
  for (let x = -HW / 2 + 22; x <= HW / 2 - 22; x += 25) {
    for (const s of [-1, 1]) B.add('stainless', box(13, 2.2, L).rotateZ(s * 0.72).translate(x + s * 4.8, 26, 0));
  }
  // grease trough along the front edge, spout on the right
  B.add('stainless', bmm(-HW / 2 + 8, HW / 2 - 8, 2, 4, HD / 2 - 40, HD / 2 - 8));
  B.add('stainless', bmm(-HW / 2 + 8, HW / 2 - 8, 2, 18, HD / 2 - 42, HD / 2 - 40));
  B.add('stainless', rod(V(HW / 2 - 30, 4, HD / 2 - 24), V(HW / 2 - 30, -40, HD / 2 - 24), 7));
  endHandles(B, 'stainless', 32);
  return B.build(M);
}

function gridRound(M) {
  const B = new Part('Grill grate — round bar');
  frameBars(B, 'zinc', 24);
  for (let x = -HW / 2 + 20; x <= HW / 2 - 20; x += 22) B.add('zinc', rod(V(x, 24, -HD / 2 + 6), V(x, 24, HD / 2 - 6), 4, 8));
  for (const z of [-150, 150]) B.add('zinc', rebar(V(-HW / 2 + 6, 14, z), V(HW / 2 - 6, 14, z), 5));
  endHandles(B, 'zinc', 28);
  return B.build(M);
}

function plancha(M) {
  const B = new Part('Plancha');
  for (const z of [-200, 0, 200]) B.add('frame', bmm(-HW / 2 + 8, HW / 2 - 8, 0, 30, z - 4, z + 4));
  B.add('plancha', bmm(-HW / 2, HW / 2, 30, 40, -HD / 2, HD / 2));
  B.add('void', bmm(-HW / 2 + 24, HW / 2 - 24, 39.6, 40.4, HD / 2 - 40, HD / 2 - 26));     // grease gutter
  B.add('void', new THREE.CylinderGeometry(10, 10, 1.2, 16).translate(HW / 2 - 50, 40.2, HD / 2 - 33));
  B.add('stainless', new THREE.CylinderGeometry(34, 30, 48, 20, 1, true).translate(HW / 2 - 50, 6, HD / 2 - 33)); // grease cup
  B.add('stainless', new THREE.CylinderGeometry(30, 30, 2, 20).translate(HW / 2 - 50, -18, HD / 2 - 33));
  B.add('stainless', bmm(-HW / 2, HW / 2, 40, 115, -HD / 2, -HD / 2 + 3));                  // splash guards
  for (const s of [-1, 1]) B.add('stainless', yzPrism([[-HD / 2, 40], [HD / 2 - 70, 40], [HD / 2 - 70, 58], [-HD / 2, 115]], ...span(s * (HW / 2 - 3), s * HW / 2)));
  endHandles(B, 'stainless', 115);
  return B.build(M);
}

function press(M) {
  const g = new THREE.Group();
  g.name = 'Sandwich press';
  const B = new Part('Sandwich press base');
  for (const z of [-220, 0, 220]) B.add('frame', bmm(-HW / 2 + 8, HW / 2 - 8, 0, 20, z - 4, z + 4));
  B.add('castiron', bmm(-HW / 2, HW / 2, 20, 32, -HD / 2 + 15, HD / 2 - 15));
  for (let z = -HD / 2 + 32; z <= HD / 2 - 32; z += 24) B.add('castiron', bmm(-HW / 2 + 16, HW / 2 - 16, 32, 38, z - 3, z + 3));
  for (const x of [-260, 260]) B.add('frame', bmm(x - 10, x + 10, 32, 90, -HD / 2 + 15, -HD / 2 + 35));
  g.add(B.build(M));
  const lid = new THREE.Group();
  lid.name = 'Sandwich press top';
  lid.position.set(0, 80, -HD / 2 + 25);
  const L = new Part('Sandwich press top plate');
  const d = HD - 70;
  L.add('castiron', bmm(-HW / 2 + 20, HW / 2 - 20, -36, -24, 10, d));
  for (let z = 30; z <= d - 15; z += 24) L.add('castiron', bmm(-HW / 2 + 30, HW / 2 - 30, -42, -36, z - 3, z + 3));
  for (const x of [-240, 0, 240]) L.add('castiron', bmm(x - 8, x + 8, -24, -6, 10, d));
  for (const x of [-260, 260]) L.add('frame', bentRod([V(x, 0, 0), V(x, -18, 16)], 7));
  for (const x of [-250, 250]) L.add('frame', rod(V(x, -24, d - 30), V(x, 50, d + 10), 7));
  L.add('wood', rod(V(-280, 50, d + 10), V(280, 50, d + 10), 15, 16));
  lid.add(L.build(M));
  g.add(lid);
  g.userData.lid = lid;
  return g;
}

function centreBar(M) {
  const B = new Part('Centre support bar');
  B.add('zinc', bmm(-22, 22, -6, 0, -X.zi + 2, X.zi - 2));
  B.add('zinc', bmm(-3, 3, -34, -6, -X.zi + 2, X.zi - 2));
  return B.build(M);
}

export const HALF_TYPES = {
  none: 'Empty',
  grateV: 'Grill grate — V-channel',
  gridRound: 'Grill grate — round bar',
  plancha: 'Plancha',
  press: 'Sandwich press',
};
export const HEIGHTS = ['Low', 'Mid', 'High'];
const HALF_BUILDERS = { grateV, gridRound, plancha, press };

// ---------------------------------------------------------------- rotisseries

function rotisserie(M, z, side) {
  const grp = new THREE.Group();
  grp.name = side > 0 ? 'Rotisserie A (front, motor right)' : 'Rotisserie B (back, motor left)';
  const P = new Part(grp.name + ' — motor & rest');
  const xm = side * X.xo, y = X.spitY;
  P.add('zinc', bx(xm, xm + side * 10, y - 95, y + 40, z - 58, z + 58));
  P.add('zinc', bx(xm, xm + side * 10, y + 30, y + 40, z - 58, z - 30).translate(0, 0, 0));
  P.add('plastic', box(70, 150, 130, xm + side * 46, y - 30, z));
  P.add('plastic', box(74, 18, 134, xm + side * 46, y + 40, z));
  P.add('zinc', rod(V(xm + side * 14, y - 125, z + 70), V(xm + side * 14, y + 5, z + 70), 6));
  // U-rest on the far column for the free end
  P.add('zinc', bx(-xm, -xm - side * 8, y - 60, y - 10, z - 26, z + 26));
  P.add('zinc', bentRod([V(-xm - side * 30, y + 20, z - 16), V(-xm - side * 30, y - 12, z - 16), V(-xm - side * 30, y - 12, z + 16), V(-xm - side * 30, y + 20, z + 16)], 4));
  grp.add(P.build(M));
  const spit = new THREE.Group();
  spit.name = grp.name + ' — spit rod';
  spit.position.set(0, y, z);
  const S = new Part(grp.name + ' — spit');
  const a = -side * (X.xo + 40), b = side * (X.xo + 22);
  S.add('stainless', bmm(Math.min(a, b), Math.max(a, b), -5, 5, -5, 5));
  S.add('wood', rod(V(a, 0, 0), V(a - side * 110, 0, 0), 14, 16));
  for (const fx of [-470, 470]) {
    const dirn = fx < 0 ? 1 : -1;
    S.add('stainless', box(40, 26, 26, fx, 0, 0));
    S.add('stainless', rod(V(fx, 13, 0), V(fx, 40, 0), 4));
    S.add('stainless', rod(V(fx - 15, 40, 0), V(fx + 15, 40, 0), 4));
    for (const s of [-1, 1]) S.add('stainless', bentRod([V(fx, 0, s * 8), V(fx + dirn * 30, 0, s * 28), V(fx + dirn * 170, 0, s * 28)], 3));
  }
  spit.add(S.build(M));
  grp.add(spit);
  grp.userData.spit = spit;
  return grp;
}

// ---------------------------------------------------------------- mobile brazier

function brazier(M) {
  const grp = new THREE.Group();
  grp.name = 'Mobile coal brazier';
  const B = new Part('Mobile coal brazier (makeshift firebox)');
  const L = 560, W = 400, yWheel = 246, y0 = 318, H = 260, yt = y0 + H, t = 5;
  B.add('frame', bmm(-L / 2, L / 2, y0, y0 + t, -W / 2, W / 2));
  B.add('frame', bmm(-L / 2, L / 2, y0, yt, -W / 2, -W / 2 + t));
  for (const s of [-1, 1]) B.add('frame', bx(s * L / 2, s * (L / 2 - t), y0, yt, -W / 2, W / 2));
  const door = [[-150, 25], [150, 25], [150, 135], [115, 170], [-115, 170], [-150, 135]];
  B.add('frame', xyPrism([[-L / 2, 0], [L / 2, 0], [L / 2, H], [-L / 2, H]], W / 2 - t, W / 2, [door]).translate(0, y0, 0));
  B.add('frame', rebar(V(-150, y0 + 21, W / 2 + 5), V(150, y0 + 21, W / 2 + 5), 5));
  // firebrick lining
  brickWall(B, L - 2 * t, W - 2 * t, mx(TR(0, y0 + t, W / 2 - t, -PI / 2, 0, 0)), { bw: 230, bh: 115, t: 25 });
  brickWall(B, L - 2 * t, H - 70, mx(T(0, y0 + 30, -W / 2 + t)), { bw: 115, bh: 230, bond: false, t: 25 });
  for (const s of [-1, 1]) brickWall(B, W - 2 * t - 25, H - 70, mx(TR(s * (L / 2 - t), y0 + 30, 12, 0, -s * PI / 2, 0)), { bw: 115, bh: 230, bond: false, t: 25 });
  // wood grate on top (coals drop through), rim and log rails
  for (let z = -W / 2 + 28; z <= W / 2 - 20; z += 34) B.add('frame', rebar(V(-L / 2 + 6, yt - 18, z), V(L / 2 - 6, yt - 18, z), 6));
  for (const z of [-W / 2, W / 2]) B.add('frame', rebar(V(-L / 2, yt + 4, z), V(L / 2, yt + 4, z), 6));
  for (const x of [-L / 2, L / 2]) B.add('frame', rebar(V(x, yt + 4, -W / 2), V(x, yt + 4, W / 2), 6));
  for (const x of [-L / 2 + 10, L / 2 - 10]) for (const z of [-W / 2 + 10, W / 2 - 10]) B.add('frame', rod(V(x, yt, z), V(x, yt + 50, z), 6));
  for (const z of [-W / 2 + 10, W / 2 - 10]) B.add('frame', rebar(V(-L / 2 + 10, yt + 50, z), V(L / 2 - 10, yt + 50, z), 6));
  // coal / ash drawer behind the door
  B.add('frame', bmm(-140, 140, y0 + 30, y0 + 33, -W / 2 + 40, W / 2 - 4));
  B.add('frame', bmm(-140, 140, y0 + 28, y0 + 88, W / 2 - 4, W / 2 + 1));
  B.add('frame', bentRod([V(-50, y0 + 58, W / 2 + 1), V(-50, y0 + 58, W / 2 + 30), V(50, y0 + 58, W / 2 + 30), V(50, y0 + 58, W / 2 + 1)], 5));
  // spin vent on the end + carry handles both ends
  B.add('zinc', new THREE.CylinderGeometry(42, 42, 4, 24).rotateZ(PI / 2).translate(L / 2 + 2, y0 + 70, 0));
  B.add('zinc', rod(V(L / 2 + 4, y0 + 70, 0), V(L / 2 + 22, y0 + 70, 0), 6));
  for (const s of [-1, 1]) B.add('frame', bentRod([V(s * L / 2, yt - 40, -110), V(s * (L / 2 + 55), yt - 40, -110), V(s * (L / 2 + 55), yt - 40, 110), V(s * L / 2, yt - 40, 110)], 7));
  // four swivel casters riding on the bottom shelf
  for (const x of [-L / 2 + 55, L / 2 - 55]) for (const z of [-W / 2 + 60, W / 2 - 60]) {
    B.add('zinc', new THREE.CylinderGeometry(32, 32, 20, 20).rotateX(PI / 2).translate(x, yWheel + 32, z));
    for (const s of [-1, 1]) B.add('zinc', bmm(x - 22, x + 22, yWheel + 28, y0 - 6, z + s * 13, z + s * 16));
    B.add('zinc', new THREE.CylinderGeometry(30, 30, 6, 16).translate(x, y0 - 3, z));
  }
  grp.add(B.build(M));
  return grp;
}

// ---------------------------------------------------------------- other accessories

function potjieBoom(M) {
  const pivot = new THREE.Group();
  pivot.name = 'Potjie boom';
  const B = new Part('Potjie boom pole');
  const Ht = 1720, arm = 420;
  B.add('galv', rod(V(0, 790, 0), V(0, Ht, 0), 16.8, 18));
  B.add('galv', new THREE.SphereGeometry(17, 12, 8, 0, PI * 2, 0, PI / 2).translate(0, Ht, 0));
  B.add('galv', rod(V(0, Ht - 20, 0), V(-arm, Ht - 20, 0), 8));
  B.add('galv', rod(V(-14, Ht - 240, 0), V(-arm + 40, Ht - 26, 0), 7));
  const links = 11, Lk = 13;
  for (let i = 0; i < links; i++) {
    const tor = new THREE.TorusGeometry(11, 3.4, 6, 14).scale(1, 1.7, 1);
    if (i % 2) tor.rotateY(PI / 2);
    B.add('galv', tor.translate(-arm + 20, Ht - 40 - i * 2 * Lk, 0));
  }
  const hy = Ht - 40 - links * 2 * Lk;
  B.add('galv', rod(V(-arm + 20, hy + 8, 0), V(-arm + 20, hy - 40, 0), 5));
  for (const ang of [0, (2 * PI) / 3, (4 * PI) / 3]) {
    const pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10, r = 6 + 34 * t; pts.push(V(-arm + 20 + r * Math.cos(ang), hy - 40 - 20 * Math.sin(PI * t) + 20 * t, r * Math.sin(ang))); }
    B.add('galv', curveRod(pts, 4, 16));
  }
  pivot.add(B.build(M));
  pivot.userData.hookPoint = V(-arm + 20, hy - 40, 0);
  pivot.position.set(X.xo + 26, 0, 200);
  return pivot;
}

function foldTable(M) {
  const pivot = new THREE.Group();
  pivot.name = 'Fold-up stainless table';
  const B = new Part('Table top');
  const w = 1300, d = 340, lip = 25;
  B.add('stainless', bmm(-w / 2, w / 2, -2.5, 0, 0, d));
  B.add('stainless', bmm(-w / 2, w / 2, -lip, 0, d - 2.5, d));
  for (const s of [-1, 1]) B.add('stainless', bx(s * w / 2, s * (w / 2 - 2.5), -lip, 0, 0, d));
  B.add('frame', rod(V(-w / 2, -6, 6), V(w / 2, -6, 6), 7));
  for (const s of [-1, 1]) B.add('frame', sq(V(s * 560, -lip - 4, 10), V(s * 560, -lip - 4, d - 30), 20, 12));
  pivot.add(B.build(M));
  pivot.position.set(0, X.base - 30, X.zo + 14);
  return pivot;
}

function storageCage(M) {
  const B = new Part('Grid & accessory storage cage (back)');
  const w = 1100, h = 360, d = 110, y0 = 300, zb = -X.zo - 6;
  B.add('frame', expandedMesh(w, h).rotateX(PI / 2).translate(0, y0 + h / 2, zb - d));
  B.add('frame', expandedMesh(w, d).translate(0, y0, zb - d / 2));
  for (const s of [-1, 1]) {
    B.add('frame', expandedMesh(d, h).rotateX(PI / 2).rotateY(PI / 2).translate(s * w / 2, y0 + h / 2, zb - d / 2));
    B.add('frame', sq(V(s * w / 2, y0, zb - d), V(s * w / 2, y0 + h, zb - d), 20));
    B.add('frame', sq(V(s * w / 2, y0, zb), V(s * w / 2, y0 + h, zb), 20));
    B.add('frame', bmm(s * 380 - 15, s * 380 + 15, y0 + h - 10, 686, zb - 6, X.legZ * -1 + 22));
  }
  B.add('frame', rebar(V(-w / 2, y0 + h, zb - d), V(w / 2, y0 + h, zb - d), 6));
  B.add('frame', sq(V(-w / 2, y0, zb - d), V(w / 2, y0, zb - d), 20));
  return B.build(M);
}

function storedGrids(M) {
  const grp = new THREE.Group();
  grp.name = 'Grids in storage';
  const big = hingedGrid(M, 'Large zinc-plated grid', 480, 340, 300);
  big.rotation.set(-PI / 2, 0, 0);
  big.position.set(-240, 300 + 180, -X.zo - 6 - 45);
  const small = hingedGrid(M, 'Small zinc-plated grid', 330, 250, 260);
  small.rotation.set(-PI / 2, 0, 0);
  small.position.set(280, 300 + 135, -X.zo - 6 - 80);
  grp.add(big, small);
  return grp;
}

function ashShovel(M) {
  const B = new Part('Ash shovel');
  const w = 150, l = 190;
  B.add('frame', bmm(-w / 2, w / 2, 0, 3, 0, l));
  for (const s of [-1, 1]) B.add('frame', bx(s * w / 2 - s * 3, s * w / 2, 0, 30, 0, l));
  B.add('frame', bmm(-w / 2, w / 2, 0, 30, 0, 3));
  B.add('frame', rebar(V(0, 15, 0), V(0, 15, -430), 6, 9));
  B.add('frame', new THREE.TorusGeometry(18, 4, 6, 14).rotateY(PI / 2).translate(0, 15, -450));
  const g = B.build(M);
  g.rotation.set(PI / 2, PI / 2, 0, 'YXZ');
  g.position.set(-X.legX - 44 - 15, 600 - 470, 100);
  return g;
}

function sHookZ(xr, yr, z, len) {
  const a = 13, pts = [];
  for (let k = 0; k <= 8; k++) { const t = PI * (k / 8); pts.push(V(xr + a * Math.cos(t), yr + a * Math.sin(t), z)); }
  for (let k = 0; k <= 8; k++) { const t = PI * (k / 8); pts.push(V(xr - a * Math.cos(t), yr - len - a * Math.sin(t), z)); }
  pts.push(V(xr + a - 2, yr - len + 10, z));
  return curveRod(pts, 3.5, 48);
}

function toolHooks(M) {
  const B = new Part('Tool hooks (S-hooks)');
  for (let i = 0; i < 6; i++) B.add('zinc', sHookZ(905, 670, -285 + i * 14, 120 + (i % 2) * 24));
  return B.build(M);
}

function lidHolder(M) {
  const B = new Part('Potjie lid holder');
  const w = 380, h = 320, top = 685;
  const y0 = top - h - 110;
  B.add('frame', bentRod([V(-w / 2, y0, 0), V(-w / 2, y0 + h, 0), V(w / 2, y0 + h, 0), V(w / 2, y0, 0)], 6));
  B.add('frame', rod(V(-w / 2, y0, 0), V(w / 2, y0, 0), 6));
  for (const x of [-60, 60]) B.add('frame', rod(V(x, y0, 0), V(x, y0 + h, 0), 5));
  // hangs over the side tool rail
  for (const x of [-70, 70]) B.add('frame', bentRod([V(x, y0 + h, 0), V(x, top, 0), V(x, top, 40), V(x, top - 30, 40)], 6));
  const g = B.build(M);
  g.rotation.y = -PI / 2;
  g.position.set(905 + 12 + 14, 0, 60);
  return g;
}

function cover(M) {
  const B = new Part('Heavy-duty waterproof cover');
  const W = 1820, Hc = 1600, D = 960;
  const g = new THREE.BoxGeometry(W, Hc, D, 18, 14, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sag = (y > Hc / 2 - 60 ? 0 : 1) * 11 * Math.sin(x / 130) * Math.sin(y / 150);
    p.setXYZ(i, x * (1 + 0.01 * Math.sin(y / 90)), y, z + Math.sign(z) * sag);
  }
  g.computeVertexNormals();
  g.translate(60, Hc / 2 + 2, -40);
  B.add('fabric', g);
  return B.build(M);
}

// ---------------------------------------------------------------- assembly

export const XL_ACCESSORIES = [
  { key: 'hood', label: 'Brick-insulated lid (oven)' },
  { key: 'spitA', label: 'Rotisserie A — front spit, motor right' },
  { key: 'spitB', label: 'Rotisserie B — back spit, motor left' },
  { key: 'brazier', label: 'Mobile coal brazier (makeshift firebox)' },
  { key: 'boom', label: 'Potjie boom (chain + hook)' },
  { key: 'potjie', label: 'Potjie pot #3 on the boom' },
  { key: 'table', label: 'Fold-up stainless table' },
  { key: 'cage', label: 'Back storage cage' },
  { key: 'storedGrids', label: 'Zinc grids in storage' },
  { key: 'shovel', label: 'Ash shovel' },
  { key: 'hooks', label: 'Tool hooks' },
  { key: 'lidHolder', label: 'Potjie lid holder' },
  { key: 'cover', label: 'Waterproof cover' },
];

const BASE_ON = ['hood', 'brazier', 'table', 'cage', 'storedGrids', 'shovel', 'hooks', 'lidHolder'];
export const XL_PRESETS = {
  showcase: { label: 'Showcase', left: ['plancha', 1], right: ['gridRound', 0], on: [...BASE_ON, 'boom', 'potjie'], lid: 1, intake: 0.6, exhaust: 0.6 },
  grills: { label: 'Two half grills', left: ['grateV', 1], right: ['gridRound', 1], on: [...BASE_ON, 'boom'], lid: 1, intake: 1, exhaust: 1 },
  plancha: { label: 'Plancha + press', left: ['plancha', 1], right: ['press', 1], on: [...BASE_ON], lid: 1, intake: 1, exhaust: 1, pressOpen: 0.45 },
  rotisserie: { label: 'Twin rotisserie', left: ['none', 0], right: ['none', 0], on: [...BASE_ON, 'spitA', 'spitB'], lid: 1, intake: 1, exhaust: 1 },
  oven: { label: 'Oven mode', left: ['gridRound', 1], right: ['gridRound', 1], on: [...BASE_ON], lid: 0, intake: 0.35, exhaust: 0.5 },
  ovenSpit: { label: 'Oven + rotisserie', left: ['none', 0], right: ['none', 0], on: [...BASE_ON, 'spitA', 'spitB'], lid: 0, intake: 0.35, exhaust: 0.5 },
  covered: { label: 'Covered', left: ['none', 0], right: ['none', 0], on: ['hood', 'cover', 'cage', 'table'], lid: 0, intake: 0, exhaust: 0, table: 0 },
};

export function buildPauloXL({ finish = 'black' } = {}) {
  resetSeed(11);
  const M = createMaterials();
  applyFinish(M, finish);
  const root = new THREE.Group();
  root.name = 'Paulo XL';
  root.scale.setScalar(0.001);
  const body = new THREE.Group();
  body.name = 'Paulo XL body';
  body.add(cart(M), braaiBox(M));
  root.add(body);

  const parts = {};
  const put = (k, o) => { parts[k] = o; root.add(o); return o; };

  const lid = put('hood', hood(M));
  const struts = [makeStrut(M), makeStrut(M)];
  struts.forEach((s) => body.add(s));
  const intakes = X.vents.map((cx) => intakeDamper(M, cx));
  intakes.forEach((d) => body.add(d));
  put('spitA', rotisserie(M, X.spitZ[0], 1));
  put('spitB', rotisserie(M, X.spitZ[1], -1));
  const braz = put('brazier', brazier(M));
  const boom = put('boom', potjieBoom(M));
  const pot = potjiePot(M);
  boom.add(pot);
  const hp = boom.userData.hookPoint;
  pot.position.set(hp.x, hp.y - pot.userData.bailTop.y + 6, hp.z);
  parts.potjie = pot;
  put('table', foldTable(M));
  put('cage', storageCage(M));
  put('storedGrids', storedGrids(M));
  put('shovel', ashShovel(M));
  put('hooks', toolHooks(M));
  put('lidHolder', lidHolder(M));
  put('cover', cover(M));

  // half positions: every attachment type is built for both sides; one is shown at a time
  const halves = { left: { sgn: -1, type: 'none', level: 1, groups: {} }, right: { sgn: 1, type: 'none', level: 1, groups: {} } };
  const halvesRoot = new THREE.Group();
  halvesRoot.name = 'Cooking surfaces';
  root.add(halvesRoot);
  for (const h of Object.values(halves)) {
    for (const [k, fn] of Object.entries(HALF_BUILDERS)) {
      const g = fn(M);
      g.visible = false;
      h.groups[k] = g;
      halvesRoot.add(g);
    }
    h.bar = centreBar(M);
    h.bar.visible = false;
    halvesRoot.add(h.bar);
  }

  const state = { lid: 1, intake: 0.5, exhaust: 0.5, brazier: 0, table: 1, press: 0.45, boom: 0 };

  function placeHalf(side) {
    const h = halves[side];
    for (const [k, g] of Object.entries(h.groups)) {
      g.visible = k === h.type;
      g.position.set(h.sgn * X.xi / 2, railY(h.level), 0);
      g.rotation.x = k === 'grateV' ? 0.035 : 0;
    }
    h.bar.visible = h.type !== 'none';
    h.bar.position.set(0, railY(h.level), 0);
  }

  const api = {
    root, parts, materials: M, body, halves, state,
    setFinish: (k) => applyFinish(M, k),
    setVisible(key, v) {
      if (!parts[key]) return;
      parts[key].visible = v;
      if (key === 'boom' && !v) parts.potjie.visible = false;
      if (key === 'potjie' && v) parts.boom.visible = true;
    },
    setHalf(side, type) { halves[side].type = type; placeHalf(side); },
    setHalfLevel(side, level) { halves[side].level = level; placeHalf(side); },
    setLid(f) {
      state.lid = f;
      lid.rotation.x = -f * 1.72;
      const { H, studs } = lid.userData;
      studs.forEach((s, i) => {
        const p = V(s.x, s.y - H.y, s.z - H.z).applyAxisAngle(V(1, 0, 0), lid.rotation.x).add(H);
        struts[i].userData.update(V(s.x, 900, -300), p);
      });
    },
    setIntake(f) { state.intake = f; intakes.forEach((d) => { d.position.x = d.userData.x0 + Math.sign(d.userData.x0) * f * 240; }); },
    setExhaust(f) { state.exhaust = f; lid.userData.dampers.forEach((d) => { d.rotation.x = f * (PI / 2) * 0.95; }); },
    setPress(f) { state.press = f; for (const h of Object.values(halves)) h.groups.press.userData.lid.rotation.x = -f * 1.3; },
    setBrazier(f) { state.brazier = f; braz.position.x = f * 380; },
    setTableOpen(f) { state.table = f; parts.table.rotation.x = (1 - f) * (PI / 2); },
    setBoomAngle(a) { state.boom = a; parts.boom.rotation.y = a; },
    spin(dt) { for (const k of ['spitA', 'spitB']) parts[k].userData.spit.rotation.x += dt * 1.2; },
    applyPreset(name) {
      const p = XL_PRESETS[name];
      for (const { key } of XL_ACCESSORIES) parts[key].visible = p.on.includes(key);
      if (parts.potjie.visible) parts.boom.visible = true;
      for (const side of ['left', 'right']) { halves[side].type = p[side][0]; halves[side].level = p[side][1]; placeHalf(side); }
      api.setLid(p.lid); api.setIntake(p.intake); api.setExhaust(p.exhaust);
      api.setPress(p.pressOpen ?? 0.45); api.setTableOpen(p.table ?? 1); api.setBoomAngle(0);
      return api.snapshot();
    },
    snapshot: () => ({
      vis: Object.fromEntries(XL_ACCESSORIES.map(({ key }) => [key, parts[key].visible])),
      left: { type: halves.left.type, level: halves.left.level },
      right: { type: halves.right.type, level: halves.right.level },
      ...state,
    }),
    // airflow paths for oven mode (mm, root space): intake low at the front, out through the rear flues
    airflowPaths() {
      return X.vents.map((cx) => {
        const s = Math.sign(cx);
        return [V(cx, 775, 560), V(cx, 775, 345), V(cx, 790, 160), V(cx, 900, -20), V(cx * 0.9, 1130, 120), V(cx * 1.1, 1300, 40),
          V(s * 450, 1330, -150), V(s * 450, 1450, -180), V(s * 450, 1640, -180)];
      });
    },
  };
  api.applyPreset('showcase');
  return api;
}
