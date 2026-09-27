/**
 * Renders the film frame by frame: serves video/ with Vite (astro's own copy),
 * drives the page's `frame(t)` in headless Chromium, screenshots every frame
 * and pipes the PNGs into ffmpeg.
 *
 *   node video/render.ts                       # the whole film, one take, + audio + SRT
 *   node video/render.ts --scale 2             # supersampled (final quality)
 *   node video/render.ts --film --stills 22,23 # film-clock stills (check a hand-off)
 *   node video/render.ts --film --range 20,26  # a stretch of the film as an MP4
 *   node video/render.ts --scenes slice        # one movement on its own clock (MP4)
 *   node video/render.ts --scenes slice --stills 0,3,6
 *   node video/render.ts --assemble            # re-mix audio/subtitles over the last film render
 *
 * The film: movements overlap by OVERLAP s and cross-dissolve in the page;
 * narration is placed on its beats (voice.ts), music ducked under it
 * (music.ts), loudness-normalised, plus zh / en / zh-en SRT files.
 *
 * Output (all under shots/video/, gitignored):
 *   release/  what gets uploaded: the film, covers, subtitles, titles and descriptions
 *   work/     the pipeline's own files: voice clips + timing.json (voice.ts), picture, voice, music, mix
 *   stills/   --stills PNGs;  clips/  --scenes / --range MP4s  (both safe to empty)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { filmLayout, type SceneTiming } from './lib/timing.ts';

interface Timing {
  voice: string;
  scenes: Record<string, SceneTiming & { clips: string[] }>;
}

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
};
const fps = Number(arg('fps', '30'));
const theme = arg('theme', 'light');
/** --4k: supersample at 2× and keep it (3840×2160, for YouTube); otherwise --scale n downsamples to 1080p. */
const uhd = argv.includes('--4k');
const scale = uhd ? 2 : Number(arg('scale', '1'));
const port = Number(arg('port', '4471'));
const only = arg('scenes', '');
const stills = arg('stills', '');
const range = arg('range', '');
const filmOnly = argv.includes('--film') || !!range;
const outRoot = resolve(repo, arg('out', 'shots/video'));
const dir = { release: join(outRoot, 'release'), work: join(outRoot, 'work'), stills: join(outRoot, 'stills'), clips: join(outRoot, 'clips') };
for (const d of Object.values(dir)) mkdirSync(d, { recursive: true });

