import { lazy, useEffect, useRef, useState } from 'react'
import LandingIntro from '../../components/LandingIntro'
import DeferredSection from '../../components/DeferredSection'
import { LANDING_PARTNER_FALLBACKS } from '../../data/landingPartnerFallback'
import { loadLandingData, type LandingSnapshot } from '../../services/landingSnapshot'

const PartnersCarousel = lazy(() => import('../../components/PartnersCarousel'))
const PhotoCarousel = lazy(() => import('../../components/PhotoCarousel'))
const LandingWhatWeDo = lazy(() => import('../../components/LandingWhatWeDo'))
const LandingUpcomingRSVP = lazy(() => import('../../components/LandingUpcomingRSVP'))
const PastEvents = lazy(() => import('../../components/PastEvents'))
const LandingBlogs = lazy(() => import('../../components/LandingBlogs'))
const LandingTeam = lazy(() => import('../../components/LandingTeam'))
const LandingFAQ = lazy(() => import('../../components/LandingFAQ'))
const LandingFooter = lazy(() => import('../../components/LandingFooter'))

export default function Landing() {
  const landingRef = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<LandingSnapshot>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let mounted = true
    void loadLandingData().then(
      ({ snapshot: data }) => { if (mounted) setSnapshot(data) },
      () => { if (mounted) setFailed(true) },
    )
    return () => { mounted = false }
  }, [attempt])

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
    <div ref={landingRef} id="landing-home" className="w-full bg-white text-black transition-colors duration-300 dark:bg-black dark:text-[#f5f5f5]">
      <LandingIntro />
      {failed && (
        <p role="status" className="mx-auto max-w-[1160px] px-6 py-4 text-sm text-gray-600 dark:text-[#b5b5b5]">
          Community updates are temporarily unavailable.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => {
            setFailed(false)
            setSnapshot(undefined)
            setAttempt((current) => current + 1)
          }}>Retry</button>
        </p>
      )}
      <DeferredSection className="min-h-[104px]">
        {snapshot
          ? <PartnersCarousel partners={snapshot.partners} />
          : failed
            ? <PartnersCarousel partners={LANDING_PARTNER_FALLBACKS} />
            : <p role="status" className="sr-only">Loading community updates…</p>}
      </DeferredSection>
      <DeferredSection className="min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"><PhotoCarousel /></DeferredSection>
      <DeferredSection className="min-h-[720px] lg:min-h-[180vh]"><LandingWhatWeDo stats={snapshot?.stats} /></DeferredSection>
      {!failed && (
        <>
          <DeferredSection>
            {snapshot && <LandingUpcomingRSVP event={snapshot.event} />}
          </DeferredSection>
          <DeferredSection>
            {snapshot && <PastEvents recaps={snapshot.recaps} />}
          </DeferredSection>
          <DeferredSection className="min-h-[620px]">
            {snapshot && <LandingBlogs articles={snapshot.articles} />}
          </DeferredSection>
        </>
      )}
      <DeferredSection id="contributors" className="min-h-[215vh]"><LandingTeam /></DeferredSection>
      <DeferredSection className="min-h-[480px]"><LandingFAQ /></DeferredSection>
      <DeferredSection className="min-h-64"><LandingFooter /></DeferredSection>
    </div>
  )
}
