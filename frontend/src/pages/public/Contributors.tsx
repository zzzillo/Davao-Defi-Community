import { useState } from 'react'
import { siDiscord, siGithub, siInstagram, siTelegram, siX } from 'simple-icons'
import Icon from '../../components/Icon'

const socialIcons = {
  discord: siDiscord.path,
  github: siGithub.path,
  instagram: siInstagram.path,
  telegram: siTelegram.path,
  x: siX.path,
}

type SocialNetwork = keyof typeof socialIcons
type SocialLink = { network: SocialNetwork; url: string }
type Contributor = {
  name: string
  alias: string
  position: string
  bio: string
  socials: SocialLink[]
  portrait: number
}

const contributors: Contributor[] = [
  { name: 'Mika Reyes', alias: '@mika.reyes', position: 'Community Organizer', bio: 'Brings local builders together and turns good conversations into community projects.', socials: [{ network: 'x', url: 'https://x.com/mika_reyes' }, { network: 'instagram', url: 'https://instagram.com/mika.reyes' }], portrait: 0 },
  { name: 'Paolo Santos', alias: '@paolobuilds', position: 'Protocol Builder', bio: 'Explores onchain tools and shares practical lessons with developers getting started.', socials: [{ network: 'github', url: 'https://github.com/paolobuilds' }, { network: 'x', url: 'https://x.com/paolobuilds' }], portrait: 1 },
  { name: 'Arielle Cruz', alias: '@ariellecreates', position: 'Content Creator', bio: 'Makes Web3 ideas easier to understand through community stories and event recaps.', socials: [{ network: 'instagram', url: 'https://instagram.com/ariellecreates' }, { network: 'x', url: 'https://x.com/ariellecreates' }], portrait: 2 },
  { name: 'Jules Navarro', alias: '@jules.codes', position: 'Developer Advocate', bio: 'Supports local developers through workshops, project reviews, and technical guidance.', socials: [{ network: 'github', url: 'https://github.com/julescodes' }, { network: 'discord', url: 'https://discord.com' }], portrait: 3 },
  { name: 'Sam Dela Peña', alias: '@sam.events', position: 'Event Volunteer', bio: 'Helps make community gatherings welcoming and easy for first-time attendees to join.', socials: [{ network: 'instagram', url: 'https://instagram.com/sam.events' }, { network: 'telegram', url: 'https://t.me/samevents' }], portrait: 4 },
  { name: 'Kai Mendoza', alias: '@kai.onchain', position: 'Research Contributor', bio: 'Looks into emerging protocols and brings thoughtful research to community discussions.', socials: [{ network: 'x', url: 'https://x.com/kaionchain' }, { network: 'telegram', url: 'https://t.me/kaionchain' }], portrait: 5 },
  { name: 'Bea Villanueva', alias: '@beav.design', position: 'Designer', bio: 'Creates clear, friendly visuals for announcements, events, and community initiatives.', socials: [{ network: 'instagram', url: 'https://instagram.com/beav.design' }, { network: 'x', url: 'https://x.com/beavdesign' }], portrait: 6 },
  { name: 'Noel Garcia', alias: '@noelbuilds', position: 'Community Builder', bio: 'Connects students and new builders with people, learning resources, and ways to contribute.', socials: [{ network: 'github', url: 'https://github.com/noelbuilds' }, { network: 'discord', url: 'https://discord.com' }], portrait: 7 },
]

const portraitColors = [
  { background: '#F8D9C4', skin: '#A76448', hair: '#28212B', shirt: '#E77948' },
  { background: '#D7E8F1', skin: '#D99E75', hair: '#332A29', shirt: '#246B78' },
  { background: '#F5DCE7', skin: '#E5B28E', hair: '#39272B', shirt: '#B65373' },
  { background: '#E4DDF3', skin: '#B97653', hair: '#26252D', shirt: '#665B9C' },
  { background: '#D9ECE4', skin: '#D29A73', hair: '#312A27', shirt: '#37816D' },
  { background: '#DCE5F5', skin: '#A66C4C', hair: '#27252E', shirt: '#4E70A7' },
  { background: '#F4DFDA', skin: '#E3B08B', hair: '#3A2928', shirt: '#C46F5A' },
  { background: '#D5ECEB', skin: '#C78D68', hair: '#29282A', shirt: '#347D7C' },
]

function ContributorPortrait({ contributor }: { contributor: Contributor }) {
  const colors = portraitColors[contributor.portrait]

  return (
    <svg
      role="img"
      aria-label={`Sample portrait of ${contributor.name}`}
      viewBox="0 0 80 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 block h-full w-full"
    >
      <rect width="80" height="100" fill={colors.background} />
      <path d="M6 16l7-7 7 7-7 7zm52 8 8-8 8 8-8 8zM5 66l7-7 7 7-7 7z" fill="#fff" opacity=".12" />
      <circle cx="66" cy="70" r="14" fill="#fff" opacity=".06" />
      <path d="M0 100c2-25 16-37 40-37s38 12 40 37" fill={colors.shirt} />
      <path d="M19 44c0-25 8-37 21-37s21 12 21 37v9H19z" fill={colors.hair} />
      <ellipse cx="40" cy="39" rx="17" ry="22" fill={colors.skin} />
      <path d="M23 34c2-18 8-27 18-27s17 9 18 26c-7-2-12-7-15-13-5 8-11 12-21 14z" fill={colors.hair} />
      <circle cx="34" cy="40" r="1.4" fill="#302729" />
      <circle cx="46" cy="40" r="1.4" fill="#302729" />
      <path d="M36 49c2 2 6 2 8 0" fill="none" stroke="#8D4F45" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function PublicContributors() {
  const [query, setQuery] = useState('')
  const search = query.trim().toLowerCase()
  const filteredContributors = contributors.filter((contributor) => (
    [contributor.name, contributor.alias, contributor.position, contributor.bio]
      .join(' ')
      .toLowerCase()
      .includes(search)
  ))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Contributors</h1>
        <p className="text-on-surface-variant">
          Meet the volunteers building Davao DeFi together.
        </p>
      </div>

      <div className="flex justify-end">
        <label className="relative flex items-center sm:w-72 sm:shrink-0">
          <Icon name="search" className="pointer-events-none absolute left-3 text-[20px] text-muted" />
          <span className="sr-only">Search contributors</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contributors"
            className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
          />
        </label>
      </div>

      {filteredContributors.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No contributors match “{query.trim()}”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContributors.map((contributor) => (
            <article key={contributor.name} className="flex h-full flex-col overflow-hidden rounded-xl border border-outline bg-surface-lowest transition-shadow hover:shadow-float">
              <div className="relative aspect-square w-full flex-none overflow-hidden bg-surface-low">
                <ContributorPortrait contributor={contributor} />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16">
                  <h2 className="text-xl font-semibold leading-tight text-white">{contributor.name}</h2>
                  <p className="mt-1 text-sm text-white/75">{contributor.alias}</p>
                  <p className="mt-2 text-sm font-medium text-white/90">{contributor.position}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="flex-1 text-sm leading-relaxed text-on-surface-variant">{contributor.bio}</p>
                <nav aria-label={`${contributor.name} social links`} className="mt-5 flex items-center gap-3">
                  {contributor.socials.map((social) => (
                    <a key={social.network} href={social.url} target="_blank" rel="noreferrer" aria-label={`${contributor.name} on ${social.network}`} title={social.network} className="text-muted transition-colors hover:text-on-surface">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d={socialIcons[social.network]} />
                      </svg>
                    </a>
                  ))}
                </nav>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
