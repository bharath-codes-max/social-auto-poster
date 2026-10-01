// Turns a post's rendered slide PNGs into a vertical MP4 slideshow (Ken Burns pan/zoom,
// crossfades), for LinkedIn/Instagram/TikTok native video. Needs ffmpeg (already on this Mac).
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { postsDir, today } from './lib.mjs';

const SEC_PER_SLIDE = 3.2;
const FADE = 0.5;
const FPS = 30;
const W = 1080, H = 1350;

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
}

export async function videoForPost(date, postId) {
  const dir = join(postsDir, date);
  const frames = readdirSync(dir).filter(f => new RegExp(`^${postId}-\\d+\\.png$`).test(f))
    .sort((a, b) => +a.match(/-(\d+)\.png$/)[1] - +b.match(/-(\d+)\.png$/)[1]);
  if (frames.length < 2) return null; // only worth it for carousels
  const out = join(dir, `${postId}.mp4`);
  const clipFrames = Math.round((SEC_PER_SLIDE + FADE) * FPS);

  // One input per slide (no -t on the input — that would make the looped image emit several
  // frames at the demuxer's default rate, and zoompan's `d` multiplies per input frame it sees,
  // exploding the output length; `-frames:v` after the filter is what actually bounds it).
  const inputs = frames.flatMap(f => ['-loop', '1', '-i', join(dir, f)]);
  const n = frames.length;
  const per = [...Array(n)].map((_, i) =>
    `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0006,1.12)':d=${clipFrames}:s=${W}x${H}:fps=${FPS},format=yuv420p,trim=duration=${(SEC_PER_SLIDE + FADE).toFixed(2)}[v${i}]`
  ).join(';');
  let chain = '[v0]';
  const xfades = [];
  for (let i = 1; i < n; i++) {
    const prev = chain, cur = `[v${i}]`, label = i === n - 1 ? '[vout]' : `[x${i}]`;
    const offset = SEC_PER_SLIDE * i;
    xfades.push(`${prev}${cur}xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}${label}`);
    chain = label;
  }
  const filter = `${per};${xfades.join(';')}`;
  ffmpeg([...inputs, '-filter_complex', filter, '-map', '[vout]', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '20', out]);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [date = today(), postId = 'post-2'] = process.argv.slice(2);
  const out = await videoForPost(date, postId);
  console.log(out ? `wrote ${out}` : `${postId} has < 2 slides, no video made`);
}
