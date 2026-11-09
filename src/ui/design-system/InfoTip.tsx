import { Info } from 'lucide-react';

type InfoTipProps = { text: string; label: string };

const InfoTip = ({ text, label }: InfoTipProps) => (
  <span className="group inline-flex">
    <button
      type="button"
      aria-label={`À propos de ${label}`}
      className="flex h-4 w-4 items-center justify-center rounded-full text-stone-400 hover:text-stone-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-stone-500 dark:hover:text-stone-300"
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
    </button>
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute inset-x-3 top-11 z-40 rounded-lg bg-stone-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:bg-stone-700"
    >
      {text}
    </span>
  </span>
);

export default InfoTip;
