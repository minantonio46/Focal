import pb, { withAuth } from './pocketbase'
import type { Schedule, Category, Settings } from '../types'

// requestKey: null → PocketBase SDK 자동취소 비활성화
// (같은 엔드포인트 중복 호출 시 이전 요청이 abort되는 문제 방지)

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

  // Todo 자동 삭제
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
  } catch { /* 전체 실패 시 무시 */ }

  // 일정 자동 삭제
  const scheduleThresholdStr = toFilterStr(
    new Date(now.getTime() - scheduleDeleteDays * 24 * 60 * 60 * 1000)
  )
  try {
    const oldSchedules = await withAuth(() =>
      pb.collection('schedules').getFullList({
        filter: `is_todo=false && end_at!="" && end_at<"${scheduleThresholdStr}"`,
        fields: 'id',
        requestKey: null,
      })
    )
    for (const item of oldSchedules) {
      try { await pb.collection('schedules').delete(item.id) } catch { /* 개별 실패 무시 */ }
    }
  } catch { /* 전체 실패 시 무시 */ }
}
