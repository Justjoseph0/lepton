import { Router } from 'express'
import { GatewayClient } from '@circle-fin/x402-batching/client'
import pool from '../lib/db.js'
import { getAllPrices } from '../lib/articlePrices.js'
import { getAllTransactions } from '../lib/transactionLog.js'

const router = Router()

const GATEWAY_BALANCE_URL = 'https://gateway-api-testnet.circle.com/v1/balances'
const ARC_TESTNET_DOMAIN  = 26
// Circle charges ~$0.0035 protocol fee per Arc→Arc withdrawal; balance must cover
// amount + actual_fee. Using 0.005 as a conservative buffer above the observed fee.
const WITHDRAWAL_FEE_BUFFER = 0.005

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

// Compute earnings stats over a specific set of transactions (the creator's own).
function computeStats(txs) {
  const total  = txs.reduce((sum, t) => sum + t.price, 0)
  const unique = new Set(txs.map(t => t.payer)).size
  return {
    totalEarnings: total,
    totalUnlocked: txs.length,
    avgPrice:      txs.length ? total / txs.length : 0,
    activeReaders: unique,
  }
}

// GET /api/dashboard/stats
// Scoped to the logged-in creator: requires an active session and a wallet on file.
router.get('/stats', async (req, res) => {
  const creatorId = req.session?.creatorId
  if (!creatorId) {
    return res.status(401).json({ error: 'Not logged in' })
  }

  let creator
  try {
    const { rows } = await pool.query(
      `select name, email, wallet_address
         from creators
        where id = $1`,
      [creatorId],
    )
    creator = rows[0]
  } catch (err) {
    console.error('[dashboard/stats] creator lookup failed:', err)
    return res.status(500).json({ error: 'Could not load dashboard' })
  }

  if (!creator) {
    // Session points at a creator that no longer exists — clear it.
    req.session.destroy(() => {})
    return res.status(401).json({ error: 'Not logged in' })
  }

  if (!creator.wallet_address) {
    return res.status(400).json({
      error: 'Complete wallet onboarding to view your dashboard',
      needsWallet: true,
    })
  }

  // Eth addresses can differ in case (checksum) — compare lowercased.
  const wallet = creator.wallet_address.toLowerCase()
  const ownedBy = addr => (addr ?? '').toLowerCase() === wallet

  const allTx = getAllTransactions().filter(tx => ownedBy(tx.walletAddress))

  const unlockCounts = {}
  for (const tx of allTx) {
    unlockCounts[tx.articleId] = (unlockCounts[tx.articleId] || 0) + 1
  }

  const articles = getAllPrices()
    .filter(a => ownedBy(a.walletAddress))
    .map(({ id, price }) => ({
      id,
      price,
      unlocks: unlockCounts[id] || 0,
    }))

  // Withdrawal moves the platform's Gateway balance, and the server only holds
  // the platform's private key — so only the creator whose wallet IS the
  // platform wallet can withdraw. Tell the frontend so it can reflect that.
  const sellerAddress = process.env.SELLER_ADDRESS ?? ''
  const canWithdraw = sellerAddress !== '' && wallet === sellerAddress.toLowerCase()

  res.json({
    wallet:       creator.wallet_address,
    creator:      { name: creator.name ?? null, email: creator.email },
    canWithdraw,
    stats:        computeStats(allTx),
    transactions: allTx.slice(0, 10),
    articles,
  })
})

// POST /api/dashboard/withdraw
// Body (all optional): { amount?: string }
// Withdraws the platform's Gateway balance on Arc Testnet. Restricted to the
// creator whose wallet matches SELLER_ADDRESS — the only wallet the server holds
// a private key for. All other creators get a 501 until per-creator custody exists.
router.post('/withdraw', async (req, res) => {
  const creatorId = req.session?.creatorId
  if (!creatorId) {
    return res.status(401).json({ error: 'Not logged in' })
  }

  const privateKey    = process.env.SELLER_PRIVATE_KEY
  const sellerAddress = process.env.SELLER_ADDRESS

  if (!privateKey) {
    return res.status(500).json({ error: 'SELLER_PRIVATE_KEY is not configured on the server' })
  }
  if (!sellerAddress) {
    return res.status(500).json({ error: 'SELLER_ADDRESS is not configured on the server' })
  }

  // Verify the session creator owns the platform wallet before touching funds.
  let creator
  try {
    const { rows } = await pool.query(
      `select wallet_address from creators where id = $1`,
      [creatorId],
    )
    creator = rows[0]
  } catch (err) {
    console.error('[dashboard/withdraw] creator lookup failed:', err)
    return res.status(500).json({ error: 'Could not verify account' })
  }

  if (!creator) {
    req.session.destroy(() => {})
    return res.status(401).json({ error: 'Not logged in' })
  }

  const isPlatformWallet =
    (creator.wallet_address ?? '').toLowerCase() === sellerAddress.toLowerCase()
  if (!isPlatformWallet) {
    return res.status(501).json({
      error: 'Withdrawal is not yet supported for multi-creator accounts',
    })
  }

  try {
    // Resolve withdrawal amount: use provided amount or derive from available balance
    let { amount } = req.body ?? {}

    if (!amount) {
      const available = parseFloat(await fetchGatewayBalance(sellerAddress))
      if (!available || available === 0) {
        return res.status(400).json({ error: 'No Gateway balance available to withdraw' })
      }
      // Circle requires balance >= withdrawal_amount + protocol_fee (~$0.0035).
      // Subtract fee buffer so the request doesn't exceed the available balance.
      const net = available - WITHDRAWAL_FEE_BUFFER
      if (net <= 0) {
        return res.status(400).json({
          error: `Gateway balance (${available} USDC) is too low to cover Circle's protocol fee (~$0.0035). Accumulate more earnings first.`,
        })
      }
      amount = net.toFixed(6)
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
