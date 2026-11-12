import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Icon from './Icon'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { ToastProvider } from './Toast'

export default function Layout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const toggleSidebar = () => setSidebarExpanded((expanded) => !expanded)

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col bg-surface lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <aside
          className={`relative hidden h-full min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:block ${sidebarExpanded ? 'w-64' : 'w-16'}`}
        >
          <button
            type="button"
            aria-label="Toggle sidebar"
            aria-expanded={sidebarExpanded}
            onClick={toggleSidebar}
            className="absolute left-4 top-2 z-30 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
          >
            <Icon name="menu" className="text-[22px]" />
          </button>
          <Sidebar collapsed={!sidebarExpanded} />
        </aside>
        <div className="relative flex min-w-0 flex-1 flex-col lg:min-h-0">
          <Topbar />
          <main className="min-w-0 flex-1 px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:pb-16 lg:pt-20">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
