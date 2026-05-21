import { X } from 'lucide-react';

export function Modal({ title, children, onClose, wide = false, full = false }) {
  const sizeClass = full
    ? 'h-[96dvh] sm:h-[94vh] sm:max-w-[min(1180px,96vw)]'
    : wide
      ? 'sm:max-w-4xl'
      : 'sm:max-w-xl';

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 sm:place-items-center sm:p-5">
      <div className={`max-h-[96dvh] w-full overflow-auto rounded-t-[2rem] bg-white p-4 shadow-2xl sm:max-h-[94vh] sm:rounded-[2rem] sm:p-5 ${sizeClass}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="min-w-0 line-clamp-1 text-lg font-black text-glowza-plum sm:text-xl">{title}</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-pink-50 text-glowza-pink" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
