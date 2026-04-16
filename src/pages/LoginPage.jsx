import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login, signup, loginWithGoogle, ALLOWED_DOMAIN, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [resetLoading, setResetLoading] = useState(false)

  const update = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function handleResetPassword(e) {
    e.preventDefault()
    if (!form.email) return toast.error('Please enter your college email.')
    setResetLoading(true)
    try {
      await resetPassword(form.email)
      toast.success('Password reset email sent! Check your inbox.', { duration: 6000 })
      setTab('login')
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(form.email, form.password)
        toast.success('Welcome back!')
        navigate('/')
      } else {
        if (!form.name.trim()) throw new Error('Please enter your full name.')
        await signup(form.email, form.password, form.name.trim())
        toast.success('Account created! Please check your college email inbox to verify your account before logging in.', { duration: 6000 })
        setTab('login')
        setForm({ ...form, password: '' })
      }
    } catch (err) {
      const code = err.code || err.message
      const friendlyMessages = {
        'auth/email-unverified':    'Please verify your email address. Check your inbox for the verification link.',
        'auth/invalid-credential':  'No account found with these credentials. Please Sign Up first or check your password.',
        'auth/user-not-found':      'No account found with this email. Use Sign Up to create one.',
        'auth/wrong-password':      'Incorrect password. Please try again.',
        'auth/email-already-in-use':'An account already exists with this email. Try Sign In instead.',
        'auth/weak-password':       'Password must be at least 6 characters.',
        'auth/invalid-email':       'Please enter a valid email address.',
        'auth/too-many-requests':   'Too many attempts. Please wait a few minutes and try again.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
      }
      toast.error(friendlyMessages[code] || err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      toast.success('Signed in with Google!')
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  if (tab === 'reset') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">🔐</div>
            <h1>Reset Password</h1>
            <p>Enter your college email to receive a reset link.</p>
          </div>
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label>College Email</label>
              <input
                name="email" type="email" value={form.email} onChange={update}
                placeholder={`you${ALLOWED_DOMAIN}`} required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={resetLoading}>
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" className="btn btn-ghost w-full" onClick={() => setTab('login')}>
              Back to Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Header */}
        <div className="auth-header">
          <div className="auth-icon">📍</div>
          <h1>TraceBack</h1>
          <p>Campus Lost &amp; Found — College accounts only</p>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="btn-google"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? 'Signing in…' : `Continue with Google (${ALLOWED_DOMAIN})`}
        </button>

        {/* Divider */}
        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        {/* Email/Password tabs */}
        <div className="tab-row">
          <button type="button" className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
          <button type="button" className={`tab-btn ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'signup' && (
            <div className="form-group">
              <label>Full Name</label>
              <input name="name" value={form.name} onChange={update} placeholder="Your full name" required />
            </div>
          )}
          <div className="form-group">
            <label>College Email</label>
            <input
              name="email" type="email" value={form.email} onChange={update}
              placeholder={`you${ALLOWED_DOMAIN}`} required
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Password</label>
              {tab === 'login' && (
                <button type="button" className="text-link" onClick={() => setTab('reset')} style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                  Forgot password?
                </button>
              )}
            </div>
            <input
              name="password" type="password" value={form.password}
              onChange={update} placeholder="••••••••" minLength={6} required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-note">🔒 Only {ALLOWED_DOMAIN} accounts are accepted.</p>
      </div>
    </div>
  )
}
