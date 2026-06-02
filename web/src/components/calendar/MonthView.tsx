import type { Schedule, Category } from '../../types'
import { getMonthGrid, getSchedulesForDay, isToday, isSameDay } from './calendarUtils'

interface Props {
  schedules:    Schedule[]
  categories:   Category[]
  currentDate:  Date
  timeFormat:   '12h' | '24h'
  onSelectItem: (item: Schedule) => void
  onSelectDate: (date: Date) => void
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const MAX_CHIPS  = 3

export default function MonthView({
  schedules,
  categories,
  currentDate,
  timeFormat,
  onSelectItem,
  onSelectDate,
}: Props) {
  const grid  = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth())
  // const today = new Date()

  function getCategoryColor(s: Schedule): string {
    const cat = s.sub_category_id
      ? categories.find(c => c.id === s.sub_category_id)
      : categories.find(c => c.id === s.category_id)
    return cat?.color ?? '#6B7280'
  }

  function fmtChipTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 flex-shrink-0 border-b border-gray-700">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`py-2 text-center text-xs font-medium tracking-wide ${
              i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {grid.flat().map((date, idx) => {
          const isCurrentMonth = date.getMonth() === currentDate.getMonth()
          const isTodayCell    = isToday(date)
          const isSelected     = isSameDay(date, currentDate)

          const dayItems = getSchedulesForDay(schedules, date)
          // 종일 이벤트 먼저, 그 다음 시간순
          const sorted = [...dayItems].sort((a, b) => {
            if (a.is_all_day && !b.is_all_day) return -1
            if (!a.is_all_day && b.is_all_day)  return 1
            if (!a.start_at && !b.start_at)     return 0
            if (!a.start_at) return 1
            if (!b.start_at) return -1
            return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
          })

          const visible  = sorted.slice(0, MAX_CHIPS)
          const overflow = sorted.length - MAX_CHIPS

          // 0=월…5=토, 6=일
          const dow = idx % 7
          const isSat = dow === 5
          const isSun = dow === 6

          return (
            <div
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`border-b border-r border-gray-800 p-1 cursor-pointer transition-colors
                hover:bg-gray-800/40
                ${!isCurrentMonth ? 'opacity-35' : ''}
                ${isSelected && !isTodayCell ? 'bg-gray-800/60' : ''}
              `}
              style={{ minHeight: '90px' }}
            >
              {/* 날짜 숫자 */}
              <div className="flex justify-end mb-0.5">
                <span
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium select-none
                    ${isTodayCell
                      ? 'bg-blue-600 text-white'
                      : isSat ? 'text-blue-400'
                      : isSun ? 'text-red-400'
                      : 'text-gray-400'
                    }`}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* 이벤트 칩 */}
              <div className="flex flex-col gap-0.5">
                {visible.map(s => {
                  const color = getCategoryColor(s)
                  return (
                    <button
                      key={s.id}
                      onClick={e => { e.stopPropagation(); onSelectItem(s) }}
                      className="w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate leading-tight transition-opacity hover:opacity-75"
                      style={
                        s.is_all_day
                          ? { backgroundColor: color + 'CC', color: '#fff' }
                          : {
                              backgroundColor: color + '22',
                              color,
                              borderLeft: `2px solid ${color}`,
                            }
                      }
                    >
                      {!s.is_all_day && s.start_at && (
                        <span className="opacity-70 mr-1 text-[10px]">
                          {fmtChipTime(s.start_at)}
                        </span>
                      )}
                      {s.is_todo && '☑ '}
                      {s.title}
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); onSelectDate(date) }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 text-left px-1.5 leading-tight"
                  >
                    +{overflow}개
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
