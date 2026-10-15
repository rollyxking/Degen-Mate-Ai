// One generate request at a time. Extra requests wait briefly, then are refused (protects the provider's free allowance).
import { config } from './config.js';
import { EngineError } from './provider.js';

let running = 0;
let waiting = 0;
let chain: Promise<void> = Promise.resolve();
const busyClients = new Set<string>();

export const isGenerating = () => running + waiting > 0;

export async function runJob<T>(clientId: string, fn: () => Promise<T>): Promise<T> {
  if (busyClients.has(clientId)) throw new EngineError('You already have a meme generating. Wait for it to finish first.', 429, 'busy');
  if (running + waiting >= 1 + config.maxQueued) throw new EngineError('The image service is busy with other requests. Try again in a minute.', 429, 'busy');
  busyClients.add(clientId);
  waiting++;
  const previous = chain;
  let release!: () => void;
  chain = new Promise<void>((r) => { release = r; });
  let started = false;
  try {
    await previous;
    waiting--; running++; started = true;
    return await fn();
  } finally {
    if (started) running--; else waiting--;
    busyClients.delete(clientId);
    release();
  }
}
