import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'
import { Router } from 'express'

const router = Router()

if (!process.env.SELLER_ADDRESS) {
  console.warn('[payments] SELLER_ADDRESS is not set — /unlock routes will return 500')
}

// Gateway middleware is created once at startup.
// It handles the 402 challenge on the first request and verifies the signed
// payment authorization on the second request before calling next().
const gatewayMiddleware = process.env.SELLER_ADDRESS
  ? createGatewayMiddleware({
      sellerAddress: process.env.SELLER_ADDRESS,
      facilitatorUrl: 'https://gateway-api-testnet.circle.com',
      networks: ['eip155:5042002'], // Arc testnet
    }).require('$0.001')
  : (_req, res) => res.status(500).json({ error: 'SELLER_ADDRESS env var not configured' })

// Logging middleware — runs before gatewayMiddleware on every /unlock request.
// When a payment-signature header is present (the signed payment attempt):
//   - Decodes and logs the full payload we're about to send to the Circle facilitator
//   - Patches res.json so we can see exactly what the gateway sends back on rejection
function logPaymentAttempt(req, res, next) {
  const sig = req.headers['payment-signature']
  if (!sig) return next() // first request (402 challenge) — nothing to log yet

  // Decode the payload the client built and signed
  try {
    const payload = JSON.parse(Buffer.from(sig, 'base64').toString('utf8'))
    console.log('[payments/unlock] → sending to Circle facilitator:',
      JSON.stringify(payload, null, 2))
  } catch (e) {
    console.error('[payments/unlock] could not decode payment-signature header:', e.message,
      '\nraw (first 120 chars):', sig.slice(0, 120))
  }

  // Patch res.json to capture the gateway's response body on rejection
  // (the gateway calls res.json directly and never reaches our handler)
  const _json = res.json.bind(res)
  res.json = (body) => {
    if (res.statusCode !== 200) {
      console.error('[payments/unlock] ✗ gateway rejected — HTTP', res.statusCode,
        '\n  body:', JSON.stringify(body, null, 2))
    }
    res.json = _json
    return _json(body)
  }

  next()
}

// GET /api/payments/unlock/:articleId
//
// First request (no payment-signature header):
//   → 402 with PAYMENT-REQUIRED header containing base64-encoded JSON challenge
//
// Second request (with payment-signature header carrying signed EIP-712 authorization):
//   → Circle facilitator verifies the signature and debits the buyer's Gateway balance
//   → 200 { unlocked, settlementId, payer, articleId }
//
// The on-chain submitBatch tx follows asynchronously (~10 min on testnet).
router.get('/unlock/:articleId', logPaymentAttempt, gatewayMiddleware, (req, res) => {
  console.log('[payments/unlock] ✓ verified:', JSON.stringify(req.payment))
  const { payer, amount, network, transaction } = req.payment
  res.json({
    unlocked: true,
    articleId: req.params.articleId,
    settlementId: transaction,
    payer,
    amount,
    network,
  })
})

export default router
