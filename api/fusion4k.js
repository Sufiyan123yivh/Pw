// /api/guu.js
// Vercel-friendly, safe, serverless version

let cache = {
  token: null,
  playlist: null,
  tokenTime: 0,
  playlistTime: 0,
};

const config = {
  url: "https://tv.fusion4k.cc", // use HTTPS if possible
  mac: "00:1A:79:7F:0C:2C",
  sn: "34B7721BF84DD",
  device_id_1:
    "EB1729D3A7D23E502EEF473848A7DEC8B1C234DE5318093C6616A6464BCD6BA8",
  device_id_2:
    "EB1729D3A7D23E502EEF473848A7DEC8B1C234DE5318093C6616A6464BCD6BA8",
  sig: "",
  api: "263",
  cacheTTL: 300, // seconds
};

const host = new URL(config.url).host;

// 🔹 Safe fetch utility
async function safeFetchJson(url, headers) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.warn("Non-JSON response from:", url);
      return {};
    }
  } catch (err) {
    console.error("Fetch error:", url, err);
    return {};
  }
}

// 🔹 Headers
function buildHeaders(token) {
  return {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver:2 rev:250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `https://${host}/stalker_portal/c/`,
    Authorization: token ? `Bearer ${token}` : undefined,
  };
}

// 🔹 Token handling
async function handshake() {
  const url = `https://${host}/stalker_portal/server/load.php?type=stb&action=handshake&JsHttpRequest=1-xml`;
  const data = await safeFetchJson(url, buildHeaders());
  return data?.js?.token || "";
}

async function generateToken() {
  const token = await handshake();
  cache.token = token;
  cache.tokenTime = Date.now();
  return token;
}

async function getToken() {
  const fresh = Date.now() - cache.tokenTime < 3600 * 1000;
  if (cache.token && fresh) return cache.token;
  return generateToken();
}

// 🔹 Channels & Genres
async function getAllChannels(token) {
  const url = `https://${host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
  const data = await safeFetchJson(url, buildHeaders(token));
  return data?.js?.data || [];
}

async function getGenres(token) {
  const url = `https://${host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const data = await safeFetchJson(url, buildHeaders(token));
  const arr = data?.js || [];
  const map = {};
  for (const g of arr) if (g.id !== "*") map[g.id] = g.title;
  return map;
}

// 🔹 Stream URL
async function getStreamUrl(token, id) {
  const url = `https://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
  const data = await safeFetchJson(url, buildHeaders(token));
  return data?.js?.cmd || null;
}

// 🔹 Logo helper
function getLogo(logo) {
  if (!logo || (!logo.endsWith(".png") && !logo.endsWith(".jpg"))) {
    return "https://i.ibb.co/gLsp7Vrz/x.jpg";
  }
  return `https://${host}/stalker_portal/misc/logos/320/${logo}`;
}

// 🔹 Main handler
export default async function handler(req, res) {
  try {
    console.log("Starting /api/guu request...");
    const token = await getToken();
    const baseUrl = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/guu`;

    // ▶️ Redirect to live stream if ?id
    if (req.query.id) {
      const link = await getStreamUrl(token, req.query.id);
      if (!link) {
        console.error("Failed to fetch stream link for id:", req.query.id);
        return res.status(500).send("Failed to create stream link");
      }
      res.writeHead(302, { Location: link });
      return res.end();
    }

    // 📁 Serve cached playlist
    const isCacheValid =
      cache.playlist && Date.now() - cache.playlistTime < config.cacheTTL * 1000;
    if (isCacheValid) {
      res.setHeader("Content-Type", "audio/x-mpegurl");
      return res.send(cache.playlist);
    }

    // 🎶 Build playlist
    const [channels, genres] = await Promise.all([getAllChannels(token), getGenres(token)]);
    let playlist = `#EXTM3U\n#DATE:- ${new Date().toLocaleString("en-IN")}\n\n`;
    for (const ch of channels) {
      const group = genres[ch.tv_genre_id] || "Others";
      const logo = getLogo(ch.logo);
      const id = ch.cmd.replace("ffrt http://localhost/ch/", "");
      const playUrl = `${baseUrl}?id=${encodeURIComponent(id)}`;
      playlist += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n${playUrl}\n\n`;
    }

    cache.playlist = playlist;
    cache.playlistTime = Date.now();

    res.setHeader("Content-Type", "audio/x-mpegurl");
    res.setHeader("Content-Disposition", 'inline; filename="playlist.m3u"');
    res.send(playlist);

  } catch (err) {
    console.error("❌ Serverless function crashed:", err);
    res.status(500).send("Serverless function error: " + err.message);
  }
}
