import { CloudOff } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';

/** Hors ligne, la saisie continue : les modifications partent au retour du réseau. */
const OfflineBanner = () => {
  const { offline, pendingWrites } = useSyncStatus();
  if (!offline) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-warning-soft-strong px-4 py-2 text-center text-xs font-medium text-warning-ink-deepest"
    >
      <CloudOff className="h-3.5 w-3.5" aria-hidden />
      {pendingWrites > 0
        ? `Hors ligne : ${pendingWrites} modification${pendingWrites > 1 ? 's' : ''} en attente, envoyée${pendingWrites > 1 ? 's' : ''} au retour du réseau.`
        : 'Hors ligne : tu peux continuer, tes modifications seront envoyées au retour du réseau.'}
    </div>
  );
};

export default OfflineBanner;
