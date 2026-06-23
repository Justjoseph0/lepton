import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'
import { Router } from 'express'
import { formatUsdcAmount, getArticlePrice } from '../lib/articlePrices.js'
import { logTransaction } from '../lib/transactionLog.js'

const router = Router()

if (!process.env.SELLER_ADDRESS) {
  console.warn('[payments] SELLER_ADDRESS is not set — /unlock routes will return 500')
}

const gateway = process.env.SELLER_ADDRESS
  ? createGatewayMiddleware({
      sellerAddress: process.env.SELLER_ADDRESS,
      facilitatorUrl: 'https://gateway-api-testnet.circle.com',
      networks: ['eip155:5042002'], // Arc testnet
    })
  : null

const gatewayMiddlewareByAmount = new Map()

function gatewayMiddlewareForAmount(amount) {
  if (!gateway) {
    return (_req, res) => res.status(500).json({ error: 'SELLER_ADDRESS env var not configured' })
  }

  if (!gatewayMiddlewareByAmount.has(amount)) {
    gatewayMiddlewareByAmount.set(amount, gateway.require(amount))
  }

  return gatewayMiddlewareByAmount.get(amount)
}

// Look up the latest AI-decided article price and require that amount.
// Falls back to $0.001 for articles that have not been priced yet.
function dynamicGatewayMiddleware(req, res, next) {
  const articleId = req.params.articleId
  const price     = getArticlePrice(articleId)
  const amount    = formatUsdcAmount(price)

  console.log('[payments/unlock] dynamicGatewayMiddleware entered:', { articleId, price, amount })

  req.inkpayPrice  = price
  req.inkpayAmount = amount

  // Intercept res.end so we can see exactly what status + headers the gateway
  // sends before the response is flushed (res.json is never called by gateway).
  const _end = res.end.bind(res)
  res.end = (body, ...args) => {
    const prHeader = res.getHeader('PAYMENT-REQUIRED')
    console.log('[payments/unlock] gateway res.end intercepted:', {
      statusCode:            res.statusCode,
      paymentRequiredHeader: prHeader
        ? `(present, ${String(prHeader).length} chars)`
        : '(MISSING)',
      body: typeof body === 'string' ? body.slice(0, 300) : String(body ?? '').slice(0, 300),
    })
    res.end = _end
    return _end(body, ...args)
  }

  let promise
  try {
    promise = gatewayMiddlewareForAmount(amount)(req, res, next)
  } catch (syncErr) {
    console.error('[payments/unlock] gateway.require() threw SYNCHRONOUSLY:')
    console.error(syncErr?.stack ?? syncErr)
    return next(syncErr)
  }

  // The middleware is async — catch any unhandled rejection so it shows in logs.
  if (promise && typeof promise.catch === 'function') {
    promise.catch(asyncErr => {
      console.error('[payments/unlock] gateway.require() ASYNC REJECTION:')
      console.error(asyncErr?.stack ?? asyncErr)
    })
  }

  return promise
}

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
//   → 200 { unlocked, settlementId, payer, articleId, price }
//
// The on-chain submitBatch tx follows asynchronously (~10 min on testnet).
router.get('/unlock/:articleId', logPaymentAttempt, dynamicGatewayMiddleware, (req, res) => {
  console.log('[payments/unlock] ✓ verified:', JSON.stringify(req.payment))
  const { payer, amount, network, transaction } = req.payment
  logTransaction({
    articleId:    req.params.articleId,
    price:        req.inkpayPrice,
    payer,
    settlementId: transaction,
    timestamp:    new Date().toISOString(),
  })
  res.json({
    unlocked: true,
    articleId: req.params.articleId,
    price: req.inkpayPrice,
    requiredAmount: req.inkpayAmount,
    settlementId: transaction,
    payer,
    amount,
    network,
  })
})

export default router
