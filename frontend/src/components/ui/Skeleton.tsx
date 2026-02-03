// Skeleton loading components
import { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className = '', shimmer = true }: SkeletonProps) {
  return (
    <div className={`${shimmer ? 'skeleton-shimmer' : 'skeleton'} ${className}`} />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-4 space-y-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-10 w-16 rounded-lg" />
      </div>
      <SkeletonText lines={2} />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 border-b border-dark-700 ${className}`}>
      <Skeleton className="h-8 w-8 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg" />
      <Skeleton className="h-8 w-12 rounded-lg" />
    </div>
  );
}

export function SkeletonStats({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// Loading wrapper that shows skeleton while loading
export function LoadingContainer({ 
  loading, 
  skeleton, 
  children 
}: { 
  loading: boolean; 
  skeleton: ReactNode; 
  children: ReactNode;
}) {
  if (loading) return <>{skeleton}</>;
  return <>{children}</>;
}
