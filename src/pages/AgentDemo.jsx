import { useState } from 'react'
import { priceArticle } from '../lib/agent.js'

const DEPTH_LABELS = {
  surface:      { label: 'Surface',      color: 'text-gray-400 bg-gray-800' },
  overview:     { label: 'Overview',     color: 'text-blue-300 bg-blue-900/40' },
  substantive:  { label: 'Substantive',  color: 'text-indigo-300 bg-indigo-900/40' },
  deep_dive:    { label: 'Deep Dive',    color: 'text-violet-300 bg-violet-900/40' },
  exceptional:  { label: 'Exceptional',  color: 'text-amber-300 bg-amber-900/40' },
}

const PLACEHOLDER_ARTICLE = `The Quiet Death of the Subscription Bundle

Every major streaming platform launched in the same two-year window with the same pitch: one low monthly price, unlimited access. The bet was that habits formed during growth would stick when prices rose. They haven't.

Netflix lost 200,000 subscribers in Q1 2022 — the first decline in a decade — before clawing back with ad tiers and password sharing crackdowns. Disney+ missed subscriber targets for five consecutive quarters. The pattern is consistent: acquisition is cheap, retention is expensive, and the subscriber who joined for one show leaves when that show ends.

The math underneath the bundle model has always been fragile. You need enough subscribers who consume little to subsidize the ones who consume a lot. As content catalogs fragment across competing platforms, the low-consumption subscriber has more platforms to choose from and lower loyalty to any of them.

What's emerging instead isn't a bundle killer — it's a bundle supplement. Readers, listeners, and viewers increasingly want to pay for the specific thing they want right now, without a long-term commitment. The infrastructure to support that at scale has historically been missing. Settlement fees ate the margin on $0.50 transactions; $0.001 transactions were mathematically impossible.

That constraint is dissolving. When the per-transaction cost approaches zero and settlement happens in milliseconds, the economic case for forced bundling weakens significantly. A reader who would never pay $12/month for a publication might pay $0.003 to read one essay that showed up in their feed. That's not a hypothetical — it's a different kind of customer entirely, one the current model leaves on the table.`

function ConfidenceBar({ score }) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.8 ? 'bg-emerald-500' :
    score >= 0.6 ? 'bg-indigo-500' :
    'bg-amber-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono text-gray-400 w-10 text-right">{pct}%</span>
    </div>
  )
}

function ResultCard({ result }) {
  const depth = DEPTH_LABELS[result.depthLevel] ?? DEPTH_LABELS.overview
  const priceFormatted = result.price < 0.01
    ? `$${result.price.toFixed(4)}`
    : `$${result.price.toFixed(3)}`

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Price banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-8 py-6">
        <p className="text-indigo-200 text-sm font-medium mb-1">Agent's price decision</p>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold text-white tabular-nums">{priceFormatted}</span>
          <span className="text-indigo-300 text-lg mb-1">USDC</span>
        </div>
        <p className="text-indigo-200 text-xs mt-1 font-mono">
          {result.priceInAtomicUnits.toLocaleString()} atomic units · 6 decimals
        </p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Meta row */}
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
            {result.category}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border border-transparent ${depth.color}`}>
            {depth.label}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
            {result.wordCount} words
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
            {result.readingTime} read
          </span>
        </div>

        {/* Reasoning */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reasoning</p>
          <p className="text-gray-200 leading-relaxed">{result.reasoning}</p>
        </div>

        {/* Reader value */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reader value</p>
          <p className="text-gray-300 text-sm italic">"{result.readerValue}"</p>
        </div>

        {/* Confidence */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Agent confidence</p>
          <ConfidenceBar score={result.confidenceScore} />
        </div>

        {/* Article ID */}
        {result.articleId && (
          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Article ID</p>
              {result.priceStored
                ? <span className="text-xs text-emerald-400 font-medium">price stored</span>
                : <span className="text-xs text-amber-400 font-medium">not stored</span>}
            </div>
            <p className="text-xs font-mono bg-gray-800 rounded-lg px-3 py-2 text-indigo-300 break-all select-all cursor-text">
              {result.articleId}
            </p>
            <p className="text-xs text-gray-600 mt-1">Select and copy to test the unlock endpoint.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentDemo() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState(PLACEHOLDER_ARTICLE)
  const [blogUrl, setBlogUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handlePrice() {
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const slug = title.trim()
        ? title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : 'article'
      const articleId = `${slug}-${Date.now().toString(36)}`
      const data = await priceArticle({
        articleId,
        articleTitle: title || undefined,
        articleContent: content,
        blogUrl: blogUrl || undefined,
      })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="px-8 py-4 flex items-center gap-4 border-b border-gray-800">
        <a href="/" className="text-xl font-bold text-indigo-400">Inkpay</a>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">AI Pricing Agent</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Pricing Agent</h1>
          <p className="text-gray-400">
            Paste any article. The agent analyzes topic, depth, and reader value — then sets a price.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Input panel */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Article title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave blank to detect from content"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm
                  text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Blog URL (optional)
              </label>
              <input
                type="url"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
                placeholder="https://yourblog.ghost.io"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm
                  text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Article content
                </label>
                <span className="text-xs text-gray-600">
                  {content.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                placeholder="Paste the full article text here..."
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm
                  text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500
                  transition resize-none leading-relaxed font-mono"
              />
            </div>

            <button
              onClick={handlePrice}
              disabled={loading || !content.trim()}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                ${loading || !content.trim()
                  ? 'bg-indigo-900/50 text-indigo-600 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white shadow-lg shadow-indigo-900/30'}
              `}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Agent is analyzing…
                </span>
              ) : 'Price This Article'}
            </button>

            {error && (
              <div className="bg-red-950/50 border border-red-900/50 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Result panel */}
          <div>
            {result ? (
              <ResultCard result={result} />
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-8 py-12 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-900/40 flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                </div>
                <p className="text-gray-300 font-medium">No pricing decision yet</p>
                <p className="text-gray-600 text-sm max-w-xs">
                  Paste article content on the left and click "Price This Article". A demo article is pre-loaded.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
