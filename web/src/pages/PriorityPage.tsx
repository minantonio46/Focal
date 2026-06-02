import { useState } from 'react'
import useAppStore from '../stores/useAppStore'
import DetailModal from '../components/modal/DetailModal'
import type { Schedule } from '../types'
import { urgencyScore, urgencyX, priorityScore, quadrantLabel, VALID_REPEAT_TYPES, DEFAULT_THRESHOLDS, urgencyLabel } from '../lib/priorityUtils'
import type { UrgencyThresholds } from '../lib/priorityUtils'
import { isRepeatEnded } from '../lib/repeatUtils'

type TabType = 'matrix' | 'list'
type FilterType = 'all' | 'todo' | 'schedule'

function getCategoryColor(item: Schedule, categories: import('../types').Category[]): string {
  const catId = item.sub_category_id || item.category_id
  const cat = categories.find(c => c.id === catId)
  return cat?.color ?? '#6b7280'
}

interface MatrixProps {
  items: Schedule[]
  categories: import('../types').Category[]
  thresholds: UrgencyThresholds
  onSelect: (item: Schedule) => void
}

function EisenhowerMatrix({ items, categories, thresholds, onSelect }: MatrixProps) {
  const CHART_W = 560
  const CHART_H = 460
  const PAD_L = 36
  const PAD_B = 28
  const INNER_W = CHART_W - PAD_L
  const INNER_H = CHART_H - PAD_B
  const PLOT_PAD = 24
  const PLOT_W = INNER_W - PLOT_PAD * 2
  const PLOT_H = INNER_H - PLOT_PAD * 2
  const S = 7

  type ActiveGroup = { items: Schedule[]; cx: number; cy: number; pinned: boolean }
  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(null)

  function toPixel(ux: number, imp: number): { cx: number; cy: number } {
    return {
      cx: PAD_L + PLOT_PAD + ((10 - ux) / 9) * PLOT_W,
      cy: PLOT_PAD + ((10 - imp) / 9) * PLOT_H,
    }
  }

  // 근접 클러스터링 (0.3점 반경)
  const CLUSTER_RADIUS = 0.3
  const groups = (() => {
    const clusters: { items: Schedule[]; cx: number; cy: number }[] = []
    for (const item of items) {
      const ux  = urgencyX(item, thresholds)
      const imp = item.importance
      const { cx, cy } = toPixel(ux, imp)
      const existing = clusters.find(c => {
        const dx = Math.abs(urgencyX(c.items[0], thresholds) - ux)
        const dy = Math.abs(c.items[0].importance - imp)
        return dx <= CLUSTER_RADIUS && dy <= CLUSTER_RADIUS
      })
      if (existing) {
        existing.items.push(item)
        const avgUx  = existing.items.reduce((s, i) => s + urgencyX(i, thresholds), 0) / existing.items.length
        const avgImp = existing.items.reduce((s, i) => s + i.importance, 0) / existing.items.length
        const avg = toPixel(avgUx, avgImp)
        existing.cx = avg.cx
        existing.cy = avg.cy
      } else {
        clusters.push({ items: [item], cx, cy })
      }
    }
    return clusters
  })()

  const midX = PAD_L + INNER_W / 2
  const midY = INNER_H / 2

  function groupSymbolType(grpItems: Schedule[]): 'todo' | 'schedule' | 'mixed' {
    const hasTodo  = grpItems.some(i => i.is_todo)
    const hasSched = grpItems.some(i => !i.is_todo)
    if (hasTodo && hasSched) return 'mixed'
    return hasTodo ? 'todo' : 'schedule'
  }

  function groupColor(grpItems: Schedule[]): string {
    const top = grpItems.reduce((a, b) => priorityScore(a, thresholds) >= priorityScore(b, thresholds) ? a : b)
    return getCategoryColor(top, categories)
  }

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        height="100%"
        style={{ fontFamily: 'inherit', display: 'block' }}
        onMouseLeave={() => { if (activeGroup && !activeGroup.pinned) setActiveGroup(null) }}
        onClick={() => setActiveGroup(null)}
      >
        {/* 사분면 배경 */}
        <rect x={PAD_L} y={0}    width={INNER_W / 2} height={INNER_H / 2} fill="rgba(239,68,68,0.10)" />
        <rect x={midX}  y={0}    width={INNER_W / 2} height={INNER_H / 2} fill="rgba(59,130,246,0.10)" />
        <rect x={PAD_L} y={midY} width={INNER_W / 2} height={INNER_H / 2} fill="rgba(234,179,8,0.08)" />
        <rect x={midX}  y={midY} width={INNER_W / 2} height={INNER_H / 2} fill="rgba(107,114,128,0.07)" />

        {/* 사분면 레이블 */}
        {[
          { label: '즉시 처리', x: PAD_L + INNER_W * 0.25, y: 18,        color: '#ef4444' },
          { label: '일정 수립', x: PAD_L + INNER_W * 0.75, y: 18,        color: '#3b82f6' },
          { label: '위임',     x: PAD_L + INNER_W * 0.25, y: midY + 18, color: '#eab308' },
          { label: '제거',     x: PAD_L + INNER_W * 0.75, y: midY + 18, color: '#9ca3af' },
        ].map(q => (
          <text key={q.label} x={q.x} y={q.y} textAnchor="middle"
            fontSize={11} fill={q.color} fontWeight="600" opacity={0.7}>
            {q.label}
          </text>
        ))}

        {/* 중심선 */}
        <line x1={midX}  y1={0}    x2={midX}    y2={INNER_H} stroke="#374151" strokeWidth={1} strokeDasharray="4 3" />
        <line x1={PAD_L} y1={midY} x2={CHART_W} y2={midY}    stroke="#374151" strokeWidth={1} strokeDasharray="4 3" />

        {/* 테두리 */}
        <rect x={PAD_L} y={0} width={INNER_W} height={INNER_H} fill="none" stroke="#4b5563" strokeWidth={1} />

        {/* Y축 레이블 */}
        <text x={10} y={INNER_H / 2} textAnchor="middle" fontSize={10} fill="#9ca3af"
          transform={`rotate(-90, 10, ${INNER_H / 2})`}>중요도</text>
        <text x={PAD_L - 4} y={PLOT_PAD + 4}           textAnchor="end" fontSize={9} fill="#6b7280">10</text>
        <text x={PAD_L - 4} y={INNER_H - PLOT_PAD + 4} textAnchor="end" fontSize={9} fill="#6b7280">1</text>

        {/* X축 레이블 */}
        <text x={PAD_L + PLOT_PAD}    y={CHART_H - 6} fontSize={9} fill="#6b7280">긴급</text>
        <text x={CHART_W - PLOT_PAD}  y={CHART_H - 6} textAnchor="end" fontSize={9} fill="#6b7280">비긴급</text>
        <text x={PAD_L + INNER_W / 2} y={CHART_H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">긴급도</text>

        {/* 데이터 포인트 */}
        {groups.map((grp, gi) => {
          const { cx, cy, items: grpItems } = grp
          const n = grpItems.length
          const color = groupColor(grpItems)
          const symType = groupSymbolType(grpItems)
          const isActive = activeGroup?.items === grpItems

          return (
            <g key={gi} style={{ cursor: 'pointer' }}
              onClick={e => {
                e.stopPropagation()
                if (n === 1) {
                  setActiveGroup(null)
                  onSelect(grpItems[0])
                } else {
                  // 클릭 시 pin 토글
                  setActiveGroup(prev =>
                    prev?.items === grpItems && prev.pinned
                      ? null
                      : { items: grpItems, cx, cy, pinned: true }
                  )
                }
              }}
              onMouseEnter={() => {
                if (!activeGroup?.pinned)
                  setActiveGroup({ items: grpItems, cx, cy, pinned: false })
              }}
              onMouseLeave={() => {
                if (!activeGroup?.pinned)
                  setActiveGroup(null)
              }}
            >
              <rect x={cx - S - 6} y={cy - S - 6} width={(S + 6) * 2} height={(S + 6) * 2} fill="transparent" />

              {symType === 'mixed' ? (
                <>
                  <clipPath id={`clip-left-${gi}`}>
                    <rect x={cx - S - 2} y={cy - S - 2} width={S + 2} height={(S + 2) * 2} />
                  </clipPath>
                  <clipPath id={`clip-right-${gi}`}>
                    <rect x={cx} y={cy - S - 2} width={S + 2} height={(S + 2) * 2} />
                  </clipPath>
                  <circle cx={cx} cy={cy} r={S} fill={color} fillOpacity={isActive ? 1 : 0.85}
                    stroke="white" strokeWidth={isActive ? 2 : 1.5} clipPath={`url(#clip-left-${gi})`} />
                  <rect x={cx - S} y={cy - S} width={S * 2} height={S * 2} rx={3} fill={color}
                    fillOpacity={isActive ? 1 : 0.85} stroke="white" strokeWidth={isActive ? 2 : 1.5}
                    clipPath={`url(#clip-right-${gi})`} />
                </>
              ) : symType === 'todo' ? (
                <circle cx={cx} cy={cy} r={S} fill={color}
                  fillOpacity={isActive ? 1 : 0.85} stroke="white" strokeWidth={isActive ? 2 : 1.5} />
              ) : (
                <rect x={cx - S} y={cy - S} width={S * 2} height={S * 2} rx={3} fill={color}
                  fillOpacity={isActive ? 1 : 0.85} stroke="white" strokeWidth={isActive ? 2 : 1.5} />
              )}

              {/* 개수 배지 */}
              {n > 1 && (
                <>
                  <circle cx={cx + S} cy={cy - S} r={6} fill="#1d4ed8" stroke="white" strokeWidth={1} />
                  <text x={cx + S} y={cy - S + 4} textAnchor="middle" fontSize={8} fontWeight="700" fill="white"
                    style={{ pointerEvents: 'none' }}>{n}</text>
                </>
              )}

              {/* 제목 (1개일 때만) */}
              {n === 1 && (
                <text x={cx} y={cy - S - 5} textAnchor="middle" fontSize={9} fill="#d1d5db"
                  style={{ pointerEvents: 'none' }}>
                  {grpItems[0].title.length > 8 ? grpItems[0].title.slice(0, 7) + '…' : grpItems[0].title}
                </text>
              )}
            </g>
          )
        })}
        {/* 통합 팝업 — foreignObject로 SVG 좌표계 내부에 렌더링 (좌표 오차 없음) */}
        {activeGroup && (() => {
          const { cx, cy, items: grpItems, pinned } = activeGroup
          const POP_W = 220
          const LINE_H = 42
          const HEADER_H = 32
          const POP_H = HEADER_H + grpItems.length * LINE_H
          const M = 10

          let px = cx + S + M
          let py = cy - POP_H / 2
          if (px + POP_W > CHART_W - 4) px = cx - S - M - POP_W
          if (py < 2) py = 2
          if (py + POP_H > INNER_H - 2) py = INNER_H - POP_H - 2

          const sorted = [...grpItems].sort((a, b) => priorityScore(b, thresholds) - priorityScore(a, thresholds))

          return (
            <foreignObject x={px} y={py} width={POP_W} height={POP_H + 20}
              style={{ overflow: 'visible' }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              onMouseEnter={() => { if (!pinned) setActiveGroup(prev => prev ? { ...prev } : null) }}
              onMouseLeave={() => { if (!pinned) setActiveGroup(null) }}
            >
              <div style={{
                background: '#111827', border: '1px solid #4b5563', borderRadius: 12,
                overflow: 'hidden', width: POP_W, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontFamily: 'inherit',
              }}>
                <div style={{ padding: '6px 12px', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{grpItems.length}개 항목</span>
                  {pinned && <button onClick={() => setActiveGroup(null)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>✕</button>}
                </div>
                {sorted.map(item => {
                  const c = getCategoryColor(item, categories)
                  return (
                    <button key={item.id} onClick={() => { setActiveGroup(null); onSelect(item) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1f2937' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{item.is_todo ? 'Todo' : '일정'} · {priorityScore(item, thresholds).toFixed(1)}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </foreignObject>
          )
        })()}
      </svg>
    </div>
  )
}

// ─── 점수 목록 컴포넌트 ──────────────────────────────────────
interface ScoreListProps {
  items: Schedule[]
  categories: import('../types').Category[]
  thresholds: UrgencyThresholds
  onSelect: (item: Schedule) => void
}

function ScoreList({ items, categories, thresholds, onSelect }: ScoreListProps) {
  const sorted = [...items].sort((a, b) => priorityScore(b, thresholds) - priorityScore(a, thresholds))

  function urgencyBadge(score: number) {
    const label = urgencyLabel(score, thresholds)
    if (score >= 9) return { label, cls: 'bg-red-900 text-red-300' }
    if (score >= 8) return { label, cls: 'bg-orange-900 text-orange-300' }
    if (score >= 7) return { label, cls: 'bg-amber-900 text-amber-300' }
    if (score >= 5) return { label, cls: 'bg-yellow-900 text-yellow-300' }
    if (score >= 3) return { label, cls: 'bg-lime-900 text-lime-300' }
    if (score >= 2) return { label, cls: 'bg-green-900 text-green-300' }
    return { label, cls: 'bg-gray-700 text-gray-400' }
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((item, idx) => {
        const urg   = urgencyScore(item, thresholds)
        const badge = urgencyBadge(urg)
        const score = priorityScore(item, thresholds)
        const color = getCategoryColor(item, categories)
        const quad  = quadrantLabel(item.importance, urg)

        const isExpiredTodo = item.is_todo && item.expire_type === 'expire'
          && !!item.start_at && new Date(item.start_at) < new Date()

        return (
          <button key={item.id} onClick={() => onSelect(item)}
            className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group ${
              isExpiredTodo
                ? 'bg-gray-800/50 border-gray-700/50 opacity-60 hover:opacity-80'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}>
            <span className="text-xs font-mono text-gray-500 w-5 shrink-0">{idx + 1}</span>
            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white truncate">{item.title}</span>
                {item.is_todo && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300 shrink-0">Todo</span>
                )}
                {isExpiredTodo && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-500 shrink-0">만료</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                <span className="text-xs text-gray-500">{quad}</span>
                {item.start_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(item.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-white">{score.toFixed(1)}</div>
              <div className="text-xs text-gray-500">중{item.importance.toFixed(1)} × 긴{urg.toFixed(1)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function PriorityPage() {
  const { schedules, categories, settings } = useAppStore()
  const [tab, setTab]       = useState<TabType>('matrix')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null)

  const th: UrgencyThresholds = settings?.urgency_thresholds ?? DEFAULT_THRESHOLDS

  const activeItems = schedules.filter(s => {
    if (s.is_todo) {
      if (s.is_completed) return false
      return true
    }
    if (VALID_REPEAT_TYPES.has(s.repeat_type)) return !s.is_completed && !isRepeatEnded(s)
    if (s.end_at)   return new Date(s.end_at).getTime() > Date.now()
    if (s.start_at) return new Date(s.start_at).getTime() > Date.now() - 1000 * 60 * 60 * 24
    return false
  })

  const filteredItems = activeItems.filter(s => {
    if (filter === 'todo')     return s.is_todo
    if (filter === 'schedule') return !s.is_todo
    return true
  })

  return (
    <div className="p-6 pb-4 h-full flex flex-col overflow-hidden">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">우선순위</h2>
        <p className="text-sm text-gray-500 mt-1">중요도 × 긴급도 기반 아이젠하워 매트릭스</p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['matrix', 'list'] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {t === 'matrix' ? '🎯 매트릭스' : '📋 점수 목록'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['all', 'todo', 'schedule'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f === 'all' ? '전체' : f === 'todo' ? 'Todo' : '일정'}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-gray-500 text-sm py-12 text-center">표시할 항목이 없습니다</div>
      ) : tab === 'matrix' ? (
        <div className="flex-1 min-h-0 flex flex-col pb-8">
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-400 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#6b7280" /></svg>Todo
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="#6b7280" /></svg>일정
            </span>
            <span>● 색상 = 카테고리</span>
            <span>● 호버 시 상세 / 클릭 시 고정</span>
          </div>
          <EisenhowerMatrix items={filteredItems} categories={categories} thresholds={th} onSelect={setSelectedItem} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ScoreList items={filteredItems} categories={categories} thresholds={th} onSelect={setSelectedItem} />
        </div>
      )}

      {selectedItem && (
        <DetailModal item={selectedItem} categories={categories}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => setSelectedItem(null)}
          onDelete={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
