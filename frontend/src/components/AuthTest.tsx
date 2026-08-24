import { useAuth } from '@clerk/react'

// One source of truth for the host, shared with src/services/api.ts.
import { API_BASE_URL as API_URL } from '../services/api'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from '../services/eventService'
import { ApiError } from '../services/api'

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

  // Exercises src/services/api.ts and src/services/eventService.ts end to end.
  // The hooks need a render to be worth testing, which is what the pages do.
  const runEventChecks = async () => {
    const report = async (label: string, run: () => Promise<unknown>) => {
      try {
        console.log(`${label} ->`, await run())
      } catch (error) {
        if (error instanceof ApiError) {
          console.log(`${label} -> ApiError ${error.status}`, {
            message: error.message,
            reason: error.reason,
            fields: error.fields,
          })
          return
        }
        console.error(`${label} -> unexpected`, error)
      }
    }

    const token = await getToken()

    if (!token) {
      console.log('Sign in first')
      return
    }

    console.log('--- public read, no token needed ---')
    await report('listEvents()', () => listEvents())

    console.log('--- drafts with no token: expect 401 authentication_required ---')
    await report('listEvents({ include_drafts })', () =>
      listEvents({ include_drafts: true }),
    )

    console.log('--- empty title: expect 422 with a field path ---')
    await report('createEvent(empty title)', () =>
      createEvent({ title: '', start_datetime: new Date().toISOString() }, token),
    )

    console.log('--- datetime with no offset: expect 422 ---')
    await report('createEvent(naive start)', () =>
      createEvent({ title: 'Naive', start_datetime: '2026-09-01T18:00:00' }, token),
    )

    console.log('--- create for real ---')
    let created
    try {
      created = await createEvent(
        {
          title: 'Service layer smoke test',
          description: 'Created by AuthTest, deleted at the end',
          location: 'Davao City',
          start_datetime: new Date(Date.now() + 7 * 864e5).toISOString(),
          published: true,
        },
        token,
      )
      console.log('createEvent ->', created)
    } catch (error) {
      console.error('createEvent failed, stopping', error)
      return
    }

    console.log('--- patch the title only: description must survive ---')
    await report('updateEvent(title)', () =>
      updateEvent(created.id, { title: 'Service layer smoke test v2' }, token),
    )

    console.log('--- end before start: expect 422 invalid_time_range ---')
    await report('updateEvent(bad end)', () =>
      updateEvent(
        created.id,
        { end_datetime: new Date(Date.now() - 864e5).toISOString() },
        token,
      ),
    )

    console.log('--- unknown id: expect 404 ---')
    await report('getEvent(unknown)', () =>
      getEvent('00000000-0000-0000-0000-000000000009'),
    )

    console.log('--- cleanup: delete returns undefined, meaning 204 no body ---')
    await report('deleteEvent', () => deleteEvent(created.id, token))
    await report('getEvent(deleted), expect 404', () => getEvent(created.id))
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

      <button onClick={runEventChecks}>
        Run Events API Checks
      </button>
    </>
  )
}

export default AuthTest
