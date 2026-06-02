/**
 * 미니 위젯 (280×80)
 * - 항상 위에 떠있는 좁은 바
 * - 다음 일정 제목 + 미완료 Todo 수 표시
 * - 드래그로 이동 가능 (frameless)
 * - 클릭 시 일반 모드로 전환
 */
import { useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'
import { expandSchedulesForRange } from '../../lib/repeatUtils'

export default function WidgetMini() {
  const { schedules, settings } = useAppStore()

  // 다음 일정 계산
  const now     = new Date()
  const rangeEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) // 1주
  const expanded = expandSchedulesForRange(schedules, now, rangeEnd)
  const upcoming = expanded
    .filter(s => !s.is_todo && s.start_at && new Date(s.start_at) > now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  const nextEvent = upcoming[0]
  const incompleteTodos = schedules.filter(s => s.is_todo && !s.is_completed).length

  const timeFormat = settings?.time_format ?? '24h'

  function formatNextEvent(): string {
    if (!nextEvent) return '오늘 일정 없음'
    const d = new Date(nextEvent.start_at)
    const isToday = d.toDateString() === now.toDateString()
    const timeLabel = d.toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
    })
    return isToday ? `${timeLabel} ${nextEvent.title}` : nextEvent.title
  }

  function openNormal() {
    window.electronAPI?.setWindowMode('normal')
  }

  return (
    <div
      className="w-full h-full flex items-center justify-between px-3 gap-2
        bg-gray-900/95 text-white select-none overflow-hidden rounded-lg"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 다음 일정 */}
      <span className="text-xs text-gray-300 truncate flex-1 text-center">
        {formatNextEvent()}
      </span>

      {/* 미완료 Todo 수 + 열기 버튼 */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {incompleteTodos > 0 && (
          <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 leading-none whitespace-nowrap">
            Todo {incompleteTodos}
          </span>
        )}
        <button
          onClick={openNormal}
          className="text-gray-500 hover:text-white text-xs transition-colors px-1"
          title="Focal 열기"
        >
          ⤢
        </button>
      </div>
    </div>
  )
}
