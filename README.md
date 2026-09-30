# social-auto-poster

3 posts a day for Bharath Salla (founder, Wrapbox) on LinkedIn, Instagram and X. Costs ₹0.

```
Claude (daily, 7:00 IST)  → researches real incidents, writes posts/<date>/post-{1,2,3}.json
npm run check             → quality gate: lengths, banned AI phrases, hashtags, sources, repeats
npm run render            → 1080×1350 PNG cards + carousel (headless Chromium)
npm run publish           → images to this public repo → Buffer API (drafts, or scheduled)
```

## One-time setup (≈10 minutes, free)

1. Sign up at buffer.com (free plan: 3 channels). Connect **LinkedIn**, **Instagram** and **X**.
   Instagram must be a Business or Creator account linked to a Facebook Page (free, in the app:
   Settings → Account type).
2. In Buffer: Settings → API → create a key. Copy `.env.example` to `.env` and paste it as
   `BUFFER_API_KEY`.
3. `npm run setup:buffer` — finds your channel IDs and saves them to `config.json`.

## Drafts vs fully automatic

- `AUTO_PUBLISH=false` (default): posts land in Buffer as **drafts**. Open the Buffer app, read,
  tap schedule. Recommended for the first couple of weeks.
- `AUTO_PUBLISH=true`: posts are scheduled for 09:00 / 13:30 / 19:30 IST with no review.

Times live in `config.json`. Voice, pillars and what's true about Wrapbox live in `brand/voice.md`.
