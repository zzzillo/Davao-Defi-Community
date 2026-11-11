import { describe, expect, it } from 'vitest'
import { activityActor, activitySentence } from './activityLog'
import type { ActivityLogResponse } from '../types/activityLog'

function entry(overrides: Partial<ActivityLogResponse>): ActivityLogResponse {
  return {
    id: 'log-1',
    action: 'promoted',
    resource: 'user',
    resource_id: 'user-1',
    details: null,
    created_at: '2026-11-10T00:00:00Z',
    user: null,
    ...overrides,
  }
}

describe('activity actor and sentence', () => {
  it('names an explicit bootstrap system actor without implying the account was deleted', () => {
    const record = entry({ details: { from: 'none', to: 'superadmin', source: 'bootstrap_superadmin.py' } })
    expect(activityActor(record)).toBe('System setup')
    expect(activitySentence(record)).toMatchObject({
      verb: 'promoted',
      subject: 'the initial account',
      suffix: 'to Superadmin',
    })
  })

  it('uses a stored actor name and never surfaces email fields from details', () => {
    const record = entry({
      user: { id: 'actor-1', display_name: 'Alex' },
      details: { display_name: 'Target', email: 'private@example.org', to: 'official' },
    })
    expect(activityActor(record)).toBe('Alex')
    expect(activitySentence(record).subject).toBe('Target')
    expect(JSON.stringify(activitySentence(record))).not.toContain('private@example.org')
  })
})
