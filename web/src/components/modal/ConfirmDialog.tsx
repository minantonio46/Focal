/**
 * ConfirmDialog — 단순 확인/취소 다이얼로그
 * RepeatDialog와 동일한 스타일로 비반복 일정/Todo 삭제 확인에 사용
 */

interface Props {
  title:         string
  message?:      string
  confirmLabel?: string
  onConfirm:    () => void
  onClose:      () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '삭제',
  onConfirm,
  onClose,
}: Props) {
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
          <h3 className="font-semibold text-base">{title}</h3>
          {message && (
            <p className="text-xs text-gray-400 mt-1">{message}</p>
          )}
        </div>

        {/* 버튼 */}
        <div className="px-5 py-4 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full py-3 px-4 rounded-xl text-left transition-colors
              bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
          >
            <div className="text-sm font-medium text-red-400">{confirmLabel}</div>
            <div className="text-xs text-gray-500 mt-0.5">이 작업은 되돌릴 수 없습니다.</div>
          </button>
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
