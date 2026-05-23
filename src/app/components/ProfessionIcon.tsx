import type { CSSProperties } from 'react';
import { getProfessionLucideIcon } from '../data/professionLucideIcons';

type Props = {
  name: string;
  categoryId: string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
};

export function ProfessionIcon({
  name,
  categoryId,
  className = 'size-6 sm:size-7',
  style,
  strokeWidth = 1.85,
}: Props) {
  const Icon = getProfessionLucideIcon(name, categoryId);
  return <Icon className={className} style={style} strokeWidth={strokeWidth} aria-hidden />;
}
