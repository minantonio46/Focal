import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'

const navItems = [
  { to: '/calendar', icon: '📅', label: '캘린더' },
  { to: '/todo', icon: '☑️', label: '목록' },
  { to: '/priority', icon: '🎯', label: '우선순위' },
  { to: '/category', icon: '🏷️', label: '카테고리' },
  { to: '/settings', icon: '⚙️', label: '설정' },
]

export default function Sidebar() {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/api/health`)
        setIsOnline(res.ok)
      } catch {
        setIsOnline(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="w-56 h-screen bg-gray-900 text-white flex flex-col fixed left-0 top-0">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Focal</h1>
      </div>

      <div className="px-4 py-3 border-b border-gray-700">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
          <span>🔍</span>
          <span>검색</span>
        </button>
      </div>

      <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{isOnline ? '서버 연결됨' : '서버 연결 안됨'}</span>
        </div>
      </div>
    </aside>
  )
}
