// /api/guu.js
import fs from "fs";
import path from "path";

// ⚙️ Configuration (edit these)
const config = {
  url: "http://tv.fusion4k.cc", // base URL (no trailing slash)
  mac: "00:1A:79:7F:0C:2C",
  sn: "34B7721BF84DD",
  device_id_1:
    "EB1729D3A7D23E502EEF473848A7DEC8B1C234DE5318093C6616A6464BCD6BA8",
  device_id_2:
    "EB1729D3A7D23E502EEF473848A7DEC8B1C234DE5318093C6616A6464BCD6BA8",
  sig: "",
  api: "263",
  cacheTTL: 300, // optional: 5-minute playlist cache
};

// 🧩 Utility: resolve host
const host = new URL(config.url).host;

// 🧩 Token + cache paths
const tokenFile = path.join("/tmp", `${host}_token.txt`);
const playlistFile = path.join("/tmp", `${host}_playlist.m3u`);

// 🧩 Helper for fetch requests
async function fetchInfo(url, headers) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...headers,
      Cookie: `mac=${config.mac}; stb_lang=en; timezone=GMT`,
    },
  });
  const text = await res.text();
  try {
    return { data: JSON.parse(text), raw: text };
  } catch {
    return { data: { js: {} }, raw: text };
  }
}

// 🔹 Handshake
async function handshake() {
  const Xurl = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `http://${host}/stalker_portal/c/`,
    Host: host,
  };
  const res = await fetchInfo(Xurl, headers);
  const token = res.data?.js?.token || "";
  const random = res.data?.js?.random || "";
  return { token, random };
}

// 🔹 Re-handshake with token
async function reGenerateToken(token) {
  const Xurl = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=${token}&JsHttpRequest=1-xml`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `http://${host}/stalker_portal/c/`,
    Host: host,
  };
  const res = await fetchInfo(Xurl, headers);
  return res.data?.js?.token || token;
}

// 🔹 Get profile (register device)
async function getProfile(token) {
  const { random } = await handshake();
  const timestamp = Math.floor(Date.now() / 1000);
  const url = `http://${host}/stalker_portal/server/load.php?type=stb&action=get_profile&sn=${config.sn}&device_id=${config.device_id_1}&device_id2=${config.device_id_2}&signature=${config.sig}&timestamp=${timestamp}&api_signature=${config.api}&JsHttpRequest=1-xml`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `http://${host}/stalker_portal/c/`,
    Authorization: `Bearer ${token}`,
    Host: host,
  };
  await fetchInfo(url, headers);
}

// 🔹 Token generation + caching
async function generateToken() {
  const { token } = await handshake();
  const validToken = await reGenerateToken(token);
  await getProfile(validToken);
  fs.writeFileSync(tokenFile, validToken);
  return validToken;
}

// 🔹 Get token (reuse if cached)
async function getToken() {
  if (fs.existsSync(tokenFile)) {
    const saved = fs.readFileSync(tokenFile, "utf8").trim();
    if (saved) return saved;
  }
  return generateToken();
}

// 🔹 Request headers builder
function buildHeaders(token) {
  return {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `http://${host}/stalker_portal/c/`,
    Authorization: `Bearer ${token}`,
    Host: host,
  };
}

// 🔹 Get all channels
async function getAllChannels(token) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  return res.data?.js?.data || [];
}

// 🔹 Get all genres
async function getGenres(token) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  const arr = res.data?.js || [];
  const map = {};
  for (const g of arr) if (g.id !== "*") map[g.id] = g.title;
  return map;
}

// 🔹 Create stream URL (with retry)
async function getStreamUrl(token, id) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  let link = res.data?.js?.cmd || null;

  if (!link) {
    // Retry if token expired
    const newToken = await generateToken();
    const retry = await fetchInfo(url, buildHeaders(newToken));
    link = retry.data?.js?.cmd || null;
  }

  return link;
}

