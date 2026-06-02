import type { Schedule, Category } from '../../types'
import { formatDate, formatTime, fromUTCISO } from '../../lib/dateUtils'
import { VALID_REPEAT_TYPES, isRepeatEnded } from '../../lib/repeatUtils'
import { getRepeatTodoDisplayOccurrences } from '../../lib/priorityUtils'
import useAppStore from '../../stores/useAppStore'

interface Props {
  item: Schedule & { _repeatOccDate?: string; _repeatIsCompleted?: boolean }
  categories: Category[]
  onComplete?: (item: Schedule) => void
  onDelete: (id: string) => void
  onClick: () => void
}

// ─── 반복 회차 순회 헬퍼 ────────────────────────────────────

function advanceRepeat(cur: Date, item: Schedule): Date {
  const n = new Date(cur)
  const type = item.repeat_type
  const repeatDays = item.repeat_days ?? []

  if (type === 'daily') {
    n.setDate(n.getDate() + 1)
  } else if (type === 'weekly') {
    if (repeatDays.length) {
      const sorted = [...repeatDays].sort((a, b) => a - b)
      const dow = n.getDay()
      const next = sorted.find(d => d > dow)
      n.setDate(n.getDate() + (next !== undefined ? next - dow : 7 - dow + sorted[0]))
    } else {
      n.setDate(n.getDate() + 7)
    }
  } else if (type === 'monthly') {
    const origDay = item.start_at ? new Date(item.start_at).getDate() : n.getDate()
    n.setDate(1); n.setMonth(n.getMonth() + 1)
    const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
    n.setDate(Math.min(origDay, last))
  } else if (type === 'yearly') {
    const origDay = item.start_at ? new Date(item.start_at).getDate() : n.getDate()
    n.setDate(1); n.setFullYear(n.getFullYear() + 1)
    const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
    n.setDate(Math.min(origDay, last))
  }
  return n
}

interface RepeatDisplayInfo {
  start: string      // YYYY-MM-DD
  end: string | null // YYYY-MM-DD (종료일 다를 때만)
  currentIndex: number  // 1-based
  totalCount: number | null  // 총 회차 (무기한이면 null)
}

/**
 * 반복 일정/Todo의 다음 회차 정보 계산
 */
function getRepeatDisplayInfo(item: Schedule): RepeatDisplayInfo | null {
  if (!VALID_REPEAT_TYPES.has(item.repeat_type)) return null
  if (!item.start_at) return null

  const now    = new Date()
  const nowStr = now.toISOString().slice(0, 10)
  const excluded = new Set(item.excluded_dates ?? [])
  const maxDate  = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 3)
  const endAt    = item.repeat_end_at ? new Date(item.repeat_end_at) : maxDate
  const maxCount = item.repeat_count && item.repeat_count > 0 ? item.repeat_count : Infinity

  // duration (일정만)
  const durationMs = (!item.is_todo && item.end_at)
    ? new Date(item.end_at).getTime() - new Date(item.start_at).getTime()
    : null

  function toEndDateStr(startDateStr: string): string | null {
    if (!durationMs || durationMs <= 0) return null
    const timeOffset = new Date(item.start_at!).getTime()
      - new Date(item.start_at!.slice(0, 10) + 'T00:00:00').getTime()
    const nextStartMs = new Date(startDateStr + 'T00:00:00').getTime() + timeOffset
    const nextEndMs   = nextStartMs + durationMs
    const endDateStr  = new Date(nextEndMs).toISOString().slice(0, 10)
    return endDateStr !== startDateStr ? endDateStr : null
  }

  // Todo: getRepeatTodoDisplayOccurrences 활용
  if (item.is_todo) {
    const occs = getRepeatTodoDisplayOccurrences(item)
    const next = occs.find(o => !o.isCompleted && o.dateStr >= nowStr)
    const dateStr = next?.dateStr ?? occs[0]?.dateStr ?? null
    if (!dateStr) return null

    // 회차 계산
    let cur = new Date(item.start_at)
    let count = 1; let total = 0; let currentIndex = 1
    while (cur <= endAt && cur <= maxDate && count <= maxCount) {
      const ds = cur.toISOString().slice(0, 10)
      if (!excluded.has(ds)) {
        total++
        if (ds === dateStr) currentIndex = total
      }
      const next2 = advanceRepeat(cur, item)
      if (next2.getTime() <= cur.getTime()) break
      cur = next2; count++
    }
    const totalCount = item.repeat_count && item.repeat_count > 0 ? total : null
    return { start: dateStr, end: null, currentIndex, totalCount }
  }

  // 일정: 다음 회차 탐색
  let cur = new Date(item.start_at)
  let count = 1; let total = 0; let currentIndex = 1
  let firstFutureDate: string | null = null

  while (cur <= endAt && cur <= maxDate && count <= maxCount) {
    const ds = cur.toISOString().slice(0, 10)
    if (!excluded.has(ds)) {
      total++
      if (!firstFutureDate && ds >= nowStr) {
        firstFutureDate = ds
        currentIndex = total
      }
    }
    const next2 = advanceRepeat(cur, item)
    if (next2.getTime() <= cur.getTime()) break
    cur = next2; count++
  }

  if (!firstFutureDate) return null
  const totalCount = item.repeat_count && item.repeat_count > 0 ? total : null
  return { start: firstFutureDate, end: toEndDateStr(firstFutureDate), currentIndex, totalCount }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────

