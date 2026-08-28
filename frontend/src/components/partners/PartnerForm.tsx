import { useState } from 'react'

import LogoUploader from './LogoUploader'
import type { PendingLogo } from './LogoUploader'
import Card from '../Card'
import Icon from '../Icon'
import type { ApiError } from '../../services/api'
import type { PartnerCreatePayload, PartnerResponse } from '../../types/partner'

type PartnerFormProps = {
  /** The partner being edited. Null or undefined when creating one. */
  partner?: PartnerResponse | null
  /** True while the parent's save is in flight. */
  saving: boolean
  /** Whatever the last save failed with, or null. */
  error: ApiError | null
  onSubmit: (payload: PartnerCreatePayload) => void
  onCancel: () => void
}

const NAME_MAX_LENGTH = 200

/**
 * The create and edit form for a partner.
 *
 * Holds form state and nothing else. Saving, loading and error handling belong
 * to the page, which owns the hooks - so this component can be rendered by the
 * "new" route and the "edit" route without knowing which it is. Same split as
 * PostForm and BlogForm.
 *
 * Two fields. This is the whole write surface of the module, and it is meant
 * to look like it: a large logo area, a name, and two buttons.
 */
export default function PartnerForm({
  partner,
  saving,
  error,
  onSubmit,
  onCancel,
}: PartnerFormProps) {
  const [name, setName] = useState('')
  const [logo, setLogo] = useState<PendingLogo | null>(null)

  // Fill the form once the partner being edited arrives.
  //
  // Done during render rather than in an effect. React documents this as the
  // way to adjust state when the thing being edited changes: it re-runs the
  // component before painting, so nothing flashes, and there is no second
  // commit the way an effect would cause.
  //
  // hydratedId also guards against a refetch overwriting half-typed edits.
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  if (partner && partner.id !== hydratedId) {
    setHydratedId(partner.id)
    setName(partner.name)
    setLogo(
      partner.logo_key
        ? {
            logo_key: partner.logo_key,
            previewUrl: partner.logo_url,
            // Already stored, so there is no File and nothing to upload.
            file: null,
          }
        : null,
    )
  }

  function handleSubmit() {
    onSubmit({
      name: name.trim(),
      ...logoField(),
    })
  }

  /**
   * What to send for logo_key, which is three different answers.
   *
   * Omitting a key and sending null mean different things to a PATCH: omit
   * leaves the stored value alone, null clears it. Getting these the wrong way
   * round silently destroys a logo, or silently keeps one somebody removed -
   * neither of which shows up as an error.
   *
   * - the logo was removed        -> send null, because that is the request
   * - the logo is already stored  -> send its key, unchanged
   * - a new file was just picked  -> OMIT, because storage never took it and
   *                                  there is no key to send. Sending null
   *                                  here would delete the logo the partner
   *                                  already had, as a side effect of trying
   *                                  to replace it.
   */
  function logoField(): { logo_key?: string | null } {
    if (logo === null) return { logo_key: null }

    if (logo.logo_key !== null) return { logo_key: logo.logo_key }

    return {}
  }

  // 409 rather than 422: the name is well formed, another partner simply has
  // it. Worth its own sentence, because the generic "some of the details are
  // invalid" would send somebody hunting for a typo that is not there.
  const nameTaken = error?.reason === 'partner_name_taken'

  return (
    <div className="flex flex-col gap-5">
      <Card className="mx-auto w-full max-w-2xl p-6">
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <LogoUploader logo={logo} onChange={setLogo} disabled={saving} />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Partner Name
            </span>
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX_LENGTH}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Nexus Technologies"
              className="w-full rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
              required
            />
            <span className="text-xs text-muted">
              Must be unique. Capitalisation does not make it different -
              &ldquo;Nexus&rdquo; and &ldquo;nexus&rdquo; are the same partner.
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
              {nameTaken ? (
                <p>
                  A partner named &ldquo;{name.trim()}&rdquo; is already listed.
                  Check the grid, or use a different name.
                </p>
              ) : (
                <p>{error.message}</p>
              )}

              {/* A 422 names the field it rejected, so say which one. */}
              {error.fields.map((field) => (
                <p key={field.field} className="mt-1 font-normal">
                  {field.field}: {field.message}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-outline pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || name.trim() === ''}
              className="flex h-9 items-center gap-2 rounded-lg bg-btn px-5 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="save" className="text-[18px]" />
              {saving ? 'Saving...' : partner ? 'Save Changes' : 'Save Partner'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
