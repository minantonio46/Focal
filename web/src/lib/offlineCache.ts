/**
 * offlineCache.ts
 *
 * IndexedDB 기반 로컬 캐시.
 * 오프라인 상태에서 schedules / categories / settings 를
 * 읽고 쓸 수 있도록 지원합니다.
 *
 * DB 구조
 * ┌─ focal-cache (DB)
 * │  ├─ schedules  (objectStore, keyPath: 'id')
 * │  ├─ categories (objectStore, keyPath: 'id')
 * │  └─ settings   (objectStore, keyPath: 'id')
 * └─ focal-sync-queue (별도 DB — syncQueue.ts 에서 사용)
 */

import type { Schedule, Category, Settings } from '../types'

const DB_NAME    = 'focal-cache'
const DB_VERSION = 1

// ─── DB 초기화 ───────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('schedules')) {
        db.createObjectStore('schedules', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ─── 공통 헬퍼 ───────────────────────────────────────────────────
function txGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror   = () => reject(req.error)
  })
}

function txPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).put(value)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

function txPutAll<T>(db: IDBDatabase, store: string, values: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    os.clear()
    for (const v of values) os.put(v)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

function txDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── Schedules ───────────────────────────────────────────────────
export async function cacheGetSchedules(): Promise<Schedule[]> {
  const db = await openDB()
  return txGetAll<Schedule>(db, 'schedules')
}

export async function cacheSetSchedules(schedules: Schedule[]): Promise<void> {
  // 런타임 전용 필드 제거 + completed_dates/excluded_dates 기본값 보장
  const clean = schedules.map(({ _isVirtual: _, _occurrenceDate: __, ...s }) => ({
    ...s,
    completed_dates: s.completed_dates ?? [],
    excluded_dates:  s.excluded_dates  ?? [],
  }))
  const db = await openDB()
  return txPutAll(db, 'schedules', clean)
}

export async function cachePutSchedule(schedule: Schedule): Promise<void> {
  const { _isVirtual: _, _occurrenceDate: __, ...rest } = schedule
  const clean = {
    ...rest,
    completed_dates: rest.completed_dates ?? [],
    excluded_dates:  rest.excluded_dates  ?? [],
  }
  const db = await openDB()
  return txPut(db, 'schedules', clean)
}

export async function cacheDeleteSchedule(id: string): Promise<void> {
  const db = await openDB()
  return txDelete(db, 'schedules', id)
}

// ─── Categories ──────────────────────────────────────────────────
export async function cacheGetCategories(): Promise<Category[]> {
  const db = await openDB()
  return txGetAll<Category>(db, 'categories')
}

export async function cacheSetCategories(categories: Category[]): Promise<void> {
  const db = await openDB()
  return txPutAll(db, 'categories', categories)
}

export async function cachePutCategory(category: Category): Promise<void> {
  const db = await openDB()
  return txPut(db, 'categories', category)
}

export async function cacheDeleteCategory(id: string): Promise<void> {
  const db = await openDB()
  return txDelete(db, 'categories', id)
}

// ─── Settings ────────────────────────────────────────────────────
export async function cacheGetSettings(): Promise<Settings | null> {
  const db = await openDB()
  // settings는 레코드가 1개이므로 getAll 후 첫 번째 반환
  const all = await txGetAll<Settings>(db, 'settings')
  return all[0] ?? null
}

export async function cacheSetSettings(settings: Settings): Promise<void> {
  const db = await openDB()
  return txPut(db, 'settings', settings)
}

// ─── 전체 캐시 갱신 (온라인 복귀 시 호출) ──────────────────────
export async function refreshCache(
  schedules: Schedule[],
  categories: Category[],
  settings: Settings | null,
): Promise<void> {
  await cacheSetSchedules(schedules)
  await cacheSetCategories(categories)
  if (settings) await cacheSetSettings(settings)
}
