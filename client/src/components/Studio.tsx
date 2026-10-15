import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, Sparkles, Terminal } from 'lucide-react';
import { api, ApiError, Engine, Meme, Status } from '../lib/api';
import MemeCard from './MemeCard';
import { ideaProblem } from '../lib/idea';

export const STYLES = [
  { id: 'funny', label: 'Funny', blurb: 'Big laughs, bigger faces.' },
  { id: 'relatable', label: 'Relatable', blurb: 'Every holder has been here.' },
  { id: 'classic-degen', label: 'Classic degen', blurb: 'Charts, hoodies, zero chill.' },
  { id: 'community', label: 'Community humour', blurb: 'Inside jokes for the timeline.' },
  { id: 'reaction', label: 'Reaction meme', blurb: 'One face, one feeling.' },
  { id: 'cinematic', label: 'Cinematic', blurb: 'Epic lighting, silly stakes.' },
  { id: 'wholesome', label: 'Wholesome', blurb: 'Good vibes only.' },
  { id: 'absurd', label: 'Absurd humour', blurb: 'Surreal and deadpan.' },
];
const IDEAS = [
  'holders waiting for the next big move',
  'diamond hands during a market dip',
  'me checking my portfolio every five minutes',
  'when everyone panics but you stay calm',
  'the squad celebrating after surviving a rough week',
];

interface Props {
  status: Status | null; engine: Engine | null; style: string; setStyle: (s: string) => void;
  batch: Meme[]; remix: { prompt: string; n: number } | null; onGenerated: (m: Meme[], used: number) => void;
  onDelete: (id: string) => void; onFavorite: (id: string) => void; onRemix: (m: Meme) => void;
}

export default function Studio({ status, engine, style, setStyle, batch, remix, onGenerated, onDelete, onFavorite, onRemix }: Props) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(1);
  const [size, setSize] = useState('1024x1024');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (status) setSize(status.defaultSize); }, [status]);
  useEffect(() => { if (remix) setPrompt(remix.prompt); }, [remix]);

  async function submit() {
    setError(''); setLoading(true);
    try {
      const r = await api.generate({ prompt, style, count, size });
      onGenerated(r.items, r.used);
      if (r.failed) setError(`${r.failed} of ${count} variations failed and were not counted against your quota.`);
    } catch (e) { setError(e instanceof ApiError || e instanceof Error ? e.message : 'Generation failed.'); }
    finally { setLoading(false); }
  }

  const left = status ? Math.max(status.dailyQuota - status.used, 0) : 0;

  return (
    <section id="studio" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:py-14">
      <h2 className="text-2xl font-extrabold sm:text-3xl">Create a meme</h2>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">Describe any meme moment, no need to mention the coin: it gets turned into a DegenMateCoin meme. Captions are added separately so they're always spelled right.</p>

      {engine && engine.state === 'disconnected' && <EngineNotice engine={engine} />}
      {status && !status.coinReady ? <SetupScreen coinProblem={status.coinProblem} /> : (
        <div className="card mt-5 grid gap-5 p-4 sm:mt-6 sm:gap-6 sm:p-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div>
              <label htmlFor="idea" className="mb-1 block text-sm font-medium">Your meme idea</label>
              <textarea id="idea" rows={4} maxLength={500} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                className="input resize-none" placeholder="e.g. holders waiting for the next big move" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {IDEAS.map((i) => <button key={i} onClick={() => setPrompt(i)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-slate-400 hover:border-neon hover:text-white">{i}</button>)}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Style</p>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyle(s.id)} aria-pressed={style === s.id}
                    className={`rounded-full border px-3 py-2 text-sm transition sm:py-1.5 ${style === s.id ? 'border-neon bg-neon/20 text-white shadow-glow' : 'border-line text-slate-400 hover:text-white'}`}>{s.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Variations
                <select className="input mt-1" value={count} onChange={(e) => setCount(+e.target.value)}>
                  {(status?.counts ?? [1]).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-sm">Resolution
                <select className="input mt-1" value={size} onChange={(e) => setSize(e.target.value)}>
                  {(status?.sizes ?? ['1024x1024']).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <button className="btn-primary w-full !py-3 sm:w-auto sm:!py-2.5" disabled={loading || ideaProblem(prompt) !== null || (status ? count > left : false) || engine?.state === 'disconnected'} onClick={submit}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {loading ? 'Generating…' : `Generate ${count} meme${count > 1 ? 's' : ''}`}
            </button>
            {loading && <p className="text-xs text-slate-400" role="status">The scene is being drawn by the free image service. This usually takes a few seconds to a minute.</p>}
            {status && <p className="text-xs text-slate-500">{left} of {status.dailyQuota} generations left today · model {status.model}</p>}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-ink/60 p-2">
              <img src="/brand/coin.png" alt="Official DegenMateCoin mascot" className="h-14 w-14 rounded-lg object-cover" />
              <p className="text-xs text-slate-400"><span className="font-semibold text-slate-200">Official mascot</span><br />Used in every meme, unchanged.</p>
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 flex items-start gap-2 break-words rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</p>}

      {loading && (
        <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
            <div key={i} className="card aspect-square animate-pulse bg-gradient-to-br from-neon/20 to-volt/10" />
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>{batch.map((m) => <MemeCard key={m.id} meme={m} onDelete={onDelete} onFavorite={onFavorite} onRemix={onRemix} />)}</AnimatePresence>
      </div>
    </section>
  );
}

function EngineNotice({ engine }: { engine: Engine }) {
  return (
    <div role="alert" className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 sm:mt-6">
      <p className="flex items-start gap-2 font-semibold"><Terminal size={16} className="mt-0.5 shrink-0" />{engine.message}</p>
      {engine.code === 'no_key' && (
        <p className="mt-2 text-xs text-amber-200/80">
          Create a free key at <code className="rounded bg-white/10 px-1">enter.pollinations.ai</code>, put it in <code className="rounded bg-white/10 px-1">server/.env</code> as
          {' '}<code className="rounded bg-white/10 px-1">POLLINATIONS_API_KEY</code>, then restart the server. The README has the exact steps.
        </p>
      )}
    </div>
  );
}

function SetupScreen({ coinProblem }: { coinProblem: string | null }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-5 p-4 sm:mt-6 sm:p-6">
      <h3 className="flex items-center gap-2 text-xl font-bold"><Terminal size={20} className="text-volt" /> Setup required</h3>
      {coinProblem && <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">{coinProblem}</p>}
    </motion.div>
  );
}
