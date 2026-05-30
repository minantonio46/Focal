import { useState } from 'react'
import useAppStore from '../stores/useAppStore'
import DetailModal from '../components/modal/DetailModal'
import type { Schedule } from '../types'
import { urgencyScore, urgencyX, priorityScore, quadrantLabel } from '../lib/priorityUtils'

type TabType = 'matrix' | 'list'
type FilterType = 'all' | 'todo' | 'schedule'

// 카테고리 색상 조회 헬퍼
function getCategoryColor(item: Schedule, categories: import('../types').Category[]): string {
  const catId = item.sub_category_id || item.category_id
  const cat = categories.find(c => c.id === catId)
  return cat?.color ?? '#6b7280'
}

// ─── 매트릭스 컴포넌트 ────────────────────────────────────────
interface MatrixProps {
  items: Schedule[]
  categories: import('../types').Category[]
  onSelect: (item: Schedule) => void
}

function EisenhowerMatrix({ items, categories, onSelect }: MatrixProps) {
  const CHART_W = 560
  const CHART_H = 460
  const PAD_L = 36
  const PAD_B = 28
  const INNER_W = CHART_W - PAD_L
  const INNER_H = CHART_H - PAD_B
  const PLOT_PAD = 24
  const PLOT_W = INNER_W - PLOT_PAD * 2
  const PLOT_H = INNER_H - PLOT_PAD * 2
  const S = 7  // 심볼 반크기

  const [tooltip, setTooltip] = useState<{ item: Schedule; x: number; y: number } | null>(null)
  const [groupPopup, setGroupPopup] = useState<{ items: Schedule[]; x: number; y: number } | null>(null)
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)

  // SVG viewBox 기준 좌표 → 실제 픽셀 좌표 변환
  function toScreenPos(vx: number, vy: number): { x: number; y: number } {
    if (!svgEl) return { x: vx, y: vy }
    const rect = svgEl.getBoundingClientRect()
    const scaleX = rect.width  / CHART_W
    const scaleY = rect.height / CHART_H
    return { x: vx * scaleX, y: vy * scaleY }
  }

  function toPixel(ux: number, imp: number): { cx: number; cy: number } {
    return {
      cx: PAD_L + PLOT_PAD + ((10 - ux) / 9) * PLOT_W,
      cy: PLOT_PAD + ((10 - imp) / 9) * PLOT_H,
    }
  }

  // 좌표별 그룹화 — 포인트 하나만 렌더링
  const groups = (() => {
    const map: Record<string, { items: Schedule[]; cx: number; cy: number }> = {}
    for (const item of items) {
      const key = `${urgencyX(item).toFixed(2)}_${item.importance.toFixed(2)}`
      if (!map[key]) {
        const { cx, cy } = toPixel(urgencyX(item), item.importance)
        map[key] = { items: [], cx, cy }
      }
      map[key].items.push(item)
    }
    return Object.values(map)
  })()

  const midX = PAD_L + INNER_W / 2
  const midY = INNER_H / 2

  function tooltipLines(item: Schedule): string[] {
    const lines: string[] = [item.title]
    if (item.start_at) {
      lines.push(
        new Date(item.start_at).toLocaleDateString('ko-KR', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      )
    }
    lines.push(`점수 ${priorityScore(item).toFixed(1)}  중요도 ${item.importance.toFixed(1)}`)
    return lines
  }

  // 그룹의 대표 심볼 종류 결정: todo만 있으면 원, 일정만 있으면 사각, 혼재면 원+사각 반씩 분할
  function groupSymbolType(grpItems: Schedule[]): 'todo' | 'schedule' | 'mixed' {
    const hasTodo = grpItems.some(i => i.is_todo)
    const hasSched = grpItems.some(i => !i.is_todo)
    if (hasTodo && hasSched) return 'mixed'
    return hasTodo ? 'todo' : 'schedule'
  }

  // 그룹의 대표 색상: 우선순위 점수 가장 높은 아이템
  function groupColor(grpItems: Schedule[]): string {
    const top = grpItems.reduce((a, b) => priorityScore(a) >= priorityScore(b) ? a : b)
    return getCategoryColor(top, categories)
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          ref={setSvgEl}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          width="100%"
          style={{ fontFamily: 'inherit', display: 'block' }}
          onMouseLeave={() => { setTooltip(null) }}
          onClick={() => setGroupPopup(null)}
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
            transform={`rotate(-90, 10, ${INNER_H / 2})`}>
            중요도
          </text>
          <text x={PAD_L - 4} y={PLOT_PAD + 4}           textAnchor="end" fontSize={9} fill="#6b7280">10</text>
          <text x={PAD_L - 4} y={INNER_H - PLOT_PAD + 4} textAnchor="end" fontSize={9} fill="#6b7280">1</text>

          {/* X축 레이블 */}
          <text x={PAD_L + PLOT_PAD}    y={CHART_H - 6} fontSize={9} fill="#6b7280">긴급</text>
          <text x={CHART_W - PLOT_PAD}  y={CHART_H - 6} textAnchor="end" fontSize={9} fill="#6b7280">비긴급</text>
          <text x={PAD_L + INNER_W / 2} y={CHART_H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">긴급도</text>

          {/* 데이터 포인트 (1개 단위 그룹) */}
          {groups.map((grp, gi) => {
            const { cx, cy, items: grpItems } = grp
            const n = grpItems.length
            const color = groupColor(grpItems)
            const symType = groupSymbolType(grpItems)
            const singleItem = n === 1 ? grpItems[0] : null

            return (
              <g
                key={gi}
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation()
                  setTooltip(null)
                  if (n === 1) {
                    onSelect(grpItems[0])
                  } else {
                    const screen = toScreenPos(cx, cy)
                    setGroupPopup(prev =>
                      prev && prev.items === grpItems ? null : { items: grpItems, x: screen.x, y: screen.y }
                    )
                  }
                }}
                onMouseEnter={() => singleItem && setTooltip({ item: singleItem, x: cx, y: cy })}
                onMouseLeave={e => { e.stopPropagation(); setTooltip(null) }}
              >
                {/* 클릭 영역 */}
                <rect x={cx - S - 6} y={cy - S - 6} width={(S + 6) * 2} height={(S + 6) * 2} fill="transparent" />

                {/* mixed: 원 + 사각 반씩 */}
                {symType === 'mixed' ? (
                  <>
                    <clipPath id={`clip-left-${gi}`}>
                      <rect x={cx - S - 2} y={cy - S - 2} width={S + 2} height={(S + 2) * 2} />
                    </clipPath>
                    <clipPath id={`clip-right-${gi}`}>
                      <rect x={cx} y={cy - S - 2} width={S + 2} height={(S + 2) * 2} />
                    </clipPath>
                    <circle cx={cx} cy={cy} r={S} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} clipPath={`url(#clip-left-${gi})`} />
                    <rect x={cx - S} y={cy - S} width={S * 2} height={S * 2} rx={3} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} clipPath={`url(#clip-right-${gi})`} />
                  </>
                ) : symType === 'todo' ? (
                  <circle cx={cx} cy={cy} r={S} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                ) : (
                  <rect x={cx - S} y={cy - S} width={S * 2} height={S * 2} rx={3} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                )}

                {/* 숨자 배지 (2개 이상) */}
                {n > 1 && (
                  <>
                    <circle cx={cx + S} cy={cy - S} r={6} fill="#1d4ed8" stroke="white" strokeWidth={1} />
                    <text x={cx + S} y={cy - S + 4} textAnchor="middle" fontSize={8} fontWeight="700" fill="white"
                      style={{ pointerEvents: 'none' }}>
                      {n}
                    </text>
                  </>
                )}

                {/* 제목 (1개일 때만) */}
                {singleItem && (
                  <text x={cx} y={cy - S - 5} textAnchor="middle" fontSize={9} fill="#d1d5db"
                    style={{ pointerEvents: 'none' }}>
                    {singleItem.title.length > 8 ? singleItem.title.slice(0, 7) + '…' : singleItem.title}
                  </text>
                )}
              </g>
            )
          })}

          {/* 툰팁입 */}
          {tooltip && (() => {
            const lines = tooltipLines(tooltip.item)
            const TW = 160
            const TH = lines.length * 16 + 12
            const M = 8
            let tx = tooltip.x + S + M
            let ty = tooltip.y - TH / 2
            if (tx + TW > CHART_W) tx = tooltip.x - S - M - TW
            if (ty < 0) ty = 0
            if (ty + TH > INNER_H) ty = INNER_H - TH
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx} y={ty} width={TW} height={TH} rx={6} fill="#1f2937" stroke="#4b5563" strokeWidth={1} opacity={0.97} />
                {lines.map((line, i) => (
                  <text key={i} x={tx + 8} y={ty + 14 + i * 16}
                    fontSize={i === 0 ? 10 : 9} fontWeight={i === 0 ? '600' : '400'}
                    fill={i === 0 ? '#f9fafb' : '#9ca3af'}>
                    {line}
                  </text>
                ))}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* 그룹 팔업 (SVG 밖 절대위치) */}
      {groupPopup && (() => {
        const popW = 220
        const containerW = svgEl?.getBoundingClientRect().width ?? CHART_W
        return (
          <div
            className="absolute z-20 bg-gray-900 border border-gray-600 rounded-xl shadow-xl overflow-hidden"
            style={{
              top:  groupPopup.y + 12,
              left: Math.min(Math.max(groupPopup.x - popW / 2, 0), containerW - popW),
              width: popW,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-700 text-xs text-gray-400">
              {groupPopup.items.length}개 항목
            </div>
            {groupPopup.items
              .sort((a, b) => priorityScore(b) - priorityScore(a))
              .map(item => {
                const color = getCategoryColor(item, categories)
                return (
                  <button
                    key={item.id}
                    onClick={() => { setGroupPopup(null); onSelect(item) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{item.title}</div>
                      <div className="text-xs text-gray-500">
                        {item.is_todo ? 'Todo' : '일정'} · 점수 {priorityScore(item).toFixed(1)}
                      </div>
                    </div>
                  </button>
                )
              })
            }
          </div>
        )
      })()}
    </div>
  )
}

// ─── 점수 목록 컴포넌트 ──────────────────────────────────────
interface ScoreListProps {
  items: Schedule[]
  categories: import('../types').Category[]
  onSelect: (item: Schedule) => void
}

function ScoreList({ items, categories, onSelect }: ScoreListProps) {
  const sorted = [...items].sort((a, b) => priorityScore(b) - priorityScore(a))

  function urgencyBadge(score: number) {
    if (score >= 9) return { label: '1시간 이내',  cls: 'bg-red-900 text-red-300' }
    if (score >= 8) return { label: '24시간 이내', cls: 'bg-orange-900 text-orange-300' }
    if (score >= 7) return { label: '1주 이내',    cls: 'bg-amber-900 text-amber-300' }
    if (score >= 5) return { label: '1달 이내',    cls: 'bg-yellow-900 text-yellow-300' }
    if (score >= 3) return { label: '반년 이내',   cls: 'bg-lime-900 text-lime-300' }
    if (score >= 2) return { label: '1년 이내',    cls: 'bg-green-900 text-green-300' }
    return { label: '기한 없음', cls: 'bg-gray-700 text-gray-400' }
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((item, idx) => {
        const urg   = urgencyScore(item)
        const badge = urgencyBadge(urg)
        const score = priorityScore(item)
        const color = getCategoryColor(item, categories)
        const quad  = quadrantLabel(item.importance, urg)

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 transition-colors group"
          >
            <span className="text-xs font-mono text-gray-500 w-5 shrink-0">{idx + 1}</span>
            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white truncate">{item.title}</span>
                {item.is_todo && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300 shrink-0">Todo</span>
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
              <div className="text-xs text-gray-500">중{item.importance.toFixed(1)} × 긴{urg}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function PriorityPage() {
  const { schedules, categories } = useAppStore()
  const [tab, setTab]       = useState<TabType>('matrix')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null)

  const activeItems = schedules.filter(s => {
    if (s.is_todo) return !s.is_completed
    if (s.end_at)  return new Date(s.end_at).getTime() > Date.now()
    if (s.start_at) return new Date(s.start_at).getTime() > Date.now() - 1000 * 60 * 60 * 24
    return false
  })

  const filteredItems = activeItems.filter(s => {
    if (filter === 'todo')     return s.is_todo
    if (filter === 'schedule') return !s.is_todo
    return true
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">우선순위</h2>
        <p className="text-sm text-gray-500 mt-1">중요도 × 긴급도 기반 아이젠하워 매트릭스</p>
      </div>

      {/* 탭 + 필터 한 줄 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['matrix', 'list'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'matrix' ? '🎯 매트릭스' : '📋 점수 목록'}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['all', 'todo', 'schedule'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === f ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? '전체' : f === 'todo' ? 'Todo' : '일정'}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-gray-500 text-sm py-12 text-center">표시할 항목이 없습니다</div>
      ) : tab === 'matrix' ? (
        <>
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#6b7280" /></svg>
              Todo
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="#6b7280" /></svg>
              일정
            </span>
            <span>● 색상 = 카테고리</span>
            <span>● 호버 시 상세 표시</span>
          </div>
          <EisenhowerMatrix items={filteredItems} categories={categories} onSelect={setSelectedItem} />
        </>
      ) : (
        <ScoreList items={filteredItems} categories={categories} onSelect={setSelectedItem} />
      )}

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          categories={categories}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => setSelectedItem(null)}
          onDelete={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
