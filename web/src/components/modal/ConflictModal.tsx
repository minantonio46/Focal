/**
 * ConflictModal.tsx
 *
 * 미해결 충돌이 있을 때 표시되는 모달.
 * 충돌마다 "내 버전 유지" / "서버 버전 사용" 선택.
 */

import { useState } from 'react'
import useAppStore from '../../stores/useAppStore'
import {
  resolveWithLocal,
  resolveWithServer,
  type ConflictRecord,
} from '../../lib/conflictStore'
import { fetchSchedules, fetchCategories, fetchSettings } from '../../lib/api'
import { refreshCache } from '../../lib/offlineCache'

const FIELD_LABELS: Record<string, string> = {
  title             : '제목',
  description       : '메모',
  location          : '장소',
  start_at          : '시작 시각',
  end_at            : '종료 시각',
  is_all_day        : '종일',
  is_todo           : 'Todo',
  is_completed      : '완료',
  importance        : '중요도',
  category_id       : '카테고리',
  sub_category_id   : '소카테고리',
  deadline_precision: '마감 정밀도',
  expire_type       : '기한 초과',
  repeat_type       : '반복',
  reminder_mins     : '알림',
  name              : '이름',
  color             : '색상',
  default_importance: '기본 중요도',
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '(없음)'
  if (typeof val === 'boolean') return val ? '예' : '아니오'
  if (Array.isArray(val)) return val.length === 0 ? '(없음)' : val.join(', ')
  if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toLocaleString('ko-KR')
  }
  return String(val)
}

interface ConflictCardProps {
  conflict  : ConflictRecord
  index     : number
  total     : number
  onResolved: () => void
}

function ConflictCard({ conflict, index, total, onResolved }: ConflictCardProps) {
  // [B3 수정] getState() 대신 훅으로 store 구독 → 해결 후 UI 반영 보장
  const setSchedules   = useAppStore((s) => s.setSchedules)
  const setCategories  = useAppStore((s) => s.setCategories)
  const setSettings    = useAppStore((s) => s.setSettings)
  const removeConflict = useAppStore((s) => s.removeConflict)

  const [resolving, setResolving] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // [B4 수정] 값이 실제로 다른 필드만 표시
  const conflictingFields = Object.keys(conflict.localFields).filter((key) => {
    if (!(key in conflict.serverRecord)) return false
    return JSON.stringify(conflict.localFields[key]) !== JSON.stringify(conflict.serverRecord[key])
  })

  async function handleResolve(choice: 'local' | 'server') {
    setResolving(true)
    setError(null)
    try {
      if (choice === 'local') {
        await resolveWithLocal(conflict)
      } else {
        await resolveWithServer(conflict)
      }

      // 서버 최신 데이터 반영
      const [schedules, categories, settings] = await Promise.all([
        fetchSchedules(),
        fetchCategories(),
        fetchSettings(),
      ])
      await refreshCache(schedules, categories, settings)
      setSchedules(schedules)
      setCategories(categories)
      if (settings) setSettings(settings)

      if (conflict.id !== undefined) removeConflict(conflict.id)
      onResolved()
    } catch (err) {
      console.error('[ConflictModal] 해결 실패:', err)
      setError('처리 중 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {index + 1} / {total} — {conflict.collection}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(conflict.detectedAt).toLocaleString('ko-KR')}
        </span>
      </div>

      {/* 충돌 레코드 제목 */}
      <p className="mb-3 font-medium text-white">
        {(conflict.serverRecord['title'] as string | undefined) ??
         (conflict.serverRecord['name']  as string | undefined) ??
         conflict.recordId}
      </p>

      {/* 필드 비교 테이블 */}
      {conflictingFields.length > 0 ? (
        <div className="mb-4 overflow-hidden rounded border border-gray-600 text-sm">
          <div className="grid grid-cols-3 bg-gray-700 px-3 py-2 font-medium text-gray-300">
            <span>필드</span>
            <span className="text-yellow-400">내 변경</span>
            <span className="text-blue-400">서버 (다른 기기)</span>
          </div>
          {conflictingFields.map((key) => (
            <div key={key} className="grid grid-cols-3 border-t border-gray-600 px-3 py-2 text-gray-300">
              <span className="text-gray-400">{FIELD_LABELS[key] ?? key}</span>
              <span className="text-yellow-300">{formatValue(conflict.localFields[key])}</span>
              <span className="text-blue-300">{formatValue(conflict.serverRecord[key])}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-gray-400">충돌 필드를 특정할 수 없습니다. 버전을 선택해 주세요.</p>
      )}

      {/* 오류 메시지 */}
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {/* 선택 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={() => void handleResolve('local')}
          disabled={resolving}
          className="flex-1 rounded bg-yellow-500 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-400 disabled:opacity-50"
        >
          내 버전 유지
        </button>
        <button
          onClick={() => void handleResolve('server')}
          disabled={resolving}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          서버 버전 사용
        </button>
      </div>
    </div>
  )
}

export default function ConflictModal() {
  const conflicts     = useAppStore((s) => s.conflicts)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (conflicts.length === 0) return null

  const safeIndex = Math.min(currentIndex, conflicts.length - 1)
  const current   = conflicts[safeIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl bg-gray-900 shadow-2xl">
        {/* 모달 헤더 */}
        <div className="flex items-center gap-3 border-b border-gray-700 px-5 py-4">
          <svg className="h-5 w-5 shrink-0 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <h2 className="font-semibold text-white">동기화 충돌 발생</h2>
            <p className="text-xs text-gray-400">
              오프라인 중 수정된 내용과 다른 기기의 변경이 겹쳤습니다. 어느 버전을 사용할지 선택해 주세요.
            </p>
          </div>
        </div>

        {/* 충돌 카드 */}
        <div className="p-5">
          <ConflictCard
            conflict={current}
            index={safeIndex}
            total={conflicts.length}
            onResolved={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          />
        </div>

        {/* 여러 개일 때 네비게이션 */}
        {conflicts.length > 1 && (
          <div className="flex items-center justify-between border-t border-gray-700 px-5 py-3">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30"
            >
              ← 이전
            </button>
            <span className="text-xs text-gray-500">{safeIndex + 1} / {conflicts.length}</span>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(conflicts.length - 1, i + 1))}
              disabled={safeIndex === conflicts.length - 1}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30"
            >
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
