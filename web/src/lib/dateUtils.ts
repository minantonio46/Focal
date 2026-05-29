/**
 * 시간 표시 유틸 + 타임존 aware 변환 유틸
 *
 * [타임존 밑작업 메모]
 * Phase 10에서 settings.timezone(IANA string)을 추가할 때:
 *   - toUTCISO / fromUTCISO 의 _timezone 파라미터를 실제로 사용하도록 교체
 *   - 현재는 브라우저 로컬 타임존(Intl.DateTimeFormat().resolvedOptions().timeZone)을 기본값으로 사용
 *   - 교체 시 Intl.DateTimeFormat을 이용한 정밀 변환으로 업그레이드 예정
 */

// ─── 표시용 포맷 ──────────────────────────────────────────

export function formatTime(dateStr: string, timeFormat: '12h' | '24h'): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  })
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

// ─── 타임존 aware 변환 (Phase 10 밑작업) ────────────────────

/**
 * 브라우저(또는 설정된) 타임존 반환
 * Phase 10: settings.timezone 이 있으면 그것을 사용
 */
export function getTimezone(settingsTimezone?: string): string {
  return settingsTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * 로컬 datetime 문자열 → UTC ISO (PocketBase 저장용)
 *
 * @param localStr  - "YYYY-MM-DDTHH:MM:SS" 형식의 로컬 시각
 * @param _timezone - (Phase 10 예약) IANA timezone string.
 *                    현재는 JS Date가 브라우저 로컬 TZ를 자동 적용하므로 무시됨.
 *                    Phase 10에서 Intl 기반 변환으로 교체 예정.
 *
 * 사용 예)
 *   toUTCISO("2026-05-28T23:59:00")          // 브라우저 TZ 기준
 *   toUTCISO("2026-05-28T23:59:00", "Asia/Seoul")  // Phase 10: 설정 TZ 기준
 */
export function toUTCISO(localStr: string, _timezone?: string): string {
  // TODO Phase 10: _timezone 이 주어지면 Intl.DateTimeFormat으로 정밀 변환
  // 현재: new Date()는 "YYYY-MM-DDTHH:MM:SS" (T구분자, 타임존 없음)를 로컬 시각으로 파싱
  return new Date(localStr).toISOString()
}

/**
 * PocketBase UTC datetime 문자열 → 로컬 date / time 분리 (폼 표시용)
 *
 * @param utcStr    - PocketBase 반환값 ("2026-05-28 05:00:00.000Z" 등)
 * @param _timezone - (Phase 10 예약)
 */
export function fromUTCISO(utcStr: string, _timezone?: string): { date: string; time: string } {
  // TODO Phase 10: _timezone 기준으로 변환
  const d = new Date(utcStr)
  return {
    date: [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-'),
    time: [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
    ].join(':'),
  }
}

/**
 * PocketBase UTC datetime → "YYYY-MM-DDTHH:MM" (datetime-local input 용)
 */
export function fromUTCISODatetime(utcStr: string, timezone?: string): string {
  const { date, time } = fromUTCISO(utcStr, timezone)
  return `${date}T${time}`
}
