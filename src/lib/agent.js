// Calls the Inkpay backend AI pricing agent.
// Claude API runs server-side; this module is the frontend-facing fetch wrapper.

export async function getArticlePrice({ url, title, wordCount, excerpt }) {
  const res = await fetch('/api/articles/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, wordCount, excerpt }),
  })
  if (!res.ok) throw new Error(`Pricing agent failed: ${res.status}`)
  return res.json() // { price: number, reasoning: string }
}
