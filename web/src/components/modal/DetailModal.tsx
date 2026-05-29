import { useState } from 'react'
import type { Schedule, Category } from '../../types'
import { formatDateTime } from '../../lib/dateUtils'
import { isRepeatSchedule, REPEAT_TYPE_LABELS } from '../../lib/repeatUtils'
import { deleteOccurrence, deleteFromOccurrence, deleteAllOccurrences } from '../../lib/api'
import useAppStore from '../../stores/useAppStore'
import ScheduleFormModal from './ScheduleFormModal'
import RepeatDialog from './RepeatDialog'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  item:       Schedule
  categories: Category[]
  onClose:    () => void
  onUpdate:   () => void
  /**
   * 삭제 완료 신호. id가 비어있으면 그룹 삭제(이미 처리됨) 후 상위에서 reload만.
   * id가 있으면 단일 삭제 → 상위에서 해당 id를 스토어에서 제거.
   */
  onDelete:   (id: string) => void
}

type RepeatEditChoice = 'this' | 'this_and_after' | 'all'

export default function DetailModal({ item, categories, onClose, onUpdate, onDelete }: Props) {
  const [showEdit, setShowEdit]               = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [repeatDialogMode, setRepeatDialogMode] = useState<'edit' | 'delete' | null>(null)
  const [pendingEditMode, setPendingEditMode]  = useState<RepeatEditChoice | null>(null)
  const [isDeleting, setIsDeleting]            = useState(false)

  const { settings } = useAppStore()
  const timeFormat = settings?.time_format ?? '24h'
  const isRepeat   = isRepeatSchedule(item)

  const cat    = categories.find(c => c.id === item.category_id)
  const subCat = categories.find(c => c.id === item.sub_category_id)
  const accentColor = subCat?.color ?? cat?.color ?? '#3B82F6'

  const isExpired = item.expire_type === 'expire'
    && !!item.start_at
    && new Date(item.start_at) < new Date()
    && !item.is_completed

  // 목록 뷰에서 부모 레코드를 직접 열었을 때
  // (캘린더의 가상 인스턴스가 아니고 parent_id도 없는 순수 부모)
  const isDirectParent = isRepeat && !item._isVirtual && !item.parent_id

  // ── 편집 ────────────────────────────────────────────────
  function handleEditClick() {
    if (isRepeat && !isDirectParent) {
      setRepeatDialogMode('edit')
    } else {
      setShowEdit(true)  // 직접 부모는 바로 편집 (= 모두 편집)
    }
  }

  function handleRepeatEditSelect(choice: RepeatEditChoice) {
    setRepeatDialogMode(null)
    setPendingEditMode(choice)
    setShowEdit(true)
  }

  // ── 삭제 ────────────────────────────────────────────────
  function handleDeleteClick() {
    if (isRepeat && !isDirectParent) {
      setRepeatDialogMode('delete')
    } else if (isDirectParent) {
      // 목록에서 부모 레코드 직접 삭제 → 전체 삭제 확인
      setShowConfirmDelete(true)
    } else {
      setShowConfirmDelete(true)
    }
  }

  async function handleDirectParentDelete() {
    setShowConfirmDelete(false)
    setIsDeleting(true)
    try {
      await deleteAllOccurrences({ ...item, parent_id: '', id: item.id } as typeof item)
      onDelete('')
    } catch (err) {
      console.error('반복 일정 삭제 실패:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRepeatDeleteSelect(choice: RepeatEditChoice) {
    setRepeatDialogMode(null)
    setIsDeleting(true)
    try {
      if (choice === 'this') {
        await deleteOccurrence(item)
      } else if (choice === 'this_and_after') {
        await deleteFromOccurrence(item)
      } else {
        await deleteAllOccurrences(item)
      }
      onDelete('')
    } catch (err) {
      console.error('반복 일정 삭제 실패:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── 편집 모달 ─────────────────────────────────────────
  if (showEdit) {
    return (
      <ScheduleFormModal
        editItem={item}
        repeatEditMode={pendingEditMode ?? undefined}
        onClose={() => { setShowEdit(false); setPendingEditMode(null) }}
        onSave={() => { setShowEdit(false); setPendingEditMode(null); onUpdate() }}
      />
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-gray-900 rounded-xl w-full max-w-md overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* 카테고리 색상 액센트 바 */}
          <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">
                {item.is_todo ? 'Todo' : '일정'}
              </span>
              {item.is_all_day && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">종일</span>
              )}
              {item.is_completed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">완료</span>
              )}
              {isExpired && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">만료</span>
              )}
              {/* 반복 배지 */}
              {isRepeat && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  🔁 {item.repeat_type !== 'none' ? REPEAT_TYPE_LABELS[item.repeat_type] : '반복'}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* 본문 */}
          <div className="px-5 py-4 flex flex-col gap-3">

            {/* 제목 */}
            <div className="pl-3 border-l-4 rounded-r" style={{ borderColor: accentColor }}>
              <h3 className={`text-lg font-semibold leading-snug ${
                item.is_completed ? 'line-through text-gray-500' : 'text-white'
              }`}>
                {item.title}
              </h3>
            </div>

            {/* 카테고리 */}
            {(cat || subCat) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {cat && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: cat.color + '28', color: cat.color }}>
                    {cat.name}
                  </span>
                )}
                {subCat && (
                  <>
                    <span className="text-gray-600 text-xs">›</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: subCat.color + '28', color: subCat.color }}>
                      {subCat.name}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* 시간 */}
            {item.start_at && (
              <div className="flex items-start gap-2.5 text-sm text-gray-400">
                <span className="mt-0.5 flex-shrink-0">🕐</span>
                <span className="leading-relaxed">
                  {item.is_all_day
                    ? new Date(item.start_at).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })
                    : formatDateTime(item.start_at, timeFormat)
                  }
                  {!item.is_todo && item.end_at && (
                    item.is_all_day
                      ? ` ~ ${new Date(item.end_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
                      : ` ~ ${formatDateTime(item.end_at, timeFormat)}`
                  )}
                </span>
              </div>
            )}

            {/* 중요도 */}
            <div className="flex items-center gap-2.5 text-sm text-gray-400">
              <span className="flex-shrink-0">⭐</span>
              <div className="flex items-center gap-2">
                <span>중요도</span>
                <div className="w-24 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(item.importance / 10) * 100}%`,
                    backgroundColor: accentColor,
                  }} />
                </div>
                <span className="text-xs tabular-nums">{item.importance.toFixed(1)}</span>
              </div>
            </div>

            {/* 장소 */}
            {item.location && (
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <span className="flex-shrink-0">📍</span>
                <span>{item.location}</span>
              </div>
            )}

            {/* 메모 */}
            {item.description && (
              <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-700/50">
                {item.description}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="flex gap-2 px-5 py-4 border-t border-gray-800">
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleEditClick}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-white"
              style={{ backgroundColor: accentColor }}
            >
              편집
            </button>
          </div>
        </div>
      </div>

      {/* 반복 수정/삭제 범위 선택 다이얼로그 */}
      {repeatDialogMode && (
        <RepeatDialog
          mode={repeatDialogMode}
          onClose={() => setRepeatDialogMode(null)}
          onSelect={choice => {
            if (repeatDialogMode === 'edit') handleRepeatEditSelect(choice)
            else handleRepeatDeleteSelect(choice)
          }}
        />
      )}

      {/* 비반복 삭제 확인 다이얼로그 */}
      {showConfirmDelete && (
        <ConfirmDialog
          title={`"${item.title}" 삭제`}
          message={
            isDirectParent
              ? `반복 일정 그룹 전체(${REPEAT_TYPE_LABELS[item.repeat_type]} 반복)를 삭제합니다.`
              : item.is_todo ? 'Todo를 삭제합니다.' : '이 일정을 삭제합니다.'
          }
          confirmLabel="삭제"
          onConfirm={isDirectParent ? handleDirectParentDelete : () => { setShowConfirmDelete(false); onDelete(item.id) }}
          onClose={() => setShowConfirmDelete(false)}
        />
      )}
    </>
  )
}
