import ScrollExpand from './ScrollExpand'
import desktopCollage from '../assets/team/community-wide.webp'
import mobileCollage from '../assets/team/community-portrait.webp'

export default function LandingTeam() {
  return (
    <ScrollExpand
      preTitle="Contributors"
      startWidth={70}
      startHeight={70}
      startRadius={0}
      endRadius={0}
      mediaZoom={1.15}
      scrollDistance={0.8}
      holdDistance={0.35}
      smoothing={0.1}
      overlayScrim={0.65}
      media={(
        <picture className="absolute inset-0 block h-full w-full">
          <source media="(max-width: 639px)" srcSet={mobileCollage} />
          <img src={desktopCollage} alt="" loading="lazy" className="h-full w-full select-none object-cover" draggable={false} />
        </picture>
      )}
    >
      <h2 className="max-w-[18ch] text-[clamp(2.5rem,5.5vw,5rem)] font-bold leading-[0.98] tracking-tight text-white drop-shadow-lg">
        A community and counting.
      </h2>
      <p className="max-w-2xl text-lg font-semibold leading-relaxed text-white drop-shadow sm:text-xl">
        Meet builders, share ideas, and help shape the future of Web3 with us.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href="/sign-up"
          className="inline-flex w-44 items-center justify-center rounded-full border-0 bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] sm:text-base"
        >
          Join us
        </a>
        <a
          href="/contributors"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-base"
        >
          Meet contributors
        </a>
      </div>
    </ScrollExpand>
  )
}
