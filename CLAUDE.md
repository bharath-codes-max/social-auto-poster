# Daily post agent

This folder produces 3 posts a day for Bharath Salla (founder, Wrapbox) on LinkedIn, Instagram and
X, and sends them to Buffer. It is separate from the wrapbox-prototype repo — never edit that repo
from here (reading `~/Music/wrapbox-prototype/docs` for facts is fine).

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
6. `npm run render`, then open 2–3 of the PNGs with the Read tool and look at them: text must not
   overflow, clip or crowd the footer. If it does, shorten the copy and re-render.
7. `npm run publish`. Report which posts went to Buffer and flag anything that failed.

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
