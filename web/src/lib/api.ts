import pb, { withAuth } from './pocketbase'
import type { Schedule, Category, Settings } from '../types'

// requestKey: null → PocketBase SDK 자동취소 비활성화

/** Date → "YYYY-MM-DD" (로컀 시각 기준) */
function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * 반복 함수에서 공통으로 필요한 두 값을 추출
 *
 * parentId:
 *   - 가상 인스턴스 / 예외 레코드: parent_id (실제 부모 ID)
 *   - 부모 레코드 직접 (TodoPage): 자신의 id
 *
 * occDate (YYYY-MM-DD):
 *   - _isVirtual: _occurrenceDate
 *   - 예외 레코드: exception_date
 *   - 부모 레코드 직접: start_at 로컀 날짜
 */
function getRepeatContext(item: Schedule): { parentId: string; occDate: string } {
  const parentId = item.parent_id || item.id
  const occDate  = item._isVirtual
    ? (item._occurrenceDate ?? '')
    : (item.exception_date || (item.start_at ? localDateStr(new Date(item.start_at)) : ''))
  return { parentId, occDate }
}

// ─── Schedules ──────────────────────────────────────
export async function fetchSchedules(): Promise<Schedule[]> {
  return withAuth(async () => {
    const records = await pb.collection('schedules').getFullList({ requestKey: null })
    return records as unknown as Schedule[]
  })
}

export async function createSchedule(data: Partial<Schedule>): Promise<Schedule> {
  return withAuth(async () => {
    const record = await pb.collection('schedules').create(data, { requestKey: null })
    return record as unknown as Schedule
  })
}

export async function updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
  return withAuth(async () => {
    const record = await pb.collection('schedules').update(id, data, { requestKey: null })
    return record as unknown as Schedule
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  return withAuth(async () => {
    await pb.collection('schedules').delete(id, { requestKey: null })
  })
}

// ─── Categories ─────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  return withAuth(async () => {
    const records = await pb.collection('categories').getFullList({ sort: 'order', requestKey: null })
    return records as unknown as Category[]
  })
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  return withAuth(async () => {
    const record = await pb.collection('categories').create(data, { requestKey: null })
    return record as unknown as Category
  })
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  return withAuth(async () => {
    const record = await pb.collection('categories').update(id, data, { requestKey: null })
    return record as unknown as Category
  })
}

export async function deleteCategory(id: string): Promise<void> {
  return withAuth(async () => {
    await pb.collection('categories').delete(id, { requestKey: null })
  })
}

// ─── Settings ───────────────────────────────────────
export async function fetchSettings(): Promise<Settings | null> {
  try {
    return await withAuth(async () => {
      const records = await pb.collection('settings').getFullList({ requestKey: null })
      return (records[0] as unknown as Settings) ?? null
    })
  } catch {
    return null
  }
}

export async function upsertSettings(id: string | undefined, data: Partial<Settings>): Promise<Settings> {
  return withAuth(async () => {
    if (id) {
      const record = await pb.collection('settings').update(id, data, { requestKey: null })
      return record as unknown as Settings
    } else {
      const record = await pb.collection('settings').create(data, { requestKey: null })
      return record as unknown as Settings
    }
  })
}

