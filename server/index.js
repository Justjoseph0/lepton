import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import articlesRouter from './routes/articles.js'
import paymentsRouter from './routes/payments.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: '*',
  exposedHeaders: ['PAYMENT-REQUIRED'],
}))
app.use(express.json())

// Serve the Ghost embed script publicly
app.use('/embed', express.static(join(__dirname, '../embed')))

app.use('/api/articles', articlesRouter)
app.use('/api/payments', paymentsRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Inkpay server running on http://0.0.0.0:${PORT}`)
})
