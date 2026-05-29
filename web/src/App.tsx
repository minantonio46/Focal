import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import TodoPage from './pages/TodoPage'
import CalendarPage from './pages/CalendarPage'
import PriorityPage from './pages/PriorityPage'
import CategoryPage from './pages/CategoryPage'
import SettingsPage from './pages/SettingsPage'
import { initAuth } from './lib/pocketbase'
import { fetchCategories, fetchSettings, fetchSchedules, runAutoDelete } from './lib/api'
import {
  startNotificationPoller,
  stopNotificationPoller,
  requestNotificationPermission,
} from './lib/notificationService'
import useAppStore from './stores/useAppStore'

export default function App() {
  const { setCategories, setSettings, setSchedules, schedules, settings } = useAppStore()

  useEffect(() => {
    async function init() {
      await initAuth()
      const [cats, fetchedSettings, fetchedSchedules] = await Promise.all([
        fetchCategories(),
        fetchSettings(),
        fetchSchedules(),
      ])
      setCategories(cats)
      setSchedules(fetchedSchedules)
      if (fetchedSettings) setSettings(fetchedSettings)

      runAutoDelete(
        fetchedSettings?.todo_delete_days     ?? 30,
        fetchedSettings?.schedule_delete_days ?? 180,
      ).catch(console.error)

      // 알림 권한 요청 (웹 환경)
      requestNotificationPermission().catch(console.error)
    }
    init().catch(console.error)
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
