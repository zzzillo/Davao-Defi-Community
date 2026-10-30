import { lazy, useEffect, useRef } from 'react'
import LandingIntro from '../../components/LandingIntro'
import DeferredSection from '../../components/DeferredSection'
import SiteNavbar, { publicNavLinks } from '../../components/SiteNavbar'

const PartnersCarousel = lazy(() => import('../../components/PartnersCarousel'))
const PhotoCarousel = lazy(() => import('../../components/PhotoCarousel'))
const LandingWhatWeDo = lazy(() => import('../../components/LandingWhatWeDo'))
const LandingEvents = lazy(() => import('../../components/LandingEvents'))
const LandingBlogs = lazy(() => import('../../components/LandingBlogs'))
const LandingTeam = lazy(() => import('../../components/LandingTeam'))
const LandingFAQ = lazy(() => import('../../components/LandingFAQ'))
const LandingFooter = lazy(() => import('../../components/LandingFooter'))

export default function Landing() {
  const landingRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = landingRef.current
    if (!root) return

    document.documentElement.classList.add('landing-page')
    const elements = new WeakSet<Element>()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsObserver = 'IntersectionObserver' in window
    const isSmallScreen = window.matchMedia('(max-width: 767px)').matches
    const markVisible = (element: Element) => element.setAttribute('data-revealed', 'true')
    const earlyObserver = !reduceMotion && supportsObserver
      ? new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            markVisible(entry.target)
            observer.unobserve(entry.target)
          })
        }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })
      : null
    const lateObserver = !reduceMotion && supportsObserver
      ? new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            markVisible(entry.target)
            observer.unobserve(entry.target)
          })
        }, isSmallScreen
          ? { threshold: 0.06, rootMargin: '0px 0px 4% 0px' }
          : { threshold: 0.18, rootMargin: '0px 0px -10% 0px' })
      : null
    const observe = (element: Element) => {
      if (elements.has(element)) return
      elements.add(element)
      if (reduceMotion || !supportsObserver) markVisible(element)
      else if (element.hasAttribute('data-scroll-reveal-late')) lateObserver?.observe(element)
      else earlyObserver?.observe(element)
    }
    const attach = (node: ParentNode) => {
      if (node instanceof Element && node.matches('[data-scroll-reveal]')) observe(node)
      node.querySelectorAll('[data-scroll-reveal]').forEach(observe)
    }

    attach(root)
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof Element) attach(node)
      }))
    })
    mutations.observe(root, { childList: true, subtree: true })

    return () => {
      document.documentElement.classList.remove('landing-page')
      mutations.disconnect()
      earlyObserver?.disconnect()
      lateObserver?.disconnect()
    }
  }, [])

  return (
    <div ref={landingRef} id="landing-home" className="min-h-screen bg-white text-black transition-colors duration-300 dark:bg-black dark:text-[#f5f5f5]">
      <SiteNavbar
        homeHref="#landing-home"
        links={publicNavLinks}
      />
      <LandingIntro />
      <DeferredSection className="min-h-[104px]"><PartnersCarousel /></DeferredSection>
      <DeferredSection className="min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"><PhotoCarousel /></DeferredSection>
      <DeferredSection className="min-h-[720px] lg:min-h-[180vh]"><LandingWhatWeDo /></DeferredSection>
      <DeferredSection className="min-h-[650px] lg:min-h-[900px]"><LandingEvents /></DeferredSection>
      <DeferredSection className="min-h-[620px]"><LandingBlogs /></DeferredSection>
      <DeferredSection id="contributors" className="min-h-[215vh]"><LandingTeam /></DeferredSection>
      <DeferredSection className="min-h-[480px]"><LandingFAQ /></DeferredSection>
      <DeferredSection className="min-h-64"><LandingFooter /></DeferredSection>
    </div>
  )
}
