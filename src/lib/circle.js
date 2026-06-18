// Frontend helpers for Circle wallet interaction and payment authorization signing.
// The Circle Developer Controlled Wallets SDK and GatewayClient run server-side in /server.

export async function getWalletAddress() {
  // TODO: integrate Circle Programmable Wallets web SDK or browser wallet (MetaMask/Rabby)
  return null
}

export async function signPaymentAuthorization({ to, amount, articleId }) {
  // TODO: sign an x402 payment authorization for the given article.
  // Will use the GatewayClient pattern from Circle's arc-nanopayments reference implementation.
  throw new Error('signPaymentAuthorization not yet implemented')
}
