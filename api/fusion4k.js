import fetch from 'node-fetch';

// Stalker portal details
const URL = "http://tv.fusion4k.cc";
const MAC = "00:1A:79:00:01:07";
const SN = "ED59AF31FDD11";
const DEVICE_ID_1 = "63B89283DA4D02C113BE0E0F9B9AB7B2210D62ABA3611B1CAE19580D6608A025";
const DEVICE_ID_2 = "63B89283DA4D02C113BE0E0F9B9AB7B2210D62ABA3611B1CAE19580D6608A025";
const API = "263";

const host = new URL(URL).host;

const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

// In-memory cache
let tokenCache = null;
let playlistCache = null;
let groupsCache = null;

// Handshake & token
async function handshake() {
    const url = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json();
    return { token: data.js.token, random: data.js.random };
}

async function getToken() {
    if (tokenCache) return tokenCache;
    const info = await handshake();
    tokenCache = info.token;
    return tokenCache;
}

// Groups (categories)
async function getGroups() {
    if (groupsCache) return groupsCache;

    const token = await getToken();
    const res = await fetch(`http://${host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`, {
        headers: {
            "User-Agent": USER_AGENT,
            "Authorization": `Bearer ${token}`
        }
    });
    const data = await res.json();
    const filtered = {};
    for (const g of data.js) {
        if (g.id !== "*") filtered[g.id] = g.title;
    }
    groupsCache = filtered;
    return groupsCache;
}

// Generate ID
function generateId(cmd) {
    if (cmd.includes('ffrt http://localhost/ch/')) return cmd.replace('ffrt http://localhost/ch/', '');
    if (cmd.includes('ffrt http:///ch/')) return cmd.replace('ffrt http:///ch/', '');
    return cmd;
}

// Get Image URL
function getImageUrl(channel) {
    const logo = channel.logo?.replace(/\.png|\.jpg/gi, '');
    if (!isNaN(logo)) return `http://${host}/stalker_portal/misc/logos/320/${channel.logo}`;
    return "https://i.ibb.co/DPd27cCK/photo-2024-12-29-23-10-30.jpg";
}

// Fetch Stream URL
async function fetchStreamUrl(id) {
    const token = await getToken();
    const url = `http://${host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt http://localhost/ch/${id}&JsHttpRequest=1-xml`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Authorization": `Bearer ${token}` } });
    const data = await res.json();
    return data.js?.cmd || null;
}

// API handler
export default async function handler(req, res) {
    const { id } = req.query;

    if (id) {
        // Play stream
        const streamUrl = await fetchStreamUrl(id);
        if (!streamUrl) return res.status(500).send("Failed to get stream URL");
        return res.redirect(streamUrl);
    }

    // Playlist
    if (playlistCache) {
        res.setHeader('Content-Type', 'audio/x-mpegurl');
        return res.send(playlistCache);
    }

    const token = await getToken();
    const playlistRes = await fetch(`http://${host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`, {
        headers: { "User-Agent": USER_AGENT, "Authorization": `Bearer ${token}` }
    });
    const playlistData = await playlistRes.json();
    const tvCategories = await getGroups();

    let playlistContent = `#EXTM3U\n#DATE:- ${new Date().toString()}\n\n`;

    for (const ch of playlistData.js.data) {
        const categoryName = tvCategories[ch.tv_genre_id];
        if (!categoryName) continue;
        const channelId = generateId(ch.cmd);
        const streamLink = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}?id=${channelId}`;
        playlistContent += `#EXTINF:-1 tvg-id="${channelId}" tvg-logo="${getImageUrl(ch)}" group-title="${categoryName}",${ch.name}\n${streamLink}\n\n`;
    }

    playlistCache = playlistContent;
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.send(playlistContent);
}
