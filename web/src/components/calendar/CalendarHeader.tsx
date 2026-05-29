import { useState, useRef, useEffect } from 'react'
import type { CalView } from '../../pages/CalendarPage'
import { getWeekDisplayInfo, getWeeksInMonth, getMondayOfWeek } from './calendarUtils'

interface Props {
  view:         CalView
  currentDate:  Date
  onViewChange: (v: CalView) => void
  onPrev:       () => void
  onNext:       () => void
  onToday:      () => void
  onNavigateTo: (date: Date) => void
}

type WeekCtx = { year: number; month: number; weekNum: number }

const VIEWS: { key: CalView; label: string }[] = [
  { key: 'month', label: '월' },
  { key: 'week',  label: '주' },
  { key: 'day',   label: '일' },
]
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DOW_KR      = ['일','월','화','수','목','금','토']

type PopoverKind = 'year' | 'month' | 'week' | 'datepicker' | null

// ── 로컬 날짜 유틸 (import 최소화) ──────────────────────────
function mondayOf(date: Date): Date {
  const day = date.getDay()
  const mon = new Date(date)
  mon.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0, 0, 0, 0)
  return mon
}
function week1Monday(year: number, month: number): Date {
  return mondayOf(new Date(year, month, 1))
}
function weekNumInCtx(monday: Date, year: number, month: number): number {
  const w1 = week1Monday(year, month)
  return Math.round((monday.getTime() - w1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
}
/** 새 월요일에 대해 현재 맥락 유지 가능하면 유지, 아니면 월요일의 달로 전환 */
function resolveCtx(monday: Date, ctx: WeekCtx): WeekCtx {
  const wn  = weekNumInCtx(monday, ctx.year, ctx.month)
  const max = getWeeksInMonth(ctx.year, ctx.month).length
  if (wn >= 1 && wn <= max) return { year: ctx.year, month: ctx.month, weekNum: wn }
  // 맥락 이탈 → 월요일의 달로 전환
  const y = monday.getFullYear(), m = monday.getMonth()
  return { year: y, month: m, weekNum: weekNumInCtx(monday, y, m) }
}

// ── 커스텀 달력 그리드용 ─────────────────────────────────────
function buildCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d
  })
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CalendarHeader({
  view, currentDate, onViewChange, onPrev, onNext, onToday, onNavigateTo,
}: Props) {
  // ── 주간 뷰 표시 맥락 (동적: 이동 방식에 따라 달라짐) ─────
  const [weekCtx, setWeekCtx] = useState<WeekCtx>(() => getWeekDisplayInfo(currentDate))
  const prevViewRef = useRef(view)

  // 뷰가 week로 전환될 때만 weekCtx 초기화
  // currentDate의 월 기준으로 주차 계산 (Monday 기준 월이 아님)
  // 예: 5월 1일(금) → 월요일은 4월 27일이지만 "5월 1주차"로 표시
  useEffect(() => {
    if (view === 'week' && prevViewRef.current !== 'week') {
      const y   = currentDate.getFullYear()
      const m   = currentDate.getMonth()
      const mon = mondayOf(currentDate)
      const wn  = weekNumInCtx(mon, y, m)
      const max = getWeeksInMonth(y, m).length
      setWeekCtx(
        wn >= 1 && wn <= max
          ? { year: y, month: m, weekNum: wn }
          : getWeekDisplayInfo(currentDate)   // 범위 이탈 시 fallback
      )
    }
    prevViewRef.current = view
  }, [view])

  const [popover, setPopover]     = useState<PopoverKind>(null)
  const [tempYear, setTempYear]   = useState('')
  const [pickerNav, setPickerNav] = useState({ year: currentDate.getFullYear(), month: currentDate.getMonth() })
  const containerRef              = useRef<HTMLDivElement>(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const day   = currentDate.getDate()
  const dow   = currentDate.getDay()
  const today = new Date()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weeksInCurMonth = getWeeksInMonth(weekCtx.year, weekCtx.month)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setPopover(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function toggle(kind: PopoverKind) {
    if (popover === kind) { setPopover(null); return }
    if (kind === 'year')       setTempYear(String(view === 'week' ? weekCtx.year : year))
    if (kind === 'datepicker') setPickerNav({ year, month })
    setPopover(kind)
  }

  // ── 주간 뷰 전용 네비게이션 ─────────────────────────────────

  function weekNavigate(dir: -1 | 1) {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + dir * 7)
    const newMon = mondayOf(newDate)
    setWeekCtx(resolveCtx(newMon, weekCtx))
    onNavigateTo(newDate)
  }

  function weekGoToday() {
    const todayMon = mondayOf(today)
    setWeekCtx(getWeekDisplayInfo(today))
    onNavigateTo(today)
  }

  function weekGoYear(newYear: number) {
    if (newYear < 2000 || newYear > 2099) return
    const max = getWeeksInMonth(newYear, weekCtx.month).length
    const wn  = Math.min(weekCtx.weekNum, max)
    setWeekCtx({ year: newYear, month: weekCtx.month, weekNum: wn })
    onNavigateTo(getMondayOfWeek(newYear, weekCtx.month, wn))
    setPopover(null)
  }

  function weekGoMonth(m: number) {
    if (m === weekCtx.month) { setPopover(null); return }
    setWeekCtx({ year: weekCtx.year, month: m, weekNum: 1 })
    onNavigateTo(getMondayOfWeek(weekCtx.year, m, 1))
    setPopover(null)
  }

  function weekGoWeek(w: number) {
    if (w === weekCtx.weekNum) { setPopover(null); return }
    setWeekCtx({ ...weekCtx, weekNum: w })
    onNavigateTo(getMondayOfWeek(weekCtx.year, weekCtx.month, w))
    setPopover(null)
  }

  // ── 월간/일간 뷰 네비게이션 ──────────────────────────────────

  function goYear(newYear: number) {
    if (newYear < 2000 || newYear > 2099) return
    if (view === 'month') { onNavigateTo(new Date(newYear, month, 1)) }
    else { const d = new Date(newYear, month, day); if (d.getMonth() !== month) d.setDate(0); onNavigateTo(d) }
    setPopover(null)
  }

  function goMonth(m: number) {
    if (m === month) { setPopover(null); return }
    if (view === 'month') { onNavigateTo(new Date(year, m, 1)) }
    else { const d = new Date(year, m, day); if (d.getMonth() !== m) d.setDate(0); onNavigateTo(d) }
    setPopover(null)
  }

  // ── 달력 피커 ────────────────────────────────────────────────

  function pickerPrevMonth() {
    setPickerNav(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  function pickerNextMonth() {
    setPickerNav(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }
  function pickerSelectDay(d: Date) {
    onNavigateTo(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    setPopover(null)
  }

  // ── 스타일 ──────────────────────────────────────────────────
  const navBtnCls   = 'w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white text-xl transition-colors'
  const titleBtnCls = 'px-1.5 py-0.5 rounded-lg font-bold text-lg text-white hover:bg-gray-700 active:bg-gray-600 transition-colors select-none'
  const popBase     = 'absolute top-full mt-1.5 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-3'
  const pickerDays  = buildCalendarDays(pickerNav.year, pickerNav.month)

  // ── 공통 팝오버: 연도 입력 ───────────────────────────────────
  function YearPopover({ onConfirm }: { onConfirm: (y: number) => void }) {
    return (
      <div className={popBase} style={{ width: 168 }}>
        <p className="text-xs text-gray-500 mb-2 font-medium">연도 이동</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setTempYear(v => String(+v - 1))} className="w-7 h-7 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-lg">–</button>
          <input type="number" value={tempYear} min={2000} max={2099}
            onChange={e => setTempYear(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm(+tempYear); if (e.key === 'Escape') setPopover(null) }}
            className="flex-1 bg-gray-800 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield]" />
          <button onClick={() => setTempYear(v => String(+v + 1))} className="w-7 h-7 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-lg">+</button>
        </div>
        <button onClick={() => onConfirm(+tempYear)} className="w-full mt-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors">이동</button>
      </div>
    )
  }

  function MonthPopover({ curMonth, curYear, onSelect }: { curMonth: number; curYear: number; onSelect: (m: number) => void }) {
    return (
      <div className={popBase} style={{ width: 224 }}>
        <p className="text-xs text-gray-500 mb-2 font-medium whitespace-nowrap">{curYear}년 · 월 선택</p>
        <div className="grid grid-cols-4 gap-1">
          {MONTH_NAMES.map((name, i) => (
            <button key={i} onClick={() => onSelect(i)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${i === curMonth ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── 커스텀 달력 팝업 ────────────────────────────────────────
  const DatePickerPopover = (
    <div className={popBase} style={{ width: 280 }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={pickerPrevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-lg">‹</button>
        <span className="text-sm font-semibold text-white">{pickerNav.year}년 {pickerNav.month + 1}월</span>
        <button onClick={pickerNextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DOW_KR.map((d, i) => (
          <div key={i} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {pickerDays.map((d, i) => {
          const inMonth = d.getMonth() === pickerNav.month
          const isSel   = sameDay(d, currentDate)
          const isTdy   = sameDay(d, today)
          const wd      = d.getDay()
          return (
            <button key={i} onClick={() => pickerSelectDay(d)}
              className={`aspect-square flex items-center justify-center rounded-lg text-sm transition-colors ${
                isSel    ? 'bg-blue-600 text-white font-semibold'
                : isTdy  ? 'ring-1 ring-blue-500 text-blue-400 hover:bg-gray-700'
                : !inMonth ? 'text-gray-600 hover:bg-gray-800'
                : wd === 0 ? 'text-red-400 hover:bg-gray-700'
                : wd === 6 ? 'text-blue-400 hover:bg-gray-700'
                :             'text-gray-300 hover:bg-gray-700'
              }`}>
              {d.getDate()}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
        <button onClick={() => setPopover(null)} className="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 font-medium transition-colors">취소</button>
        <button onClick={() => pickerSelectDay(today)} className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors">오늘</button>
      </div>
    </div>
  )

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex items-center gap-3 relative">

      {/* 뷰 전환 */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 flex-shrink-0">
        {VIEWS.map(({ key, label }) => (
          <button key={key} onClick={() => { onViewChange(key); setPopover(null) }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* [‹] [내용] [오늘] [›] */}
      <div className="flex items-center gap-1">

        {/* ‹ */}
        <button onClick={view === 'week' ? () => weekNavigate(-1) : onPrev} className={navBtnCls}>‹</button>

        {/* 월간 뷰 */}
        {view === 'month' && (
          <div className="flex items-baseline gap-0.5">
            <div className="relative">
              <button onClick={() => toggle('year')} className={titleBtnCls}>{year}년</button>
              {popover === 'year' && <YearPopover onConfirm={goYear} />}
            </div>
            <div className="relative">
              <button onClick={() => toggle('month')} className={titleBtnCls}>{month + 1}월</button>
              {popover === 'month' && <MonthPopover curMonth={month} curYear={year} onSelect={goMonth} />}
            </div>
          </div>
        )}

        {/* 주간 뷰 — weekCtx 기반 표시 */}
        {view === 'week' && (
          <div className="flex items-baseline gap-0.5">
            <div className="relative">
              <button onClick={() => toggle('year')} className={titleBtnCls}>{weekCtx.year}년</button>
              {popover === 'year' && <YearPopover onConfirm={weekGoYear} />}
            </div>
            <div className="relative">
              <button onClick={() => toggle('month')} className={titleBtnCls}>{weekCtx.month + 1}월</button>
              {popover === 'month' && <MonthPopover curMonth={weekCtx.month} curYear={weekCtx.year} onSelect={weekGoMonth} />}
            </div>
            <div className="relative">
              <button onClick={() => toggle('week')} className={titleBtnCls}>{weekCtx.weekNum}주차</button>
              {popover === 'week' && (
                <div className={popBase} style={{ width: 112 }}>
                  <p className="text-xs text-gray-500 mb-2 font-medium">주차 선택</p>
                  <div className="flex flex-col gap-1">
                    {weeksInCurMonth.map(w => (
                      <button key={w} onClick={() => weekGoWeek(w)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${w === weekCtx.weekNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
                        {w}주차
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 일간 뷰 */}
        {view === 'day' && (
          <div className="flex items-center gap-1">
            <div className="relative">
              <button onClick={() => toggle('datepicker')} title="달력으로 날짜 선택"
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-base ${popover === 'datepicker' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-400 hover:text-white'}`}>
                📅
              </button>
              {popover === 'datepicker' && DatePickerPopover}
            </div>
            <span className="text-lg font-bold text-white px-0.5 select-none whitespace-nowrap">
              {year}년 {month + 1}월 {day}일 ({DOW_KR[dow]})
            </span>
          </div>
        )}

        {/* 오늘 */}
        <button onClick={view === 'week' ? weekGoToday : onToday}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
          오늘
        </button>

        {/* › */}
        <button onClick={view === 'week' ? () => weekNavigate(1) : onNext} className={navBtnCls}>›</button>

      </div>
    </div>
  )
}
