import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import { partners as initialPartners } from '../../data/mock'
import type { PartnerItem } from '../../data/mock'
import logoLight from '../../assets/DDC Logo Horizontal Light.svg'
import logoDark from '../../assets/DDC Logo Horizontal Dark.svg'

export default function Partners() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PartnerItem[]>(initialPartners)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const visible = items

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Partners Management"
        subtitle="Manage enterprise relationships and strategic alliances."
        actionLabel="Add Partner"
        onAction={() => navigate('/partners/new')}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((partner) => (
          <Card key={partner.id} hover className="group">
            <div className="flex h-28 items-center justify-center rounded-t-xl border-b border-outline bg-surface-low px-8">
              <img
                src={logoLight}
                alt={`${partner.name} logo`}
                className="block max-h-20 w-full object-contain dark:hidden"
              />
              <img
                src={logoDark}
                alt={`${partner.name} logo`}
                className="hidden max-h-20 w-full object-contain dark:block"
              />
            </div>
            <div className="p-4">
              <h2 className="text-lg font-semibold leading-snug text-on-surface">
                {partner.name}
              </h2>
              <p className="text-sm text-on-surface-variant">{partner.type}</p>
              <div className="mt-4 flex items-center justify-between border-t border-outline pt-4">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={partner.status} />
                  <div
                    className={`relative transition-opacity group-hover:opacity-100 ${
                      menuId === partner.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`Options for ${partner.name}`}
                      onClick={() => setMenuId(menuId === partner.id ? null : partner.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                    >
                      <Icon name="more_horiz" className="text-[20px]" />
                    </button>
                    {menuId === partner.id && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null)
                            navigate(`/partners/edit/${partner.id}`)
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                        >
                          <Icon name="edit" className="text-[16px]" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null)
                            setDeleteId(partner.id)
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                        >
                          <Icon name="delete" className="text-[16px]" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-on-surface-variant">
                  {partner.detail}
                </span>
              </div>
            </div>
          </Card>
        ))}
        {visible.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted">No partners.</p>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete partner?"
        message="This partner will be permanently removed."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          setItems((current) => current.filter((item) => item.id !== deleteId))
          setDeleteId(null)
        }}
      />
    </div>
  )
}
