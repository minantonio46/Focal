import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import OfflineBanner from './OfflineBanner'
import ConflictModal from '../modal/ConflictModal'

export default function Layout() {
  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="ml-56 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ConflictModal />
    </div>
  )
}
