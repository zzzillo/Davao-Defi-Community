import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import ActivityFeed from './activity/ActivityFeed'
import Icon from './Icon'
import { useActivityLogs } from '../hooks/useActivityLogs'
import { useTheme } from '../hooks/useTheme'

export default function Topbar() {
  const { dark, toggleTheme } = useTheme()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { signOut } = useClerk()

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

  const activity = useActivityLogs({ limit: 5 })

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 bg-surface px-4">
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Toggle dark mode"
        onClick={toggleTheme}
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
          {/*
            Shown only when there is something to see. A permanent red dot is
            one nobody looks at, and it used to be permanent because the list
            behind it was a hardcoded array that could never be empty.
          */}
          {activity.entries.length > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-96 rounded-xl border border-outline bg-surface-lowest shadow-float">
            <div className="border-b border-outline px-4 py-3">
              <p className="text-sm font-semibold text-on-surface">Latest Activity</p>
            </div>
            {/*
              The same component the Activity page and the dashboard panel
              use. The icon-per-module ternary that used to live here was a
              third place deciding what a Blog looks like, and it did not know
              about Posts or Users at all.
            */}
            {activity.loading ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Loading...</p>
            ) : activity.error || activity.entries.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                {activity.error ? 'Activity unavailable.' : 'Nothing yet.'}
              </p>
            ) : (
              <ActivityFeed entries={activity.entries} compact />
            )}
            <div className="border-t border-outline p-2">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false)
                  navigate('/admin/activity')
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
                navigate('/admin/profile')
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
              onClick={() => {
                setProfileOpen(false)
                signOut({ redirectUrl: '/sign-in' })
              }}
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
