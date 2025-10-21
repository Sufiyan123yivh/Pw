// /api/guu.js
import fs from "fs";
import path from "path";

// ⚙️ Configuration
const config = {
  url: "http://tv.fusion4k.cc",
  mac: "00:1A:79:7F:0C:2C",
  sn: "34B7721BF84DD",
  device_id_1:
    "EB1729D3A7D23E502EEF473848A7DEC8B1C234DE5318093C6616A6464BCD6BA8",
  device_id_2:
    "EB1729D3A7D23E502EEF473848A7DEC8B1C234DE5318093C6616A6464BCD6BA8",
  sig: "",
  api: "263",
  cacheTTL: 300, // cache time in seconds
};

// 🧩 Derived values
const host = new URL(config.url).host;
const tokenFile = path.join("/tmp", `${host}_token.txt`);
const playlistFile = path.join("/tmp", `${host}_playlist.m3u`);

// 🔹 Utility fetch wrapper
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
  const url = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `http://${host}/stalker_portal/c/`,
  };
  const res = await fetchInfo(url, headers);
  return { token: res.data?.js?.token || "", random: res.data?.js?.random || "" };
}

// 🔹 Re-generate token
async function reGenerateToken(token) {
  const url = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=${token}&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders());
  return res.data?.js?.token || token;
}

// 🔹 Register device
async function getProfile(token) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = `http://${host}/stalker_portal/server/load.php?type=stb&action=get_profile&sn=${config.sn}&device_id=${config.device_id_1}&device_id2=${config.device_id_2}&signature=${config.sig}&timestamp=${timestamp}&api_signature=${config.api}&JsHttpRequest=1-xml`;
  await fetchInfo(url, buildHeaders(token));
}

// 🔹 Token management
async function generateToken() {
  const { token } = await handshake();
  const validToken = await reGenerateToken(token);
  await getProfile(validToken);
  fs.writeFileSync(tokenFile, validToken);
  return validToken;
}

async function getToken() {
  if (fs.existsSync(tokenFile)) {
    const saved = fs.readFileSync(tokenFile, "utf8").trim();
    if (saved) return saved;
  }
  return generateToken();
}

// 🔹 Headers
function buildHeaders(token) {
  return {
    "User-Agent":
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `http://${host}/stalker_portal/c/`,
    Authorization: `Bearer ${token}`,
  };
}

// 🔹 Fetch all channels
async function getAllChannels(token) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  return res.data?.js?.data || [];
}

// 🔹 Fetch genres
async function getGenres(token) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  const arr = res.data?.js || [];
  const map = {};
  for (const g of arr) if (g.id !== "*") map[g.id] = g.title;
  return map;
}

// 🔹 Stream URL
async function getStreamUrl(token, id) {
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
  const res = await fetchInfo(url, buildHeaders(token));
  let link = res.data?.js?.cmd || null;

  if (!link) {
    // retry with new token
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

// 🔹 Cache checker
function isCacheValid(file, ttlSec) {
  if (!fs.existsSync(file)) return false;
  const age = (Date.now() - fs.statSync(file).mtimeMs) / 1000;
  return age < ttlSec;
}

// 🔹 Main API Handler
export default async function handler(req, res) {
  try {
    const token = await getToken();
    const baseUrl = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/guu`;

    // If ?id is provided → redirect to live stream
    if (req.query.id) {
      const streamUrl = await getStreamUrl(token, req.query.id);
      if (!streamUrl) return res.status(500).send("Failed to fetch stream link");
      res.writeHead(302, { Location: streamUrl });
      return res.end();
    }

    // Serve cached playlist
    if (isCacheValid(playlistFile, config.cacheTTL)) {
      const cached = fs.readFileSync(playlistFile, "utf8");
      res.setHeader("Content-Type", "audio/x-mpegurl");
      return res.send(cached);
    }

    // Build fresh playlist
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
}  return res.data?.js?.cmd || null;
}

function getLogo(logo) {
  if (!logo || (!logo.endsWith(".png") && !logo.endsWith(".jpg")))
    return "https://i.ibb.co/gLsp7Vrz/x.jpg";
  return `http://${host}/stalker_portal/misc/logos/320/${logo}`;
}

function isCacheValid(file, ttlSec) {
  try {
    if (!fs.existsSync(file)) return false;
    const age = (Date.now() - fs.statSync(file).mtimeMs) / 1000;
    return age < ttlSec;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const token = await getToken();
    const baseUrl = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/guu`;

    if (req.query.id) {
      const link = await getStreamUrl(token, req.query.id);
      if (!link) return res.status(502).send("Failed to fetch stream link");
      res.writeHead(302, { Location: link });
      return res.end();
    }

    if (isCacheValid(playlistFile, config.cacheTTL)) {
      const cached = fs.readFileSync(playlistFile, "utf8");
      res.setHeader("Content-Type", "audio/x-mpegurl");
      return res.send(cached);
    }

    const [channels, genres] = await Promise.all([
      getAllChannels(token),
      getGenres(token),
    ]);

    if (!channels.length) throw new Error("No channels returned");

    let m3u = `#EXTM3U\n#DATE:- ${new Date().toLocaleString("en-IN")}\n\n`;
    for (const ch of channels) {
      const id = ch.cmd?.replace("ffrt http://localhost/ch/", "") || "";
      const logo = getLogo(ch.logo);
      const group = genres[ch.tv_genre_id] || "Others";
      const play = `${baseUrl}?id=${encodeURIComponent(id)}`;
      m3u += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n${play}\n\n`;
    }

    fs.writeFileSync(playlistFile, m3u);
    res.setHeader("Content-Type", "audio/x-mpegurl");
    res.send(m3u);
  } catch (e) {
    console.error("❌ Crash handled:", e.message);
    res.status(500).send("Server error: " + e.message);
  }
}
