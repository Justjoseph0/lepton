// Frontend wrapper for the Inkpay AI pricing agent.
// Calls POST /api/articles/price and returns the structured pricing decision.

export async function priceArticle({ articleId, articleTitle, articleContent, blogUrl }) {
  if (!articleContent?.trim()) throw new Error('articleContent is required')

  const res = await fetch('/api/articles/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId, articleTitle, articleContent, blogUrl }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Pricing agent failed (${res.status})`)
  }

  // Returns: { price, priceInAtomicUnits, reasoning, category, depthLevel,
  //            readerValue, wordCount, readingTime, confidenceScore }
  return res.json()
}
