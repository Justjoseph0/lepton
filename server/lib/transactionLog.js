import pool from './db.js'

const cache = []

// Hydrate cache from DB on startup — newest first to match unshift behaviour
pool.query('SELECT * FROM transactions ORDER BY timestamp DESC')
  .then(({ rows }) => {
    const records = rows.map(r => ({
      articleId:    r.article_id,
      price:        Number(r.price),
      payer:        r.payer,
      settlementId: r.settlement_id,
      timestamp:    r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    }))
    cache.push(...records)
    console.log(`[transactionLog] loaded ${rows.length} transaction(s) from DB`)
  })
  .catch(err => console.error('[transactionLog] failed to load from DB:', err.message))

export function logTransaction({ articleId, price, payer, settlementId, timestamp }) {
  const record = { articleId, price, payer, settlementId, timestamp }
  cache.unshift(record)
  pool.query(
    `INSERT INTO transactions (article_id, price, payer, settlement_id, timestamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [articleId, price, payer, settlementId, timestamp]
  ).catch(err => console.error('[transactionLog] DB write failed:', err.message))
}

export function getAllTransactions() {
  return cache
}

export function getStats() {
  const total  = cache.reduce((sum, t) => sum + t.price, 0)
  const unique = new Set(cache.map(t => t.payer)).size
  return {
    totalEarnings: total,
    totalUnlocked: cache.length,
    avgPrice:      cache.length ? total / cache.length : 0,
    activeReaders: unique,
  }
}
