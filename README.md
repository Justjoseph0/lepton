# Inkpay

Pay-per-article monetization for Ghost blogs — powered by Circle Nanopayments on Arc.

Built for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) (Canteen × Circle, June 15–29 2026).

## What it does

Ghost blog owners add a single `<script>` tag to their theme. Readers see the first paragraph free, then hit a paywall priced by an AI agent. They pay in USDC — as little as $0.001 — using Circle's Nanopayments infrastructure on Arc. The article unlocks instantly, gas-free.

## How the AI agent works

The pricing agent (powered by Claude API) reads each article's URL, title, word count, and excerpt, then decides a price based on length, topic depth, and estimated reader value. It makes a genuine decision per article — not a fixed rule.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Payments | Circle Nanopayments, x402 protocol, Circle Gateway |
| AI agent | Anthropic Claude API (`claude-sonnet-4-6`) |
| Blockchain | Arc testnet |
| Ghost embed | Vanilla JS (`embed/inkpay.js`) |

## Project structure

```
├── src/
│   ├── components/       UI components
│   ├── lib/
│   │   ├── circle.js     Circle wallet + signing helpers (frontend)
│   │   ├── agent.js      Pricing agent API wrapper (frontend)
│   │   └── payments.js   x402 payment flow helpers (frontend)
│   └── pages/
│       ├── Landing.jsx   Creator landing / marketing page
│       └── Dashboard.jsx Creator earnings dashboard
├── server/
│   ├── index.js          Express entry point
│   └── routes/
│       ├── articles.js   POST /api/articles/price  (Claude pricing agent)
│       └── payments.js   POST /api/payments/verify (Circle Gateway)
└── embed/
    └── inkpay.js         Self-contained Ghost blog paywall script
```

## Setup

```bash
cp .env.example .env
# Fill in CIRCLE_API_KEY, ANTHROPIC_API_KEY, ARC_RPC_URL

npm install
```

## Run

```bash
# Frontend (http://localhost:5173)
npm run dev

# Backend (http://localhost:3001)
npm run server
```

## Ghost integration

Paste into your Ghost admin → Settings → Code Injection → Site Footer:

```html
<script
  src="https://your-inkpay-domain.com/embed/inkpay.js"
  data-creator="0xYOUR_WALLET_ADDRESS">
</script>
```

That's it. Every article page will be paywalled automatically. The AI agent prices each one independently.

## Hackathon context

- **30% Agentic sophistication** — Claude API makes real per-article pricing decisions
- **30% Traction** — readers can make real test USDC payments on Arc testnet
- **20% Circle tool usage** — Nanopayments, Gateway, x402 protocol, Agent Wallets
- **20% Innovation** — first pay-per-article layer built specifically for Ghost
