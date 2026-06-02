/**
 * 로딩 스켈레톤 컴포넌트
 * 사용 예:
 *   <SkeletonList rows={5} />
 *   <SkeletonBlock className="h-40 w-full rounded-xl" />
 */

interface SkeletonBlockProps {
  className?: string
}

export function SkeletonBlock({ className = 'h-10 w-full rounded-lg' }: SkeletonBlockProps) {
  return (
    <div className={`bg-gray-800 animate-pulse ${className}`} />
  )
}

interface SkeletonListProps {
  rows?: number
}

export function SkeletonList({ rows = 4 }: SkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-900 rounded-xl">
          <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock className={`h-3.5 rounded ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
            <SkeletonBlock className="h-2.5 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
