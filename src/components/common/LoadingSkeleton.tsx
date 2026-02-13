import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  };

  const baseClasses = 'animate-pulse bg-white/10';

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              variantClasses.text,
              i === lines - 1 ? 'w-3/4' : 'w-full',
              'h-4'
            )}
            style={{
              width: i === lines - 1 ? '75%' : width,
              height: height || '1rem',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{
        width,
        height,
      }}
    />
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-neutral-900/30 rounded-2xl border border-neutral-800/50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton width="150px" height="24px" />
          <Skeleton width="100px" height="32px" variant="rectangular" />
        </div>

        {/* Chart Grid */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square">
              <Skeleton className="w-full h-full" variant="circular" />
            </div>
          ))}
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <Skeleton width="200px" height="20px" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton lines={3} />
            <Skeleton lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-neutral-900/30 rounded-xl border border-neutral-800/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800/30">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton width="100px" height="16px" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-neutral-800/20">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <Skeleton width="80px" height="14px" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
