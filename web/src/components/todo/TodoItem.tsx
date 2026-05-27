import type { Schedule, Category } from '../../types'
import { formatDate } from '../../lib/dateUtils'

interface Props {
  item: Schedule
  categories: Category[]
  onComplete?: (item: Schedule) => void  // 일정 뷰에서는 undefined
  onDelete: (id: string) => void
  onClick: () => void
}

export default function TodoItem({ item, categories, onComplete, onDelete, onClick }: Props) {
  const cat    = categories.find(c => c.id === item.category_id)
  const subCat = categories.find(c => c.id === item.sub_category_id)

  // Todo 만료: expire 타입이고, 마감 기한이 지났고, 완료되지 않은 경우
  const isExpired = item.is_todo
    && item.expire_type === 'expire'
    && !!item.start_at
    && new Date(item.start_at) < new Date()
    && !item.is_completed

  // 일정 종료: 종료 시각이 지난 일정
  const isPast = !item.is_todo && !!item.end_at && new Date(item.end_at) < new Date()

  const displayColor = subCat?.color ?? cat?.color ?? '#6B7280'

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-800 cursor-pointer transition-colors group
        ${item.is_completed || isPast ? 'opacity-60' : ''}
        ${isExpired ? 'border border-red-500/50' : 'border border-transparent'}
        hover:bg-gray-750`}
      onClick={onClick}
    >
      {/* 완료 체크 (Todo 전용) */}
      {onComplete && (
        <button
          onClick={e => { e.stopPropagation(); onComplete(item) }}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
            item.is_completed ? 'bg-blue-600 border-blue-600' : 'border-gray-500 hover:border-blue-500'
          }`}
        >
          {item.is_completed && (
            <span className="text-white text-xs flex items-center justify-center h-full">✓</span>
          )}
        </button>
      )}

      {/* 일정 아이콘 */}
      {!onComplete && <span className="mt-0.5 text-base flex-shrink-0">📅</span>}

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${
            item.is_completed || isPast ? 'line-through text-gray-500' : 'text-white'
          }`}>
            {item.title}
          </span>
          {isExpired && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">만료</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {(cat || subCat) && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: displayColor + '33', color: displayColor }}
            >
              {subCat?.name ?? cat?.name}
            </span>
          )}
          {item.start_at && (
            <span className="text-xs text-gray-500">
              {formatDate(item.start_at)}
              {!item.is_todo && item.end_at && ` ~ ${formatDate(item.end_at)}`}
            </span>
          )}
          <span className="text-xs text-gray-600">중요도 {item.importance}</span>
        </div>
      </div>

      {/* 삭제 버튼 (hover 시 표시) */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(item.id) }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
      >
        ✕
      </button>
    </div>
  )
}
