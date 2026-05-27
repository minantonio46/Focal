import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import TodoPage from './pages/TodoPage'
import CalendarPage from './pages/CalendarPage'
import PriorityPage from './pages/PriorityPage'
import CategoryPage from './pages/CategoryPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/todo" replace />} />
          <Route path="todo" element={<TodoPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="priority" element={<PriorityPage />} />
          <Route path="category" element={<CategoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
