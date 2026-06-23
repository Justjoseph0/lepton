import { useState, useEffect } from 'react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function fmtPrice(n) {
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1)    return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

// ─── Data layer ───────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

function timeAgo(ts) {
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function useDashboardData() {
  const [state, setState] = useState({
    loading: true,
    error:   null,
    wallet:  '',
    stats:   { totalEarnings: 0, totalUnlocked: 0, avgPrice: 0, activeReaders: 0 },
    transactions: [],
    articles:     [],
  })

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard/stats`)
      .then(r => {
        if (!r.ok) throw new Error(`Dashboard API returned ${r.status}`)
        return r.json()
      })
      .then(data => {
        setState({
          loading: false,
          error:   null,
          wallet:  data.wallet,
          stats:   data.stats,
          transactions: data.transactions.map(tx => ({
            id:         tx.settlementId || `${tx.articleId}-${tx.timestamp}`,
            article:    tx.articleId,
            price:      tx.price,
            payer:      tx.payer,
            settlement: tx.settlementId,
            time:       timeAgo(tx.timestamp),
          })),
          articles: data.articles.map(a => ({
            id:       a.id,
            title:    a.id,
            category: 'other',
            price:    a.price,
            unlocks:  a.unlocks,
          })),
        })
      })
      .catch(err => setState(s => ({ ...s, loading: false, error: err.message })))
  }, [])

  return state
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
      <div className="px-6 py-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function ScriptTag({ wallet }) {
  const [copied, setCopied] = useState(false)
  const tag = `<script src="https://inkpay.app/embed/inkpay.js" data-seller="${wallet}"></script>`

  function handleCopy() {
    navigator.clipboard.writeText(tag)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-sm font-semibold text-white">Ghost Embed Script</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Paste into your Ghost theme → Settings → Code Injection → Site Footer
            </p>
          </div>
          <button
            onClick={handleCopy}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="bg-gray-950 border border-gray-700/60 rounded-xl px-4 py-3 overflow-x-auto">
          <code className="text-xs font-mono text-indigo-300 whitespace-nowrap">{tag}</code>
        </div>
      </div>
    </div>
  )
}

const CATEGORY_COLORS = {
  crypto:   'text-amber-300   bg-amber-900/40   border-amber-800/50',
  finance:  'text-emerald-300 bg-emerald-900/40 border-emerald-800/50',
  tech:     'text-blue-300    bg-blue-900/40    border-blue-800/50',
  business: 'text-violet-300  bg-violet-900/40  border-violet-800/50',
  tutorial: 'text-indigo-300  bg-indigo-900/40  border-indigo-800/50',
  research: 'text-rose-300    bg-rose-900/40    border-rose-800/50',
  other:    'text-gray-300    bg-gray-800       border-gray-700',
}

function CategoryBadge({ category }) {
  const cls = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {category}
    </span>
  )
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
      {children}
    </h2>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { loading, error, wallet, stats, transactions, articles } = useDashboardData()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="px-8 py-4 flex items-center justify-between border-b border-gray-800">
        <a href="/" className="text-xl font-bold text-indigo-400">Inkpay</a>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-sm text-gray-300">{truncate(wallet)}</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Your Inkpay Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Earnings, integrations, and article performance for {truncate(wallet)}
          </p>
        </div>

        {loading && (
          <div className="text-center py-20 text-gray-500">Loading…</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Earnings"
                value={`${stats.totalEarnings.toFixed(3)} USDC`}
                sub="All time"
              />
              <StatCard
                label="Articles Unlocked"
                value={stats.totalUnlocked.toLocaleString()}
                sub="Total paid reads"
              />
              <StatCard
                label="Avg Price"
                value={fmtPrice(stats.avgPrice)}
                sub="Per article unlock"
              />
              <StatCard
                label="Active Readers"
                value={stats.activeReaders.toLocaleString()}
                sub="Unique payer addresses"
              />
            </div>

            {/* Script tag generator */}
            <ScriptTag wallet={wallet} />

            {/* Recent transactions */}
            <section>
              <SectionHeading>Recent Transactions</SectionHeading>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Article
                        </th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Payer
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Settlement ID
                        </th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, i) => (
                        <tr
                          key={tx.id}
                          className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/30 ${
                            i % 2 === 1 ? 'bg-gray-900/40' : ''
                          }`}
                        >
                          <td className="px-6 py-3 text-gray-200 max-w-[260px] truncate">
                            {tx.article}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-indigo-300 font-medium tabular-nums">
                            {fmtPrice(tx.price)}
                          </td>
                          <td className="px-6 py-3 font-mono text-gray-400 text-xs">
                            {truncate(tx.payer)}
                          </td>
                          <td className="px-6 py-3 font-mono text-gray-500 text-xs">
                            {tx.settlement}
                          </td>
                          <td className="px-6 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                            {tx.time}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* AI-priced articles */}
            <section>
              <SectionHeading>AI-Priced Articles</SectionHeading>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          AI Price
                        </th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Unlocks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.map((a, i) => (
                        <tr
                          key={a.id}
                          className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/30 ${
                            i % 2 === 1 ? 'bg-gray-900/40' : ''
                          }`}
                        >
                          <td className="px-6 py-3 text-gray-200 max-w-[360px] truncate">
                            {a.title}
                          </td>
                          <td className="px-6 py-3">
                            <CategoryBadge category={a.category} />
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-indigo-300 font-medium tabular-nums">
                            {fmtPrice(a.price)}
                          </td>
                          <td className="px-6 py-3 text-right text-gray-300 tabular-nums">
                            {a.unlocks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
