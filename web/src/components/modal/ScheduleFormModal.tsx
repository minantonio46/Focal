import { useState, useEffect, useRef } from 'react'
import { createSchedule, updateSchedule, fetchCategories, createCategory } from '../../lib/api'
import type { Schedule, Category } from '../../types'
import useAppStore from '../../stores/useAppStore'
// Phase 10 밑작업: toUTCISO/fromUTCISO에 settings.timezone을 넘기면
// 국가 설정 기반 마감 처리로 업그레이드 가능
import { toUTCISO, fromUTCISO, fromUTCISODatetime } from '../../lib/dateUtils'

interface Props {
  onClose: () => void
  onSave: () => void
  defaultIsTodo?: boolean
  /**
   * 새 항목 생성 시 기본 날짜 (YYYY-MM-DD).
   * 일정의 시작 날짜, Todo의 마감 날짜(day/datetime 정밀도) 기본값으로 사용됨.
   */
  defaultDate?: string
  editItem?: Schedule
}

type DeadlinePrecision = 'none' | 'year' | 'month' | 'day' | 'datetime'

const PRECISION_LABELS: Record<DeadlinePrecision, string> = {
  none: '없음', year: '연', month: '월', day: '일', datetime: '시분',
}

const DEFAULT_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#EF4444',
  '#F59E0B', '#6B7280', '#EC4899', '#14B8A6', '#84CC16',
]

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ─── Todo 마감 기한 계산 ──────────────────────────────────
// _tz: Phase 10에서 settings.timezone 을 전달하면 해당 TZ 기준으로 23:59 처리
function computeTodoStartAt(
  precision: DeadlinePrecision,
  input: string,
  _tz?: string
): string | undefined {
  if (precision === 'none' || !input) return undefined
  switch (precision) {
    case 'year':  return toUTCISO(`${input}-12-31T23:59:00`, _tz)
    case 'month': {
      const [y, m] = input.split('-').map(Number)
      const last = getLastDayOfMonth(y, m)
      return toUTCISO(`${input}-${String(last).padStart(2, '0')}T23:59:00`, _tz)
    }
    case 'day':      return toUTCISO(`${input}T23:59:00`, _tz)
    case 'datetime': return toUTCISO(input.length === 16 ? `${input}:00` : input, _tz)
  }
}

function initDeadlineInput(editItem?: Schedule): string {
  if (!editItem?.start_at || !editItem.is_todo) return ''
  switch (editItem.deadline_precision) {
    case 'year':  return editItem.start_at.slice(0, 4)
    case 'month': return editItem.start_at.slice(0, 7)
    case 'day':   return fromUTCISO(editItem.start_at).date
    default:      return fromUTCISODatetime(editItem.start_at)
  }
}

// ── 인라인 카테고리 생성 컴포넌트 ─────────────────────────
interface InlineCategoryCreatorProps {
  parentId?: string
  nextOrder: number
  onCreated: (cat: Category) => void
  onCancel: () => void
}

