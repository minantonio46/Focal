/**
 * 우선순위 뷰 — 긴급도 계산 유틸 (Phase 8)
 *
 * 긴급도 앵커 (기본값):
 *   0h     → 10
 *   1h     →  9  (t9, 커스터마이징 가능)
 *   24h    →  8  (t8, 커스터마이징 가능)
 *   1주    →  7  (t7, 커스터마이징 가능)
 *   1달    →  5  (t5, 커스터마이징 가능)
 *   반년   →  3  (고정)
 *   1년    →  2  (고정)
 *   기한없음 → 1
 *
 * 앵커 사이는 선형 보간 → 소수점 연속값
 */

import type { Schedule, Settings } from '../types'
import { VALID_REPEAT_TYPES } from './repeatUtils'
export { VALID_REPEAT_TYPES } from './repeatUtils'

// ─── 긴급도 임계값 타입 ──────────────────────────────────────
export type UrgencyThresholds = NonNullable<Settings['urgency_thresholds']>

// 기본 활성화 상태 (null/undefined = 비활성화)
export const DEFAULT_THRESHOLDS: UrgencyThresholds = {
  s9: 60,
  s8: 1440,
  s7: 10080,
  s6: null,    // 기본 비활성화
  s5: 43200,
  s4: null,    // 기본 비활성화
  s3: 259200,
  s2: 525600,
}

function buildAnchors(th: UrgencyThresholds): [number, number][] {
  const SCORE_KEYS: [keyof UrgencyThresholds, number][] = [
    ['s9', 9], ['s8', 8], ['s7', 7], ['s6', 6],
    ['s5', 5], ['s4', 4], ['s3', 3], ['s2', 2],
  ]
  const anchors: [number, number][] = [[0, 10]]
  for (const [key, score] of SCORE_KEYS) {
    const mins = th[key]
    if (mins != null && mins > 0) anchors.push([mins, score])
  }
  // 정렬 보장
  anchors.sort((a, b) => a[0] - b[0])
  return anchors
}

/**
 * 남은 시간(분)을 앵커 테이블로 선형 보간 → 1.0~10.0
 * 이미 지났으면(diffMin ≤ 0) → 10 고정
 * 1년 초과 → 2에서 1로 선형 감소 (2년 이상이면 1 고정)
 */
function interpolate(diffMin: number, th: UrgencyThresholds): number {
  if (diffMin <= 0) return 10

  const ANCHORS = buildAnchors(th)
  const lastAnchor = ANCHORS[ANCHORS.length - 1]

  // 마지막 앵커 초과 → 마지막 점수에서 1로 선형 감소
  if (diffMin >= lastAnchor[0]) {
    const twoX = lastAnchor[0] * 2
    if (diffMin >= twoX) return 1
    return lastAnchor[1] - ((lastAnchor[1] - 1) * (diffMin - lastAnchor[0]) / (twoX - lastAnchor[0]))
  }

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [m0, s0] = ANCHORS[i]
    const [m1, s1] = ANCHORS[i + 1]
    if (diffMin >= m0 && diffMin <= m1) {
      const t = (diffMin - m0) / (m1 - m0)
      return s0 + t * (s1 - s0)
    }
  }

  return 2
}

// ─── 반복 회차 순회 헬퍼 ────────────────────────────────────

function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

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

function traverseOccurrences<T>(
  item: Schedule,
  callback: (occMs: number, dateStr: string) => T | null,
): T | null {
  if (!item.start_at) return null
  if (!VALID_REPEAT_TYPES.has(item.repeat_type)) return null

  const excluded     = new Set(item.excluded_dates ?? [])
  const maxDate      = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2)
  const effectiveEnd = item.repeat_end_at ? new Date(item.repeat_end_at) : maxDate
  const maxCount     = item.repeat_count && item.repeat_count > 0 ? item.repeat_count : Infinity

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

function nextUncompletedOccurrenceMs(item: Schedule): number | null {
  const now = Date.now()
  const completed = new Set(item.completed_dates ?? [])
  return traverseOccurrences(item, (occMs, dateStr) => {
    if (occMs >= now && !completed.has(dateStr)) return occMs
    return null
  })
}

function oldestUncompletedOccurrenceMs(item: Schedule): number | null {
  const completed = new Set(item.completed_dates ?? [])
  return traverseOccurrences(item, (occMs, dateStr) => {
    if (!completed.has(dateStr)) return occMs
    return null
  })
}

function isRepeating(item: Schedule): boolean {
  return VALID_REPEAT_TYPES.has(item.repeat_type)
}

