import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from 'passport'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import authRouter from './routes/auth.js'
import articlesRouter  from './routes/articles.js'
import paymentsRouter  from './routes/payments.js'
import dashboardRouter from './routes/dashboard.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const SESSION_SECRET = process.env.SESSION_SECRET

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET env var is required')
}

app.use(cors({
  origin: ['http://localhost:5173', 'https://lepton-ernp.onrender.com', 'https://wurld.mymagic.page'],
  credentials: true,
  exposedHeaders: ['PAYMENT-REQUIRED'],
}))
app.use(express.json())
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}))
app.use(passport.initialize())
app.use(passport.session())
await import('./lib/passport.js')

// Serve the Ghost embed script publicly
app.use('/embed', express.static(join(__dirname, '../embed')))

app.use('/api/auth', authRouter)
app.use('/api/articles',  articlesRouter)
app.use('/api/payments',  paymentsRouter)
app.use('/api/dashboard', dashboardRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Serve the built Vite frontend — must come after all /api and /embed routes
app.use(express.static(join(__dirname, '../dist')))
app.get('*', (_req, res) => res.sendFile(join(__dirname, '../dist/index.html')))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Inkpay server running on http://0.0.0.0:${PORT}`)
})