// ─── 자동 삭제 ────────────────────────────────────────
export async function runAutoDelete(
  todoDeleteDays: number,
  scheduleDeleteDays: number
): Promise<void> {
  const now = new Date()

  function toFilterStr(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '')
  }

  const todoThresholdStr = toFilterStr(
    new Date(now.getTime() - todoDeleteDays * 24 * 60 * 60 * 1000)
  )
  try {
    const oldTodos = await withAuth(() =>
      pb.collection('schedules').getFullList({
        filter: `is_todo=true && is_completed=true && completed_at!="" && completed_at<"${todoThresholdStr}"`,
        fields: 'id',
        requestKey: null,
      })
    )
    for (const item of oldTodos) {
      try { await pb.collection('schedules').delete(item.id) } catch { /* 개별 실패 무시 */ }
    }
  } catch { /* 전체 실패 무시 */ }

  const scheduleThresholdStr = toFilterStr(
    new Date(now.getTime() - scheduleDeleteDays * 24 * 60 * 60 * 1000)
  )
  try {
    // 비반복 + 예외 레코드가 아닌 것만 자동 삭제 (반복 부모 레코드는 제외)
    const oldSchedules = await withAuth(() =>
      pb.collection('schedules').getFullList({
        filter: `is_todo=false && end_at!="" && end_at<"${scheduleThresholdStr}" && repeat_type="none" && parent_id=""`,
        fields: 'id',
        requestKey: null,
      })
    )
    for (const item of oldSchedules) {
      try { await pb.collection('schedules').delete(item.id) } catch { /* 개별 실패 무시 */ }
    }
  } catch { /* 전체 실패 무시 */ }
}

// ─── 반복 일정 (Virtual Expansion 방식) ─────────────────────
//
// DB에는 부모 레코드(repeat_type!='none') 1개만 저장.
// 인스턴스는 프론트엔드에서 expandSchedulesForRange()로 동적 계산.
// 예외(exception)만 실 레코드로 저장된다.

/**
 * "이 일정만" 편집: 가상 인스턴스 → 예외 레코드 생성
 * exception_date = 원본 발생일 YYYY-MM-DD
 */
export async function createException(
  parentId: string,
  occurrenceDate: string,
  data: Partial<Schedule>,
): Promise<Schedule> {
  return withAuth(async () => {
    const record = await pb.collection('schedules').create({
      ...data,
      parent_id:      parentId,
      exception_date: occurrenceDate,
      repeat_type:    'none',
      repeat_days:    [],
      repeat_end_at:  '',
      repeat_count:   0,
      excluded_dates: [],
    }, { requestKey: null })
    return record as unknown as Schedule
  })
}

/**
 * "이 일정만" 삭제
 * - 부모의 excluded_dates에 날짜 추가
 * - 실 예외 레코드인 경우 DB에서도 삭제
 */
export async function deleteOccurrence(item: Schedule): Promise<void> {
  return withAuth(async () => {
    const { parentId, occDate } = getRepeatContext(item)
    if (!parentId || !occDate) return

    const parent = await pb.collection('schedules').getOne(parentId, { requestKey: null }) as unknown as Schedule
    const excluded = [...(parent.excluded_dates ?? []).filter(d => d !== occDate), occDate]
    await pb.collection('schedules').update(parentId, { excluded_dates: excluded }, { requestKey: null })

    if (!item._isVirtual && item.id !== parentId) {
      await pb.collection('schedules').delete(item.id, { requestKey: null })
    }
  })
}

/**
 * "이후 전체" 삭제
 * - 이 날 이후 예외 레코드 삭제
 * - 부모의 repeat_end_at을 이 날 하루 전으로 설정
 */
