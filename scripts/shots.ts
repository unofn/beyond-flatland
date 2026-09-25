/**
 * Multi-device screenshots with Playwright's device emulation (the same CDP
 * emulation as DevTools' device toolbar: viewport, DPR, touch, UA). Runs in
 * its own headless Chromium, so it never touches a desktop browser window.
 *
 *   pnpm shots                         # every page, every device, light + dark
 *   pnpm shots --pages /zh/slicing/    # only matching paths (substring, comma-separated)
 *   pnpm shots --devices phone --schemes light
 *   pnpm shots --paths /zh/kit/        # exact paths, skipping discovery (e.g. dev-only drafts)
 *   pnpm shots --wait 5000             # let intro animations finish before the first frame
 *   pnpm shots --full                  # one full-page image instead of per-viewport frames
 *
 * Builds nothing and starts nothing: serve the site first (`pnpm build && pnpm preview`
 * or `pnpm dev`) and pass --base if it is not http://localhost:4321.
 * Output: shots/<device>-<scheme>/<path>/NN.png plus shots/report.json with
 * console errors and horizontal-overflow checks per page.
 */
import { chromium, devices, type BrowserContextOptions } from 'playwright';
import { mkdir, readdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DEVICES: Record<string, BrowserContextOptions> = {
  phone: devices['iPhone 13']!, // 390 × 844, DPR 3, touch
  android: devices['Pixel 7']!, // 412 × 915
  small: { ...devices['iPhone SE']!, viewport: { width: 360, height: 740 } }, // narrowest we support
  tablet: devices['iPad Mini']!, // 768 × 1024
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const list = (v: string | undefined) => v?.split(',').map((s) => s.trim()).filter(Boolean);

const base = (arg('base') ?? 'http://localhost:4321').replace(/\/$/, '');
const deviceNames = list(arg('devices')) ?? ['phone', 'tablet', 'desktop'];
const schemes = (list(arg('schemes')) ?? ['light', 'dark']) as ('light' | 'dark')[];
const pageFilter = list(arg('pages'));
const full = flag('full');
const maxFrames = Number(arg('frames') ?? 12);
const out = arg('out') ?? 'shots';
const wait = Number(arg('wait') ?? 600); // ms after load, e.g. to let an intro animation finish

/** Page paths from the built site (every index.html under dist), else a fallback list. */
async function discoverPages(): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, rel: string) {
    for (const name of await readdir(dir)) {
      const p = join(dir, name);
      if ((await stat(p)).isDirectory()) await walk(p, `${rel}${name}/`);
      else if (name === 'index.html' && rel) found.push(`/${rel}`);
    }
  }
  try {
    await walk('dist', '');
  } catch {
    return ['/zh/', '/en/', '/zh/lab/', '/en/lab/'];
  }
  return found.sort();
}

interface PageReport {
  device: string;
  scheme: string;
  path: string;
  errors: string[];
  overflowX: number;
  frames: number;
}

const explicit = list(arg('paths'));
const pages = explicit ?? (await discoverPages()).filter((p) => !pageFilter || pageFilter.some((f) => p.includes(f)));
if (!pages.length) {
  console.error('No pages matched.');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports: PageReport[] = [];

for (const deviceName of deviceNames) {
  const device = DEVICES[deviceName];
  if (!device) throw new Error(`Unknown device "${deviceName}". Known: ${Object.keys(DEVICES).join(', ')}`);
  for (const scheme of schemes) {
    const context = await browser.newContext({ ...device, colorScheme: scheme });
    for (const path of pages) {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      // The dev server compiles on first hit; retry once, and don't let a busy
      // network (HMR socket, fonts) block the shot forever.
      try {
        await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45_000 });
      } catch {
        await page.goto(base + path, { waitUntil: 'load', timeout: 60_000 });
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(wait);

      const dir = join(out, `${deviceName}-${scheme}`, path.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'root');
      await mkdir(dir, { recursive: true });
      let frames = 0;
      if (full) {
        await page.screenshot({ path: join(dir, '00.png'), fullPage: true });
        frames = 1;
      } else {
        const { height, vh } = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, vh: innerHeight }));
        const stepPx = Math.max(vh * 0.9, (height - vh) / Math.max(maxFrames - 1, 1));
        for (let y = 0; frames < maxFrames; y += stepPx) {
          await page.evaluate((top) => window.scrollTo(0, top), Math.min(y, height - vh));
          await page.waitForTimeout(450);
          await page.screenshot({ path: join(dir, `${String(frames).padStart(2, '0')}.png`) });
          frames++;
          if (y >= height - vh) break;
        }
      }
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      reports.push({ device: deviceName, scheme, path, errors, overflowX, frames });
      const flags = [errors.length ? `${errors.length} console errors` : '', overflowX > 0 ? `overflows by ${overflowX}px` : '']
        .filter(Boolean)
        .join(', ');
      console.log(`${deviceName.padEnd(8)} ${scheme.padEnd(5)} ${path.padEnd(24)} ${frames} frames ${flags}`);
      await page.close();
    }
    await context.close();
  }
}

await browser.close();
await writeFile(join(out, 'report.json'), JSON.stringify(reports, null, 2));
const bad = reports.filter((r) => r.errors.length || r.overflowX > 0);
console.log(`\n${reports.length} page views, ${bad.length} with problems. Report: ${join(out, 'report.json')}`);
