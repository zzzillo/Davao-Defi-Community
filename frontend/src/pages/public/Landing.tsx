import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import LandingIntro from '../../components/LandingIntro'
import DeferredSection from '../../components/DeferredSection'
import PageMeta from '../../components/PageMeta'
import JsonLd from '../../components/JsonLd'
import { LANDING_FAQS } from '../../data/landingFaq'
import { faqPage, organization, website } from '../../utils/structuredData'
import { SkeletonBlock } from '../../components/PageSkeleton'
import { LANDING_PARTNER_FALLBACKS } from '../../data/landingPartnerFallback'
import { loadLandingData, loadLandingSnapshot, type LandingSnapshot } from '../../services/landingSnapshot'

const PartnersCarousel = lazy(() => import('../../components/PartnersCarousel'))
const PhotoCarousel = lazy(() => import('../../components/PhotoCarousel'))
const LandingWhatWeDo = lazy(() => import('../../components/LandingWhatWeDo'))
const LandingUpcomingRSVP = lazy(() => import('../../components/LandingUpcomingRSVP'))
const PastEvents = lazy(() => import('../../components/PastEvents'))
const LandingBlogs = lazy(() => import('../../components/LandingBlogs'))
const LandingTeam = lazy(() => import('../../components/LandingTeam'))
const LandingFAQ = lazy(() => import('../../components/LandingFAQ'))
const LandingFooter = lazy(() => import('../../components/LandingFooter'))
const LANDING_STRUCTURED_DATA = [organization(), website(), faqPage(LANDING_FAQS)]
const FIRST_BACKGROUND_RETRY_MS = 5000
const MAX_BACKGROUND_RETRY_MS = 5 * 60 * 1000

