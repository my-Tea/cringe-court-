/**
 * Renders every cue (and a preview of each ambience preset) through the real
 * mixing graph with node-web-audio-api, then:
 *
 *   renders/manifest.json   peak / RMS / timing and a SHA-256 of the 16-bit PCM
 *   renders/<cue>.ogg       listening copies (Vorbis via ffmpeg, if installed)
 *
 * The renders are synthesised in this repo from code, and are dedicated to the public domain under CC0
 * (see renders/LICENSE).
 *
 *   npm run render           write renders/
 *   npm run render:check     re-render and compare hashes with the manifest (exit 1 on drift)
 *   tsx scripts/render.ts --spectrograms <dir>   also write spectrogram PNGs (ffmpeg)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OfflineAudioContext } from 'node-web-audio-api';
import { CUE_IDS, CUES } from '../src/cues.ts';
import { AMBIENCE_PRESETS } from '../src/ambience.ts';
import { analyse, encodeWav, renderAmbience, renderCue, type OfflineContextCtor } from '../src/render.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'renders');
const wavDir = join(root, '.renders-wav');
const args = process.argv.slice(2);
const check = args.includes('--check');
const specIdx = args.indexOf('--spectrograms');
const spectroDir = specIdx >= 0 ? args[specIdx + 1] : undefined;
const Ctor = OfflineAudioContext as unknown as OfflineContextCtor;
const AMBIENCE_SECONDS = 12;

interface Entry {
  file: string;
  seconds: number;
  peakDb: number;
  rmsDb: number;
  onset: number;
  lastAudible: number;
  pcmSha256: string;
}

const round = (v: number, d = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : v);
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function main() {
  const jobs: { name: string; render: () => Promise<AudioBuffer> }[] = [
    ...CUE_IDS.map((cue) => ({ name: cue, render: () => renderCue(Ctor, cue) })),
    ...AMBIENCE_PRESETS.filter((p) => p !== 'off').map((p) => ({
      name: `ambience_${p}`,
      render: () => renderAmbience(Ctor, p, AMBIENCE_SECONDS),
    })),
  ];
  const manifest: Record<string, Entry> = {};
  mkdirSync(wavDir, { recursive: true });
  if (!check) mkdirSync(outDir, { recursive: true });
  if (spectroDir) mkdirSync(spectroDir, { recursive: true });

  for (const job of jobs) {
    const buf = await job.render();
    const stats = analyse(buf);
    if (!stats.finite) throw new Error(`${job.name}: non-finite samples`);
    const wav = encodeWav(buf);
    const sha = createHash('sha256').update(wav.subarray(44)).digest('hex');
    manifest[job.name] = {
      file: `${job.name}.ogg`,
      seconds: round(stats.seconds),
      peakDb: round(stats.peakDb, 1),
      rmsDb: round(stats.rmsDb, 1),
      onset: round(stats.onset, 3),
      lastAudible: round(stats.lastAudible),
      pcmSha256: sha,
    };
    const wavPath = join(wavDir, `${job.name}.wav`);
    writeFileSync(wavPath, wav);
    if (!check && hasFfmpeg) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'libvorbis', '-q:a', '4', '-map_metadata', '-1', '-fflags', '+bitexact', join(outDir, `${job.name}.ogg`)]);
    }
    if (spectroDir && hasFfmpeg) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-lavfi', 'showspectrumpic=s=800x300:legend=1:scale=log:fscale=log:mode=combined', join(spectroDir, `${job.name}.png`)]);
    }
    const label = job.name in CUES ? CUES[job.name as keyof typeof CUES].label : job.name;
    console.log(`${job.name.padEnd(22)} peak ${String(round(stats.peakDb, 1)).padStart(6)} dB  rms ${String(round(stats.rmsDb, 1)).padStart(6)} dB  ${round(stats.onset, 3)}s → ${round(stats.lastAudible)}s  ${label}`);
  }

  const manifestPath = join(outDir, 'manifest.json');
  if (check) {
    if (!existsSync(manifestPath)) throw new Error('renders/manifest.json missing; run `npm run render` first');
    const old = JSON.parse(readFileSync(manifestPath, 'utf8')) as { renders: Record<string, Entry> };
    const drift = Object.keys({ ...old.renders, ...manifest }).filter((k) => old.renders[k]?.pcmSha256 !== manifest[k]?.pcmSha256);
    if (drift.length) {
      console.error(`Render drift in: ${drift.join(', ')}`);
      process.exit(1);
    }
    console.log(`render:check OK — ${Object.keys(manifest).length} renders match the manifest`);
  } else {
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          generator: 'packages/audio/scripts/render.ts',
          renderer: 'node-web-audio-api OfflineAudioContext, 44.1 kHz stereo, full mixer graph at unity volume',
          license: 'CC0-1.0',
          renders: manifest,
        },
        null,
        2,
      ) + '\n',
    );
    if (!hasFfmpeg) console.warn('ffmpeg not found: wrote manifest and .renders-wav/ only, no .ogg files');
  }
  if (!spectroDir) rmSync(wavDir, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
