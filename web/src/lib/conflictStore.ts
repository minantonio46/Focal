/**
 * conflictStore.ts
 *
 * 충돌 정보를 IndexedDB에 보관하고 조회·해결하는 모듈.
 *
 * ConflictRecord 구조:
 * {
 *   id           : 자동 증가 키
 *   collection   : 'schedules' | 'categories' | 'settings'
 *   recordId     : 충돌 레코드 ID
 *   localFields  : 내가 변경하려던 필드 값들
 *   serverRecord : 충돌 당시 서버의 전체 레코드
 *   detectedAt   : 충돌 감지 시각
 * }
 */

import pb, { withAuth } from './pocketbase'
import type { SyncCollection } from './syncQueue'

const DB_NAME    = 'focal-conflicts'
const DB_VERSION = 1
const STORE      = 'conflicts'

export interface ConflictRecord {
  id?          : number
  collection   : SyncCollection
  recordId     : string
  localFields  : Record<string, unknown>   // 내가 변경하려던 필드
  serverRecord : Record<string, unknown>   // 서버의 현재 전체 레코드
  detectedAt   : string
}

// ─── DB 초기화 ───────────────────────────────────────────────────
function openConflictDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ─── 충돌 저장 ───────────────────────────────────────────────────
export async function saveConflict(conflict: Omit<ConflictRecord, 'id' | 'detectedAt'>): Promise<void> {
  const db = await openConflictDB()
  const entry: ConflictRecord = { ...conflict, detectedAt: new Date().toISOString() }
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add(entry)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── 전체 충돌 조회 ──────────────────────────────────────────────
export async function getAllConflicts(): Promise<ConflictRecord[]> {
  const db = await openConflictDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as ConflictRecord[])
    req.onerror   = () => reject(req.error)
  })
}

// ─── 충돌 1개 삭제 ───────────────────────────────────────────────
export async function removeConflict(id: number): Promise<void> {
  const db = await openConflictDB()
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── 충돌 해결: 내 버전 선택 (localFields 로 서버 덮어쓰기) ─────
export async function resolveWithLocal(conflict: ConflictRecord): Promise<void> {
  await withAuth(async () => {
    await pb.collection(conflict.collection).update(
      conflict.recordId,
      conflict.localFields,
      { requestKey: null },
    )
  })
  if (conflict.id !== undefined) await removeConflict(conflict.id)
}

// ─── 충돌 해결: 서버 버전 선택 (로컬 변경 포기, 캐시만 갱신) ───
export async function resolveWithServer(conflict: ConflictRecord): Promise<void> {
  // 서버 데이터를 그대로 캐시에 반영 (api.ts의 fetch 흐름이 처리)
  // 여기선 충돌 레코드만 제거
  if (conflict.id !== undefined) await removeConflict(conflict.id)
}
