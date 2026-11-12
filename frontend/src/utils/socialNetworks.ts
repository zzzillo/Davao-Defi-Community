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

const linkedinPath =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.225 0z'

/** The supported profile platforms and their shared editor/public presentation. */
export const SOCIAL_NETWORKS = [
  { key: 'x', label: 'X / Twitter', iconPath: siX.path, placeholder: 'https://x.com/username' },
  { key: 'facebook', label: 'Facebook', iconPath: siFacebook.path, placeholder: 'https://facebook.com/username' },
  { key: 'instagram', label: 'Instagram', iconPath: siInstagram.path, placeholder: 'https://instagram.com/username' },
  { key: 'linkedin', label: 'LinkedIn', iconPath: linkedinPath, placeholder: 'https://linkedin.com/in/username' },
  { key: 'youtube', label: 'YouTube', iconPath: siYoutube.path, placeholder: 'https://youtube.com/@channel' },
  { key: 'tiktok', label: 'TikTok', iconPath: siTiktok.path, placeholder: 'https://tiktok.com/@username' },
  { key: 'telegram', label: 'Telegram', iconPath: siTelegram.path, placeholder: 'https://t.me/username' },
  { key: 'discord', label: 'Discord', iconPath: siDiscord.path, placeholder: 'https://discord.gg/invite' },
  { key: 'github', label: 'GitHub', iconPath: siGithub.path, placeholder: 'https://github.com/username' },
  { key: 'custom', label: 'Other Link', iconPath: '', placeholder: 'https://your-link.com' },
] as const

export function getSocialNetwork(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const key = normalized === 'twitter' || normalized === 'xtwitter'
    ? 'x'
    : normalized === 'fb'
      ? 'facebook'
      : normalized

  return SOCIAL_NETWORKS.find((network) => network.key === key)
}
