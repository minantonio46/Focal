import { useState, useRef, useEffect } from 'react'
import type { Schedule, Category } from '../../types'
import {
  getWeekDays,
  getSchedulesForDay,
  layoutDayEvents,
  isToday,
  PX_PER_MIN,
  TOTAL_HEIGHT,
} from './calendarUtils'
import { VALID_REPEAT_TYPES, getRepeatTodoDisplayOccurrences } from '../../lib/priorityUtils'

interface Props {
  schedules:        Schedule[]
  categories:       Category[]
  currentDate:      Date
  slotMins:         number
  timeFormat:       '12h' | '24h'
  onSelectItem:     (item: Schedule) => void
  onUpdateSchedule: (id: string, data: Partial<Schedule>) => Promise<void>
  onSelectDate:     (date: Date) => void
}

type DragEv = {
  clientY: number
  currentTarget: EventTarget | null
  dataTransfer: DataTransfer
  preventDefault(): void
}

const HOURS     = Array.from({ length: 24 }, (_, i) => i)
const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']

function fmtTime(dateStr: string, fmt: '12h' | '24h'): string {
  return new Date(dateStr).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', hour12: fmt === '12h',
  })
}

function getNowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export default function WeekView({
  schedules,
  categories,
  currentDate,
  slotMins,
  timeFormat,
  onSelectItem,
  onUpdateSchedule,
  onSelectDate,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const dragInfo  = useRef<{ scheduleId: string; clickOffsetY: number } | null>(null)
  const days      = getWeekDays(currentDate)

  const [nowMinutes, setNowMinutes] = useState(getNowMinutes)
  useEffect(() => {
    const timer = setInterval(() => setNowMinutes(getNowMinutes()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // 초기 스크롤 위치
  useEffect(() => {
    const scrollTo = Math.max(0, nowMinutes * PX_PER_MIN - 150)
    scrollRef.current?.scrollTo({ top: scrollTo, behavior: 'instant' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 스크롤바 너비만큼 헤더 우측 패딩 보정 → 헤더-그리드 열 어긋남 방지
  useEffect(() => {
    const el     = scrollRef.current
    const header = headerRef.current
    if (!el || !header) return
    const update = () => {
      const bar = el.offsetWidth - el.clientWidth
      header.style.paddingRight = bar > 0 ? `${bar}px` : ''
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function getCategoryColor(s: Schedule): string {
    const cat = s.sub_category_id
      ? categories.find(c => c.id === s.sub_category_id)
      : categories.find(c => c.id === s.category_id)
    return cat?.color ?? '#6B7280'
  }

  function handleDragStart(e: DragEv, s: Schedule) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragInfo.current = { scheduleId: s.id, clickOffsetY: e.clientY - rect.top }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', s.id)
  }

  function handleDrop(e: DragEv, day: Date) {
    e.preventDefault()
    if (!dragInfo.current || !scrollRef.current) return
    const containerRect = scrollRef.current.getBoundingClientRect()
    const scrollTop     = scrollRef.current.scrollTop
    const yInContent    = e.clientY - containerRect.top + scrollTop
    const adjustedY     = Math.max(0, yInContent - dragInfo.current.clickOffsetY)
    const rawMin        = adjustedY / PX_PER_MIN
    const snapped       = Math.round(rawMin / slotMins) * slotMins
    const clampedMin    = Math.min(snapped, 24 * 60 - slotMins)
    const s = schedules.find(x => x.id === dragInfo.current!.scheduleId)
    if (!s) return
    const durationMs = s.end_at
      ? new Date(s.end_at).getTime() - new Date(s.start_at).getTime()
      : 60 * 60 * 1000
    const newStart = new Date(day)
    newStart.setHours(Math.floor(clampedMin / 60), clampedMin % 60, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)
    void onUpdateSchedule(s.id, {
      start_at: newStart.toISOString(),
      end_at:   newEnd.toISOString(),
    })
    dragInfo.current = null
  }

  const hasAllDay = schedules.some(s => !s.is_todo && s.is_all_day)

  const dayTodos = days.map(day => {
    const raw = getSchedulesForDay(schedules, day).filter(s => s.is_todo)
    return raw.map(s => {
      if (!VALID_REPEAT_TYPES.has(s.repeat_type)) return s
      const dateStr = [
        day.getFullYear(),
        String(day.getMonth() + 1).padStart(2, '0'),
        String(day.getDate()).padStart(2, '0'),
      ].join('-')
      const occs = getRepeatTodoDisplayOccurrences(s)
      const occ  = occs.find(o => o.dateStr === dateStr)
      if (!occ) return null
      return { ...s, is_completed: occ.isCompleted }
    }).filter((s): s is Schedule => s !== null)
  })
  const hasTodos = dayTodos.some(list => list.length > 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── 헤더 (요일 + 종일 + Todo) — ref로 스크롤바 너비 보정 */}
      <div ref={headerRef} className="flex-shrink-0">

        {/* 요일 헤더 */}
        <div className="flex border-b border-gray-700">
          <div className="w-14 flex-shrink-0" />
          {days.map((day, i) => {
            const todayCell = isToday(day)
            const isSat = i === 5
            const isSun = i === 6
            return (
              <button key={i} onClick={() => onSelectDate(day)}
                className="flex-1 text-center py-2 border-l border-gray-800 transition-colors hover:bg-gray-800/60 cursor-pointer">
                <div className={`text-xs mb-0.5 ${isSat ? 'text-blue-400' : isSun ? 'text-red-400' : 'text-gray-500'}`}>
                  {DAY_NAMES[i]}
                </div>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium
                  ${todayCell ? 'bg-blue-600 text-white' : isSat ? 'text-blue-400' : isSun ? 'text-red-400' : 'text-gray-300'}`}>
                  {day.getDate()}
                </span>
              </button>
            )
          })}
        </div>

        {/* 종일 이벤트 행 */}
        {hasAllDay && (
          <div className="flex border-b border-gray-700">
            <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2 py-1">
              <span className="text-[10px] text-gray-600">종일</span>
            </div>
            {days.map((day, i) => {
              const items = getSchedulesForDay(schedules, day).filter(s => !s.is_todo && s.is_all_day)
              return (
                <div key={i} className="flex-1 border-l border-gray-800 p-0.5 flex flex-col gap-0.5 min-h-7">
                  {items.map(s => {
                    const color = getCategoryColor(s)
                    return (
                      <button key={s.id} onClick={() => onSelectItem(s)}
                        className="w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: color + 'BB', color: '#fff' }}>
                        {s.title}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Todo 행 */}
        {hasTodos && (
          <div className="flex border-b border-gray-700">
            <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2 py-1">
              <span className="text-[10px] text-gray-600">Todo</span>
            </div>
            {dayTodos.map((todos, i) => (
              <div key={i} className="flex-1 border-l border-gray-800 p-0.5 flex flex-col gap-0.5 min-h-7">
                {todos.map(s => {
                  const color = getCategoryColor(s)
                  return (
                    <button key={s.id} onClick={() => onSelectItem(s)}
                      className="w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: color + '22', color,
                        borderLeft: `2px solid ${color}`,
                        textDecoration: s.is_completed ? 'line-through' : 'none',
                        opacity: s.is_completed ? 0.5 : 1,
                      }}>
                      ☑ {s.title}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 시간 그리드 (스크롤) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>

          {/* 시간 레이블 */}
          <div className="w-14 flex-shrink-0 relative select-none">
            {HOURS.map(h =>
              h > 0 ? (
                <div key={h} className="absolute right-2 text-[11px] text-gray-600"
                  style={{ top: h * 60 * PX_PER_MIN - 8 }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ) : null
            )}
          </div>

          {/* 요일 컬럼 */}
          {days.map((day, dayIdx) => {
            const layouts  = layoutDayEvents(schedules, day)
            const todayCol = isToday(day)
            return (
              <div key={dayIdx}
                className={`flex-1 relative border-l border-gray-800 ${todayCol ? 'bg-blue-950/10' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, day)}
              >
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-gray-800 pointer-events-none"
                    style={{ top: h * 60 * PX_PER_MIN }} />
                ))}
                {Array.from({ length: Math.floor((24 * 60) / slotMins) }, (_, i) => {
                  const m = i * slotMins
                  if (m % 60 === 0) return null
                  return (
                    <div key={i} className="absolute w-full border-t border-gray-800/40 pointer-events-none"
                      style={{ top: m * PX_PER_MIN }} />
                  )
                })}
                {todayCol && (
                  <div className="absolute w-full z-10 pointer-events-none"
                    style={{ top: nowMinutes * PX_PER_MIN }}>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
                  </div>
                )}
                {layouts.map(layout => {
                  const color  = getCategoryColor(layout.schedule)
                  const GAP    = 2
                  const leftPx = (layout.col / layout.colCount) * 100
                  const wPct   = (1 / layout.colCount) * 100
                  return (
                    <div key={layout.schedule.id}
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
                      <div className="px-1.5 py-0.5">
                        <div className="text-[11px] font-medium leading-tight truncate">
                          {layout.schedule.title}
                        </div>
                        {layout.height >= 36 && layout.schedule.start_at && (
                          <div className="text-[10px] opacity-70 leading-tight">
                            {fmtTime(layout.schedule.start_at, timeFormat)}
                            {layout.schedule.end_at && ` ~ ${fmtTime(layout.schedule.end_at, timeFormat)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
