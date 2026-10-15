import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Download, Heart, ImageDown, Maximize2, RefreshCw, Share2, Trash2, Wand2, X } from 'lucide-react';
import { api, Meme } from '../lib/api';
import { canvasDownload, CaptionMode, CaptionOpts, download, drawMeme } from '../lib/meme';

function MemeCanvas({ src, opts, className = '' }: { src: string; opts: CaptionOpts; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { const i = new Image(); i.onload = () => setImg(i); i.src = src; }, [src]);
  useEffect(() => { if (img && ref.current) drawMeme(ref.current, img, opts); }, [img, opts]);
  return <canvas ref={ref} className={`w-full rounded-xl bg-black ${className}`} />;
}

interface Props {
  meme: Meme;
  onDelete: (id: string) => void;
  onFavorite: (id: string) => void;
  onRemix: (m: Meme) => void;
}

export default function MemeCard({ meme, onDelete, onFavorite, onRemix }: Props) {
  const [top, setTop] = useState(meme.top);
  const [bottom, setBottom] = useState(meme.bottom);
  const [mode, setMode] = useState<CaptionMode>('both');
  const [fontSize, setFontSize] = useState(8);
  const [outline, setOutline] = useState(true);
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const opts: CaptionOpts = { top, bottom, mode, fontSize, outline };
  const canvasRef = () => document.querySelector<HTMLCanvasElement>(`#m-${meme.id} canvas`)!;
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2000); };
  const text = [mode !== 'bottom' && top, mode !== 'top' && bottom].filter(Boolean).join(' / ');

  const rewrite = async () => {
    setBusy(true);
    try { const c = await api.caption(meme.prompt, meme.style); setTop(c.top); setBottom(c.bottom); }
    catch (e) { flash((e as Error).message); } finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(text); flash('Caption copied'); };
  const shareX = () => window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text ? text + '\n\n' : ''}Made in the DegenMateCoin Meme Lab #DegenMateCoin`)}`, '_blank', 'noopener');

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }}
      id={`m-${meme.id}`} className="card overflow-hidden p-3">
      <div className="group relative">
        <MemeCanvas src={meme.url} opts={opts} />
        <button onClick={() => setBig(true)} aria-label="Open larger preview"
          className="absolute right-2 top-2 rounded-lg bg-black/60 p-2.5 opacity-100 transition sm:p-2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Maximize2 size={16} /></button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" value={top} onChange={(e) => setTop(e.target.value)} placeholder="Top text" aria-label="Top text" maxLength={80} />
          <input className="input" value={bottom} onChange={(e) => setBottom(e.target.value)} placeholder="Bottom text" aria-label="Bottom text" maxLength={80} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <div className="flex overflow-hidden rounded-lg border border-line">
            {(['top', 'bottom', 'both'] as CaptionMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-2 capitalize sm:px-2.5 sm:py-1.5 ${mode === m ? 'bg-neon/30 text-white' : 'text-slate-400 hover:bg-white/5'}`}>{m}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-slate-400">Size
            <input type="range" min={4} max={14} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-24 accent-purple-500" />
          </label>
          <label className="flex items-center gap-1.5 text-slate-400">
            <input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} className="accent-purple-500" /> Outline
          </label>
          <button onClick={rewrite} disabled={busy} className="btn-ghost !px-2.5 !py-1.5 text-xs ml-auto">
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />} New caption
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-1 sm:flex sm:flex-wrap">
          <button className="btn-primary !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={() => canvasDownload(canvasRef(), 'image/png', `degenmate-meme-${meme.id.slice(0, 6)}.png`)}><Download size={14} />PNG</button>
          <button className="btn-ghost !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={() => canvasDownload(canvasRef(), 'image/jpeg', `degenmate-meme-${meme.id.slice(0, 6)}.jpg`)}><Download size={14} />JPEG</button>
          <button className="btn-ghost !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={() => download(meme.url, `degenmate-original-${meme.id.slice(0, 6)}.png`)}><ImageDown size={14} />Original</button>
          <button className="btn-ghost !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={copy} disabled={!text}><Copy size={14} />Caption</button>
          <button className="btn-ghost !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={shareX}><Share2 size={14} />Post on X</button>
          <button className="btn-ghost !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={() => onRemix(meme)}><RefreshCw size={14} />Variations</button>
          <button aria-label="Favourite" className="btn-ghost !px-2 !py-2.5 text-xs sm:!px-3 sm:!py-2" onClick={() => onFavorite(meme.id)}>
            <Heart size={14} className={meme.favorite ? 'fill-pink-500 text-pink-500' : ''} /></button>
          <button aria-label="Delete" className="btn-ghost !px-3 !py-2 text-xs hover:!text-red-400" onClick={() => onDelete(meme.id)}><Trash2 size={14} /></button>
        </div>
        {note && <p className="text-xs text-volt" role="status">{note}</p>}
      </div>

      {big && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-4" onClick={() => setBig(false)} role="dialog" aria-modal="true">
          <button className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 rounded-full bg-white/15 p-2.5" aria-label="Close"><X /></button>
          <div className="max-h-full w-full max-w-3xl overflow-auto [&>canvas]:mx-auto [&>canvas]:max-h-[85dvh] [&>canvas]:w-auto [&>canvas]:max-w-full" onClick={(e) => e.stopPropagation()}>
            <MemeCanvas src={meme.url} opts={opts} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
