/**
 * 중형 위젯 (360×600)
 * - frameless, 드래그 가능
 * - 오늘 일정 목록 + 미완료 Todo 목록
 * - 커스텀 타이틀바 (최소화/닫기/모드 전환)
 */
import { useState } from 'react'
import useAppStore from '../../stores/useAppStore'
import { expandSchedulesForRange } from '../../lib/repeatUtils'
import type { Schedule } from '../../types'

function formatTime(dateStr: string, timeFormat: '12h' | '24h'): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h',
  })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

export default function WidgetMedium() {
  const { schedules, categories, settings } = useAppStore()
  const [tab, setTab] = useState<'schedule' | 'todo'>('schedule')
  const timeFormat = settings?.time_format ?? '24h'

  const now      = new Date()
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  // 오늘 일정
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const expanded = expandSchedulesForRange(schedules, todayStart, todayEnd)
  const todaySchedules = expanded
    .filter(s => !s.is_todo)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  // 미완료 Todo (마감 있는 것 먼저)
  const todos = schedules
    .filter(s => s.is_todo && !s.is_completed)
    .sort((a, b) => {
      if (a.start_at && !b.start_at) return -1
      if (!a.start_at && b.start_at) return 1
      if (a.start_at && b.start_at) return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      return 0
    })
    .slice(0, 20)

  function getCatColor(item: Schedule): string {
    const subCat = categories.find(c => c.id === item.sub_category_id)
    const cat    = categories.find(c => c.id === item.category_id)
    return subCat?.color ?? cat?.color ?? '#6B7280'
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-900 text-white overflow-hidden">

      {/* 커스텀 타이틀바 */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-sm font-bold text-white">Focal</span>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => window.electronAPI?.setWindowMode('normal')}
            className="text-xs text-gray-500 hover:text-blue-400 px-2 py-0.5 rounded transition-colors"
            title="일반 모드"
          >
            일반
          </button>
          <button
            onClick={() => window.electronAPI?.setWindowMode('mini')}
            className="text-xs text-gray-500 hover:text-yellow-400 px-2 py-0.5 rounded transition-colors"
            title="미니 모드"
          >
            미니
          </button>
          <div className="w-px h-3 bg-gray-700 mx-0.5" />
          <button
            onClick={() => window.electronAPI?.windowMinimize()}
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded transition-colors"
            title="최소화"
          >
            −
          </button>
          <button
            onClick={() => window.electronAPI?.windowClose()}
            className="text-xs text-gray-500 hover:text-red-400 px-2 py-0.5 rounded transition-colors"
            title="숨기기"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 날짜 헤더 */}
      <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <p className="text-xs text-gray-400">{formatDate(now.toISOString())}</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-0 border-b border-gray-800 flex-shrink-0">
        {(['schedule', 'todo'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'schedule'
              ? `일정 ${todaySchedules.length > 0 ? `(${todaySchedules.length})` : ''}`
              : `Todo ${todos.length > 0 ? `(${todos.length})` : ''}`
            }
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'schedule' && (
          todaySchedules.length === 0
            ? <p className="text-center text-gray-600 text-xs py-8">오늘 일정 없음</p>
            : todaySchedules.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-2 px-3 py-2 border-b border-gray-800/50"
              >
                <div
                  className="w-1 rounded-full flex-shrink-0 self-stretch mt-0.5 min-h-3"
                  style={{ backgroundColor: getCatColor(item) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.is_all_day ? '종일' : formatTime(item.start_at, timeFormat)}
                    {item.end_at && !item.is_all_day && ` ~ ${formatTime(item.end_at, timeFormat)}`}
                  </p>
                </div>
              </div>
            ))
        )}

        {tab === 'todo' && (
          todos.length === 0
            ? <p className="text-center text-gray-600 text-xs py-8">미완료 Todo 없음</p>
            : todos.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50"
              >
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: getCatColor(item) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.title}</p>
                  {item.start_at && item.deadline_precision !== 'none' && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(item.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            ))
        )}
      </div>

      {/* 하단 제거 */}
    </div>
  )
}
