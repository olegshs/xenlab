// Generates the favicon and the PNG icons / social preview image in public/.
// The PNGs are rendered with a headless Chrome or Edge; set CHROME_PATH if it is not found.
//   npm run images
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const publicDir = join(root, 'public');

const BG = '#1b1e27';
const INK = '#eef0f6';

/**
 * The XenLab mark: a ring of N dots coloured by degree (as on the app's keyboard) around an "X".
 * `background`: 'rounded' | 'square' | 'none'.
 */
function mark({ n = 19, background = 'rounded' } = {}) {
  const dotR = n <= 19 ? 27 : 17;
  const ringR = 172;
  const dots = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = (256 + ringR * Math.cos(a)).toFixed(2);
    const y = (256 + ringR * Math.sin(a)).toFixed(2);
    const hue = Math.round((360 * i) / n);
    const tonic = i === 0 ? ` stroke="${INK}" stroke-width="7"` : '';
    return `<circle cx="${x}" cy="${y}" r="${dotR}" fill="hsl(${hue} 80% 64%)"${tonic}/>`;
  }).join('');
  const bg =
    background === 'none' ? '' : `<rect width="512" height="512" rx="${background === 'rounded' ? 112 : 0}" fill="${BG}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${dots}` +
    `<path d="M206 206L306 306M306 206L206 306" stroke="${INK}" stroke-width="34" stroke-linecap="round"/></svg>\n`
  );
}

const page = (body, w, h, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif}
svg{display:block}${css}</style></head><body>${body}</body></html>`;

const iconPage = (svg, size) => page(svg.replace('<svg ', `<svg width="${size}" height="${size}" `), size, size);

const CHIPS = ['12-EDO', '19-EDO', '31-EDO', '53-EDO', 'Bohlen–Pierce', 'Just intonation', 'Scala .scl'];

const ogPage = page(
  `<main>
    <div class="text">
      <div class="brand">${mark({ n: 19 }).replace('<svg ', '<svg width="84" height="84" ')}<h1>XenLab</h1></div>
      <h2>Microtonal sandbox</h2>
      <p>Play any tuning from your computer keyboard and hear its intervals, chords and generated melodies.</p>
      <ul>${CHIPS.map((c) => `<li>${c}</li>`).join('')}</ul>
    </div>
    <div class="wheel">${mark({ n: 31, background: 'none' }).replace('<svg ', '<svg width="430" height="430" ')}</div>
  </main>`,
  1200,
  630,
  `
body{background:radial-gradient(circle at 78% 50%,#2b3060 0,#12141a 62%);color:${INK}}
main{display:flex;align-items:center;justify-content:space-between;height:100%;padding:0 64px 0 80px;box-sizing:border-box}
.text{max-width:640px}
.brand{display:flex;align-items:center;gap:22px}
h1{margin:0;font-size:104px;font-weight:800;letter-spacing:-2px;line-height:1}
h2{margin:14px 0 0;font-size:42px;font-weight:600;color:#8c96ff}
p{margin:22px 0 0;font-size:28px;line-height:1.35;color:#c4c8d6}
ul{display:flex;flex-wrap:wrap;gap:10px;margin:30px 0 0;padding:0;list-style:none}
li{font-size:22px;padding:7px 16px;border-radius:999px;background:rgba(140,150,255,.16);color:#d3d7ff}`,
);

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('Chrome/Edge not found: set CHROME_PATH');
  return found;
}

function screenshot(chrome, html, file, width, height, transparent) {
  const dir = mkdtempSync(join(tmpdir(), 'xenlab-img-'));
  try {
    const htmlFile = join(dir, 'page.html');
    writeFileSync(htmlFile, html);
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--user-data-dir=${join(dir, 'profile')}`,
      `--window-size=${width},${height}`,
      `--screenshot=${file}`,
      ...(transparent ? ['--default-background-color=00000000'] : []),
      pathToFileURL(htmlFile).href,
    ];
    const r = spawnSync(chrome, args, { stdio: 'pipe', timeout: 60_000 });
    if (r.status !== 0 || !existsSync(file)) {
      throw new Error(`Rendering ${file} failed: ${r.stderr?.toString() || r.error}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'favicon.svg'), mark());

const chrome = findChrome();
const jobs = [
  { file: 'icon-512.png', html: iconPage(mark(), 512), w: 512, h: 512, transparent: true },
  { file: 'icon-192.png', html: iconPage(mark(), 192), w: 192, h: 192, transparent: true },
  // iOS rounds the corners itself and dislikes transparency.
  { file: 'apple-touch-icon.png', html: iconPage(mark({ background: 'square' }), 180), w: 180, h: 180 },
  { file: 'og-image.png', html: ogPage, w: 1200, h: 630 },
];
for (const job of jobs) {
  const out = join(publicDir, job.file);
  screenshot(chrome, job.html, out, job.w, job.h, job.transparent);
  console.log(`${job.file}  ${statSync(out).size} bytes`);
}
console.log('favicon.svg written');
