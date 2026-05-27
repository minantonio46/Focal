import pb, { withAuth } from './pocketbase'
import type { Schedule, Category, Settings } from '../types'

// ─── Schedules ──────────────────────────────────────
// 서버 정렬 없이 전체 가져옴 (정렬은 프론트에서 처리)
export async function fetchSchedules(): Promise<Schedule[]> {
  return withAuth(async () => {
    const records = await pb.collection('schedules').getFullList()
    return records as unknown as Schedule[]
  })
}

export async function createSchedule(data: Partial<Schedule>): Promise<Schedule> {
  return withAuth(async () => {
    const record = await pb.collection('schedules').create(data)
    return record as unknown as Schedule
  })
}

export async function updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
  return withAuth(async () => {
    const record = await pb.collection('schedules').update(id, data)
    return record as unknown as Schedule
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  return withAuth(async () => {
    await pb.collection('schedules').delete(id)
  })
}

// ─── Categories ─────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  return withAuth(async () => {
    const records = await pb.collection('categories').getFullList({ sort: 'order' })
    return records as unknown as Category[]
  })
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  return withAuth(async () => {
    const record = await pb.collection('categories').create(data)
    return record as unknown as Category
  })
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  return withAuth(async () => {
    const record = await pb.collection('categories').update(id, data)
    return record as unknown as Category
  })
}

export async function deleteCategory(id: string): Promise<void> {
  return withAuth(async () => {
    await pb.collection('categories').delete(id)
  })
}

// ─── Settings ───────────────────────────────────────
export async function fetchSettings(): Promise<Settings | null> {
  try {
    return await withAuth(async () => {
      const records = await pb.collection('settings').getFullList()
      return (records[0] as unknown as Settings) ?? null
    })
  } catch {
    return null
  }
}

export async function upsertSettings(id: string | undefined, data: Partial<Settings>): Promise<Settings> {
  return withAuth(async () => {
    if (id) {
      const record = await pb.collection('settings').update(id, data)
      return record as unknown as Settings
    } else {
      const record = await pb.collection('settings').create(data)
      return record as unknown as Settings
    }
  })
}

// ─── 자동 삭제 ────────────────────────────────────────
// 앱 시작 시 한 번 실행 (백그라운드)
// - Todo: is_completed=true이고 completed_at이 todoDeleteDays일 이상 지난 항목 삭제
// - 일정: end_at이 scheduleDeleteDays일 이상 지난 항목 삭제
export async function runAutoDelete(
  todoDeleteDays: number,
  scheduleDeleteDays: number
): Promise<void> {
  const now = new Date()

  // PocketBase 필터용 datetime 문자열 (UTC, 공백 구분자)
  function toFilterStr(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '')
  }

  // ── Todo 자동 삭제 ──
  const todoThresholdStr = toFilterStr(
    new Date(now.getTime() - todoDeleteDays * 24 * 60 * 60 * 1000)
  )
  try {
    const oldTodos = await withAuth(() =>
      pb.collection('schedules').getFullList({
        filter: `is_todo=true && is_completed=true && completed_at!="" && completed_at<"${todoThresholdStr}"`,
        fields: 'id',
      })
    )
    for (const item of oldTodos) {
      try { await pb.collection('schedules').delete(item.id) } catch { /* 개별 실패 무시 */ }
    }
  } catch { /* 전체 실패 시 무시 */ }

  // ── 일정 자동 삭제 ──
  const scheduleThresholdStr = toFilterStr(
    new Date(now.getTime() - scheduleDeleteDays * 24 * 60 * 60 * 1000)
  )
  try {
    const oldSchedules = await withAuth(() =>
      pb.collection('schedules').getFullList({
        filter: `is_todo=false && end_at!="" && end_at<"${scheduleThresholdStr}"`,
        fields: 'id',
      })
    )
    for (const item of oldSchedules) {
      try { await pb.collection('schedules').delete(item.id) } catch { /* 개별 실패 무시 */ }
    }
  } catch { /* 전체 실패 시 무시 */ }
}
