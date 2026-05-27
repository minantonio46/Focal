import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}