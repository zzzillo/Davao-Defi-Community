import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { blogs } from '../data/mock'

export default function Blogs() {
  const navigate = useNavigate()
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
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-low"
        >
          All Categories
          <Icon name="expand_more" className="text-[18px]" />
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-low"
        >
          All Statuses
          <Icon name="expand_more" className="text-[18px]" />
        </button>
      </div>

      <div className="flex flex-col">
        {blogs.map((blog) => (
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
                  <span className="text-on-surface-variant">{blog.date}</span>
                </div>
                <h2 className="mt-2.5 text-2xl font-bold leading-snug tracking-tight text-on-surface">
                  {blog.title}
                </h2>
                <p className="mt-1.5 truncate text-base text-on-surface-variant">
                  {blog.description}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <StatusBadge status={blog.status} />
                  <button
                    type="button"
                    aria-label="Edit blog"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-low group-hover:opacity-100"
                  >
                    <Icon name="edit" className="text-[18px]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete blog"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-low group-hover:opacity-100"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
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
