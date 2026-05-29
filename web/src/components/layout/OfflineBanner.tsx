/**
 * OfflineBanner.tsx
 *
 * 오프라인 상태 또는 미해결 충돌이 있을 때 화면 상단에 표시되는 배너.
 * - 오프라인: 노란 경고 배너 (미동기화 건수 포함)
 * - 동기화 중: 파란 배너 (오프라인 → 온라인 전환 직후 2초)
 * - 충돌 대기: 주황 배너
 */

import { useEffect, useRef, useState } from 'react'
import useAppStore from '../../stores/useAppStore'
import { getQueueSize } from '../../lib/syncQueue'

export default function OfflineBanner() {
  const isOnline  = useAppStore((s) => s.isOnline)
  const conflicts = useAppStore((s) => s.conflicts)

  const [queueSize,   setQueueSize]   = useState(0)
  const [showSyncing, setShowSyncing] = useState(false)

  // 이전 온라인 상태를 ref 로 추적 (첫 렌더는 건너뜀)
  const prevOnlineRef  = useRef<boolean | null>(null)
  const isFirstRender  = useRef(true)

  // 큐 크기 주기 갱신 (오프라인일 때만)
  useEffect(() => {
    if (isOnline) { setQueueSize(0); return }
    const update = () => { getQueueSize().then(setQueueSize).catch(() => {}) }
    update()
    const id = setInterval(update, 5_000)
    return () => clearInterval(id)
  }, [isOnline])

  // 오프라인 → 온라인 전환 감지: "동기화 중" 배너 2초
  useEffect(() => {
    // 첫 렌더(앱 시작)는 무시
    if (isFirstRender.current) {
      isFirstRender.current  = false
      prevOnlineRef.current  = isOnline
      return
    }

    const wasOffline = prevOnlineRef.current === false
    prevOnlineRef.current = isOnline

    if (isOnline && wasOffline) {
      setShowSyncing(true)
      const id = setTimeout(() => setShowSyncing(false), 2_000)
      return () => clearTimeout(id)
    }
  }, [isOnline])

  // ── 렌더 분기 ─────────────────────────────────────────────────

  // 동기화 중 (오프라인 복귀 직후)
  if (showSyncing) {
    return (
      <div className="flex items-center gap-2 bg-blue-600 px-4 py-2 text-sm text-white">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        서버와 동기화 중…
      </div>
    )
  }

  // 오프라인
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 bg-yellow-500 px-4 py-2 text-sm text-gray-900">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="font-medium">오프라인 모드</span>
        <span className="text-gray-700">— 로컬 캐시로 동작 중입니다.</span>
        {queueSize > 0 && (
          <span className="ml-auto rounded-full bg-yellow-700 px-2 py-0.5 text-xs text-white">
            미동기화 {queueSize}건
          </span>
        )}
      </div>
    )
  }

  // 미해결 충돌
  if (conflicts.length > 0) {
    return (
      <div className="flex items-center gap-2 bg-orange-600 px-4 py-2 text-sm text-white">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="font-medium">동기화 충돌</span>
        <span className="text-orange-200">— {conflicts.length}건의 충돌을 해결해 주세요.</span>
      </div>
    )
  }

  return null
}
