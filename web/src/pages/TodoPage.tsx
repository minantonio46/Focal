import { useEffect, useState } from 'react'
import { fetchSchedules, updateSchedule, deleteSchedule } from '../lib/api'
import type { Schedule } from '../types'
import useAppStore from '../stores/useAppStore'
import TodoItem from '../components/todo/TodoItem'
import ScheduleFormModal from '../components/modal/ScheduleFormModal'
import DetailModal from '../components/modal/DetailModal'

type FilterType = 'incomplete' | 'complete' | 'all'
type SortType = 'time' | 'score'

export default function TodoPage() {
  const { schedules, setSchedules, categories } = useAppStore()
  const [filter, setFilter] = useState<FilterType>('incomplete')
  const [sort, setSort] = useState<SortType>('time')
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSchedules()
  }, [])

  async function loadSchedules() {
    setIsLoading(true)
    try {
      const data = await fetchSchedules()
      setSchedules(data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleComplete(item: Schedule) {
    const updated = await updateSchedule(item.id, {
      is_completed: !item.is_completed,
      completed_at: !item.is_completed ? new Date().toISOString() : '',
    })
    setSchedules(schedules.map(s => s.id === updated.id ? updated : s))
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await deleteSchedule(id)
    setSchedules(schedules.filter(s => s.id !== id))
  }

  const todos = schedules.filter(s => s.is_todo)

  const filtered = todos.filter(s => {
    if (filter === 'incomplete') return !s.is_completed
    if (filter === 'complete') return s.is_completed
    return true
  })

  const urgencyScore = (s: Schedule) => {
    if (!s.start_at) return 1
    const diff = new Date(s.start_at).getTime() - Date.now()
    const days = diff / (1000 * 60 * 60 * 24)
    if (days <= 1) return 10
    if (days <= 7) return 7
    if (days <= 30) return 5
    return 1
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'score') {
      return (b.importance * urgencyScore(b)) - (a.importance * urgencyScore(a))
    }
    if (a.start_at && !b.start_at) return -1
    if (!a.start_at && b.start_at) return 1
    if (a.start_at && b.start_at) return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    return 0
  })

  const withDeadline = sort === 'time' ? sorted.filter(s => s.start_at) : sorted
  const withoutDeadline = sort === 'time' ? sorted.filter(s => !s.start_at) : []

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Todo 목록</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          + 추가
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['incomplete', 'complete', 'all'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f === 'incomplete' ? '미완료' : f === 'complete' ? '완료' : '전체'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['time', 'score'] as SortType[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                sort === s ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s === 'time' ? '시간순' : '점수순'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm py-8 text-center">불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">항목이 없습니다</div>
      ) : (
        <div className="flex flex-col gap-2">
          {withDeadline.map(item => (
            <TodoItem
              key={item.id}
              item={item}
              categories={categories}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onClick={() => setSelectedItem(item)}
            />
          ))}
          {withoutDeadline.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-500">기한 없음</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
              {withoutDeadline.map(item => (
                <TodoItem
                  key={item.id}
                  item={item}
                  categories={categories}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {showForm && (
        <ScheduleFormModal
          onClose={() => setShowForm(false)}
          onSave={async () => {
            setShowForm(false)
            await loadSchedules()
          }}
          defaultIsTodo={true}
        />
      )}

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          categories={categories}
          onClose={() => setSelectedItem(null)}
          onUpdate={async () => {
            setSelectedItem(null)
            await loadSchedules()
          }}
          onDelete={async (id) => {
            await handleDelete(id)
            setSelectedItem(null)
          }}
        />
      )}
    </div>
  )
}
