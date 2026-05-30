/**
 * 우선순위 뷰 — 긴급도 계산 유틸 (Phase 8)
 *
 * 긴급도 앵커:
 *   0h     → 10
 *   1h     →  9
 *   24h    →  8
 *   1주    →  7
 *   1달    →  5
 *   반년   →  3
 *   1년    →  2
 *   기한없음 → 1
 *
 * 앵커 사이는 선형 보간 → 소수점 연속값
 *
 * 반복 항목 처리:
 *   반복 일정:         다음 회차 start_at 기준 (expire 처리). 반복 종료시 뷰에서 제외.
 *   반복 Todo(expire): 현재 이후 가장 가까운 미완료 회차 기준. 반복 종료시 제외.
 *   반복 Todo(keep):   completed_dates 기준 가장 오래된 미완료 회차가 과거면 → 10.
 *                      없으면 다음 회차 기준.
 */

import type { Schedule } from '../types'
import { VALID_REPEAT_TYPES } from './repeatUtils'
export { VALID_REPEAT_TYPES } from './repeatUtils'

// ─── 앵커 테이블 (분 단위, 점수) — 오름차순 ────────────────
const ANCHORS: [number, number][] = [
  [0,             10],
  [60,             9],  // 1h
  [60 * 24,        8],  // 24h
  [60 * 24 * 7,    7],  // 1주
  [60 * 24 * 30,   5],  // 1달 (30일)
  [60 * 24 * 183,  3],  // 반년 (6개월 ≈ 183일)
  [60 * 24 * 365,  2],  // 1년
]

/**
 * 남은 시간(분)을 앵커 테이블로 선형 보간 → 1.0~10.0
 * 이미 지났으면(diffMin ≤ 0) → 10 고정
 * 1년 초과 → 2에서 1로 선형 감소 (2년 이상이면 1 고정)
 */
function interpolate(diffMin: number): number {
  if (diffMin <= 0) return 10

  const oneYear = 60 * 24 * 365
  const twoYear = oneYear * 2
  if (diffMin >= oneYear) {
    if (diffMin >= twoYear) return 1
    return 2 - ((diffMin - oneYear) / (twoYear - oneYear))
  }

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [m0, s0] = ANCHORS[i]
    const [m1, s1] = ANCHORS[i + 1]
    if (diffMin >= m0 && diffMin <= m1) {
      const t = (diffMin - m0) / (m1 - m0)
      return s0 + t * (s1 - s0)
    }
  }

  return 2 // 안전 폴백
}

// ─── 반복 회차 순회 헬퍼 ────────────────────────────────────

function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** 반복 패턴에 따라 d의 다음 발생일로 전진 */
function advanceOne(d: Date, item: Schedule): Date {
  const type = item.repeat_type
  const originalDay = item.start_at ? new Date(item.start_at).getDate() : d.getDate()
  const n = new Date(d)

  if (type === 'daily') {
    n.setDate(n.getDate() + 1)
  } else if (type === 'weekly') {
    if (item.repeat_days?.length) {
      const sorted = [...item.repeat_days].sort((a, b) => a - b)
      const dow = n.getDay()
      const nextDow = sorted.find(d => d > dow)
      const daysAhead = nextDow !== undefined ? nextDow - dow : 7 - dow + sorted[0]
      n.setDate(n.getDate() + daysAhead)
    } else {
      n.setDate(n.getDate() + 7)
    }
  } else if (type === 'monthly') {
    n.setDate(1)
    n.setMonth(n.getMonth() + 1)
    const lastDay = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
    n.setDate(Math.min(originalDay, lastDay))
  } else if (type === 'yearly') {
    n.setDate(1)
    n.setFullYear(n.getFullYear() + 1)
    const lastDay = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
    n.setDate(Math.min(originalDay, lastDay))
  }
  return n
}

/**
 * 회차 순회 공통 로직.
 * callback이 non-null 값을 반환하면 즉시 그 값을 반환 (조기 종료).
 * 최대 2년치만 탐색.
 */
function traverseOccurrences<T>(
  item: Schedule,
  callback: (occMs: number, dateStr: string) => T | null,
): T | null {
  if (!item.start_at) return null
  if (!VALID_REPEAT_TYPES.has(item.repeat_type)) return null

  const excluded  = new Set(item.excluded_dates ?? [])
  const maxDate   = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2)
  const effectiveEnd = item.repeat_end_at ? new Date(item.repeat_end_at) : maxDate
  const maxCount  = item.repeat_count && item.repeat_count > 0 ? item.repeat_count : Infinity

  let cur   = new Date(item.start_at)
  let count = 1

  while (cur <= effectiveEnd && cur <= maxDate && count <= maxCount) {
    const dateStr = toDateStr(cur)
    if (!excluded.has(dateStr)) {
      const result = callback(cur.getTime(), dateStr)
      if (result !== null) return result
    }
    const next = advanceOne(cur, item)
    if (next.getTime() <= cur.getTime()) break
    cur = next
    count++
  }
  return null
}

/**
 * 현재 이후 가장 가까운 미완료 회차의 ms 반환.
 * (expire 처리 — 이미 지난 회차 무시, completed_dates 제외)
 */
function nextUncompletedOccurrenceMs(item: Schedule): number | null {
  const now = Date.now()
  const completed = new Set(item.completed_dates ?? [])
  return traverseOccurrences(item, (occMs, dateStr) => {
    if (occMs >= now && !completed.has(dateStr)) return occMs
    return null
  })
}

/**
 * 가장 오래된 미완료 회차의 ms 반환 (keep 처리용 — 과거 포함).
 */
function oldestUncompletedOccurrenceMs(item: Schedule): number | null {
  const completed = new Set(item.completed_dates ?? [])
  return traverseOccurrences(item, (occMs, dateStr) => {
    if (!completed.has(dateStr)) return occMs
    return null
  })
}

