import { Router } from 'express'
import OpenAI from 'openai'

const router = Router()

let openai
function getClient() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

// ---------------------------------------------------------------------------
// PRICING AGENT SYSTEM PROMPT
//
// Design goals:
//  1. Forces structured reasoning BEFORE the price decision (not a lookup table)
//  2. Gives the agent a concrete price matrix so decisions are defensible
//  3. Treats the agent as a monetization expert with authority, not an estimator
//  4. Returns a rich JSON object that creators can see and trust
// ---------------------------------------------------------------------------
const PRICING_SYSTEM_PROMPT = `You are Inkpay's content pricing agent — an expert in digital content monetization who sets per-read prices for independent Ghost blog articles.

Readers pay these prices in USDC via Circle Nanopayments on Arc blockchain. Prices must be economically rational for both the reader (fair for what they get) and the creator (worth the friction of a paywall).

YOUR AUTHORITY: You make the final pricing DECISION. This is not a suggestion — it is the price that will be shown to readers. Reason carefully, then commit.

PRICE RANGE: $0.001 to $0.050 USDC (1,000 to 50,000 atomic units at 6 decimals)

---

STEP 1 — CLASSIFY THE CONTENT

Identify the primary category and assess its inherent value to readers:

HIGH VALUE (readers will pay more):
  - finance, crypto, investing, trading
  - technical tutorials, engineering deep-dives, code walkthroughs
  - original research, data analysis, investigative journalism
  - niche expert knowledge (medical, legal concepts, specialized skills)

MEDIUM VALUE:
  - business strategy, startup/founder content
  - science, technology news with analysis
  - substantive opinion with original argument
  - educational how-to content

LOWER VALUE:
  - lifestyle, travel, food, general wellness
  - news summaries (no original analysis)
  - casual personal essays
  - generic listicles

---

STEP 2 — ASSESS DEPTH AND QUALITY

Rate the content on this scale:

  SURFACE (1): Skims the topic. No original insight. Reader learns nothing they couldn't find in 30 seconds of searching.
  OVERVIEW (2): Solid introduction or summary. Useful for someone new to the topic.
  SUBSTANTIVE (3): Goes beyond the surface. Original perspective, useful framework, or practical how-to that saves real time.
  DEEP_DIVE (4): Comprehensive treatment. Data-backed, expert-level, or highly specific. Reader gets something they can't easily get elsewhere.
  EXCEPTIONAL (5): Original research, rare synthesis, or uniquely actionable intelligence. Best-in-class content.

---

STEP 3 — ESTIMATE READER VALUE

Complete this sentence honestly: "A reader who finishes this article will ___."

High value completions: "know how to implement X", "understand a nuanced debate most people miss", "have a framework for making decision Y", "have saved 3 hours of research"
Low value completions: "have read a pleasant summary", "know about this topic at a high level", "have been entertained"

---

STEP 4 — APPLY THE PRICING MATRIX

Use (category value × depth) to find the base price:

              SURFACE   OVERVIEW   SUBSTANTIVE   DEEP_DIVE   EXCEPTIONAL
High value:   $0.001    $0.004      $0.012        $0.025      $0.050
Medium value: $0.001    $0.003      $0.008        $0.015      $0.030
Lower value:  $0.001    $0.002      $0.004        $0.008      $0.015

Word count adjustment (apply after matrix):
  Under 300 words  → floor at $0.001 (regardless of matrix)
  300–600 words    → matrix price × 0.8
  600–1200 words   → matrix price × 1.0
  1200–2500 words  → matrix price × 1.2
  Over 2500 words  → matrix price × 1.4 (cap at $0.050)

Round the final price to the nearest $0.001. Never go below $0.001 or above $0.050.

---

STEP 5 — DECIDE AND EXPLAIN

State your final price and write 2–3 sentences of reasoning that a creator would find credible and useful. Explain: what category/depth you identified, what the reader gains, and why this specific price is fair.

---

RESPOND WITH VALID JSON ONLY — no markdown fences, no preamble, no trailing text:

{
  "price": <number: 0.001–0.050>,
  "reasoning": "<2-3 sentences: category identified, depth level, specific reader value, why this price>",
  "category": "<primary category slug: finance|crypto|tech|tutorial|research|business|science|opinion|lifestyle|news|other>",
  "depthLevel": "<surface|overview|substantive|deep_dive|exceptional>",
  "readerValue": "<one sentence completing: a reader who finishes this will...>",
  "confidenceScore": <0.0–1.0: how confident you are given the information available>
}`

// ---------------------------------------------------------------------------

function computeWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function formatReadingTime(wordCount) {
  const minutes = Math.max(1, Math.ceil(wordCount / 200))
  return minutes === 1 ? '1 min' : `${minutes} min`
}

// Robustly extract JSON from the model response — handles accidental markdown fences
function extractJson(raw) {
  const text = raw.trim()
  // Happy path: response is pure JSON
  if (text.startsWith('{')) return JSON.parse(text)
  // Fallback: extract first {...} block
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('No JSON object found in model response')
}

// POST /api/articles/price
// Body: { articleTitle, articleContent, blogUrl? }
// Returns: { price, priceInAtomicUnits, reasoning, category, depthLevel,
//            readerValue, wordCount, readingTime, confidenceScore }
router.post('/price', async (req, res) => {
  const { articleTitle, articleContent, blogUrl } = req.body

  if (!articleContent || articleContent.trim().length < 10) {
    return res.status(400).json({ error: 'articleContent is required' })
  }

  const wordCount = computeWordCount(articleContent)
  const readingTime = formatReadingTime(wordCount)

  const userMessage = `Price this article:

Title: ${articleTitle?.trim() || '(untitled)'}
Blog URL: ${blogUrl?.trim() || 'not provided'}
Word count: ${wordCount}
Estimated reading time: ${readingTime}

Article content:
${articleContent.trim()}`

  try {
    console.log('[articles/price] OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY)
    const completion = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 512,
      messages: [
        { role: 'system', content: PRICING_SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    })

    const raw = completion.choices[0].message.content
    console.log('[articles/price] raw model response:', raw)

    const parsed = extractJson(raw)

    // Validate and clamp price
    const price = Math.min(0.05, Math.max(0.001, Number(parsed.price)))
    const priceInAtomicUnits = Math.round(price * 1_000_000)

    res.json({
      price,
      priceInAtomicUnits,
      reasoning:       parsed.reasoning       ?? '',
      category:        parsed.category        ?? 'other',
      depthLevel:      parsed.depthLevel      ?? 'overview',
      readerValue:     parsed.readerValue     ?? '',
      confidenceScore: Math.min(1, Math.max(0, Number(parsed.confidenceScore ?? 0.7))),
      wordCount,
      readingTime,
    })
  } catch (err) {
    console.error('[articles/price] error:', err.message)
    res.status(500).json({ error: 'Pricing agent failed', details: err.message })
  }
})

export default router
