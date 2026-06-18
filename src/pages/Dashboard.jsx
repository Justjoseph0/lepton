export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="px-8 py-4 flex justify-between items-center border-b border-gray-800">
        <span className="text-xl font-bold text-indigo-400">Inkpay</span>
        <span className="text-sm text-gray-400">Creator Dashboard</span>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400 mb-10">Track your earnings and article performance.</p>

        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Earned', value: '$0.000 USDC' },
            { label: 'Articles Paywalled', value: '0' },
            { label: 'Transactions', value: '0' },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold mb-4">Connect your Ghost blog</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your blog URL and we'll analyze your articles and generate a script tag.
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://yourblog.ghost.io"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button className="px-5 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-500 transition">
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
