// /api/restream.js
const SOURCE_URL = "https://billatv.pages.dev/Testing.txt";
let CHANNELS = null;

// Load channels from playlist
async function loadChannels() {
  if (CHANNELS) return CHANNELS;

  const res = await fetch(SOURCE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Failed to fetch playlist");

  const text = await res.text();
  const lines = text.split("\n");
  const channels = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const parts = line.split(",");
      const name = parts[parts.length - 1].trim();
      const urlLine = lines[i + 1]?.trim();
      if (urlLine) channels[name] = urlLine;
    }
  }

  CHANNELS = channels;
  return channels;
}

export default async function handler(req, res) {
  try {
    const { ts, channel } = req.query;

    // Proxy TS segments
    if (ts) {
      const tsRes = await fetch(ts, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://example.com", // optional, some servers require it
        },
      });
      const buffer = Buffer.from(await tsRes.arrayBuffer());
      res.setHeader("Content-Type", "video/mp2t");
      return res.send(buffer);
    }

    const channels = await loadChannels();

    // If no channel or invalid, return JSON list
    if (!channel || !channels[channel]) {
      return res.status(200).json({ channels: Object.keys(channels) });
    }

    const streamUrl = channels[channel];

    // Fetch playlist
    const fetched = await fetch(streamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://example.com", // optional
      },
    });

    let text = await fetched.text();

    // Rewrite all URLs in playlist (both multi-bitrate and segment URLs)
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";

    text = text.replace(/(https?:\/\/[^\s]+)/g, (match) => {
      return `${protocol}://${host}/api/restream?ts=${encodeURIComponent(match)}`;
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(text);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
}
