/**
 * 시간 표시 유틸
 * settings.time_format ('12h' | '24h') 에 따라 시각 문자열을 포맷
 */

export function formatTime(dateStr: string, timeFormat: '12h' | '24h'): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  if (timeFormat === '12h') {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatDateTime(dateStr: string, timeFormat: '12h' | '24h'): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  const datePart = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  const timePart = formatTime(dateStr, timeFormat)
  return `${datePart} ${timePart}`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
