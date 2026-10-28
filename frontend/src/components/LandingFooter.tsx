import logo from '../assets/brand/ddc-logo-horizontal-light.svg'

const footerGroups = [
  {
    title: 'Explore',
    links: [
      { label: 'Events', href: '/events' },
      { label: 'Blogs', href: '/blogs' },
      { label: 'Contributors', href: '/contributors' },
      { label: 'Join us', href: '/sign-up' },
      { label: 'Back to top', href: '#landing-home' },
    ],
  },
  {
    title: 'Socials',
    links: [
      { label: 'X / Twitter', href: 'https://x.com/DavaoDefi', external: true },
      { label: 'Facebook', href: 'https://www.facebook.com/davaodeficommunity', external: true },
      { label: 'Discord', href: 'https://discord.gg/RU8uWSCCgJ', external: true },
      { label: 'Telegram', href: 'https://t.me/+2RQqhbV9-j03ZTg1', external: true },
    ],
  },
]

export default function LandingFooter() {
  return (
    <footer className="w-full bg-white px-6 pb-12 pt-8 sm:px-10 sm:pb-16 sm:pt-10 lg:px-16">
      <div className="mx-auto grid w-full max-w-[1160px] gap-12 border-t border-gray-300 pt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.7fr)] lg:gap-24">
        <a href="#landing-home" aria-label="Davao DeFi Community home" className="inline-flex w-fit">
          <img src={logo} alt="Davao DeFi Community" className="h-auto w-44 sm:w-52" />
        </a>

        <div className="grid grid-cols-2 gap-10 sm:gap-14 lg:gap-20">
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="mb-5 text-sm font-medium uppercase tracking-wide text-gray-500">
                {group.title}
              </h2>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={'external' in link && link.external ? '_blank' : undefined}
                      rel={'external' in link && link.external ? 'noreferrer' : undefined}
                      className="text-sm font-medium uppercase text-[#082923] transition-colors hover:text-[#D94D5F] sm:text-base"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  )
}
