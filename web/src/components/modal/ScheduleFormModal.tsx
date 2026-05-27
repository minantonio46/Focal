import { useState, useEffect } from 'react'
import { createSchedule, updateSchedule, fetchCategories } from '../../lib/api'
import type { Schedule, Category } from '../../types'
import useAppStore from '../../stores/useAppStore'

interface Props {
  onClose: () => void
  onSave: () => void
  defaultIsTodo?: boolean
  editItem?: Schedule
}

export default function ScheduleFormModal({ onClose, onSave, defaultIsTodo = false, editItem }: Props) {
  const { categories, setCategories } = useAppStore()

  const [isTodo, setIsTodo] = useState(editItem ? editItem.is_todo : defaultIsTodo)
  const [title, setTitle] = useState(editItem?.title ?? '')
  const [startAt, setStartAt] = useState(editItem?.start_at ? editItem.start_at.slice(0, 16) : '')
  const [endAt, setEndAt] = useState(editItem?.end_at ? editItem.end_at.slice(0, 16) : '')
  const [isAllDay, setIsAllDay] = useState(editItem?.is_all_day ?? false)
  const [importance, setImportance] = useState(editItem?.importance ?? 5)
  const [categoryId, setCategoryId] = useState(editItem?.category_id ?? '')
  const [subCategoryId, setSubCategoryId] = useState(editItem?.sub_category_id ?? '')
  const [description, setDescription] = useState(editItem?.description ?? '')
  const [location, setLocation] = useState(editItem?.location ?? '')
  const [expireType, setExpireType] = useState<'expire' | 'keep'>(editItem?.expire_type ?? 'keep')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories().then(setCategories)
    }
  }, [])

  useEffect(() => {
    if (!editItem) {
      const sub = categories.find((c: Category) => c.id === subCategoryId)
      const cat = categories.find((c: Category) => c.id === categoryId)
      const imp = sub?.default_importance ?? cat?.default_importance
      if (imp) setImportance(imp)
    }
  }, [categoryId, subCategoryId])

  const parentCats = categories.filter((c: Category) => !c.parent_id)
  const subCats = categories.filter((c: Category) => c.parent_id === categoryId)

  async function handleSubmit() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (!isTodo && !startAt) { setError('시작 시각을 입력해주세요'); return }

    setIsSaving(true)
    setError('')
    try {
      const data: Partial<Schedule> = {
        title: title.trim(),
        is_todo: isTodo,
        is_all_day: isAllDay,
        importance,
        category_id: categoryId || undefined,
        sub_category_id: subCategoryId || undefined,
        description,
        location,
        ...(isTodo && {
          start_at: startAt || undefined,
          expire_type: expireType,
          deadline_precision: startAt ? 'datetime' : 'none',
        }),
        ...(!isTodo && {
          start_at: startAt,
          end_at: endAt || `${startAt.slice(0, 10)}T23:59`,
        }),
      }

      if (editItem) {
        await updateSchedule(editItem.id, data)
      } else {
        await createSchedule(data)
      }
      onSave()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">{editItem ? '수정' : '새 항목'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setIsTodo(true)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${isTodo ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Todo
            </button>
            <button
              onClick={() => setIsTodo(false)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${!isTodo ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              일정
            </button>
          </div>

          <input
            type="text"
            placeholder="제목"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
          />

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="accent-blue-500" />
            종일
          </label>

          {!isAllDay && (
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{isTodo ? '마감 기한' : '시작 시각'}</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
              {!isTodo && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">종료 시각</label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={e => setEndAt(e.target.value)}
                    className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  />
                </div>
              )}
            </div>
          )}

          {isTodo && startAt && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">기한 초과 시</label>
              <div className="flex gap-2">
                {(['keep', 'expire'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setExpireType(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      expireType === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {v === 'keep' ? '유지' : '만료 표시'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">카테고리</label>
              <select
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); setSubCategoryId('') }}
                className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-full"
              >
                <option value="">선택 안함</option>
                {parentCats.map((c: Category) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {subCats.length > 0 && (
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">소카테고리</label>
                <select
                  value={subCategoryId}
                  onChange={e => setSubCategoryId(e.target.value)}
                  className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-full"
                >
                  <option value="">선택 안함</option>
                  {subCats.map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">중요도: {importance.toFixed(1)}</label>
            <input
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={importance}
              onChange={e => setImportance(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>1</span><span>10</span>
            </div>
          </div>

          <input
            type="text"
            placeholder="장소 (선택)"
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={100}
            className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
          />

          <textarea
            placeholder="메모 (선택)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
