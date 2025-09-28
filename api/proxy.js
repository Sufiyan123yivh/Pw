import fetch from "node-fetch";

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url parameter");

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
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

      // Rewrite ALL absolute/relative URLs in playlist
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
