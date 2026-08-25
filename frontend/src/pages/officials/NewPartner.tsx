import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { partners } from '../../data/mock'

const inputClass =
  'w-full rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none'

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-muted'

export default function NewPartner() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editingPartner = id ? partners.find((partner) => partner.id === Number(id)) : undefined
  const [logo, setLogo] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={editingPartner ? 'Edit Partner' : 'Add Partner'}
        subtitle={
          editingPartner ? 'Update partner details.' : 'Register a new partner organization.'
        }
      />

      <Card className="mx-auto w-full max-w-2xl p-6">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            navigate('/admin/partners')
          }}
        >
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) setLogo(URL.createObjectURL(file))
            }}
          />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="group relative mx-auto flex aspect-square w-56 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-outline bg-surface-low text-muted transition-colors hover:bg-surface-container"
          >
            {logo ? (
              <>
                <img src={logo} alt="Partner logo" className="h-full w-full object-contain p-3" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon name="photo_camera" className="icon-filled text-[16px]" />
                </span>
              </>
            ) : (
              <>
                <Icon name="add_photo_alternate" className="text-[28px]" />
                <span className="text-sm font-medium">Upload partner logo</span>
              </>
            )}
          </button>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Partner Name</span>
            <input
              type="text"
              defaultValue={editingPartner?.name}
              placeholder="e.g. Nexus Technologies"
              className={inputClass}
              required
            />
          </label>

          <div className="flex justify-end gap-3 border-t border-outline pt-5">
            <button
              type="button"
              onClick={() => navigate('/admin/partners')}
              className="rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex h-9 items-center gap-2 rounded-lg bg-btn px-5 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
            >
              <Icon name="save" className="text-[18px]" />
              {editingPartner ? 'Save Changes' : 'Save Partner'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
