# Daily post agent

This folder produces 3 posts a day for the Wrapbox LinkedIn page and sends them to Buffer as
drafts (Bharath taps publish in the Buffer app). It is separate from the wrapbox-prototype repo —
never edit that repo from here (reading `~/Music/wrapbox-prototype/docs` for facts is fine).

`config.json` controls what actually gets produced: `platforms` (currently `["linkedin"]` only —
add `"instagram"`/`"x"` once those channels are connected in Buffer, see `npm run setup:buffer`),
and `images` (`true`: render PNG cards + an MP4 slideshow for the carousel post and attach them;
`false`: text only, fastest, for when the image pipeline needs debugging).

## Daily run — do exactly this

1. `DATE=$(TZ=Asia/Kolkata date +%F)`. If `posts/$DATE/published.json` exists, stop: already done.
2. Read `brand/voice.md` (voice, pillars, what's true about Wrapbox) and `history.json` (topics and
   hooks already used — never repeat a topic from the last 30 days, and vary hook style).
3. Research. Search the web for AI-agent incidents, agent security findings and governance news
   from the past ~2 weeks (fall back to older well-documented incidents that aren't in history).
   Open the sources and read them. Only use facts you read in a source; put every source in the
   post's `sources`. Prefer primary sources (company post-mortem, security advisory, regulator).
   If you can't verify something, drop it — a wrong fact under the founder's name is the worst outcome.
4. Write `posts/$DATE/post-1.json`, `post-2.json`, `post-3.json`:
   - post-1 (09:00 IST): text-led, 1 card. Usually `incident` or `security`.
   - post-2 (13:30 IST): the carousel, 5–8 slides, teaching one mechanism. Include one `code`
     slide with a real, valid rule/command.
   - post-3 (19:30 IST): text-led, 1 card. Usually `founder` or `governance`.
   Use at least 2 different pillars across the day.
5. `npm run check` → fix every ERROR and reread every WARN. Repeat until clean.
6. If `config.json` has `"images": true`: `npm run render`, then open 2–3 of the PNGs with the Read
   tool and look at them — text must not overflow, clip or crowd the footer. For the carousel post
   run `node scripts/video.mjs $DATE post-2` and spot-check a few frames with ffmpeg `-vf select=…`
   the way `render.mjs`'s own slides were checked. Shorten copy and re-render on any problem.
7. `npm run publish`. This pushes images/video to the public GitHub repo (`config.json`'s
   `githubRepo`) so Buffer can fetch them, then sends each post to Buffer as a draft (or scheduled,
   if `AUTO_PUBLISH=true`). Report which posts went through and flag anything that failed.

## Post JSON shape

```json
{
  "id": "post-1",
  "pillar": "incident | security | governance | founder",
  "topic": "short-unique-kebab-key",
  "text": { "linkedin": "…", "instagram": "…", "x": "…" },
  "slides": [
    { "kind": "cover | text | quote | list | code | cta", "title": "…", "body": "…",
      "items": ["…"], "code": "…", "label": "…", "tag": "…", "theme": "light | dark | blue",
      "alt": "what the image says, for screen readers" }
  ],
  "sources": [{ "title": "…", "url": "https://…" }]
}
```

`**word**` in slide text highlights it in brand blue. Default themes: cover=dark, cta=blue,
others light. Keep slides ≤ 40 words.
