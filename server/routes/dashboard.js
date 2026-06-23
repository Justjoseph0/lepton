import { Router } from 'express'
import { getAllPrices } from '../lib/articlePrices.js'
import { getAllTransactions, getStats } from '../lib/transactionLog.js'

const router = Router()

// GET /api/dashboard/stats
router.get('/stats', (_req, res) => {
  const allTx = getAllTransactions()

  const unlockCounts = {}
  for (const tx of allTx) {
    unlockCounts[tx.articleId] = (unlockCounts[tx.articleId] || 0) + 1
  }

  const articles = getAllPrices().map(({ id, price }) => ({
    id,
    price,
    unlocks: unlockCounts[id] || 0,
  }))

  res.json({
    wallet:       process.env.SELLER_ADDRESS || '',
    stats:        getStats(),
    transactions: allTx.slice(0, 10),
    articles,
  })
})

export default router
