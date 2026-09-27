/**
 * Speaks the English narration with macOS `say`, one clip per cue, and
 * writes shots/video/work/timing.json: every scene's length and beat times,
 * laid out from the measured clip lengths.
 *
 *   node video/voice.ts                       # best installed voice
 *   node video/voice.ts --voice "Ava (Premium)" --rate 172
 *   node video/voice.ts --list                # English voices on this Mac
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, type SceneTiming } from './lib/timing.ts';
import { SCRIPT } from './script.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
};

const english = execFileSync('say', ['-v', '?'], { encoding: 'utf8' })
  .split('\n')
  .map((l) => /^(.+?)\s+(en_[A-Z]{2})\s+#/.exec(l))
  .filter((m): m is RegExpExecArray => !!m)
  .map((m) => ({ name: m[1]!.trim(), locale: m[2]! }));

if (argv.includes('--list')) {
  for (const v of english) console.log(`${v.name}  ${v.locale}`);
  process.exit(0);
}

/** Premium, then Enhanced, then a few decent compact voices. */
const PREFER = [/Ava \(Premium/, /Zoe \(Premium/, /Jamie \(Premium/, /Premium/, /Enhanced/, /^Daniel$/, /^Samantha$/];
const voice =
  arg('voice', '') || PREFER.map((re) => english.find((v) => re.test(v.name))?.name).find(Boolean) || 'Samantha';
const rate = arg('rate', '160');
const slug = voice.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '');
const dir = resolve(repo, 'shots/video/work/voice', slug);
mkdirSync(dir, { recursive: true });
console.log(`voice: ${voice} @ ${rate} wpm → ${dir}`);

const probe = (file: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));

const timing: Record<string, SceneTiming & { clips: string[] }> = {};
for (const [id, cues] of Object.entries(SCRIPT)) {
  const clips: string[] = [];
  const spoken: number[] = [];
  cues.forEach((cue, i) => {
    const raw = join(dir, `${id}-${i}.aiff`);
    const wav = join(dir, `${id}-${i}.wav`);
    execFileSync('say', ['-v', voice, '-r', rate, '-o', raw, (cue.say ?? cue.en).replace(/[“”]/g, '"')]);
    // Trim the clip's own leading and trailing silence so beats start on the word.
    const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02';
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', raw,
      '-af', `${trim},areverse,${trim},areverse`,
      '-ar', '48000', '-ac', '1', wav,
    ]);
    clips.push(wav);
    spoken.push(probe(wav));
  });
  timing[id] = { ...layout(id, cues, spoken), clips };
  console.log(`${id.padEnd(10)} ${timing[id]!.duration.toFixed(1)} s`);
}

const total = Object.values(timing).reduce((s, t) => s + t.duration, 0);
console.log(`total ${total.toFixed(1)} s`);
writeFileSync(resolve(repo, 'shots/video/work/timing.json'), JSON.stringify({ voice, rate, scenes: timing }, null, 2));
