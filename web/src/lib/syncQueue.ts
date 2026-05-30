/**
 * syncQueue.ts
 *
 * 오프라인 상태에서 발생한 CRUD 작업을 IndexedDB 큐에 저장하고,
 * 온라인 복귀 시 순서대로 재실행합니다.
 *
 * 큐 항목 구조 (SyncOp):
 * {
 *   id          : 자동 증가 키
 *   type        : 'create' | 'update' | 'delete'
 *   collection  : 'schedules' | 'categories' | 'settings'
 *   recordId    : 대상 레코드 ID
 *   changedFields: 변경된 필드만 담은 객체 (update 시)
 *   payload     : create 전체 데이터
 *   baseUpdated : 오프라인 수정 당시 서버 레코드의 updated 값 (충돌 감지용)
 *   createdAt   : 큐에 추가된 ISO 시각
 * }
 *
 * 충돌 해결 전략:
 *   1. update 플러시 시 서버의 현재 updated vs baseUpdated 비교
 *   2. 서버가 더 최신(= 다른 기기에서 수정됨) → ConflictError throw
 *   3. offlineManager 가 충돌 정보를 conflictStore 에 저장
 *   4. 사용자가 ConflictModal 에서 "내 버전" / "서버 버전" 선택
 *   5. 같은 필드가 아닌 경우(필드 단위 비교)는 자동 병합
 */

import pb, { withAuth } from './pocketbase'

const DB_NAME    = 'focal-sync-queue'
const DB_VERSION = 1
const STORE      = 'ops'

export type SyncOpType     = 'create' | 'update' | 'delete'
export type SyncCollection = 'schedules' | 'categories' | 'settings'

export interface SyncOp {
  id?           : number
  type          : SyncOpType
  collection    : SyncCollection
  recordId      : string
  changedFields?: Record<string, unknown>   // update: 변경된 필드만
  payload?      : Record<string, unknown>   // create: 전체 데이터
  baseUpdated?  : string                    // update: 수정 당시 서버 updated 값
  createdAt     : string
}

/** 충돌 감지 시 throw 되는 에러 */
export class ConflictError extends Error {
  constructor(
    public readonly op: SyncOp,
    public readonly serverRecord: Record<string, unknown>,
  ) {
    super(`Conflict on ${op.collection}/${op.recordId}`)
    this.name = 'ConflictError'
  }
}

// ─── DB 초기화 ───────────────────────────────────────────────────
function openQueueDB(): Promise<IDBDatabase> {
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

// ─── 큐에 추가 ───────────────────────────────────────────────────
export async function enqueue(op: Omit<SyncOp, 'id' | 'createdAt'>): Promise<void> {
  const db = await openQueueDB()
  const entry: SyncOp = { ...op, createdAt: new Date().toISOString() }
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add(entry)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── 전체 큐 조회 ────────────────────────────────────────────────
export async function getAllOps(): Promise<SyncOp[]> {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as SyncOp[])
    req.onerror   = () => reject(req.error)
  })
}

// ─── 큐 항목 1개 삭제 ────────────────────────────────────────────
async function dequeue(id: number): Promise<void> {
  const db = await openQueueDB()
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── 큐 비우기 ───────────────────────────────────────────────────
export async function clearQueue(): Promise<void> {
  const db = await openQueueDB()
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

// ─── 큐 크기 조회 ────────────────────────────────────────────────
export async function getQueueSize(): Promise<number> {
  const ops = await getAllOps()
  return ops.length
}

// ─── 플러시 결과 타입 ────────────────────────────────────────────
export interface FlushResult {
  successCount : number
  conflicts    : ConflictError[]
}

// ─── 플러시: 큐의 모든 작업을 PocketBase에 순서대로 실행 ────────
export async function flushQueue(): Promise<FlushResult> {
  const ops = await getAllOps()
  if (ops.length === 0) return { successCount: 0, conflicts: [] }

  let successCount = 0
  const conflicts: ConflictError[] = []
  // 오프라인 임시 ID → 실제 PB ID 매핑 (같은 플러시 세션 내)
  const idMap = new Map<string, string>()

  for (const op of ops) {
    try {
      if (op.type === 'update' && op.baseUpdated) {
        // update op의 recordId 자체가 임시 ID인 경우 실제 ID로 교체
        const resolvedRecordId = idMap.get(op.recordId) ?? op.recordId
        // changedFields 내부의 임시 ID 참조도 교체
        const resolvedFields: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(op.changedFields ?? {})) {
          resolvedFields[key] = (typeof val === 'string' && idMap.has(val)) ? idMap.get(val)! : val
        }

        // ── 충돌 감지: withAuth 밖에서 처리 (ConflictError 가 삼켜지지 않도록) ──
        let serverRecord: Record<string, unknown>
        try {
          serverRecord = await withAuth(() =>
            pb.collection(op.collection).getOne(resolvedRecordId, { requestKey: null })
          ) as Record<string, unknown>
        } catch (fetchErr) {
          if (fetchErr instanceof Error && fetchErr.message.includes('404')) {
            // 레코드자체가 삭제됨 → 큐에서 제거 후 다음 작업
            if (op.id !== undefined) await dequeue(op.id)
            successCount++
            continue
          }
          throw fetchErr
        }

        const serverUpdated = serverRecord['updated'] as string | undefined
        if (serverUpdated && serverUpdated > op.baseUpdated) {
          const changedFields   = op.changedFields ?? {}
          const hasRealConflict = Object.keys(changedFields).some(
            (key) => key in serverRecord &&
                     JSON.stringify(serverRecord[key]) !== JSON.stringify(changedFields[key])
          )
          if (hasRealConflict) {
            conflicts.push(new ConflictError(op, serverRecord))
            if (op.id !== undefined) await dequeue(op.id)
            continue
          }
          // 충돌 필드 없음 → 자동 병합으로 진행
        }

        // 충돌 없음: 변경된 필드만 patch
        await withAuth(() =>
          pb.collection(op.collection).update(
            op.recordId,
            op.changedFields ?? {},
            { requestKey: null },
          )
        )
      } else {
        await withAuth(async () => {
          if (op.type === 'create') {
            // payload 내 임시 ID 참조를 실제 ID로 교체
            const payload = { ...(op.payload ?? {}) }
            for (const [tempId, realId] of idMap) {
              for (const key of Object.keys(payload)) {
                if (payload[key] === tempId) payload[key] = realId
              }
            }
            const created = await pb.collection(op.collection).create(payload, { requestKey: null })
            // 임시 ID → 실제 ID 매핑 저장
            if (op.recordId.startsWith('offline_')) {
              idMap.set(op.recordId, (created as Record<string, unknown>)['id'] as string)
            }
          } else if (op.type === 'delete') {
            // 실제 ID로 대체 후 삭제
            const targetId = idMap.get(op.recordId) ?? op.recordId
            await pb.collection(op.collection).delete(targetId, { requestKey: null })
          } else {
            // update 이지만 baseUpdated 없는 레거시 항목
            await pb.collection(op.collection).update(
              op.recordId,
              op.changedFields ?? op.payload ?? {},
              { requestKey: null },
            )
          }
        })
      }

      if (op.id !== undefined) await dequeue(op.id)
      successCount++
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        if (op.id !== undefined) await dequeue(op.id)
        successCount++
      } else {
        console.warn('[SyncQueue] op failed, will retry:', op, err)
      }
    }
  }

  return { successCount, conflicts }
}
