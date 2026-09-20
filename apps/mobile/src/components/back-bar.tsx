import type { ReactNode } from 'react';
import { DepthHeader } from '@/components/depth-header';

export function BackBar({
  title,
  right,
  onBack,
  variant = 'back',
}: {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  variant?: 'back' | 'close';
}) {
  return <DepthHeader title={title} right={right} onBack={onBack} variant={variant} />;
}
