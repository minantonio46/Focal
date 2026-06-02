import { useEffect, useState } from 'react'
import { fetchSchedules, updateSchedule, deleteSchedule, completeTodoOccurrence, uncompleteTodoOccurrence } from '../lib/api'
import type { Schedule } from '../types'
import useAppStore from '../stores/useAppStore'
import TodoItem from '../components/todo/TodoItem'
import ScheduleFormModal from '../components/modal/ScheduleFormModal'
import DetailModal from '../components/modal/DetailModal'
import ConfirmDialog from '../components/modal/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import { SkeletonList } from '../components/common/Skeleton'
import { getRepeatTodoDisplayOccurrences, VALID_REPEAT_TYPES } from '../lib/priorityUtils'
import { isRepeatEnded } from '../lib/repeatUtils'

type FilterType = 'incomplete' | 'complete' | 'upcoming' | 'past' | 'all'
type ViewType = 'todo' | 'schedule'

export default function TodoPage() {
  const { schedules, setSchedules, categories } = useAppStore()
  const [filter, setFilter] = useState<FilterType>('incomplete')
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
        if (filter === 'complete')   return s.is_completed
        return true
      })
    : expandedItems.filter(s => {
        const now = new Date()
        const isRepeat = VALID_REPEAT_TYPES.has(s.repeat_type)
        // 반복 일정은 마지막 회차까지 지난 경우만 지난 일정
        // 일반 일정은 end_at 기준 (end_at 없으면 항상 예정)
        const isPastItem = isRepeat
          ? isRepeatEnded(s)
          : s.end_at ? new Date(s.end_at) < now : false
        if (filter === 'upcoming') return !isPastItem
        if (filter === 'past')     return isPastItem
        return true
      })

  // 반복 일정은 다음 회차 날짜 기준으로 정렬
  function getSortDate(s: Schedule & { _repeatOccDate?: string }): number {
    if (VALID_REPEAT_TYPES.has(s.repeat_type) && !s._repeatOccDate) {
      // 반복 부모 레코드: 다음 회차 날짜 계산
      const now = new Date()
      const nowStr = now.toISOString().slice(0, 10)
      const excluded = new Set(s.excluded_dates ?? [])
      const maxDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 3)
      const endAt = s.repeat_end_at ? new Date(s.repeat_end_at) : maxDate
      const maxCount = s.repeat_count && s.repeat_count > 0 ? s.repeat_count : Infinity
      let cur = new Date(s.start_at)
      let count = 1
      while (cur <= endAt && cur <= maxDate && count <= maxCount) {
        const ds = cur.toISOString().slice(0, 10)
        if (!excluded.has(ds) && ds >= nowStr) return cur.getTime()
        // 다음 회차로
        const n = new Date(cur)
        if (s.repeat_type === 'daily') { n.setDate(n.getDate() + 1) }
        else if (s.repeat_type === 'weekly') {
          if (s.repeat_days?.length) {
            const sorted2 = [...s.repeat_days].sort((a, b) => a - b)
            const dow = n.getDay()
            const nextDow = sorted2.find(d => d > dow)
            n.setDate(n.getDate() + (nextDow !== undefined ? nextDow - dow : 7 - dow + sorted2[0]))
          } else { n.setDate(n.getDate() + 7) }
        }
        else if (s.repeat_type === 'monthly') {
          const origDay = new Date(s.start_at).getDate()
          n.setDate(1); n.setMonth(n.getMonth() + 1)
          n.setDate(Math.min(origDay, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()))
        }
        else if (s.repeat_type === 'yearly') {
          const origDay = new Date(s.start_at).getDate()
          n.setDate(1); n.setFullYear(n.getFullYear() + 1)
          n.setDate(Math.min(origDay, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()))
        }
        if (n.getTime() <= cur.getTime()) break
        cur = n; count++
      }
      // 다음 회차 없으면 원본 start_at 사용
      return s.start_at ? new Date(s.start_at).getTime() : Infinity
    }
    return s.start_at ? new Date(s.start_at).getTime() : Infinity
  }

  const sorted = [...filtered].sort((a, b) => {
    // Todo 탭: 유지 초과(0) → 일반(1) → 기한없음(2) → 만료 초과(3)
    if (view === 'todo') {
      const now = new Date()
      const getGroup = (s: Schedule) => {
        const overdue = s.is_todo && !!s.start_at && new Date(s.start_at) < now
        if (overdue && s.expire_type === 'keep')   return 0
        if (overdue && s.expire_type === 'expire') return 3
        if (!s.start_at)                           return 2
        return 1
      }
      const ag = getGroup(a), bg = getGroup(b)
      if (ag !== bg) return ag - bg
    }
    const aTime = getSortDate(a)
    const bTime = getSortDate(b)
    if (aTime === Infinity && bTime !== Infinity) return 1
    if (aTime !== Infinity && bTime === Infinity) return -1
    return aTime - bTime
  })

  const now    = new Date()
  const nowStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  function isExpiredItem(s: Schedule): boolean {
    return s.is_todo && s.expire_type === 'expire' && !!s.start_at && new Date(s.start_at) < now
  }

  // available_from 기준으로 미시작/시작가능 분리
  function isNotYetAvailable(s: Schedule): boolean {
    if (!s.is_todo || !s.available_from) return false
    return s.available_from.slice(0, 10) > nowStr
  }

  const withDeadline    = view === 'todo' ? sorted.filter(s => s.start_at && !isExpiredItem(s) && !isNotYetAvailable(s)) : sorted
  const withoutDeadline = view === 'todo' ? sorted.filter(s => !s.start_at && !isNotYetAvailable(s)) : []
  const expiredItems    = view === 'todo' ? sorted.filter(s => isExpiredItem(s)) : []
  const notYetItems     = view === 'todo' ? sorted.filter(s => isNotYetAvailable(s)) : []

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 고정 영역: 헤더 + 탭 */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">목록</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            + {view === 'todo' ? 'Todo' : '일정'}
          </button>
        </div>
        {/* Todo / 일정 + 필터 한 줄 */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['todo', 'schedule'] as ViewType[]).map(v => (
              <button key={v}
                onClick={() => { setView(v); setFilter(v === 'todo' ? 'incomplete' : 'upcoming') }}
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                  view === v ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {v === 'todo' ? 'Todo' : '일정'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(view === 'todo'
              ? (['incomplete', 'complete', 'all'] as const)
              : (['upcoming', 'past', 'all'] as const)
            ).map(f => (
              <button key={f} onClick={() => setFilter(f as FilterType)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {f === 'incomplete' ? '미완료' : f === 'complete' ? '완료' :
                 f === 'upcoming'  ? '예정'   : f === 'past'     ? '지난' : '전체'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 스크롤 영역: 목록 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
      {isLoading ? (
        <SkeletonList rows={5} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={view === 'todo' ? '☑️' : '📅'}
          title={
            view === 'schedule'
              ? (filter === 'upcoming' ? '예정된 일정이 없습니다' : filter === 'past' ? '지난 일정이 없습니다' : '일정이 없습니다')
              : (filter === 'complete' ? '완료한 일이 없습니다' : filter === 'incomplete' ? '할 일이 없습니다' : 'Todo가 없습니다')
          }
          description={
            view === 'schedule'
              ? (filter === 'upcoming' ? '새 일정을 추가해 보세요' : '과거 일정이 없습니다' )
              : (filter === 'complete' ? '완료 체크한 Todo가 없습니다' : '새 Todo를 추가해 보세요')
          }
        />
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
          {notYetItems.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-500">미시작</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
              {notYetItems.map(item => (
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
          {expiredItems.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-500">만료</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
              {expiredItems.map(item => (
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
    </div>
  )
}
