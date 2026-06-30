// inject.js — runs in the page's MAIN world at document_start.
// It wraps fetch/XHR so we can read the JSON that Shopee's own (already-signed)
// requests return. We never make our own Shopee API calls -> no anti-bot 403.
(function () {
  if (window.__STS_INSTALLED__) return;
  window.__STS_INSTALLED__ = true;

  const isInteresting = (url) =>
    typeof url === 'string' &&
    url.indexOf('/api/') !== -1 &&
    /search|recommend|rcmd|top_products|item|product|bff|pages|flash|daily/i.test(url);

  const post = (url, body) => {
    if (!body || typeof body !== 'object') return;
    try {
      window.postMessage({ __sts: true, url: String(url), body }, '*');
    } catch (_) {}
  };

  // --- patch fetch ---
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (...args) {
      const input = args[0];
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const p = origFetch.apply(this, args);
      if (isInteresting(url)) {
        p.then((res) => {
          try {
            res.clone().json().then((b) => post(url, b)).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      }
      return p;
    };
  }

  // --- patch XHR ---
  const XP = XMLHttpRequest.prototype;
  const origOpen = XP.open;
  const origSend = XP.send;
  XP.open = function (method, url) {
    this.__sts_url = url;
    return origOpen.apply(this, arguments);
  };
  XP.send = function () {
    this.addEventListener('load', function () {
      try {
        const url = this.__sts_url || '';
        if (!isInteresting(url)) return;
        if (this.responseType === 'json' && this.response) {
          post(url, this.response);
        } else if (this.responseType === '' || this.responseType === 'text') {
          try { post(url, JSON.parse(this.responseText)); } catch (_) {}
        }
      } catch (_) {}
    });
    return origSend.apply(this, arguments);
  };

  console.log('[Shopee Trend Studio] interceptor installed');
})();
