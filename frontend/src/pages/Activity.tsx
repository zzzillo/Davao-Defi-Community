import { useState } from 'react'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { actionsLog, permissionOptions, users } from '../data/mock'
import type { UserItem } from '../data/mock'

const tabs = ['Roles', 'Actions'] as const

export default function Activity() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Roles')
  const [userList, setUserList] = useState<UserItem[]>(users)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  function setRole(id: number, role: string) {
    setDirty(true)
    setUserList((list) => list.map((user) => (user.id === id ? { ...user, role } : user)))
  }

  function saveChanges() {
    setOpenMenuId(null)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function togglePermission(id: number, option: string) {
    setDirty(true)
    setUserList((list) =>
      list.map((user) =>
        user.id === id
          ? {
              ...user,
              permissions: user.permissions.includes(option)
                ? user.permissions.filter((item) => item !== option)
                : [...user.permissions, option],
            }
          : user,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Activity" subtitle="Manage user roles and review activity." />

      <div className="flex gap-2">
        {tabs.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            className={[
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === label
                ? 'bg-surface-highest text-on-surface'
                : 'border border-outline bg-surface-lowest text-on-surface-variant hover:bg-surface-low',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'Roles' && (
        <div className="rounded-xl border border-outline bg-surface-lowest">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">Roles</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="px-5 py-2.5 font-semibold">User</th>
                <th className="py-2.5 pl-8 pr-5 font-semibold">Role</th>
                <th className="py-2.5 pl-8 pr-5 font-semibold">Access</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-on-surface">{user.name}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="text"
                      value={user.role}
                      onChange={(event) => setRole(user.id, event.target.value)}
                      placeholder="e.g. CTO"
                      className="w-44 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-on-surface transition-colors placeholder:text-muted hover:bg-surface-low focus:border-outline-strong focus:bg-surface-lowest focus:outline-none"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-start">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === user.id ? null : user.id)
                        }
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-low"
                      >
                        {user.permissions.length} action
                        {user.permissions.length === 1 ? '' : 's'} allowed
                        <Icon
                          name={openMenuId === user.id ? 'expand_less' : 'expand_more'}
                          className="text-[18px]"
                        />
                      </button>
                      {openMenuId === user.id && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-outline bg-surface-lowest p-2 shadow-float">
                          {permissionOptions.map((option) => (
                            <label
                              key={option}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-on-surface-variant hover:bg-surface-low"
                            >
                              <input
                                type="checkbox"
                                checked={user.permissions.includes(option)}
                                onChange={() => togglePermission(user.id, option)}
                                className="h-4 w-4 cursor-pointer accent-primary"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(dirty || saved) && (
            <div className="flex justify-end px-5 py-4">
              <button
                type="button"
                onClick={saveChanges}
                className="flex h-9 items-center gap-2 rounded-lg border border-outline bg-surface-lowest px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
              >
                <Icon name={saved ? 'check' : 'save'} className="text-[18px]" />
                {saved ? 'Saved' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'Actions' && (
        <div className="rounded-xl border border-outline bg-surface-lowest">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">Actions</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="px-5 py-2.5 font-semibold">User</th>
                <th className="px-5 py-2.5 font-semibold">Action</th>
                <th className="px-5 py-2.5 font-semibold">Module</th>
                <th className="px-5 py-2.5 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {actionsLog.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-5 py-3 font-medium text-on-surface">{entry.user}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{entry.action}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                      {entry.module}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant">{entry.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
