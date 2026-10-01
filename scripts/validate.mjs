import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { postsDir, root, today, config } from './lib.mjs';

const PILLARS = ['incident', 'security', 'governance', 'founder'];
const KINDS = ['cover', 'text', 'quote', 'list', 'code', 'cta'];
const BANNED = ['game-changer', 'game changer', 'revolutioniz', 'revolutionis', 'unlock', 'delve', 'fast-paced world',
  'landscape', 'leverage', 'seamless', 'cutting-edge', 'cutting edge', 'robust', 'harness the power', 'let that sink in',
  "here's the thing", 'buckle up', 'in today\'s', 'thoughts?', 'agree?', '🚀', '🔥', "it's not just"];
// Wrapbox is a solo-founder prototype; these would be false claims.
const FALSE_CLAIMS = [/\bour (customers|clients|users)\b/i, /\bproduction[- ]ready\b/i, /\b(we|i) raised\b/i,
  /\bSOC ?2 (certified|compliant)\b/i, /\btrusted by\b/i, /\bfortune 500 (customers|companies use)\b/i];
const LIMITS = { linkedin: [400, 2800], instagram: [150, 2000], x: [20, 270] };
const HASHTAGS = { linkedin: 3, instagram: 5, x: 1 };

// X counts every URL as 23 chars.
const xLen = s => s.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
const slideText = s => [s.title, s.body, s.code, s.label, ...(s.items || [])].filter(Boolean).join(' ');
const words = s => s.replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length;

async function urlOk(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/140 Safari/537.36' } });
    return { status: r.status, ok: r.ok };
  } catch (e) { return { status: 0, ok: false, err: e.message }; }
}

export async function validateDay(date = today(), { checkLinks = true } = {}) {
  const errors = [], warns = [];
  const cfg = config();
  const images = cfg.images !== false;
  const platforms = cfg.platforms || ['linkedin', 'instagram', 'x'];
  const dir = join(postsDir, date);
  if (!existsSync(dir)) return { errors: [`no folder ${dir}`], warns };
  const files = readdirSync(dir).filter(f => /^post-\d+\.json$/.test(f)).sort();
  if (files.length !== 3) errors.push(`expected 3 posts, found ${files.length}`);

  const histFile = join(root, 'history.json');
  const history = existsSync(histFile) ? JSON.parse(readFileSync(histFile, 'utf8')) : [];
  const cutoff = new Date(Date.parse(date) - 30 * 864e5).toISOString().slice(0, 10);
  const recent = new Set(history.filter(h => h.date >= cutoff && h.date !== date).map(h => h.topic.toLowerCase()));

  let carousels = 0;
  const topics = new Set();
  for (const f of files) {
    const e = m => errors.push(`${f}: ${m}`), w = m => warns.push(`${f}: ${m}`);
    let p;
    try { p = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch (x) { e(`invalid JSON: ${x.message}`); continue; }
    if (p.id !== f.replace('.json', '')) e(`id "${p.id}" must match filename`);
    if (!PILLARS.includes(p.pillar)) e(`pillar must be one of ${PILLARS.join(', ')}`);
    if (!p.topic || p.topic.length < 6) e('topic (short unique key) required');
    else {
      if (recent.has(p.topic.toLowerCase())) e(`topic "${p.topic}" already used in the last 30 days`);
      if (topics.has(p.topic.toLowerCase())) e(`duplicate topic today`);
      topics.add(p.topic.toLowerCase());
    }

    const slides = p.slides || [];
    if (images) {
      if (slides.length === 0) e('at least one slide required (Instagram needs an image)');
      if (slides.length > 1) { carousels++; if (slides.length < 5 || slides.length > 8) e(`carousel must have 5–8 slides, has ${slides.length}`); }
      slides.forEach((s, i) => {
        if (!KINDS.includes(s.kind)) e(`slide ${i + 1}: kind must be one of ${KINDS.join(', ')}`);
        if (!s.alt || s.alt.length < 10) e(`slide ${i + 1}: alt text required`);
        const n = words(slideText(s));
        if (n > 45) e(`slide ${i + 1}: ${n} words (max 45) — too dense to read on a phone`);
        if (s.kind === 'code' && (s.code || '').split('\n').length > 14) e(`slide ${i + 1}: code > 14 lines`);
        if (slides.length === 1 && s.title && words(s.title) > 16) w(`single card title ${words(s.title)} words (aim ≤ 14)`);
      });
    }

    for (const plat of platforms) {
      const t = p.text?.[plat];
      if (!t) { e(`text.${plat} missing`); continue; }
      const len = plat === 'x' ? xLen(t) : t.length;
      const [lo, hi] = LIMITS[plat];
      if (len > hi) e(`text.${plat} is ${len} chars (max ${hi})`);
      if (len < lo) w(`text.${plat} is short (${len} chars)`);
      const tags = (t.match(/(^|\s)#[\p{L}\d_]+/gu) || []).length;
      if (tags > HASHTAGS[plat]) e(`text.${plat} has ${tags} hashtags (max ${HASHTAGS[plat]})`);
      if (plat === 'instagram' && /https?:\/\//.test(t)) e('instagram captions do not link — say "link in bio" instead');
    }

    const all = [p.text?.linkedin, p.text?.instagram, p.text?.x, ...slides.map(slideText)].filter(Boolean).join('\n');
    for (const b of BANNED) if (all.toLowerCase().includes(b)) e(`banned phrase "${b}"`);
    for (const r of FALSE_CLAIMS) if (r.test(all)) e(`unsupported Wrapbox claim matching ${r}`);

    const src = p.sources || [];
    if (p.pillar === 'incident' && src.length === 0) e('incident posts must cite at least one source');
    if (/\b(19|20)\d{2}\b|\d+(\.\d+)?\s?(%|million|billion|k\b)/i.test(all) && src.length === 0)
      w('post states dates/figures but has no sources');
    for (const s of src) {
      if (!/^https:\/\//.test(s.url || '')) { e(`source "${s.title}" needs an https url`); continue; }
      if (!checkLinks) continue;
      const r = await urlOk(s.url);
      if (r.status === 404 || r.status === 410 || r.status === 0) e(`source unreachable (${r.status || r.err}): ${s.url}`);
      else if (!r.ok) w(`source returned ${r.status} (likely bot-blocked, check manually): ${s.url}`);
    }
  }
  if (images && files.length === 3 && carousels !== 1) errors.push(`need exactly 1 carousel per day, found ${carousels}`);
  return { errors, warns };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const date = process.argv[2] || today();
  const { errors, warns } = await validateDay(date);
  warns.forEach(w => console.log('WARN ', w));
  errors.forEach(e => console.log('ERROR', e));
  console.log(errors.length ? `✗ ${date}: ${errors.length} error(s)` : `✓ ${date}: valid`);
  process.exit(errors.length ? 1 : 0);
}
