/**
 * 반복 일정 인스턴스 생성 유틸
 *
 * 날짜 계산: 브라우저 로컬 타임존 기준 (JS Date.getDate 등 사용)
 * Phase 10에서 settings.timezone 기반으로 업그레이드 예정
 */
import type { Schedule } from '../types'

export type RepeatEndType = 'forever' | 'until' | 'count'

// 무기한 반복 시 최대 생성 인스턴스 수 (원본 제외). 약 1년치.
const MAX_INSTANCES = 364

// ─── 날짜 생성 ───────────────────────────────────────────────

/**
 * 반복 패턴에 따라 파생 인스턴스의 start_at (UTC ISO) 목록을 생성한다.
 * 첫 번째(원본) 일정은 포함하지 않는다.
 *
 * @param firstStartAt  원본 일정의 start_at (UTC ISO 또는 PB datetime 문자열)
 * @param repeatType    반복 주기
 * @param repeatDays    요일 배열 (weekly 전용. JS getDay() 기준: 0=일, 1=월 … 6=토)
 * @param endType       종료 조건
 * @param endAtLocal    종료일 YYYY-MM-DD (until 일 때)
 * @param count         원본 포함 총 반복 횟수 (count 일 때)
 */
export function generateRepeatStartDates(
  firstStartAt: string,
  repeatType: 'daily' | 'weekly' | 'monthly' | 'yearly',
  repeatDays: number[],
  endType: RepeatEndType,
  endAtLocal?: string,
  count?: number,
): string[] {
  const first   = new Date(firstStartAt)
  const endDate = (endType === 'until' && endAtLocal)
    ? new Date(endAtLocal + 'T23:59:59')
    : null
  const maxExtra = endType === 'count' ? Math.max((count ?? 1) - 1, 0) : MAX_INSTANCES

  // 매주 + 요일 지정
  if (repeatType === 'weekly' && repeatDays.length > 0) {
    return genWeeklyDates(first, repeatDays, maxExtra, endDate)
  }

  // 단순 반복 (daily / weekly 요일 미지정 / monthly / yearly)
  const result: string[] = []
  let cur = new Date(first)
  while (result.length < maxExtra) {
    cur = advanceDate(cur, repeatType)
    if (endDate && cur > endDate) break
    result.push(cur.toISOString())
  }
  return result
}

/** 다음 반복 날짜로 전진 */
function advanceDate(d: Date, type: 'daily' | 'weekly' | 'monthly' | 'yearly'): Date {
  const n = new Date(d)
  if (type === 'daily')   n.setDate(n.getDate() + 1)
  if (type === 'weekly')  n.setDate(n.getDate() + 7)
  if (type === 'monthly') n.setMonth(n.getMonth() + 1)
  if (type === 'yearly')  n.setFullYear(n.getFullYear() + 1)
  return n
}

/** 매주 특정 요일 반복 날짜 생성 */
function genWeeklyDates(
  first: Date,
  days: number[],
  max: number,
  endDate: Date | null,
): string[] {
  const result: string[] = []
  const sorted = [...days].sort((a, b) => a - b)
  const hh = first.getHours()
  const mm = first.getMinutes()
  const ss = first.getSeconds()
  let cur = new Date(first)

  while (result.length < max) {
    const dow = cur.getDay()
    const nextDow = sorted.find(d => d > dow)
    const daysAhead = nextDow !== undefined
      ? nextDow - dow
      : 7 - dow + sorted[0]

    const n = new Date(cur)
    n.setDate(n.getDate() + daysAhead)
    n.setHours(hh, mm, ss, 0)

    if (endDate && n > endDate) break
    result.push(n.toISOString())
    cur = n
  }
  return result
}

// ─── 헬퍼 ──────────────────────────────────────────────────

/** 해당 일정이 반복 일정(원본 또는 파생 인스턴스)인지 여부 */
export function isRepeatSchedule(s: Schedule): boolean {
  return VALID_REPEAT_TYPES.has(s.repeat_type) || !!s.parent_id
}

/**
 * 반복 그룹의 원본 id 반환
 * - 원본(parent_id=""): 자신의 id
 * - 파생 인스턴스(parent_id 있음): parent_id
 */
export function getOriginId(s: Schedule): string {
  return s.parent_id || s.id
}

