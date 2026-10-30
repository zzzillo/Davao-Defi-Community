export default function LandingIntro() {
  return (
    <main className="flex min-h-[400px] items-center px-6 py-8 sm:min-h-[440px] sm:px-10 sm:py-10 lg:min-h-[480px] lg:px-16 lg:py-14">
      <section
        aria-labelledby="landing-intro-title"
        className="mx-auto grid w-full max-w-[1600px] items-center gap-y-5 gap-x-10 xl:translate-y-16 xl:grid-cols-[1.1fr_0.9fr] xl:gap-16"
      >
        <h1
          id="landing-intro-title"
          data-scroll-reveal
          className="scroll-reveal max-w-[920px] font-sans text-[clamp(2.5rem,10vw,3rem)] leading-[1.02] tracking-[-0.055em] text-black dark:text-[#f5f5f5] sm:text-[clamp(3rem,5.4vw,6.5rem)]"
        >
          <span className="block sm:hidden">We are</span>
          <span className="block sm:hidden">Davao DeFi</span>
          <span className="block sm:hidden">Community</span>
          <span className="hidden sm:block">We are Davao</span>
          <span className="hidden sm:block">DeFi Community</span>
        </h1>

        <div data-scroll-reveal className="scroll-reveal max-w-[500px] xl:justify-self-start" style={{ transitionDelay: '120ms' }}>
          <p className="text-base leading-relaxed text-gray-700 dark:text-[#b5b5b5] sm:text-lg lg:text-xl">
            Rooted in Mindanao, connecting local builders and creators to the global Web3 ecosystem and beyond.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 min-[480px]:flex-row">
            <a
              href="/join-us"
              className="inline-flex h-10 w-full max-w-44 items-center justify-center whitespace-nowrap rounded-full border-0 bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] min-[480px]:w-auto min-[480px]:max-w-none"
            >
              Join Us
            </a>
            <a
              href="/events"
              className="inline-flex h-10 w-full max-w-44 items-center justify-center whitespace-nowrap rounded-full border border-black bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173c35] dark:border-[#4a4a4a] dark:bg-[#141414] dark:text-[#f5f5f5] dark:hover:bg-[#222222] min-[480px]:w-auto min-[480px]:max-w-none"
            >
              Upcoming Event
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
