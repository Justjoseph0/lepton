// x402 payment flow helpers.
// Handles the 402 Payment Required → sign authorization → verify → unlock loop.

export async function unlockArticle({ articleId, price, creatorAddress }) {
  // TODO:
  // 1. Prompt reader to sign a Circle Gateway payment authorization for `price` USDC
  // 2. POST signed authorization to /api/payments/verify
  // 3. Receive an unlock token valid for this articleId
  // 4. Return the token so the caller can reveal hidden content
  throw new Error('unlockArticle not yet implemented')
}

export async function verifyUnlock({ articleId, signedAuthorization, creatorAddress }) {
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId, signedAuthorization, creatorAddress }),
  })
  if (!res.ok) throw new Error(`Payment verification failed: ${res.status}`)
  return res.json() // { verified: boolean, unlockToken: string }
}
