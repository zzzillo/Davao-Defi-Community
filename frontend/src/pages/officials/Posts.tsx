import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { posts as initialPosts } from '../../data/mock'
import type { PostItem } from '../../data/mock'

export default function Posts() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'Posted' | 'Drafts'>('Posted')
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [items, setItems] = useState<PostItem[]>(initialPosts)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.isConnected) return
      if (!target.closest('[data-kebab]')) setMenuId(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])
  const visible = items.filter((post) =>
    tab === 'Posted' ? post.status === 'Posted' : post.status !== 'Posted',
  )
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Posts"
        subtitle="Share photos and updates with the community."
        actionLabel="Create Post"
        onAction={() => navigate('/posts/new')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <input
            type="search"
            placeholder="Search posts..."
            className="w-full rounded-lg border border-outline bg-surface-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusOpen((open) => !open)}
            className="flex h-10 w-36 items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <span className="flex-1 text-center">{tab}</span>
            <Icon name={statusOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
              {(['Posted', 'Drafts'] as const).map((label) => (
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
            {tab === 'Posted' ? 'No posted posts.' : 'No drafts.'}
          </p>
        )}
        {visible.map((post) => (
          <article key={post.id} className="group border-b border-outline py-8">
            <div className="flex items-start gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant">
                    {post.author
                      .split(' ')
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="font-medium text-on-surface">{post.author}</span>
                  <span className="text-on-surface-variant">·</span>
                  <span className="text-on-surface-variant">
                    {post.status === 'Posted' ? 'Posted' : 'Last edited'} {post.date}
                  </span>
                </div>
                <p className="mt-2.5 text-base leading-relaxed text-on-surface">
                  {post.description}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <StatusBadge status={post.status} />
                  <div data-kebab
                    className={`relative transition-opacity group-hover:opacity-100 ${
                      menuId === post.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label="Post options"
                      onClick={() => setMenuId(menuId === post.id ? null : post.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                    >
                      <Icon name="more_horiz" className="text-[20px]" />
                    </button>
                    {menuId === post.id && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null)
                            navigate(`/posts/edit/${post.id}`)
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
                            setDeleteId(post.id)
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
              </div>
              <div className="relative flex h-28 w-44 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted">
                <Icon name="photo_library" className="text-[30px]" />
                <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {post.imageCount}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete post?"
        message="This post will be permanently removed."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          setItems((current) => current.filter((item) => item.id !== deleteId))
          setDeleteId(null)
        }}
      />
    </div>
  )
}
