interface Props {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

/**
 * 빈 목록/상태 화면 공통 컴포넌트
 * 사용 예:
 *   <EmptyState icon="☑️" title="할 일이 없습니다" description="새 Todo를 추가해 보세요" />
 */
export default function EmptyState({ icon = '📭', title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <span className="text-5xl mb-4 select-none">{icon}</span>
      <p className="text-base font-medium text-gray-300 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