/** repeat_type 한국어 레이블 */
export const REPEAT_TYPE_LABELS: Record<Schedule['repeat_type'], string> = {
  none:    '없음',
  daily:   '매일',
  weekly:  '매주',
  monthly: '매월',
  yearly:  '매년',
}

export const REPEAT_DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// ─── Virtual Expansion ────────────────────────────────────────

/** Date → "YYYY-MM-DD" (로컬 시각 기준) */
export function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** 유효한 repeat_type 집합 — 이 값 외에는 무한루프 위험 */
const VALID_REPEAT_TYPES = new Set<Schedule['repeat_type']>(['daily', 'weekly', 'monthly', 'yearly'])

/** 무한루프 방지 최대 발생 횟수 */
const MAX_OCCURRENCES = 5_000

/** 단순 반복에서 다음 날짜로 전진 (advanceDate 재활용) */
function advance(
  d: Date,
  type: 'daily' | 'weekly' | 'monthly' | 'yearly',
): Date {
  const n = new Date(d)
  if (type === 'daily')   n.setDate(n.getDate() + 1)
  if (type === 'weekly')  n.setDate(n.getDate() + 7)
  if (type === 'monthly') n.setMonth(n.getMonth() + 1)
  if (type === 'yearly')  n.setFullYear(n.getFullYear() + 1)
  return n
}

/** 매주 특정 요일 반복 — 범위 내 발생 Date 목록 */
function weeklyInRange(
  first: Date,
  days: number[],
  rangeStart: Date,
  effectiveEnd: Date,
  maxCount: number,
): Date[] {
  const result: Date[] = []
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 0) return result
  const hh = first.getHours()
  const mm = first.getMinutes()
  const ss = first.getSeconds()

  if (first >= rangeStart && first <= effectiveEnd) result.push(new Date(first))

  let cur = new Date(first)
  let count = 1

  while (count < maxCount && result.length < MAX_OCCURRENCES) {
    const dow = cur.getDay()
    const nextDow = sorted.find(d => d > dow)
    const daysAhead = nextDow !== undefined
      ? nextDow - dow
      : 7 - dow + sorted[0]

    if (daysAhead <= 0) break  // 무한루프 방지 (연산 오류 시)

    const n = new Date(cur)
    n.setDate(n.getDate() + daysAhead)
    n.setHours(hh, mm, ss, 0)

    if (n > effectiveEnd) break
    count++
    if (n >= rangeStart) result.push(new Date(n))
    cur = n
  }
  return result
}

/**
 * 반복 부모 레코드 하나에 대해 rangeStart~rangeEnd 구간의 발생 Date 목록 반환
 * (repeat_count, repeat_end_at 존중)
 */
function getOccurrencesInRange(
  parent: Schedule,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  if (!parent.start_at) return []
  const first = new Date(parent.start_at)
  if (isNaN(first.getTime())) return []

  // repeat_type 유효성 체크 — null/undefined/'none' 등이면 advance()가 날짜를 전진시키지 않아 무한루프 발생
  const type = parent.repeat_type
  if (!VALID_REPEAT_TYPES.has(type)) return []

  // 실질적인 종료 시점
  let effectiveEnd = rangeEnd
  if (parent.repeat_end_at) {
    const re = new Date(parent.repeat_end_at)
    if (!isNaN(re.getTime()) && re < rangeEnd) effectiveEnd = re
  }
  if (first > effectiveEnd) return []

  const maxCount = parent.repeat_count && parent.repeat_count > 0
    ? parent.repeat_count
    : Infinity

  if (type === 'weekly' && (parent.repeat_days?.length ?? 0) > 0) {
    return weeklyInRange(first, parent.repeat_days, rangeStart, effectiveEnd, maxCount)
  }

  // 월간 반복일 때는 원래 일(day)을 기억해두어
  // JS setMonth은 현재 일을 유지하뉔라러 5월 31일 → setMonth(5) → 7월 1일로 overflow
  // 월마다 일수를 얻어 Math.min 유지 (5월 31일 → 6월 30일, 7월 31일, ...)
  const originalDay = first.getDate()

  function advanceOne(d: Date): Date {
    if (type !== 'monthly' && type !== 'yearly') return advance(d, type)

    const n = new Date(d)
    n.setDate(1)                          // 1일로 이동 후 월 변경 (overflow 방지)
    if (type === 'monthly') n.setMonth(n.getMonth() + 1)
    else                    n.setFullYear(n.getFullYear() + 1)
    const lastDay = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
    n.setDate(Math.min(originalDay, lastDay))
    return n
  }

  const result: Date[] = []
  let cur = new Date(first)
  let count = 1

  while (cur <= effectiveEnd && count <= maxCount && result.length < MAX_OCCURRENCES) {
    if (cur >= rangeStart) result.push(new Date(cur))
    const next = advanceOne(cur)
    if (next.getTime() <= cur.getTime()) break
    cur = next
    count++
  }
  return result
}

