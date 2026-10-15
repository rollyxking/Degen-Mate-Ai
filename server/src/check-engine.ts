// Usage:  npm run check:engine --prefix server              (is the provider configured? no network call, no quota used)
//         npm run check:engine --prefix server -- --generate   (also renders ONE real test image to data/engine-test.png and uses a little free allowance)
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { generateScene, getEngine } from './provider.js';
import { buildScenePrompt } from './prompt.js';

const engine = await getEngine(true);
console.log(`Provider : Pollinations (${config.apiBase})`);
console.log(`Model    : ${config.model}`);
console.log(`Status   : ${engine.online ? 'CONFIGURED' : 'NOT READY'} - ${engine.message}`);
if (!engine.online) process.exit(1);

if (process.argv.includes('--generate')) {
  console.log('Generating one test image...');
  const t0 = Date.now();
  try {
    const img = await generateScene({
      prompt: buildScenePrompt('DegenMateCoin going to the moon', 'funny', 0),
      width: 1024, height: 1024, seed: 12345, deadline: Date.now() + config.timeoutSec * 1000,
    });
    const out = path.resolve(config.dataDir, 'engine-test.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, img);
    console.log(`OK: ${img.length} bytes in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
  } catch (e) {
    console.error(`FAILED: ${(e as Error).message}`);
    process.exit(1);
  }
}
