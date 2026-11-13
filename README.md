# Paulo braai — 3D models

Live site: https://kkonkobo.github.io/paulo-braai-3d/

- `index.html` — **Paulo XL** concept: the original Paulo without the side firebox, made longer, wider and deeper,
  fully firebrick-lined, with two half-length cooking positions (V-channel grate, round-bar grate, plancha, sandwich press),
  twin removable rotisseries, a brick-insulated lid with gasket, twin thermometers and dual-zone intake/flue vents for oven use,
  and a mobile coal brazier on the bottom shelf.
- `original.html` — the Paulo braai as built, modelled from the maker's photos (full grid 900 × 500 mm).

Models are procedural Three.js (`src/model.js`, `src/model-xl.js`, dimensions in mm).

```
npm install
node build.mjs        # bundles docs/index.html and docs/original.html (self-contained, work offline)
node export-glb.mjs   # writes GLB files to dist/
```
