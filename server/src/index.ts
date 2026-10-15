import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config, ALLOWED_SIZES } from './config.js';
import { STYLES } from './prompt.js';
import { checkIdea } from './idea.js';
import { generateCaptions } from './captions.js';
import { EngineError, getEngine } from './provider.js';
import type { Engine } from './provider.js';
import { runJob, isGenerating } from './queue.js';
import { renderMeme } from './pipeline.js';
import { COIN_PATH, coinStatus } from './coin.js';
import * as store from './store.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50kb' }));

const err = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: code, message });
const COUNTS = [1, 2, 4, 8];
const allowedCounts = () => COUNTS.filter((c) => c <= config.maxPerRequest);
const CID = /^[a-zA-Z0-9-]{8,64}$/;

// ---------- Optional auth + client identity ----------
function guard(req: Request, res: Response, next: NextFunction) {
  if (config.accessCode && req.header('x-access-code') !== config.accessCode) {
    return err(res, 401, 'auth_required', 'Enter the access code to use the Meme Lab.');
  }
  const cid = req.header('x-client-id') || '';
  if (!CID.test(cid)) return err(res, 400, 'bad_client', 'Missing or invalid client id.');
  (req as any).cid = cid;
  next();
}

// ---------- Status (no auth; drives the setup notice and the engine indicator) ----------
const engineView = (e: Engine) => ({
  state: !e.online ? 'disconnected' : isGenerating() ? 'generating' : 'connected',
  message: e.message, model: e.model, code: e.code,
});

app.get('/api/engine', async (_q, res) => res.json(engineView(await getEngine())));

app.get('/api/status', async (req, res) => {
  const cid = req.header('x-client-id') || '';
  const coin = coinStatus();
  const engine = await getEngine();
  res.json({
    configured: engine.online,
    engine: engineView(engine),
    coinReady: coin.ready,
    coinProblem: coin.problem ?? null,
    authRequired: Boolean(config.accessCode),
    counts: allowedCounts(),
    sizes: ALLOWED_SIZES,
    defaultSize: ALLOWED_SIZES.includes(config.defaultSize) ? config.defaultSize : ALLOWED_SIZES[0],
    dailyQuota: config.dailyQuota,
    used: CID.test(cid) ? store.usedToday(cid) : 0,
    model: engine.model ?? 'no model installed',
  });
});

// ---------- Multipart parsing (the client posts FormData; no file uploads are accepted any more) ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 0 } });

const genLimiter = rateLimit({
  windowMs: 60_000, limit: config.ratePerMin, standardHeaders: true, legacyHeaders: false,
  handler: (_q, res) => err(res, 429, 'rate_limited', 'Too many requests. Please wait a minute and try again.'),
});

const Body = z.object({
  prompt: z.unknown(), // validated by checkIdea() (idea.ts): structure, other-coin policy, prohibited content. No keyword requirement.
  style: z.string().refine((s) => s in STYLES, 'Unknown style.'),
  count: z.coerce.number().refine((c) => COUNTS.includes(c), 'Count must be 1, 2, 4 or 8.'),
  size: z.string().refine((s) => ALLOWED_SIZES.includes(s), 'Unsupported resolution.'),
});

const pub = (i: store.Item) => ({
  id: i.id, url: `/files/${i.file}`, prompt: i.prompt, style: i.style,
  top: i.top, bottom: i.bottom, favorite: i.favorite, createdAt: i.createdAt, method: i.method,
});

