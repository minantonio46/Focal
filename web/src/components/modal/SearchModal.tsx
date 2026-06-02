import { useState, useEffect, useRef, useCallback } from 'react'
import useAppStore from '../../stores/useAppStore'
import type { Schedule, Category } from '../../types'
import DetailModal from './DetailModal'

interface Props {
  onClose: () => void
}

function highlight(text: string, query: string): string {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-400/30 text-yellow-200 rounded px-0.5">$1</mark>')
}

function getCategoryLabel(item: Schedule, categories: Category[]): string {
  const cat    = categories.find(c => c.id === item.category_id)
  const subCat = categories.find(c => c.id === item.sub_category_id)
  if (subCat) return `${cat?.name ?? ''} › ${subCat.name}`
  if (cat)    return cat.name
  return ''
}

export default function SearchModal({ onClose }: Props) {
  const { schedules, categories, settings } = useAppStore()
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<Schedule[]>([])
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // 검색 실행 — 제목 + 메모 전문 검색 (대소문자 무시)
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setResults([])
      return
    }
    const matched = schedules
      .filter(s => !s._isVirtual)                     // 가상 인스턴스 제외
      .filter(s => {
        const inTitle = s.title.toLowerCase().includes(q)
        const inDesc  = (s.description ?? '').toLowerCase().includes(q)
        return inTitle || inDesc
      })
      .sort((a, b) => {
        // 제목 일치 우선, 그 다음 최신 updated 순
        const aTitle = a.title.toLowerCase().includes(q)
        const bTitle = b.title.toLowerCase().includes(q)
        if (aTitle !== bTitle) return aTitle ? -1 : 1
        return new Date(b.updated).getTime() - new Date(a.updated).getTime()
      })
      .slice(0, 50)
    setResults(matched)
  }, [query, schedules])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  function handleItemClick(item: Schedule) {
    setSelectedItem(item)
  }

  function handleDetailClose() {
    setSelectedItem(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const timeFormat = settings?.time_format ?? '24h'

  function formatDeadline(item: Schedule): string {
    if (!item.start_at) return ''
    const d = new Date(item.start_at)
    if (isNaN(d.getTime())) return ''
    if (item.is_todo) {
      const precision = item.deadline_precision
      if (precision === 'none') return ''
      if (precision === 'year')  return d.toLocaleDateString('ko-KR', { year: 'numeric' })
      if (precision === 'month') return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })
      if (precision === 'day')   return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' })
    }
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' })
  }

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        onKeyDown={handleKeyDown}
      >
        <div className="w-full max-w-2xl mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[70vh]">
          {/* 검색 입력 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
            <span className="text-gray-400 text-lg">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="제목 또는 메모로 검색…"
              className="flex-1 bg-transparent text-white text-base placeholder-gray-500 outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-gray-500 hover:text-gray-300 text-sm px-1"
              >
                ✕
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 text-xs border border-gray-600 rounded px-2 py-0.5"
            >
              ESC
            </button>
          </div>

          {/* 결과 목록 */}
          <div className="overflow-y-auto flex-1">
            {query.trim() === '' && (
              <div className="px-4 py-10 text-center text-gray-500 text-sm">
                검색어를 입력하세요
              </div>
            )}

            {query.trim() !== '' && results.length === 0 && (
              <div className="px-4 py-10 text-center text-gray-500 text-sm">
                "{query}"에 대한 결과가 없습니다
              </div>
            )}

            {results.length > 0 && (
              <ul>
                {results.map(item => {
                  const cat    = categories.find(c => c.id === item.category_id)
                  const subCat = categories.find(c => c.id === item.sub_category_id)
                  const color  = subCat?.color ?? cat?.color ?? '#6B7280'
                  const catLabel = getCategoryLabel(item, categories)
                  const deadline = formatDeadline(item)
                  const isExpired = item.expire_type === 'expire'
                    && !!item.start_at
                    && new Date(item.start_at) < new Date()
                    && !item.is_completed

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleItemClick(item)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800/60 flex items-start gap-3"
                      >
                        {/* 좌측 색상 인디케이터 */}
                        <div
                          className="w-1 rounded-full mt-1 flex-shrink-0 self-stretch min-h-4"
                          style={{ backgroundColor: color }}
                        />

                        <div className="flex-1 min-w-0">
                          {/* 제목 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-medium ${item.is_completed ? 'line-through text-gray-500' : 'text-white'}`}
                              dangerouslySetInnerHTML={{ __html: highlight(item.title, query) }}
                            />
                            {item.is_todo && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">Todo</span>
                            )}
                            {item.repeat_type && item.repeat_type !== 'none' && !item.parent_id && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">반복</span>
                            )}
                            {isExpired && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-300">만료</span>
                            )}
                          </div>

                          {/* 메모 미리보기 */}
                          {item.description && (
                            <div
                              className="text-xs text-gray-400 mt-0.5 truncate"
                              dangerouslySetInnerHTML={{ __html: highlight(item.description, query) }}
                            />
                          )}

                          {/* 메타 정보 */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {catLabel && (
                              <span className="text-xs text-gray-500">{catLabel}</span>
                            )}
                            {deadline && (
                              <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-gray-500'}`}>
                                {deadline}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-gray-600 text-xs flex-shrink-0 mt-1">›</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {results.length === 50 && (
              <div className="px-4 py-2 text-center text-gray-600 text-xs border-t border-gray-800">
                상위 50개 결과만 표시됩니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 모달 */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          categories={categories}
          onClose={handleDetailClose}
          onUpdate={handleDetailClose}
          onDelete={handleDetailClose}
        />
      )}
    </>
  )
}
