import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { blogs } from '../data/mock'

export default function Blogs() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'Published' | 'Drafts'>('Published')
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuId, setMenuId] = useState<number | null>(null)
  const visible = blogs.filter((blog) =>
    tab === 'Published' ? blog.status === 'Published' : blog.status !== 'Published',
  )
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Blogs"
        subtitle="Manage and publish your editorial content."
        actionLabel="Create Blog"
        onAction={() => navigate('/blogs/new')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <input
            type="search"
            placeholder="Search blog titles, authors..."
            className="w-full rounded-lg border border-outline bg-surface-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusOpen((open) => !open)}
            className="flex h-10 items-center gap-2 rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            {tab}
            <Icon name={statusOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
              {(['Published', 'Drafts'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setTab(label)
                    setStatusOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    tab === label ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {label}
                  {tab === label && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {visible.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            {tab === 'Published' ? 'No published blogs.' : 'No drafts.'}
          </p>
        )}
        {visible.map((blog) => (
          <article key={blog.id} className="group border-b border-outline py-8">
            <div className="flex items-start gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant">
                    {blog.author
                      .split(' ')
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="font-medium text-on-surface">{blog.author}</span>
                  <span className="text-on-surface-variant">·</span>
                  <span className="text-on-surface-variant">
                    {blog.status === 'Published' ? 'Published' : 'Last edited'} {blog.date}
                  </span>
                </div>
                <h2 className="mt-2.5 text-2xl font-bold leading-snug tracking-tight text-on-surface">
                  {blog.title}
                </h2>
                <p className="mt-1.5 truncate text-base text-on-surface-variant">
                  {blog.description}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <StatusBadge status={blog.status} />
                  <div
                    className={`relative transition-opacity group-hover:opacity-100 ${
                      menuId === blog.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label="Blog options"
                      onClick={() => setMenuId(menuId === blog.id ? null : blog.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                    >
                      <Icon name="more_horiz" className="text-[20px]" />
                    </button>
                    {menuId === blog.id && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                        <button
                          type="button"
                          onClick={() => setMenuId(null)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                        >
                          <Icon name="edit" className="text-[16px]" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setMenuId(null)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                        >
                          <Icon name="delete" className="text-[16px]" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex h-28 w-44 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted">
                <Icon name="image" className="text-[30px]" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
