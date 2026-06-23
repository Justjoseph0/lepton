const DEFAULT_PRICE = 0.001
const MIN_PRICE = 0.001
const MAX_PRICE = 0.05

const articlePrices = new Map()

export function normalizePrice(price) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric)) return DEFAULT_PRICE
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, numeric))
}

export function setArticlePrice(articleId, price) {
  if (!articleId) return null

  const normalizedPrice = normalizePrice(price)
  articlePrices.set(String(articleId), normalizedPrice)
  return normalizedPrice
}

export function getArticlePrice(articleId) {
  if (!articleId) return DEFAULT_PRICE
  return articlePrices.get(String(articleId)) ?? DEFAULT_PRICE
}

export function formatUsdcAmount(price) {
  return `$${normalizePrice(price).toFixed(3)}`
}

export function getAllPrices() {
  return Array.from(articlePrices.entries()).map(([id, price]) => ({ id, price }))
}
