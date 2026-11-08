import type { ReactNode } from 'react';
import Text from '@/ui/design-system/Text';
import Title from '@/ui/design-system/Title';

type PageHeaderProps = { title: string; description?: string; actions?: ReactNode };

const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <Title level={1}>{title}</Title>
      {description && (
        <Text variant="muted" className="mt-1">
          {description}
        </Text>
      )}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
