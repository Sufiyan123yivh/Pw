import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Stalker portal details
const URL = "http://tv.fusion4k.cc";
const MAC = "00:1A:79:00:01:07";
const SN = "ED59AF31FDD11";
const DEVICE_ID_1 = "63B89283DA4D02C113BE0E0F9B9AB7B2210D62ABA3611B1CAE19580D6608A025";
const DEVICE_ID_2 = "63B89283DA4D02C113BE0E0F9B9AB7B2210D62ABA3611B1CAE19580D6608A025";
const API = "263";

const host = new URL(URL).host;

// Paths for Vercel temp storage
const dataDir = path.join('/tmp', 'data');
const filterDir = path.join(dataDir, 'filter');
const playlistDir = path.join(dataDir, 'playlist');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(filterDir)) fs.mkdirSync(filterDir, { recursive: true });
if (!fs.existsSync(playlistDir)) fs.mkdirSync(playlistDir, { recursive: true });

const tokenFile = path.join(dataDir, 'token.txt');

const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

async function handshake() {
    const url = `http://${host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Connection': 'Keep-Alive',
            'Accept-Encoding': 'gzip',
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Referer': `http://${host}/stalker_portal/c/`,
            'Host': host
        }
    });
    const data = await res.json();
    return {
        token: data.js.token,
        random: data.js.random
    };
}

async function generateToken() {
    let info = await handshake();
    fs.writeFileSync(tokenFile, info.token, 'utf-8');
    return info.token;
}

async function getToken() {
    if (fs.existsSync(tokenFile)) {
        const t = fs.readFileSync(tokenFile, 'utf-8');
        if (t) return t;
    }
    return await generateToken();
}

async function getGroups(all = false) {
    const filterFile = path.join(filterDir, `${host}.json`);
    if (fs.existsSync(filterFile)) {
        const jsonData = JSON.parse(fs.readFileSync(filterFile, 'utf-8'));
        if (all) return Object.fromEntries(Object.entries(jsonData).map(([k, v]) => [k, v.title]));
        return Object.fromEntries(Object.entries(jsonData).filter(([k, v]) => v.filter).map(([k, v]) => [k, v.title]));
    }

    const token = await getToken();
    const res = await fetch(`http://${host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`, {
        headers: {
            "User-Agent": USER_AGENT,
            "Authorization": `Bearer ${token}`,
            "X-User-Agent": "Model: MAG250; Link: WiFi",
            "Referer": `http://${host}/stalker_portal/c/`,
            "Accept": "*/*",
            "Host": host,
            "Connection": "Keep-Alive",
            "Accept-Encoding": "gzip"
        }
    });
    const data = await res.json();

    const filtered = {};
    for (const g of data.js) {
        if (g.id !== "*") {
            filtered[g.id] = { id: g.id, title: g.title, filter: true };
        }
    }
    fs.writeFileSync(filterFile, JSON.stringify(filtered));
    return Object.fromEntries(Object.entries(filtered).map(([k, v]) => [k, v.title]));
}

function generateId(cmd) {
    if (cmd.includes('ffrt http://localhost/ch/')) return cmd.replace('ffrt http://localhost/ch/', '');
    if (cmd.includes('ffrt http:///ch/')) return cmd.replace('ffrt http:///ch/', '');
    return cmd;
}

function getImageUrl(channel) {
    const logo = channel.logo?.replace(/\.png|\.jpg/gi, '');
    if (!isNaN(logo)) return `http://${host}/stalker_portal/misc/logos/320/${channel.logo}`;
    return "https://i.ibb.co/DPd27cCK/photo-2024-12-29-23-10-30.jpg";
}

export default async function handler(req, res) {
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
