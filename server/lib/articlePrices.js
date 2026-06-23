import pool from './db.js'

const DEFAULT_PRICE = 0.001
const MIN_PRICE     = 0.001
const MAX_PRICE     = 0.05

const cache = new Map()

// Hydrate cache from DB on startup — reads stay synchronous from cache
pool.query('SELECT article_id, price FROM article_prices')
  .then(({ rows }) => {
    for (const row of rows) cache.set(row.article_id, Number(row.price))
    console.log(`[articlePrices] loaded ${rows.length} price(s) from DB`)
  })
  .catch(err => console.error('[articlePrices] failed to load from DB:', err.message))

export function normalizePrice(price) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric)) return DEFAULT_PRICE
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, numeric))
}

export function setArticlePrice(articleId, price) {
  if (!articleId) return null
  const normalized = normalizePrice(price)
  cache.set(String(articleId), normalized)
  pool.query(
    `INSERT INTO article_prices (article_id, price)
     VALUES ($1, $2)
     ON CONFLICT (article_id) DO UPDATE SET price = $2`,
    [String(articleId), normalized]
  ).catch(err => console.error('[articlePrices] DB write failed:', err.message))
  return normalized
}

export function getArticlePrice(articleId) {
  if (!articleId) return DEFAULT_PRICE
  return cache.get(String(articleId)) ?? DEFAULT_PRICE
}

export function formatUsdcAmount(price) {
  return `$${normalizePrice(price).toFixed(3)}`
}

export function getAllPrices() {
  return Array.from(cache.entries()).map(([id, price]) => ({ id, price }))
}
