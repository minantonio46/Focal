import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import SearchModal from '../modal/SearchModal'

const navItems = [
  { to: '/calendar', icon: '📅', label: '캘린더' },
  { to: '/todo', icon: '☑️', label: '목록' },
  { to: '/priority', icon: '🎯', label: '우선순위' },
  { to: '/settings', icon: '⚙️', label: '설정' },
]

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [isOnline, setIsOnline]     = useState(false)
  const [showSearch, setShowSearch] = useState(false)

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <aside
        className="h-screen bg-gray-900 text-white flex flex-col fixed left-0 top-0 transition-all duration-200 z-30"
        style={{ width: collapsed ? 56 : 224 }}
      >
        {/* 헤더 */}
        <div className={`flex items-center border-b border-gray-700 ${collapsed ? 'justify-center py-5 px-2' : 'px-6 py-5 justify-between'}`}>
          {!collapsed && <h1 className="text-xl font-bold text-white">Focal</h1>}
          <button
            onClick={() => onToggle()}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800 flex-shrink-0"
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="4" width="16" height="2" rx="1" />
              <rect x="2" y="9" width="16" height="2" rx="1" />
              <rect x="2" y="14" width="16" height="2" rx="1" />
            </svg>
          </button>
        </div>

        {/* 검색 */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-700">
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors"
            >
              <span>🔍</span>
              <span className="flex-1 text-left">검색</span>
              <span className="text-xs text-gray-600 border border-gray-700 rounded px-1.5 py-0.5 font-mono">Ctrl+K</span>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="px-2 py-3 border-b border-gray-700 flex justify-center">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
              title="검색 (Ctrl+K)"
            >
              🔍
            </button>
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* 서버 상태 */}
        <div className={`border-t border-gray-700 ${collapsed ? 'py-4 flex justify-center' : 'px-6 py-4'}`}>
          {collapsed ? (
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
              title={isOnline ? '서버 연결됨' : '서버 연결 안됨'}
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isOnline ? '서버 연결됨' : '서버 연결 안됨'}</span>
            </div>
          )}
        </div>
      </aside>

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
  )
}
