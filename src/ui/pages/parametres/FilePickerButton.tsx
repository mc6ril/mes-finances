import { Upload } from 'lucide-react';
import { cx } from '@/ui/design-system/cx';

type FilePickerButtonProps = {
  label: string;
  onFile: (file: File) => void;
  className?: string;
  iconOnly?: boolean;
};

const FilePickerButton = ({ label, onFile, className, iconOnly = false }: FilePickerButtonProps) => (
  <label
    title={iconOnly ? label : undefined}
    className={cx(
      'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white font-medium text-stone-800 ring-1 ring-inset ring-stone-200 hover:bg-stone-50 focus-within:ring-2 focus-within:ring-brand-500/40 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-700',
      iconOnly ? 'h-8 w-8' : 'h-10 px-3.5 text-sm',
      className,
    )}
  >
    <Upload className={iconOnly ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
    {iconOnly ? <span className="sr-only">{label}</span> : label}
    <input
      type="file"
      accept="application/json,.json"
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) {
          onFile(file);
        }
      }}
    />
  </label>
);

export default FilePickerButton;
