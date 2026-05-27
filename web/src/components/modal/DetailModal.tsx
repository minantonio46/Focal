import { useState } from 'react'
import type { Schedule, Category } from '../../types'
import ScheduleFormModal from './ScheduleFormModal'

interface Props {
  item: Schedule
  categories: Category[]
  onClose: () => void
  onUpdate: () => void
  onDelete: (id: string) => void
}

export default function DetailModal({ item, categories, onClose, onUpdate, onDelete }: Props) {
  const [showEdit, setShowEdit] = useState(false)

  const cat = categories.find(c => c.id === item.category_id)
  const subCat = categories.find(c => c.id === item.sub_category_id)

  const isExpired = item.expire_type === 'expire' && item.start_at
    && new Date(item.start_at) < new Date() && !item.is_completed

  if (showEdit) {
    return (
      <ScheduleFormModal
        editItem={item}
        onClose={() => setShowEdit(false)}
        onSave={() => { setShowEdit(false); onUpdate() }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {item.is_todo ? 'Todo' : '일정'}
            </span>
            {isExpired && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">만료</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <h3 className={`text-lg font-semibold ${item.is_completed ? 'line-through text-gray-500' : ''}`}>
            {item.title}
          </h3>

          {(cat || subCat) && (
            <div className="flex items-center gap-2">
              {cat && (
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: cat.color + '33', color: cat.color }}>
                  {cat.name}
                </span>
              )}
              {subCat && (
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: subCat.color + '33', color: subCat.color }}>
                  {subCat.name}
                </span>
              )}
            </div>
          )}

          {item.start_at && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>🕐</span>
              <span>
                {new Date(item.start_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
                {!item.is_todo && item.end_at && ` ~ ${new Date(item.end_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>⭐</span>
            <span>중요도 {item.importance.toFixed(1)}</span>
          </div>

          {item.location && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>📍</span>
              <span>{item.location}</span>
            </div>
          )}

          {item.description && (
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300 whitespace-pre-wrap">
              {item.description}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={() => onDelete(item.id)}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
          >
            삭제
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            편집
          </button>
        </div>
      </div>
    </div>
  )
}
