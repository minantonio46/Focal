import { useState, useRef, useEffect } from 'react'
import type { Schedule, Category } from '../../types'
import {
  getSchedulesForDay,
  layoutDayEvents,
  isToday,
  PX_PER_MIN,
  TOTAL_HEIGHT,
} from './calendarUtils'

interface Props {
  schedules:        Schedule[]
  categories:       Category[]
  currentDate:      Date
  slotMins:         number
  timeFormat:       '12h' | '24h'
  onSelectItem:     (item: Schedule) => void
  onUpdateSchedule: (id: string, data: Partial<Schedule>) => Promise<void>
}

type DragEv = {
  clientY: number
  currentTarget: EventTarget | null
  dataTransfer: DataTransfer
  preventDefault(): void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function fmtTime(dateStr: string, fmt: '12h' | '24h'): string {
  return new Date(dateStr).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: fmt === '12h',
  })
}

function getNowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export default function DayView({
  schedules,
  categories,
  currentDate,
  slotMins,
  timeFormat,
  onSelectItem,
  onUpdateSchedule,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragInfo  = useRef<{ scheduleId: string; clickOffsetY: number } | null>(null)
  const todayView  = isToday(currentDate)

  // ─── 실시간 현재 시각 선 ─────────────────────────────────
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes)
  useEffect(() => {
    const timer = setInterval(() => setNowMinutes(getNowMinutes()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const scrollTo = Math.max(0, nowMinutes * PX_PER_MIN - 150)
    scrollRef.current?.scrollTo({ top: scrollTo, behavior: 'instant' })
  // 마운트 시 한 번만 스크롤
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getCategoryColor(s: Schedule): string {
    const cat = s.sub_category_id
      ? categories.find(c => c.id === s.sub_category_id)
      : categories.find(c => c.id === s.category_id)
    return cat?.color ?? '#6B7280'
  }

  const daySchedules = getSchedulesForDay(schedules, currentDate)
  const allDayEvents = daySchedules.filter(s => !s.is_todo && s.is_all_day)
  const todos        = daySchedules.filter(s => s.is_todo)
  const layouts      = layoutDayEvents(schedules, currentDate)

  // ─── Drag & Drop ─────────────────────────────────────────

  function handleDragStart(e: DragEv, s: Schedule) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragInfo.current = { scheduleId: s.id, clickOffsetY: e.clientY - rect.top }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', s.id)
  }

  function handleDrop(e: DragEv) {
    e.preventDefault()
    if (!dragInfo.current || !scrollRef.current) return

    const containerRect = scrollRef.current.getBoundingClientRect()
    const scrollTop     = scrollRef.current.scrollTop
    const yInContent    = e.clientY - containerRect.top + scrollTop
    const adjustedY     = Math.max(0, yInContent - dragInfo.current.clickOffsetY)

    const rawMin     = adjustedY / PX_PER_MIN
    const snapped    = Math.round(rawMin / slotMins) * slotMins
    const clampedMin = Math.min(snapped, 24 * 60 - slotMins)

    const s = schedules.find(x => x.id === dragInfo.current!.scheduleId)
    if (!s) return

    const durationMs = s.end_at
      ? new Date(s.end_at).getTime() - new Date(s.start_at).getTime()
      : 60 * 60 * 1000

    const newStart = new Date(currentDate)
    newStart.setHours(Math.floor(clampedMin / 60), clampedMin % 60, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)

    void onUpdateSchedule(s.id, {
      start_at: newStart.toISOString(),
      end_at:   newEnd.toISOString(),
    })
    dragInfo.current = null
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── 종일 이벤트 ──────────────────────────────────── */}
      {allDayEvents.length > 0 && (
        <div className="flex-shrink-0 border-b border-gray-700 px-4 py-1.5 flex flex-wrap gap-1 items-center">
          <span className="text-[11px] text-gray-600 mr-1">종일</span>
          {allDayEvents.map(s => {
            const color = getCategoryColor(s)
            return (
              <button
                key={s.id}
                onClick={() => onSelectItem(s)}
                className="text-[11px] px-2 py-0.5 rounded truncate max-w-[200px] hover:opacity-80 transition-opacity"
                style={{ backgroundColor: color + 'BB', color: '#fff' }}
              >
                {s.title}
              </button>
            )
          })}
        </div>
      )}

      {/* ── 시간 그리드 ──────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="relative flex"
          style={{ height: TOTAL_HEIGHT }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          {/* 시간 레이블 */}
          <div className="w-14 flex-shrink-0 relative select-none">
            {HOURS.map(h =>
              h > 0 ? (
                <div
                  key={h}
                  className="absolute right-2 text-[11px] text-gray-600"
                  style={{ top: h * 60 * PX_PER_MIN - 8 }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ) : null
            )}
          </div>

          {/* 단일 일 컬럼 */}
          <div className="flex-1 relative border-l border-gray-800">

            {/* 정각 선 */}
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute w-full border-t border-gray-800 pointer-events-none"
                style={{ top: h * 60 * PX_PER_MIN }}
              />
            ))}

            {/* 슬롯 선 */}
            {Array.from({ length: Math.floor((24 * 60) / slotMins) }, (_, i) => {
              const m = i * slotMins
              if (m % 60 === 0) return null
              return (
                <div
                  key={i}
                  className="absolute w-full border-t border-gray-800/40 pointer-events-none"
                  style={{ top: m * PX_PER_MIN }}
                />
              )
            })}

            {/* 현재 시각 선 */}
            {todayView && (
              <div
                className="absolute w-full z-10 pointer-events-none"
                style={{ top: nowMinutes * PX_PER_MIN }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
                  <div className="flex-1 h-px bg-red-500" />
                </div>
              </div>
            )}

            {/* 이벤트 블록 */}
            {layouts.map(layout => {
              const color  = getCategoryColor(layout.schedule)
              const GAP    = 6
              const leftPx = (layout.col / layout.colCount) * 100
              const wPct   = (1 / layout.colCount) * 100

              return (
                <div
                  key={layout.schedule.id}
                  draggable
                  onDragStart={e => handleDragStart(e, layout.schedule)}
                  onClick={() => onSelectItem(layout.schedule)}
                  title={layout.schedule.title}
                  className="absolute rounded overflow-hidden select-none cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity z-[5]"
                  style={{
                    top:             layout.top,
                    height:          layout.height,
                    left:            `calc(${leftPx}% + ${GAP}px)`,
                    width:           `calc(${wPct}% - ${GAP * 2}px)`,
                    backgroundColor: color + '30',
                    borderLeft:      `3px solid ${color}`,
                    color,
                  }}
                >
                  <div className="px-2 py-1">
                    <div className="text-sm font-medium leading-tight truncate">
                      {layout.schedule.title}
                    </div>
                    {layout.height >= 40 && layout.schedule.start_at && (
                      <div className="text-xs opacity-70 leading-tight mt-0.5">
                        {fmtTime(layout.schedule.start_at, timeFormat)}
                        {layout.schedule.end_at && ` ~ ${fmtTime(layout.schedule.end_at, timeFormat)}`}
                      </div>
                    )}
                    {layout.height >= 60 && layout.schedule.location && (
                      <div className="text-xs opacity-60 leading-tight mt-0.5 truncate">
                        📍 {layout.schedule.location}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Todo 섹션 ─────────────────────────────────────── */}
      {todos.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-700 max-h-48 overflow-y-auto">
          <div className="px-4 pt-2 pb-3">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              오늘의 Todo ({todos.filter(s => !s.is_completed).length}개 미완료)
            </div>
            <div className="flex flex-col gap-1">
              {todos.map(s => {
                const color = getCategoryColor(s)
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelectItem(s)}
                    className="flex items-center gap-2 text-left hover:bg-gray-800 rounded-lg px-2 py-1.5 transition-colors w-full group"
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                      ${s.is_completed ? 'bg-blue-600 border-blue-600' : 'border-gray-500 group-hover:border-blue-400'}`}
                    >
                      {s.is_completed && <span className="text-white text-[9px]">✓</span>}
                    </div>
                    <span
                      className={`text-sm flex-1 truncate ${s.is_completed ? 'line-through text-gray-500' : ''}`}
                      style={{ color: s.is_completed ? undefined : color }}
                    >
                      {s.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
