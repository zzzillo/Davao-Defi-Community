import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAppAuth } from '../../auth/useAppAuth'
import SignInPage from './SignIn'
import ResetPasswordPage from './ResetPassword'

const mocks = vi.hoisted(() => ({
  signIn: {
    create: vi.fn(),
    resetPasswordEmailCode: {
      sendCode: vi.fn(),
      verifyCode: vi.fn(),
      submitPassword: vi.fn(),
    },
  },
}))

vi.mock('@clerk/react', () => ({
  SignIn: () => <div>Clerk sign-in</div>,
  useSignIn: () => ({ signIn: mocks.signIn }),
}))
vi.mock('../../auth/useAppAuth', () => ({ useAppAuth: vi.fn() }))

function renderAuthRoute(initialEntry = '/reset-password') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAppAuth).mockReturnValue({
    appUser: null,
    loading: false,
    error: null,
    isLoaded: true,
    isSignedIn: false,
    getToken: async () => null,
    refreshUser: async () => undefined,
    signOut: async () => undefined,
  })
  mocks.signIn.create.mockResolvedValue({ error: null })
  mocks.signIn.resetPasswordEmailCode.sendCode.mockResolvedValue({ error: null })
  mocks.signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue({ error: null })
  mocks.signIn.resetPasswordEmailCode.submitPassword.mockResolvedValue({ error: null })
})

afterEach(() => cleanup())

describe('password recovery', () => {
  it('links to recovery from sign-in and completes Clerk email-code recovery', async () => {
    renderAuthRoute('/sign-in')
    expect(screen.getByRole('link', { name: 'Reset it' }).getAttribute('href')).toBe('/reset-password')

    fireEvent.click(screen.getByRole('link', { name: 'Reset it' }))
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect((await screen.findByRole('status')).textContent).toContain('If an account exists for that email, a reset code has been sent.')
    expect(mocks.signIn.create).toHaveBeenCalledWith({ identifier: 'member@example.com' })
    expect(mocks.signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalledOnce()

    fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
    expect(await screen.findByLabelText('New password')).toBeDefined()
    expect(mocks.signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({ code: '123456' })

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-long-password' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-long-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeDefined()
    expect(mocks.signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({ password: 'new-long-password' })
    expect(screen.getByRole('link', { name: 'Return to sign in' }).getAttribute('href')).toBe('/sign-in')
  })

  it('does not disclose whether an email is registered when a code request fails', async () => {
    mocks.signIn.create.mockResolvedValue({ error: { code: 'form_identifier_not_found' } })
    renderAuthRoute()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'unknown@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect((await screen.findByRole('status')).textContent).toContain('If an account exists for that email, a reset code has been sent.')
    expect(screen.queryByText(/not found|does not exist/i)).toBeNull()
    expect(mocks.signIn.resetPasswordEmailCode.sendCode).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email code')).toBeDefined()
  })

  it('shows a generic error for invalid or expired codes', async () => {
    mocks.signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue({ error: { code: 'verification_expired' } })
    renderAuthRoute()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))
    await screen.findByLabelText('Email code')
    fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))

    expect((await screen.findByRole('alert')).textContent).toContain('That code could not be verified. Check it or request a new one.')
    expect(screen.queryByLabelText('New password')).toBeNull()
    await waitFor(() => expect(mocks.signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledOnce())
  })

  it('rejects mismatched passwords before calling Clerk', async () => {
    renderAuthRoute()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }))
    await screen.findByLabelText('Email code')
    fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
    await screen.findByLabelText('New password')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'one-password' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'another-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The passwords do not match.')
    expect(mocks.signIn.resetPasswordEmailCode.submitPassword).not.toHaveBeenCalled()
  })
})
