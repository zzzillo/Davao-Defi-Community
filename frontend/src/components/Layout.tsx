import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import Icon from './Icon'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { ToastProvider } from './Toast'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toggleSidebar = () => setSidebarOpen((open) => !open)

  return (
    <ToastProvider>
      <div className="hidden h-full min-[768px]:flex">
        <div className="relative flex h-full w-full">
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
            className="absolute left-4 top-2 z-30 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
          >
            <Icon name="menu" className="text-[22px]" />
          </button>
          <div
            className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out ${
              sidebarOpen ? 'w-64' : 'w-0'
            }`}
          >
            <Sidebar />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto px-6 pb-16 pt-6 lg:px-8">
              <div className="mx-auto max-w-6xl">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>

      <div className="flex min-h-dvh items-center justify-center bg-surface px-5 py-8 min-[768px]:hidden">
        <section className="w-full max-w-md rounded-2xl border border-outline bg-surface-lowest p-6 shadow-sm sm:p-8">
          <BrandLogo className="h-8 w-auto" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-on-surface">
            Switch to a larger screen
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            The admin workspace is available on tablets and larger screens. Switch to a tablet, laptop, or desktop to continue managing the site.
          </p>
        </section>
      </div>
    </ToastProvider>
  )
}