// Vite is not a direct dependency; borrow the one astro ships with.
const req = createRequire(join(repo, 'package.json'));
const viteEntry = createRequire(req.resolve('astro/package.json')).resolve('vite');
const vite = (await import(pathToFileURL(viteEntry).href)) as {
  createServer(cfg: object): Promise<{ listen(): Promise<unknown>; close(): Promise<void> }>;
};
const server = await vite.createServer({
  configFile: false,
  root: here,
  logLevel: 'warn',
  // One dep-optimizer cache per port, so parallel renders don't invalidate each other.
  cacheDir: join(repo, 'node_modules/.vite-video', String(port)),
  // No HMR: edits elsewhere under video/ must not reload a page mid-render.
  server: { port, strictPort: true, hmr: false, watch: null, fs: { allow: [repo] } },
});
await server.listen();
const base = `http://localhost:${port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
// Measured narration timing (from voice.ts); without it the page estimates.
const timingFile = join(dir.work, 'timing.json');
const timing = existsSync(timingFile) ? (JSON.parse(readFileSync(timingFile, 'utf8')) as Timing) : null;
if (timing) await context.addInitScript((s) => (window.__timing = s), timing.scenes);
else console.log('no work/timing.json: estimating beats (run node video/voice.ts first)');
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
const cdp = await context.newCDPSession(page);

async function open(query: string): Promise<number> {
  await page.goto(`${base}?${query}&theme=${theme}`);
  await page.waitForFunction(() => window.__video || window.__videoError, null, { timeout: 60_000 });
  const err = await page.evaluate(() => window.__videoError);
  if (err) throw new Error(err);
  return page.evaluate(() => window.__video!.duration);
}

async function shot(): Promise<Buffer> {
  // Without clip.scale Chrome returns CSS pixels (1920×1080) even at deviceScaleFactor 2.
  const clip = { x: 0, y: 0, width: 1920, height: 1080, scale };
  const { data } = (await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip })) as { data: string };
  return Buffer.from(data, 'base64');
}

// Scene ids in film order, straight from the page.
await page.goto(base);
await page.waitForFunction(() => window.__sceneIds);
const ids = only ? only.split(',') : await page.evaluate(() => window.__sceneIds!);

const tag = uhd ? `${theme}-2160p` : theme;
const started = Date.now();
const assembling = argv.includes('--assemble');
/** What to render: the film on one clock, or movements on their own. */
const units = assembling ? [] : only && !filmOnly ? ids.map((id) => ({ name: id, query: `scene=${id}` })) : [{ name: 'film', query: 'film=1' }];

for (const u of units) {
  const duration = await open(u.query);

  if (stills) {
    for (const t of stills.split(',').map(Number)) {
      await page.evaluate((t) => window.__video!.frame(t), t);
      const file = join(dir.stills, `${u.name}-${tag}-t${t}.png`);
      writeFileSync(file, await shot());
      console.log(file);
    }
    continue;
  }

  const [from, to] = range ? range.split(',').map(Number) : [0, duration];
  const first = Math.round(from! * fps);
  const last = Math.min(Math.round(to! * fps), Math.round(duration * fps));
  // The whole film's picture is a work file (audio is added in assemble); anything partial is a clip.
  const file = u.name === 'film' && !range ? join(dir.work, `film-${tag}.mp4`) : join(dir.clips, range ? `${u.name}-${tag}-${from}-${to}.mp4` : `${u.name}-${tag}.mp4`);
  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      ...(scale !== 1 && !uhd ? ['-vf', 'scale=1920:1080:flags=lanczos'] : []),
      // Closed GOP of half a second and 2 B-frames, as YouTube recommends.
      '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-g', String(fps / 2), '-bf', '2',
      '-movflags', '+faststart', file,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const done = new Promise<void>((ok, fail) => ff.on('close', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`)))));
  const t0 = Date.now();
  for (let i = first; i < last; i++) {
    await page.evaluate((t) => window.__video!.frame(t), i / fps);
    const png = await shot();
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % fps === 0) process.stdout.write(`\r${u.name}: ${i - first}/${last - first} frames`);
  }
  ff.stdin.end();
  await done;
  const secs = (Date.now() - t0) / 1000;
  const n = last - first;
  console.log(`\r${u.name}: ${n} frames in ${secs.toFixed(1)} s (${((secs / n) * 1000).toFixed(0)} ms/frame) → ${file}`);
}

// A full film run also makes the covers from the thumbnail scene.
if (!only && !filmOnly && !stills && !assembling) {
  await open('scene=thumbnail');
  await page.evaluate(() => window.__video!.frame(0.5));
  const png = join(dir.work, `thumbnail-${theme}.png`);
  writeFileSync(png, await shot());
  await run(['-i', png, '-vf', 'scale=1280:720:flags=lanczos', join(dir.release, 'youtube-thumbnail.png')]);
  // Bilibili's cover is 16:10: pad the paper above and below.
  await run(['-i', png, '-vf', 'scale=1146:-2:flags=lanczos,pad=1146:717:0:(oh-ih)/2:color=0xefeee7', join(dir.release, 'bilibili-cover-1146x717.png')]);
}

await browser.close();
await server.close();

// ---- the film: picture + narration + music + subtitles ----

