import { useNavigate, useParams } from 'react-router-dom'

import PageHeader from '../../components/PageHeader'
import PartnerForm from '../../components/partners/PartnerForm'
import { usePartner, usePartnerActions } from '../../hooks/usePartners'
import type { PartnerCreatePayload } from '../../types/partner'

/**
 * Create or edit a partner.
 *
 * One component for both routes, the way NewEvent, NewPost and NewBlog serve
 * /new and /edit/:id. On /admin/partners/new the hook is handed undefined and
 * stays idle; on /admin/partners/edit/:id it fetches.
 *
 * The page orchestrates and PartnerForm renders: the hooks live here, the form
 * state lives there, and neither knows how the other works.
 */
export default function NewPartner() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { partner, loading: loadingPartner, error: loadError } = usePartner(id)
  const { create, update, saving, error: saveError } = usePartnerActions()

  async function handleSubmit(payload: PartnerCreatePayload) {
    try {
      if (partner) {
        await update(partner.id, payload)
      } else {
        await create(payload)
      }

      navigate('/admin/partners')
    } catch {
      // usePartnerActions already captured it and PartnerForm shows it.
      // Staying on the page is the point, and especially so for the 409: a
      // name collision should leave the typing intact so one word can change.
    }
  }

  // Rendering the form before the partner arrives would show an empty form
  // that fills itself in a moment later, which reads as a glitch.
  if (id && loadingPartner) {
    return <p className="py-24 text-center text-sm text-muted">Loading partner...</p>
  }

  if (id && loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-on-surface">Partner not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">{loadError.message}</p>
        <button
          type="button"
          onClick={() => navigate('/admin/partners')}
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Back to Partners
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={partner ? 'Edit Partner' : 'Add Partner'}
        subtitle={
          partner
            ? 'Update this partner’s name or logo.'
            : 'Register a new partner organization.'
        }
      />

      <PartnerForm
        partner={partner}
        saving={saving}
        error={saveError}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/partners')}
      />
    </div>
  )
}
