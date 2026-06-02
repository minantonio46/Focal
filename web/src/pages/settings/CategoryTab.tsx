import { useState, useRef, useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'
import { createCategory, updateCategory, deleteCategory, fetchCategories, updateSchedule } from '../../lib/api'
import type { Category } from '../../types'
import ConfirmDialog from '../../components/modal/ConfirmDialog'

const DEFAULT_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#EF4444',
  '#F59E0B', '#6B7280', '#EC4899', '#14B8A6', '#84CC16',
]

type ImportanceApplyMode = 'future' | 'all' | 'relative'

function ImportanceDialog({ title, description, oldImportance, newImportance, onSelect, onCancel }: {
  title: string; description: string
  oldImportance: number; newImportance: number
  onSelect: (mode: ImportanceApplyMode) => void
  onCancel: () => void
}) {
  const diff = newImportance - oldImportance
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-800">
          <h3 className="font-semibold text-base">{title}</h3>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
          <p className="text-xs text-gray-500 mt-0.5">중요도 {oldImportance} → {newImportance} ({diffLabel})</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <button onClick={() => onSelect('future')} className="w-full py-3 px-4 rounded-xl text-left bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="text-sm font-medium text-white">이후 항목에만 적용</div>
            <div className="text-xs text-gray-500 mt-0.5">기존 항목은 그대로 유지</div>
          </button>
          <button onClick={() => onSelect('all')} className="w-full py-3 px-4 rounded-xl text-left bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="text-sm font-medium text-white">기존 항목 전체 일괄 재적용</div>
            <div className="text-xs text-gray-500 mt-0.5">모든 항목을 {newImportance}으로 변경</div>
          </button>
          <button onClick={() => onSelect('relative')} className="w-full py-3 px-4 rounded-xl text-left bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="text-sm font-medium text-white">격차 유지하여 재적용</div>
            <div className="text-xs text-gray-500 mt-0.5">기존 중요도에 {diffLabel} 적용 (1~10 범위 클리핑)</div>
          </button>
        </div>
        <div className="px-5 pb-5">
          <button onClick={onCancel} className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}

