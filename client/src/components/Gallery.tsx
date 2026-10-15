import { AnimatePresence } from 'framer-motion';
import { Meme } from '../lib/api';
import MemeCard from './MemeCard';

interface Props { memes: Meme[]; onDelete: (id: string) => void; onFavorite: (id: string) => void; onRemix: (m: Meme) => void }

export default function Gallery({ memes, ...h }: Props) {
  const sorted = [...memes].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt);
  return (
    <section id="gallery" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:py-14">
      <h2 className="text-2xl font-extrabold sm:text-3xl">Your gallery</h2>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">Recent generations saved to this browser's profile. Favourites float to the top.</p>
      {sorted.length === 0 ? (
        <div className="card mt-5 p-8 text-center text-slate-500 sm:mt-6 sm:p-10">No memes yet. Create your first one above.</div>
      ) : (
        <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>{sorted.map((m) => <MemeCard key={m.id} meme={m} {...h} />)}</AnimatePresence>
        </div>
      )}
    </section>
  );
}
