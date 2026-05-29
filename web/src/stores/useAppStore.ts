import { create } from 'zustand'
import type { Schedule, Category, Settings } from '../types'
import type { ConflictRecord } from '../lib/conflictStore'

interface AppStore {
  schedules  : Schedule[]
  categories : Category[]
  settings   : Settings | null
  isOnline   : boolean
  isLoading  : boolean
  conflicts  : ConflictRecord[]   // 미해결 충돌 목록

  setSchedules  : (schedules: Schedule[]) => void
  setCategories : (categories: Category[]) => void
  setSettings   : (settings: Settings) => void
  setIsOnline   : (isOnline: boolean) => void
  setIsLoading  : (isLoading: boolean) => void
  setConflicts  : (conflicts: ConflictRecord[]) => void
  addConflict   : (conflict: ConflictRecord) => void
  removeConflict: (id: number) => void
}

const useAppStore = create<AppStore>((set) => ({
  schedules  : [],
  categories : [],
  settings   : null,
  isOnline   : true,
  isLoading  : false,
  conflicts  : [],

  setSchedules  : (schedules)   => set({ schedules }),
  setCategories : (categories)  => set({ categories }),
  setSettings   : (settings)    => set({ settings }),
  setIsOnline   : (isOnline)    => set({ isOnline }),
  setIsLoading  : (isLoading)   => set({ isLoading }),
  setConflicts  : (conflicts)   => set({ conflicts }),
  addConflict   : (conflict)    => set((s) => ({ conflicts: [...s.conflicts, conflict] })),
  removeConflict: (id)          => set((s) => ({ conflicts: s.conflicts.filter((c) => c.id !== id) })),
}))

export default useAppStore
