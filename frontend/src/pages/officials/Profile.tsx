import { useRef, useState } from 'react'
import {
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siTelegram,
  siTiktok,
  siX,
  siYoutube,
} from 'simple-icons'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useToast } from '../../hooks/useToast'
import { currentUser } from '../../data/mock'

const linkedinPath =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z'

function BrandIcon({ path, className = '' }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`h-[18px] w-[18px] ${className}`}>
      <path d={path} />
    </svg>
  )
}

const inputClass =
  'w-full rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface transition-colors placeholder:text-muted focus:bg-surface-low focus:outline-none'

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-muted'

const socialFields = [
  { key: 'x', label: 'X / Twitter', path: siX.path, placeholder: 'https://x.com/username' },
  { key: 'facebook', label: 'Facebook', path: siFacebook.path, placeholder: 'https://facebook.com/username' },
  { key: 'instagram', label: 'Instagram', path: siInstagram.path, placeholder: 'https://instagram.com/username' },
  { key: 'linkedin', label: 'LinkedIn', path: linkedinPath, placeholder: 'https://linkedin.com/in/username' },
  { key: 'youtube', label: 'YouTube', path: siYoutube.path, placeholder: 'https://youtube.com/@channel' },
  { key: 'tiktok', label: 'TikTok', path: siTiktok.path, placeholder: 'https://tiktok.com/@username' },
  { key: 'telegram', label: 'Telegram', path: siTelegram.path, placeholder: 'https://t.me/username' },
  { key: 'discord', label: 'Discord', path: siDiscord.path, placeholder: 'https://discord.gg/invite' },
  { key: 'github', label: 'GitHub', path: siGithub.path, placeholder: 'https://github.com/username' },
  { key: 'custom', label: 'Other Link', path: '', placeholder: 'https://your-link.com' },
]

type LinkEntry = { id: number; platform: string; url: string }

type ProfileData = {
  photo: string | null
  name: string
  role: string
  bio: string
  links: LinkEntry[]
}

const initialProfile: ProfileData = {
  photo: null,
  name: currentUser.name,
  role: 'CEO',
  bio: '',
  links: [],
}

export default function Profile() {
  const showToast = useToast()
  const [initial, setInitial] = useState<ProfileData>(initialProfile)
  const [photo, setPhoto] = useState<string | null>(initialProfile.photo)
  const [name, setName] = useState(initialProfile.name)
  const [role, setRole] = useState(initialProfile.role)
  const [bio, setBio] = useState(initialProfile.bio)
  const [links, setLinks] = useState<LinkEntry[]>(initialProfile.links)
  const [focusLinkId, setFocusLinkId] = useState<number | null>(null)

  function addLinkEntry(platform: string) {
    const empty = links.find((entry) => entry.url.trim() === '')
    if (empty) {
      setLinks(links.map((entry) => (entry.id === empty.id ? { ...entry, platform } : entry)))
      setFocusLinkId(empty.id)
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(`input[data-link-id="${empty.id}"]`)?.focus()
      })
      return
    }
    const nextId = links.reduce((max, item) => Math.max(max, item.id), 0) + 1
    const entry: LinkEntry = { id: nextId, platform, url: '' }
    setLinks([entry, ...links])
    setFocusLinkId(entry.id)
  }
  const photoInputRef = useRef<HTMLInputElement>(null)
  const bioRef = useRef<HTMLTextAreaElement>(null)

  function autoGrowBio() {
    const el = bioRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`
  }

  const dirty =
    photo !== initial.photo ||
    name !== initial.name ||
    role !== initial.role ||
    bio !== initial.bio ||
    JSON.stringify(links) !== JSON.stringify(initial.links)

  function saveProfile() {
    setInitial({ photo, name, role, bio, links })
    showToast('success', 'Saved successfully')
  }

  function cancelChanges() {
    setPhoto(initial.photo)
    setName(initial.name)
    setRole(initial.role)
    setBio(initial.bio)
    setLinks(initial.links)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Profile" subtitle="Manage your personal information." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) setPhoto(URL.createObjectURL(file))
            }}
          />
          <button
            type="button"
            aria-label="Change profile photo"
            onClick={() => photoInputRef.current?.click()}
            className="group relative mx-auto h-40 w-40 overflow-hidden rounded-full bg-surface-container"
          >
            {photo ? (
              <img src={photo} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted transition-colors group-hover:text-on-surface-variant">
                <Icon name="person" className="text-[64px]" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Icon name="photo_camera" className="icon-filled text-[18px]" />
            </span>
          </button>

          <div className="flex flex-col gap-3">
            <p className={labelClass}>Social / Links</p>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {socialFields.map((field) => {
                const filled = links.some(
                  (entry) => entry.platform === field.key && entry.url.trim() !== '',
                )
                return (
                  <button
                    key={field.key}
                    type="button"
                    aria-label={field.label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addLinkEntry(field.key)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      filled
                        ? 'bg-on-surface text-surface-lowest'
                        : 'bg-surface-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    {field.key === 'custom' ? (
                      <Icon name="link" className="text-[20px]" />
                    ) : (
                      <BrandIcon path={field.path} />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-1">
              {links.map((entry) => {
                const field = socialFields.find((item) => item.key === entry.platform)
                return (
                  <div
                    key={entry.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-low"
                  >
                    <span className="flex w-[18px] shrink-0 justify-center text-on-surface-variant">
                      {entry.platform === 'custom' ? (
                        <Icon name="link" className="text-[18px] leading-none" />
                      ) : (
                        <BrandIcon path={field?.path ?? ''} className="h-4 w-4" />
                      )}
                    </span>
                    <input
                      autoFocus={focusLinkId === entry.id}
                      data-link-id={entry.id}
                      type="url"
                      value={entry.url}
                      onChange={(event) =>
                        setLinks((current) =>
                          current.map((item) =>
                            item.id === entry.id ? { ...item, url: event.target.value } : item,
                          ),
                        )
                      }
                      onFocus={() => setFocusLinkId(entry.id)}
                      onBlur={() => {
                        if (entry.url.trim() === '') {
                          setLinks((current) => current.filter((item) => item.id !== entry.id))
                        }
                      }}
                      placeholder={field?.placeholder}
                      className="min-w-0 flex-1 bg-transparent text-sm text-on-surface placeholder:text-muted focus:outline-none"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Full Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Role / Position</span>
            <input
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. CEO"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Bio / Description</span>
            <textarea
              ref={bioRef}
              value={bio}
              onChange={(event) => {
                setBio(event.target.value)
                requestAnimationFrame(autoGrowBio)
              }}
              placeholder="Tell the community about yourself..."
              rows={6}
              className={`${inputClass} min-h-36 resize-none overflow-y-auto`}
            />
          </label>

          {dirty && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelChanges}
                className="flex h-9 items-center rounded-lg border border-outline bg-surface-lowest px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                className="flex h-9 items-center gap-2 rounded-lg bg-btn px-5 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
              >
                <Icon name="save" className="text-[18px]" />
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
