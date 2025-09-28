// /api/restream.js
const SOURCE_URL = "https://billatv.pages.dev/Testing.txt";

// In-memory cache to store channel name → stream URL mapping
let CHANNELS = null;

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
      // Extract channel name from metadata line (after last comma)
      const parts = line.split(",");
      const name = parts[parts.length - 1].trim();

      // Next line should be the URL
      const urlLine = lines[i + 1]?.trim();
      if (urlLine) {
        channels[name] = urlLine;
      }
    }
  }

  CHANNELS = channels;
  return channels;
}

export default async function handler(req, res) {
  try {
    const query = req.query;
    const tsUrl = query.ts;
    const channelName = query.channel;

    // Proxy TS segments
    if (tsUrl) {
      const tsRes = await fetch(tsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const buffer = Buffer.from(await tsRes.arrayBuffer());
      res.setHeader("Content-Type", "video/mp2t");
      return res.send(buffer);
    }

    // Load channel mappings
    const channels = await loadChannels();

    // If user requested a specific channel
    if (channelName) {
      const streamUrl = channels[channelName];
      if (!streamUrl) return res.status(404).send("Channel not found");

      const fetched = await fetch(streamUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const text = await fetched.text();

      // Rewrite all .ts URLs to proxy through this function
      const host = req.headers.host;
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const newPlaylist = text.replace(/(https?:\/\/[^\s]+)/g, (match) =>
        `${protocol}://${host}/api/restream?ts=${encodeURIComponent(match)}`
      );

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(newPlaylist);
    }

    // If no channel specified, return a list of channels
    return res.status(200).json({ channels: Object.keys(channels) });
  } catch (err) {
    return res.status(500).send("Error: " + err.message);
  }
}
