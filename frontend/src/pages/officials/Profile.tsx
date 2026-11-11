import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { useAppAuth } from '../../auth/useAppAuth'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useToast, useToastError } from '../../hooks/useToast'
import { updateMyProfile } from '../../services/userService'
import { uploadImage } from '../../services/storageService'
import type { AppUser } from '../../types/user'
import type { UserProfileUpdate } from '../../types/adminUser'

const linkedinPath =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.225 0z'

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
] as const

type LinkEntry = { id: number; platform: string; url: string }
type ProfileDraft = {
  display_name: string
  alias: string
  bio: string
  contributions: string[]
  links: LinkEntry[]
}

function profileDraft(user: AppUser): ProfileDraft {
  return {
    display_name: user.display_name,
    alias: user.alias ?? '',
    bio: user.bio ?? '',
    contributions: [...user.contributions],
    links: Object.entries(user.social_links).map(([platform, url], index) => ({
      id: index + 1,
      platform,
      url,
    })),
  }
}

function socialLinksFromEntries(entries: LinkEntry[]): Record<string, string> {
  return Object.fromEntries(
    entries
      .map(({ platform, url }) => [platform, url.trim()] as const)
      .filter(([, url]) => url !== ''),
  )
}

function displayRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function Profile() {
  const { appUser, getToken, loading, error: authError, isLoaded, refreshUser } = useAppAuth()
  const showToast = useToast()
  useToastError(authError)
  const initializedUserId = useRef<string | null>(null)
  const saveBusy = useRef(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoObjectUrlRef = useRef<string | null>(null)
  const bioRef = useRef<HTMLTextAreaElement>(null)
  const [initial, setInitial] = useState<ProfileDraft | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadedPhotoKey, setUploadedPhotoKey] = useState<string | null>(null)
  const [newContribution, setNewContribution] = useState('')
  const [focusLinkId, setFocusLinkId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const clearLocalPhotoPreview = useCallback(() => {
    if (!photoObjectUrlRef.current) return
    URL.revokeObjectURL(photoObjectUrlRef.current)
    photoObjectUrlRef.current = null
  }, [])

  useLayoutEffect(() => {
    if (!appUser) {
      initializedUserId.current = null
      return
    }
    if (initializedUserId.current === appUser.id) return
    initializedUserId.current = appUser.id
    clearLocalPhotoPreview()
    const next = profileDraft(appUser)
    setInitial(next)
    setDraft(next)
    setPhotoPreview(appUser.profile_photo_url)
    setPhotoFile(null)
    setUploadedPhotoKey(null)
    setNewContribution('')
  }, [appUser, clearLocalPhotoPreview])

  useEffect(() => () => clearLocalPhotoPreview(), [clearLocalPhotoPreview])

  function chooseLink(platform: string) {
    if (!draft) return
    const present = draft.links.find((entry) => entry.platform === platform)
    if (present) {
      setFocusLinkId(present.id)
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(`input[data-link-id="${present.id}"]`)?.focus()
      })
      return
    }

    const empty = draft.links.find((entry) => entry.url.trim() === '')
    if (empty) {
      setDraft({
        ...draft,
        links: draft.links.map((entry) => entry.id === empty.id ? { ...entry, platform } : entry),
      })
      setFocusLinkId(empty.id)
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(`input[data-link-id="${empty.id}"]`)?.focus()
      })
      return
    }

    if (draft.links.length >= 12) {
      showToast('error', 'You can save up to 12 social links.')
      return
    }

    const nextId = draft.links.reduce((max, entry) => Math.max(max, entry.id), 0) + 1
    setDraft({ ...draft, links: [{ id: nextId, platform, url: '' }, ...draft.links] })
    setFocusLinkId(nextId)
  }

  function autoGrowBio() {
    const el = bioRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`
  }

  const committedContributions = (draft?.contributions ?? []).map((item) => item.trim()).filter(Boolean)
  const dirty = Boolean(
    draft && initial && (
      draft.display_name !== initial.display_name ||
      draft.alias !== initial.alias ||
      draft.bio !== initial.bio ||
      JSON.stringify(committedContributions) !== JSON.stringify(initial.contributions) ||
      JSON.stringify(socialLinksFromEntries(draft.links)) !== JSON.stringify(
        socialLinksFromEntries(initial.links),
      ) ||
      newContribution.trim() !== '' ||
      photoFile !== null
    ),
  )

  async function saveProfile() {
    if (!appUser || !draft || saveBusy.current) return
    const displayName = draft.display_name.trim()
    if (!displayName) {
      showToast('error', 'Enter a display name before saving.')
      return
    }
    const contributions = [...committedContributions, newContribution.trim()].filter(Boolean)
    if (contributions.length > 50) {
      showToast('error', 'You can save up to 50 contributions.')
      return
    }

    saveBusy.current = true
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Sign in again to continue.')

      let profilePhotoKey: string | undefined
      if (photoFile) {
        if (uploadedPhotoKey) {
          profilePhotoKey = uploadedPhotoKey
        } else {
          const uploaded = await uploadImage(photoFile, token, { purpose: 'profile_photo' })
          profilePhotoKey = uploaded.storage_key
          setUploadedPhotoKey(uploaded.storage_key)
        }
      }

      const payload: UserProfileUpdate = {
        display_name: displayName,
        alias: draft.alias.trim() || null,
        bio: draft.bio.trim() || null,
        contributions,
        social_links: socialLinksFromEntries(draft.links),
      }
      if (profilePhotoKey) payload.profile_photo_key = profilePhotoKey

      const updated = await updateMyProfile(payload, token)
      const savedDraft = profileDraft(updated)
      setInitial(savedDraft)
      setDraft(savedDraft)
      clearLocalPhotoPreview()
      setPhotoPreview(updated.profile_photo_url)
      setPhotoFile(null)
      setUploadedPhotoKey(null)
      setNewContribution('')
      showToast('success', 'Profile saved')

      try {
        await refreshUser({ background: true })
      } catch {
        showToast('error', 'Your profile was saved, but the account header could not refresh. Reload the page to update it.')
      }
    } catch (caught) {
      showToast('error', caught instanceof Error ? caught.message : 'Could not save your profile. Try again.')
    } finally {
      saveBusy.current = false
      setSaving(false)
    }
  }

  function cancelChanges() {
    if (!initial) return
    setDraft({ ...initial, contributions: [...initial.contributions], links: [...initial.links] })
    clearLocalPhotoPreview()
    setPhotoPreview(appUser?.profile_photo_url ?? null)
    setPhotoFile(null)
    setUploadedPhotoKey(null)
    setNewContribution('')
  }

  if (loading || !isLoaded) {
    return <div className="flex flex-col gap-5"><PageHeader title="Profile" subtitle="Manage your personal information." /><p className="rounded-xl border border-outline bg-surface-lowest px-5 py-10 text-center text-sm text-muted">Loading your profile...</p></div>
  }

  if (!appUser || !draft) {
    return <div className="flex flex-col gap-5"><PageHeader title="Profile" subtitle="Manage your personal information." /><div role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{authError?.message ?? 'Your account profile could not be loaded. Try signing in again.'}</div></div>
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Profile" subtitle="Manage your personal information." />

      <fieldset disabled={saving} className="contents" aria-busy={saving}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                showToast('error', 'Choose a JPEG, PNG, or WebP image.')
                return
              }
              if (file.size === 0 || file.size > 10 * 1024 * 1024) {
                showToast('error', file.size === 0
                  ? 'Choose an image that is not empty.'
                  : 'Choose an image no larger than 10 MiB.')
                return
              }
              clearLocalPhotoPreview()
              const preview = URL.createObjectURL(file)
              photoObjectUrlRef.current = preview
              setPhotoPreview(preview)
              setUploadedPhotoKey(null)
              setPhotoFile(file)
            }}
          />
          <button
            type="button"
            aria-label="Change profile photo"
            onClick={() => photoInputRef.current?.click()}
            className="group relative mx-auto h-40 w-40 overflow-hidden rounded-full bg-surface-container"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
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
                const filled = draft.links.some((entry) => entry.platform === field.key && entry.url.trim() !== '')
                return (
                  <button
                    key={field.key}
                    type="button"
                    aria-label={field.label}
                    title={field.label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseLink(field.key)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${filled ? 'bg-on-surface text-surface-lowest' : 'bg-surface-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                  >
                    {field.key === 'custom' ? <Icon name="link" className="text-[20px]" /> : <BrandIcon path={field.path} />}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-1">
              {draft.links.map((entry) => {
                const field = socialFields.find((item) => item.key === entry.platform)
                return (
                  <div key={entry.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-low">
                    <span className="flex w-[18px] shrink-0 justify-center text-on-surface-variant">
                      {entry.platform === 'custom' || !field ? <Icon name="link" className="text-[18px] leading-none" /> : <BrandIcon path={field.path} className="h-4 w-4" />}
                    </span>
                    <input
                      autoFocus={focusLinkId === entry.id}
                      data-link-id={entry.id}
                      type="url"
                      value={entry.url}
                      onChange={(event) => setDraft({ ...draft, links: draft.links.map((item) => item.id === entry.id ? { ...item, url: event.target.value } : item) })}
                      onFocus={() => setFocusLinkId(entry.id)}
                      onBlur={() => {
                        if (entry.url.trim() === '') setDraft((current) => current ? { ...current, links: current.links.filter((item) => item.id !== entry.id) } : current)
                      }}
                      placeholder={field?.placeholder ?? 'https://your-link.com'}
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
              value={draft.display_name}
              onChange={(event) => setDraft({ ...draft, display_name: event.target.value })}
              maxLength={120}
              placeholder="Your full name"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Email</span>
            <input type="email" value={appUser.email ?? ''} readOnly className={`${inputClass} cursor-not-allowed bg-surface-low text-muted`} />
            <span className="text-xs text-muted">Email is managed by your sign-in account.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Access Role</span>
            <input type="text" value={displayRole(appUser.role)} readOnly className={`${inputClass} cursor-not-allowed bg-surface-low text-muted`} />
            <span className="text-xs text-muted">Access is managed by an administrator.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Position</span>
            <input type="text" value={appUser.positions.join(', ')} placeholder="No position assigned" readOnly className={`${inputClass} cursor-not-allowed bg-surface-low text-muted`} />
            <span className="text-xs text-muted">Your directory position is managed by an administrator.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Alias</span>
            <input
              type="text"
              value={draft.alias}
              onChange={(event) => setDraft({ ...draft, alias: event.target.value })}
              placeholder="A name the community knows you by"
              maxLength={80}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Bio / Description</span>
            <textarea
              ref={bioRef}
              value={draft.bio}
              onChange={(event) => {
                setDraft({ ...draft, bio: event.target.value })
                requestAnimationFrame(autoGrowBio)
              }}
              placeholder="Tell the community about yourself..."
              rows={6}
              maxLength={4000}
              className={`${inputClass} min-h-36 resize-none overflow-y-auto`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <p className={labelClass}>Contributions</p>
            <div className="flex flex-col gap-1 rounded-lg border border-outline bg-surface-lowest px-3 py-2">
              {draft.contributions.map((contribution, index) => (
                <label key={index} className="flex items-center gap-3">
                  <span aria-hidden="true" className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
                  <input
                    type="text"
                    value={contribution}
                    maxLength={300}
                    onChange={(event) => setDraft({ ...draft, contributions: draft.contributions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
                    placeholder="Describe a contribution"
                    className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm text-on-surface placeholder:text-muted focus:bg-surface-low focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Remove contribution ${index + 1}`}
                    onClick={() => setDraft({ ...draft, contributions: draft.contributions.filter((_, itemIndex) => itemIndex !== index) })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </label>
              ))}
              <label className="flex items-center gap-3">
                <span aria-hidden="true" className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
                <input
                  type="text"
                  value={newContribution}
                  onChange={(event) => setNewContribution(event.target.value)}
                  maxLength={300}
                  placeholder="Add a contribution..."
                  className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm text-on-surface placeholder:text-muted focus:bg-surface-low focus:outline-none"
                />
                {newContribution.trim() && (
                  <button
                    type="button"
                    aria-label="Add contribution"
                    onClick={() => {
                      if (draft.contributions.length >= 50) {
                        showToast('error', 'You can save up to 50 contributions.')
                        return
                      }
                      setDraft({ ...draft, contributions: [...draft.contributions, newContribution.trim()] })
                      setNewContribution('')
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                  ><Icon name="add" className="text-[18px]" /></button>
                )}
              </label>
            </div>
          </div>

          {dirty && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelChanges}
                disabled={saving}
                className="flex h-9 items-center rounded-lg border border-outline bg-surface-lowest px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low disabled:opacity-50"
              >Cancel</button>
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={saving}
                className="flex h-9 items-center gap-2 rounded-lg bg-btn px-5 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
              >
                <Icon name={saving ? 'progress_activity' : 'save'} className="text-[18px]" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
      </fieldset>
    </div>
  )
}
