import { useState, useEffect } from 'react'
import { connectWallet, unlockArticle, checkGatewayBalance, depositToGateway } from '../lib/payments.js'

// Show "Top Up" UI when Gateway balance drops below this (atomic units, 6 decimals)
const DEPOSIT_THRESHOLD = 50_000n  // 0.05 USDC
const DEPOSIT_AMOUNT    = '0.5'    // 0.5 USDC per top-up (~500 articles at $0.001)

const STATES = {
  LOCKED:        'locked',        // initial — no wallet, or ready to unlock
  CHECKING:      'checking',      // reading GatewayWallet balance after connect
  NEEDS_DEPOSIT: 'needs_deposit', // balance < threshold
  DEPOSITING:    'depositing',    // approve + deposit txs in flight
  LOADING:       'loading',       // EIP-712 sign + Circle settle in flight
  SUCCESS:       'success',       // payment settled, animating
  UNLOCKED:      'unlocked',      // full article visible
}

function truncateAddress(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatPrice(price) {
  if (price < 0.01) return `$${price.toFixed(4)}`
  if (price < 1)    return `$${price.toFixed(3)}`
  return `$${price.toFixed(2)}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function LockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function WalletIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ArrowUpIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0-7 7m7-7 7 7" />
    </svg>
  )
}

function Spinner({ className }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ─── Paywall ──────────────────────────────────────────────────────────────────

export default function Paywall({ articlePreview, price, articleId, children }) {
  const [state,           setState]           = useState(STATES.LOCKED)
  const [walletAddress,   setWalletAddress]   = useState(null)
  const [walletConnecting, setWalletConnecting] = useState(false)
  const [depositStep,     setDepositStep]     = useState(null) // 'approving' | 'depositing'
  const [error,           setError]           = useState(null)

  // ─── Check Gateway balance whenever wallet connects ───────────────────────
  useEffect(() => {
    if (!walletAddress) return
    setState(STATES.CHECKING)
    setError(null)
    checkGatewayBalance(walletAddress)
      .then(balance => {
        setState(balance >= DEPOSIT_THRESHOLD ? STATES.LOCKED : STATES.NEEDS_DEPOSIT)
      })
      .catch(err => {
        console.warn('[paywall] balance check failed:', err.message)
        // Fail open — let the unlock attempt surface the real error
        setState(STATES.LOCKED)
      })
  }, [walletAddress])

  // ─── Auto-advance SUCCESS → UNLOCKED ────────────────────────────────────
  useEffect(() => {
    if (state !== STATES.SUCCESS) return
    const t = setTimeout(() => setState(STATES.UNLOCKED), 1400)
    return () => clearTimeout(t)
  }, [state])

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleConnectWallet() {
    setWalletConnecting(true)
    setError(null)
    try {
      const addr = await connectWallet()
      setWalletAddress(addr)
      // balance check fires via the useEffect above
    } catch (err) {
      setError(err.message)
    } finally {
      setWalletConnecting(false)
    }
  }

  async function handleDeposit() {
    setState(STATES.DEPOSITING)
    setDepositStep('approving')
    setError(null)
    try {
      await depositToGateway(DEPOSIT_AMOUNT, (step) => setDepositStep(step))
      setDepositStep(null)
      setState(STATES.LOCKED) // funded — ready to unlock
    } catch (err) {
      setError(err.message)
      setDepositStep(null)
      setState(STATES.NEEDS_DEPOSIT) // let user retry
    }
  }

  async function handleUnlock() {
    setState(STATES.LOADING)
    setError(null)
    try {
      await unlockArticle(articleId)
      setState(STATES.SUCCESS)
    } catch (err) {
      setError(err.message)
      setState(STATES.LOCKED)
    }
  }

  // ─── Fully unlocked ───────────────────────────────────────────────────────
  if (state === STATES.UNLOCKED) {
    return (
      <div>
        <p className="text-gray-700 leading-relaxed">{articlePreview}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    )
  }

  // Wallet address badge — reused across states
  const walletBadge = walletAddress && (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="text-xs font-mono text-emerald-700">{truncateAddress(walletAddress)}</span>
    </div>
  )

  return (
    <div className="font-sans">
      {/* Article preview with gradient fade */}
      <div className="relative">
        <p className="text-gray-700 leading-relaxed">{articlePreview}</p>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
        />
      </div>

      {/* Paywall card */}
      <div className="mt-6 rounded-2xl border border-indigo-100 bg-white shadow-sm shadow-indigo-50 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        <div className="px-8 py-8 flex flex-col items-center text-center gap-4">

          {/* ── Step 0: No wallet ─────────────────────────────────────────── */}
          {!walletAddress && (
            <>
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                <WalletIcon className="w-7 h-7" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-lg font-semibold text-gray-900">Connect a wallet to unlock</p>
                <p className="text-sm text-gray-400">MetaMask · Arc Testnet · Gas-free</p>
              </div>
              <button
                onClick={handleConnectWallet}
                disabled={walletConnecting}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm
                  transition-all duration-150 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                  ${walletConnecting
                    ? 'bg-indigo-400 cursor-not-allowed text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-sm'}`}
              >
                {walletConnecting
                  ? <><Spinner className="w-4 h-4" /> Connecting…</>
                  : 'Connect Wallet'}
              </button>
            </>
          )}

          {/* ── Checking Gateway balance ───────────────────────────────────── */}
          {walletAddress && state === STATES.CHECKING && (
            <>
              {walletBadge}
              <Spinner className="w-6 h-6 text-indigo-400" />
              <p className="text-sm text-gray-500">Checking your Gateway balance…</p>
            </>
          )}

          {/* ── Needs deposit ─────────────────────────────────────────────── */}
          {walletAddress && state === STATES.NEEDS_DEPOSIT && (
            <>
              {walletBadge}
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-50 text-amber-500">
                <ArrowUpIcon className="w-7 h-7" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-lg font-semibold text-gray-900">Top up your Gateway balance</p>
                <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                  Inkpay pays via Circle Gateway — deposit USDC once and unlock
                  articles without signing each time.{' '}
                  <span className="font-medium text-gray-700">{DEPOSIT_AMOUNT} USDC</span> covers
                  ~500 reads at $0.001.
                </p>
              </div>
              <button
                onClick={handleDeposit}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm
                  bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-sm
                  transition-all duration-150 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <ArrowUpIcon className="w-4 h-4" />
                Deposit {DEPOSIT_AMOUNT} USDC
              </button>
              <p className="text-xs text-gray-400">2 MetaMask confirmations · approve then deposit</p>
            </>
          )}

          {/* ── Deposit in progress ───────────────────────────────────────── */}
          {walletAddress && state === STATES.DEPOSITING && (
            <>
              {walletBadge}
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                <ArrowUpIcon className="w-7 h-7" />
              </div>

              <div className="flex flex-col items-center gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {depositStep === 'approving' ? 'Step 1 of 2 — Approve' : 'Step 2 of 2 — Deposit'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {depositStep === 'approving'
                      ? 'Allow Gateway Wallet to spend your USDC'
                      : 'Moving USDC into Gateway Wallet custody'}
                  </p>
                </div>

                {/* Progress pills */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    depositStep === 'approving'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {depositStep === 'approving' ? '● Approving…' : '✓ Approved'}
                  </span>
                  <span className="text-gray-300 text-xs">›</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    depositStep === 'depositing'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {depositStep === 'depositing' ? '● Depositing…' : '○ Deposit'}
                  </span>
                </div>
              </div>

              <Spinner className="w-5 h-5 text-indigo-400" />
              <p className="text-xs text-gray-400">Confirm the MetaMask popup to continue</p>
            </>
          )}

          {/* ── Payment settled ───────────────────────────────────────────── */}
          {walletAddress && state === STATES.SUCCESS && (
            <>
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-500">
                <CheckIcon className="w-7 h-7" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-lg font-semibold text-gray-900">Article unlocked</p>
                <p className="text-sm text-gray-400">Loading your content…</p>
              </div>
            </>
          )}

          {/* ── Ready to pay / paying ─────────────────────────────────────── */}
          {walletAddress && (state === STATES.LOCKED || state === STATES.LOADING) && (
            <>
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                <LockIcon className="w-7 h-7" />
              </div>
              {walletBadge}
              <div className="flex flex-col items-center gap-1">
                <p className="text-2xl font-bold text-gray-900 tabular-nums">
                  {formatPrice(price)}{' '}
                  <span className="text-base font-medium text-gray-400">USDC</span>
                </p>
                <p className="text-sm text-gray-500">to unlock the full article</p>
              </div>
              <button
                onClick={handleUnlock}
                disabled={state === STATES.LOADING}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm
                  transition-all duration-150 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                  ${state === STATES.LOADING
                    ? 'bg-indigo-400 cursor-not-allowed text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-sm'}`}
              >
                {state === STATES.LOADING
                  ? <><Spinner className="w-4 h-4" /> Processing…</>
                  : 'Unlock Article'}
              </button>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg max-w-sm">
              {error}
            </p>
          )}

          {/* Footer */}
          {state !== STATES.SUCCESS && (
            <p className="text-xs text-gray-300 pt-1">
              Powered by <span className="font-medium text-indigo-400">Inkpay</span>
              {' · '}Circle Nanopayments on Arc
            </p>
          )}

        </div>
      </div>
    </div>
  )
}
