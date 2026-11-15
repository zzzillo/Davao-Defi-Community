import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSignIn } from '@clerk/react'
import { useAppAuth } from '../../auth/useAppAuth'
import logo from '../../assets/brand/ddc-logo-horizontal-light.svg'
import { SkeletonResetPassword } from '../../components/PageSkeleton'

type ResetStep = 'email' | 'code' | 'password' | 'complete'

const inputClassName = 'mt-2 h-[34px] w-full rounded-xl border border-outline bg-white px-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-outline-strong focus:ring-0'
const buttonClassName = 'ddc-auth-primary-button flex h-[34px] w-full items-center justify-center gap-1 rounded-xl px-4 text-[13px] font-medium text-white transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] disabled:cursor-not-allowed disabled:opacity-50'

function ContinueArrow() {
  return (
    <svg aria-hidden="true" className="h-2 w-2" viewBox="0 0 12 12" fill="currentColor">
      <path d="M4 2.5 8.5 6 4 9.5z" />
    </svg>
  )
}

function ResetPasswordFlow() {
  const { signIn } = useSignIn()
  const [step, setStep] = useState<ResetStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function sendCode(address: string) {
    try {
      const created = await signIn.create({ identifier: address })
      if (!created.error) await signIn.resetPasswordEmailCode.sendCode()
    } catch {
      // Keep the response indistinguishable for existing and unknown emails.
    }
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    await sendCode(email.trim())
    setNotice('If an account exists for that email, a reset code has been sent.')
    setStep('code')
    setBusy(false)
  }

  async function handleResendCode() {
    setBusy(true)
    setError('')
    await sendCode(email.trim())
    setNotice('If an account exists for that email, a new reset code has been sent.')
    setBusy(false)
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() })
      if (result.error) {
        setError('That code could not be verified. Check it or request a new one.')
      } else {
        setStep('password')
      }
    } catch {
      setError('That code could not be verified. Check it or request a new one.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({ password })
      if (result.error) {
        setError(result.error.longMessage ?? 'We could not set that password. Please try another password.')
      } else {
        setPassword('')
        setConfirmPassword('')
        setStep('complete')
      }
    } catch {
      setError('We could not set that password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function changeEmail() {
    setStep('email')
    setCode('')
    setError('')
    setNotice('')
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-surface px-5 pb-10 pt-20">
      <section className="ddc-sign-in w-full max-w-sm">
        <img src={logo} alt="Davao DeFi Community" className="mx-auto mb-8 h-10 w-auto" />
        <div className="w-[calc(100%+1.125rem)]">
        {step === 'complete' ? (
          <div className="text-center">
            <h1 className="text-base font-semibold text-on-surface">Password updated</h1>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">Your password has been changed. Sign in with your new password to continue.</p>
            <Link to="/sign-in" className={`${buttonClassName} mt-8`}><span>Return to sign in</span><ContinueArrow /></Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-base font-semibold text-on-surface">
              {step === 'email' ? 'Reset your password' : step === 'code' ? 'Check your email' : 'Choose a new password'}
            </h1>
            <p className="mt-2 text-center text-sm leading-5 text-on-surface-variant">
              {step === 'email' && 'Enter the email address associated with your account.'}
              {step === 'code' && `Enter the reset code sent to ${email}.`}
              {step === 'password' && 'Your email is verified. Choose a new password for your account.'}
            </p>

            {notice && <p role="status" className="mt-5 text-center text-sm leading-5 text-on-surface-variant">{notice}</p>}
            {error && <p role="alert" className="mt-4 text-center text-sm leading-5 text-rose-600">{error}</p>}

            {step === 'email' && (
              <form className="mt-8 space-y-6" onSubmit={(event) => void handleRequestCode(event)}>
                <label className="block text-sm font-medium text-on-surface" htmlFor="reset-email">
                  Email address
                  <input id="reset-email" className={inputClassName} type="email" autoComplete="email" placeholder="Enter your email address" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <button className={buttonClassName} type="submit" disabled={busy}><span>{busy ? 'Sending…' : 'Send reset code'}</span><ContinueArrow /></button>
              </form>
            )}

            {step === 'code' && (
              <form className="mt-8 space-y-6" onSubmit={(event) => void handleVerifyCode(event)}>
                <label className="block text-sm font-medium text-on-surface" htmlFor="reset-code">
                  Email code
                  <input id="reset-code" className={inputClassName} type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter your email code" required value={code} onChange={(event) => setCode(event.target.value)} />
                </label>
                <button className={buttonClassName} type="submit" disabled={busy}><span>{busy ? 'Verifying…' : 'Verify code'}</span><ContinueArrow /></button>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
                  <button className="font-semibold text-on-surface-variant hover:text-on-surface" type="button" onClick={changeEmail}>Use a different email</button>
                  <button className="font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-50" type="button" disabled={busy} onClick={() => void handleResendCode()}>Resend code</button>
                </div>
              </form>
            )}

            {step === 'password' && (
              <form className="mt-8 space-y-6" onSubmit={(event) => void handleSetPassword(event)}>
                <label className="block text-sm font-medium text-on-surface" htmlFor="new-password">
                  New password
                  <input id="new-password" className={inputClassName} type="password" autoComplete="new-password" placeholder="Enter a new password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <label className="block text-sm font-medium text-on-surface" htmlFor="confirm-new-password">
                  Confirm new password
                  <input id="confirm-new-password" className={inputClassName} type="password" autoComplete="new-password" placeholder="Confirm your new password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </label>
                <button className={buttonClassName} type="submit" disabled={busy}><span>{busy ? 'Updating…' : 'Update password'}</span><ContinueArrow /></button>
              </form>
            )}
          </>
        )}

          <div className="mt-8 text-center">
            <p className="text-xs text-on-surface-variant">Secured by <span className="font-semibold">Clerk</span></p>
            <p className="mt-5 text-sm text-on-surface-variant">
            <Link to="/sign-in" className="font-semibold text-on-surface hover:underline">Back to sign in</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function ResetPasswordPage() {
  const { error, isLoaded, isSignedIn } = useAppAuth()

  if (isLoaded && isSignedIn) return <Navigate to="/admin" replace />

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-start justify-center bg-surface px-5 pb-10 pt-20">
        <section className="ddc-sign-in w-full max-w-sm">
          <img src={logo} alt="Davao DeFi Community" className="mx-auto mb-8 h-10 w-auto" />
          <SkeletonResetPassword label="Loading password reset" />
        </section>
      </main>
    )
  }

  if (error?.reason === 'clerk_publishable_key_missing') {
    return <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10"><p role="status" className="max-w-md rounded-2xl border border-outline bg-surface-lowest p-8 text-center text-sm leading-6 text-on-surface-variant">{error.message}</p></main>
  }

  return <ResetPasswordFlow />
}
