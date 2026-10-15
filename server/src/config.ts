import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const ALLOWED_SIZES = (process.env.ALLOWED_SIZES || '1024x1024,1024x768,768x1024')
  .split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: num(process.env.PORT, 8787),
  defaultSize: process.env.IMAGE_SIZE || '1024x1024',
  maxPerRequest: num(process.env.MAX_IMAGES_PER_REQUEST, 4),
  dailyQuota: num(process.env.DAILY_QUOTA, 200),
  ratePerMin: num(process.env.RATE_LIMIT_PER_MIN, 6),
  accessCode: process.env.ACCESS_CODE || '',
  dataDir: process.env.DATA_DIR || './data',

  // ---- Image provider (Pollinations, https://gen.pollinations.ai/docs) ----
  apiBase: (process.env.POLLINATIONS_API_BASE || 'https://gen.pollinations.ai').trim().replace(/\/+$/, ''),
  apiKey: (process.env.POLLINATIONS_API_KEY || '').trim(),   // server-only; never expose through VITE_ variables
  model: (process.env.POLLINATIONS_MODEL || 'tongyi-mai/z-image-turbo').trim(), // the provider's documented default model
  timeoutSec: num(process.env.PROVIDER_TIMEOUT_SEC, 90),       // per image
  maxConcurrent: num(process.env.PROVIDER_MAX_CONCURRENT, 2),  // parallel provider calls
  maxQueued: num(process.env.MAX_QUEUED_JOBS, 2),              // requests allowed to wait behind the running one

  // ---- Optional local caption LLM (Ollama). Empty = built-in caption bank. ----
  ollamaUrl: (process.env.OLLAMA_URL || '').trim().replace(/\/+$/, ''),
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
};
