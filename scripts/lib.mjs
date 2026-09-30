import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const postsDir = join(root, 'posts');

export const TZ = 'Asia/Kolkata';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

export function loadEnv() {
  const f = join(root, '.env');
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const config = () => JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
