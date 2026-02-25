/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🎨 DISC BADGE - Badge colorido com perfil DISC
 * ══════════════════════════════════════════════════════════════════════════
 */

import { clsx } from 'clsx';
import type { DISCProfile } from '@/hooks/useSalesAI';

interface DISCBadgeProps {
  profile: DISCProfile;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const DISC_CONFIG: Record<
  DISCProfile,
  {
    label: string;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  DOMINANTE: {
    label: 'D',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Direto e assertivo',
  },
  INFLUENTE: {
    label: 'I',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'Entusiasmado e social',
  },
  ESTAVEL: {
    label: 'S',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Paciente e leal',
  },
  CONSCIENTE: {
    label: 'C',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Analítico e preciso',
  },
  HIBRIDO: {
    label: 'H',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    description: 'Perfil balanceado',
  },
};

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

export function DISCBadge({
  profile,
  size = 'md',
  showLabel = false,
  className,
}: DISCBadgeProps) {
  const config = DISC_CONFIG[profile];

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'flex items-center justify-center rounded-full font-bold',
          config.color,
          config.bgColor,
          SIZE_CLASSES[size]
        )}
        title={config.description}
      >
        {config.label}
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-zinc-600">
          {profile}
        </span>
      )}
    </div>
  );
}
