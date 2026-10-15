// Meme render pipeline:
//   1. The image provider (Pollinations, see provider.ts) draws only the BACKGROUND SCENE.
//   2. sharp overlays the real, untouched DegenMateCoin transparent PNG on top.
// The model never draws the logo, so it cannot be distorted or replaced by another coin.
import { randomInt } from 'node:crypto';
import { loadCoin } from './coin.js';
import { EngineError, generateScene } from './provider.js';
import { buildScenePrompt } from './prompt.js';

export type Method = 'composite';
export interface RenderOpts { idea: string; style: string; size: string; index: number; deadline: number }

// Lower foreground slots: the scene prompt keeps the lower-centre empty, so the mascot sits in the picture like a brand badge
// instead of covering the characters that tell the joke.
export const SLOTS = [{ x: 0.5, y: 0.76 }, { x: 0.78, y: 0.76 }, { x: 0.22, y: 0.76 }];
export const COIN_SCALE = 0.32;
const TILTS = [-6, 5, -3, 4];

export function parseSize(size: string): { width: number; height: number } {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(size);
  const r16 = (v: number) => Math.min(2048, Math.max(256, Math.round(v / 16) * 16)); // some provider models need multiples of 16
  return m ? { width: r16(+m[1]), height: r16(+m[2]) } : { width: 1024, height: 1024 };
}

async function loadSharp() {
  try { return (await import('sharp')).default; }
  catch { throw new EngineError("Compositing needs the 'sharp' package. Run `npm install` in the server folder.", 500, 'sharp_missing'); }
}

// Only proportional resize + small rotation + drop shadow: the logo pixels themselves are never redrawn.
export async function overlayCoin(scene: Buffer, cutout: Buffer, index: number): Promise<Buffer> {
  const sharp = await loadSharp();
  const { width: W = 512, height: H = 512 } = await sharp(scene).metadata();
  const slot = SLOTS[index % SLOTS.length];
  const target = Math.round(Math.min(W, H) * COIN_SCALE);
  const coin = await sharp(cutout)
    .resize({ width: target, height: target, fit: 'inside' })
    .rotate(TILTS[index % TILTS.length], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const { width: cw = target, height: ch = target } = await sharp(coin).metadata();
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const left = clamp(Math.round(W * slot.x - cw / 2), 0, W - cw);
  const top = clamp(Math.round(H * slot.y - ch / 2), 0, H - ch);
  const shadow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="${Math.round(W * 0.012)}"/></filter></defs>` +
    `<ellipse cx="${left + cw / 2}" cy="${top + ch * 0.97}" rx="${cw * 0.38}" ry="${ch * 0.06}" fill="#000" fill-opacity="0.38" filter="url(#b)"/></svg>`);
  return sharp(scene).composite([{ input: shadow }, { input: coin, left, top }]).png().toBuffer();
}

export async function renderMeme(o: RenderOpts): Promise<{ buf: Buffer; method: Method }> {
  const { cutout } = loadCoin();
  if (!cutout) throw new EngineError('Compositing needs server/assets/coin-transparent.png (transparent PNG of the logo).', 500, 'coin_missing');
  const { width, height } = parseSize(o.size);
  const scene = await generateScene({
    prompt: buildScenePrompt(o.idea, o.style, o.index),
    width, height,
    seed: randomInt(0, 2 ** 31 - 1), // different seed per variation
    deadline: o.deadline,
  });
  return { buf: await overlayCoin(scene, cutout, o.index), method: 'composite' };
}
