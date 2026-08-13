import { useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import { partners } from '../../data/mock'
import logoLight from '../../assets/DDC Logo Horizontal Light.svg'
import logoDark from '../../assets/DDC Logo Horizontal Dark.svg'

export default function Partners() {
  const navigate = useNavigate()
  const visible = partners

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
          <Card key={partner.id} hover className="overflow-hidden">
            <div className="flex h-28 items-center justify-center border-b border-outline bg-surface-low px-8">
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
                <StatusBadge status={partner.status} />
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
    </div>
  )
}
