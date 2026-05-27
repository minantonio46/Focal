export interface Category {
  id: string
  parent_id: string
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
  start_at: string
  end_at: string
  is_all_day: boolean
  is_todo: boolean
  is_completed: boolean
  completed_at: string
  importance: number
  category_id: string
  sub_category_id: string
  deadline_precision: 'none' | 'year' | 'month' | 'day' | 'datetime'
  expire_type: 'expire' | 'keep'
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeat_days: number[]
  repeat_end_at: string
  repeat_count: number
  parent_id: string
  reminder_mins: number[]
  created: string
  updated: string
}

export interface Notification {
  id: string
  schedule_id: string
  fire_at: string
  status: 'pending' | 'sent' | 'snoozed' | 'dismissed'
  snoozed_until: string
  created: string
}

export interface Settings {
  id: string
  theme: 'light' | 'dark' | 'system'
  default_reminder: number[]
  snooze_minutes: number
  todo_delete_days: number
  schedule_delete_days: number
  calendar_slot_mins: number
}