import pb, { withAuth } from './pocketbase'
import type { Schedule, Category, Settings, Notification } from '../types'
import {
  cacheGetSchedules, cacheSetSchedules, cachePutSchedule, cacheDeleteSchedule,
  cacheGetCategories, cacheSetCategories, cachePutCategory, cacheDeleteCategory,
  cacheGetSettings, cacheSetSettings,
} from './offlineCache'
import { enqueue } from './syncQueue'

// requestKey: null → PocketBase SDK 자동취소 비활성화

/** Date → "YYYY-MM-DD" (로컬 시각 기준) */
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
 *   - 부모 레코드 직접: start_at 로컬 날짜
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
  if (!navigator.onLine) {
    return cacheGetSchedules()
  }
  return withAuth(async () => {
    const records = await pb.collection('schedules').getFullList({ requestKey: null })
    const schedules = records as unknown as Schedule[]
    await cacheSetSchedules(schedules)
    return schedules
  })
}

export async function createSchedule(data: Partial<Schedule>): Promise<Schedule> {
  if (!navigator.onLine) {
    // 오프라인: 임시 ID 생성 후 캐시에 저장, 큐에 적재
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const tempRecord = { ...data, id: tempId, created: new Date().toISOString(), updated: new Date().toISOString() } as Schedule
    await cachePutSchedule(tempRecord)
    await enqueue({ type: 'create', collection: 'schedules', recordId: tempId, payload: data as Record<string, unknown> })
    return tempRecord
  }
  return withAuth(async () => {
    const record = await pb.collection('schedules').create(data, { requestKey: null })
    const schedule = record as unknown as Schedule
    await cachePutSchedule(schedule)
    return schedule
  })
}

export async function updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
  if (!navigator.onLine) {
    const cached = (await cacheGetSchedules()).find(s => s.id === id)
    const updated = { ...(cached ?? {}), ...data, id, updated: new Date().toISOString() } as Schedule
    await cachePutSchedule(updated)
    // changedFields: data 만 저장, baseUpdated: 수정 전 cached.updated
    await enqueue({
      type         : 'update',
      collection   : 'schedules',
      recordId     : id,
      changedFields: data as Record<string, unknown>,
      baseUpdated  : cached?.updated,
    })
    return updated
  }
  return withAuth(async () => {
    const record = await pb.collection('schedules').update(id, data, { requestKey: null })
    const schedule = record as unknown as Schedule
    await cachePutSchedule(schedule)
    return schedule
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!navigator.onLine) {
    await cacheDeleteSchedule(id)
    await enqueue({ type: 'delete', collection: 'schedules', recordId: id })
    return
  }
  return withAuth(async () => {
    await pb.collection('schedules').delete(id, { requestKey: null })
    await cacheDeleteSchedule(id)
  })
}

// ─── Categories ─────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  if (!navigator.onLine) {
    return cacheGetCategories()
  }
  return withAuth(async () => {
    const records = await pb.collection('categories').getFullList({ sort: 'order', requestKey: null })
    const categories = records as unknown as Category[]
    await cacheSetCategories(categories)
    return categories
  })
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  if (!navigator.onLine) {
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const tempRecord = { ...data, id: tempId, created: new Date().toISOString(), updated: new Date().toISOString() } as Category
    await cachePutCategory(tempRecord)
    await enqueue({ type: 'create', collection: 'categories', recordId: tempId, payload: data as Record<string, unknown> })
    return tempRecord
  }
  return withAuth(async () => {
    const record = await pb.collection('categories').create(data, { requestKey: null })
    const category = record as unknown as Category
    await cachePutCategory(category)
    return category
  })
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  if (!navigator.onLine) {
    const cached = (await cacheGetCategories()).find(c => c.id === id)
    const updated = { ...(cached ?? {}), ...data, id, updated: new Date().toISOString() } as Category
    await cachePutCategory(updated)
    await enqueue({
      type         : 'update',
      collection   : 'categories',
      recordId     : id,
      changedFields: data as Record<string, unknown>,
      baseUpdated  : cached?.updated,
    })
    return updated
  }
  return withAuth(async () => {
    const record = await pb.collection('categories').update(id, data, { requestKey: null })
    const category = record as unknown as Category
    await cachePutCategory(category)
    return category
  })
}

export async function deleteCategory(id: string): Promise<void> {
  if (!navigator.onLine) {
    await cacheDeleteCategory(id)
    await enqueue({ type: 'delete', collection: 'categories', recordId: id })
    return
  }
  return withAuth(async () => {
    await pb.collection('categories').delete(id, { requestKey: null })
    await cacheDeleteCategory(id)
  })
}

