// Bundles both viewers into self-contained HTML pages in docs/ (and dist/ for local use).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const tpl = readFileSync('src/template.html', 'utf8');
const bundle = async (entry) => (await build({
  entryPoints: [entry], bundle: true, format: 'esm', minify: true, write: false,
})).outputFiles[0].text.replaceAll('</script', '<\\/script');

const pages = [
  {
    file: 'index.html', entry: 'src/viewer-xl.js',
    TITLE: 'Paulo XL — 3D concept',
    H1: 'Paulo XL',
    SUB: 'Concept · drag to orbit, pinch or scroll to zoom, tap a part to name it',
    NAV: '<nav><a href="original.html">Original Paulo →</a></nav>',
    SPECS: 'Brick-lined fire box <b>1400 × 600 mm</b>, <b>260–440 mm</b> deep · two half positions <b>690 × 590 mm</b> · outside <b>1540 × 672 mm</b> · <b>1.64 m</b> to the flue caps, <b>2.0 m</b> with the lid open',
  },
  {
    file: 'original.html', entry: 'src/viewer.js',
    TITLE: 'Paulo Braai — 3D model',
    H1: 'Paulo Braai',
    SUB: 'Backyard Smoker Braai · drag to orbit, scroll to zoom, hover to name parts',
    NAV: '<nav><a href="index.html">← Paulo XL concept</a></nav>',
    SPECS: 'Full grid <b>900 × 500 mm</b> · overall approx. <b>1.6 m long × 1.6 m high (boom) × 0.6 m deep</b> · grid height approx. <b>870 mm</b>',
  },
];
mkdirSync('docs', { recursive: true });
for (const p of pages) {
  const js = await bundle(p.entry);
  let html = tpl;
  for (const k of ['TITLE', 'H1', 'SUB', 'NAV', 'SPECS']) html = html.replace(`<!--${k}-->`, () => p[k]);
  html = html.replace('<!--SCRIPT-->', () => `<script type="module">${js}</script>`);
  writeFileSync(`docs/${p.file}`, html);
  console.log(p.file, (html.length / 1024).toFixed(0) + ' KB');
}
writeFileSync('docs/.nojekyll', '');
