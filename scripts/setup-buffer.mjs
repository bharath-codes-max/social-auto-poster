import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, loadEnv, config } from './lib.mjs';
import { buffer } from './buffer.mjs';

loadEnv();
const { account } = await buffer('query { account { organizations { id name } } }');
const cfg = config();
const found = {};
for (const org of account.organizations) {
  const { channels } = await buffer(`query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name displayName service isQueuePaused } }`);
  for (const c of channels) {
    console.log(`${org.name} · ${c.service} · ${c.displayName || c.name} · ${c.id}${c.isQueuePaused ? ' (queue paused)' : ''}`);
    const s = c.service.toLowerCase();
    const plat = s.includes('linkedin') ? 'linkedin' : s.includes('instagram') ? 'instagram' : /twitter|^x$/.test(s) ? 'x' : null;
    if (plat && !found[plat]) found[plat] = c.id;
  }
}
cfg.channels = { ...cfg.channels, ...found };
writeFileSync(join(root, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
console.log('\nconfig.json channels:', cfg.channels);
for (const p of ['linkedin', 'instagram', 'x']) if (!cfg.channels[p]) console.log(`! no ${p} channel connected in Buffer — posts for it will be skipped`);
