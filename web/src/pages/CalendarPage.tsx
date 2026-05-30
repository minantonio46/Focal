import { useState, useMemo } from 'react'
import type { Schedule } from '../types'
import useAppStore from '../stores/useAppStore'
import { updateSchedule, deleteSchedule, fetchSchedules, createException } from '../lib/api'
import { expandSchedulesForRange } from '../lib/repeatUtils'
import { getWeekDays } from '../components/calendar/calendarUtils'
import CalendarHeader      from '../components/calendar/CalendarHeader'
import MonthView           from '../components/calendar/MonthView'
import WeekView            from '../components/calendar/WeekView'
import DayView             from '../components/calendar/DayView'
import DetailModal         from '../components/modal/DetailModal'
import ScheduleFormModal   from '../components/modal/ScheduleFormModal'

export type CalView = 'month' | 'week' | 'day'

/** Date → "YYYY-MM-DD" (로컬 시각 기준) */
function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function CalendarPage() {
  const { schedules, setSchedules, categories, settings } = useAppStore()
  const [view, setView]               = useState<CalView>('month')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null)
  const [showForm, setShowForm]         = useState(false)

  const slotMins   = settings?.calendar_slot_mins ?? 60
  const timeFormat = settings?.time_format ?? '24h'

  // ─── 뷰 범위 계산 & 가상 인스턴스 확장 ─────────────────────
  const [rangeStart, rangeEnd] = useMemo((): [Date, Date] => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    if (view === 'month') {
      const dow = new Date(y, m, 1).getDay()
      const gs = new Date(y, m, 1 + (dow === 0 ? -6 : 1 - dow))
      gs.setHours(0, 0, 0, 0)
      const ge = new Date(gs)
      ge.setDate(gs.getDate() + 41)   // 6주 = 42일
      ge.setHours(23, 59, 59, 999)
      return [gs, ge]
    }
    if (view === 'week') {
      const days = getWeekDays(currentDate)
      const s = new Date(days[0]); s.setHours(0, 0, 0, 0)
      const e = new Date(days[6]); e.setHours(23, 59, 59, 999)
      return [s, e]
    }
    // day
    const s = new Date(currentDate); s.setHours(0, 0, 0, 0)
    const e = new Date(currentDate); e.setHours(23, 59, 59, 999)
    return [s, e]
  }, [view, currentDate])

  const displaySchedules = useMemo(
    () => expandSchedulesForRange(schedules, rangeStart, rangeEnd),
    [schedules, rangeStart, rangeEnd],
  )

  // ─── 날짜 네비게이션 ──────────────────────────────────────

  function handlePrev() {
    setCurrentDate(d => {
      const next = new Date(d)
      if (view === 'month') {
        // 1일로 먼저 맞춘 뒤 월 이동 (말일 overflow 방지)
        next.setDate(1)
        next.setMonth(d.getMonth() - 1)
      } else if (view === 'week') {
        next.setDate(d.getDate() - 7)
      } else {
        next.setDate(d.getDate() - 1)
      }
      return next
    })
  }

  function handleNext() {
    setCurrentDate(d => {
      const next = new Date(d)
      if (view === 'month') {
        next.setDate(1)
        next.setMonth(d.getMonth() + 1)
      } else if (view === 'week') {
        next.setDate(d.getDate() + 7)
      } else {
        next.setDate(d.getDate() + 1)
      }
      return next
    })
  }

  // ─── 드래그앤드롭 일정 이동 ───────────────────────────────

  async function handleUpdateSchedule(id: string, data: Partial<Schedule>) {
    if (id.includes('_virt_')) {
      // 가상 인스턴스 이동 → 예외 레코드 생성
      const sepIdx = id.indexOf('_virt_')
      const parentId       = id.slice(0, sepIdx)
      const occurrenceDate = id.slice(sepIdx + 6)
      const parent = schedules.find(s => s.id === parentId)
      if (!parent) return
      try {
        // id / created / updated / 런타임 필드 제외하고 전달 (PB 추동 필드 충돌 방지)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _pid, created: _c, updated: _u, _isVirtual: _iv, _occurrenceDate: _od, ...parentFields } = parent
        await createException(parentId, occurrenceDate, {
          ...parentFields,
          ...data,
          parent_id:      parentId,
          exception_date: occurrenceDate,
          repeat_type:    'none',
          repeat_days:    [],
          repeat_end_at:  '',
          repeat_count:   0,
          excluded_dates: [],
          completed_dates: [], // 예외 레코드는 단일 회차 — 완료 이력 초기화
        })
        await reloadSchedules()
      } catch (err) {
        console.error('일정 이동 실패:', err)
      }
    } else {
      try {
        const updated = await updateSchedule(id, data)
        setSchedules(schedules.map(s => s.id === id ? { ...s, ...updated } : s))
      } catch (err) {
        console.error('일정 이동 실패:', err)
      }
    }
  }

  async function handleDelete(id: string) {
    // id가 비어있으면 반복 그룹 삭제가 이미 완료된 것 → reload만
    if (!id) {
      await reloadSchedules()
      return
    }
    // 확인은 DetailModal의 ConfirmDialog에서 처리됨
    await deleteSchedule(id)
    setSchedules(schedules.filter(s => s.id !== id))
  }

  async function reloadSchedules() {
    const data = await fetchSchedules()
    setSchedules(data)
  }

  return (
    <div className="flex flex-col h-full p-4 min-h-0">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <CalendarHeader
          view={view}
          currentDate={currentDate}
          onViewChange={setView}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={() => setCurrentDate(new Date())}
          onNavigateTo={setCurrentDate}
        />
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          + 일정
        </button>
      </div>

      {/* 뷰 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === 'month' && (
          <MonthView
            schedules={displaySchedules}
            categories={categories}
            currentDate={currentDate}
            timeFormat={timeFormat}
            onSelectItem={setSelectedItem}
            onSelectDate={d => { setCurrentDate(d); setView('day') }}
          />
        )}
        {view === 'week' && (
          <WeekView
            schedules={displaySchedules}
            categories={categories}
            currentDate={currentDate}
            slotMins={slotMins}
            timeFormat={timeFormat}
            onSelectItem={setSelectedItem}
            onUpdateSchedule={handleUpdateSchedule}
            onSelectDate={d => { setCurrentDate(d); setView('day') }}
          />
        )}
        {view === 'day' && (
          <DayView
            schedules={displaySchedules}
            categories={categories}
            currentDate={currentDate}
            slotMins={slotMins}
            timeFormat={timeFormat}
            onSelectItem={setSelectedItem}
            onUpdateSchedule={handleUpdateSchedule}
          />
        )}
      </div>

      {showForm && (
        <ScheduleFormModal
          onClose={() => setShowForm(false)}
          onSave={async () => { setShowForm(false); await reloadSchedules() }}
          defaultIsTodo={false}
          defaultDate={toLocalDateStr(currentDate)}
        />
      )}

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          categories={categories}
          onClose={() => setSelectedItem(null)}
          onUpdate={async () => { setSelectedItem(null); await reloadSchedules() }}
          onDelete={async id => { await handleDelete(id); setSelectedItem(null) }}
        />
      )}
    </div>
  )
}
