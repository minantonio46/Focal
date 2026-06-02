import { useState, useEffect, useRef } from 'react'
import pb from '../../lib/pocketbase'
import {
  createSchedule, updateSchedule, fetchCategories, createCategory,
  createException, updateFromOccurrence, updateAllOccurrences,
  syncNotificationsForSchedule,
} from '../../lib/api'
import type { Schedule, Category } from '../../types'
import useAppStore from '../../stores/useAppStore'
import { toUTCISO, fromUTCISO, fromUTCISODatetime } from '../../lib/dateUtils'
import {
  type RepeatEndType,
  REPEAT_TYPE_LABELS,
  REPEAT_DAY_LABELS,
} from '../../lib/repeatUtils'

interface Props {
  onClose: () => void
  onSave: () => void
  defaultIsTodo?: boolean
  defaultDate?: string
  editItem?: Schedule
  repeatEditMode?: 'this' | 'this_and_after' | 'all'
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

function computeTodoStartAt(precision: DeadlinePrecision, input: string, _tz?: string): string | undefined {
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

// ── 인라인 카테고리 생성 ───────────────────────────────────
function InlineCategoryCreator({ parentId, nextOrder, onCreated, onCancel }: {
  parentId?: string; nextOrder: number
  onCreated: (cat: Category) => void; onCancel: () => void
}) {
  const [name, setName]             = useState('')
  const [color, setColor]           = useState(DEFAULT_COLORS[0])
  const [importance, setImportance] = useState(5)
  const [saving, setSaving]         = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const cat = await createCategory({ name: name.trim(), color, default_importance: importance, parent_id: parentId || undefined, order: nextOrder })
      onCreated(cat)
    } finally { setSaving(false) }
  }

