import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
    const body =
      mode === 'signup'
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Request failed with ${res.status}`)
      }

      if (data.needsWallet) {
        navigate('/onboarding/wallet', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white grid place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
            Inkpay for creators
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
        </div>

        <div className="mb-6 flex rounded-lg border border-gray-800 bg-gray-950 p-1">
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === 'signup'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Log In
          </button>
        </div>

        <a
          href="/api/auth/google"
          className="mb-5 flex w-full items-center justify-center rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:border-indigo-500 hover:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          Sign in with Google
        </a>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-800" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            or use email
          </span>
          <div className="h-px flex-1 bg-gray-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? mode === 'signup'
                ? 'Creating account...'
                : 'Logging in...'
              : mode === 'signup'
              ? 'Sign up'
              : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
