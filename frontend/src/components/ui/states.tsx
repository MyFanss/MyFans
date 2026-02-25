interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden className={`skeleton-shimmer rounded-md bg-slate-200 ${className}`.trim()} />;
}

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeletonGrid({ count = 3 }: CardSkeletonProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div className="rounded-xl border border-slate-200 bg-white p-4" key={index}>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <div className="mt-5 flex items-center justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
}

export function TableSkeleton({ rows = 4 }: TableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-4 gap-3 border-b border-slate-200 p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="grid grid-cols-4 gap-3" key={index}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 flex h-44 items-end gap-2">
        {[40, 65, 30, 85, 55, 78, 60].map((height, index) => (
          <div className="skeleton-shimmer w-full rounded-t-md bg-slate-200" key={index} style={{ height }} />
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

export function EmptyState({ title, description, ctaLabel, onCtaClick }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto h-10 w-10 rounded-full bg-slate-200" />
      <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <button
        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        onClick={onCtaClick}
        type="button"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

interface SuccessAnimationProps {
  message: string;
}

export function SuccessAnimation({ message }: SuccessAnimationProps) {
  return (
    <div className="success-pop inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {message}
    </div>
  );
}
