import pb from './pocketbase'
import type { Schedule, Category, Settings } from '../types'

// ─── Schedules ──────────────────────────────────────
export async function fetchSchedules(): Promise<Schedule[]> {
  const records = await pb.collection('schedules').getFullList({
    sort: 'start_at',
  })
  return records as unknown as Schedule[]
}

export async function createSchedule(data: Partial<Schedule>): Promise<Schedule> {
  const record = await pb.collection('schedules').create(data)
  return record as unknown as Schedule
}

export async function updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
  const record = await pb.collection('schedules').update(id, data)
  return record as unknown as Schedule
}

export async function deleteSchedule(id: string): Promise<void> {
  await pb.collection('schedules').delete(id)
}

// ─── Categories ─────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  const records = await pb.collection('categories').getFullList({
    sort: 'order',
  })
  return records as unknown as Category[]
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  const record = await pb.collection('categories').create(data)
  return record as unknown as Category
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  const record = await pb.collection('categories').update(id, data)
  return record as unknown as Category
}

export async function deleteCategory(id: string): Promise<void> {
  await pb.collection('categories').delete(id)
}

// ─── Settings ───────────────────────────────────────
export async function fetchSettings(): Promise<Settings | null> {
  try {
    const records = await pb.collection('settings').getFullList()
    return records[0] as unknown as Settings ?? null
  } catch {
    return null
  }
}

export async function upsertSettings(id: string | undefined, data: Partial<Settings>): Promise<Settings> {
  if (id) {
    const record = await pb.collection('settings').update(id, data)
    return record as unknown as Settings
  } else {
    const record = await pb.collection('settings').create(data)
    return record as unknown as Settings
  }
}
