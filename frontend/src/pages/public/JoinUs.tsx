const GOOGLE_FORM_URL = 'https://forms.gle/REPLACE_WITH_REGISTRATION_FORM'

export default function JoinUs() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Join the community</h1>
        <p className="text-on-surface-variant">
          We’re a volunteer-led community. Here’s what you can be part of:
        </p>
      </div>

      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-on-surface-variant marker:text-muted sm:text-base">
        <li>Connect with local developers, creators, and founders.</li>
        <li>Learn practical Web3 and DeFi skills through workshops and peer-led sessions.</li>
        <li>Contribute to community projects and help organize events alongside fellow volunteers.</li>
      </ul>

      <div className="flex w-full justify-center pt-2">
        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] sm:text-base"
        >
          Register now
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4H4v12h12v-3M10 4h6v6M16 4l-8 8" />
          </svg>
        </a>
      </div>
    </div>
  )
}
