export interface Category {
  id: string
  parent_id: string        // 빈 문자열이면 대카테고리
  name: string
  color: string
  default_importance: number
  order: number
  created: string
  updated: string
}

export interface Schedule {
  id: string
  title: string
  description: string
  location: string
  start_at: string         // Todo는 마감기한. 없으면 ""
  end_at: string           // 일정 전용. 없으면 ""
  is_all_day: boolean
  is_todo: boolean
  is_completed: boolean
  completed_at: string     // 완료 시각. 미완료이면 ""
  importance: number
  category_id: string      // 없으면 ""
  sub_category_id: string  // 없으면 ""
  deadline_precision: 'none' | 'year' | 'month' | 'day' | 'datetime'
  expire_type: 'expire' | 'keep'
  available_from: string   // Todo 전용: 이 날짜부터 시작 가능. 없으면 ""
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeat_days: number[]
  repeat_end_at: string    // 없으면 ""
  repeat_count: number
  parent_id: string        // 반복 원본 참조. 없으면 ""
  exception_date: string   // 예외 레코드의 원본 발생일 YYYY-MM-DD. 없으면 ""
  excluded_dates: string[]   // 부모 레코드의 삭제된 발생일 목록 (YYYY-MM-DD[])
  completed_dates: string[]  // 반복 Todo 회차별 완료일 목록 (YYYY-MM-DD[])
  reminder_mins: number[]
  created: string
  updated: string

  // ── 런타임 전용 (DB 저장 안 됨) ──
  _isVirtual?: true        // expandSchedulesForRange가 생성한 가상 인스턴스
  _occurrenceDate?: string // 이 가상 인스턴스의 발생일 YYYY-MM-DD
}

export interface Notification {
  id: string
  schedule_id: string
  fire_at: string
  status: 'pending' | 'sent' | 'snoozed' | 'dismissed'
  snoozed_until: string    // 없으면 ""
  created: string
}

export interface Settings {
  id: string
  theme: 'light' | 'dark' | 'system'
  time_format: '12h' | '24h'
  default_reminder: number[]
  snooze_minutes: number
  todo_delete_days: number
  schedule_delete_days: number
  calendar_slot_mins: number
  /**
   * 하루 전 알림 시각 (HH:MM)
   * 종일 일정 + timed_reminder_mode='fixed_time'일 때 공통 사용. 기본: "09:00"
   */
  all_day_reminder_time: string
  /**
   * 시간 있는 일정의 하루 전 알림 방식
   * 'exact'      : 시작 시각 24시간 전 (기본)
   * 'fixed_time' : 전날 all_day_reminder_time 시각
   */
  timed_reminder_mode: 'exact' | 'fixed_time'
  /**
   * 긴급도 시간 구간 커스터마이징 (분 단위)
   * 각 키는 해당 점수의 시간 경계 (= 이 시간 이내면 해당 점수)
   * 기본값: { s9:60, s8:1440, s7:10080, s6:21600, s5:43200, s4:129600, s3:262080, s2:525960 }
   */
  urgency_thresholds?: {
    s9?: number | null
    s8?: number | null
    s7?: number | null
    s6?: number | null
    s5?: number | null
    s4?: number | null
    s3?: number | null
    s2?: number | null
  }
  /**
   * Phase 10에서 추가 예정: 국가/타임존 설정 (IANA timezone string)
   */
  timezone?: string
}
