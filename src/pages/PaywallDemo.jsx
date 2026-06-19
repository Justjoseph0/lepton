import { useState } from 'react'
import Paywall from '../components/Paywall.jsx'

const DEMO_ARTICLE = {
  id: 'the-arc-blockchain-opportunity',
  title: 'The Arc Blockchain Opportunity Nobody Is Talking About',
  author: 'Maya Chen',
  date: 'June 18, 2026',
  readTime: '6 min read',
  preview:
    'For the last decade, micropayments have been the perpetual "just around the corner" promise of the internet. Every few years a new protocol arrives claiming to finally make $0.001 transactions viable, and every few years the economics of gas fees and settlement latency quietly kill the idea before it reaches production. Arc changes the math — and I don\'t think most people have noticed yet.',
  fullContent: [
    'The core insight is deceptively simple: if you batch enough signed payment authorizations off-chain and settle them as a single transaction, the per-payment cost approaches zero. Circle\'s Gateway does exactly this. A thousand readers each paying $0.001 to unlock an article become one onchain transaction for $1.00, with the individual attribution tracked in Circle\'s infrastructure.',
    'What this unlocks for content creators is genuinely new territory. Ghost powers over 54,000 independent publications. Not one of them has a native per-article payment option — the choice has always been "free forever" or "monthly subscription." That gap is where Inkpay lives.',
    'The AI pricing layer is the piece I find most interesting. Asking a creator to manually set a price for every article they publish is a UX dead end — it creates friction, and most creators have no reference point for what a $0.003 article should contain versus a $0.02 one. An agent that reads the article and prices it based on length, depth, and topic removes that friction entirely.',
    'Early signals from our Arc testnet testing suggest the payment loop completes in under 500 milliseconds end-to-end. For a reader, that\'s the difference between a payment feeling like a tap and a payment feeling like waiting. That latency number matters more than people realize.',
    'The distribution question remains open. Independent blogs have notoriously high bounce rates — most readers arrive from search or social and leave immediately. The per-article model is a bet that even a reader who bounces will commit $0.001 before they go. The jury is still out, but the economics of trying are now real in a way they weren\'t before Arc.',
  ],
}

const PRICES = [0.001, 0.005, 0.02, 0.05]

export default function PaywallDemo() {
  const [price, setPrice] = useState(0.001)
  const [key, setKey] = useState(0)

  function handlePriceChange(p) {
    setPrice(p)
    setKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dev toolbar */}
      <div className="sticky top-0 z-10 bg-indigo-600 text-white px-6 py-2 flex items-center gap-4 text-sm shadow">
        <span className="font-semibold text-indigo-100">Inkpay</span>
        <span className="text-indigo-300">/ Paywall Demo</span>
        <span className="text-indigo-400 text-xs hidden sm:block">
          Requires MetaMask + Arc Testnet + testnet USDC
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-indigo-200 text-xs">Test price:</span>
          {PRICES.map((p) => (
            <button
              key={p}
              onClick={() => handlePriceChange(p)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition
                ${price === p
                  ? 'bg-white text-indigo-700'
                  : 'bg-indigo-500 hover:bg-indigo-400 text-white'}`}
            >
              ${p}
            </button>
          ))}
        </div>
      </div>

      {/* Mock Ghost blog post layout */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider mb-4">
            <span>Technology</span>
            <span>·</span>
            <span>{DEMO_ARTICLE.readTime}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
            {DEMO_ARTICLE.title}
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
              {DEMO_ARTICLE.author[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{DEMO_ARTICLE.author}</p>
              <p className="text-xs text-gray-400">{DEMO_ARTICLE.date}</p>
            </div>
          </div>
        </header>

        <hr className="border-gray-100 mb-8" />

        {/* Real payment flow — requires MetaMask on Arc Testnet */}
        <Paywall
          key={key}
          articleId={DEMO_ARTICLE.id}
          price={price}
          articlePreview={DEMO_ARTICLE.preview}
        >
          <div className="space-y-5">
            {DEMO_ARTICLE.fullContent.map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed">{para}</p>
            ))}
          </div>
        </Paywall>
      </div>
    </div>
  )
}
