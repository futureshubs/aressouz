import type { ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';
import { useTheme } from '../../context/ThemeContext';

/** Uzum-style neutral plate (light) / zinc (dark) */
export function skeletonBlockClass(isDark: boolean) {
  return clsx('animate-pulse rounded-[10px]', isDark ? 'bg-zinc-700/85' : 'bg-[#F2F4F7]');
}

export function SkeletonBox({
  isDark,
  className,
  ...rest
}: { isDark: boolean; className?: string } & ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={clsx(skeletonBlockClass(isDark), className)}
      aria-hidden
      {...rest}
    />
  );
}

export function BannerSkeleton({
  isDark,
  className,
}: {
  isDark: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'w-full h-64 md:h-80 lg:h-96 rounded-3xl overflow-hidden',
        skeletonBlockClass(isDark),
        className,
      )}
      aria-hidden
    />
  );
}

export function ProductCardSkeleton({
  isDark,
  imageClassName,
}: {
  isDark: boolean;
  /** e.g. aspect-[4/3] for rental cards */
  imageClassName?: string;
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl overflow-hidden border',
        isDark ? 'border-white/10 bg-white/[0.03]' : 'border-black/[0.06] bg-white',
      )}
      aria-hidden
    >
      <SkeletonBox
        isDark={isDark}
        className={clsx('w-full rounded-none rounded-t-2xl', imageClassName ?? 'aspect-square')}
      />
      <div className="p-3 space-y-2">
        <SkeletonBox isDark={isDark} className="h-4 w-[88%]" />
        <SkeletonBox isDark={isDark} className="h-3 w-[55%]" />
        <SkeletonBox isDark={isDark} className="h-5 w-[40%] mt-1" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  isDark,
  count = 10,
  gridClassName = 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-5 md:gap-6 lg:gap-7 xl:gap-8',
  imageClassName,
}: {
  isDark: boolean;
  count?: number;
  gridClassName?: string;
  imageClassName?: string;
}) {
  const n = Math.max(1, Math.min(24, count));
  return (
    <div className={gridClassName} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <ProductCardSkeleton key={i} isDark={isDark} imageClassName={imageClassName} />
      ))}
    </div>
  );
}

export function ShopRowSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={clsx(
        'flex gap-3.5 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border',
        isDark ? 'border-white/10 bg-[#1a1a1a]' : 'border-black/10 bg-white',
      )}
      aria-hidden
    >
      <SkeletonBox isDark={isDark} className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-2.5 py-0.5">
        <SkeletonBox isDark={isDark} className="h-5 w-[72%]" />
        <SkeletonBox isDark={isDark} className="h-3 w-full" />
        <SkeletonBox isDark={isDark} className="h-3 w-[58%]" />
      </div>
    </div>
  );
}

export function ShopListSkeleton({ isDark, rows = 5 }: { isDark: boolean; rows?: number }) {
  const n = Math.max(1, Math.min(12, rows));
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <ShopRowSkeleton key={i} isDark={isDark} />
      ))}
    </div>
  );
}

export function CarCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={clsx('rounded-2xl overflow-hidden border', isDark ? 'border-white/10' : 'border-black/10 bg-white')}
      aria-hidden
    >
      <SkeletonBox isDark={isDark} className="w-full aspect-video rounded-none" />
      <div className="p-4 space-y-2">
        <SkeletonBox isDark={isDark} className="h-5 w-[80%]" />
        <SkeletonBox isDark={isDark} className="h-4 w-[50%]" />
        <SkeletonBox isDark={isDark} className="h-6 w-[35%] mt-2" />
      </div>
    </div>
  );
}

export function CarGridSkeleton({ isDark, count = 6 }: { isDark: boolean; count?: number }) {
  const n = Math.max(1, Math.min(12, count));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <CarCardSkeleton key={i} isDark={isDark} />
      ))}
    </div>
  );
}

export function SectionHeaderSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center justify-between mb-6 sm:mb-8" aria-hidden>
      <SkeletonBox isDark={isDark} className="h-7 sm:h-8 w-48 sm:w-56 rounded-xl" />
      <SkeletonBox isDark={isDark} className="h-4 w-14 rounded-lg" />
    </div>
  );
}

export function ViewToggleSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex gap-3 px-5 sm:px-6 py-3" aria-hidden>
      <SkeletonBox isDark={isDark} className="h-11 w-36 rounded-2xl" />
      <SkeletonBox isDark={isDark} className="h-11 w-36 rounded-2xl" />
    </div>
  );
}

export function ChatMessagesSkeleton({ isDark }: { isDark: boolean }) {
  const widths = ['72%', '55%', '68%', '48%', '76%', '52%'];
  return (
    <div className="space-y-3 p-1" aria-hidden>
      {widths.map((w, i) => (
        <div key={i} className={clsx('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
          <SkeletonBox isDark={isDark} className="h-11 rounded-3xl" style={{ width: w }} />
        </div>
      ))}
    </div>
  );
}

export function CommunityRoomSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center px-4 py-6" aria-hidden>
      <div
        className={clsx(
          'mx-auto w-full max-w-xl flex-1 min-h-[280px] rounded-[24px] p-4 sm:p-5 flex flex-col',
          isDark ? 'bg-black/20 border border-white/5' : 'bg-slate-50 border border-slate-200/80',
        )}
      >
        <SkeletonBox isDark={isDark} className="h-9 w-40 rounded-2xl mb-4" />
        <ChatMessagesSkeleton isDark={isDark} />
      </div>
    </div>
  );
}

export function PlaceDetailPageSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={clsx('fixed inset-0 app-safe-pad z-50 flex flex-col p-4 sm:p-6', isDark ? 'bg-black' : 'bg-[#f9fafb]')}
      aria-hidden
    >
      <SkeletonBox isDark={isDark} className="w-full max-w-lg mx-auto h-[38vh] sm:h-[42vh] rounded-3xl" />
      <div className="max-w-lg mx-auto w-full mt-6 space-y-3 flex-1">
        <SkeletonBox isDark={isDark} className="h-8 w-[85%]" />
        <SkeletonBox isDark={isDark} className="h-4 w-full" />
        <SkeletonBox isDark={isDark} className="h-4 w-[70%]" />
        <SkeletonBox isDark={isDark} className="h-12 w-full rounded-2xl mt-4" />
      </div>
    </div>
  );
}

export function OrderReviewPageSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={clsx('fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-6', isDark ? 'bg-[#0a0a0a]' : 'bg-[#f9fafb]')}
      aria-hidden
    >
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBox key={i} isDark={isDark} className="size-9 rounded-lg" />
          ))}
        </div>
        <SkeletonBox isDark={isDark} className="h-24 w-full rounded-2xl" />
        <SkeletonBox isDark={isDark} className="h-5 w-2/3 mx-auto" />
        <SkeletonBox isDark={isDark} className="h-4 w-1/2 mx-auto" />
      </div>
    </div>
  );
}

/** Lazy route chunk: market-style shell */
export function RouteChunkSkeleton() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div
      className={clsx('min-h-screen pb-10', isDark ? 'bg-black text-white' : 'bg-[#f9fafb] text-gray-900')}
      aria-hidden
    >
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4 pt-3 space-y-4">
        <SkeletonBox isDark={isDark} className="h-14 w-full rounded-2xl max-w-4xl mx-auto" />
        <BannerSkeleton isDark={isDark} />
        <ViewToggleSkeleton isDark={isDark} />
        <SectionHeaderSkeleton isDark={isDark} />
        <ProductGridSkeleton isDark={isDark} count={10} />
      </div>
    </div>
  );
}