export default function TodoItem({ item, categories, onComplete, onDelete, onClick }: Props) {
  const { settings } = useAppStore()
  const timeFormat = settings?.time_format ?? '24h'

  const cat    = categories.find(c => c.id === item.category_id)
  const subCat = categories.find(c => c.id === item.sub_category_id)

  const isRepeatOcc = !!item._repeatOccDate
  const isRepeatCompleted = item._repeatIsCompleted ?? false
  const isRepeat = VALID_REPEAT_TYPES.has(item.repeat_type) || !!item.parent_id

  // 미시작 상태
  const isNotYetAvailable = item.is_todo && !!item.available_from && (() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    return item.available_from.slice(0, 10) > todayStr
  })()

  // 반복 정보
  const repeatInfo = isRepeat && !isRepeatOcc ? getRepeatDisplayInfo(item) : null

  // 표시할 날짜·시각
  const displayStartStr = repeatInfo?.start ?? item.start_at ?? null
  const displayEndStr   = repeatInfo
    ? (repeatInfo.end ?? null)   // 반복: getRepeatDisplayInfo가 계산한 다음 회차 종료일
    : item.end_at ?? null

  // 시각 포함 여부 (종일 아니고 시각 정보 있을 때)
  const hasTime = !item.is_all_day && !!item.start_at && fromUTCISO(item.start_at).time !== '00:00'

  // 마감 초과 상태 세분화
  const isOverdue = item.is_todo && !!item.start_at && new Date(item.start_at) < new Date()
  const isUrgentOverdue  = isOverdue && item.expire_type === 'keep'    // 유지: 빨간 강조 + 맨 위
  const isExpiredOverdue = isOverdue && item.expire_type === 'expire'  // 만료: 취소선 + 맨 아래

  // 일정 종료
  const isPast = !item.is_todo && !!item.end_at && new Date(item.end_at) < new Date()
    && (!isRepeat || isRepeatEnded(item))

  const displayColor = subCat?.color ?? cat?.color ?? '#6B7280'

  function formatOccDate(dateStr: string): string {
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m)}월 ${parseInt(d)}일`
  }

  // 날짜·시각 포맷
  function formatDisplayDate(dateStr: string): string {
    if (hasTime) {
      return `${formatDate(dateStr)} ${formatTime(dateStr, timeFormat)}`
    }
    return formatDate(dateStr)
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors group border ${
        isUrgentOverdue
          ? 'bg-red-950/40 border-red-800/60 hover:bg-red-950/60'
          : isExpiredOverdue || item.is_completed || isPast
            ? 'bg-gray-800/50 border-transparent opacity-50'
            : isNotYetAvailable
              ? 'bg-gray-800/60 border-gray-700/40 opacity-70'
              : 'bg-gray-800 border-transparent hover:bg-gray-750'
      }`}
      onClick={onClick}
    >
      {/* 완료 체크 (Todo 전용) */}
      {onComplete && (
        <button
          onClick={e => { e.stopPropagation(); onComplete(item) }}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
            item.is_completed ? 'bg-blue-600 border-blue-600' : 'border-gray-500 hover:border-blue-500'
          }`}
        >
          {item.is_completed && (
            <span className="text-white text-xs flex items-center justify-center h-full">✓</span>
          )}
        </button>
      )}

      {/* 일정 아이콘 */}
      {!onComplete && <span className="mt-0.5 text-base flex-shrink-0">📅</span>}

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium truncate ${
            isExpiredOverdue || item.is_completed || isPast
              ? 'line-through text-gray-500'
              : isUrgentOverdue
                ? 'text-red-300'
                : 'text-white'
          }`}>
            {item.title}
          </span>
          {isUrgentOverdue && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">긴급</span>
          )}
          {isExpiredOverdue && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-500 flex-shrink-0">만료</span>
          )}
          {isNotYetAvailable && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 flex-shrink-0">
              미시작 · {item.available_from!.slice(0, 10)}부터
            </span>
          )}
          {/* 반복 회차 배지 */}
          {isRepeatOcc && (
            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              isRepeatCompleted
                ? 'bg-green-900/60 text-green-400'
                : 'bg-blue-900/60 text-blue-300'
            }`}>
              반복 {formatOccDate(item._repeatOccDate!)}
            </span>
          )}
          {/* 반복 정보 배지 */}
          {repeatInfo && !isRepeatOcc && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 flex-shrink-0">
              🔁 {repeatInfo.totalCount
                ? `${repeatInfo.currentIndex}/${repeatInfo.totalCount}회`
                : `${repeatInfo.currentIndex}회차`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {(cat || subCat) && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: displayColor + '33', color: displayColor }}
            >
              {subCat?.name ?? cat?.name}
            </span>
          )}

          {/* 날짜·시각 */}
          {displayStartStr && (
            <span className="text-xs text-gray-500">
              {repeatInfo ? '다음: ' : ''}{formatDisplayDate(displayStartStr)}
              {displayEndStr && ` ~ ${formatDisplayDate(displayEndStr)}`}
            </span>
          )}

          {/* 장소 */}
          {item.location && (
            <span className="text-xs text-gray-500">
              📍 {item.location}
            </span>
          )}

          <span className="text-xs text-gray-600">중요도 {item.importance}</span>
        </div>
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(item.id) }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
      >
        ✕
      </button>
    </div>
  )
}
