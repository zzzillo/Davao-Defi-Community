import { useNavigate } from 'react-router-dom'
import { useDemoAuth } from '../../auth/useDemoAuth'
import logo from '../../assets/brand/ddc-logo-horizontal-light.svg'

export default function SignInPage() {
  const navigate = useNavigate()
  const { signIn } = useDemoAuth()

  function enterDemo() {
    signIn()
    navigate('/admin', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-outline bg-surface-lowest p-8 shadow-float">
        <img src={logo} alt="Davao DeFi Community" className="mb-8 h-10 w-auto" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin demo</p>
        <h1 className="mt-2 text-2xl font-bold text-on-surface">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Sign in with the sample official account to explore the dashboard and profile.
        </p>
        <div className="mt-6 rounded-xl bg-surface-low p-4">
          <p className="font-semibold text-on-surface">Sarah Jenkins</p>
          <p className="mt-1 text-sm text-on-surface-variant">sarah@davaodefi.org · Admin</p>
        </div>
        <button
          type="button"
          onClick={enterDemo}
          className="mt-5 w-full rounded-lg bg-btn px-4 py-3 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Continue as Sarah
        </button>
        <p className="mt-4 text-center text-xs text-muted">Demo session · no password required</p>
      </section>
    </main>
  )
}
