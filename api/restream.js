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
      try {
        const tsRes = await fetch(ts, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
            "Referer": "https://www.sonyliv.com/",
          },
        });

        if (!tsRes.ok) return res.status(403).send("Segment not accessible");

        const buffer = Buffer.from(await tsRes.arrayBuffer());
        res.setHeader("Content-Type", "video/mp2t");
        return res.send(buffer);
      } catch {
        return res.status(403).send("Segment fetch failed");
      }
    }

    const channels = await loadChannels();

    // Return list of channels if channel param missing
    if (!channel || !channels[channel]) {
      return res.status(200).json({ channels: Object.keys(channels) });
    }

    let streamUrl = channels[channel];

    // If SonyLIV, fetch fresh signed URL (auto-refresh)
    if (streamUrl.includes("slivcdn.com")) {
      // Example: call a function/API that returns fresh signed URL for this channel
      // You must implement this based on your source that generates new hdntl URLs
      streamUrl = await getFreshSonyLivUrl(channel);
    }

    // Fetch playlist
    const fetched = await fetch(streamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
        "Referer": "https://www.sonyliv.com/",
      },
    });

    let text = await fetched.text();

    // Rewrite URLs to go through restream API
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";

    text = text.replace(/(https?:\/\/[^\s]+)/g, (match) => {
      try {
        const url = new URL(match);
        return `${protocol}://${host}/api/restream?ts=${encodeURIComponent(url.href)}`;
      } catch {
        return "";
      }
    });

    // Remove empty lines caused by invalid/expired URLs
    text = text.split("\n").filter(line => line.trim() !== "").join("\n");

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(text);

  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
}

// Example placeholder function for getting fresh SonyLIV URL
async function getFreshSonyLivUrl(channel) {
  // You must implement this function based on how you generate fresh hdntl URLs
  // For example, scraping, API request, or your own signed URL generator
  // Returning the same old URL here for placeholder
  const channels = await loadChannels();
  return channels[channel];
}
