// Loads the official DegenMateCoin image from a fixed project asset path.
// To change the official image, replace the two files in server/assets/ (see README).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
export const COIN_PATH = path.join(dir, 'coin.png');       // untouched official image, sent to the model as reference
export const CUTOUT_PATH = path.join(dir, 'coin-transparent.png'); // transparent PNG used by the compositing fallback
const MAX_BYTES = 4 * 1024 * 1024;

export class CoinError extends Error {}

const isPng = (b: Buffer) => b.length > 8 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

function read(file: string, label: string): Buffer {
  if (!fs.existsSync(file)) throw new CoinError(`Official coin image missing: put your logo PNG at server/assets/${path.basename(file)} (${label}).`);
  const buf = fs.readFileSync(file);
  if (!isPng(buf)) throw new CoinError(`server/assets/${path.basename(file)} is not a valid PNG.`);
  if (buf.length > MAX_BYTES) throw new CoinError(`server/assets/${path.basename(file)} is larger than 4 MB. Please compress it.`);
  return buf;
}

let cache: { coin: Buffer; cutout: Buffer | null } | null = null;

// Re-reads the file until it loads successfully, so dropping the file in needs no restart.
export function loadCoin(): { coin: Buffer; cutout: Buffer | null } {
  if (cache) return cache;
  const coin = read(COIN_PATH, 'official reference image');
  const cutout = fs.existsSync(CUTOUT_PATH) ? read(CUTOUT_PATH, 'transparent cutout') : null;
  cache = { coin, cutout };
  return cache;
}

export function coinStatus(): { ready: boolean; problem?: string } {
  try { loadCoin(); return { ready: true }; }
  catch (e) { return { ready: false, problem: (e as Error).message }; }
}
