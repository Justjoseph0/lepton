/*!
 * Inkpay Embed v0.1.0
 * Pay-per-article paywall for Ghost blogs
 *
 * Usage — paste into your Ghost theme's Code Injection > Site Footer:
 *   <script src="https://your-inkpay-domain.com/embed/inkpay.js"
 *           data-creator="0xYOUR_WALLET_ADDRESS"></script>
 */
;(function () {
  'use strict'

  // Update this to your deployed Inkpay backend URL before going live.
  var INKPAY_API = 'http://localhost:3001'
  var STORAGE_KEY = 'inkpay_unlocked'

  // --- localStorage helpers -------------------------------------------------

  function getUnlocked() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    catch (_) { return {} }
  }

  function markUnlocked(articleId) {
    var u = getUnlocked()
    u[articleId] = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  function isUnlocked(articleId) {
    return !!getUnlocked()[articleId]
  }

  // --- Utilities ------------------------------------------------------------

  function getArticleId() {
    // Use the pathname slug as a stable per-article identifier.
    return window.location.pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'index'
  }

  function getCreatorAddress() {
    var s = document.currentScript || document.querySelector('script[data-creator]')
    return s ? s.getAttribute('data-creator') : null
  }

  function getArticleEl() {
    return document.querySelector('.gh-content, .post-content, article .content, article')
  }

  // --- Paywall UI -----------------------------------------------------------

  function truncateAndPaywall(price) {
    var article = getArticleEl()
    if (!article) return

    var children = Array.from(article.children)
    var firstParaIdx = children.findIndex(function (el) { return el.tagName === 'P' })
    if (firstParaIdx === -1 || firstParaIdx === children.length - 1) return

    // Hide everything after the first paragraph.
    for (var i = firstParaIdx + 1; i < children.length; i++) {
      children[i].style.display = 'none'
    }

    injectPaywallUI(price)
  }

  function injectPaywallUI(price) {
    var articleId = getArticleId()
    var creatorAddress = getCreatorAddress()

    var el = document.createElement('div')
    el.id = 'inkpay-paywall'
    el.style.cssText = [
      'margin:2.5rem 0',
      'padding:2rem',
      'background:linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)',
      'border:1px solid #4f46e5',
      'border-radius:12px',
      'text-align:center',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:#fff',
    ].join(';')

    el.innerHTML =
      '<p style="font-size:.8rem;color:#a5b4fc;margin:0 0 .4rem;text-transform:uppercase;letter-spacing:.05em">Continue reading</p>' +
      '<p style="font-size:1.4rem;font-weight:700;margin:0 0 .4rem">' +
        'Unlock this article for <span style="color:#818cf8">$' + price + ' USDC</span>' +
      '</p>' +
      '<p style="font-size:.85rem;color:#94a3b8;margin:0 0 1.5rem">' +
        'Instant &amp; gas-free via Circle Nanopayments on Arc' +
      '</p>' +
      '<button id="inkpay-btn" style="' +
        'background:#4f46e5;color:#fff;border:none;padding:.7rem 2rem;' +
        'border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer' +
      '">' +
        'Pay $' + price + ' USDC to Read' +
      '</button>'

    var article = getArticleEl()
    if (article) article.appendChild(el)

    document.getElementById('inkpay-btn').addEventListener('click', function () {
      handlePayment(articleId, price, creatorAddress)
    })
  }

  // --- Payment flow ---------------------------------------------------------

  function handlePayment(articleId, price, creatorAddress) {
    var btn = document.getElementById('inkpay-btn')
    btn.textContent = 'Processing...'
    btn.disabled = true

    // TODO: replace mock signature with real Circle Gateway authorization signing.
    var mockSig = 'mock_sig_' + articleId + '_' + Date.now()

    fetch(INKPAY_API + '/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: articleId,
        signedAuthorization: mockSig,
        creatorAddress: creatorAddress,
      }),
    })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (data.verified) {
          markUnlocked(articleId)
          revealContent()
        } else {
          btn.textContent = 'Payment failed — try again'
          btn.disabled = false
        }
      })
      .catch(function (err) {
        console.error('[inkpay]', err)
        btn.textContent = 'Error — try again'
        btn.disabled = false
      })
  }

  function revealContent() {
    var paywall = document.getElementById('inkpay-paywall')
    if (paywall) paywall.remove()

    var article = getArticleEl()
    if (!article) return
    Array.from(article.children).forEach(function (el) {
      el.style.display = ''
    })
  }

  // --- Init -----------------------------------------------------------------

  function init() {
    // Only run on single-article pages (Ghost sets .gh-article on post pages).
    if (!document.querySelector('.gh-content, .post-content')) return
    if (window.location.pathname === '/') return

    var articleId = getArticleId()
    if (isUnlocked(articleId)) return

    // Fetch AI-generated price from the Inkpay backend, then paywall.
    fetch(INKPAY_API + '/api/articles/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: window.location.href,
        title: document.title,
        wordCount: (document.body.innerText || '').split(/\s+/).length,
      }),
    })
      .then(function (r) { return r.json() })
      .then(function (data) { truncateAndPaywall(data.price || 0.001) })
      .catch(function () { truncateAndPaywall(0.001) })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
