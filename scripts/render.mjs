import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { postsDir, today } from './lib.mjs';

const W = 1080, H = 1350;

const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// **word** → accent highlight
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>').replace(/\n/g, '<br>');

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=block');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{font-family:Inter,-apple-system,sans-serif;background:#f6f7fb;color:#0b1020;-webkit-font-smoothing:antialiased}
.s{position:relative;width:${W}px;height:${H}px;padding:96px 88px 150px;display:flex;flex-direction:column;overflow:hidden}
.s.dark{background:#080c17;color:#eef1fa}
.s.blue{background:#1848ff;color:#fff}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(24,72,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(24,72,255,.06) 1px,transparent 1px);background-size:54px 54px;pointer-events:none}
.dark .grid{background-image:linear-gradient(rgba(124,152,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(124,152,255,.08) 1px,transparent 1px)}
.blue .grid{display:none}
.tag{position:relative;display:inline-flex;align-self:flex-start;gap:12px;align-items:center;font:600 24px/1 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#1848ff;background:#e6ebff;padding:14px 20px;border-radius:999px;margin-bottom:56px}
.dark .tag{color:#9fb3ff;background:#161f3a}.blue .tag{color:#fff;background:rgba(255,255,255,.16)}
.tag i{width:12px;height:12px;border-radius:50%;background:currentColor;display:block}
.body{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px}
h1{font-weight:800;letter-spacing:-.035em;line-height:1.02}
h1.xl{font-size:104px}h1.l{font-size:84px}h1.m{font-size:66px}
p.sub{font-size:38px;line-height:1.4;color:#475068;font-weight:500}
.dark p.sub{color:#aab3c9}.blue p.sub{color:#dfe6ff}
.hl{color:#1848ff;font-weight:inherit}.dark .hl{color:#7c98ff}.blue .hl{color:#fff;text-decoration:underline;text-decoration-thickness:6px;text-underline-offset:10px}
p.txt{font-size:46px;line-height:1.38;font-weight:500;letter-spacing:-.01em}
blockquote{font-size:64px;line-height:1.18;font-weight:700;letter-spacing:-.025em;border-left:10px solid #1848ff;padding-left:44px}
.cite{font-size:30px;color:#6b7390;font-weight:500}
ul{list-style:none;display:flex;flex-direction:column;gap:30px}
li{display:flex;gap:28px;font-size:42px;line-height:1.3;font-weight:500}
li b.n{flex:none;width:64px;height:64px;border-radius:18px;background:#1848ff;color:#fff;font:700 30px/64px 'JetBrains Mono',monospace;text-align:center}
.dark li b.n{background:#7c98ff;color:#080c17}
pre{background:#0d1326;color:#dfe6ff;border:1px solid #243056;border-radius:28px;padding:44px 48px;font:400 31px/1.55 'JetBrains Mono',monospace;white-space:pre-wrap;word-break:break-word}
pre .k{color:#7c98ff}pre .c{color:#6b7898}pre .v{color:#8ee6b0}
.lab{font:600 26px/1 'JetBrains Mono',monospace;color:#6b7390;letter-spacing:.04em;text-transform:uppercase}
.foot{position:absolute;left:88px;right:88px;bottom:64px;display:flex;justify-content:space-between;align-items:center;font-size:28px;font-weight:600}
.who{display:flex;align-items:center;gap:18px}
.mark{width:52px;height:52px;border-radius:15px;background:#1848ff;display:grid;place-items:center}
.blue .mark{background:#fff}
.mark svg{width:30px;height:30px}
.who small{display:block;font-size:22px;font-weight:500;color:#6b7390;margin-top:4px}
.dark .who small{color:#8a93ab}.blue .who small{color:#dfe6ff}
.pg{font:600 26px 'JetBrains Mono',monospace;color:#6b7390}.dark .pg{color:#aab3c9}.blue .pg{color:#fff}
.swipe{font:600 26px 'JetBrains Mono',monospace;color:#1848ff}.dark .swipe{color:#7c98ff}.blue .swipe{color:#fff}
`;

const MARK = fill => `<svg viewBox="0 0 24 24" fill="none" stroke="${fill}" stroke-width="2.4" stroke-linejoin="round"><path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/></svg>`;

function hlCode(src) {
  return esc(src)
    .replace(/(#.*)$/gm, '<span class="c">$1</span>')
    .replace(/^(\s*-?\s*)([a-zA-Z_.]+):/gm, '$1<span class="k">$2</span>:')
    .replace(/\b(ALLOW|BLOCK|REVIEW|true|false)\b/g, '<span class="v">$1</span>');
}

function sizeFor(t = '') { const n = t.replace(/\*\*/g, '').length; return n < 34 ? 'xl' : n < 64 ? 'l' : 'm'; }

function slideHTML(sl, i, n, post) {
  const theme = sl.theme || (sl.kind === 'cover' ? 'dark' : sl.kind === 'cta' ? 'blue' : 'light');
  const tag = sl.tag || (i === 0 ? post.pillar : '');
  let inner = '';
  switch (sl.kind) {
    case 'cover':
    case 'text':
      inner = `${sl.title ? `<h1 class="${sizeFor(sl.title)}">${rich(sl.title)}</h1>` : ''}${sl.body ? (sl.kind === 'cover' ? `<p class="sub">${rich(sl.body)}</p>` : `<p class="txt">${rich(sl.body)}</p>`) : ''}`;
      break;
    case 'quote':
      inner = `<blockquote>${rich(sl.title)}</blockquote>${sl.body ? `<div class="cite">${rich(sl.body)}</div>` : ''}`;
      break;
    case 'list':
      inner = `${sl.title ? `<h1 class="m">${rich(sl.title)}</h1>` : ''}<ul>${(sl.items || []).map((it, k) => `<li><b class="n">${k + 1}</b><span>${rich(it)}</span></li>`).join('')}</ul>`;
      break;
    case 'code':
      inner = `${sl.title ? `<h1 class="m">${rich(sl.title)}</h1>` : ''}${sl.label ? `<div class="lab">${esc(sl.label)}</div>` : ''}<pre>${hlCode(sl.code || '')}</pre>${sl.body ? `<p class="sub">${rich(sl.body)}</p>` : ''}`;
      break;
    case 'cta':
      inner = `<h1 class="${sizeFor(sl.title)}">${rich(sl.title)}</h1>${sl.body ? `<p class="sub">${rich(sl.body)}</p>` : ''}`;
      break;
    default: throw new Error(`unknown slide kind "${sl.kind}" in ${post.id}`);
  }
  const right = n > 1 ? (i < n - 1 ? `<span class="swipe">swipe →</span>` : `<span class="pg">${i + 1}/${n}</span>`) : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="s ${theme}"><div class="grid"></div>
${tag ? `<div class="tag"><i></i>${esc(tag)}</div>` : ''}
<div class="body">${inner}</div>
<div class="foot"><div class="who"><div class="mark">${MARK(theme === 'blue' ? '#1848ff' : '#fff')}</div><div>Bharath Salla<small>Founder, Wrapbox</small></div></div>${right}</div>
</div></body></html>`;
}

export async function renderDay(date = today()) {
  const dir = join(postsDir, date);
  if (!existsSync(dir)) throw new Error(`no posts for ${date} (${dir})`);
  const files = readdirSync(dir).filter(f => /^post-\d+\.json$/.test(f)).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const out = [];
  for (const f of files) {
    const post = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const n = post.slides.length;
    for (let i = 0; i < n; i++) {
      await page.setContent(slideHTML(post.slides[i], i, n, post), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const file = join(dir, `${post.id}-${i + 1}.png`);
      await page.screenshot({ path: file, type: 'png' });
      out.push(file);
    }
  }
  await browser.close();
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = await renderDay(process.argv[2]);
  console.log(`rendered ${files.length} images`);
  files.forEach(f => console.log(' ', f));
}
