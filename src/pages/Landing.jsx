import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="px-8 py-4 flex justify-between items-center border-b border-gray-800">
        <span className="text-xl font-bold text-indigo-400">Inkpay</span>
        <Link
          to="/dashboard"
          className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-500 transition"
        >
          Get Started
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-indigo-400 text-sm font-semibold uppercase tracking-wider mb-4">
          Pay-per-article on Ghost blogs
        </p>
        <h1 className="text-5xl font-bold mb-6 leading-tight max-w-3xl">
          Monetize every word.<br />No subscriptions required.
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mb-10">
          Add one script tag to your Ghost blog. Readers pay as little as $0.001 USDC
          per article — powered by Circle Nanopayments on Arc.
        </p>
        <div className="flex gap-4">
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-indigo-600 rounded-xl font-semibold hover:bg-indigo-500 transition"
          >
            Start earning
          </Link>
          <a
            href="https://ghost.org"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-gray-700 rounded-xl font-semibold text-gray-300 hover:border-gray-500 transition"
          >
            What is Ghost?
          </a>
        </div>
      </main>

      <footer className="px-8 py-4 text-center text-gray-600 text-sm border-t border-gray-800">
        Built for Lepton Agents Hackathon &middot; Canteen &times; Circle &middot; Arc blockchain
      </footer>
    </div>
  )
}
