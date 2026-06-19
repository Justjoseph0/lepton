import { useState } from 'react'

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
// Swap useDashboardData() for a real hook when the API is ready.
// The return shape (stats, transactions, articles, wallet, loading, error)
// is the contract — internals can change freely.

const MOCK_WALLET = '0x4e03d7a2F81bB8C91E4432f6D3a87C301a9c2f0'

function useDashboardData() {
  return {
    loading: false,
    error: null,
    wallet: MOCK_WALLET,
    stats: {
      totalEarnings: 2.847,
      totalUnlocked: 312,
      avgPrice: 0.00912,
      activeReaders: 87,
    },
    transactions: [
      { id: '1',  article: 'The Arc Blockchain Opportunity Nobody Is Talking About', price: 0.012, payer: '0xA1b2C3d4E5f61234', settlement: 'stl_8kJq2Pm', time: '2 min ago' },
      { id: '2',  article: 'The Quiet Death of the Subscription Bundle',              price: 0.008, payer: '0xB3c4D5e6F7a08765', settlement: 'stl_3pRz9Xn', time: '14 min ago' },
      { id: '3',  article: 'Why DeFi Needs Better UX Before It Can Scale',            price: 0.015, payer: '0xC5d6E7f8A9b1cdef', settlement: 'stl_7mKv4Yq', time: '31 min ago' },
      { id: '4',  article: "Ghost vs WordPress in 2025: A Creator's Honest Take",     price: 0.004, payer: '0xD7e8F9a0B2c3defa', settlement: 'stl_1nLw5Zr', time: '1 hr ago' },
      { id: '5',  article: 'The Arc Blockchain Opportunity Nobody Is Talking About',  price: 0.012, payer: '0xE9f0A1b2C4d5ef01', settlement: 'stl_6oMx6As', time: '1 hr ago' },
      { id: '6',  article: 'Micropayments: Why Every Previous Attempt Failed',        price: 0.020, payer: '0xF1a2B3c4D6e7f012', settlement: 'stl_2pNy7Bt', time: '2 hr ago' },
      { id: '7',  article: 'The Quiet Death of the Subscription Bundle',              price: 0.008, payer: '0xA3b4C5d6E8f9a123', settlement: 'stl_9qOz8Cu', time: '3 hr ago' },
      { id: '8',  article: "Building on Arc: A Developer's First 30 Days",            price: 0.025, payer: '0xB5c6D7e8F0a1b234', settlement: 'stl_4rPa9Dv', time: '4 hr ago' },
      { id: '9',  article: "Ghost vs WordPress in 2025: A Creator's Honest Take",     price: 0.004, payer: '0xC7d8E9f0A2b3c345', settlement: 'stl_5sQb0Ew', time: '5 hr ago' },
      { id: '10', article: 'Why DeFi Needs Better UX Before It Can Scale',            price: 0.015, payer: '0xD9e0F1a2B4c5d456', settlement: 'stl_0tRc1Fx', time: '6 hr ago' },
    ],
    articles: [
      { id: 'a1', title: 'The Arc Blockchain Opportunity Nobody Is Talking About', price: 0.012, category: 'crypto',   unlocks: 48 },
      { id: 'a2', title: 'The Quiet Death of the Subscription Bundle',             price: 0.008, category: 'business', unlocks: 71 },
      { id: 'a3', title: 'Why DeFi Needs Better UX Before It Can Scale',           price: 0.015, category: 'finance',  unlocks: 34 },
      { id: 'a4', title: "Ghost vs WordPress in 2025: A Creator's Honest Take",    price: 0.004, category: 'tech',     unlocks: 93 },
      { id: 'a5', title: 'Micropayments: Why Every Previous Attempt Failed',       price: 0.020, category: 'finance',  unlocks: 29 },
      { id: 'a6', title: "Building on Arc: A Developer's First 30 Days",           price: 0.025, category: 'tutorial', unlocks: 37 },
    ],
  }
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
