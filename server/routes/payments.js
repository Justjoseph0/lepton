import { Router } from 'express'

const router = Router()

// POST /api/payments/verify
// Verifies a Circle Gateway payment authorization and returns an unlock token.
// TODO: replace mock logic with real GatewayClient submission to Arc testnet.
router.post('/verify', async (req, res) => {
  const { articleId, signedAuthorization, creatorAddress } = req.body

  if (!articleId || !signedAuthorization) {
    return res.status(400).json({ error: 'articleId and signedAuthorization are required' })
  }

  try {
    // TODO: submit signedAuthorization to Circle Gateway for batched gas-free settlement.
    // GatewayClient pattern from circlefin/arc-nanopayments will go here.

    // For now: mock verification — any signed authorization is accepted.
    const unlockToken = Buffer.from(
      JSON.stringify({ articleId, creatorAddress, ts: Date.now() })
    ).toString('base64url')

    res.json({ verified: true, unlockToken })
  } catch (err) {
    console.error('[payments/verify]', err.message)
    res.status(500).json({ error: 'Payment verification failed', details: err.message })
  }
})

export default router
