import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Zap } from 'lucide-react';
import { api, ApiError, Engine, getCode, Meme, setCode, Status } from './lib/api';
import Studio, { STYLES } from './components/Studio';
import Gallery from './components/Gallery';

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [memes, setMemes] = useState<Meme[]>([]);
  const [batch, setBatch] = useState<string[]>([]);
  const [style, setStyle] = useState('funny');
  const [remix, setRemix] = useState<{ prompt: string; n: number } | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [fatal, setFatal] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await api.status(); setStatus(s);
      if (s.authRequired && !getCode()) return setNeedCode(true);
      setMemes(await api.gallery()); setNeedCode(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedCode(true);
      else setFatal((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Live image-service status (ready / generating / needs setup). Re-checks every few seconds.
  useEffect(() => {
    let last: Engine['state'] | null = null;
    const tick = () => api.engine().then((e) => {
      if (last === 'disconnected' && e.state !== 'disconnected') api.status().then(setStatus).catch(() => {});
      last = e.state; setEngine(e);
    }).catch(() => { last = 'disconnected'; setEngine({ state: 'disconnected', message: 'Cannot reach the Meme Lab server. Is it running?', model: null, code: 'server_down' }); });
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const onGenerated = (items: Meme[], used: number) => {
    setMemes((m) => [...items, ...m]); setBatch(items.map((i) => i.id));
    setStatus((s) => (s ? { ...s, used } : s));
  };
  const onDelete = async (id: string) => { await api.remove(id).catch(() => {}); setMemes((m) => m.filter((x) => x.id !== id)); setBatch((b) => b.filter((x) => x !== id)); };
  const onFavorite = async (id: string) => { const u = await api.favorite(id).catch(() => null); if (u) setMemes((m) => m.map((x) => (x.id === id ? { ...x, favorite: u.favorite } : x))); };
  const onRemix = (m: Meme) => {
    setRemix({ prompt: m.prompt, n: Date.now() }); setStyle(m.style in Object.fromEntries(STYLES.map((s) => [s.id, 1])) ? m.style : 'funny'); go('studio');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <a href="#top" className="flex min-w-0 items-center gap-2 text-sm font-extrabold sm:text-base"><img src="/brand/coin.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" /><span className="truncate">DegenMateCoin <span className="text-volt">Meme Lab</span></span></a>
          <nav className="flex shrink-0 items-center gap-3 text-sm text-slate-400 sm:gap-4">
            <button onClick={() => go('styles')} className="hidden hover:text-white sm:block">Styles</button>
            <button onClick={() => go('gallery')} className="hover:text-white">Gallery</button>
            <EngineBadge engine={engine} />
            <button onClick={() => go('studio')} className="btn-primary !py-1.5">Create</button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-6xl px-4 pb-4 pt-10 text-center sm:pb-6 sm:pt-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-[11px] text-purple-200 sm:text-xs"><Zap size={12} /> AI meme generator for the DegenMateCoin community</span>
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Your Daily Dose of <span className="bg-gradient-to-r from-neon to-volt bg-clip-text text-transparent">DegenMateCoin</span> Memes
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 sm:text-base">Generate custom memes with your own images and prompts. Pick a style, add a caption, download and share with the community.</p>
            <button onClick={() => go('studio')} className="btn-primary mt-6 animate-float !px-8 !py-3 text-base sm:mt-8">Create Meme</button>
          </motion.div>
        </section>

        {fatal && <p role="alert" className="mx-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300 sm:mx-auto sm:max-w-3xl">{fatal}</p>}
        {needCode && (
          <div className="card mx-4 mt-6 flex items-center gap-2 p-3 sm:mx-auto sm:max-w-md">
            <KeyRound size={18} className="text-volt" />
            <input className="input" type="password" placeholder="Access code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
            <button className="btn-primary" onClick={() => { setCode(codeInput); load(); }}>Enter</button>
          </div>
        )}

        <section id="styles" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:py-12">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Meme styles</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STYLES.map((s, i) => (
              <motion.button key={s.id} whileHover={{ y: -4 }} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .04 }}
                onClick={() => { setStyle(s.id); go('studio'); }} className="card p-3 text-left transition hover:border-neon hover:shadow-glow sm:p-4">
                <p className="text-sm font-bold sm:text-base">{s.label}</p><p className="mt-1 text-xs text-slate-400 sm:text-sm">{s.blurb}</p>
              </motion.button>
            ))}
          </div>
        </section>

        <Studio status={status} engine={engine} style={style} setStyle={setStyle} batch={memes.filter((m) => batch.includes(m.id))}
          remix={remix} onGenerated={onGenerated} onDelete={onDelete} onFavorite={onFavorite} onRemix={onRemix} />
        <Gallery memes={memes} onDelete={onDelete} onFavorite={onFavorite} onRemix={onRemix} />
      </main>

      <footer className="border-t border-line px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center text-xs text-slate-500">
        DegenMateCoin Meme Lab · for fun only, not financial advice. Generations are limited by a daily quota.
      </footer>
    </div>
  );
}

function EngineBadge({ engine }: { engine: Engine | null }) {
  const state = engine?.state ?? 'disconnected';
  const look = {
    connected: ['bg-emerald-400', 'AI ready'],
    generating: ['animate-pulse bg-amber-400', 'Generating…'],
    disconnected: ['bg-red-500', 'AI setup needed'],
  }[state];
  return (
    <span title={engine?.message} role="status" className="flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
      <span className={`h-2 w-2 rounded-full ${look[0]}`} />
      <span className="hidden sm:inline">{look[1]}</span>
      <span className="sr-only sm:hidden">{look[1]}</span>
    </span>
  );
}