function InlineCategoryCreator({ parentId, nextOrder, onCreated, onCancel }: InlineCategoryCreatorProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [importance, setImportance] = useState(5)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const cat = await createCategory({
        name: name.trim(), color, default_importance: importance,
        parent_id: parentId || undefined, order: nextOrder,
      })
      onCreated(cat)
    } finally { setSaving(false) }
  }

  return (
    <div className="mt-2 p-3 border border-gray-600 rounded-lg flex flex-col gap-3">
      <input ref={inputRef} type="text"
        placeholder={parentId ? '소카테고리 이름' : '카테고리 이름'}
        value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onCancel() }}
        className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full" />
      <div className="flex gap-1.5 flex-wrap">
        {DEFAULT_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-800 scale-110' : ''}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">기본 중요도: {importance.toFixed(1)}</label>
        <input type="range" min={1} max={10} step={0.1} value={importance}
          onChange={e => setImportance(parseFloat(e.target.value))} className="w-full accent-blue-500" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-400 transition-colors">취소</button>
        <button onClick={handleCreate} disabled={!name.trim() || saving}
          className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? '생성 중...' : '생성'}
        </button>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function ScheduleFormModal({
  onClose,
  onSave,
  defaultIsTodo = false,
  defaultDate,
  editItem,
}: Props) {
  const { categories, setCategories, settings } = useAppStore()
  // Phase 10: settings.timezone 을 아래 함수들에 전달하면 국가 기반 마감 처리
  const tz = settings?.timezone

  const [isTodo, setIsTodo] = useState(editItem ? editItem.is_todo : defaultIsTodo)
  const [title, setTitle]   = useState(editItem?.title ?? '')
  const [isAllDay, setIsAllDay] = useState(editItem?.is_all_day ?? false)

  // 편집 시에는 기존 값 복원, 신규 시에는 defaultDate 사용
  const initStart = editItem?.start_at
    ? fromUTCISO(editItem.start_at, tz)
    : { date: defaultDate ?? '', time: '' }
  const initEnd = editItem?.end_at
    ? fromUTCISO(editItem.end_at, tz)
    : { date: '', time: '' }

  const [startDate, setStartDate] = useState(initStart.date)
  const [startTime, setStartTime] = useState(initStart.time)
  const [endDate, setEndDate]     = useState(initEnd.date)
  const [endTime, setEndTime]     = useState(initEnd.time)

  const [deadlinePrecision, setDeadlinePrecision] = useState<DeadlinePrecision>(
    editItem?.is_todo ? (editItem.deadline_precision ?? 'none') : 'none'
  )
  // Todo 마감 기한 초기값: 편집 시 기존 값, 신규 시 defaultDate (day 정밀도에 사용)
  const [deadlineInput, setDeadlineInput] = useState(() =>
    editItem ? initDeadlineInput(editItem) : (defaultDate ?? '')
  )

  const [importance, setImportance]       = useState(editItem?.importance ?? 5)
  const [categoryId, setCategoryId]       = useState(editItem?.category_id ?? '')
  const [subCategoryId, setSubCategoryId] = useState(editItem?.sub_category_id ?? '')
  const [description, setDescription]    = useState(editItem?.description ?? '')
  const [location, setLocation]          = useState(editItem?.location ?? '')
  const [expireType, setExpireType]      = useState<'expire' | 'keep'>(editItem?.expire_type ?? 'keep')
  const [isSaving, setIsSaving]          = useState(false)
  const [error, setError]                = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [showNewSub, setShowNewSub] = useState(false)

  useEffect(() => {
    if (categories.length === 0) fetchCategories().then(setCategories)
  }, [])

  useEffect(() => {
    if (!editItem) {
      const sub = categories.find((c: Category) => c.id === subCategoryId)
      const cat = categories.find((c: Category) => c.id === categoryId)
      const imp = sub?.default_importance ?? cat?.default_importance
      if (imp) setImportance(imp)
    }
  }, [categoryId, subCategoryId])

  const parentCats  = categories.filter((c: Category) => !c.parent_id)
  const subCats     = categoryId ? categories.filter((c: Category) => c.parent_id === categoryId) : []
  const hasDeadline = isTodo && deadlinePrecision !== 'none'

  function nextOrderFor(parentId?: string): number {
    const siblings = parentId
      ? categories.filter((c: Category) => c.parent_id === parentId)
      : categories.filter((c: Category) => !c.parent_id)
    return siblings.length > 0 ? Math.max(...siblings.map((c: Category) => c.order ?? 0)) + 1 : 1
  }

  function handleAllDayChange(checked: boolean) {
    setIsAllDay(checked)
    if (checked) { setStartTime(''); setEndTime('') }
  }

  function handleCategoryChange(val: string) {
    if (val === '__new__') { setShowNewCat(true); return }
    setCategoryId(val); setSubCategoryId(''); setShowNewSub(false)
  }

  function handleSubCategoryChange(val: string) {
    if (val === '__new__') { setShowNewSub(true); return }
    setSubCategoryId(val)
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (!isTodo) {
      if (!startDate) { setError('시작 날짜를 입력해주세요'); return }
      if (!isAllDay && !startTime) { setError('시작 시각을 입력해주세요'); return }
    }

    setIsSaving(true); setError('')
    try {
      let startAt: string | undefined
      let endAt:   string | undefined

      if (!isTodo) {
        if (isAllDay) {
          startAt = toUTCISO(`${startDate}T00:00:00`, tz)
          endAt   = toUTCISO(`${endDate || startDate}T23:59:00`, tz)
        } else {
          startAt = toUTCISO(`${startDate}T${startTime}:00`, tz)
          endAt   = endDate && endTime
            ? toUTCISO(`${endDate}T${endTime}:00`, tz)
            : endDate
              ? toUTCISO(`${endDate}T23:59:00`, tz)
              : toUTCISO(`${startDate}T23:59:00`, tz)
        }
      }

      const data: Partial<Schedule> = {
        title: title.trim(), is_todo: isTodo, importance,
        category_id:     categoryId    || undefined,
        sub_category_id: subCategoryId || undefined,
        description, location,
        ...(isTodo
          ? {
              is_all_day: false,
              start_at: computeTodoStartAt(deadlinePrecision, deadlineInput, tz),
              deadline_precision: deadlinePrecision,
              expire_type: expireType,
            }
          : { is_all_day: isAllDay, start_at: startAt, end_at: endAt }
        ),
      }

      if (editItem) { await updateSchedule(editItem.id, data) }
      else          { await createSchedule(data) }
      onSave()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally { setIsSaving(false) }
  }

  function renderDeadlineInput() {
    if (deadlinePrecision === 'none') return null
    const cls = 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full'
    switch (deadlinePrecision) {
      case 'year':
        return <input type="number" placeholder="연도 (예: 2026)" min={2020} max={2099}
          value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
      case 'month':
        return <input type="month" value={deadlineInput.slice(0, 7)} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
      case 'day':
        return <input type="date" value={deadlineInput.slice(0, 10)} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
      case 'datetime':
        return <input type="datetime-local" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
    }
  }

  const inputCls  = 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full'
  const selectCls = 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-full'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">{editItem ? '수정' : '새 항목'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
            {([true, false] as const).map(v => (
              <button key={String(v)} onClick={() => setIsTodo(v)}
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${isTodo === v ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {v ? 'Todo' : '일정'}
              </button>
            ))}
          </div>

          <input type="text" placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
            className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full" />

          {!isTodo && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={isAllDay} onChange={e => handleAllDayChange(e.target.checked)} className="accent-blue-500" />
                종일
              </label>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">시작</label>
                <div className="flex gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className={isAllDay ? inputCls : 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1'} />
                  {!isAllDay && (
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  종료 {isAllDay ? '(미입력 시 시작일과 동일)' : '(미입력 시 당일 23:59)'}
                </label>
                <div className="flex gap-2">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className={isAllDay ? inputCls : 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1'} />
                  {!isAllDay && (
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                  )}
                </div>
              </div>
            </>
          )}

          {isTodo && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 block">마감 기한</label>
              <div className="flex gap-1">
                {(['none', 'year', 'month', 'day', 'datetime'] as const).map(p => (
                  <button key={p} onClick={() => { setDeadlinePrecision(p); setDeadlineInput(p === 'day' || p === 'datetime' ? (defaultDate ?? '') : '') }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${deadlinePrecision === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {PRECISION_LABELS[p]}
                  </button>
                ))}
              </div>
              {renderDeadlineInput()}
            </div>
          )}

          {hasDeadline && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">기한 초과 시</label>
              <div className="flex gap-2">
                {(['keep', 'expire'] as const).map(v => (
                  <button key={v} onClick={() => setExpireType(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${expireType === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {v === 'keep' ? '유지' : '만료 표시'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">카테고리</label>
              <select value={showNewCat ? '__new__' : categoryId} onChange={e => handleCategoryChange(e.target.value)} className={selectCls}>
                <option value="">선택 안함</option>
                {parentCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">＋ 새 카테고리 만들기</option>
              </select>
              {showNewCat && <InlineCategoryCreator nextOrder={nextOrderFor()} onCreated={cat => { setCategories([...categories, cat]); setCategoryId(cat.id); setSubCategoryId(''); setShowNewCat(false) }} onCancel={() => setShowNewCat(false)} />}
            </div>
            {categoryId && !showNewCat && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">소카테고리</label>
                <select value={showNewSub ? '__new__' : subCategoryId} onChange={e => handleSubCategoryChange(e.target.value)} className={selectCls}>
                  <option value="">선택 안함</option>
                  {subCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">＋ 새 소카테고리 만들기</option>
                </select>
                {showNewSub && <InlineCategoryCreator parentId={categoryId} nextOrder={nextOrderFor(categoryId)} onCreated={sub => { setCategories([...categories, sub]); setSubCategoryId(sub.id); setShowNewSub(false) }} onCancel={() => setShowNewSub(false)} />}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">중요도: {importance.toFixed(1)}</label>
            <input type="range" min={1} max={10} step={0.1} value={importance}
              onChange={e => setImportance(parseFloat(e.target.value))} className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1</span><span>10</span></div>
          </div>

          <input type="text" placeholder="장소 (선택)" value={location} onChange={e => setLocation(e.target.value)} maxLength={100}
            className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full" />
          <textarea placeholder="메모 (선택)" value={description} onChange={e => setDescription(e.target.value)} rows={3}
            className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" />

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors">취소</button>
          <button onClick={handleSubmit} disabled={isSaving}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50">
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
