/*!
 * Inkpay Embed v0.2.0
 * Drop-in paywall for Ghost blogs via Circle Gateway Nanopayments on Arc.
 *
 * Usage — Ghost: Settings → Code Injection → Site Footer:
 *   <script src="https://YOUR-INKPAY-SERVER/embed/inkpay.js"
 *           data-seller="0xYOUR_WALLET_ADDRESS"></script>
 *
 * For local dev, add data-api to override the API base:
 *   data-api="https://xxxx.ngrok.io"
 *
 * Loads ethers.js v5 from jsDelivr CDN (cached after first load).
 */
;(function () {
  'use strict'

  /* ── Config ────────────────────────────────────────────────────────────── */

  var PRICE_DISPLAY   = '$0.0010'
  var DEPOSIT_AMOUNT  = '0.5'       // USDC
  var DEPOSIT_ATOMIC  = '500000'    // 0.5 × 10^6
  var THRESHOLD       = 50000       // 0.05 USDC — prompt deposit below this

  var ARC_CHAIN_ID    = '0x4cef52'  // 5042002 decimal
  var ARC_CHAIN_PARAMS = {
    chainId: ARC_CHAIN_ID,
    chainName: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: ['https://rpc.testnet.arc.network'],
    blockExplorerUrls: ['https://testnet.arcscan.app'],
  }

  var USDC_ADDR    = '0x3600000000000000000000000000000000000000'
  var GATEWAY_ADDR = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9'
  var GATEWAY_ABI  = [
    'function availableBalance(address token, address depositor) view returns (uint256)',
    'function deposit(address token, uint256 value)',
  ]

  /* ── Script tag attributes ─────────────────────────────────────────────── */

  var me       = document.currentScript
  var SELLER   = (me && me.dataset.seller) || ''
  // API_BASE: explicit data-api attr → origin of this script's src → same origin
  var API_BASE = (me && me.dataset.api) ||
    (me && me.src ? (new URL(me.src)).origin : window.location.origin)

  /* ── State ─────────────────────────────────────────────────────────────── */

  // locked | checking | needs_deposit | depositing | loading | success
  var state       = 'locked'
  var account     = null
  var depositStep = null    // 'approving' | 'depositing'
  var lastError   = null
  var ethProvider, ethSigner

  /* ── localStorage — remember paid articles ─────────────────────────────── */

  var STORAGE_KEY = 'inkpay_v1'

  function slug() {
    return window.location.pathname.replace(/^\/|\/$/g, '') || 'index'
  }

  function isUnlocked() {
    try { return !!(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')[slug()]) }
    catch (_) { return false }
  }

  function markUnlocked() {
    try {
      var m = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      m[slug()] = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
    } catch (_) {}
  }

  /* ── Ghost content detection ───────────────────────────────────────────── */

  function findContent() {
    var sels = ['.gh-content', '.post-content', '.post-full-content',
                '.article-content', '.entry-content', '.e-content']
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i])
      if (el && el.children.length > 1) return el
    }
    return null
  }

  /* ── DOM scaffold ──────────────────────────────────────────────────────── */

  var hiddenEl, fadeEl, wrapEl

  function scaffold(container) {
    var kids = Array.from(container.children)
    if (kids.length < 2) return false

    // Find first <p>; fall back to first child
    var pivotIdx = kids.findIndex(function (c) { return c.tagName === 'P' })
    if (pivotIdx < 0) pivotIdx = 0
    var pivotEl = kids[pivotIdx]

    // Wrap pivot in a box so the gradient has a positioned ancestor
    var box = document.createElement('div')
    box.style.position = 'relative'
    container.insertBefore(box, pivotEl)
    box.appendChild(pivotEl)

    // Gradient fade at the bottom of the visible paragraph
    fadeEl = document.createElement('div')
    fadeEl.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;height:80px;pointer-events:none;' +
      'background:linear-gradient(to bottom,rgba(255,255,255,0),#fff)'
    box.appendChild(fadeEl)

    // Hidden block — everything after the pivot
    hiddenEl = document.createElement('div')
    hiddenEl.style.display = 'none'
    kids.slice(pivotIdx + 1).forEach(function (el) { hiddenEl.appendChild(el) })
    container.appendChild(hiddenEl)

    // Paywall card slot — injected between box and hiddenEl
    wrapEl = document.createElement('div')
    wrapEl.id = 'inkpay-wrap'
    container.insertBefore(wrapEl, hiddenEl)

    return true
  }

  /* ── CSS ───────────────────────────────────────────────────────────────── */

  function injectCSS() {
    var css = [
      '#inkpay-wrap{margin-top:28px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '#inkpay-card{max-width:520px;margin:0 auto;border-radius:16px;border:1px solid #e0e7ff;',
        'background:#fff;overflow:hidden;box-shadow:0 2px 8px rgba(99,102,241,.1)}',
      '#inkpay-accent{height:4px;background:linear-gradient(to right,#6366f1,#8b5cf6,#a855f7)}',
      '#inkpay-body{padding:32px 24px;display:flex;flex-direction:column;',
        'align-items:center;text-align:center;gap:16px}',
      '.ip-icon{width:56px;height:56px;border-radius:50%;display:flex;',
        'align-items:center;justify-content:center;flex-shrink:0}',
      '.ip-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;',
        'border-radius:9999px;background:#ecfdf5;border:1px solid #d1fae5;',
        'font-size:11px;font-family:monospace;color:#065f46}',
      '.ip-badge-dot{width:6px;height:6px;border-radius:50%;background:#34d399;flex-shrink:0}',
      '.ip-title{font-size:18px;font-weight:700;color:#111827;margin:0;line-height:1.3}',
      '.ip-sub{font-size:14px;color:#6b7280;margin:0;line-height:1.55;max-width:320px}',
      '.ip-price{font-size:30px;font-weight:800;color:#111827;margin:0;font-variant-numeric:tabular-nums}',
      '.ip-unit{font-size:16px;font-weight:500;color:#9ca3af}',
      '.ip-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;',
        'border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;border:none;',
        'outline:none;background:#4f46e5;color:#fff;',
        'box-shadow:0 1px 3px rgba(79,70,229,.35);transition:background .15s,transform .1s}',
      '.ip-btn:hover:not([disabled]){background:#4338ca}',
      '.ip-btn:active:not([disabled]){transform:scale(.97)}',
      '.ip-btn[disabled]{background:#a5b4fc;cursor:not-allowed}',
      '.ip-pills{display:flex;align-items:center;gap:8px}',
      '.ip-pill{padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:500}',
      '.ip-pill-active{background:#e0e7ff;color:#3730a3}',
      '.ip-pill-done{background:#d1fae5;color:#065f46}',
      '.ip-pill-idle{background:#f3f4f6;color:#9ca3af}',
      '.ip-sep{color:#d1d5db}',
      '.ip-hint{font-size:11px;color:#9ca3af;margin:0}',
      '.ip-error{font-size:13px;color:#ef4444;background:#fef2f2;border:1px solid #fecaca;',
        'border-radius:8px;padding:8px 12px;max-width:320px}',
      '.ip-foot{font-size:11px;color:#d1d5db;margin:4px 0 0}',
      '.ip-foot a{color:#a5b4fc;text-decoration:none}',
      '@keyframes ip-spin{to{transform:rotate(360deg)}}',
      '.ip-spin{animation:ip-spin .8s linear infinite}',
    ].join('')
    var style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
  }

  /* ── SVG sprites ───────────────────────────────────────────────────────── */

  var IC = {
    wallet: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/></svg>',
    lock:   '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    up:     '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0-7 7m7-7 7 7"/></svg>',
    upSm:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0-7 7m7-7 7 7"/></svg>',
    check:  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    spin:   '<svg class="ip-spin" width="28" height="28" viewBox="0 0 24 24" fill="none"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>',
    spinSm: '<svg class="ip-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>',
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }
  function trunc(addr) { return addr.slice(0,6) + '…' + addr.slice(-4) }
  function badge()  { return account ? '<div class="ip-badge"><span class="ip-badge-dot"></span>' + trunc(account) + '</div>' : '' }
  function errBox() { return lastError ? '<p class="ip-error">' + esc(lastError) + '</p>' : '' }
  function foot()   { return '<p class="ip-foot">Powered by <a href="https://inkpay.app" target="_blank">Inkpay</a> \xb7 Circle Nanopayments on Arc</p>' }

  /* ── Render ────────────────────────────────────────────────────────────── */

  function html() {
    if (state === 'success') {
      return [
        '<div class="ip-icon" style="background:#ecfdf5;color:#10b981">' + IC.check + '</div>',
        '<p class="ip-title">Article unlocked</p>',
        '<p class="ip-sub">Loading your content…</p>',
      ].join('')
    }

    if (!account) {
      return [
        '<div class="ip-icon" style="background:#eef2ff;color:#6366f1">' + IC.wallet + '</div>',
        '<p class="ip-title">Connect a wallet to unlock</p>',
        '<p class="ip-sub">MetaMask \xb7 Arc Testnet \xb7 Gas-free</p>',
        '<button class="ip-btn" id="ip-connect">Connect Wallet</button>',
        errBox(), foot(),
      ].join('')
    }

    if (state === 'checking') {
      return [badge(), IC.spin, '<p class="ip-sub">Checking your Gateway balance…</p>'].join('')
    }

    if (state === 'needs_deposit') {
      return [
        badge(),
        '<div class="ip-icon" style="background:#fffbeb;color:#f59e0b">' + IC.up + '</div>',
        '<p class="ip-title">Top up your Gateway balance</p>',
        '<p class="ip-sub">Inkpay pays via Circle Gateway — deposit USDC once and unlock articles without signing each time. <strong>' + DEPOSIT_AMOUNT + ' USDC</strong> covers ~500 reads at $0.001.</p>',
        '<button class="ip-btn" id="ip-deposit">' + IC.upSm + ' Deposit ' + DEPOSIT_AMOUNT + ' USDC</button>',
        '<p class="ip-hint">2 MetaMask confirmations \xb7 approve then deposit</p>',
        errBox(), foot(),
      ].join('')
    }

    if (state === 'depositing') {
      var aClass = depositStep === 'approving'  ? 'ip-pill-active' : 'ip-pill-done'
      var aLabel = depositStep === 'approving'  ? '● Approving…' : '✓ Approved'
      var dClass = depositStep === 'depositing' ? 'ip-pill-active' : 'ip-pill-idle'
      var dLabel = depositStep === 'depositing' ? '● Depositing…' : '○ Deposit'
      return [
        badge(),
        '<div class="ip-icon" style="background:#eef2ff;color:#6366f1">' + IC.up + '</div>',
        '<p class="ip-title">' + (depositStep === 'approving' ? 'Step 1 of 2 — Approve' : 'Step 2 of 2 — Deposit') + '</p>',
        '<p class="ip-sub">' + (depositStep === 'approving' ? 'Allow Gateway Wallet to spend your USDC' : 'Moving USDC into Gateway Wallet custody') + '</p>',
        '<div class="ip-pills">',
        '  <span class="ip-pill ' + aClass + '">' + aLabel + '</span>',
        '  <span class="ip-sep">›</span>',
        '  <span class="ip-pill ' + dClass + '">' + dLabel + '</span>',
        '</div>',
        IC.spin,
        '<p class="ip-hint">Confirm the MetaMask popup to continue</p>',
      ].join('')
    }

    // locked | loading
    var loading = (state === 'loading')
    return [
      '<div class="ip-icon" style="background:#eef2ff;color:#6366f1">' + IC.lock + '</div>',
      badge(),
      '<p class="ip-price">' + PRICE_DISPLAY + ' <span class="ip-unit">USDC</span></p>',
      '<p class="ip-sub">to unlock the full article</p>',
      '<button class="ip-btn" id="ip-unlock"' + (loading ? ' disabled' : '') + '>',
      loading ? IC.spinSm + ' Processing…' : 'Unlock Article',
      '</button>',
      errBox(), foot(),
    ].join('')
  }

  function render() {
    var body = document.getElementById('inkpay-body')
    if (!body) return
    body.innerHTML = html()
    var c = document.getElementById('ip-connect'); if (c) c.addEventListener('click', onConnect)
    var d = document.getElementById('ip-deposit'); if (d) d.addEventListener('click', onDeposit)
    var u = document.getElementById('ip-unlock');  if (u) u.addEventListener('click', onUnlock)
  }

  /* ── Wallet connect ────────────────────────────────────────────────────── */

  function onConnect() {
    if (!window.ethereum) {
      lastError = 'No wallet detected — please install MetaMask.'
      return render()
    }
    lastError = null
    document.getElementById('ip-connect').disabled = true
    window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(function (accounts) {
        account = accounts[0]
        return window.ethereum.request({ method: 'eth_chainId' })
      })
      .then(function (current) {
        if (current === ARC_CHAIN_ID) return
        return window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARC_CHAIN_ID }],
        }).catch(function (err) {
          var is4902 = err.code === 4902 ||
            (err.data && err.data.originalError && err.data.originalError.code === 4902)
          if (!is4902) throw err
          return window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARC_CHAIN_PARAMS],
          })
        })
      })
      .then(function () {
        ethProvider = new ethers.providers.Web3Provider(window.ethereum)
        ethSigner   = ethProvider.getSigner()
        state = 'checking'; render()
        return checkBalance()
      })
      .catch(function (err) {
        lastError = err.message || String(err)
        account = null; state = 'locked'; render()
      })
  }

  function checkBalance() {
    var gw = new ethers.Contract(GATEWAY_ADDR, GATEWAY_ABI, ethProvider)
    return gw.availableBalance(USDC_ADDR, account)
      .then(function (bal) {
        state = bal.lt(THRESHOLD) ? 'needs_deposit' : 'locked'
      })
      .catch(function (err) {
        console.warn('[inkpay] balance check failed:', err.message)
        state = 'locked' // fail open
      })
      .then(render)
  }

  /* ── Deposit ───────────────────────────────────────────────────────────── */

  function onDeposit() {
    lastError = null; state = 'depositing'; depositStep = 'approving'; render()

    var usdc = new ethers.Contract(
      USDC_ADDR,
      ['function approve(address,uint256) returns (bool)'],
      ethSigner
    )
    var gw  = new ethers.Contract(GATEWAY_ADDR, GATEWAY_ABI, ethSigner)
    var amt = ethers.BigNumber.from(DEPOSIT_ATOMIC)

    // Tx 1 — approve
    usdc.approve(GATEWAY_ADDR, amt)
      .then(function (tx) { return tx.wait() })
      .then(function () {
        depositStep = 'depositing'; render()
        // Tx 2 — deposit
        return gw.deposit(USDC_ADDR, amt, { gasLimit: 120000 })
      })
      .then(function (tx) { return tx.wait() })
      .then(function () {
        depositStep = null; state = 'locked'
      })
      .catch(function (err) {
        lastError = err.message || String(err)
        depositStep = null; state = 'needs_deposit'
      })
      .then(render)
  }

  /* ── x402 payment ──────────────────────────────────────────────────────── */

  function rnd32() {
    var b = new Uint8Array(32)
    crypto.getRandomValues(b)
    return '0x' + Array.from(b, function (x) { return x.toString(16).padStart(2, '0') }).join('')
  }

  function b64e(obj) { return btoa(JSON.stringify(obj)) }
  function b64d(str) { return JSON.parse(atob(str)) }

  function onUnlock() {
    lastError = null; state = 'loading'; render()

    var articleSlug = slug()
    var endpoint    = API_BASE + '/api/payments/unlock/' + encodeURIComponent(articleSlug) +
      (SELLER ? '?seller=' + encodeURIComponent(SELLER) : '')

    // Step 1 — fetch 402 challenge
    fetch(endpoint)
      .then(function (r1) {
        if (r1.status !== 402) {
          throw new Error('Expected 402 from ' + API_BASE + ' — is the Inkpay server reachable? (got ' + r1.status + ')')
        }
        var challenge = b64d(r1.headers.get('PAYMENT-REQUIRED'))
        var accepted  = challenge.accepts[0]
        var chainId   = parseInt(accepted.network.split(':')[1], 10)
        var now       = Math.floor(Date.now() / 1000)
        var vBefore   = String(now + Math.max(accepted.maxTimeoutSeconds, 7 * 24 * 3600 + 600))
        var vAfter    = String(now - 600)
        var nonce     = rnd32()

        // Step 2 — EIP-712 sign (no gas, no on-chain tx)
        var typedData = {
          types: {
            EIP712Domain: [
              { name: 'name',              type: 'string'  },
              { name: 'version',           type: 'string'  },
              { name: 'chainId',           type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            TransferWithAuthorization: [
              { name: 'from',        type: 'address' },
              { name: 'to',         type: 'address' },
              { name: 'value',      type: 'uint256' },
              { name: 'validAfter', type: 'uint256' },
              { name: 'validBefore',type: 'uint256' },
              { name: 'nonce',      type: 'bytes32' },
            ],
          },
          primaryType: 'TransferWithAuthorization',
          domain: {
            name: 'GatewayWalletBatched', version: '1',
            chainId: chainId,
            verifyingContract: accepted.extra.verifyingContract,
          },
          message: {
            from: account, to: accepted.payTo, value: accepted.amount,
            validAfter: vAfter, validBefore: vBefore, nonce: nonce,
          },
        }

        return window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [account, JSON.stringify(typedData)],
        }).then(function (sig) {
          console.log('[inkpay] eth_signTypedData_v4 succeeded, sig:', sig.slice(0, 20) + '…')
          // Step 3 — retry with signed payload
          var payload = {
            x402Version: 2,
            payload: {
              signature: sig,
              authorization: {
                from: account, to: accepted.payTo, value: accepted.amount,
                validAfter: vAfter, validBefore: vBefore, nonce: nonce,
              },
            },
            accepted: accepted,
            resource: challenge.resource,
          }
          console.log('[inkpay] sending retry fetch with payment-signature header to', endpoint)
          return fetch(endpoint, { headers: { 'payment-signature': b64e(payload) } })
        }, function (sigErr) {
          console.log('[inkpay] eth_signTypedData_v4 failed:', {
            code: sigErr.code,
            message: sigErr.message,
            fullError: sigErr,
          })
          throw sigErr
        })
      })
      .then(function (r2) {
        if (r2.ok) return r2.json()
        return r2.json().catch(function () { return {} }).then(function (body) {
          throw new Error(body.error || 'Payment failed (' + r2.status + ')')
        })
      })
      .then(function () {
        markUnlocked()
        state = 'success'; render()
        setTimeout(revealContent, 1200)
      })
      .catch(function (err) {
        lastError = err.message || String(err)
        state = 'locked'; render()
      })
  }

  /* ── Reveal ────────────────────────────────────────────────────────────── */

  function revealContent() {
    if (hiddenEl) { hiddenEl.style.display = ''; hiddenEl.id = '' }
    if (fadeEl)   { fadeEl.remove(); fadeEl = null }
    if (wrapEl)   { wrapEl.remove(); wrapEl = null }
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  function boot() {
    // Only run on post pages, not the home page or tag/author archives
    if (window.location.pathname === '/') return
    if (!document.querySelector('.gh-content, .post-content, .post-full-content, article')) return

    // Already unlocked — show everything immediately
    if (isUnlocked()) return

    var container = findContent()
    if (!container) {
      console.warn('[inkpay] No article content container found (tried .gh-content, .post-content, etc.)')
      return
    }

    injectCSS()
    if (!scaffold(container)) return

    // Inject card markup, then render initial state
    wrapEl.innerHTML =
      '<div id="inkpay-card">' +
        '<div id="inkpay-accent"></div>' +
        '<div id="inkpay-body"></div>' +
      '</div>'
    render()
  }

  // Dynamically load ethers v5 from CDN, then boot once DOM is ready
  var ethersScript    = document.createElement('script')
  ethersScript.src    = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js'
  ethersScript.onload = function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot)
    } else {
      boot()
    }
  }
  ethersScript.onerror = function () {
    console.error('[inkpay] Failed to load ethers.js from CDN — paywall will not function.')
  }
  document.head.appendChild(ethersScript)
})()