// ─── 공개 API ────────────────────────────────────────────────

/**
 * 긴급도 점수 (1.0~10.0)
 * thresholds: settings.urgency_thresholds (없으면 DEFAULT_THRESHOLDS 사용)
 */
export function urgencyScore(
  item: Schedule,
  thresholds?: UrgencyThresholds,
): number {
  const th = thresholds ?? DEFAULT_THRESHOLDS

  // 만료(expire) + 마감 초과 → 의미 없는 항목, 긴급도 1
  if (
    item.is_todo &&
    item.expire_type === 'expire' &&
    item.start_at &&
    new Date(item.start_at) < new Date()
  ) return 1

  if (isRepeating(item)) {
    if (item.is_todo && item.expire_type === 'keep') {
      const oldestMs = oldestUncompletedOccurrenceMs(item)
      if (oldestMs !== null && oldestMs < Date.now()) return 10
      if (oldestMs !== null) {
        const diffMin = (oldestMs - Date.now()) / (1000 * 60)
        return Math.round(interpolate(diffMin, th) * 100) / 100
      }
      return 1
    }
    const nextMs = nextUncompletedOccurrenceMs(item)
    if (nextMs === null) return 1
    const diffMin = (nextMs - Date.now()) / (1000 * 60)
    return Math.round(interpolate(diffMin, th) * 100) / 100
  }

  if (!item.start_at) return 1
  const diffMin = (new Date(item.start_at).getTime() - Date.now()) / (1000 * 60)
  return Math.round(interpolate(diffMin, th) * 100) / 100
}

export function urgencyX(item: Schedule, thresholds?: UrgencyThresholds): number {
  return urgencyScore(item, thresholds)
}

export function priorityScore(item: Schedule, thresholds?: UrgencyThresholds): number {
  return Math.round(item.importance * urgencyScore(item, thresholds) * 100) / 100
}

export function urgencyLabel(score: number, thresholds?: UrgencyThresholds): string {
  const th = thresholds ?? DEFAULT_THRESHOLDS
  const anchors = buildAnchors(th)
  // 점수별 레이블 매핑
  for (let i = anchors.length - 1; i >= 1; i--) {
    if (score >= anchors[i][1]) {
      const mins = anchors[i][0]
      if (mins < 60)           return `${mins}분 이내`
      if (mins < 60 * 24)      return `${Math.round(mins / 60)}시간 이내`
      if (mins < 60 * 24 * 7)  return `${Math.round(mins / (60 * 24))}일 이내`
      if (mins < 60 * 24 * 30) return `${Math.round(mins / (60 * 24 * 7))}주 이내`
      if (mins < 60 * 24 * 365) return `${Math.round(mins / (60 * 24 * 30))}달 이내`
      return `${Math.round(mins / (60 * 24 * 365))}년 이내`
    }
  }
  return '기한 없음'
}

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
  dateStr:     string
  occMs:       number
  isCompleted: boolean
}

export function getRepeatTodoDisplayOccurrences(item: Schedule): RepeatTodoOccurrence[] {
  if (!isRepeating(item) || !item.is_todo) return []

  const completed = new Set(item.completed_dates ?? [])
  const now = Date.now()
  const result: RepeatTodoOccurrence[] = []

  let targetOcc: RepeatTodoOccurrence | null = null
  if (item.expire_type === 'keep') {
    traverseOccurrences<boolean>(item, (occMs, dateStr) => {
      if (!completed.has(dateStr)) {
        targetOcc = { dateStr, occMs, isCompleted: false }
        return true
      }
      return null
    })
  } else {
    traverseOccurrences<boolean>(item, (occMs, dateStr) => {
      if (occMs >= now && !completed.has(dateStr)) {
        targetOcc = { dateStr, occMs, isCompleted: false }
        return true
      }
      return null
    })
    if (!targetOcc) {
      traverseOccurrences<boolean>(item, (occMs, dateStr) => {
        if (!completed.has(dateStr)) {
          targetOcc = { dateStr, occMs, isCompleted: false }
          return true
        }
        return null
      })
    }
  }
  if (targetOcc) result.push(targetOcc)

  if (completed.size > 0) {
    const sortedDates = [...completed].sort()
    const lastDateStr = sortedDates[sortedDates.length - 1]
    const occMs = new Date(lastDateStr + 'T00:00:00').getTime()
    if (!isNaN(occMs)) {
      result.push({ dateStr: lastDateStr, occMs, isCompleted: true })
    }
  }

  return result
}
