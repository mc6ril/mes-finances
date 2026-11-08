type LegendItem = { label: string; color: string; dashed?: boolean };

type LegendProps = { items: LegendItem[] };

const Legend = ({ items }: LegendProps) => (
  <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
    {items.map((item) => (
      <li key={item.label} className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
        <span
          className="inline-block h-0.5 w-3.5 rounded"
          style={{
            background: item.dashed ? 'transparent' : item.color,
            borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
            height: item.dashed ? 0 : 3,
          }}
          aria-hidden
        />
        {item.label}
      </li>
    ))}
  </ul>
);

export default Legend;
