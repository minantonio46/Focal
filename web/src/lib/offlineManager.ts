/**
 * offlineManager.ts
 *
 * 온/오프라인 상태 감지 + 자동 동기화 오케스트레이터.
 *
 * 역할:
 *  1. navigator.onLine + window 'online'/'offline' 이벤트 감지
 *  2. 오프라인 → 온라인 복귀 시:
 *     a) syncQueue.flushQueue() — 오프라인 중 변경 사항 서버 반영
 *        - 충돌 발생 시 conflictStore 에 저장 → store.conflicts 에 반영
 *     b) PocketBase 최신 데이터 full fetch → 캐시 갱신 → Zustand store 반영
 *  3. 앱 시작 시 미해결 충돌이 있으면 store 에 로드
 */

import { fetchSchedules, fetchCategories, fetchSettings, runAutoDelete } from './api'
import { refreshCache } from './offlineCache'
import { flushQueue, getQueueSize } from './syncQueue'
import { saveConflict, getAllConflicts } from './conflictStore'
import useAppStore from '../stores/useAppStore'

// ─── 내부 상태 ───────────────────────────────────────────────────
let _isSyncing = false

// ─── 온라인 복귀 핸들러 ──────────────────────────────────────────
async function handleOnline(): Promise<void> {
  const { setIsOnline, setSchedules, setCategories, setSettings, setConflicts } = useAppStore.getState()
  setIsOnline(true)

  if (_isSyncing) return
  _isSyncing = true

  try {
    // 1. 오프라인 중 쌓인 작업 플러시
    const queueSize = await getQueueSize()
    if (queueSize > 0) {
      console.info(`[OfflineManager] 큐 플러시 시작 (${queueSize}개)`)
      const { successCount, conflicts } = await flushQueue()
      console.info(`[OfflineManager] 플러시 완료 (성공: ${successCount}, 충돌: ${conflicts.length})`)

      // 충돌 저장
      for (const conflict of conflicts) {
        await saveConflict({
          collection  : conflict.op.collection,
          recordId    : conflict.op.recordId,
          localFields : conflict.op.changedFields ?? {},
          serverRecord: conflict.serverRecord,
        })
      }
    }

    // 2. 서버 최신 데이터 fetch
    const [schedules, categories, settings] = await Promise.all([
      fetchSchedules(),
      fetchCategories(),
      fetchSettings(),
    ])

    // 3. 캐시 갱신
    await refreshCache(schedules, categories, settings)

    // 4. Zustand store 반영
    setSchedules(schedules)
    setCategories(categories)
    if (settings) setSettings(settings)

    // 5. 미해결 충돌 store 반영
    const allConflicts = await getAllConflicts()
    setConflicts(allConflicts)

    // 6. 자동 삭제 (서버 최신 settings 기반으로 실행)
    if (settings) {
      runAutoDelete(
        settings.todo_delete_days     ?? 30,
        settings.schedule_delete_days ?? 180,
      ).catch((err) => console.warn('[OfflineManager] runAutoDelete 실패:', err))
    }

    console.info('[OfflineManager] 동기화 완료')
  } catch (err) {
    console.warn('[OfflineManager] 동기화 중 오류:', err)
  } finally {
    _isSyncing = false
  }
}

// ─── 오프라인 전환 핸들러 ────────────────────────────────────────
function handleOffline(): void {
  const { setIsOnline } = useAppStore.getState()
  setIsOnline(false)
  console.info('[OfflineManager] 오프라인 전환')
}

// ─── 이벤트 핸들러 참조 (removeEventListener 용) ─────────────────
const _onlineHandler  = () => void handleOnline()
const _offlineHandler = () => handleOffline()

// ─── 초기화 & 해제 ───────────────────────────────────────────────
export async function initOfflineManager(): Promise<void> {
  const { setIsOnline, setConflicts } = useAppStore.getState()
  setIsOnline(navigator.onLine)

  // 앱 시작 시 미해결 충돌 로드
  try {
    const allConflicts = await getAllConflicts()
    if (allConflicts.length > 0) {
      setConflicts(allConflicts)
    }
  } catch { /* 무시 */ }

  window.addEventListener('online',  _onlineHandler)
  window.addEventListener('offline', _offlineHandler)

  // 앱 시작 시 온라인이면 한 번 동기화
  if (navigator.onLine) {
    void handleOnline()
  }
}

export function destroyOfflineManager(): void {
  window.removeEventListener('online',  _onlineHandler)
  window.removeEventListener('offline', _offlineHandler)
}
