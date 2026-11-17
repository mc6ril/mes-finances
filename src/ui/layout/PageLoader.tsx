import { Loader2 } from 'lucide-react';

/** Page en cours de téléchargement, dans la zone de contenu. */
const PageLoader = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-label="Chargement" />
  </div>
);

export default PageLoader;
