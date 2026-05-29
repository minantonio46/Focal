import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import TodoPage from './pages/TodoPage'
import CalendarPage from './pages/CalendarPage'
import PriorityPage from './pages/PriorityPage'
import CategoryPage from './pages/CategoryPage'
import SettingsPage from './pages/SettingsPage'
import { initAuth } from './lib/pocketbase'
import {
  startNotificationPoller,
  stopNotificationPoller,
  requestNotificationPermission,
} from './lib/notificationService'
import { initOfflineManager, destroyOfflineManager } from './lib/offlineManager'
import { cacheGetSchedules, cacheGetCategories, cacheGetSettings } from './lib/offlineCache'
import useAppStore from './stores/useAppStore'

export default function App() {
  const { setCategories, setSettings, setSchedules, schedules, settings } = useAppStore()

  useEffect(() => {
    async function init() {
      await initAuth()

      // 캐시에서 먼저 로드 (오프라인이어도 즉시 표시, 서버 fetch 전에 화면 채움)
      const [cachedSchedules, cachedCategories, cachedSettings] = await Promise.all([
        cacheGetSchedules(),
        cacheGetCategories(),
        cacheGetSettings(),
      ])
      if (cachedSchedules.length) setSchedules(cachedSchedules)
      if (cachedCategories.length) setCategories(cachedCategories)
      if (cachedSettings) setSettings(cachedSettings)

      // 서버 fetch + 캐시 갱신은 initOfflineManager → handleOnline 이 담당
      // (온라인이면 즉시 실행, 오프라인 복귀 시에도 동일 경로)
      // runAutoDelete 도 offlineManager 동기화 완료 후 실행됨 (offlineManager.ts 참고)

      // 알림 권한 요청 (웹 환경)
      requestNotificationPermission().catch(console.error)
    }
    init().catch(console.error)

    // 오프라인 매니저 초기화 — 온라인이면 여기서 서버 fetch + 캐시 갱신 수행
    void initOfflineManager()
    return () => destroyOfflineManager()
  }, [])

  // 알림 폴러: schedules / settings 변경 시 재시작
  useEffect(() => {
    if (!schedules.length) return
    const snoozeMinutes = settings?.snooze_minutes ?? 10
    const getTitle = (id: string) => schedules.find(s => s.id === id)?.title
    startNotificationPoller(getTitle, snoozeMinutes)
    return () => stopNotificationPoller()
  }, [schedules, settings?.snooze_minutes])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/todo" replace />} />
          <Route path="todo"     element={<TodoPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="priority" element={<PriorityPage />} />
          <Route path="category" element={<CategoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
