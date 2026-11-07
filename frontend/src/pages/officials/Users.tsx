import { Fragment, useEffect, useRef, useState } from 'react'

import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useToast } from '../../hooks/useToast'
import { permissionOptions, positionOptions, users } from '../../data/mock'
import type { UserItem } from '../../data/mock'

const adminOnlyPermissions = ['Users', 'Activity', 'Admin']
const accessRoles = ['User', 'Admin', 'Superadmin'] as const
type AccessRole = (typeof accessRoles)[number]

function getAccessRole(permissions: string[]): AccessRole {
  if (permissions.includes('Admin')) return 'Superadmin'
  if (permissions.some((permission) => permission === 'Users' || permission === 'Activity')) {
    return 'Admin'
  }
  return 'User'
}

function parsePositions(value: string) {
  const positions = value
    .split(',')
    .map((position) => position.trim())
    .filter(Boolean)

  return [...new Set(positions)].slice(0, 2)
}

/** User management is currently backed by sample data only. */
export default function Users() {
  const showToast = useToast()
  const [userList, setUserList] = useState<UserItem[]>(users)
  const [initialList, setInitialList] = useState<UserItem[]>(users)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<UserItem | null>(null)
  const [positionsInput, setPositionsInput] = useState('')
  const [addingUserId, setAddingUserId] = useState<number | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)
  const [draggedUserId, setDraggedUserId] = useState<number | null>(null)
  const [accountTypeOpen, setAccountTypeOpen] = useState(false)
  const [accessRoleOpen, setAccessRoleOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dragImageRef = useRef<HTMLCanvasElement>(null)
  const accountTypeRef = useRef<HTMLDivElement>(null)
  const accessRoleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (accountTypeRef.current && !accountTypeRef.current.contains(event.target as Node)) {
        setAccountTypeOpen(false)
      }
      if (accessRoleRef.current && !accessRoleRef.current.contains(event.target as Node)) {
        setAccessRoleOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function moveUserOnHover(targetId: number) {
    if (draggedUserId === null || draggedUserId === targetId) return

    setUserList((list) => {
      const from = list.findIndex((user) => user.id === draggedUserId)
      const to = list.findIndex((user) => user.id === targetId)
      if (from < 0 || to < 0 || from === to) return list

      const reordered = [...list]
      const [moving] = reordered.splice(from, 1)
      reordered.splice(to, 0, moving)
      return reordered
    })
    setDirty(true)
  }

  function startEditing(user: UserItem) {
    setEditingUserId(user.id)
    setAddingUserId(null)
    setEditDraft({ ...user, positions: [...user.positions], permissions: [...user.permissions] })
    setPositionsInput(user.positions.join(', '))
  }

  function startAddingUser() {
    if (editingUserId !== null) return
    const id = Math.max(0, ...userList.map((user) => user.id)) + 1
    const newUser: UserItem = { id, name: '', email: '', positions: [], permissions: [], nonContributor: false }
    setUserList((list) => [...list, newUser])
    setEditingUserId(id)
    setAddingUserId(id)
    setEditDraft(newUser)
    setPositionsInput('')
  }

  function cancelEditing() {
    if (addingUserId !== null && editingUserId === addingUserId) {
      setUserList((list) => list.filter((user) => user.id !== addingUserId))
    }
    setEditingUserId(null)
    setAddingUserId(null)
    setEditDraft(null)
    setPositionsInput('')
  }

  function saveUserEdit() {
    if (!editDraft) return
    const updatedDraft = { ...editDraft, positions: parsePositions(positionsInput) }
    setUserList((list) => list.map((user) => (user.id === updatedDraft.id ? updatedDraft : user)))
    setDirty(true)
    setEditingUserId(null)
    setEditDraft(null)
    setAddingUserId(null)
    setPositionsInput('')
  }

  function setUserAccessRole(userId: number, role: AccessRole) {
    const rolePermissions = role === 'User'
      ? ['Blogs']
      : role === 'Admin'
        ? [...permissionOptions]
        : [...permissionOptions, 'Admin']

    setEditDraft((draft) => draft?.id === userId
      ? { ...draft, permissions: rolePermissions }
      : draft)
    setAccessRoleOpen(false)
  }

  function saveChanges() {
    setInitialList(userList)
    setDirty(false)
    showToast('success', 'Changes kept on this page only - not saved to the server')
  }

  function cancelChanges() {
    setUserList(initialList)
    setDirty(false)
    setAddingUserId(null)
    cancelEditing()
  }

  function deleteSelectedUser() {
    if (deleteUserId === null) return
    setUserList((list) => list.filter((user) => user.id !== deleteUserId))
    setDirty(true)
    if (editingUserId === deleteUserId) cancelEditing()
    if (addingUserId === deleteUserId) setAddingUserId(null)
    setDeleteUserId(null)
  }

  const selectedUser = userList.find((user) => user.id === deleteUserId)

  return (
    <div className="flex flex-col gap-5">
      <canvas
        ref={dragImageRef}
        width={1}
        height={1}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />
      <PageHeader
        title="Users"
        subtitle="Manage roles, permissions and positions."
        actionLabel="Add User"
        onAction={startAddingUser}
      />

      <div className="flex items-start gap-3 rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
        <Icon name="info" className="mt-0.5 text-[18px]" />
        <p>
          This page is not connected yet. The people and permissions shown are
          sample data, and nothing here is saved. Real role changes go through
          the API, and each one is recorded on the Activity page.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface-lowest">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-outline bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
              <th className="w-[35%] px-5 py-4 font-semibold">User</th>
              <th className="w-[24%] px-5 py-4 font-semibold">Position</th>
              <th className="w-[25%] px-5 py-4 font-semibold">Access</th>
              <th className="w-[16%] px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {userList.map((user) => {
              const isEditing = editingUserId === user.id && editDraft?.id === user.id
              const displayedUser = isEditing && editDraft
                ? { ...editDraft, positions: parsePositions(positionsInput) }
                : user

              return (
                <Fragment key={user.id}>
                  <tr
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnter={() => moveUserOnHover(user.id)}
                    className={`border-b border-outline last:border-0 hover:bg-surface-low ${
                      draggedUserId === user.id ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-on-surface">
                        {displayedUser.name || (addingUserId === user.id ? 'New user' : '')}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {displayedUser.email || (addingUserId === user.id ? 'Enter details below' : '')}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {displayedUser.positions.length ? (
                        <span className="text-sm text-on-surface-variant">
                          {displayedUser.positions.join(', ')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">No position</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className="text-sm text-on-surface-variant">
                        {getAccessRole(displayedUser.permissions)}
                      </span>
                    </td>
                    <td className="w-[16%] px-5 py-4 text-right align-top">
                      <div className="ml-auto flex w-full items-center justify-end gap-1">
                        <button
                          type="button"
                          draggable
                          aria-label={`Move ${user.name}`}
                          title="Drag to move user"
                          onDragStart={(event) => {
                            setDraggedUserId(user.id)
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', String(user.id))
                            if (dragImageRef.current) {
                              event.dataTransfer.setDragImage(dragImageRef.current, 0, 0)
                            }
                          }}
                          onDragEnd={() => setDraggedUserId(null)}
                          className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface active:cursor-grabbing"
                        >
                          <Icon name="swap_vert" className="text-[20px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${user.name}`}
                          title="Edit user"
                          onClick={() => (isEditing ? cancelEditing() : startEditing(user))}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                        >
                          <Icon name={isEditing ? 'close' : 'edit'} className="text-[19px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${user.name}`}
                          title="Delete user"
                          onClick={() => setDeleteUserId(user.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-error transition-colors hover:bg-error/10"
                        >
                          <Icon name="delete" className="text-[19px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isEditing && editDraft && (
                    <tr className="border-b border-outline bg-surface">
                      <td colSpan={4} className="px-5 py-5">
                        <div className="grid gap-5 lg:grid-cols-3">
                          <div className="flex flex-col gap-5">
                            <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                              Name
                              <input
                                type="text"
                                value={editDraft.name}
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, name: event.target.value })
                                }
                                className="h-10 rounded-lg border border-outline bg-surface-lowest px-3 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                              />
                            </label>
                            <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                              Email
                              <input
                                type="email"
                                value={editDraft.email}
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, email: event.target.value })
                                }
                                className="h-10 rounded-lg border border-outline bg-surface-lowest px-3 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                              />
                            </label>
                          </div>

                          <div className="flex flex-col gap-5">
                            <fieldset>
                              <legend className="mb-2 text-sm font-semibold text-on-surface">
                                Position
                              </legend>
                              <input
                                type="text"
                                list={`position-options-${user.id}`}
                                value={positionsInput}
                                onChange={(event) => setPositionsInput(event.target.value)}
                                placeholder="Enter position(s)"
                                className="h-10 w-full rounded-lg border border-outline bg-surface-lowest px-3 text-sm font-normal text-on-surface focus:border-primary focus:outline-none"
                              />
                              <datalist id={`position-options-${user.id}`}>
                                {positionOptions.map((position) => (
                                  <option key={position} value={position} />
                                ))}
                              </datalist>
                            </fieldset>
                            <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                              Account type
                              <div ref={accountTypeRef} className="relative">
                                <button
                                  type="button"
                                  aria-expanded={accountTypeOpen}
                                  onClick={() => setAccountTypeOpen((open) => !open)}
                                  className="flex h-10 w-full items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                                >
                                  <span className="flex-1 text-center">
                                    {editDraft.nonContributor
                                      ? 'Non-contributor account'
                                      : 'Contributor account'}
                                  </span>
                                  <Icon
                                    name={accountTypeOpen ? 'expand_less' : 'expand_more'}
                                    className="text-[18px]"
                                  />
                                </button>
                                {accountTypeOpen && (
                                  <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                                    {[
                                      { nonContributor: false, label: 'Contributor account' },
                                      { nonContributor: true, label: 'Non-contributor account' },
                                    ].map((option) => (
                                      <button
                                        key={option.label}
                                        type="button"
                                        onClick={() => {
                                          setEditDraft({
                                            ...editDraft,
                                            nonContributor: option.nonContributor,
                                          })
                                          setAccountTypeOpen(false)
                                        }}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                                          Boolean(editDraft.nonContributor) === option.nonContributor
                                            ? 'text-on-surface'
                                            : 'text-on-surface-variant'
                                        }`}
                                      >
                                        {option.label}
                                        {Boolean(editDraft.nonContributor) === option.nonContributor && (
                                          <Icon name="check" className="text-[16px]" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>

                          <div className="flex flex-col gap-5">
                            <fieldset>
                              <legend className="mb-2 text-sm font-semibold text-on-surface">
                                Access
                              </legend>
                              <div ref={accessRoleRef} className="relative">
                                <button
                                  type="button"
                                  aria-expanded={accessRoleOpen}
                                  onClick={() => setAccessRoleOpen((open) => !open)}
                                  className="flex h-10 w-full items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                                >
                                  <span className="flex-1 text-center">
                                    {getAccessRole(editDraft.permissions)}
                                  </span>
                                  <Icon
                                    name={accessRoleOpen ? 'expand_less' : 'expand_more'}
                                    className="text-[18px]"
                                  />
                                </button>
                                {accessRoleOpen && (
                                  <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                                    {accessRoles.map((role) => (
                                      <button
                                        key={role}
                                        type="button"
                                        onClick={() => setUserAccessRole(editDraft.id, role)}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                                          getAccessRole(editDraft.permissions) === role
                                            ? 'text-on-surface'
                                            : 'text-on-surface-variant'
                                        }`}
                                      >
                                        {role}
                                        {getAccessRole(editDraft.permissions) === role && (
                                          <Icon name="check" className="text-[16px]" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </fieldset>
                          </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveUserEdit}
                            className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
                          >
                            Done
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-outline bg-surface-lowest">
        <h2 className="border-b border-outline bg-surface px-5 py-4 text-sm font-semibold text-on-surface">
          Non-contributor accounts
        </h2>
        <p className="px-5 py-6 text-sm text-muted">No non-contributor accounts yet.</p>
      </section>

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

      <ConfirmDialog
        open={selectedUser !== undefined}
        title="Delete user?"
        message={
          selectedUser
            ? `Remove ${selectedUser.name} from this list? This change is not saved to the server.`
            : ''
        }
        onCancel={() => setDeleteUserId(null)}
        onConfirm={deleteSelectedUser}
      />
    </div>
  )
}
