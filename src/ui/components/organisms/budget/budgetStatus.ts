import type { LineStatus } from '@/core/budget/budget';
import type { ProgressTone } from '@/ui/components/atoms/ProgressBar';

/** Couleur de la barre de progression selon l'état d'une dépense. */
export const STATUS_TONE: Record<LineStatus, ProgressTone> = {
  ok: 'good',
  attention: 'warning',
  depasse: 'critical',
};

/** Badge d'une dépense presque atteinte ou dépassée ; rien quand elle est dans le budget. */
export const STATUS_BADGE: Record<LineStatus, { tone: 'warning' | 'critical'; label: string } | null> = {
  ok: null,
  attention: { tone: 'warning', label: 'Presque atteint' },
  depasse: { tone: 'critical', label: 'Dépassé' },
};
