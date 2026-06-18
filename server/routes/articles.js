import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()

// Initialized lazily so missing API key surfaces as a runtime error, not a crash on startup.
let anthropic

function getClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return anthropic
}

// POST /api/articles/price
// AI agent reads article metadata and returns a dynamic USDC price + reasoning.
router.post('/price', async (req, res) => {
  const { url, title, excerpt, wordCount } = req.body
  if (!url) return res.status(400).json({ error: 'url is required' })

  try {
    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `You are Inkpay's pricing agent. Analyze this Ghost blog article and decide a fair nanopayment price in USDC.

Article URL: ${url}
Title: ${title ?? 'Unknown'}
Word count: ${wordCount ?? 'Unknown'}
Excerpt: ${excerpt ?? 'Not provided'}

Pricing rules:
- Range: $0.001–$0.05 USDC
- <500 words: $0.001–$0.005
- 500–1500 words: $0.005–$0.02
- >1500 words: $0.02–$0.05
- Raise price for technical, niche, or high-value topics
- Lower price for casual or general content

Respond with valid JSON only — no markdown, no extra text:
{"price": <number>, "reasoning": "<one sentence>"}`,
        },
      ],
    })

    const parsed = JSON.parse(message.content[0].text.trim())
    res.json(parsed)
  } catch (err) {
    console.error('[articles/price]', err.message)
    res.status(500).json({ error: 'Pricing agent failed', details: err.message })
  }
})

export default router
