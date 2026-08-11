import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'

const inputClass =
  'w-full rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none'

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-muted'

export default function NewPartner() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Add Partner" subtitle="Register a new partner organization." />

      <Card className="mx-auto w-full max-w-2xl p-6">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            navigate('/partners')
          }}
        >
          <button
            type="button"
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline bg-surface-low text-muted transition-colors hover:bg-surface-container"
          >
            <Icon name="add_photo_alternate" className="text-[28px]" />
            <span className="text-sm font-medium">Upload partner logo</span>
          </button>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Partner Name</span>
            <input type="text" placeholder="e.g. Nexus Technologies" className={inputClass} required />
          </label>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Partner Type</span>
              <input type="text" placeholder="e.g. Technology Partner" className={inputClass} required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Status</span>
              <select className={inputClass} defaultValue="Pending">
                <option>Pending</option>
                <option>Active</option>
                <option>Archived</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Date Joined</span>
            <input type="date" className={inputClass} />
          </label>

          <div className="flex justify-end gap-3 border-t border-outline pt-5">
            <button
              type="button"
              onClick={() => navigate('/partners')}
              className="rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-transparent hover:bg-btn px-5 py-2 text-sm font-semibold text-on-surface transition-colors"
            >
              Save Partner
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
