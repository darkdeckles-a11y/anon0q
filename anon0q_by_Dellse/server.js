// Basic anon0q dev proxy server (Node.js + Express).
// This is intentionally simple and not production-safe.

const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Static frontend ---
// Adjust this to point to your anon0q front-end directory.
const FRONTEND_DIR = __dirname;

// Serve index.html, style.css, main.js, viewer.html, logo, fonts, etc.
app.use(express.static(FRONTEND_DIR));

// --- Very simple proxy endpoint ---
// Usage: /proxy?url=<encoded target URL>
app.get("/proxy", async (req, res) => {
  const target = req.query.url;

  if (!target) {
    return res.status(400).send("Missing url parameter");
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch (err) {
    return res.status(400).send("Invalid url parameter");
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        // Forward some basic headers, but never host/origin directly.
        "User-Agent": req.headers["user-agent"] || "anon0q-proxy",
        Accept: req.headers["accept"] || "*/*",
      },
    });

    // Copy status
    res.status(upstream.status);

    // Copy headers, with light filtering
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();

      // Strip hop-by-hop and security headers that don't make sense in a proxy context
      if (
        [
          "transfer-encoding",
          "connection",
          "keep-alive",
          "proxy-authenticate",
          "proxy-authorization",
          "te",
          "trailer",
          "upgrade",
        ].includes(lower)
      ) {
        return;
      }

      // You may also want to strip CSP, X-Frame-Options, etc. for some sites.
      if (["content-security-policy", "x-frame-options"].includes(lower)) {
        return;
      }

      res.setHeader(key, value);
    });

    // Basic CORS so the iframe can load in browsers if needed
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Stream body
    upstream.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).send("Error fetching target URL");
  }
});

// --- Fallback to index.html for root ---
app.get("/", (req, res) => {
  const indexPath = path.join(FRONTEND_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("index.html not found");
  }
});

app.listen(PORT, () => {
  console.log(`anon0q dev proxy listening on http://localhost:${PORT}`);
});