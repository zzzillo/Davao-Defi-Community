import orbitMark from '../assets/brand/ddc-mark-dot-orbit.gif'

/** Centered brand loader for full-page authentication and route startup. */
export default function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface" role="status" aria-live="polite">
      <img src={orbitMark} alt="Loading" className="h-64 w-64 object-contain" />
      <span className="sr-only">Loading…</span>
    </main>
  )
}
