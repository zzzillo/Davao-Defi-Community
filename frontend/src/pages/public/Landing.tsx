import { useEffect, useState } from 'react'
import logo from '../../assets/brand/ddc-logo-horizontal-light.svg'
import LandingIntro from '../../components/LandingIntro'
import LandingEvents from '../../components/LandingEvents'
import LandingWhatWeDo from '../../components/LandingWhatWeDo'
import LandingBlogs from '../../components/LandingBlogs'
import LandingTeam from '../../components/LandingTeam'
import LandingFAQ from '../../components/LandingFAQ'
import LandingFooter from '../../components/LandingFooter'
import Grainient from '../../components/Grainient'
import PartnersCarousel from '../../components/PartnersCarousel'
import PhotoCarousel from '../../components/PhotoCarousel'

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const links = [
    { href: '/events', label: 'Events' },
    { href: '/blogs', label: 'Blogs' },
    { href: '/contributors', label: 'Contributors' },
  ]

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-reveal]'))
    const lateElements = elements.filter((element) => element.hasAttribute('data-scroll-reveal-late'))
    const earlyElements = elements.filter((element) => !element.hasAttribute('data-scroll-reveal-late'))
    const revealAll = () => elements.forEach((element) => element.classList.add('is-visible'))

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      revealAll()
      return
    }

    const observe = (targets: HTMLElement[], options: IntersectionObserverInit) => {
      if (targets.length === 0) return null
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      }, options)
      targets.forEach((element) => observer.observe(element))
      return observer
    }

    const earlyObserver = observe(earlyElements, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })
    const isSmallScreen = window.matchMedia('(max-width: 767px)').matches
    const lateObserver = observe(
      lateElements,
      isSmallScreen
        ? { threshold: 0.06, rootMargin: '0px 0px 4% 0px' }
        : { threshold: 0.18, rootMargin: '0px 0px -10% 0px' },
    )
    return () => {
      earlyObserver?.disconnect()
      lateObserver?.disconnect()
    }
  }, [])

  return (
    <div id="landing-home" className="min-h-screen bg-white">
      <header className="relative flex h-16 w-full items-center gap-3 bg-transparent px-4 sm:gap-8 sm:px-6">
        <a href="#landing-home" aria-label="Davao DeFi Community home" className="shrink-0">
          <img src={logo} alt="" className="h-8 w-auto sm:h-10" />
        </a>
        <nav aria-label="Main navigation" className="hidden items-center gap-3 md:flex sm:gap-8">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-gray-600 transition-colors hover:text-gray-950 sm:text-base">
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-items-center text-gray-800 md:hidden"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? <path d="M5 5l14 14M19 5 5 19" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className={`${menuOpen ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 bg-white px-4 py-3 shadow-md md:hidden`}
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-3 text-base text-gray-700 transition-colors hover:text-black"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <LandingIntro />
      <PartnersCarousel />
      <PhotoCarousel />
      <LandingWhatWeDo />
      <LandingEvents />
      <div
        aria-hidden="true"
        data-scroll-reveal
        data-scroll-reveal-late
        className="scroll-reveal h-96 w-full sm:h-[28rem] lg:h-[32rem]"
      >
        <Grainient
          colors={['#F58C2F', '#F58C2F', '#ffffff', '#EE2F71', '#EE2F71']}
          angle={195}
          scale={0.8}
          flow={0.6}
          softness={0}
          silk={0}
          stir={0}
          grainAmount={0}
          className="h-full w-full"
        />
      </div>
      <LandingBlogs />
      <LandingTeam />
      <LandingFAQ />
      <LandingFooter />
    </div>
  )
}