// 🔹 Logo helper
function getLogo(logo) {
  if (!logo || (!logo.endsWith(".png") && !logo.endsWith(".jpg"))) {
    return "https://i.ibb.co/gLsp7Vrz/x.jpg";
  }
  return `http://${host}/stalker_portal/misc/logos/320/${logo}`;
}

// 🔹 Cache check helper
function isCacheValid(file, ttlSec) {
  if (!fs.existsSync(file)) return false;
  const age = (Date.now() - fs.statSync(file).mtimeMs) / 1000;
  return age < ttlSec;
}

// 🧩 Vercel API handler
export default async function handler(req, res) {
  try {
    const token = await getToken();
    const baseUrl = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/guu`;

    // ▶️ If id provided → redirect to stream
    if (req.query.id) {
      const id = req.query.id;
      const streamUrl = await getStreamUrl(token, id);
      if (!streamUrl) {
        res.status(500).send("Failed to fetch stream link");
        return;
      }
      res.writeHead(302, { Location: streamUrl });
      res.end();
      return;
    }

    // 📁 Serve cached playlist if valid
    if (isCacheValid(playlistFile, config.cacheTTL)) {
      const cached = fs.readFileSync(playlistFile, "utf8");
      res.setHeader("Content-Type", "audio/x-mpegurl");
      res.send(cached);
      return;
    }

    // 🎶 Build new playlist
    const [channels, genres] = await Promise.all([
      getAllChannels(token),
      getGenres(token),
    ]);

    let playlist = `#EXTM3U\n#DATE:- ${new Date().toLocaleString("en-IN")}\n\n`;

    for (const ch of channels) {
      const group = genres[ch.tv_genre_id] || "Others";
      const logo = getLogo(ch.logo);
      const id = ch.cmd.replace("ffrt http://localhost/ch/", "");
      const playUrl = `${baseUrl}?id=${encodeURIComponent(id)}`;
      playlist += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n${playUrl}\n\n`;
    }

    fs.writeFileSync(playlistFile, playlist);
    res.setHeader("Content-Type", "audio/x-mpegurl");
    res.setHeader("Content-Disposition", 'inline; filename="playlist.m3u"');
    res.send(playlist);
  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).send("Server error: " + err.message);
  }
}    if (g.id !== "*") map[g.id] = g.title;
  }
  return map;
}

// Generate stream URL
async function getStreamUrl(token, id) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  return res.data?.js?.cmd || null;
}

// Helper: image fallback
function getLogo(logo) {
  if (!logo || !logo.endsWith(".png") && !logo.endsWith(".jpg")) {
    return "https://i.ibb.co/gLsp7Vrz/x.jpg";
  }
  return `http://${host}/stalker_portal/misc/logos/320/${logo}`;
}

// 🔹 Vercel API route handler
export default async function handler(req, res) {
  try {
    const token = await getToken();
    const baseUrl = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/fusion4k`;

    // If ?id=channel_id → redirect to stream
    if (req.query.id) {
      const id = req.query.id;
      const streamUrl = await getStreamUrl(token, id);
      if (!streamUrl) {
        res.status(500).send("Failed to fetch stream link");
      } else {
        res.writeHead(302, { Location: streamUrl });
        res.end();
      }
      return;
    }

    // Otherwise → generate playlist
    const [channels, genres] = await Promise.all([
      getAllChannels(token),
      getGenres(token),
    ]);

    let playlist = `#EXTM3U\n#DATE:- ${new Date().toLocaleString("en-IN")}\n\n`;

    for (const ch of channels) {
      const group = genres[ch.tv_genre_id] || "Others";
      const logo = getLogo(ch.logo);
      const id = ch.cmd.replace("ffrt http://localhost/ch/", "");
      const playUrl = `${baseUrl}?id=${encodeURIComponent(id)}`;
      playlist += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n${playUrl}\n\n`;
    }

    res.setHeader("Content-Type", "audio/x-mpegurl");
    res.setHeader("Content-Disposition", 'inline; filename="playlist.m3u"');
    res.send(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
}
