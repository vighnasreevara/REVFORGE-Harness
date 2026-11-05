// End-to-end smoke test of the production build.
//  1. serves dist/ with `vite preview` on 127.0.0.1;
//  2. checks the page, its Content-Security-Policy, and that every evidence file
//     served matches the SHA-256 recorded in the manifest;
//  3. if Edge or Chrome is installed, renders key routes headlessly (real
//     browser, real CSP) and checks the rendered DOM.
// Usage: node scripts/smoke.mjs [--out results.json]
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DASH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}/`;
const outArg = process.argv.indexOf('--out');
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

if (!fs.existsSync(path.join(DASH, 'dist', 'index.html'))) {
  console.error('dist/ not found: run npm run build first');
  process.exit(2);
}

const server = spawn(process.execPath, [path.join(DASH, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: DASH, stdio: 'ignore' });
const stop = () => {
  try {
    server.kill();
  } catch {
    /* already stopped */
  }
};
process.on('exit', stop);

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function browser() {
  const candidates = [
    process.env.REVFORGE_SMOKE_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

function dumpDom(exe, url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-smoke-'));
  try {
    return execFileSync(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--user-data-dir=${profile}`, '--virtual-time-budget=20000', '--run-all-compositor-stages-before-draw', '--dump-dom', url], { encoding: 'utf8', timeout: 180000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

try {
  record('preview server starts', await waitUp(), BASE);
  const html = await (await fetch(BASE)).text();
  record('index served with title', html.includes('<title>REVFORGE Command Center</title>'));
  record('production CSP present', /http-equiv="Content-Security-Policy"[^>]*default-src 'self'; script-src 'self'/.test(html));
  record('no external script or stylesheet', !/<(script|link)[^>]+(src|href)="https?:/i.test(html));

  const manifest = await (await fetch(`${BASE}evidence/manifest.json`)).json();
  const files = [...manifest.sources, ...manifest.collections.flatMap((c) => c.files)].filter((f) => !f.missing);
  let bad = 0;
  for (const f of files) {
    const r = await fetch(`${BASE}evidence/${f.path}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok || createHash('sha256').update(buf).digest('hex') !== f.sha256) bad++;
  }
  record('every served evidence file matches its manifest SHA-256', bad === 0, `${files.length - bad}/${files.length}`);
  record('manifest baseline commit recorded', /^[0-9a-f]{40}$/.test(manifest.baseline_commit ?? ''), manifest.baseline_commit ?? 'none');

  const exe = browser();
  if (!exe) {
    record('headless browser render', true, 'skipped: no Edge/Chrome found (set REVFORGE_SMOKE_BROWSER)');
  } else {
    const routes = [
      ['/', ['Executive overview', 'COBOL-to-Java behavioral equivalence has not been established.', 'Open gap records']],
      ['/comparison', ['Reverse vs forward comparison', '1,337 / 1,936']],
      ['/programs', ['Program explorer', '1–42 of 42 programs']],
      ['/programs/PORTREAD', ['complete under the current criteria']],
      ['/rules', ['Business rules explorer', 'of 154 rules']],
      ['/gaps', ['Master gap register', '1–25 of 569 gap records']],
      ['/gaps/MGR-0566', ['COBOL-to-Java runtime equivalence']],
      ['/dependencies', ['Dependency analysis', '<canvas']],
      ['/roadmap', ['570 phase memberships represent 569 unique gap records']],
      ['/diagrams/FLOW-PORTREAD', ['revforge-mermaid-', '<svg']],
      ['/bmad', ['BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED', 'Not authorized']],
      ['/testing', ['Testing and readiness', '412 / 412']],
      ['/handover', ['Handover and evidence', 'Limitations']],
      ['/evidence', ['Evidence validation', 'cross-checks agree']],
    ];
    for (const [route, expects] of routes) {
      let dom = '';
      try {
        dom = dumpDom(exe, `${BASE}#${route}`);
      } catch (e) {
        record(`render ${route}`, false, String(e).slice(0, 200));
        continue;
      }
      const missing = expects.filter((x) => !dom.includes(x));
      const unavailable = dom.includes('Evidence unavailable');
      record(`render ${route}`, missing.length === 0 && !unavailable, missing.length ? `missing: ${missing.join(' | ')}` : unavailable ? 'evidence unavailable shown' : `${path.basename(exe)} headless`);
    }
  }
} catch (e) {
  record('smoke test', false, String(e));
} finally {
  stop();
}

const failed = results.filter((r) => !r.ok).length;
if (outArg > 0) fs.writeFileSync(process.argv[outArg + 1], JSON.stringify({ contract: 'step-24/smoke-results', passed: results.length - failed, failed, results }, null, 1) + '\n');
console.log(`smoke: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
