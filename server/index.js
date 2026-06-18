import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import articlesRouter from './routes/articles.js'
import paymentsRouter from './routes/payments.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/articles', articlesRouter)
app.use('/api/payments', paymentsRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Inkpay server running on http://localhost:${PORT}`)
})
