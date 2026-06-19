// Client-side x402 payment flow.
// Uses viem for contract interactions and window.ethereum (MetaMask) for signing.

import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  parseUnits,
  erc20Abi,
  defineChain,
} from 'viem'

// ─── Chain + contract constants ───────────────────────────────────────────────

const ARC_CHAIN_ID = '0x4cef52' // 5042002 decimal

const ARC_TESTNET_PARAMS = {
  chainId: ARC_CHAIN_ID,
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
}

// Defined inline so we don't depend on viem/chains having arcTestnet
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  testnet: true,
})

export const USDC_ADDRESS    = '0x3600000000000000000000000000000000000000'
export const GATEWAY_ADDRESS = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9'

// Minimal GatewayWallet ABI — only the functions called from the browser
const GATEWAY_ABI = [
  {
    name: 'availableBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token',     type: 'address' },
      { name: 'depositor', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
]

// ─── Viem client factories ────────────────────────────────────────────────────

function publicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http('https://rpc.testnet.arc.network'),
  })
}

function walletClient() {
  return createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function b64Encode(obj) {
  return btoa(JSON.stringify(obj))
}

function b64Decode(str) {
  return JSON.parse(atob(str))
}

function randomNonceHex() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Wallet connection ────────────────────────────────────────────────────────

// Connect MetaMask and ensure the active chain is Arc Testnet.
// Returns the connected wallet address (lowercase).
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('No wallet detected — please install MetaMask.')
  }

  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })

  const currentChain = await window.ethereum.request({ method: 'eth_chainId' })
  if (currentChain !== ARC_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_CHAIN_ID }],
      })
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ARC_TESTNET_PARAMS],
        })
      } else {
        throw err
      }
    }
  }

  return account
}

// ─── Gateway balance ─────────────────────────────────────────────────────────

// Returns the buyer's available balance inside the GatewayWallet contract
// as a BigInt of atomic units (USDC has 6 decimals: 1 USDC = 1_000_000n).
export async function checkGatewayBalance(address) {
  const pc = publicClient()
  return pc.readContract({
    address: GATEWAY_ADDRESS,
    abi: GATEWAY_ABI,
    functionName: 'availableBalance',
    args: [USDC_ADDRESS, address],
  })
}

// ─── Deposit to Gateway ──────────────────────────────────────────────────────

// Two-step on-chain flow — produces two MetaMask confirmation popups:
//   Tx 1: USDC.approve(GatewayWallet, amount)
//   Tx 2: GatewayWallet.deposit(USDC, amount)
//
// `onProgress` is called with 'approving' before Tx 1 and 'depositing' before Tx 2.
// `amount` is a decimal USDC string, e.g. "0.5".
export async function depositToGateway(amount, onProgress) {
  const wc = walletClient()
  const pc = publicClient()

  const [account] = await window.ethereum.request({ method: 'eth_accounts' })
  if (!account) throw new Error('Wallet disconnected — please reconnect.')

  const amountUnits = parseUnits(amount, 6)

  // Tx 1: approve GatewayWallet to pull USDC from this account
  onProgress?.('approving')
  const approveTxHash = await wc.writeContract({
    account,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [GATEWAY_ADDRESS, amountUnits],
  })
  await pc.waitForTransactionReceipt({ hash: approveTxHash })

  // Tx 2: deposit USDC into GatewayWallet custody
  onProgress?.('depositing')
  const depositTxHash = await wc.writeContract({
    account,
    address: GATEWAY_ADDRESS,
    abi: GATEWAY_ABI,
    functionName: 'deposit',
    args: [USDC_ADDRESS, amountUnits],
    gas: 120000n,
  })
  await pc.waitForTransactionReceipt({ hash: depositTxHash })

  return { approveTxHash, depositTxHash }
}

// ─── Article unlock (x402 payment) ───────────────────────────────────────────

// Full x402 payment flow for a single article:
//   1. GET /api/payments/unlock/:articleId  →  402 + PAYMENT-REQUIRED challenge
//   2. Build EIP-712 TransferWithAuthorization typed data
//   3. eth_signTypedData_v4 via MetaMask (no gas, no on-chain tx)
//   4. Retry the request with payment-signature header
//   5. Server forwards to Circle facilitator → verify → settle
//   6. Returns { unlocked, settlementId, payer, articleId }
export async function unlockArticle(articleId) {
  const endpoint = `/api/payments/unlock/${encodeURIComponent(articleId)}`

  // Step 1: fetch the 402 challenge
  const r1 = await fetch(endpoint)
  if (r1.status !== 402) {
    throw new Error(`Expected 402 Payment Required, got ${r1.status}`)
  }

  const challenge = b64Decode(r1.headers.get('PAYMENT-REQUIRED'))
  const accepted = challenge.accepts[0]
  console.log('[payments] 402 challenge received:', JSON.stringify(challenge, null, 2))

  const chainId = parseInt(accepted.network.split(':')[1], 10)
  const now = Math.floor(Date.now() / 1000)
  const validBefore = (now + Math.max(accepted.maxTimeoutSeconds, 7 * 24 * 3600 + 600)).toString()
  const validAfter  = (now - 600).toString()
  const nonce = randomNonceHex()

  const [account] = await window.ethereum.request({ method: 'eth_accounts' })
  if (!account) throw new Error('Wallet disconnected — please reconnect.')

  // Step 2: build EIP-712 typed data
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name',              type: 'string'  },
        { name: 'version',           type: 'string'  },
        { name: 'chainId',           type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from',        type: 'address' },
        { name: 'to',          type: 'address' },
        { name: 'value',       type: 'uint256' },
        { name: 'validAfter',  type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce',       type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    domain: {
      name: 'GatewayWalletBatched',
      version: '1',
      chainId,
      verifyingContract: accepted.extra.verifyingContract,
    },
    message: {
      from:        account,
      to:          accepted.payTo,
      value:       accepted.amount,
      validAfter,
      validBefore,
      nonce,
    },
  }

  // Step 3: sign with MetaMask (no gas, no on-chain tx)
  const signature = await window.ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [account, JSON.stringify(typedData)],
  })

  // Step 4: build payment payload
  const paymentPayload = {
    x402Version: 2,
    payload: {
      signature,
      authorization: {
        from: account,
        to:   accepted.payTo,
        value: accepted.amount,
        validAfter,
        validBefore,
        nonce,
      },
    },
    accepted,
    resource: challenge.resource,
  }

  // Step 5: retry with signed payment
  console.log('[payments] sending payment payload:', JSON.stringify(paymentPayload, null, 2))

  const r2 = await fetch(endpoint, {
    headers: { 'payment-signature': b64Encode(paymentPayload) },
  })

  if (!r2.ok) {
    const rawText = await r2.text()
    console.error('[payments] ✗ unlock failed — HTTP', r2.status, '\n  raw response:', rawText)
    let body = {}
    try { body = JSON.parse(rawText) } catch (_) {}
    throw new Error(body.error ?? `Payment failed (${r2.status})`)
  }

  return r2.json() // { unlocked, settlementId, payer, articleId }
}
