import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { actionsLog } from '../data/mock'

export default function Topbar() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const latest = actionsLog.slice(0, 5)

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 bg-surface px-4">
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Toggle dark mode"
        onClick={() => setDark((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
      >
        <Icon name={dark ? 'light_mode' : 'dark_mode'} className="text-[22px]" />
      </button>
      <div ref={notifRef} className="relative">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotifOpen((open) => !open)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
        >
          <Icon name="notifications" className="text-[22px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-96 rounded-xl border border-outline bg-surface-lowest shadow-float">
            <div className="border-b border-outline px-4 py-3">
              <p className="text-sm font-semibold text-on-surface">Latest Activity</p>
            </div>
            <div className="flex flex-col py-1">
              {latest.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-low text-on-surface-variant">
                    <Icon
                      name={
                        entry.module === 'Events'
                          ? 'calendar_month'
                          : entry.module === 'Blogs'
                            ? 'article'
                            : 'handshake'
                      }
                      className="text-[18px]"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-on-surface">
                      <span className="font-semibold">{entry.user}</span>{' '}
                      <span className="text-on-surface-variant">{entry.action}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{entry.date}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-outline p-2">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false)
                  navigate('/activity')
                }}
                className="w-full rounded-lg py-2 text-center text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
              >
                View All Activity
              </button>
            </div>
          </div>
        )}
      </div>
      <div ref={profileRef} className="relative ml-1">
        <button
          type="button"
          aria-label="Account"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-container text-on-surface-variant transition-opacity hover:opacity-80"
        >
          <Icon name="person" className="text-[22px]" />
        </button>
        {profileOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false)
                navigate('/profile')
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="person" className="text-[18px]" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="settings" className="text-[18px]" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="logout" className="text-[18px]" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
