import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../data')
const DATA_FILE = join(DATA_DIR, 'articlePrices.json')

const DEFAULT_PRICE = 0.001
const MIN_PRICE     = 0.001
const MAX_PRICE     = 0.05

const articlePrices = new Map()

// Load persisted prices on startup
mkdirSync(DATA_DIR, { recursive: true })
try {
  const obj = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  for (const [id, price] of Object.entries(obj)) {
    articlePrices.set(id, price)
  }
  console.log(`[articlePrices] loaded ${articlePrices.size} price(s) from disk`)
} catch (_) {}

function persist() {
  writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(articlePrices), null, 2), 'utf8')
}

export function normalizePrice(price) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric)) return DEFAULT_PRICE
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, numeric))
}

export function setArticlePrice(articleId, price) {
  if (!articleId) return null
  const normalizedPrice = normalizePrice(price)
  articlePrices.set(String(articleId), normalizedPrice)
  persist()
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
