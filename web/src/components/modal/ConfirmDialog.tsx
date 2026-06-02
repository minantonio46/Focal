/**
 * ConfirmDialog — 확인/취소 다이얼로그
 * - title 필수, message 선택
 * - onConfirm이 undefined이면 확인 버튼 대신 안내 메시지만 표시
 * - confirmVariant: 'danger'(기본 빨강) | 'default'(파랑)
 */

interface Props {
  title?:          string
  message:         string
  confirmLabel?:   string
  confirmVariant?: 'danger' | 'default'
  onConfirm?:      (() => void) | (() => Promise<void>)
  onCancel?:       () => void
  /** @deprecated onClose 대신 onCancel 사용 */
  onClose?:        () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '삭제',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  onClose,
}: Props) {
  const handleClose = onCancel ?? onClose ?? (() => {})

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 rounded-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-800">
          {title && <h3 className="font-semibold text-base mb-1">{title}</h3>}
          <p className="text-sm text-gray-300 whitespace-pre-line">{message}</p>
        </div>

        {/* 확인 버튼 (onConfirm이 있을 때만) */}
        {onConfirm && (
          <div className="px-5 py-4 flex flex-col gap-2">
            <button
              onClick={() => { onConfirm() }}
              className={`w-full py-3 px-4 rounded-xl text-left transition-colors ${
                confirmVariant === 'danger'
                  ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20'
                  : 'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20'
              }`}
            >
              <div className={`text-sm font-medium ${confirmVariant === 'danger' ? 'text-red-400' : 'text-blue-400'}`}>
                {confirmLabel}
              </div>
              {confirmVariant === 'danger' && (
                <div className="text-xs text-gray-500 mt-0.5">이 작업은 되돌릴 수 없습니다.</div>
              )}
            </button>
          </div>
        )}

        {/* 취소 */}
        <div className={`px-5 pb-5 ${!onConfirm ? 'pt-4' : ''}`}>
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors"
          >
            {onConfirm ? '취소' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
