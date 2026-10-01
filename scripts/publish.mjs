import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { postsDir, root, today, loadEnv, config } from './lib.mjs';
import { validateDay } from './validate.mjs';
import { buffer, en, createPostMutation } from './buffer.mjs';

loadEnv();
const args = process.argv.slice(2);
const dry = args.includes('--dry-run') || !process.env.BUFFER_API_KEY;
const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || today();
const auto = process.env.AUTO_PUBLISH === 'true';
const cfg = config();
const dir = join(postsDir, date);

const { errors, warns } = await validateDay(date);
warns.forEach(w => console.log('WARN ', w));
if (errors.length) { errors.forEach(e => console.log('ERROR', e)); console.log('✗ not publishing — fix the errors above'); process.exit(1); }

const posts = readdirSync(dir).filter(f => /^post-\d+\.json$/.test(f)).sort().map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const logFile = join(dir, 'published.json');
const log = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : {};

function dueAt(slot) {
  const [h, m] = (cfg.postTimesIST[slot] || cfg.postTimesIST.at(-1)).split(':').map(Number);
  const t = Date.UTC(...date.split('-').map((x, i) => i === 1 ? x - 1 : +x), h, m) - 330 * 60e3; // IST = UTC+5:30
  return new Date(Math.max(t, Date.now() + 15 * 60e3)).toISOString();
}

for (const [slot, p] of posts.entries()) {
  for (const plat of cfg.platforms) {
    const key = `${p.id}:${plat}`;
    const channelId = cfg.channels[plat];
    if (log[key]) { console.log(`= ${key} already sent (${log[key]})`); continue; }
    if (!channelId) { console.log(`- ${key} skipped: no ${plat} channel in config.json`); continue; }
    const input = {
      text: p.text[plat],
      channelId,
      schedulingType: en('automatic'),
      mode: en(auto ? 'customScheduled' : 'addToQueue'),
      dueAt: auto ? dueAt(slot) : undefined,
      saveToDraft: auto ? undefined : true,
    };
    const m = createPostMutation(input);
    if (dry) { console.log(`\n[dry-run] ${key} ${auto ? `scheduled ${input.dueAt}` : 'draft'}\n${m.slice(0, 400)}…`); continue; }
    try {
      const { createPost: r } = await buffer(m);
      if (r?.post?.id) { log[key] = r.post.id; console.log(`✓ ${key} → Buffer ${auto ? `scheduled ${input.dueAt}` : 'draft'} ${r.post.id}`); }
      else console.log(`✗ ${key}: ${r?.message || JSON.stringify(r)}`);
    } catch (e) { console.log(`✗ ${key}: ${e.message}`); }
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');
  }
}

// Remember topics so tomorrow's agent doesn't repeat them.
if (!dry) {
  const hf = join(root, 'history.json');
  const hist = existsSync(hf) ? JSON.parse(readFileSync(hf, 'utf8')) : [];
  for (const p of posts) if (!hist.some(h => h.date === date && h.id === p.id)) hist.push({ date, id: p.id, pillar: p.pillar, topic: p.topic, hook: p.text.linkedin.split('\n')[0] });
  writeFileSync(hf, JSON.stringify(hist, null, 2) + '\n');
}
console.log(dry ? '\n(dry run — nothing sent. Add BUFFER_API_KEY to .env to go live.)' : `\ndone: ${date}`);