export async function deleteFromOccurrence(item: Schedule): Promise<void> {
  return withAuth(async () => {
    const { parentId, occDate } = getRepeatContext(item)
    if (!parentId || !occDate) return

    // 예외 레코드 삭제 (스키마에 exception_date 없으면 결과 0개 — 비정상 종료 없음)
    try {
      const exceptions = await pb.collection('schedules').getFullList({
        filter: `parent_id="${parentId}" && exception_date>="${occDate}"`,
        requestKey: null,
      })
      for (const exc of exceptions) {
        try { await pb.collection('schedules').delete(exc.id, { requestKey: null }) } catch { /* ignore */ }
      }
    } catch { /* exception_date 필드 미존재 시 무시 */ }

    const dayBefore = new Date(occDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    dayBefore.setHours(23, 59, 59, 0)
    await pb.collection('schedules').update(parentId, {
      repeat_end_at: dayBefore.toISOString(),
      repeat_count:  0,
    }, { requestKey: null })
  })
}

/**
 * "모두" 삭제
 * - 부모 + 모든 예외 레코드 삭제
 */
export async function deleteAllOccurrences(item: Schedule): Promise<void> {
  return withAuth(async () => {
    const { parentId } = getRepeatContext(item)
    if (!parentId) return

    // 예외 레코드 삭제
    try {
      const exceptions = await pb.collection('schedules').getFullList({
        filter: `parent_id="${parentId}"`,
        requestKey: null,
      })
      for (const exc of exceptions) {
        try { await pb.collection('schedules').delete(exc.id, { requestKey: null }) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    await pb.collection('schedules').delete(parentId, { requestKey: null })
  })
}

/**
 * "이후 전체" 편집
 * - 이 날 이후 예외 레코드 삭제
 * - 부모를 이 날 하루 전에서 종료
 * - 이 날부터 새 부모 생성 (동일 반복 규칙 + 새 메타데이터)
 */
export async function updateFromOccurrence(
  item: Schedule,
  data: Partial<Schedule>,
): Promise<void> {
  return withAuth(async () => {
    const { parentId, occDate } = getRepeatContext(item)
    if (!parentId || !occDate) return

    const parent = await pb.collection('schedules').getOne(parentId, { requestKey: null }) as unknown as Schedule

    // 이 날 이후 예외 레코드 삭제 (스키마 없으면 무시)
    try {
      const exceptions = await pb.collection('schedules').getFullList({
        filter: `parent_id="${parentId}" && exception_date>="${occDate}"`,
        requestKey: null,
      })
      for (const exc of exceptions) {
        try { await pb.collection('schedules').delete(exc.id, { requestKey: null }) } catch { /* ignore */ }
      }
    } catch { /* exception_date 필드 미존재 시 무시 */ }

    // 부모 종료일 업데이트
    const dayBefore = new Date(occDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    dayBefore.setHours(23, 59, 59, 0)
    await pb.collection('schedules').update(parentId, {
      repeat_end_at: dayBefore.toISOString(),
      repeat_count:  0,
    }, { requestKey: null })

    // 새 부모 생성
    const origStart  = new Date(parent.start_at)
    const newStart   = new Date(occDate)
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), 0)
    const durationMs = parent.end_at
      ? new Date(parent.end_at).getTime() - origStart.getTime()
      : 0
    const newEnd = durationMs > 0
      ? new Date(newStart.getTime() + durationMs).toISOString()
      : parent.end_at

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created: _c, updated: _u, ...parentFields } = parent as Schedule & { created: string; updated: string }
    await pb.collection('schedules').create({
      ...parentFields,
      ...data,
      start_at:       newStart.toISOString(),
      end_at:         newEnd ?? '',
      parent_id:      '',
      exception_date: '',
      excluded_dates: [],
      repeat_end_at:  parent.repeat_end_at,
      repeat_count:   parent.repeat_count,
    }, { requestKey: null })
  })
}

/**
 * "모두" 편집 — 부모 + 모든 예외 레코드의 메타 필드 일괄 업데이트
 * repeat_end_at / repeat_count는 부모에만 적용
 */
export async function updateAllOccurrences(
  item: Schedule,
  data: Partial<Schedule>,
): Promise<void> {
  return withAuth(async () => {
    const { parentId } = getRepeatContext(item)
    if (!parentId) return

    await pb.collection('schedules').update(parentId, data, { requestKey: null })

    // 예외 레코드에는 반복 관련 필드 제외하고 업데이트
    const { repeat_end_at: _re, repeat_count: _rc, repeat_type: _rt,
            repeat_days: _rd, excluded_dates: _ex, ...excData } = data
    try {
      const exceptions = await pb.collection('schedules').getFullList({
        filter: `parent_id="${parentId}"`,
        requestKey: null,
      })
      for (const exc of exceptions) {
        try {
          await pb.collection('schedules').update(exc.id, excData, { requestKey: null })
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  })
}
