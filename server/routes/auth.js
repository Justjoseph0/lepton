import { Router } from 'express'
import bcrypt from 'bcrypt'
import passport from 'passport'
import pool from '../lib/db.js'

const router = Router()

const BCRYPT_ROUNDS = 12
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function validateSignup({ email, password }) {
  const errors = []

  if (!EMAIL_RE.test(email)) {
    errors.push('A valid email is required')
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  return errors
}

async function getSessionCreator(creatorId) {
  const { rows } = await pool.query(
    `select id, email, name, wallet_address
       from creators
      where id = $1`,
    [creatorId],
  )

  return rows[0] ?? null
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = req.body?.password
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : null

  const errors = validateSignup({ email, password })
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0] })
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const { rows } = await pool.query(
      `insert into creators (email, password_hash, google_id, name, wallet_address)
       values ($1, $2, null, $3, null)
       returning id, email, name, wallet_address`,
      [email, passwordHash, name || null],
    )

    const creator = rows[0]
    req.session.creatorId = creator.id

    return res.status(201).json({ success: true, needsWallet: true })
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    console.error('[auth/signup] failed:', err)
    return res.status(500).json({ error: 'Could not create account' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = req.body?.password

  if (!EMAIL_RE.test(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const { rows } = await pool.query(
      `select id, email, password_hash, wallet_address
         from creators
        where email = $1`,
      [email],
    )
    const creator = rows[0]

    if (!creator || !creator.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const passwordMatches = await bcrypt.compare(password, creator.password_hash)
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    req.session.creatorId = creator.id

    return res.json({
      success: true,
      needsWallet: !creator.wallet_address,
    })
  } catch (err) {
    console.error('[auth/login] failed:', err)
    return res.status(500).json({ error: 'Could not log in' })
  }
})

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const creatorId = req.session?.creatorId
  if (!creatorId) {
    return res.status(401).json({ error: 'Not logged in' })
  }

  try {
    const creator = await getSessionCreator(creatorId)
    if (!creator) {
      req.session.destroy(() => {})
      return res.status(401).json({ error: 'Not logged in' })
    }

    return res.json({ creator })
  } catch (err) {
    console.error('[auth/me] failed:', err)
    return res.status(500).json({ error: 'Could not load creator' })
  }
})

// POST /api/auth/wallet
router.post('/wallet', async (req, res) => {
  const creatorId = req.session?.creatorId
  if (!creatorId) {
    return res.status(401).json({ error: 'Not logged in' })
  }

  const walletAddress = String(req.body?.wallet_address ?? '').trim()
  if (!ETH_ADDRESS_RE.test(walletAddress)) {
    return res.status(400).json({ error: 'A valid Ethereum wallet address is required' })
  }

  try {
    const { rowCount } = await pool.query(
      `update creators
          set wallet_address = $1
        where id = $2`,
      [walletAddress, creatorId],
    )

    if (rowCount === 0) {
      req.session.destroy(() => {})
      return res.status(401).json({ error: 'Not logged in' })
    }

    return res.json({ success: true })
  } catch (err) {
    console.error('[auth/wallet] failed:', err)
    return res.status(500).json({ error: 'Could not save wallet address' })
  }
})

// GET /api/auth/google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}))

// GET /api/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth',
  }),
  (req, res) => {
    req.session.creatorId = req.user.id
    const nextPath = req.user.wallet_address ? '/dashboard' : '/onboarding/wallet'
    return res.redirect(nextPath)
  },
)

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('[auth/logout] failed:', err)
      return res.status(500).json({ error: 'Could not log out' })
    }

    res.clearCookie('connect.sid')
    return res.json({ success: true })
  })
})

export default router