function CategoryForm({ initialName = '', initialColor = DEFAULT_COLORS[0], initialImportance = 5, onSave, onCancel, saveLabel = '추가' }: {
  initialName?: string; initialColor?: string; initialImportance?: number
  onSave: (name: string, color: string, importance: number) => Promise<void>
  onCancel: () => void; saveLabel?: string
}) {
  const [name, setName]             = useState(initialName)
  const [color, setColor]           = useState(initialColor)
  const [importance, setImportance] = useState(initialImportance)
  const [saving, setSaving]         = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try { await onSave(name.trim(), color, importance) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
        placeholder="카테고리 이름" className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500" />
      <div>
        <p className="text-xs text-gray-500 mb-2">색상</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">기본 중요도 <span className="text-white">{importance}</span></p>
        <input type="range" min={1} max={10} value={importance} onChange={e => setImportance(Number(e.target.value))} className="w-full accent-blue-500" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">취소</button>
        <button onClick={handleSave} disabled={!name.trim() || saving}
          className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors">
          {saving ? '저장 중…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

function SubCategoryItem({ cat, onUpdate, onDelete }: {
  cat: Category
  onUpdate: (id: string, name: string, color: string, importance: number) => Promise<void>
  onDelete: (cat: Category) => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/50 rounded-lg transition-colors">
      {editing ? (
        <div className="flex-1">
          <CategoryForm initialName={cat.name} initialColor={cat.color} initialImportance={cat.default_importance}
            onSave={async (name, color, importance) => { await onUpdate(cat.id, name, color, importance); setEditing(false) }}
            onCancel={() => setEditing(false)} saveLabel="저장" />
        </div>
      ) : (
        <>
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="text-sm text-gray-300 flex-1">{cat.name}</span>
          <span className="text-xs text-gray-600">중요도 {cat.default_importance}</span>
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-blue-400 px-2 py-1 rounded transition-colors">편집</button>
            <button onClick={() => onDelete(cat)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded transition-colors">삭제</button>
          </div>
        </>
      )}
    </div>
  )
}

function ParentCategoryCard({ parent, children, onUpdateParent, onDeleteParent, onAddChild, onUpdateChild, onDeleteChild }: {
  parent: Category; children: Category[]
  onUpdateParent: (id: string, name: string, color: string, importance: number) => Promise<void>
  onDeleteParent: (cat: Category) => void
  onAddChild: (parentId: string, name: string, color: string, importance: number) => Promise<void>
  onUpdateChild: (id: string, name: string, color: string, importance: number) => Promise<void>
  onDeleteChild: (cat: Category) => void
}) {
  const [expanded, setExpanded]           = useState(true)
  const [editingParent, setEditingParent] = useState(false)
  const [addingChild, setAddingChild]     = useState(false)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {editingParent ? (
        <div className="p-4">
          <CategoryForm initialName={parent.name} initialColor={parent.color} initialImportance={parent.default_importance}
            onSave={async (name, color, importance) => { await onUpdateParent(parent.id, name, color, importance); setEditingParent(false) }}
            onCancel={() => setEditingParent(false)} saveLabel="저장" />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setExpanded(v => !v)} className="text-gray-500 hover:text-white text-xs w-4 transition-colors">
            {expanded ? '▾' : '▸'}
          </button>
          <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color }} />
          <span className="font-medium text-white flex-1">{parent.name}</span>
          <span className="text-xs text-gray-600">중요도 {parent.default_importance}</span>
          <div className="flex gap-1">
            <button onClick={() => setEditingParent(true)} className="text-xs text-gray-500 hover:text-blue-400 px-2 py-1 rounded transition-colors">편집</button>
            <button onClick={() => onDeleteParent(parent)} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded transition-colors">삭제</button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="border-t border-gray-800">
          {children.map(child => (
            <SubCategoryItem key={child.id} cat={child} onUpdate={onUpdateChild} onDelete={onDeleteChild} />
          ))}
          {addingChild ? (
            <div className="px-4 py-3">
              <CategoryForm initialColor={parent.color}
                onSave={async (name, color, importance) => { await onAddChild(parent.id, name, color, importance); setAddingChild(false) }}
                onCancel={() => setAddingChild(false)} saveLabel="추가" />
            </div>
          ) : (
            <button onClick={() => setAddingChild(true)} className="w-full flex items-center gap-2 px-10 py-2 text-sm text-gray-600 hover:text-gray-400 hover:bg-gray-800/30 transition-colors">
              <span>＋</span><span>소카테고리 추가</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface ParentEditContext {
  catId: string; catName: string
  oldImportance: number; newImportance: number
  name: string; color: string
  children: Category[]
}

export default function CategoryTab() {
  const { categories, setCategories, schedules, setSchedules } = useAppStore()
  const [addingParent, setAddingParent]         = useState(false)
  const [deleteTarget, setDeleteTarget]         = useState<Category | null>(null)
  const [deleteError, setDeleteError]           = useState('')
  const [deleteWithChildren, setDeleteWithChildren] = useState(false)
  const [parentEditCtx, setParentEditCtx]       = useState<ParentEditContext | null>(null)
  const [parentEditStep, setParentEditStep]     = useState<'sub_cat' | 'parent_only_schedules' | null>(null)
  const [subEditCtx, setSubEditCtx]             = useState<{ catId: string; catName: string; oldImportance: number; newImportance: number; name: string; color: string } | null>(null)

  const parents  = categories.filter(c => !c.parent_id).sort((a, b) => a.order - b.order)
  const childMap = new Map<string, Category[]>()
  for (const cat of categories) {
    if (cat.parent_id) {
      const arr = childMap.get(cat.parent_id) ?? []
      arr.push(cat)
      childMap.set(cat.parent_id, arr)
    }
  }

  async function reload() { setCategories(await fetchCategories()) }
  function nextOrder() { return categories.reduce((m, c) => Math.max(m, c.order), 0) + 1 }

  async function applyToSchedules(targetIds: string[], mode: ImportanceApplyMode, newBase: number, diff: number) {
    if (mode === 'future' || targetIds.length === 0) return
    const affected = schedules.filter(s => targetIds.includes(s.id))
    const updated = await Promise.all(affected.map(s => {
      const next = mode === 'all' ? newBase : Math.min(10, Math.max(1, s.importance + diff))
      return updateSchedule(s.id, { importance: next })
    }))
    const updatedMap = new Map(updated.map(s => [s.id, s]))
    setSchedules(schedules.map(s => updatedMap.get(s.id) ?? s))
  }

  async function handleUpdateParent(id: string, name: string, color: string, importance: number) {
    const old = categories.find(c => c.id === id)!
    await updateCategory(id, { name, color, default_importance: importance })
    await reload()
    if (old.default_importance === importance) return
    const children = categories.filter(c => c.parent_id === id)
    const ctx: ParentEditContext = { catId: id, catName: name, oldImportance: old.default_importance, newImportance: importance, name, color, children }
    setParentEditCtx(ctx)
    if (children.length > 0) setParentEditStep('sub_cat')
    else advanceToParentOnlyStep(ctx)
  }

  function advanceToParentOnlyStep(ctx: ParentEditContext) {
    const has = schedules.some(s => s.category_id === ctx.catId && !s.sub_category_id)
    if (has) setParentEditStep('parent_only_schedules')
    else { setParentEditCtx(null); setParentEditStep(null) }
  }

  async function handleSubCatImportanceMode(mode: ImportanceApplyMode) {
    if (!parentEditCtx) return
    const { children, oldImportance, newImportance } = parentEditCtx
    const diff = newImportance - oldImportance
    if (mode !== 'future') {
      await Promise.all(children.map(child => {
        const next = mode === 'all' ? newImportance : Math.min(10, Math.max(1, child.default_importance + diff))
        return updateCategory(child.id, { default_importance: next })
      }))
      await reload()
    }
    setParentEditStep(null)
    advanceToParentOnlyStep(parentEditCtx)
  }

  async function handleParentOnlySchedulesMode(mode: ImportanceApplyMode) {
    if (!parentEditCtx) return
    const { catId, oldImportance, newImportance } = parentEditCtx
    const targetIds = schedules.filter(s => s.category_id === catId && !s.sub_category_id).map(s => s.id)
    await applyToSchedules(targetIds, mode, newImportance, newImportance - oldImportance)
    setParentEditCtx(null); setParentEditStep(null)
  }

  async function handleUpdateChild(id: string, name: string, color: string, importance: number) {
    const old = categories.find(c => c.id === id)!
    await updateCategory(id, { name, color, default_importance: importance })
    await reload()
    if (old.default_importance === importance) return
    if (!schedules.some(s => s.sub_category_id === id)) return
    setSubEditCtx({ catId: id, catName: name, oldImportance: old.default_importance, newImportance: importance, name, color })
  }

  async function handleSubEditMode(mode: ImportanceApplyMode) {
    if (!subEditCtx) return
    const { catId, oldImportance, newImportance } = subEditCtx
    const targetIds = schedules.filter(s => s.sub_category_id === catId).map(s => s.id)
    await applyToSchedules(targetIds, mode, newImportance, newImportance - oldImportance)
    setSubEditCtx(null)
  }

  async function handleAddParent(name: string, color: string, importance: number) {
    await createCategory({ name, color, default_importance: importance, parent_id: '', order: nextOrder() })
    await reload(); setAddingParent(false)
  }

  async function handleAddChild(parentId: string, name: string, color: string, importance: number) {
    await createCategory({ name, color, default_importance: importance, parent_id: parentId, order: nextOrder() })
    await reload()
  }

  function requestDelete(cat: Category) { setDeleteError(''); setDeleteWithChildren(false); setDeleteTarget(cat) }

  async function confirmDelete() {
    if (!deleteTarget) return
    const isParent = !deleteTarget.parent_id
    if (isParent && !deleteWithChildren) {
      const children = categories.filter(c => c.parent_id === deleteTarget.id)
      if (children.length > 0) { setDeleteWithChildren(true); setDeleteError(`소카테고리 ${children.length}개도 함께 삭제됩니다.`); return }
    }
    try {
      if (isParent) for (const child of categories.filter(c => c.parent_id === deleteTarget.id)) await deleteCategory(child.id)
      await deleteCategory(deleteTarget.id)
      await reload()
      setDeleteTarget(null); setDeleteWithChildren(false); setDeleteError('')
    } catch { setDeleteError('삭제에 실패했습니다.') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">카테고리를 관리합니다.</p>
        {!addingParent && (
          <button onClick={() => setAddingParent(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
            <span>＋</span><span>대카테고리 추가</span>
          </button>
        )}
      </div>

      {addingParent && (
        <div className="mb-4">
          <CategoryForm onSave={handleAddParent} onCancel={() => setAddingParent(false)} saveLabel="추가" />
        </div>
      )}

      <div className="space-y-3 pb-8">
        {parents.length === 0 && !addingParent && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-sm">카테고리가 없습니다</p>
            <p className="text-xs text-gray-600 mt-1">위 버튼으로 대카테고리를 추가해 보세요</p>
          </div>
        )}
        {parents.map(parent => (
          <ParentCategoryCard key={parent.id} parent={parent}
            children={(childMap.get(parent.id) ?? []).sort((a, b) => a.order - b.order)}
            onUpdateParent={handleUpdateParent} onDeleteParent={requestDelete}
            onAddChild={handleAddChild} onUpdateChild={handleUpdateChild} onDeleteChild={requestDelete} />
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message={deleteError || `"${deleteTarget.name}" 카테고리를 삭제하시겠습니까?${!deleteTarget.parent_id ? '\n이 카테고리를 사용하는 일정의 카테고리 정보가 초기화됩니다.' : ''}`}
          onConfirm={deleteError && !deleteWithChildren ? undefined : confirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); setDeleteWithChildren(false) }}
          confirmLabel="삭제" confirmVariant="danger" />
      )}

      {parentEditCtx && parentEditStep === 'sub_cat' && (
        <ImportanceDialog title="소카테고리 기본 중요도 재적용"
          description={`"${parentEditCtx.catName}" 하위 소카테고리 ${parentEditCtx.children.length}개의 기본 중요도를 어떻게 처리할까요?`}
          oldImportance={parentEditCtx.oldImportance} newImportance={parentEditCtx.newImportance}
          onSelect={handleSubCatImportanceMode} onCancel={() => { setParentEditCtx(null); setParentEditStep(null) }} />
      )}
      {parentEditCtx && parentEditStep === 'parent_only_schedules' && (
        <ImportanceDialog title="목록 중요도 재적용"
          description={`"${parentEditCtx.catName}"만 설정된 목록 ${schedules.filter(s => s.category_id === parentEditCtx.catId && !s.sub_category_id).length}개의 중요도를 어떻게 처리할까요?`}
          oldImportance={parentEditCtx.oldImportance} newImportance={parentEditCtx.newImportance}
          onSelect={handleParentOnlySchedulesMode} onCancel={() => { setParentEditCtx(null); setParentEditStep(null) }} />
      )}
      {subEditCtx && (
        <ImportanceDialog title="목록 중요도 재적용"
          description={`"${subEditCtx.catName}" 소카테고리가 설정된 목록 ${schedules.filter(s => s.sub_category_id === subEditCtx.catId).length}개의 중요도를 어떻게 처리할까요?`}
          oldImportance={subEditCtx.oldImportance} newImportance={subEditCtx.newImportance}
          onSelect={handleSubEditMode} onCancel={() => setSubEditCtx(null)} />
      )}
    </div>
  )
}
