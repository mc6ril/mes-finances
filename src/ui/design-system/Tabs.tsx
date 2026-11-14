import { Link } from 'react-router';
import { cx } from './cx';

type TabLink = { id: string; label: string; to: string };

type TabsProps = { tabs: TabLink[]; active: string; label: string };

/** Onglets sous forme de liens : l'onglet actif vit dans l'URL, on peut donc y renvoyer directement. */
const Tabs = ({ tabs, active, label }: TabsProps) => (
  <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="inline-flex gap-1 rounded-xl bg-white p-1 shadow-card dark:bg-[#1c1c1b]">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          aria-current={tab.id === active ? 'page' : undefined}
          className={cx(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            tab.id === active
              ? 'bg-brand-600 text-white'
              : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  </nav>
);

export default Tabs;
