<?php
// Retrieve video URL and title from query parameters
$videoUrl = isset($_GET['videoUrl']) ? $_GET['videoUrl'] : '';
$title = isset($_GET['title']) ? $_GET['title'] : 'Lecture Video';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <title><?php echo htmlspecialchars($title); ?></title>
  <!-- HLS.js -->
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    :root { --bg: #111; --fg: #fff; --accent: #2f8eed; --seek-bg: #444; }
    [data-theme="light"] { --bg: #f9f9f9; --fg: #111; --accent: #0066cc; --seek-bg: #ccc; }
    body { margin:0; background:var(--bg); color:var(--fg); font-family:'Segoe UI',sans-serif; display:flex; flex-direction:column; height:100vh; }
    .header { background:#1a1b2f; padding:1rem; display:flex; align-items:center; color:gold; }
    .back { color:gold; text-decoration:none; font-size:1.5rem; margin-right:1rem; }
    .player { position:relative; flex:1; background:#000; display:flex; justify-content:center; align-items:center; overflow:hidden; }
    video { width:100%; height:100%; object-fit:contain; }
    .player:-webkit-full-screen video, .player:fullscreen video { width:100vw; height:100vh; }
    .controls { position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); display:flex; flex-wrap:wrap; align-items:center; padding:4px; gap:4px; transition:opacity .3s; }
    .controls.hide { opacity:0; pointer-events:none; }
    .btn { background:none; border:none; color:var(--fg); font-size:1.2em; padding:4px; cursor:pointer; }
    .seek-container { flex:1 1 100%; display:flex; align-items:center; gap:4px; }
    .time { font-size:.75em; width:34px; text-align:center; }
    .seek, .volume { -webkit-appearance:none; background:transparent; }
    .seek { flex:1; }
    .seek::-webkit-slider-runnable-track { height:6px; background:var(--seek-bg); border-radius:3px; }
    .seek::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; background:var(--accent); border-radius:50%; margin-top:-4px; }
    .volume { width:70px; }
    .volume::-webkit-slider-runnable-track { height:4px; background:var(--seek-bg); border-radius:2px; }
    .volume::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; background:var(--accent); border-radius:50%; margin-top:-3px; }
    .settings-panel { position:absolute; bottom:calc(100% + 4px); right:4px; background:rgba(0,0,0,0.8); color:var(--fg); padding:4px; border-radius:4px; display:none; font-size:.75em; z-index:10; }
    .settings-panel.active { display:block; }
    .settings-panel button { background:none; border:1px solid var(--fg); color:inherit; padding:2px 4px; margin:2px 1px; cursor:pointer; border-radius:3px; }
  </style>
</head>
<body data-theme="dark">
  <div class="header">
    <a class="back" href="javascript:history.back()">←</a>
    <div><?php echo htmlspecialchars($title); ?></div>
  </div>
  <div class="player" id="player">
    <video id="video" playsinline webkit-playsinline></video>
    <div class="controls hide" id="controls">
      <button id="playPause" class="btn">►</button>
      <button id="mute" class="btn">🔊</button>
      <input id="volume" type="range" class="volume" min="0" max="1" step="0.01" value="1">
      <button id="settingsBtn" class="btn">⚙️</button>
      <button id="themeToggle" class="btn">🌙</button>
      <button id="fullscreen" class="btn">⛶</button>
      <div class="seek-container">
        <span id="currentTime" class="time">0:00</span>
        <input id="seek" type="range" class="seek" min="0" max="100" value="0">
        <span id="duration" class="time">0:00</span>
      </div>
      <div id="settingsPanel" class="settings-panel">
        <div><strong>Quality</strong></div>
        <div id="levels"></div>
          <div><strong>Speed</strong></div>
          <div id="speeds"></div>
      </div>
    </div>
  </div>
  <script>
    const originalUrl = "<?php echo htmlspecialchars($videoUrl); ?>";
    let currentUrl = originalUrl;
    const qualities = [144, 360, 480, 720];
    const video = document.getElementById('video');
    const controls = document.getElementById('controls');
    const player = document.getElementById('player');
    const levels = document.getElementById('levels');
    const speeds = [0.5, 1, 1.5, 2];
    const speedsContainer = document.getElementById('speeds');
    let hideTimeout;

    function showControls() {
      controls.classList.remove('hide');
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => controls.classList.add('hide'), 4000);
    }
    document.addEventListener('DOMContentLoaded', () => { initPlayer(); showControls(); });
    player.addEventListener('mousemove', showControls);
    player.addEventListener('touchstart', showControls);

    function initPlayer() {
      loadStream(currentUrl);
      buildLevels();
            buildSpeeds();
      setupEvents();
    }

    function loadStream(url) {
      if (Hls.isSupported()) {
        if (window.hls) window.hls.destroy();
        window.hls = new Hls({ capLevelToPlayerSize:true });
        window.hls.loadSource(url);
        window.hls.attachMedia(video);
        window.hls.on(Hls.Events.MANIFEST_PARSED, () => { video.currentTime = 14; video.play(); });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => { video.currentTime = 14; video.play(); });
      }
    }

    function buildLevels() {
      levels.innerHTML = '';
      // Auto (original) link
      addLevelButton('Auto', originalUrl);
      qualities.forEach(q => {
        addLevelButton(q + 'p', originalUrl.replace(/\/(\d+)\/main\.m3u8$/, '/' + q + '/main.m3u8'));
      });
      highlightActive();
    }

    function buildSpeeds() {
      speedsContainer.innerHTML = '';
      speeds.forEach(s => {
        const btn = document.createElement('button');
        btn.textContent = s + 'x';
        btn.onclick = () => { video.playbackRate = s; highlightActiveSpeed(); };
        speedsContainer.appendChild(btn);
      });
      highlightActiveSpeed();
    }

    function highlightActiveSpeed() {
      Array.from(speedsContainer.children).forEach(btn => {
        btn.classList.toggle('active', btn.textContent == video.playbackRate + 'x');
      });
    }


    function addLevelButton(label, url) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.onclick = () => switchQuality(url);
      levels.appendChild(btn);
    }

    function switchQuality(url) {
      currentUrl = url;
      loadStream(url);
      highlightActive();
    }

    function highlightActive() {
      Array.from(levels.children).forEach(btn => {
        btn.classList.toggle('active', btn.textContent !== 'Auto' ? currentUrl.includes('/' + btn.textContent.replace('p','') + '/main.m3u8') : currentUrl === originalUrl);
      });
    }

    function setupEvents() {
      document.getElementById('playPause').onclick = () => video.paused ? video.play() : video.pause();
      video.onplay = () => document.getElementById('playPause').textContent = '❚❚';
      video.onpause = () => document.getElementById('playPause').textContent = '►';
      video.ontimeupdate = () => {
        const displayedTime = video.currentTime - 14; const displayedDuration = video.duration - 14; const pct = (video.duration>14) ? (displayedTime>0 ? displayedTime : 0) / displayedDuration * 100 : 0; document.getElementById('seek').value = pct;
        const displayedTime2 = video.currentTime - 14; document.getElementById('currentTime').textContent = fmt(displayedTime2 > 0 ? displayedTime2 : 0);
      };
    video.onloadedmetadata = () => document.getElementById('duration').textContent = fmt(Math.max(0, video.duration - 14));
      document.getElementById('seek').oninput = e => { const dd = video.duration - 14; video.currentTime = 14 + (e.target.value/100) * dd; };
      document.getElementById('mute').onclick = () => {
        video.muted = !video.muted;
        document.getElementById('mute').textContent = video.muted ? '🔇' : '🔊';
      };
      document.getElementById('volume').oninput = e => {
        video.volume = e.target.value;
        video.muted = e.target.value == 0;
      };
      document.getElementById('fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen();
      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{});
        if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      });
      document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsPanel').classList.toggle('active');
      document.addEventListener('click', e => {
        if (!document.getElementById('settingsPanel').contains(e.target) && e.target.id !== 'settingsBtn') document.getElementById('settingsPanel').classList.remove('active');
      });
      document.getElementById('themeToggle').onclick = () => {
        const next = document.body.dataset.theme==='dark'?'light':'dark';
        document.body.dataset.theme = next;
        document.getElementById('themeToggle').textContent = next==='dark'?'🌙':'☀️';
      };
    }

    function fmt(s) { const m=Math.floor(s/60), sec=Math.floor(s%60).toString().padStart(2,'0'); return m+':'+sec; }
  </script>
</body>
</html>
