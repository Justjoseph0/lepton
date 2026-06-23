const transactions = []

export function logTransaction({ articleId, price, payer, settlementId, timestamp }) {
  transactions.unshift({ articleId, price, payer, settlementId, timestamp })
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