export default function Landing() {
  const landingRef = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<LandingSnapshot>()
  const [failed, setFailed] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    let mounted = true
    let retryDelay = FIRST_BACKGROUND_RETRY_MS
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const result = await loadLandingData()
        if (!mounted) return
        setSnapshot(result.snapshot)
        setFailed(false)
        setUsingFallback(result.source === 'backend')
        return
      } catch {
        if (!mounted) return
        setFailed(true)
      }

      retryTimer = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, MAX_BACKGROUND_RETRY_MS)
        void load()
      }, retryDelay)
    }

    void load()
    return () => {
      mounted = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  useEffect(() => {
    if (!usingFallback) return

    let mounted = true
    let retryDelay = FIRST_BACKGROUND_RETRY_MS
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      retryTimer = setTimeout(() => {
        void refresh()
      }, retryDelay)
      retryDelay = Math.min(retryDelay * 2, MAX_BACKGROUND_RETRY_MS)
    }

    const refresh = async () => {
      try {
        const freshSnapshot = await loadLandingSnapshot()
        if (!mounted) return
        setSnapshot(freshSnapshot)
        setUsingFallback(false)
      } catch {
        if (mounted) schedule()
      }
    }

    schedule()
    return () => {
      mounted = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [usingFallback])

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
      <PageMeta path="/" />
      <JsonLd data={LANDING_STRUCTURED_DATA} />
      <LandingIntro />
      <DeferredSection>
        {snapshot
          ? <Suspense fallback={null}><PartnersCarousel partners={snapshot.partners} /></Suspense>
          : failed
            ? <Suspense fallback={null}><PartnersCarousel partners={LANDING_PARTNER_FALLBACKS} /></Suspense>
            : null}
      </DeferredSection>
      <DeferredSection className="min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]">
        <Suspense fallback={<div role="status" aria-label="Loading community photos" className="flex min-h-[220px] gap-3 overflow-hidden sm:min-h-[260px] sm:gap-5 lg:min-h-[300px]">{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-[220px] w-[70vw] shrink-0 rounded-xl sm:h-[260px] sm:w-[42vw] lg:h-[300px]" />)}</div>}><PhotoCarousel /></Suspense>
      </DeferredSection>
      <DeferredSection className="lg:min-h-[180vh]">
        <Suspense fallback={<div role="status" aria-label="Loading initiatives" className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-6 py-12 lg:min-h-[180vh]"><SkeletonBlock className="h-10 w-64" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_575px]"><div className="flex flex-col gap-3">{[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} className="h-16 w-full rounded-lg" />)}</div><SkeletonBlock className="aspect-[4/3] w-full rounded-2xl" /></div></div>}><LandingWhatWeDo stats={snapshot?.stats} /></Suspense>
      </DeferredSection>
      <DeferredSection>
        {snapshot
          ? <Suspense fallback={<div role="status" aria-label="Loading upcoming event" className="mx-auto max-w-[1160px] px-6 py-12"><SkeletonBlock className="h-56 w-full rounded-2xl" /></div>}><LandingUpcomingRSVP event={snapshot.event} /></Suspense>
          : <div role="status" aria-label="Loading upcoming event" className="mx-auto max-w-[1160px] px-6 py-12"><SkeletonBlock className="h-56 w-full rounded-2xl" /></div>}
      </DeferredSection>
      <DeferredSection>
        {snapshot
          ? <Suspense fallback={<div role="status" aria-label="Loading past events" className="mx-auto flex max-w-[1160px] gap-4 overflow-hidden px-6 py-12">{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-64 w-72 shrink-0 rounded-xl" />)}</div>}><PastEvents recaps={snapshot.recaps} /></Suspense>
          : <div role="status" aria-label="Loading past events" className="mx-auto flex max-w-[1160px] gap-4 overflow-hidden px-6 py-12">{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-64 w-72 shrink-0 rounded-xl" />)}</div>}
      </DeferredSection>
      <DeferredSection className="min-h-[620px]">
        {snapshot
          ? <Suspense fallback={<div role="status" aria-label="Loading articles" className="mx-auto flex max-w-[1160px] flex-col gap-5 px-6 py-12"><SkeletonBlock className="h-9 w-56" />{[0, 1].map((item) => <div key={item} className="grid gap-4 border-b border-outline py-5 sm:grid-cols-[220px_1fr]"><SkeletonBlock className="aspect-[4/3] w-full" /><div className="flex flex-col gap-3"><SkeletonBlock className="h-5 w-3/4" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-2/3" /></div></div>)}</div>}><LandingBlogs articles={snapshot.articles} /></Suspense>
          : <div role="status" aria-label="Loading articles" className="mx-auto flex max-w-[1160px] flex-col gap-5 px-6 py-12"><SkeletonBlock className="h-9 w-56" />{[0, 1].map((item) => <div key={item} className="grid gap-4 border-b border-outline py-5 sm:grid-cols-[220px_1fr]"><SkeletonBlock className="aspect-[4/3] w-full" /><div className="flex flex-col gap-3"><SkeletonBlock className="h-5 w-3/4" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-2/3" /></div></div>)}</div>}
      </DeferredSection>
      <DeferredSection id="contributors" className="min-h-[215vh]"><Suspense fallback={<div role="status" aria-label="Loading contributors" className="mx-auto grid max-w-[1160px] grid-cols-2 gap-4 px-6 py-12 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} className="aspect-square w-full rounded-full" />)}</div>}><LandingTeam /></Suspense></DeferredSection>
      <DeferredSection className="min-h-[480px]"><Suspense fallback={<div role="status" aria-label="Loading questions" className="mx-auto flex min-h-[480px] max-w-[1160px] flex-col gap-4 px-6 py-12"><SkeletonBlock className="h-9 w-72" />{[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} className="h-14 w-full rounded-lg" />)}</div>}><LandingFAQ /></Suspense></DeferredSection>
      <DeferredSection className="min-h-64"><Suspense fallback={<div role="status" aria-label="Loading site footer" className="mx-auto flex min-h-64 max-w-[1160px] items-center gap-4 px-6 py-12"><SkeletonBlock className="h-10 w-40" /><SkeletonBlock className="h-4 w-52" /></div>}><LandingFooter /></Suspense></DeferredSection>
    </div>
  )
}