/** 반복 항목인지 여부 */
function isRepeating(item: Schedule): boolean {
  return VALID_REPEAT_TYPES.has(item.repeat_type)
}

// ─── 공개 API ────────────────────────────────────────────────

/**
 * 긴급도 점수 (1.0~10.0 소수점 연속값)
 *
 * 반복 일정:         다음 회차 start_at 기준 (expire). 반복 종료 → 1 (뷰에서 별도 제외)
 * 반복 Todo(expire): 현재 이후 가장 가까운 미완료 회차 기준. 없으면 1.
 * 반복 Todo(keep):   가장 오래된 미완료 회차가 과거면 → 10. 없으면 다음 회차 기준.
 * 비반복:            start_at 기준, 없으면 → 1
 */
export function urgencyScore(item: Schedule): number {
  if (isRepeating(item)) {
    if (item.is_todo && item.expire_type === 'keep') {
      const oldestMs = oldestUncompletedOccurrenceMs(item)
      // 가장 오래된 미완료 회차가 과거면 긴급도 10
      if (oldestMs !== null && oldestMs < Date.now()) return 10
      // 미완료 회차가 없거나 모두 미래면 → 다음 미완료 회차 기준
      if (oldestMs !== null) {
        const diffMin = (oldestMs - Date.now()) / (1000 * 60)
        return Math.round(interpolate(diffMin) * 100) / 100
      }
      return 1 // 모든 회차 완료 or 반복 종료
    }

    // expire (일정 포함): 현재 이후 가장 가까운 미완료 회차
    const nextMs = nextUncompletedOccurrenceMs(item)
    if (nextMs === null) return 1 // 반복 종료 또는 모두 완료
    const diffMin = (nextMs - Date.now()) / (1000 * 60)
    return Math.round(interpolate(diffMin) * 100) / 100
  }

  // 비반복
  if (!item.start_at) return 1
  const diffMin = (new Date(item.start_at).getTime() - Date.now()) / (1000 * 60)
  return Math.round(interpolate(diffMin) * 100) / 100
}

/** 긴급도 연속값 (매트릭스 X 좌표용) — urgencyScore와 동일 */
export function urgencyX(item: Schedule): number {
  return urgencyScore(item)
}

/** 우선순위 점수 = 중요도 × 긴급도 */
export function priorityScore(item: Schedule): number {
  return Math.round(item.importance * urgencyScore(item) * 100) / 100
}

/** 긴급도 레이블 텍스트 */
export function urgencyLabel(score: number): string {
  if (score >= 9)  return '1시간 이내'
  if (score >= 8)  return '24시간 이내'
  if (score >= 7)  return '1주 이내'
  if (score >= 5)  return '1달 이내'
  if (score >= 3)  return '반년 이내'
  if (score >= 2)  return '1년 이내'
  return '기한 없음'
}

/** 사분면 레이블 (아이젠하워) — 좌상단=즉시 처리(긴급+중요) */
export function quadrantLabel(importanceY: number, urgencyXVal: number): string {
  const isImportant = importanceY >= 5
  const isUrgent    = urgencyXVal >= 5
  if (isImportant && isUrgent)   return '즉시 처리'
  if (isImportant && !isUrgent)  return '일정 수립'
  if (!isImportant && isUrgent)  return '위임'
  return '제거'
}

// ─── TodoPage용 반복 Todo 회차 계산 ─────────────────────────

export interface RepeatTodoOccurrence {
  dateStr: string     // YYYY-MM-DD
  occMs:   number
  isCompleted: boolean
}

/**
 * 반복 Todo를 TodoPage에 표시할 회차 목록으로 변환.
 *
 * keep:
 *   - 미완료 중 가장 오래된 회차 1개 (표시 대상)
 *   - 완료된 것 중 가장 최근 1개 (히스토리)
 *
 * expire:
 *   - 현재 이후 가장 가까운 미완료 회차 1개
 *   - 완료된 것 중 가장 최근 1개 (히스토리)
 */
export function getRepeatTodoDisplayOccurrences(item: Schedule): RepeatTodoOccurrence[] {
  if (!isRepeating(item) || !item.is_todo) return []

  const completed = new Set(item.completed_dates ?? [])
  const now = Date.now()
  const result: RepeatTodoOccurrence[] = []

  // 단계 1: 표시할 미완료 회차 1개 조기 종료로 찾기
  let targetOcc: RepeatTodoOccurrence | null = null
  if (item.expire_type === 'keep') {
    traverseOccurrences<boolean>(item, (occMs, dateStr) => {
      if (!completed.has(dateStr)) {
        targetOcc = { dateStr, occMs, isCompleted: false }
        return true // non-null → 조기 종료
      }
      return null
    })
  } else {
    traverseOccurrences<boolean>(item, (occMs, dateStr) => {
      if (occMs >= now && !completed.has(dateStr)) {
        targetOcc = { dateStr, occMs, isCompleted: false }
        return true // non-null → 조기 종료
      }
      return null
    })
  }
  if (targetOcc) result.push(targetOcc)

  // 단계 2: 완료 중 가장 최근 1개 — completed_dates 배열에서 직접 추출 (순회 불필요)
  if (completed.size > 0) {
    const sortedDates = [...completed].sort()
    const lastDateStr = sortedDates[sortedDates.length - 1]
    // 해당 날짜의 ms는 날짜 문자열에서 직접 계산
    const occMs = new Date(lastDateStr + 'T00:00:00').getTime()
    if (!isNaN(occMs)) {
      result.push({ dateStr: lastDateStr, occMs, isCompleted: true })
    }
  }

  return result
}
