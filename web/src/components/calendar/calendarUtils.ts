import type { Schedule } from '../../types'

export const PX_PER_MIN = 1
export const TOTAL_HEIGHT = 1440

// ─── 날짜 유틸 ────────────────────────────────────────────

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function getWeekDays(date: Date): Date[] {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  const dayOfWeek = firstDay.getDay()
  const startOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const start = new Date(year, month, 1 + startOffset)
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      return date
    })
  )
}

export function getSchedulesForDay(schedules: Schedule[], date: Date): Schedule[] {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999)
  return schedules.filter(s => {
    if (!s.start_at) return false
    const start = new Date(s.start_at)
    if (s.is_todo) return start >= dayStart && start <= dayEnd
    const end = s.end_at ? new Date(s.end_at) : start
    return start <= dayEnd && end >= dayStart
  })
}

// ─── 주차 계산 ────────────────────────────────────────────
//
// 규칙: 월요일이 속한 달 기준으로 주차 표시
//   - 헤더: 월요일의 달 → "4월 5주차" (April 27 week)
//   - 월 드롭다운: 해당 달에 날짜가 하나라도 있는 주 포함
//     → "5월 1주차"도 드롭다운에 존재 (April 27로 이동)
// 결과: "4월 5주차"와 "5월 1주차"가 각각 독립적으로 존재

function getMondayOf(date: Date): Date {
  const day = date.getDay()
  const mon = new Date(date)
  mon.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0, 0, 0, 0)
  return mon
}

// 해당 달의 1주차 월요일 (= 1일을 포함하는 주의 월요일)
function getWeek1Monday(year: number, month: number): Date {
  return getMondayOf(new Date(year, month, 1))
}

/**
 * 주간 뷰 헤더 표시용: 월요일이 속한 달 기준으로 연/월/주차 반환
 * 예) April 27 week → { year:2026, month:3(Apr), weekNum:5 }  "4월 5주차"
 */
export function getWeekDisplayInfo(date: Date): { year: number; month: number; weekNum: number } {
  const monday  = getMondayOf(date)
  const year    = monday.getFullYear()
  const month   = monday.getMonth()
  const w1Mon   = getWeek1Monday(year, month)
  const weekNum = Math.round((monday.getTime() - w1Mon.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return { year, month, weekNum }
}

/**
 * 특정 연/월의 주차 목록
 * 해당 달에 날이 하나라도 포함된 주를 모두 포함
 * 예) May 2026 → [1,2,3,4,5]  (1주차 = April 27~May 3 포함)
 */
export function getWeeksInMonth(year: number, month: number): number[] {
  const w1Mon = getWeek1Monday(year, month)
  const weeks: number[] = []
  for (let wn = 1; wn <= 6; wn++) {
    const monday = new Date(w1Mon)
    monday.setDate(w1Mon.getDate() + (wn - 1) * 7)
    const hasDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d
    }).some(d => d.getMonth() === month && d.getFullYear() === year)
    if (!hasDays) break
    weeks.push(wn)
  }
  return weeks
}

/** 특정 연/월/주차의 월요일 반환 */
export function getMondayOfWeek(year: number, month: number, weekNum: number): Date {
  const w1Mon = getWeek1Monday(year, month)
  const result = new Date(w1Mon)
  result.setDate(w1Mon.getDate() + (weekNum - 1) * 7)
  return result
}

// ─── 시간 그리드 레이아웃 ──────────────────────────────────

export function getMinuteOfDay(dateStr: string): number {
  const d = new Date(dateStr)
  return d.getHours() * 60 + d.getMinutes()
}

export function clipEventToDay(
  schedule: Schedule,
  day: Date
): { startMin: number; endMin: number } | null {
  if (!schedule.start_at || schedule.is_todo || schedule.is_all_day) return null
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999)
  const start = new Date(schedule.start_at)
  const end   = schedule.end_at
    ? new Date(schedule.end_at)
    : new Date(start.getTime() + 60 * 60 * 1000)
  if (start > dayEnd || end < dayStart) return null
  const clampedStart = start < dayStart ? dayStart : start
  const clampedEnd   = end   > dayEnd   ? dayEnd   : end
  const startMin  = clampedStart.getHours() * 60 + clampedStart.getMinutes()
  const rawEndMin = clampedEnd.getHours()   * 60 + clampedEnd.getMinutes()
  const endMin    = rawEndMin === 0 && end > dayStart ? 1439 : rawEndMin
  return { startMin, endMin: Math.max(endMin, startMin + 15) }
}

export interface EventLayout {
  schedule: Schedule
  col: number
  colCount: number
  top: number
  height: number
}

export function layoutDayEvents(schedules: Schedule[], day: Date): EventLayout[] {
  interface Clipped { schedule: Schedule; startMin: number; endMin: number }
  const clipped: Clipped[] = []
  for (const s of schedules) {
    const clip = clipEventToDay(s, day)
    if (clip) clipped.push({ schedule: s, ...clip })
  }
  if (clipped.length === 0) return []
  clipped.sort((a, b) => a.startMin - b.startMin)
  const colEnds: number[] = []
  const assignments: { item: Clipped; col: number }[] = []
  for (const item of clipped) {
    let col = colEnds.findIndex(end => end <= item.startMin)
    if (col === -1) { col = colEnds.length; colEnds.push(item.endMin) }
    else            { colEnds[col] = item.endMin }
    assignments.push({ item, col })
  }
  const colCount = Math.max(1, colEnds.length)
  return assignments.map(({ item, col }) => ({
    schedule: item.schedule, col, colCount,
    top:    item.startMin * PX_PER_MIN,
    height: Math.max((item.endMin - item.startMin) * PX_PER_MIN, 24),
  }))
}
