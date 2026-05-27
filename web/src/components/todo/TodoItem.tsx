import type { Schedule, Category } from '../../types'

interface Props {
  item: Schedule
  categories: Category[]
  onComplete: (item: Schedule) => void
  onDelete: (id: string) => void
  onClick: () => void
}

export default function TodoItem({ item, categories, onComplete, onDelete, onClick }: Props) {
  const cat = categories.find(c => c.id === item.category_id)
  const subCat = categories.find(c => c.id === item.sub_category_id)

  const isExpired = item.expire_type === 'expire' && item.start_at
    && new Date(item.start_at) < new Date() && !item.is_completed

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-750 cursor-pointer transition-colors group ${
        item.is_completed ? 'opacity-60' : ''
      } ${isExpired ? 'border border-red-500/50' : ''}`}
      onClick={onClick}
    >
      <button
        onClick={e => { e.stopPropagation(); onComplete(item) }}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
          item.is_completed
            ? 'bg-blue-600 border-blue-600'
            : 'border-gray-500 hover:border-blue-500'
        }`}
      >
        {item.is_completed && <span className="text-white text-xs flex items-center justify-center h-full">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${item.is_completed ? 'line-through text-gray-500' : 'text-white'}`}>
            {item.title}
          </span>
          {isExpired && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">만료</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {(cat || subCat) && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: (subCat?.color ?? cat?.color ?? '#6B7280') + '33', color: subCat?.color ?? cat?.color ?? '#6B7280' }}
            >
              {subCat?.name ?? cat?.name}
            </span>
          )}
          {item.start_at && (
            <span className="text-xs text-gray-500">
              {new Date(item.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className="text-xs text-gray-600">중요도 {item.importance}</span>
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(item.id) }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
