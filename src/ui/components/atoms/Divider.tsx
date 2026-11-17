import Text from '@/ui/components/atoms/Text';

export const Divider = () => (
  <div className="flex items-center gap-3">
    <span className="h-px flex-1 bg-line-strong" />
    <Text variant="small" as="span">
      ou
    </Text>
    <span className="h-px flex-1 bg-line-strong" />
  </div>
);
