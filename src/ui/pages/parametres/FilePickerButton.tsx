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
      'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-surface-raised font-medium text-ink-emphasis ring-1 ring-inset ring-line-field hover:bg-surface-hover focus-within:ring-2 focus-within:ring-accent-bright/40',
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
