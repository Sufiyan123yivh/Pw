import fetch from "node-fetch";

export default async function handler(req, res) {
  const { url } = req.query; // e.g. /api/proxy?url=https://example.com/master.m3u8
  if (!url) return res.status(400).send("Missing url parameter");

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send("Upstream error");
    }

    const contentType = upstream.headers.get("content-type") || "";
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Check if it's a playlist
    if (contentType.includes("application/vnd.apple.mpegurl") || url.endsWith(".m3u8")) {
      const text = await upstream.text();
      const baseUrl = new URL(url);

      // Rewrite both .m3u8 (master/media) and segment URLs
      const proxied = text.replace(/^(?!#)(.*)$/gm, (line) => {
        // Ignore comments (#EXT...)
        if (line.startsWith("#")) return line;

        // Absolute URL or relative → normalize
        const absUrl = new URL(line, baseUrl).toString();

        // Send back through proxy
        return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(proxied);
    } else {
      // Not a playlist → stream directly (e.g. TS, MP4, etc.)
      upstream.headers.forEach((v, k) => res.setHeader(k, v));
      upstream.body.pipe(res);
    }
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
