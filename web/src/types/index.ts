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
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeat_days: number[]
  repeat_end_at: string    // 없으면 ""
  repeat_count: number
  parent_id: string        // 반복 원본 참조. 없으면 ""
  reminder_mins: number[]
  created: string
  updated: string
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
   * Phase 10에서 추가 예정: 국가/타임존 설정 (IANA timezone string)
   * 예: "Asia/Seoul", "America/New_York"
   * 없으면 브라우저 로컬 타임존 사용
   */
  timezone?: string
}
