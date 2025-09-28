// /api/restream.js
const SOURCE_URL = "https://billatv.pages.dev/Testing.txt";

export default async function handler(req, res) {
  const urlParam = req.query.url; // For TS or nested m3u8 URLs

  try {
    // Proxy TS or nested .m3u8 URLs
    if (urlParam) {
      const fetched = await fetch(urlParam, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!fetched.ok) {
        res.status(500).send("Failed to fetch segment");
        return;
      }

      if (urlParam.endsWith(".ts")) {
        const buffer = Buffer.from(await fetched.arrayBuffer());
        res.setHeader("Content-Type", "video/mp2t");
        res.send(buffer);
      } else {
        const text = await fetched.text();
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.send(text);
      }
      return;
    }

    // Fetch the main playlist
    const fetched = await fetch(SOURCE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!fetched.ok) {
      res.status(500).send("Failed to fetch playlist");
      return;
    }

    const text = await fetched.text();
    const lines = text.split("\n");
    let newPlaylist = "#EXTM3U\n";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF")) {
        // Copy metadata
        newPlaylist += line + "\n";
        // Next line should be the URL
        const urlLine = lines[i + 1]?.trim();
        if (urlLine) {
          // Rewrite URL to go through this Vercel function
          const host = req.headers.host;
          const protocol = req.headers["x-forwarded-proto"] || "https";
          newPlaylist += `${protocol}://${host}/api/restream?url=${encodeURIComponent(urlLine)}\n`;
        }
      }
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(newPlaylist);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
}