  return (
    <div className="mt-2 p-3 border border-gray-600 rounded-lg flex flex-col gap-3">
      <input ref={inputRef} type="text" placeholder={parentId ? '소카테고리 이름' : '카테고리 이름'}
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

// ── 예외 덮어쓰기 경고 다이얼로그 ────────────────────────────
function OverwriteWarningDialog({ count, mode, onConfirm, onCancel }: {
  count: number; mode: 'all' | 'this_and_after'
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-800">
          <h3 className="font-semibold text-base text-amber-400">⚠️ 예외 일정 덮어쓰기</h3>
          <p className="text-sm text-gray-300 mt-2">
            {mode === 'all'
              ? `이 반복 그룹에 개별 수정된 예외 일정이 ${count}개 있습니다. 모두 수정하면 예외 사항이 삭제되고 일괄 적용됩니다.`
              : `이후 구간에 개별 수정된 예외 일정이 ${count}개 있습니다. 이후 수정하면 해당 예외 사항이 삭제됩니다.`}
          </p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <button onClick={onConfirm} className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white transition-colors">
            계속 진행
          </button>
          <button onClick={onCancel} className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function ScheduleFormModal({ onClose, onSave, defaultIsTodo = false, defaultDate, editItem, repeatEditMode }: Props) {
  const { categories, setCategories, settings, schedules } = useAppStore()
  const tz = settings?.timezone

  // 권한 플래그
  const isNew          = !editItem
  const isThis         = repeatEditMode === 'this'
  const isAfter        = repeatEditMode === 'this_and_after'
  const isAll          = repeatEditMode === 'all'
  const isRepeatEdit   = isThis || isAfter || isAll

  // 필드 허용 여부
  const canEditTodoToggle  = isNew
  const canEditStartDate   = isNew || isThis || isAll || !isRepeatEdit
  const canEditEndDate     = isNew || isAll || !isRepeatEdit
  const canEditTime        = true
  const canEditAllDay      = true
  const canEditExpireType  = true
  const canEditDeadline    = isNew || isThis || !isRepeatEdit
  const canEditRepeatEnd   = isNew || isAll
  const canEditLocation    = true
  const canEditMemo        = true

  const [isTodo, setIsTodo]     = useState(editItem ? editItem.is_todo : defaultIsTodo)
  const [title, setTitle]       = useState(editItem?.title ?? '')
  const [isAllDay, setIsAllDay] = useState(editItem?.is_all_day ?? false)

  // isAll 모드에서는 선택된 회차가 아닌 부모 레코드 기준일자로 초기화
  const parentRecord = isAll && editItem?.parent_id
    ? schedules.find(s => s.id === editItem.parent_id)
    : null
  const baseItem = parentRecord ?? editItem

  const initStart = baseItem?.start_at ? fromUTCISO(baseItem.start_at, tz) : { date: defaultDate ?? '', time: '' }
  const initEnd   = baseItem?.end_at   ? fromUTCISO(baseItem.end_at,   tz) : { date: '', time: '' }

  const [startDate, setStartDate] = useState(initStart.date)
  const [startTime, setStartTime] = useState(initStart.time)
  const [endDate, setEndDate]     = useState(initEnd.date)
  const [endTime, setEndTime]     = useState(initEnd.time)

  const [deadlinePrecision, setDeadlinePrecision] = useState<DeadlinePrecision>(
    editItem?.is_todo ? (editItem.deadline_precision ?? 'none') : 'none'
  )
  const [deadlineInput, setDeadlineInput] = useState(() =>
    editItem ? initDeadlineInput(editItem) : (defaultDate ?? '')
  )

  const [importance, setImportance]       = useState(editItem?.importance ?? 5)
  const [categoryId, setCategoryId]       = useState(editItem?.category_id ?? '')
  const [subCategoryId, setSubCategoryId] = useState(editItem?.sub_category_id ?? '')
  const [description, setDescription]    = useState(editItem?.description ?? '')
  const [location, setLocation]          = useState(editItem?.location ?? '')
  const [expireType, setExpireType]      = useState<'expire' | 'keep'>(editItem?.expire_type ?? 'keep')
  const [availableFrom, setAvailableFrom] = useState<string>(editItem?.available_from ?? '')
  const [reminderMins, setReminderMins]  = useState<number[]>(() => editItem ? (editItem.reminder_mins ?? []) : (settings?.default_reminder ?? []))

  const [isSaving, setIsSaving]    = useState(false)
  const [error, setError]          = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [showNewSub, setShowNewSub] = useState(false)
  const [overwriteCount, setOverwriteCount] = useState<number | null>(null)
  const [pendingSubmit, setPendingSubmit]   = useState(false)

  const [repeatType, setRepeatType] = useState<Schedule['repeat_type']>(
    (isAll || isAfter) ? (editItem?.repeat_type ?? 'none') : 'none'
  )
  const [repeatDays, setRepeatDays] = useState<number[]>(
    (isAll || isAfter) ? (editItem?.repeat_days ?? []) : []
  )

  const initRepeatEndType = (): RepeatEndType => {
    if (!editItem) return 'forever'
    if (editItem.repeat_end_at) return 'until'
    if (editItem.repeat_count && editItem.repeat_count > 0) return 'count'
    return 'forever'
  }
  const initRepeatEndAt  = () => editItem?.repeat_end_at ? fromUTCISO(editItem.repeat_end_at, tz).date : ''
  const initRepeatCount  = () => (editItem?.repeat_count && editItem.repeat_count > 0) ? editItem.repeat_count : 4

  const [repeatEndType, setRepeatEndType] = useState<RepeatEndType>(initRepeatEndType)
  const [repeatEndAt, setRepeatEndAt]     = useState(initRepeatEndAt)
  const [repeatCount, setRepeatCount]     = useState(initRepeatCount)

  useEffect(() => { if (categories.length === 0) fetchCategories().then(setCategories) }, [])
  useEffect(() => {
    if (!editItem) {
      const sub = categories.find((c: Category) => c.id === subCategoryId)
      const cat = categories.find((c: Category) => c.id === categoryId)
      const imp = sub?.default_importance ?? cat?.default_importance
      if (imp) setImportance(imp)
    }
  }, [categoryId, subCategoryId])

  const parentCats = categories.filter((c: Category) => !c.parent_id)
  const subCats    = categoryId ? categories.filter((c: Category) => c.parent_id === categoryId) : []
  const hasDeadline = isTodo && deadlinePrecision !== 'none'

  function nextOrderFor(parentId?: string): number {
    const siblings = parentId ? categories.filter((c: Category) => c.parent_id === parentId) : categories.filter((c: Category) => !c.parent_id)
    return siblings.length > 0 ? Math.max(...siblings.map((c: Category) => c.order ?? 0)) + 1 : 1
  }

  // ── 일정 반복 + 요일 불일치 경고 (일정 모드, 신규/all/this) ──
  const scheduleWeekdayMismatch = (
    !isTodo &&
    (isNew || isAll || isThis) &&
    repeatType === 'weekly' &&
    repeatDays.length > 0 &&
    startDate.length >= 10 &&
    !repeatDays.includes(new Date(startDate).getDay())
  )

  // 일정 반복 요일 불일치 시 가장 가까운 요일로 자동 조정
  const scheduleAdjustedStartDate: string | null = (() => {
    if (!scheduleWeekdayMismatch || !startDate || repeatDays.length === 0) return null
    const base    = new Date(startDate)
    const baseDow = base.getDay()
    let minDiff   = 8
    for (const dow of repeatDays) {
      const diff = (dow - baseDow + 7) % 7
      const effectiveDiff = diff === 0 ? 7 : diff
      if (effectiveDiff < minDiff) minDiff = effectiveDiff
    }
    const result = new Date(base)
    result.setDate(result.getDate() + minDiff)
    return result.toISOString().slice(0, 10)
  })()

  // ── Todo 반복 + 요일 불일치 경고 ──────────────────────────
  const todoWeekdayMismatch = (
    isTodo &&
    repeatType === 'weekly' &&
    repeatDays.length > 0 &&
    (deadlinePrecision === 'day' || deadlinePrecision === 'datetime') &&
    deadlineInput.length >= 10 &&
    !repeatDays.includes(new Date(deadlineInput.slice(0, 10)).getDay())
  )

  const todoAdjustedStartDate: string | null = (() => {
    if (!todoWeekdayMismatch || repeatDays.length === 0) return null
    let base: Date | null = null
    if (deadlinePrecision === 'day' || deadlinePrecision === 'datetime') {
      const d = new Date(deadlineInput.slice(0, 10))
      if (!isNaN(d.getTime())) base = d
    } else if (deadlinePrecision === 'month') {
      const [y, m] = deadlineInput.split('-').map(Number)
      if (y && m) base = new Date(y, m - 1, 1)
    } else if (deadlinePrecision === 'year') {
      const y = parseInt(deadlineInput)
      if (y) base = new Date(y, 0, 1)
    }
    if (!base) return null
    const baseDow = base.getDay()
    let minDiff   = 8
    for (const dow of repeatDays) {
      const diff = (dow - baseDow + 7) % 7
      const effectiveDiff = diff === 0 ? 7 : diff
      if (effectiveDiff < minDiff) minDiff = effectiveDiff
    }
    const result = new Date(base)
    result.setDate(result.getDate() + minDiff)
    return result.toISOString().slice(0, 10)
  })()

  // ── 예외 레코드 개수 조회 ─────────────────────────────────
  async function countExceptions(mode: 'all' | 'this_and_after'): Promise<number> {
    if (!editItem) return 0
    const parentId = editItem.parent_id || editItem.id
    try {
      if (mode === 'all') {
        const recs = await pb.collection('schedules').getFullList({
          filter: `parent_id="${parentId}"`, fields: 'id', requestKey: null,
        })
        return recs.length
      } else {
        const occDate = editItem._isVirtual
          ? (editItem._occurrenceDate ?? '')
          : (editItem.exception_date || (editItem.start_at ? editItem.start_at.slice(0, 10) : ''))
        if (!occDate) return 0
        const recs = await pb.collection('schedules').getFullList({
          filter: `parent_id="${parentId}" && exception_date>="${occDate}"`, fields: 'id', requestKey: null,
        })
        return recs.length
      }
    } catch { return 0 }
  }

  // ── 저장 ─────────────────────────────────────────────────
  async function handleSubmit() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (!isTodo && isNew) {
      if (!startDate) { setError('시작 날짜를 입력해주세요'); return }
      if (!isAllDay && !startTime) { setError('시작 시각을 입력해주세요'); return }
    }

    // all/this_and_after: 예외 개수 확인 후 경고
    if ((isAll || isAfter) && !pendingSubmit) {
      const cnt = await countExceptions(isAll ? 'all' : 'this_and_after')
      if (cnt > 0) {
        setOverwriteCount(cnt)
        return
      }
    }
    setPendingSubmit(false)

    // 시작/종료 일시 역전 검사 (요일 조정 및 종료일 연동 고려)
    if (!isTodo && !isAllDay && startDate && endDate) {
      const effectiveStart = (repeatType === 'weekly' && scheduleAdjustedStartDate) ? scheduleAdjustedStartDate : startDate
      // 종료일도 시작일 조정만큼 이동
      const startAdjustDays = (repeatType === 'weekly' && scheduleAdjustedStartDate && startDate)
        ? Math.round((new Date(scheduleAdjustedStartDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const effectiveEnd = (() => {
        if (startAdjustDays === 0) return endDate
        const d = new Date(endDate)
        d.setDate(d.getDate() + startAdjustDays)
        return d.toISOString().slice(0, 10)
      })()
      const sTime = startTime || '00:00'
      const eTime = endTime   || '23:59'
      const startMs = new Date(`${effectiveStart}T${sTime}:00`).getTime()
      const endMs   = new Date(`${effectiveEnd}T${eTime}:00`).getTime()
      if (endMs < startMs) {
        setError('종료 일시가 시작 일시보다 이릅니다.')
        return
      }
      if (endMs === startMs) {
        setError('종료 일시가 시작 일시와 같습니다.')
        return
      }
    }

    // available_from이 마감 기한보다 뒤인지 검사
    if (isTodo && availableFrom && hasDeadline && deadlineInput) {
      const deadlineDate = deadlineInput.slice(0, 10)
      if (availableFrom > deadlineDate) {
        setError('시작 가능 시점이 마감 기한보다 늦을 수 없습니다.')
        return
      }
    }

    setIsSaving(true); setError('')
    try {
      // ── all / this_and_after ───────────────────────────
      if ((isAll || isAfter) && editItem) {
        const bulkData: Partial<Schedule> = {
          title: title.trim(), importance,
          category_id:     categoryId    || undefined,
          sub_category_id: subCategoryId || undefined,
          description, location,
          reminder_mins: reminderMins,
          is_all_day: isAllDay,
          expire_type: expireType,
        }

        // 시작 시각 반영 (날짜는 모드별 처리)
        if (isAll) {
          // all: 시작 날짜·시각 모두 변경 가능, 요일 불일치 시 자동 조정
          const effectiveStartDate = (repeatType === 'weekly' && scheduleAdjustedStartDate)
            ? scheduleAdjustedStartDate
            : startDate
          if (!isAllDay) {
            if (effectiveStartDate && startTime)
              bulkData.start_at = toUTCISO(`${effectiveStartDate}T${startTime}:00`, tz)
            else if (effectiveStartDate) {
              const origStart = editItem.start_at ? fromUTCISO(editItem.start_at, tz) : null
              bulkData.start_at = toUTCISO(`${effectiveStartDate}T${origStart?.time ?? '00:00'}:00`, tz)
            }
            if (endDate && endTime)
              bulkData.end_at = toUTCISO(`${endDate}T${endTime}:00`, tz)
            else if (endDate)
              bulkData.end_at = toUTCISO(`${endDate}T23:59:00`, tz)
            else if (endTime && effectiveStartDate)
              bulkData.end_at = toUTCISO(`${effectiveStartDate}T${endTime}:00`, tz)
          } else {
            bulkData.start_at = toUTCISO(`${effectiveStartDate}T00:00:00`, tz)
            bulkData.end_at   = toUTCISO(`${endDate || effectiveStartDate}T23:59:00`, tz)
          }
          // 반복 패턴
          bulkData.repeat_type  = repeatType
          bulkData.repeat_days  = repeatType === 'weekly' ? repeatDays : []
          bulkData.repeat_end_at = repeatEndType === 'until' && repeatEndAt ? toUTCISO(repeatEndAt + 'T23:59:00', tz) : ''
          bulkData.repeat_count  = repeatEndType === 'count' ? repeatCount : 0
          await updateAllOccurrences(editItem, bulkData)
        } else {
          // this_and_after: 시작 시각만 교체
          const origStart = editItem.start_at ? fromUTCISO(editItem.start_at, tz) : null
          if (origStart && startTime) {
            bulkData.start_at = toUTCISO(`${origStart.date}T${startTime}:00`, tz)
          }
          if (editItem.end_at && endTime) {
            const origEnd = fromUTCISO(editItem.end_at, tz)
            bulkData.end_at = toUTCISO(`${origEnd.date}T${endTime}:00`, tz)
          }
          await updateFromOccurrence(editItem, bulkData)
        }
        onSave(); return
      }

      // ── 신규 / this ────────────────────────────────────
      let startAt: string | undefined
      let endAt:   string | undefined

      if (!isTodo) {
        // 일정: 요일 불일치 시 startDate 자동 조정, 종료일도 주차 유지
        const effectiveStartDate = (repeatType === 'weekly' && scheduleAdjustedStartDate)
          ? scheduleAdjustedStartDate
          : startDate

        // 시작일 조정 일수 계산 → 종료일도 동일하게 이동
        const startAdjustDays = (repeatType === 'weekly' && scheduleAdjustedStartDate && startDate)
          ? Math.round((new Date(scheduleAdjustedStartDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0

        function adjustDate(dateStr: string, days: number): string {
          const d = new Date(dateStr)
          d.setDate(d.getDate() + days)
          return d.toISOString().slice(0, 10)
        }

        const effectiveEndDate = endDate && startAdjustDays !== 0
          ? adjustDate(endDate, startAdjustDays)
          : endDate

        if (isAllDay) {
          startAt = toUTCISO(`${effectiveStartDate}T00:00:00`, tz)
          endAt   = toUTCISO(`${effectiveEndDate || effectiveStartDate}T23:59:00`, tz)
        } else {
          startAt = toUTCISO(`${effectiveStartDate}T${startTime}:00`, tz)
          endAt   = effectiveEndDate && endTime
            ? toUTCISO(`${effectiveEndDate}T${endTime}:00`, tz)
            : effectiveEndDate
              ? toUTCISO(`${effectiveEndDate}T23:59:00`, tz)
              : endTime
                ? toUTCISO(`${effectiveStartDate}T${endTime}:00`, tz)
                : toUTCISO(`${effectiveStartDate}T23:59:00`, tz)
        }
      }

      const repeatFields: Partial<Schedule> = isNew
        ? repeatType !== 'none'
          ? {
              repeat_type:   repeatType,
              repeat_days:   repeatType === 'weekly' ? repeatDays : [],
              repeat_end_at: repeatEndType === 'until' && repeatEndAt ? toUTCISO(repeatEndAt + 'T23:59:00', tz) : undefined,
              repeat_count:  repeatEndType === 'count' ? repeatCount : undefined,
            }
          : { repeat_type: 'none', repeat_days: [], repeat_end_at: undefined, repeat_count: 0 }
        : {}

      const data: Partial<Schedule> = {
        title: title.trim(), importance,
        is_todo: isTodo,
        category_id:     categoryId    || undefined,
        sub_category_id: subCategoryId || undefined,
        description, location, reminder_mins: reminderMins,
        ...(isTodo
          ? {
              is_all_day: false,
              start_at: repeatType === 'weekly' && todoAdjustedStartDate
                ? computeTodoStartAt(deadlinePrecision, todoAdjustedStartDate, tz)
                : computeTodoStartAt(deadlinePrecision, deadlineInput, tz),
              deadline_precision: deadlinePrecision,
              expire_type: expireType,
              available_from: availableFrom || '',
            }
          : { is_all_day: isAllDay, start_at: startAt, end_at: endAt }
        ),
        ...repeatFields,
      }

      if (editItem) {
        let savedSchedule: Schedule
        if (editItem._isVirtual) {
          savedSchedule = await createException(editItem.parent_id, editItem._occurrenceDate!, { ...data, is_todo: editItem.is_todo })
        } else {
          savedSchedule = await updateSchedule(editItem.id, data)
        }
        await syncNotificationsForSchedule(savedSchedule, settings)
      } else {
        const savedSchedule = await createSchedule(data)
        await syncNotificationsForSchedule(savedSchedule, settings)
      }
      onSave()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally { setIsSaving(false) }
  }

  function handleAllDayChange(checked: boolean) {
    setIsAllDay(checked)
    if (checked) { setStartTime(''); setEndTime('') }
  }

  function handleCategoryChange(val: string) {
    if (val === '__new__') { setShowNewCat(true); return }
    setCategoryId(val); setSubCategoryId(''); setShowNewSub(false)
  }

  function toggleRepeatDay(d: number) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function allowedRepeatTypes(): Schedule['repeat_type'][] {
    if (!isTodo) return ['none', 'daily', 'weekly', 'monthly', 'yearly']
    switch (deadlinePrecision) {
      case 'none':     return []
      case 'year':     return ['none', 'yearly']
      case 'month':    return ['none', 'monthly', 'yearly']
      case 'day':
      case 'datetime': return ['none', 'daily', 'weekly', 'monthly', 'yearly']
      default:         return ['none']
    }
  }

  function renderDeadlineInput() {
    if (deadlinePrecision === 'none') return null
    const cls = 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full'
    switch (deadlinePrecision) {
      case 'year':     return <input type="number" placeholder="연도 (예: 2026)" min={2020} max={2099} value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
      case 'month':    return <input type="month"  value={deadlineInput.slice(0, 7)} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
      case 'day':      return <input type="date"   value={deadlineInput.slice(0, 10)} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
      case 'datetime': return <input type="datetime-local" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} className={cls} />
    }
  }

  function renderRepeatSection() {
    // this_and_after: 반복 설정 숨김
    if (isAfter) return null
    // this: 반복 설정 숨김
    if (isThis) return null
    // Todo + 마감 기한 없음: 반복 숨김
    if (isTodo && deadlinePrecision === 'none') return null

    const allowed = allowedRepeatTypes()
    const weekdayMismatch   = isTodo ? todoWeekdayMismatch : scheduleWeekdayMismatch
    const adjustedStartDate = isTodo ? todoAdjustedStartDate : scheduleAdjustedStartDate

    return (
      <div className="flex flex-col gap-3 pt-1 border-t border-gray-800">
        <label className="text-xs text-gray-500 block">반복</label>
        <div className="flex gap-1">
          {(['none', 'daily', 'weekly', 'monthly', 'yearly'] as const)
            .filter(t => allowed.includes(t))
            .map(t => (
            <button key={t} onClick={() => { setRepeatType(t); if (t !== 'weekly') setRepeatDays([]) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${repeatType === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {REPEAT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {repeatType === 'weekly' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-500">요일</span>
            <div className="flex gap-1">
              {REPEAT_DAY_LABELS.map((label, idx) => (
                <button key={idx} onClick={() => toggleRepeatDay(idx)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${repeatDays.includes(idx) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            {weekdayMismatch && adjustedStartDate && (() => {
              const adjDow = new Date(adjustedStartDate).getDay()
              return (
                <p className="text-xs text-amber-400">
                  ⚠️ 시작 날짜가 선택한 요일과 다릅니다. 첫 회차가 {adjustedStartDate} ({REPEAT_DAY_LABELS[adjDow]}요일)로 자동 조정됩니다.
                </p>
              )
            })()}
          </div>
        )}

        {canEditRepeatEnd && repeatType !== 'none' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-500">종료</span>
            <div className="flex gap-1">
              {(['forever', 'until', 'count'] as const).map(et => (
                <button key={et} onClick={() => setRepeatEndType(et)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${repeatEndType === et ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {et === 'forever' ? '무기한' : et === 'until' ? '종료일' : '횟수'}
                </button>
              ))}
            </div>
            {repeatEndType === 'until' && (
              <input type="date" value={repeatEndAt} onChange={e => setRepeatEndAt(e.target.value)}
                className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full" />
            )}
            {repeatEndType === 'count' && (
              <div className="flex items-center gap-2">
                <input type="number" min={2} max={365} value={repeatCount}
                  onChange={e => setRepeatCount(Math.max(2, parseInt(e.target.value) || 2))}
                  className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24" />
                <span className="text-sm text-gray-400">회 (원본 포함)</span>
              </div>
            )}
          </div>
        )}
        {isAll && <p className="text-xs text-amber-400/70">반복 주기와 종료 조건도 함께 변경됩니다.</p>}
      </div>
    )
  }

  function renderReminderSection() {
    if (isTodo && deadlinePrecision === 'none') {
      return (
        <div className="flex flex-col gap-2 pt-1 border-t border-gray-800">
          <label className="text-xs text-gray-500 block">알림</label>
          <p className="text-xs text-gray-600">마감 기한을 설정해야 알림을 받을 수 있어요.</p>
        </div>
      )
    }
    const REMINDER_OPTIONS = [
      { mins: 0,    label: '시작 시',  disabledForAllDay: true  },
      { mins: 10,   label: '10분 전',  disabledForAllDay: true  },
      { mins: 30,   label: '30분 전',  disabledForAllDay: true  },
      { mins: 60,   label: '1시간 전', disabledForAllDay: true  },
      { mins: 1440, label: '하루 전',  disabledForAllDay: false },
    ]
    return (
      <div className="flex flex-col gap-2 pt-1 border-t border-gray-800">
        <label className="text-xs text-gray-500 block">알림 (복수 선택 가능)</label>
        <div className="flex gap-1 flex-wrap">
          {REMINDER_OPTIONS.map(({ mins, label, disabledForAllDay }) => {
            const isDisabled = isAllDay && disabledForAllDay
            const isActive   = reminderMins.includes(mins) && !isDisabled
            return (
              <button key={mins} disabled={isDisabled}
                onClick={() => !isDisabled && setReminderMins(prev => prev.includes(mins) ? prev.filter(m => m !== mins) : [...prev, mins])}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDisabled ? 'bg-gray-800/50 text-gray-700 cursor-not-allowed' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            )
          })}
        </div>
        {isAllDay && <p className="text-xs text-gray-600">⚠️ 종일 일정은 하루 전 알림만 지원돼요.</p>}
      </div>
    )
  }

  const headerTitle = (() => {
    if (isNew) return '새 항목'
    if (isThis) return '이 일정 수정'
    if (isAfter) return '이후 일정 수정'
    if (isAll) return '모든 일정 수정'
    return '수정'
  })()

  const inputCls  = 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full'
  const selectCls = 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-full'

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <div>
              <h3 className="font-semibold text-lg">{headerTitle}</h3>
              {isRepeatEdit && (
                <p className="text-xs text-amber-400/80 mt-0.5">
                  {isAll   && '시작 날짜·반복 주기·종료 조건 포함 전체 일괄 적용'}
                  {isAfter && '이후 회차 시각·메타 일괄 적용 (반복 패턴 유지)'}
                  {isThis  && '이 회차만 예외 수정'}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Todo/일정 토글: 생성 시만 */}
            {canEditTodoToggle && (
              <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
                {([true, false] as const).map(v => (
                  <button key={String(v)} onClick={() => setIsTodo(v)}
                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${isTodo === v ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {v ? 'Todo' : '일정'}
                  </button>
                ))}
              </div>
            )}

            <input type="text" placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full" />

            {/* 일정 시간 필드 */}
            {!isTodo && (
              <>
                {canEditAllDay && (
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={isAllDay} onChange={e => handleAllDayChange(e.target.checked)} className="accent-blue-500" />
                    종일
                  </label>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">시작</label>
                  <div className="flex gap-2">
                    {canEditStartDate ? (
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className={isAllDay ? inputCls : 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1'} />
                    ) : (
                      <div className={`${isAllDay ? inputCls : 'flex-1 bg-gray-800/50 rounded-lg px-3 py-2 text-sm text-gray-500'}`}>
                        {startDate} <span className="text-xs text-gray-600">(변경 불가)</span>
                      </div>
                    )}
                    {!isAllDay && canEditTime && (
                      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                        className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                    )}
                  </div>
                  {scheduleWeekdayMismatch && scheduleAdjustedStartDate && !isAll && (
                    <p className="text-xs text-amber-400 mt-1">
                      ⚠️ 시작 날짜가 선택한 요일과 다릅니다. {scheduleAdjustedStartDate} ({REPEAT_DAY_LABELS[new Date(scheduleAdjustedStartDate).getDay()]}요일)로 자동 조정됩니다.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">
                    종료 {isAllDay ? '(미입력 시 시작일과 동일)' : '(미입력 시 당일 23:59)'}
                  </label>
                  <div className="flex gap-2">
                    {canEditEndDate ? (
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className={isAllDay ? inputCls : 'bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1'} />
                    ) : (
                      <div className={`${isAllDay ? inputCls : 'flex-1 bg-gray-800/50 rounded-lg px-3 py-2 text-sm text-gray-500'}`}>
                        {endDate || '—'} <span className="text-xs text-gray-600">(변경 불가)</span>
                      </div>
                    )}
                    {!isAllDay && canEditTime && (
                      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                        className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Todo 마감 기한 */}
            {isTodo && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-500 block">마감 기한</label>
                {canEditDeadline ? (
                  <>
                    <div className="flex gap-1">
                      {(['none', 'year', 'month', 'day', 'datetime'] as const).map(p => (
                        <button key={p} onClick={() => { setDeadlinePrecision(p); setDeadlineInput(p === 'day' || p === 'datetime' ? (defaultDate ?? '') : '') }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${deadlinePrecision === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                          {PRECISION_LABELS[p]}
                        </button>
                      ))}
                    </div>
                    {renderDeadlineInput()}
                  </>
                ) : (
                  <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-sm text-gray-500">
                    {deadlineInput || '없음'} <span className="text-xs text-gray-600">(변경 불가)</span>
                  </div>
                )}
              </div>
            )}

            {/* 기한 초과 처리 */}
            {hasDeadline && canEditExpireType && (
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

            {/* 시작 가능 시점 (Todo 전용) */}
            {isTodo && (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">시작 가능 시점 (선택)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={availableFrom}
                    onChange={e => setAvailableFrom(e.target.value)}
                    className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                  />
                  {availableFrom && (
                    <button
                      onClick={() => setAvailableFrom('')}
                      className="text-xs text-gray-500 hover:text-white px-2 py-2 rounded-lg bg-gray-800 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {availableFrom && (
                  <p className="text-xs text-gray-600 mt-1">
                    이 날짜 이전에는 목록에서 미시작 상태로 표시됩니다.
                  </p>
                )}
              </div>
            )}

            {/* 반복 설정 */}
            {renderRepeatSection()}

            {/* 카테고리 */}
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
                  <select value={showNewSub ? '__new__' : subCategoryId} onChange={e => e.target.value === '__new__' ? setShowNewSub(true) : setSubCategoryId(e.target.value)} className={selectCls}>
                    <option value="">선택 안함</option>
                    {subCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__new__">＋ 새 소카테고리 만들기</option>
                  </select>
                  {showNewSub && <InlineCategoryCreator parentId={categoryId} nextOrder={nextOrderFor(categoryId)} onCreated={sub => { setCategories([...categories, sub]); setSubCategoryId(sub.id); setShowNewSub(false) }} onCancel={() => setShowNewSub(false)} />}
                </div>
              )}
            </div>

            {/* 중요도 */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">중요도: {importance.toFixed(1)}</label>
              <input type="range" min={1} max={10} step={0.1} value={importance} onChange={e => setImportance(parseFloat(e.target.value))} className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1</span><span>10</span></div>
            </div>

            {/* 알림 */}
            {renderReminderSection()}

            {/* 장소·메모 */}
            {canEditLocation && (
              <input type="text" placeholder="장소 (선택)" value={location} onChange={e => setLocation(e.target.value)} maxLength={100}
                className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full" />
            )}
            {canEditMemo && (
              <textarea placeholder="메모 (선택)" value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" />
            )}

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

      {/* 예외 덮어쓰기 경고 */}
      {overwriteCount !== null && (
        <OverwriteWarningDialog
          count={overwriteCount}
          mode={isAll ? 'all' : 'this_and_after'}
          onConfirm={() => { setOverwriteCount(null); setPendingSubmit(true); setTimeout(() => handleSubmit(), 0) }}
          onCancel={() => { setOverwriteCount(null); setPendingSubmit(false) }}
        />
      )}
    </>
  )
}
