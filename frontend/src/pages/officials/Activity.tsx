import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useToast } from '../../components/Toast'
import { actionsLog, departmentOptions, permissionOptions, users } from '../../data/mock'
import type { UserItem } from '../../data/mock'

const tabs = ['Roles', 'Positions', 'Actions'] as const

export default function Activity() {
  const showToast = useToast()
  const [tab, setTab] = useState<(typeof tabs)[number]>('Roles')
  const [userList, setUserList] = useState<UserItem[]>(users)
  const [initialList, setInitialList] = useState<UserItem[]>(users)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [openDeptId, setOpenDeptId] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.isConnected) return
      if (!target.closest('[data-menu]')) {
        setOpenMenuId(null)
        setOpenDeptId(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function setRole(id: number, role: string) {
    setDirty(true)
    setUserList((list) => list.map((user) => (user.id === id ? { ...user, role } : user)))
  }

  function setDepartment(id: number, department: string) {
    setDirty(true)
    setUserList((list) =>
      list.map((user) => (user.id === id ? { ...user, department } : user)),
    )
  }

  function saveChanges() {
    setOpenMenuId(null)
    setOpenDeptId(null)
    setInitialList(userList)
    setDirty(false)
    showToast('success', 'Saved successfully')
  }

  function cancelChanges() {
    setOpenMenuId(null)
    setOpenDeptId(null)
    setUserList(initialList)
    setDirty(false)
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
                <th className="w-[70%] px-5 py-2.5 font-semibold">User</th>
                <th className="px-5 py-2.5 font-semibold">Access</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-on-surface">{user.name}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-start">
                    <div data-menu className="relative inline-block">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === user.id ? null : user.id)
                        }
                        className="flex w-48 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-low"
                      >
                        <span>
                          {user.permissions.length} action
                          {user.permissions.length === 1 ? '' : 's'} allowed
                        </span>
                        <Icon
                          name={openMenuId === user.id ? 'expand_less' : 'expand_more'}
                          className="text-[18px]"
                        />
                      </button>
                      {openMenuId === user.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-outline bg-surface-lowest p-2 shadow-float">
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
        </div>
      )}

      {tab === 'Positions' && (
        <div className="rounded-xl border border-outline bg-surface-lowest">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">
              Positions
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="w-[40%] px-5 py-2.5 font-semibold">User</th>
                <th className="w-[30%] px-5 py-2.5 font-semibold">Position</th>
                <th className="w-[30%] px-5 py-2.5 font-semibold">Department / Team</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-on-surface">{user.name}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-2 py-3">
                    <input
                      type="text"
                      value={user.role}
                      onChange={(event) => setRole(user.id, event.target.value)}
                      placeholder="e.g. CTO"
                      className="w-44 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-on-surface transition-colors placeholder:text-muted hover:bg-surface-low focus:bg-surface-low focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-start">
                    <div data-menu className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setOpenDeptId(openDeptId === user.id ? null : user.id)}
                        className="flex w-56 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-low"
                      >
                        <span className={user.department ? '' : 'text-muted'}>
                          {user.department || 'Select a team'}
                        </span>
                        <Icon
                          name="keyboard_arrow_down"
                          className={`text-[20px] text-muted transition-transform ${
                            openDeptId === user.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {openDeptId === user.id && (
                        <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg bg-surface-low py-1 shadow-float">
                          {departmentOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                setDepartment(user.id, option)
                                setOpenDeptId(null)
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-surface-container ${
                                user.department === option
                                  ? 'text-on-surface'
                                  : 'text-on-surface-variant'
                              }`}
                            >
                              {option}
                              {user.department === option && (
                                <Icon name="check" className="text-[16px]" />
                              )}
                            </button>
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

      {dirty && (
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={cancelChanges}
            className="flex h-9 items-center rounded-lg border border-outline bg-surface-lowest px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveChanges}
            className="flex h-9 items-center gap-2 rounded-lg bg-btn px-5 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
          >
            <Icon name="save" className="text-[18px]" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}