function run(args: string[]) {
  return new Promise<void>((ok, fail) =>
    spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }).on('close', (c) =>
      c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}: ${args.slice(-1)[0]}`)),
    ),
  );
}

function srtTime(s: number) {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

async function assemble(order: string[]) {
  if (!timing) throw new Error('assembling needs work/timing.json (node video/voice.ts)');
  const picture = join(dir.work, `film-${tag}.mp4`);
  if (!existsSync(picture)) throw new Error(`no ${picture}: render the film first`);

  // Movement starts on the film's clock, exactly as the page lays them out.
  const { starts: offsets, duration: total } = filmLayout(order.map((id) => timing.scenes[id]!));

  // Narration: every clip delayed to its beat.
  const clips = order.flatMap((id, k) => timing.scenes[id]!.beats.map((b, i) => ({ file: timing.scenes[id]!.clips[i]!, at: offsets[k]! + b.start })));
  const voice = join(dir.work, 'voice.wav');
  await run([
    ...clips.flatMap((c) => ['-i', c.file]),
    '-filter_complex',
    clips.map((c, i) => `[${i}]adelay=${Math.round(c.at * 1000)}:all=1[v${i}]`).join(';') +
      `;${clips.map((_, i) => `[v${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,apad=whole_dur=${total.toFixed(3)}[out]`,
    '-map', '[out]', '-ar', '48000', '-ac', '1', voice,
  ]);

  // Music, ducked a little under the voice, then the whole mix to -16 LUFS.
  const music = join(dir.work, 'music.wav');
  await new Promise<void>((ok, fail) =>
    spawn('node', [join(here, 'music.ts'), '--seconds', total.toFixed(3), '--out', music], { stdio: 'inherit' }).on('close', (c) =>
      c === 0 ? ok() : fail(new Error('music failed')),
    ),
  );
  const mix = join(dir.work, 'mix.wav');
  await run([
    '-i', voice, '-i', music,
    '-filter_complex',
    '[0]loudnorm=I=-14:TP=-2:LRA=9,pan=stereo|c0=c0|c1=c0,asplit[v][key];' +
      '[1]volume=-17dB[m];[m][key]sidechaincompress=threshold=0.03:ratio=3:attack=60:release=700[md];' +
      '[v][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[out]',
    '-map', '[out]', '-ar', '48000', mix,
  ]);

  const film = join(dir.release, `beyond-flatland-${tag}.mp4`);
  await run(['-i', picture, '-i', mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', film]);
  if (uhd) {
    // A 1080p copy too, for when the 4K upload is too slow.
    const hd = join(dir.release, `beyond-flatland-${theme}-1080p.mp4`);
    await run(['-i', film, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '17', '-preset', 'slow', '-g', String(fps / 2), '-bf', '2', '-c:a', 'copy', '-movflags', '+faststart', hd]);
  }

  // Subtitles, timed as they appear on screen (each until the next cue or scene end).
  const cues = order.flatMap((id, k) => {
    const sc = timing.scenes[id]!;
    return sc.beats.flatMap((b, i) => (b.sub === false ? [] : [{
      from: offsets[k]! + b.start,
      to: offsets[k]! + (sc.beats[i + 1]?.start ?? sc.duration) - 0.2,
      zh: b.zh,
      en: b.en,
    }]));
  });
  const srt = (line: (c: (typeof cues)[number]) => string) =>
    cues.map((c, i) => `${i + 1}\n${srtTime(c.from)} --> ${srtTime(c.to)}\n${line(c)}\n`).join('\n');
  writeFileSync(join(dir.release, 'beyond-flatland.zh.srt'), srt((c) => c.zh));
  writeFileSync(join(dir.release, 'beyond-flatland.en.srt'), srt((c) => c.en));
  writeFileSync(join(dir.release, 'beyond-flatland.zh-en.srt'), srt((c) => `${c.zh}\n${c.en}`));
  writeFileSync(join(dir.release, 'youtube.txt'), youtube(order, offsets));
  writeFileSync(join(dir.release, 'bilibili.txt'), bilibili(order, offsets));
  console.log(`film ${total.toFixed(1)} s → ${film}`);
}

/** Chapter names for YouTube's chapter bar (en / zh), by movement. */
const CHAPTERS: Record<string, string> = {
  open: 'Flatland · 平面国',
  build: 'Building a tesseract · 造一个超立方体',
  slice: 'Slices · 截面',
  shadow: 'Shadows · 影子',
  unfold: 'Unfolding · 展开',
  beyond: 'Beyond four · 四维之上',
  data: 'Data · 数据',
  close: 'Back to Flatland · 回到平面国',
};

/** Chapter start times (mid-dissolve; the first is 0:00) as m:ss. */
function chapterStamps(order: string[], starts: number[]): string[] {
  const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return order.map((_, k) => stamp(k ? starts[k]! + 0.35 : 0));
}

/** Bilibili: Chinese first, tags, and chapters to type into the upload page's 视频章节. */
function bilibili(order: string[], starts: number[]): string {
  const stamps = chapterStamps(order, starts);
  const zhOnly = (id: string) => (CHAPTERS[id] ?? id).split(' · ')[1] ?? id;
  const chapters = order.map((id, k) => `${stamps[k]} ${zhOnly(id)}`).join('\n');
  return `标题（80 字以内）
超越平面国：两分半钟，看见第四维【中英字幕】

分区
知识 → 科学科普

标签
四维空间, 超立方体, 平面国, 数学, 几何, 高维空间, 数据可视化, 科普, tesseract, Flatland

简介
正方形先生住在平面国，想象不出“上”。我们也想象不出第四个方向，但可以学他：先在低一维里弄明白，再往上走同样的一步。
超立方体的截面、影子和展开图，十二维的立方体，以及为什么看数据也是在看影子。

在浏览器里亲手试试（交互式电子书，中英双语）：
https://beyond-flatland.unofn.workers.dev

${chapters}

英文旁白（macOS 语音 Ava），中英双语字幕。灵感来自埃德温·艾勃特《平面国》（1884）。配乐为本片原创合成。

———— 以下不属于简介 ————
视频章节：在投稿页“视频章节”里逐条填写
${chapters}
`;
}

/** Title and description for the upload, with chapter timestamps from the film's own clock. */
function youtube(order: string[], starts: number[]): string {
  const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // Chapters start in the middle of each dissolve (the first must be 0:00).
  const chapters = order.map((id, k) => `${stamp(k ? starts[k]! + 0.35 : 0)} ${CHAPTERS[id] ?? id}`).join('\n');
  return `TITLE (en)
Beyond Flatland: seeing the fourth dimension

TITLE (zh)
超越平面国：看见第四维

DESCRIPTION
A Square lives in Flatland and cannot imagine "up". We cannot imagine a fourth direction either — but we can do what he learned to do: understand it one dimension down, then take the same step up. Slices, shadows and unfoldings of a tesseract, cubes of up to twelve dimensions, and why data scientists look at shadows too.

正方形先生住在平面国，想象不出“上”。我们也想象不出第四个方向，但可以学他：先在低一维里弄明白，再往上走同样的一步。超立方体的截面、影子和展开图，十二维的立方体，以及为什么看数据也是在看影子。

Explore it yourself, in your browser / 在浏览器里亲手试试:
https://beyond-flatland.unofn.workers.dev

${chapters}

Narration: English (macOS voice "Ava"). Subtitles: English and Chinese, burned in; separate CC tracks attached.
Inspired by Edwin A. Abbott, Flatland: A Romance of Many Dimensions (1884). Music: original, synthesised for this film.
`;
}

// Last, so every declaration above is initialised.
if ((!only && !filmOnly && !stills) || assembling) await assemble(ids);
console.log(`total ${((Date.now() - started) / 1000).toFixed(1)} s`);
