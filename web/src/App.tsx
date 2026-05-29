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
import useAppStore from './stores/useAppStore'

export default function App() {
  const { setCategories, setSettings, setSchedules } = useAppStore()

  useEffect(() => {
    async function init() {
      await initAuth()
      const [cats, settings, schedules] = await Promise.all([
        fetchCategories(),
        fetchSettings(),
        fetchSchedules(),
      ])
      setCategories(cats)
      setSchedules(schedules)
      if (settings) setSettings(settings)

      runAutoDelete(
        settings?.todo_delete_days     ?? 30,
        settings?.schedule_delete_days ?? 180,
      ).catch(console.error)
    }
    init().catch(console.error)
  }, [])

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
