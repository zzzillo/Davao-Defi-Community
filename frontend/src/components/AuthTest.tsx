import { useAuth } from '@clerk/react'

const API_URL = 'http://127.0.0.1:8000'

function AuthTest() {
  const { getToken, isSignedIn } = useAuth()

  // One place that attaches the Clerk token, so each button below is a single
  // line. Step 7 promotes this into src/services/api.ts once pages need it too.
  const call = async (path: string, init?: RequestInit) => {
    if (!isSignedIn) {
      console.log('You are not signed in')
      return null
    }

    const token = await getToken()

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(
        `${init?.method ?? 'GET'} ${path} rejected (${response.status})`,
        data.detail
      )
      return null
    }

    console.log(path, data)
    return data
  }

  const patchRole = (userId: string, body: unknown) =>
    call(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })

  // Every call here is supposed to fail. Run in order, the console reads as a
  // checklist of the escalation paths that are closed.
  const runRoleTraps = async () => {
    const me = await call('/users/me')

    if (!me) return

    console.log('--- expect 403 cannot_change_own_role ---')
    await patchRole(me.id, { role: 'member', permissions: [] })

    console.log('--- expect 404 User not found ---')
    await patchRole('00000000-0000-0000-0000-000000000000', {
      role: 'member',
      permissions: [],
    })

    console.log('--- expect 422 unknown role ---')
    await patchRole(me.id, { role: 'superadmin', permissions: [] })

    console.log('--- expect 422 permissions on a role that ignores them ---')
    await patchRole(me.id, { role: 'admin', permissions: ['events.create'] })
  }

  // The happy path needs someone who is not you, since trap 1 blocks changing
  // your own role. Create a second Clerk account to have a target.
  const promoteOther = async () => {
    const me = await call('/users/me')
    const list = await call('/admin/users?limit=50')

    if (!me || !list) return

    const other = list.items.find((user: { id: string }) => user.id !== me.id)

    if (!other) {
      console.log('No other user yet - sign up a second Clerk account first')
      return
    }

    console.log('promoting', other.display_name)

    await patchRole(other.id, {
      role: 'official',
      permissions: ['events.create', 'blogs.create'],
    })
  }

  return (
    <>
      <button onClick={() => call('/auth_test')}>
        Test Backend Authentication
      </button>

      <button onClick={() => call('/users/me')}>
        Test Current User
      </button>

      <button onClick={() => call('/admin/ping')}>
        Test Admin Only
      </button>

      <button onClick={() => call('/admin/users?limit=10')}>
        List Users
      </button>

      <button onClick={runRoleTraps}>
        Run Role-Change Traps
      </button>

      <button onClick={promoteOther}>
        Promote Someone Else
      </button>
    </>
  )
}

export default AuthTest
