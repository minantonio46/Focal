import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import OfflineBanner from './OfflineBanner'
import ConflictModal from '../modal/ConflictModal'
import ElectronTitleBar from './ElectronTitleBar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const sidebarW = collapsed ? 56 : 224

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <ElectronTitleBar />
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
        <main
          className="flex-1 overflow-hidden h-full transition-all duration-200"
          style={{ marginLeft: sidebarW }}
        >
          <Outlet />
        </main>
      </div>
      <ConflictModal />
    </div>
  )
}
