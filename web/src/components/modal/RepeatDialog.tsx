/**
 * RepeatDialog — 반복 일정 수정/삭제 범위 선택 다이얼로그
 * (이 일정만 / 이후 일정 전체 / 모든 일정)
 */

interface Props {
  /** 'edit': 수정 범위 선택 / 'delete': 삭제 범위 선택 */
  mode: 'edit' | 'delete'
  onClose: () => void
  onSelect: (choice: 'this' | 'this_and_after' | 'all') => void
}

const CHOICES = [
  {
    value: 'this'           as const,
    label: '이 일정만',
    desc:  '선택한 일정 하나에만 적용합니다.',
  },
  {
    value: 'this_and_after' as const,
    label: '이후 일정 전체',
    desc:  '이 일정과 이후 반복 일정 모두에 적용합니다.',
  },
  {
    value: 'all'            as const,
    label: '모든 일정',
    desc:  '반복 그룹의 모든 일정에 적용합니다.',
  },
]

export default function RepeatDialog({ mode, onClose, onSelect }: Props) {
  const actionLabel = mode === 'edit' ? '수정' : '삭제'
  const dangerChoices = mode === 'delete' ? ['this_and_after', 'all'] : []

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-800">
          <h3 className="font-semibold text-base">반복 일정 {actionLabel}</h3>
          <p className="text-xs text-gray-400 mt-1">
            어느 범위를 {actionLabel}할까요?
          </p>
        </div>

        {/* 선택지 */}
        <div className="px-5 py-4 flex flex-col gap-2">
          {CHOICES.map(c => {
            const isDanger = dangerChoices.includes(c.value)
            return (
              <button
                key={c.value}
                onClick={() => onSelect(c.value)}
                className={`w-full py-3 px-4 rounded-xl text-left transition-colors
                  ${isDanger
                    ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20'
                    : 'bg-gray-800 hover:bg-gray-700'
                  }`}
              >
                <div className={`text-sm font-medium ${isDanger ? 'text-red-400' : 'text-white'}`}>
                  {c.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
              </button>
            )
          })}
        </div>

        {/* 취소 */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
