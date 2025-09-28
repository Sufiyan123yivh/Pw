import fetch from "node-fetch";

// Fixed User-Agent
const FIXED_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url parameter");

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": FIXED_UA,
        "Accept": "*/*",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res
        .status(upstream.status)
        .send(`Upstream error ${upstream.status}: ${text}`);
    }

    const contentType = upstream.headers.get("content-type") || "";
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (contentType.includes("mpegurl") || url.endsWith(".m3u8")) {
      const playlist = await upstream.text();
      const baseUrl = new URL(url);

      // Rewrite all URLs inside playlist
      const proxied = playlist.replace(/^(?!#)(.*)$/gm, (line) => {
        if (line.startsWith("#")) return line;
        const absUrl = new URL(line, baseUrl).toString();
        return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(proxied);
    } else {
      upstream.headers.forEach((v, k) => res.setHeader(k, v));
      upstream.body.pipe(res);
    }
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
