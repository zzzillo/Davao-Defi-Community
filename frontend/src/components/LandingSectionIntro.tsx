export default function LandingSectionIntro({ title }: { title: string }) {
  return (
    <h2
      data-scroll-reveal
      className="scroll-reveal mb-8 max-w-[720px] text-[clamp(2.15rem,7vw,2.9rem)] font-medium leading-[1.02] tracking-[-0.05em] text-black dark:text-[#f5f5f5] sm:text-[clamp(2.65rem,5vw,3.75rem)]"
    >
      {title}
    </h2>
  )
}
