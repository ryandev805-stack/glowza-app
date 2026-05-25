import { Heart, PackageCheck, PlayCircle, Star } from 'lucide-react';
import { money } from '../utils/format';

export function ProductCard({ product, wished, onOpen, onCart, onWish }) {
  const image = product.image || product.images?.[0] || '';
  const video = !image ? product.videos?.[0] : '';

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-pink-100 bg-white shadow-glow transition hover:-translate-y-1 sm:rounded-[1.35rem]">
      <div className="relative aspect-[0.92] overflow-hidden bg-gradient-to-br from-pink-50 to-purple-100 sm:aspect-[1.05]">
        <button className="block h-full w-full bg-transparent p-0 text-left" onClick={onOpen} aria-label={product.name}>
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : video ? (
            <video src={video} muted playsInline preload="metadata" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center text-sm font-bold text-glowza-pink">Glowza</div>
          )}
        </button>
        {product.videos?.length > 0 && (
          <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/92 text-glowza-pink shadow-sm backdrop-blur">
            <PlayCircle size={17} />
          </span>
        )}
        <button
          className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border text-xs font-black shadow-sm backdrop-blur transition sm:h-10 sm:w-10 ${wished ? 'border-glowza-pink bg-white/95 text-glowza-pink' : 'border-white/80 bg-white/90 text-glowza-plum hover:bg-pink-50'}`}
          onClick={onWish}
          aria-label="Wishlist"
        >
          <Heart size={17} fill={wished ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
        <button className="min-w-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <h3 className="line-clamp-2 min-h-8 text-[13px] font-bold leading-snug text-glowza-plum sm:min-h-9 sm:text-sm">{product.name}</h3>
        </button>
        <div className="mt-auto flex items-end justify-between gap-2 sm:gap-3">
          <div>
            <strong className="text-sm text-glowza-pink sm:text-base">{money(product.price)}</strong>
            {Number(product.oldPrice || 0) > Number(product.price || 0) && (
              <p className="text-xs text-slate-400 line-through">{money(product.oldPrice)}</p>
            )}
          </div>
          <div className="text-right text-[11px] font-bold text-slate-500 sm:text-xs">
            <p className="inline-flex items-center gap-1"><Star size={12} fill="currentColor" className="text-glowza-gold" /> {Number(product.rating || 0).toFixed(1)}</p>
          </div>
        </div>
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-pink px-3 py-2.5 text-xs font-bold text-white transition hover:bg-glowza-wine sm:px-4 sm:py-3 sm:text-sm" onClick={onCart}>
          <PackageCheck size={16} />
          Buy Now
        </button>
      </div>
    </article>
  );
}
