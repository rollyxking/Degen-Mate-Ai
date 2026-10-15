// End-to-end API tests: boots the real server as a child process against a LOCAL mock of the image provider
// (no network, no key, no quota used).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 1)]);
let mode: 'ok' | '402' | '503' | 'html' = 'ok';
const seen: string[] = [];
let mock: http.Server, srv: ChildProcess, base = '', dataDir = '';
const CID = 'test-client-0001';

before(async () => {
  mock = http.createServer((req, res) => {
    seen.push(decodeURIComponent((req.url || '').split('?')[0].replace('/image/', '')));
    if (mode === '402') { res.writeHead(402).end(); return; }
    if (mode === '503') { res.writeHead(400).end(); return; }
    if (mode === 'html') { res.writeHead(200, { 'content-type': 'text/html' }).end('<html>nope</html>'); return; }
    res.writeHead(200, { 'content-type': 'image/png' }).end(PNG);
  });
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
  const mport = (mock.address() as any).port;
  const port = 20000 + Math.floor(Math.random() * 20000);
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmc-test-'));
  // DMC_TEST_ENTRY lets CI/sandboxes without tsx's native binary run a precompiled entry file with plain node.
  const entry = process.env.DMC_TEST_ENTRY;
  srv = spawn(process.execPath, entry ? [entry] : ['--import', 'tsx', 'src/index.ts'], {
    cwd: process.env.DMC_TEST_CWD || root, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, POLLINATIONS_API_KEY: 'sk_test_fake', POLLINATIONS_API_BASE: `http://127.0.0.1:${mport}`,
      RATE_LIMIT_PER_MIN: '1000', DAILY_QUOTA: '1000', MAX_IMAGES_PER_REQUEST: '2', ACCESS_CODE: '' },
  });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/api/engine`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 150)); }
  throw new Error('server did not start');
});
after(() => { srv?.kill(); mock?.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const post = (body: unknown, raw = false, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/generate`, { method: 'POST', headers: { 'x-client-id': CID, ...(raw ? {} : { 'content-type': 'application/json' }), ...headers }, body: raw ? (body as any) : JSON.stringify(body) });
const ok = { style: 'funny', count: 1, size: '1024x1024' };
const j = async (r: Response) => ({ status: r.status, ...(await r.json() as any) });

test('direct request with a general idea is accepted and the ENHANCED prompt reaches the provider', async () => {
  mode = 'ok'; seen.length = 0;
  const r = await j(await post({ ...ok, prompt: 'holders waiting for the next big move' }));
  assert.notEqual(r.error, 'off_topic'); assert.notEqual(r.status, 400); assert.notEqual(r.status, 422);
  // 200 where sharp is installed; 500/sharp_missing only in a sandbox without sharp's native binary (validation + provider already passed)
  assert.ok(r.status === 200 || r.error === 'sharp_missing', JSON.stringify(r));
  assert.equal(seen.length, 1);
  assert.match(seen[0], /waiting for the next big move/); assert.match(seen[0], /kangaroo/); assert.match(seen[0], /no coins/);
});
test('multipart FormData (what the browser sends) is accepted the same way', async () => {
  mode = 'ok'; seen.length = 0;
  const f = new FormData(); f.set('prompt', 'diamond hands during a market dip'); f.set('style', 'funny'); f.set('count', '1'); f.set('size', '1024x1024');
  const r = await j(await post(f, true));
  assert.ok(r.status === 200 || r.error === 'sharp_missing', JSON.stringify(r)); assert.equal(seen.length, 1);
});
test('idea without crypto words and a new idea are accepted', async () => {
  for (const prompt of ['a cat refusing to leave the keyboard during a deadline', 'the group chat at 3am after one sentence from the quiet guy']) {
    mode = 'ok';
    const r = await j(await post({ ...ok, prompt }));
    assert.ok(r.status === 200 || r.error === 'sharp_missing', JSON.stringify(r));
  }
});
test('empty, whitespace, too short, too long, wrong-type prompts are rejected with 400 and never hit the provider', async () => {
  seen.length = 0;
  for (const prompt of ['', '    ', 'hi', 'x '.repeat(400), 12345, null, ['a', 'b'], { a: 1 }]) {
    const r = await j(await post({ ...ok, prompt }));
    assert.equal(r.status, 400, JSON.stringify(prompt)?.slice(0, 40)); assert.equal(r.error, 'invalid'); assert.ok(r.message);
  }
  const noPrompt = await j(await post(ok)); assert.equal(noPrompt.status, 400);
  assert.equal(seen.length, 0);
});
test('malformed payloads are rejected', async () => {
  assert.equal((await post('{not json', true, { 'content-type': 'application/json' })).status, 400);
  assert.equal((await j(await post({ prompt: 'holders waiting for the move', style: 'nope', count: 1, size: '1024x1024' }))).status, 400);
  assert.equal((await j(await post({ prompt: 'holders waiting for the move', style: 'funny', count: 3, size: '1024x1024' }))).status, 400);
  assert.equal((await j(await post({ prompt: 'holders waiting for the move', style: 'funny', count: 1, size: '99x99' }))).status, 400);
  assert.equal((await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400); // no client id
});
test('prohibited content and other coins are still refused by the backend', async () => {
  seen.length = 0;
  const a = await j(await post({ ...ok, prompt: 'explicit porn scene with the mascot' })); assert.deepEqual([a.status, a.error], [422, 'prohibited']);
  const b = await j(await post({ ...ok, prompt: 'holders waiting while bitcoin pumps' })); assert.deepEqual([b.status, b.error], [422, 'off_topic']);
  assert.equal(seen.length, 0);
});
test('provider failures keep their friendly error handling', async () => {
  mode = '402';
  const a = await j(await post({ ...ok, prompt: 'holders waiting for the next big move' }));
  assert.deepEqual([a.status, a.error], [429, 'provider_quota']);
  mode = '503';
  const b = await j(await post({ ...ok, prompt: 'holders waiting for the next big move' }));
  assert.deepEqual([b.status, b.error], [502, 'provider_rejected']);
  mode = 'html';
  const c = await j(await post({ ...ok, prompt: 'holders waiting for the next big move' }));
  assert.deepEqual([c.status, c.error], [502, 'bad_output']);
  mode = 'ok';
});
