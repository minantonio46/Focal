import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import TodoPage from './pages/TodoPage'
import CalendarPage from './pages/CalendarPage'
import PriorityPage from './pages/PriorityPage'
import CategoryPage from './pages/CategoryPage'
import SettingsPage from './pages/SettingsPage'
import { initAuth } from './lib/pocketbase'
import { fetchCategories, fetchSettings, runAutoDelete } from './lib/api'
import useAppStore from './stores/useAppStore'

export default function App() {
  const { setCategories, setSettings } = useAppStore()

  useEffect(() => {
    async function init() {
      await initAuth()
      const [cats, settings] = await Promise.all([fetchCategories(), fetchSettings()])
      setCategories(cats)
      if (settings) setSettings(settings)

      // settings 여부와 무관하게 자동 삭제 실행 (없으면 기본값 사용)
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
