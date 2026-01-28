// Basic anon0q Cloudflare Worker proxy.
// This is intentionally simple and not production-safe.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only handle /proxy requests; everything else gets a simple response.
    if (url.pathname !== "/proxy") {
      return new Response(
        "anon0q worker: use /proxy?url=<encoded target URL>",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url parameter", { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response("Invalid url parameter", { status: 400 });
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        // Only forward a very small subset of headers for safety.
        headers: {
          "User-Agent":
            request.headers.get("User-Agent") || "anon0q-cloudflare-proxy",
          Accept: request.headers.get("Accept") || "*/*",
        },
        // We don’t forward the body here; this keeps the example simple and GET-only.
      });

      // Clone response headers, lightly filtered.
      const responseHeaders = new Headers(upstream.headers);

      // Remove hop-by-hop and some security headers that interfere with framing.
      const stripHeaders = [
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "upgrade",
        "content-security-policy",
        "x-frame-options",
        "content-length",
        "content-encoding",
      ];

      for (const h of stripHeaders) {
        responseHeaders.delete(h);
      }

      // Allow any origin to embed via iframe.
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      const contentType = upstream.headers.get("content-type") || "";

      // For HTML responses, inject a small script that keeps all in-page
      // navigation going back through this /proxy endpoint.
      if (contentType.includes("text/html")) {
        const originalHtml = await upstream.text();

        const injection = `
<script>
(function() {
  function toProxiedUrl(href) {
    try {
      // Always route via the worker's /proxy endpoint
      return '/proxy?url=' + encodeURIComponent(href);
    } catch (e) {
      return null;
    }
  }

  document.addEventListener('click', function(e) {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;

    // Respect modifier keys / new-tab behavior.
    if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const href = a.href;
    if (!href) return;

    const proxied = toProxiedUrl(href);
    if (!proxied) return;

    e.preventDefault();
    window.location.href = proxied;
  }, true);

  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (!form || !form.action) return;

    const proxied = toProxiedUrl(form.action);
    if (!proxied) return;

    // Keep this simple: we only support GET-like navigation via proxy.
    // Let non-GET methods fall through unmodified.
    if ((form.method || 'GET').toUpperCase() !== 'GET') return;

    e.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    const url = proxied + (params.toString() ? '&' + params.toString() : '');
    window.location.href = url;
  }, true);
})();
</script>`;

        let injectedHtml;
        if (originalHtml.includes("</body>")) {
          injectedHtml = originalHtml.replace("</body>", injection + "\n</body>");
        } else {
          injectedHtml = originalHtml + injection;
        }

        return new Response(injectedHtml, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      // Non-HTML: just stream through as before.
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response("Error fetching target URL", { status: 502 });
    }
  },
};