// ─── Settings ───────────────────────────────────────
export async function fetchSettings(): Promise<Settings | null> {
  if (!navigator.onLine) {
    return cacheGetSettings()
  }
  try {
    return await withAuth(async () => {
      const records = await pb.collection('settings').getFullList({ requestKey: null })
      const settings = (records[0] as unknown as Settings) ?? null
      if (settings) await cacheSetSettings(settings)
      return settings
    })
  } catch {
    return null
  }
}

export async function upsertSettings(id: string | undefined, data: Partial<Settings>): Promise<Settings> {
  if (!navigator.onLine) {
    const cached = await cacheGetSettings()
    const updated = { ...(cached ?? {}), ...data, id: id ?? cached?.id ?? 'local' } as Settings
    await cacheSetSettings(updated)
    if (id) await enqueue({
      type         : 'update',
      collection   : 'settings',
      recordId     : id,
      changedFields: data as Record<string, unknown>,
      baseUpdated  : cached?.updated,
    })
    return updated
  }
  return withAuth(async () => {
    if (id) {
      const record = await pb.collection('settings').update(id, data, { requestKey: null })
      const settings = record as unknown as Settings
      await cacheSetSettings(settings)
      return settings
    } else {
      const record = await pb.collection('settings').create(data, { requestKey: null })
      const settings = record as unknown as Settings
      await cacheSetSettings(settings)
      return settings
    }
  })
}

// ─── Notifications ──────────────────────────────────────
export async function fetchNotifications(): Promise<Notification[]> {
  return withAuth(async () => {
    const records = await pb.collection('notifications').getFullList({
      sort: 'fire_at',
      requestKey: null,
    })
    return records as unknown as Notification[]
  })
}

export async function fetchPendingNotifications(): Promise<Notification[]> {
  return withAuth(async () => {
    const records = await pb.collection('notifications').getFullList({
      filter: 'status="pending" || status="snoozed"',
      sort: 'fire_at',
      requestKey: null,
    })
    return records as unknown as Notification[]
  })
}

export async function createNotification(data: Partial<Notification>): Promise<Notification> {
  return withAuth(async () => {
    const record = await pb.collection('notifications').create(data, { requestKey: null })
    return record as unknown as Notification
  })
}

export async function updateNotification(id: string, data: Partial<Notification>): Promise<Notification> {
  return withAuth(async () => {
    const record = await pb.collection('notifications').update(id, data, { requestKey: null })
    return record as unknown as Notification
  })
}

/**
 * 특정 schedule 의 모든 알림 삭제 (일정 삭제 시 연동 호출)
 */
export async function deleteNotificationsBySchedule(scheduleId: string): Promise<void> {
  return withAuth(async () => {
    try {
      const records = await pb.collection('notifications').getFullList({
        filter: `schedule_id="${scheduleId}"`,
        fields: 'id',
        requestKey: null,
      })
      for (const r of records) {
        try { await pb.collection('notifications').delete(r.id, { requestKey: null }) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  })
}

/**
 * schedule 의 reminder_mins 배열을 보고 notifications 레코드를 (재)생성
 * - 기존 pending/snoozed 알림 모두 삭제 후 새로 insert
 * - 종일 일정: 하루 전 09:00 UTC 알림만 허용
 * - start_at 없는 Todo: 알림 없음
 */
export async function syncNotificationsForSchedule(
  schedule: Schedule
): Promise<void> {
  if (!schedule.id || !schedule.start_at || schedule.reminder_mins.length === 0) {
    // start_at 없거나 알림 없으면 기존 알림 정리만
    await deleteNotificationsBySchedule(schedule.id)
    return
  }

  return withAuth(async () => {
    // 기존 알림 삭제
    await deleteNotificationsBySchedule(schedule.id)

    const startMs = new Date(schedule.start_at).getTime()
    const now     = new Date()

    for (const mins of schedule.reminder_mins) {
      // 종일 일정: 1440분(하루 전) 만 허용
      if (schedule.is_all_day && mins !== 1440) continue

      let fireAt: Date
      if (schedule.is_all_day) {
        // 하루 전 09:00 로컬 시각
        const startDate = new Date(schedule.start_at)
        fireAt = new Date(startDate)
        fireAt.setDate(fireAt.getDate() - 1)
        fireAt.setHours(9, 0, 0, 0)
      } else {
        fireAt = new Date(startMs - mins * 60 * 1000)
      }

      // 이미 지난 알림은 생성 안 함
      if (fireAt <= now) continue

      await pb.collection('notifications').create({
        schedule_id:   schedule.id,
        fire_at:       fireAt.toISOString(),
        status:        'pending',
        snoozed_until: '',
      }, { requestKey: null })
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
