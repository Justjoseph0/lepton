import { Router } from 'express'
import { GatewayClient } from '@circle-fin/x402-batching/client'
import { getAllPrices } from '../lib/articlePrices.js'
import { getAllTransactions, getStats } from '../lib/transactionLog.js'

const router = Router()

const GATEWAY_BALANCE_URL = 'https://gateway-api-testnet.circle.com/v1/balances'
const ARC_TESTNET_DOMAIN  = 26

function sanitizeError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  const pk  = process.env.SELLER_PRIVATE_KEY ?? ''
  return pk ? msg.replaceAll(pk, '[REDACTED]') : msg
}

async function fetchGatewayBalance(sellerAddress) {
  const res = await fetch(GATEWAY_BALANCE_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token:   'USDC',
      sources: [{ domain: ARC_TESTNET_DOMAIN, depositor: sellerAddress }],
    }),
  })
  if (!res.ok) throw new Error(`Gateway balance API returned ${res.status}`)
  const data = await res.json()
  return data.balances?.find(b => b.domain === ARC_TESTNET_DOMAIN)?.balance ?? '0'
}

// GET /api/dashboard/stats
router.get('/stats', (_req, res) => {
  const allTx = getAllTransactions()

  const unlockCounts = {}
  for (const tx of allTx) {
    unlockCounts[tx.articleId] = (unlockCounts[tx.articleId] || 0) + 1
  }

  const articles = getAllPrices().map(({ id, price }) => ({
    id,
    price,
    unlocks: unlockCounts[id] || 0,
  }))

  res.json({
    wallet:       process.env.SELLER_ADDRESS || '',
    stats:        getStats(),
    transactions: allTx.slice(0, 10),
    articles,
  })
})

// POST /api/dashboard/withdraw
// Body (all optional): { amount?: string }
// Withdraws from the seller's Gateway balance on Arc Testnet to their wallet.
router.post('/withdraw', async (req, res) => {
  const privateKey    = process.env.SELLER_PRIVATE_KEY
  const sellerAddress = process.env.SELLER_ADDRESS

  if (!privateKey) {
    return res.status(500).json({ error: 'SELLER_PRIVATE_KEY is not configured on the server' })
  }
  if (!sellerAddress) {
    return res.status(500).json({ error: 'SELLER_ADDRESS is not configured on the server' })
  }

  try {
    // Resolve withdrawal amount: use provided amount or fetch full available balance
    let { amount } = req.body ?? {}

    if (!amount) {
      const available = await fetchGatewayBalance(sellerAddress)
      if (!available || Number(available) === 0) {
        return res.status(400).json({ error: 'No Gateway balance available to withdraw' })
      }
      amount = available
    }

    const gateway = new GatewayClient({
      chain:      'arcTestnet',
      privateKey,
    })

    const result = await gateway.withdraw(amount, { chain: 'arcTestnet' })

    return res.json({
      success:          true,
      amount:           result.formattedAmount ?? amount,
      mintTxHash:       result.mintTxHash ?? null,
      sourceChain:      result.sourceChain ?? 'arcTestnet',
      destinationChain: result.destinationChain ?? 'arcTestnet',
      recipient:        result.recipient ?? sellerAddress,
    })
  } catch (err) {
    const safe = sanitizeError(err)
    console.error('[dashboard/withdraw] failed:', safe)
    return res.status(500).json({ error: safe })
  }
})

export default router
