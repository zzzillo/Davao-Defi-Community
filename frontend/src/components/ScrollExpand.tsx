import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1e-6), 0, 1)
  return t * t * (3 - 2 * t)
}

interface ScrollExpandProps {
  media: ReactNode
  preTitle?: string
  children: ReactNode
  startWidth?: number
  startHeight?: number
  startRadius?: number
  endRadius?: number
  mediaZoom?: number
  scrollDistance?: number
  holdDistance?: number
  smoothing?: number
  overlayScrim?: number
  enabled?: boolean
}

export default function ScrollExpand({
  media,
  preTitle = '',
  children,
  startWidth = 70,
  startHeight = 70,
  startRadius = 0,
  endRadius = 0,
  mediaZoom = 1.15,
  scrollDistance = 1.2,
  holdDistance = 0.35,
  smoothing = 0.1,
  overlayScrim = 0.65,
  enabled = true,
}: ScrollExpandProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const preTitleRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef({
    startWidth,
    startHeight,
    startRadius,
    endRadius,
    mediaZoom,
    scrollDistance,
    holdDistance,
    smoothing,
    overlayScrim,
    enabled,
  })
  propsRef.current = {
    startWidth,
    startHeight,
    startRadius,
    endRadius,
    mediaZoom,
    scrollDistance,
    holdDistance,
    smoothing,
    overlayScrim,
    enabled,
  }

  const applyProgress = useCallback((scrollProgress: number) => {
    const frame = frameRef.current
    if (!frame) return
    const config = propsRef.current
    const expansionProgress = clamp(scrollProgress / Math.max(0.01, config.scrollDistance), 0, 1)
    const eased = smoothstep(0, 1, expansionProgress)
    const width = config.startWidth + (100 - config.startWidth) * eased
    const height = config.startHeight + (100 - config.startHeight) * eased
    const insetX = Math.max(0, (100 - width) / 2)
    const insetY = Math.max(0, (100 - height) / 2)
    const radius = config.startRadius + (config.endRadius - config.startRadius) * eased

    frame.style.clipPath = `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`
    if (mediaRef.current) {
      mediaRef.current.style.transform = `scale(${config.mediaZoom + (1 - config.mediaZoom) * eased})`
    }
    if (scrimRef.current) {
      scrimRef.current.style.opacity = `${config.overlayScrim * eased}`
    }
    if (preTitleRef.current) {
      const fadeStart = config.scrollDistance + config.holdDistance * 0.12
      const fadeEnd = config.scrollDistance + config.holdDistance * 0.55
      const fade = smoothstep(fadeStart, fadeEnd, scrollProgress)
      preTitleRef.current.style.opacity = `${1 - fade}`
      preTitleRef.current.style.transform = `translate3d(0, ${-12 * fade}px, 0)`
    }
    if (overlayRef.current) {
      const reveal = smoothstep(config.scrollDistance, config.scrollDistance + config.holdDistance, scrollProgress)
      overlayRef.current.style.opacity = `${reveal}`
      overlayRef.current.style.transform = `translate3d(0, ${18 * (1 - reveal)}px, 0)`
      overlayRef.current.style.pointerEvents = reveal > 0.8 ? 'auto' : 'none'
      overlayRef.current.setAttribute('aria-hidden', reveal > 0.01 ? 'false' : 'true')
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const track = trackRef.current
    const stage = stageRef.current
    if (!root || !track || !stage) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let animationFrame = 0
    let current = 0
    let target = 0
    let stageHeight = 0
    let running = false

    const measure = () => {
      const config = propsRef.current
      stageHeight = window.innerHeight
      if (stageHeight <= 0) return
      stage.style.height = `${stageHeight}px`
      track.style.height = `${stageHeight * (1 + Math.max(0, config.scrollDistance) + Math.max(0, config.holdDistance))}px`
    }

    const readProgress = () => {
      const config = propsRef.current
      if (!config.enabled || reduceMotion) return config.scrollDistance + config.holdDistance
      const top = track.getBoundingClientRect().top
      return clamp(-top / Math.max(1, stageHeight), 0, config.scrollDistance + config.holdDistance)
    }

    const tick = () => {
      const config = propsRef.current
      const smoothingFactor = config.smoothing <= 0 ? 1 : 1 - Math.exp(-1 / (60 * config.smoothing))
      current += (target - current) * smoothingFactor
      if (Math.abs(target - current) < 0.0004) {
        current = target
        running = false
      }
      applyProgress(current)
      animationFrame = running ? window.requestAnimationFrame(tick) : 0
    }

    const onScroll = () => {
      target = readProgress()
      if (propsRef.current.smoothing <= 0 || reduceMotion) {
        current = target
        applyProgress(current)
        return
      }
      if (running) return
      running = true
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick)
    }

    const onResize = () => {
      measure()
      target = readProgress()
      current = target
      applyProgress(current)
    }

    measure()
    target = readProgress()
    current = target
    applyProgress(current)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(root)

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
    }
  }, [applyProgress, enabled, holdDistance, scrollDistance, smoothing])

  return (
    <div ref={rootRef} className="relative w-full">
      <div ref={trackRef} className="relative w-full">
        <div ref={stageRef} className="sticky top-0 w-full overflow-hidden bg-white dark:bg-black">
          <div ref={frameRef} className="absolute inset-0 [clip-path:inset(15%_15%_15%_15%_round_0px)] [will-change:clip-path]">
            <div ref={mediaRef} className="absolute inset-0 origin-center [will-change:transform]">
              {media}
            </div>
            <div ref={scrimRef} className="pointer-events-none absolute inset-0 bg-gray-800/65 opacity-0" />
            {preTitle ? (
              <div
                ref={preTitleRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-[6%] text-center text-[clamp(2.5rem,5.5vw,5rem)] font-bold leading-[0.98] tracking-tight text-white drop-shadow-lg [will-change:opacity,transform]"
              >
                {preTitle}
              </div>
            ) : null}
            <div ref={overlayRef} aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-[6%] text-center opacity-0 [will-change:opacity,transform]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
