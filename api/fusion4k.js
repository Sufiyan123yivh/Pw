import fetch from 'node-fetch';

const URL = "http://tv.fusion4k.cc";
const MAC = "00:1A:79:00:01:07";
const SN = "ED59AF31FDD11";

const host = new URL(URL).host;
const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

// In-memory cache
let tokenCache = null;
let tokenTime = 0; // timestamp when token was obtained
let playlistCache = null;
let groupsCache = null;

// Helper: fetch JSON with retries
async function fetchJSON(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    return await res.json();
  } catch (e) {
    console.error("Fetch Error:", e.message);
    return null;
  }
}

// Generate or refresh token
async function getToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && tokenCache && now - tokenTime < 5 * 60 * 1000) { // 5 min cache
    return tokenCache;
  }
  const handshakeUrl = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
  const data = await fetchJSON(handshakeUrl, { 'User-Agent': USER_AGENT });
  if (!data?.js?.token) throw new Error("Failed to get token");
  tokenCache = data.js.token;
  tokenTime = now;
  return tokenCache;
}

// Fetch categories
async function getGroups() {
  if (groupsCache) return groupsCache;
  const token = await getToken();
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const data = await fetchJSON(url, { "User-Agent": USER_AGENT, "Authorization": `Bearer ${token}` });
  if (!data?.js) return {};
  const result = {};
  for (const g of data.js) if (g.id !== "*") result[g.id] = g.title;
  groupsCache = result;
  return result;
}

// Generate channel ID
function generateId(cmd) {
  if (!cmd) return "";
  return cmd.replace('ffrt http://localhost/ch/', '').replace('ffrt http:///ch/', '');
}

// Get image URL
function getImageUrl(channel) {
  const logo = channel.logo?.replace(/\.png|\.jpg/gi, '');
  if (!isNaN(logo)) return `http://${host}/stalker_portal/misc/logos/320/${channel.logo}`;
  return "https://i.ibb.co/DPd27cCK/photo-2024-12-29-23-10-30.jpg";
}

// Fetch stream URL
async function fetchStreamUrl(id) {
  const token = await getToken();
  const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt http://localhost/ch/${id}&JsHttpRequest=1-xml`;
  const data = await fetchJSON(url, { "User-Agent": USER_AGENT, "Authorization": `Bearer ${token}` });
  if (!data?.js?.cmd) {
    // Try refreshing token once
    const newToken = await getToken(true);
    const retry = await fetchJSON(url, { "User-Agent": USER_AGENT, "Authorization": `Bearer ${newToken}` });
    return retry?.js?.cmd || null;
  }
  return data.js.cmd;
}

// Serverless API
export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (id) {
      const streamUrl = await fetchStreamUrl(id);
      if (!streamUrl) return res.status(500).send("Failed to get stream URL");
      return res.redirect(streamUrl);
    }

    // M3U playlist
    if (playlistCache) {
      res.setHeader('Content-Type', 'audio/x-mpegurl');
      return res.send(playlistCache);
    }

    const token = await getToken();
    const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
    const playlistData = await fetchJSON(url, { "User-Agent": USER_AGENT, "Authorization": `Bearer ${token}` });
    if (!playlistData?.js?.data) return res.status(500).send("Failed to fetch playlist");

    const tvCategories = await getGroups();
    let playlistContent = `#EXTM3U\n#DATE:- ${new Date().toString()}\n\n`;

    for (const ch of playlistData.js.data) {
      const categoryName = tvCategories[ch.tv_genre_id] || "Unknown";
      const channelId = generateId(ch.cmd);
      const streamLink = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}?id=${channelId}`;
      playlistContent += `#EXTINF:-1 tvg-id="${channelId}" tvg-logo="${getImageUrl(ch)}" group-title="${categoryName}",${ch.name}\n${streamLink}\n\n`;
    }

    playlistCache = playlistContent;
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.send(playlistContent);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
}export default async function handler(req, res) {
    const { id } = req.query;

    if (id) {
        // STREAM PLAY
        const token = await getToken();
        const cmdUrl = `http://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt http://localhost/ch/${id}&JsHttpRequest=1-xml`;
        const resp = await fetch(cmdUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                "Authorization": `Bearer ${token}`,
                "X-User-Agent": "Model: MAG250; Link: WiFi",
                "Referer": `http://${host}/stalker_portal/c/`,
                "Accept": "*/*",
                "Host": host
            }
        });
        const data = await resp.json();
        const streamUrl = data.js?.cmd || null;
        if (!streamUrl) return res.status(500).send("Failed to get stream URL");
        res.redirect(streamUrl);
    } else {
        // M3U PLAYLIST
        const token = await getToken();
        const playlistRes = await fetch(`http://${host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`, {
            headers: {
                "User-Agent": USER_AGENT,
                "Authorization": `Bearer ${token}`,
                "X-User-Agent": "Model: MAG250; Link: WiFi",
                "Referer": `http://${host}/stalker_portal/c/`,
                "Accept": "*/*",
                "Host": host
            }
        });
        const playlistData = await playlistRes.json();
        const tvCategories = await getGroups();

        let playlistContent = `#EXTM3U\n#DATE:- ${new Date().toString()}\n\n`;
        for (const ch of playlistData.js.data) {
            const categoryName = tvCategories[ch.tv_genre_id];
            if (!categoryName) continue;
            const id = generateId(ch.cmd);
            const streamLink = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}?id=${id}`;
            playlistContent += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${getImageUrl(ch)}" group-title="${categoryName}",${ch.name}\n${streamLink}\n\n`;
        }

        res.setHeader('Content-Type', 'audio/x-mpegurl');
        res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u"');
        res.send(playlistContent);
    }
}        if (!categoryName) continue;
        const channelId = generateId(ch.cmd);
        const streamLink = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}?id=${channelId}`;
        playlistContent += `#EXTINF:-1 tvg-id="${channelId}" tvg-logo="${getImageUrl(ch)}" group-title="${categoryName}",${ch.name}\n${streamLink}\n\n`;
    }

    playlistCache = playlistContent;
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.send(playlistContent);
}
