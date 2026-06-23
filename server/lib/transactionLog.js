import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../data')
const DATA_FILE = join(DATA_DIR, 'transactions.json')

const transactions = []

// Load persisted transactions on startup
mkdirSync(DATA_DIR, { recursive: true })
try {
  const arr = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  transactions.push(...arr)
  console.log(`[transactionLog] loaded ${transactions.length} transaction(s) from disk`)
} catch (_) {}

function persist() {
  writeFileSync(DATA_FILE, JSON.stringify(transactions, null, 2), 'utf8')
}

export function logTransaction({ articleId, price, payer, settlementId, timestamp }) {
  transactions.unshift({ articleId, price, payer, settlementId, timestamp })
  persist()
}

export function getAllTransactions() {
  return transactions
}

export function getStats() {
  const total  = transactions.reduce((sum, t) => sum + t.price, 0)
  const unique = new Set(transactions.map(t => t.payer)).size
  return {
    totalEarnings: total,
    totalUnlocked: transactions.length,
    avgPrice:      transactions.length ? total / transactions.length : 0,
    activeReaders: unique,
  }
}
