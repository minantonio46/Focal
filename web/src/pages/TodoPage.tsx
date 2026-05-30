import { useEffect, useState } from 'react'
import { fetchSchedules, updateSchedule, deleteSchedule, completeTodoOccurrence, uncompleteTodoOccurrence } from '../lib/api'
import type { Schedule } from '../types'
import useAppStore from '../stores/useAppStore'
import TodoItem from '../components/todo/TodoItem'
import ScheduleFormModal from '../components/modal/ScheduleFormModal'
import DetailModal from '../components/modal/DetailModal'
import ConfirmDialog from '../components/modal/ConfirmDialog'
import { getRepeatTodoDisplayOccurrences, VALID_REPEAT_TYPES, urgencyScore } from '../lib/priorityUtils'

type FilterType = 'incomplete' | 'complete' | 'all'
type SortType = 'time' | 'score'
type ViewType = 'todo' | 'schedule'

export default function TodoPage() {
  const { schedules, setSchedules, categories } = useAppStore()
  const [filter, setFilter] = useState<FilterType>('incomplete')
  const [sort, setSort] = useState<SortType>('time')
  const [view, setView] = useState<ViewType>('todo')
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
    // 반복 Todo: 회차별 완료 처리
    if (item.is_todo && VALID_REPEAT_TYPES.has(item.repeat_type)) {
      // _occurrenceDate(가상 인스턴스) 또는 start_at 기준 날짜
      const occDate = item._occurrenceDate
        ?? (item.start_at ? item.start_at.slice(0, 10) : '')
      if (!occDate) return
      const parentId = item.parent_id || item.id
      const completedSet = new Set(item.completed_dates ?? [])
      let updated: Schedule
      if (completedSet.has(occDate)) {
        updated = await uncompleteTodoOccurrence(parentId, occDate)
      } else {
        updated = await completeTodoOccurrence(parentId, occDate)
      }
      setSchedules(schedules.map(s => s.id === updated.id ? updated : s))
      return
    }
    // 비반복 Todo
    const updated = await updateSchedule(item.id, {
      is_completed: !item.is_completed,
      completed_at: !item.is_completed ? new Date().toISOString() : '',
    })
    setSchedules(schedules.map(s => s.id === updated.id ? updated : s))
  }

  // 실제 삭제 (확인이 이미 완료된 경우)
  async function executeDelete(id: string) {
    if (!id) {
      await loadSchedules()
      return
    }
    await deleteSchedule(id)
    setSchedules(schedules.filter(s => s.id !== id))
  }

  // TodoItem 호버 ✕ 버튼: ConfirmDialog 먼저 표시
  function handleTodoItemDelete(id: string) {
    if (id) setConfirmDeleteId(id)
  }

  const items = schedules.filter(s => view === 'todo' ? s.is_todo : !s.is_todo)

  // 반복 Todo를 회차별 가상 아이템으로 펼쳐서 목록 생성
  // (비반복 + 일정은 그대로, 반복 Todo만 회차 표시)
  const expandedItems: (Schedule & { _repeatOccDate?: string; _repeatIsCompleted?: boolean })[] = []
  for (const s of items) {
    if (s.is_todo && VALID_REPEAT_TYPES.has(s.repeat_type)) {
      const occs = getRepeatTodoDisplayOccurrences(s)
      for (const occ of occs) {
        expandedItems.push({
          ...s,
          // 회차의 start_at으로 덜려서 정렬/긴급도 계산에 사용
          start_at: new Date(occ.occMs).toISOString(),
          // 완료 상태는 회차 기준
          is_completed: occ.isCompleted,
          _occurrenceDate: occ.dateStr,
          _repeatOccDate: occ.dateStr,
          _repeatIsCompleted: occ.isCompleted,
        })
      }
    } else {
      expandedItems.push(s)
    }
  }

  const filtered = view === 'todo'
    ? expandedItems.filter(s => {
        if (filter === 'incomplete') return !s.is_completed
        if (filter === 'complete') return s.is_completed
        return true
      })
    : expandedItems

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'score') {
      return (b.importance * urgencyScore(b)) - (a.importance * urgencyScore(a))
    }
    if (a.start_at && !b.start_at) return -1
    if (!a.start_at && b.start_at) return 1
    if (a.start_at && b.start_at) return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    return 0
  })

  const withDeadline    = sort === 'time' && view === 'todo' ? sorted.filter(s => s.start_at)  : sorted
  const withoutDeadline = sort === 'time' && view === 'todo' ? sorted.filter(s => !s.start_at) : []

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">목록</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          + {view === 'todo' ? 'Todo' : '일정'}
        </button>
      </div>

      {/* Todo / 일정 뷰 전환 */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit mb-4">
        {(['todo', 'schedule'] as ViewType[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              view === v ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {v === 'todo' ? 'Todo' : '일정'}
          </button>
        ))}
      </div>

      {/* 필터 & 정렬 */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {view === 'todo' && (
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
        )}
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

      {/* 목록 */}
      {isLoading ? (
        <div className="text-gray-500 text-sm py-8 text-center">불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">항목이 없습니다</div>
      ) : (
        <div className="flex flex-col gap-2">
          {withDeadline.map(item => (
            <TodoItem
              key={`${item.id}_${item._repeatOccDate ?? 'base'}`}
              item={item}
              categories={categories}
              onComplete={view === 'todo' ? handleComplete : undefined}
              onDelete={handleTodoItemDelete}
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
                  key={`${item.id}_${item._repeatOccDate ?? 'base'}`}
                  item={item}
                  categories={categories}
                  onComplete={view === 'todo' ? handleComplete : undefined}
                  onDelete={handleTodoItemDelete}
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
          defaultIsTodo={view === 'todo'}
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
            // DetailModal이 이미 ConfirmDialog로 확인함 → 바로 실행
            setSelectedItem(null)
            await executeDelete(id)
          }}
        />
      )}

      {/* TodoItem 호버 삭제 확인 다이얼로그 */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="삭제"
          message="이 항목을 삭제하시겠습니까?"
          confirmLabel="삭제"
          onConfirm={async () => {
            const id = confirmDeleteId
            setConfirmDeleteId(null)
            await executeDelete(id)
          }}
          onClose={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
