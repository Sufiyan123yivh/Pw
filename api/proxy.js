import fetch from "node-fetch";

// Fixed User-Agent
const FIXED_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  // Get full URL after ?url= (includes all & and ~ characters)
  const rawUrl = req.url.split("?url=")[1];
  if (!rawUrl) return res.status(400).send("Missing url parameter");

  // Decode in case the URL was encoded
  const url = decodeURIComponent(rawUrl);

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

    // Playlist (.m3u8) handling
    if (contentType.includes("mpegurl") || url.endsWith(".m3u8")) {
      const playlist = await upstream.text();
      const baseUrl = new URL(url);

      // Rewrite ALL URLs inside playlist (master/media/segments)
      const proxied = playlist.replace(/^(?!#)(.*)$/gm, (line) => {
        if (line.startsWith("#")) return line;
        const absUrl = new URL(line, baseUrl).toString();
        return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(proxied);
    } else {
      // Non-playlist → pipe directly
      upstream.headers.forEach((v, k) => res.setHeader(k, v));
      upstream.body.pipe(res);
    }
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
