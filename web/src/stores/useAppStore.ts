import { create } from 'zustand'
import { Schedule, Category, Settings } from '../types'

interface AppStore {
  // 데이터
  schedules: Schedule[]
  categories: Category[]
  settings: Settings | null

  // 상태
  isOnline: boolean
  isLoading: boolean

  // 액션
  setSchedules: (schedules: Schedule[]) => void
  setCategories: (categories: Category[]) => void
  setSettings: (settings: Settings) => void
  setIsOnline: (isOnline: boolean) => void
  setIsLoading: (isLoading: boolean) => void
}

const useAppStore = create<AppStore>((set) => ({
  schedules: [],
  categories: [],
  settings: null,
  isOnline: true,
  isLoading: false,

  setSchedules: (schedules) => set({ schedules }),
  setCategories: (categories) => set({ categories }),
  setSettings: (settings) => set({ settings }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setIsLoading: (isLoading) => set({ isLoading }),
}))

export default useAppStore