// ---------- Generate ----------
app.post('/api/generate', guard, genLimiter, upload.none(), async (req, res) => {
  const cid = (req as any).cid as string;
  // Backend validation is authoritative (the client only mirrors the structural rules for instant feedback).
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return err(res, 400, 'invalid', parsed.error.issues[0].message);
  const { style, count, size } = parsed.data;
  const idea = checkIdea(parsed.data.prompt);
  if (!idea.ok) return err(res, idea.status, idea.code, idea.message);
  const prompt = idea.idea;
  if (count > config.maxPerRequest) return err(res, 400, 'too_many', `This server allows at most ${config.maxPerRequest} images per request.`);

  const engine = await getEngine();
  if (!engine.online) return err(res, 503, engine.code, engine.message);
  const coin = coinStatus();
  if (!coin.ready) return err(res, 503, 'coin_missing', coin.problem || 'The official coin image is not available.');

  const remaining = config.dailyQuota - store.usedToday(cid);
  if (count > remaining) return err(res, 429, 'quota', `Daily quota reached. You have ${Math.max(remaining, 0)} generation(s) left today.`);

  try {
    // One generate request runs at a time; extra requests queue briefly or get a "busy" message.
    const [captions, ...settled] = await runJob(cid, () => {
      const deadline = Date.now() + config.timeoutSec * 1000 * count;
      return Promise.all([
        generateCaptions(prompt, style, count),
        ...Array.from({ length: count }, (_, i) =>
          renderMeme({ idea: prompt, style, size, index: i, deadline })
            .then((r) => ({ ok: true as const, buf: r.buf, method: r.method as string }), (e) => ({ ok: false as const, e }))),
      ]);
    });
    const done = settled.filter((s): s is { ok: true; buf: Buffer; method: string } => s.ok);
    if (!done.length) {
      const failed = settled.find((s) => !s.ok) as { ok: false; e: unknown } | undefined;
      throw failed?.e ?? new EngineError('Generation failed.');
    }
    store.addUsage(cid, done.length);
    const items = done.map((d, i) => {
      const id = randomUUID();
      const item: store.Item = {
        id, clientId: cid, prompt, style, createdAt: Date.now(), favorite: false, file: `${id}.png`, method: d.method,
        top: captions[i]?.top ?? '', bottom: captions[i]?.bottom ?? '',
      };
      store.add(item, d.buf);
      return pub(item);
    });
    res.json({ items, failed: count - done.length, used: store.usedToday(cid) });
  } catch (e) {
    if (e instanceof EngineError) return err(res, e.status, e.code, e.message);
    console.error(e);
    err(res, 500, 'server', 'Something went wrong while generating. Please try again.');
  }
});

// ---------- Fresh caption for one meme (local caption bank, no image provider needed) ----------
app.post('/api/caption', guard, genLimiter, async (req, res) => {
  const p = z.object({ prompt: z.string().trim().min(3).max(500), style: z.string().max(40).default('funny') }).safeParse(req.body);
  if (!p.success) return err(res, 400, 'invalid', 'Invalid caption request.');
  const [c] = await generateCaptions(p.data.prompt, p.data.style, 1);
  res.json(c);
});

// ---------- Gallery ----------
app.get('/api/gallery', guard, (req, res) => res.json({ items: store.list((req as any).cid).map(pub) }));
app.delete('/api/gallery/:id', guard, (req, res) =>
  store.remove((req as any).cid, req.params.id) ? res.json({ ok: true }) : err(res, 404, 'not_found', 'Meme not found.'));
app.post('/api/gallery/:id/favorite', guard, (req, res) => {
  const it = store.toggleFavorite((req as any).cid, req.params.id);
  it ? res.json(pub(it)) : err(res, 404, 'not_found', 'Meme not found.');
});

// The official coin image (public brand asset, shown as a small preview in the UI).
app.get('/brand/coin.png', (_q, res) => res.sendFile(COIN_PATH, (e) => { if (e) res.status(404).end(); }));

// Image files are served by unguessable UUID file names.
app.use('/files', express.static(store.imagesDir, { maxAge: '7d', index: false }));

// ---------- Production: serve the built client ----------
const dist = path.resolve(process.cwd(), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_q, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((e: unknown, _q: Request, res: Response, _n: NextFunction) => {
  if (e instanceof multer.MulterError) {
    return err(res, 400, 'upload', 'Image uploads are not supported. Send the meme idea as text.');
  }
  // Malformed / oversized request bodies are the caller's mistake, not a server fault.
  const status = (e as { status?: number })?.status;
  if (status === 413) return err(res, 413, 'too_large', 'The request is too large.');
  if (status && status >= 400 && status < 500) return err(res, 400, 'invalid', 'The request could not be read. Send valid JSON or form data.');
  console.error(e);
  err(res, 500, 'server', 'Unexpected server error.');
});

app.listen(config.port, () => {
  console.log(`Meme Lab API on :${config.port}`);
  getEngine(true).then((e) => console.log(`Image provider: ${e.online ? `configured, model ${e.model}` : `NOT READY - ${e.message}`}`));
});
