import { useState } from 'react'
import type { Schedule } from '../types'
import useAppStore from '../stores/useAppStore'
import { updateSchedule, deleteSchedule, fetchSchedules } from '../lib/api'
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
    try {
      const updated = await updateSchedule(id, data)
      setSchedules(schedules.map(s => s.id === id ? { ...s, ...updated } : s))
    } catch (err) {
      console.error('일정 이동 실패:', err)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
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
            schedules={schedules}
            categories={categories}
            currentDate={currentDate}
            timeFormat={timeFormat}
            onSelectItem={setSelectedItem}
            onSelectDate={d => { setCurrentDate(d); setView('day') }}
          />
        )}
        {view === 'week' && (
          <WeekView
            schedules={schedules}
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
            schedules={schedules}
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
