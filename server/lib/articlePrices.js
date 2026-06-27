import pool from './db.js'

const DEFAULT_PRICE = 0.001
const MIN_PRICE     = 0.001
const MAX_PRICE     = 0.05

const cache = new Map()

// Hydrate cache from DB on startup; reads stay synchronous from cache.
pool.query('SELECT article_id, price, wallet_address FROM article_prices')
  .then(({ rows }) => {
    for (const row of rows) {
      cache.set(row.article_id, {
        price: Number(row.price),
        walletAddress: row.wallet_address ?? null,
      })
    }
    console.log(`[articlePrices] loaded ${rows.length} price(s) from DB`)
  })
  .catch(err => console.error('[articlePrices] failed to load from DB:', err.message))

export function normalizePrice(price) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric)) return DEFAULT_PRICE
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, numeric))
}

export function setArticlePrice(articleId, price, walletAddress = null) {
  if (!articleId) return null

  const normalized = normalizePrice(price)
  const normalizedWallet = walletAddress ? String(walletAddress).trim() : null

  cache.set(String(articleId), {
    price: normalized,
    walletAddress: normalizedWallet || null,
  })

  pool.query(
    `INSERT INTO article_prices (article_id, price, wallet_address)
     VALUES ($1, $2, $3)
     ON CONFLICT (article_id) DO UPDATE
       SET price = $2,
           wallet_address = $3`,
    [String(articleId), normalized, normalizedWallet || null],
  ).catch(err => console.error('[articlePrices] DB write failed:', err.message))

  return normalized
}

export function getArticlePrice(articleId) {
  return getArticlePricing(articleId).price
}

export function getArticlePricing(articleId) {
  if (!articleId) {
    return { price: DEFAULT_PRICE, walletAddress: null }
  }

  const pricing = cache.get(String(articleId))
  if (!pricing) {
    return { price: DEFAULT_PRICE, walletAddress: null }
  }

  return {
    price: normalizePrice(pricing.price),
    walletAddress: pricing.walletAddress ?? null,
  }
}

export function formatUsdcAmount(price) {
  return `$${normalizePrice(price).toFixed(3)}`
}

export function getAllPrices() {
  return Array.from(cache.entries()).map(([id, pricing]) => ({
    id,
    price: normalizePrice(pricing.price),
    walletAddress: pricing.walletAddress ?? null,
  }))
}
