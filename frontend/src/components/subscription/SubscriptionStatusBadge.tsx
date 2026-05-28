import {
  Ban,
  CheckCircle2,
  Clock3,
  type LucideIcon,
} from 'lucide-react';
import {
  getSubscriptionStatusCopy,
  type SubscriptionStatus,
} from '@/lib/subscription-status';

export interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus;
  className?: string;
}

interface BadgeConfig {
  icon: LucideIcon;
  className: string;
  iconClassName: string;
}

const BADGE_CONFIG: Record<SubscriptionStatus, BadgeConfig> = {
  active: {
    icon: CheckCircle2,
    className:
      'border border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
  },
  expired: {
    icon: Clock3,
    className:
      'border border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    iconClassName: 'text-amber-700 dark:text-amber-300',
  },
  cancelled: {
    icon: Ban,
    className:
      'border border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
    iconClassName: 'text-rose-700 dark:text-rose-300',
  },
};

export function SubscriptionStatusBadge({
  status,
  className = '',
}: SubscriptionStatusBadgeProps) {
  const copy = getSubscriptionStatusCopy(status);
  const config = BADGE_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-label={copy.srLabel}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${config.className} ${className}`.trim()}
    >
      <Icon className={`h-4 w-4 ${config.iconClassName}`} aria-hidden />
      <span>{copy.label}</span>
    </span>
  );
}

export default SubscriptionStatusBadge;
