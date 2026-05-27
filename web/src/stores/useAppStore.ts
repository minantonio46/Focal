import { create } from 'zustand'
import type { Schedule, Category, Settings } from '../types'

interface AppStore {
  schedules: Schedule[]
  categories: Category[]
  settings: Settings | null
  isOnline: boolean
  isLoading: boolean

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