/**
 * 스케줄 목록(부모 + 예외 레코드 혼재)을 받아
 * rangeStart~rangeEnd 구간에 표시할 Schedule 배열을 반환한다.
 *
 * - 비반복 일정: 그대로 포함 (start_at이 범위 내인 것)
 * - 반복 부모: 발생일마다 가상 Schedule 생성 (_isVirtual=true)
 *   - excluded_dates에 있는 날짜는 건너뜀
 *   - exception_date가 일치하는 예외 레코드가 있으면 그것으로 대체
 * - 예외 레코드: 대응 가상 인스턴스 자리에 끼워지거나,
 *   start_at이 범위 내인 경우 직접 포함 (이동된 케이스)
 */
export function expandSchedulesForRange(
  schedules: Schedule[],
  rangeStart: Date,
  rangeEnd: Date,
): Schedule[] {
  // parents: 유효한 repeat_type을 가진 부모 레코드만 (null/undefined 등 무효 값은 무한루프 유발)
  const parents    = schedules.filter(s => VALID_REPEAT_TYPES.has(s.repeat_type) && !s.parent_id)
  const exceptions = schedules.filter(s => !!s.parent_id && !!s.exception_date)
  // nonRepeat: repeat_type이 유효한 반복 값이 아닌 것 ('' | null | undefined | 'none' 모두 포함)
  const nonRepeat  = schedules.filter(s => !VALID_REPEAT_TYPES.has(s.repeat_type) && !s.parent_id)

  // 비반복: 범위 내 start_at인 것만
  const result: Schedule[] = nonRepeat.filter(s => {
    if (!s.start_at) return false
    const start = new Date(s.start_at)
    const end   = s.end_at ? new Date(s.end_at) : start
    return start <= rangeEnd && end >= rangeStart
  })

  const includedExcIds = new Set<string>()

  for (const parent of parents) {
    const pExceptions   = exceptions.filter(e => e.parent_id === parent.id)
    const exceptionDates = new Map(pExceptions.map(e => [e.exception_date, e]))
    const excludedSet    = new Set(parent.excluded_dates ?? [])

    const durationMs = parent.end_at
      ? new Date(parent.end_at).getTime() - new Date(parent.start_at).getTime()
      : 0

    for (const occ of getOccurrencesInRange(parent, rangeStart, rangeEnd)) {
      const occDateStr = toLocalDateStr(occ)

      if (excludedSet.has(occDateStr)) continue          // 삭제된 발생일

      const exc = exceptionDates.get(occDateStr)
      if (exc) {
        // 예외 레코드가 이 날짜를 대체
        result.push(exc)
        includedExcIds.add(exc.id)
      } else {
        // 가상 인스턴스 생성
        const endAt = durationMs > 0
          ? new Date(occ.getTime() + durationMs).toISOString()
          : parent.end_at
        result.push({
          ...parent,
          id:               `${parent.id}_virt_${occDateStr}`,
          start_at:         occ.toISOString(),
          end_at:           endAt ?? '',
          parent_id:        parent.id,
          exception_date:   '',
          excluded_dates:   [],
          _isVirtual:       true,
          _occurrenceDate:  occDateStr,
        })
      }
    }
  }

  // 이동된 예외 레코드: exception_date는 범위 밖이지만 start_at이 범위 내
  for (const exc of exceptions) {
    if (includedExcIds.has(exc.id)) continue
    if (!exc.start_at) continue
    const start = new Date(exc.start_at)
    const end   = exc.end_at ? new Date(exc.end_at) : start
    if (start <= rangeEnd && end >= rangeStart) result.push(exc)
  }

  return result
}
