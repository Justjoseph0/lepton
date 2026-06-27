import passport from 'passport'
import googleOAuth20 from 'passport-google-oauth20'
import pool from './db.js'

const GoogleStrategy = googleOAuth20.Strategy ?? googleOAuth20

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} env var is required`)
  }
  return value
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function profileEmail(profile) {
  return normalizeEmail(profile.emails?.[0]?.value)
}

function profileName(profile) {
  const displayName = profile.displayName?.trim()
  if (displayName) return displayName

  const first = profile.name?.givenName?.trim()
  const last = profile.name?.familyName?.trim()
  return [first, last].filter(Boolean).join(' ') || null
}

async function findCreatorByGoogleId(googleId) {
  const { rows } = await pool.query(
    `select id, email, password_hash, google_id, name, wallet_address, created_at
       from creators
      where google_id = $1`,
    [googleId],
  )

  return rows[0] ?? null
}

async function findCreatorByEmail(email) {
  const { rows } = await pool.query(
    `select id, email, password_hash, google_id, name, wallet_address, created_at
       from creators
      where email = $1`,
    [email],
  )

  return rows[0] ?? null
}

async function findCreatorById(id) {
  const { rows } = await pool.query(
    `select id, email, password_hash, google_id, name, wallet_address, created_at
       from creators
      where id = $1`,
    [id],
  )

  return rows[0] ?? null
}

async function linkGoogleIdToCreator({ creatorId, googleId, name }) {
  const { rows } = await pool.query(
    `update creators
        set google_id = $1,
            name = coalesce(nullif(name, ''), $2)
      where id = $3
      returning id, email, password_hash, google_id, name, wallet_address, created_at`,
    [googleId, name, creatorId],
  )

  return rows[0]
}

async function createGoogleCreator({ googleId, email, name }) {
  const { rows } = await pool.query(
    `insert into creators (email, password_hash, google_id, name, wallet_address)
     values ($1, null, $2, $3, null)
     returning id, email, password_hash, google_id, name, wallet_address, created_at`,
    [email, googleId, name],
  )

  return rows[0]
}

passport.use(new GoogleStrategy({
  clientID: requiredEnv('GOOGLE_CLIENT_ID'),
  clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
  callbackURL: requiredEnv('GOOGLE_CALLBACK_URL'),
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const googleId = profile.id
    const email = profileEmail(profile)
    const name = profileName(profile)

    if (!googleId) {
      return done(new Error('Google profile did not include an id'))
    }
    if (!email) {
      return done(new Error('Google profile did not include an email'))
    }

    const existingGoogleCreator = await findCreatorByGoogleId(googleId)
    if (existingGoogleCreator) {
      return done(null, existingGoogleCreator)
    }

    const existingEmailCreator = await findCreatorByEmail(email)
    if (existingEmailCreator) {
      const linkedCreator = await linkGoogleIdToCreator({
        creatorId: existingEmailCreator.id,
        googleId,
        name,
      })
      return done(null, linkedCreator)
    }

    const creator = await createGoogleCreator({ googleId, email, name })
    return done(null, creator)
  } catch (err) {
    return done(err)
  }
}))

passport.serializeUser((creator, done) => {
  done(null, creator.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const creator = await findCreatorById(id)
    done(null, creator || false)
  } catch (err) {
    done(err)
  }
})

export default passport
