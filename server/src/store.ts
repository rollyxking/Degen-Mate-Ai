import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export interface Item {
  id: string; clientId: string; prompt: string; style: string;
  top: string; bottom: string; createdAt: number; favorite: boolean; file: string; method?: string;
}
interface DB { items: Item[]; usage: Record<string, number> }

const root = path.resolve(config.dataDir);
export const imagesDir = path.join(root, 'images');
const dbFile = path.join(root, 'db.json');
fs.mkdirSync(imagesDir, { recursive: true });

const db: DB = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : { items: [], usage: {} };
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db));
const day = () => new Date().toISOString().slice(0, 10);

export const usedToday = (cid: string) => db.usage[`${cid}:${day()}`] || 0;
export function addUsage(cid: string, n: number) { db.usage[`${cid}:${day()}`] = usedToday(cid) + n; save(); }

export const list = (cid: string) => db.items.filter((i) => i.clientId === cid).sort((a, b) => b.createdAt - a.createdAt);

export function add(item: Item, buffer: Buffer) {
  fs.writeFileSync(path.join(imagesDir, item.file), buffer);
  db.items.push(item); save();
}
export function remove(cid: string, id: string) {
  const i = db.items.findIndex((x) => x.id === id && x.clientId === cid);
  if (i < 0) return false;
  fs.rmSync(path.join(imagesDir, db.items[i].file), { force: true });
  db.items.splice(i, 1); save(); return true;
}
export function toggleFavorite(cid: string, id: string) {
  const it = db.items.find((x) => x.id === id && x.clientId === cid);
  if (!it) return null;
  it.favorite = !it.favorite; save(); return it;
}
