// Image provider adapter: Pollinations (https://gen.pollinations.ai, docs: https://gen.pollinations.ai/docs).
// Contract used (from the official API docs): GET /image/{prompt}?model&width&height&seed
// with "Authorization: Bearer <sk_ key>". The response body is the image itself (JPEG/PNG), so there is no job polling.
// The key stays on the server. Nothing here calls OpenAI or any other paid service.
import { config } from './config.js';

export class EngineError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = 'engine') { super(message); this.status = status; this.code = code; }
}
export interface Ref { buffer: Buffer; mime: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- status (no network call, so it never spends quota)
export interface Engine { online: boolean; model: string | null; checkpoints: string[]; message: string; code: string }

export async function getEngine(_force = false): Promise<Engine> {
  if (!config.apiKey) {
    return {
      online: false, model: null, checkpoints: [], code: 'no_key',
      message: 'The image provider requires configuration: add POLLINATIONS_API_KEY to server/.env (free key from enter.pollinations.ai) and restart the server.',
    };
  }
  return { online: true, model: config.model, checkpoints: [config.model], code: 'ok', message: 'Image service configured.' };
}

// ---------------------------------------------------------------- response validation
function sniffImage(b: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length > 8 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function mapStatus(status: number): EngineError {
  if (status === 401 || status === 403) return new EngineError('The image provider rejected the API key. Check POLLINATIONS_API_KEY in server/.env.', 503, 'bad_key');
  if (status === 402) return new EngineError('The free generation allowance on the image provider is used up. Please try again later.', 429, 'provider_quota');
  if (status === 429) return new EngineError('The free generation limit has been reached. Please try again later.', 429, 'provider_rate');
  if (status === 400 || status === 422) return new EngineError('The image provider did not accept this request. Try a different idea, size or model.', 502, 'provider_rejected');
  if (status === 404) return new EngineError('The configured image model was not found. Check POLLINATIONS_MODEL.', 502, 'bad_model');
  return new EngineError('The image service is temporarily unavailable.', 503, 'provider_down');
}

// Only temporary problems are retried (rate spikes and upstream hiccups), at most MAX_RETRIES times.
// 402 (allowance used up) and 401 are never retried.
const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Limits how many requests hit the provider at once (free tiers rate-limit parallel calls).
let inflight = 0;
const waiters: Array<() => void> = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (inflight >= config.maxConcurrent) await new Promise<void>((r) => waiters.push(r));
  inflight++;
  try { return await fn(); } finally { inflight--; waiters.shift()?.(); }
}

async function fetchOnce(url: string, deadline: number): Promise<{ res?: Response; err?: EngineError }> {
  const left = deadline - Date.now();
  if (left <= 0) return { err: new EngineError('The image generation request timed out.', 504, 'timeout') };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(left, config.timeoutSec * 1000));
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'image/*' }, signal: ctrl.signal, redirect: 'error' });
    return { res };
  } catch (e) {
    return { err: (e as Error)?.name === 'AbortError'
      ? new EngineError('The image generation request timed out.', 504, 'timeout')
      : new EngineError('The image service is temporarily unavailable.', 503, 'provider_down') };
  } finally { clearTimeout(timer); }
}

export interface SceneOpts { prompt: string; width: number; height: number; seed: number; deadline: number }

// Generates one background scene and returns the validated image bytes (PNG/JPEG/WebP).
export async function generateScene(o: SceneOpts): Promise<Buffer> {
  const engine = await getEngine();
  if (!engine.online) throw new EngineError(engine.message, 503, engine.code);

  // The host is fixed in config, so user input can never choose where the server connects (no SSRF).
  const url = `${config.apiBase}/image/${encodeURIComponent(o.prompt)}?${new URLSearchParams({
    model: config.model, width: String(o.width), height: String(o.height), seed: String(o.seed),
  })}`;

  return slot(async () => {
    let last: EngineError | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { res, err } = await fetchOnce(url, o.deadline);
      if (err) { last = err; if (err.code === 'timeout') throw err; }
      else if (res!.ok) {
        const type = (res!.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (type && !type.startsWith('image/')) throw new EngineError('The generated image could not be retrieved.', 502, 'bad_output');
        const buf = Buffer.from(await res!.arrayBuffer());
        if (buf.length < 100 || buf.length > MAX_IMAGE_BYTES || !sniffImage(buf)) {
          throw new EngineError('The generated image could not be retrieved.', 502, 'bad_output');
        }
        return buf;
      } else {
        const status = res!.status;
        console.error(`[provider] HTTP ${status} from image service (attempt ${attempt + 1})`);
        last = mapStatus(status);
        if (!RETRYABLE.has(status) || status === 429 && attempt >= 1) throw last; // one polite retry on 429, then stop
        const ra = Number(res!.headers.get('retry-after'));
        if (attempt < MAX_RETRIES) await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * (attempt + 1), 10_000));
        continue;
      }
      if (attempt < MAX_RETRIES) await sleep(1500 * (attempt + 1));
    }
    throw last ?? new EngineError('The image service is temporarily unavailable.', 503, 'provider_down');
  });
}
