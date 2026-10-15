export interface Meme {
  id: string; url: string; prompt: string; style: string;
  top: string; bottom: string; favorite: boolean; createdAt: number; method?: string;
}
export interface Engine {
  state: 'connected' | 'disconnected' | 'generating'; message: string; model: string | null; code: string;
}
export interface Status {
  configured: boolean; engine: Engine; coinReady: boolean; coinProblem: string | null; authRequired: boolean; counts: number[]; sizes: string[];
  defaultSize: string; dailyQuota: number; used: number; model: string;
}
export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

const cid = (() => {
  let v = localStorage.getItem('dmc_cid');
  if (!v) { v = crypto.randomUUID(); localStorage.setItem('dmc_cid', v); }
  return v;
})();
export const getCode = () => localStorage.getItem('dmc_code') || '';
export const setCode = (c: string) => localStorage.setItem('dmc_code', c);

const headers = (): Record<string, string> => ({ 'x-client-id': cid, ...(getCode() ? { 'x-access-code': getCode() } : {}) });

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try { res = await fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } }); }
  catch { throw new ApiError('Cannot reach the server. Is the backend running?', 'network', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || 'Request failed.', data.error || 'error', res.status);
  return data as T;
}

export const api = {
  status: () => call<Status>('/api/status'),
  engine: () => call<Engine>('/api/engine'),
  gallery: () => call<{ items: Meme[] }>('/api/gallery').then((r) => r.items),
  remove: (id: string) => call(`/api/gallery/${id}`, { method: 'DELETE' }),
  favorite: (id: string) => call<Meme>(`/api/gallery/${id}/favorite`, { method: 'POST' }),
  caption: (prompt: string, style: string) =>
    call<{ top: string; bottom: string }>('/api/caption', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, style }),
    }),
  generate: (f: { prompt: string; style: string; count: number; size: string }) => {
    const form = new FormData();
    form.set('prompt', f.prompt); form.set('style', f.style); form.set('count', String(f.count)); form.set('size', f.size);
    return call<{ items: Meme[]; failed: number; used: number }>('/api/generate', { method: 'POST', body: form });
  },
};
