import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export default function WalletOnboarding() {
  const navigate = useNavigate()
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadCreator() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        })

        if (res.status === 401) {
          navigate('/auth', { replace: true })
          return
        }
        if (!res.ok) {
          throw new Error(`Auth check failed with ${res.status}`)
        }

        const data = await res.json()
        if (data.creator?.wallet_address) {
          navigate('/dashboard', { replace: true })
          return
        }

        if (!cancelled) {
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not check your session')
          setLoading(false)
        }
      }
    }

    loadCreator()

    return () => {
      cancelled = true
    }
  }, [navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = walletAddress.trim()

    if (!ETH_ADDRESS_RE.test(trimmed)) {
      setError('Enter a valid Ethereum address')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/wallet', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: trimmed }),
      })

      if (res.status === 401) {
        navigate('/auth', { replace: true })
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Wallet save failed with ${res.status}`)
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not save wallet address')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white grid place-items-center px-4">
        <p className="text-sm text-gray-400">Checking your session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white grid place-items-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-xl"
      >
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
            Creator setup
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            Add your wallet address to receive payments
          </h1>
        </div>

        <label htmlFor="wallet_address" className="block text-sm font-medium text-gray-300">
          Ethereum wallet address
        </label>
        <input
          id="wallet_address"
          name="wallet_address"
          value={walletAddress}
          onChange={event => setWalletAddress(event.target.value)}
          placeholder="0x..."
          autoComplete="off"
          spellCheck="false"
          className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
        />

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save wallet and continue'}
        </button>
      </form>
    </div>
  )
}
