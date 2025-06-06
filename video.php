<?php
$video720 = $_GET['videoUrl']  ?? '';
$video480 = $_GET['videoUrl1'] ?? '';
$video360 = $_GET['videoUrl2'] ?? '';
$video240 = $_GET['videoUrl3'] ?? '';
$title    = $_GET['title']     ?? 'Video Player';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
     <script>
    function getCookie(name) {
      const value = document.cookie;
      const parts = value.split("; ");
      for (let i = 0; i < parts.length; i++) {
       const [key, val] = parts[i].split("=");
        if (key === name) return val;
      }
     return null;
    }

    if (!getCookie('login')) {
      // Agar logged in nahi hain, toh generate key page par redirect karo
      window.location.href = 'https://pwthor.site/generate-key.html';
    }
  </script>
  <title><?php echo htmlspecialchars($title); ?></title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    :root {
      --bg: #000;
      --fg: #fff;
      --accent: #2f8eed;
      --seek-bg: #444;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
  height: 100%;
  background: var(--bg);
  color: var(--fg);
  font-family: Arial, sans-serif;
  overflow: auto; /* allows vertical and horizontal scroll if needed */
}

    /* Header (Back button + Title) */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px 20px;
      position: absolute;
      top: 0;
      width: 100%;
      z-index: 10;
      transition: opacity 0.3s;
    }

    .back-btn {
      color: var(--fg);
      text-decoration: none;
      font-size: 18px;
      background: rgba(255,255,255,0.1);
      padding: 5px 10px;
      border-radius: 4px;
    }

    .title {
      flex: 1;
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: var(--fg);
    }

    /* Quality selector (top-right) */
    .top-quality {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      background: rgba(0, 0, 0, 0.6);
      padding: 4px;
      border-radius: 4px;
      transition: opacity 0.3s;
    }
    .top-quality select {
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--accent);
      padding: 5px;
      border-radius: 4px;
    }

    /* Main player container */
    .player {
      width: 100vw;
      height: 100vh;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #000;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }

    /* Controls bar (bottom) */
    .controls {
      position: absolute;
      bottom: 0;
      width: 100%;
      display: flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.6);
      padding: 10px;
      gap: 10px;
      z-index: 10;
      transition: opacity 0.3s;
    }

    .btn {
      background: none;
      border: none;
      color: var(--fg);
      font-size: 1.5em;
      cursor: pointer;
      width: 40px;
      height: 40px;
    }

    .volume {
      width: 100px;
    }

    .seek-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .seek {
      width: 100%;
      height: 8px;
      background: var(--seek-bg);
      border-radius: 4px;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }
    .seek::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      background: var(--accent);
      border-radius: 50%;
      margin-top: -4px;
    }
    .seek::-moz-range-thumb {
      width: 16px;
      height: 16px;
      background: var(--accent);
      border-radius: 50%;
    }

    .time {
      color: var(--fg);
      font-size: 0.9em;
      min-width: 40px;
    }

    /* Playback‐speed selector (above controls) */
    .playback-speed {
      position: absolute;
      bottom: 60px;
      right: 20px;
      z-index: 10;
      background: rgba(0, 0, 0, 0.6);
      padding: 6px;
      border-radius: 6px;
      transition: opacity 0.3s;
    }
    .playback-speed select {
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--accent);
      padding: 4px;
      border-radius: 4px;
    }

    /* Hidden state for UI elements */
    .hide-ui {
      opacity: 0 !important;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="player" id="player">
    <!-- Header: Back + Title -->
    <div class="header" id="header">
      <a href="javascript:history.back()" class="back-btn">← Back</a>
      <div class="title"><?php echo htmlspecialchars($title); ?></div>
    </div>

    <!-- Quality Selector -->
    <div class="top-quality" id="topQuality">
      <select id="topQualitySelect">
        <option value="<?php echo htmlspecialchars($video720); ?>">720p</option>
        <option value="<?php echo htmlspecialchars($video480); ?>">480p</option>
        <option value="<?php echo htmlspecialchars($video360); ?>">360p</option>
        <option value="<?php echo htmlspecialchars($video240); ?>">240p</option>
      </select>
    </div>

    <!-- Video Element -->
    <video id="video" autoplay playsinline webkit-playsinline x5-playsinline allowfullscreen></video>

    <!-- Controls Bar -->
    <div class="controls" id="controls">
      <button id="playPause" class="btn">►</button>
      <button id="mute" class="btn">🔊</button>
      <input id="volume" type="range" class="volume" min="0" max="1" step="0.01" value="1" />
      <button id="fullscreen" class="btn">⛶</button>
      <div class="seek-container">
        <span id="currentTime" class="time">0:00</span>
        <input id="seek" type="range" class="seek" min="0" max="100" value="0" />
        <span id="duration" class="time">0:00</span>
      </div>
    </div>

    <!-- Playback‐Speed Selector -->
    <div class="playback-speed" id="playbackSpeed">
      <label for="speed" style="margin-right:4px;">Speed:</label>
      <select id="speed">
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1" selected>1x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
      </select>
    </div>
  </div>

  <script>
    const video            = document.getElementById("video");
    const playPauseBtn     = document.getElementById("playPause");
    const muteBtn          = document.getElementById("mute");
    const volumeSlider     = document.getElementById("volume");
    const fullscreenBtn    = document.getElementById("fullscreen");
    const seekBar          = document.getElementById("seek");
    const currentTimeElem  = document.getElementById("currentTime");
    const durationElem     = document.getElementById("duration");
    const topQualitySelect = document.getElementById("topQualitySelect");
    const speedSelect      = document.getElementById("speed");

    // UI elements to hide/show
    const header           = document.getElementById("header");
    const topQuality       = document.getElementById("topQuality");
    const controls         = document.getElementById("controls");
    const playbackSpeed    = document.getElementById("playbackSpeed");

    let hlsInstance       = null;
    let hideUITimer       = null;
    const HIDE_DELAY      = 4000; // 4 seconds

    // Load HLS (or native) stream
    function loadStream(url) {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      if (!url) return;
      if (Hls.isSupported()) {
        hlsInstance = new Hls();
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else {
        alert("HLS not supported in this browser.");
      }
      video.play();
    }

    // Format seconds → M:SS
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Show all UI elements
    function showUI() {
      header.classList.remove("hide-ui");
      topQuality.classList.remove("hide-ui");
      controls.classList.remove("hide-ui");
      playbackSpeed.classList.remove("hide-ui");
    }

    // Hide all UI elements
    function hideUI() {
      header.classList.add("hide-ui");
      topQuality.classList.add("hide-ui");
      controls.classList.add("hide-ui");
      playbackSpeed.classList.add("hide-ui");
    }

    // Reset the hide‐UI timer (only if in fullscreen)
    function resetHideTimer() {
      if (!document.fullscreenElement) {
        // If not fullscreen, do not hide UI—just clear any timer.
        clearTimeout(hideUITimer);
        showUI();
        return;
      }
      clearTimeout(hideUITimer);
      showUI();
      hideUITimer = setTimeout(() => {
        hideUI();
      }, HIDE_DELAY);
    }

    // Play/Pause toggle
    playPauseBtn.addEventListener("click", () => {
      if (video.paused) {
        video.play();
        playPauseBtn.textContent = "❚❚";
      } else {
        video.pause();
        playPauseBtn.textContent = "►";
      }
    });

    // Mute/Unmute toggle
    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? "🔇" : "🔊";
    });

    // Volume slider
    volumeSlider.addEventListener("input", () => {
      video.volume = volumeSlider.value;
      if (video.volume > 0 && video.muted) {
        video.muted = false;
        muteBtn.textContent = "🔊";
      }
    });

    // Fullscreen toggle
    fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    // When metadata is loaded, set duration text
    video.addEventListener("loadedmetadata", () => {
      durationElem.textContent = formatTime(video.duration);
    });

    // Update current time and seek bar as video plays
    video.addEventListener("timeupdate", () => {
      currentTimeElem.textContent = formatTime(video.currentTime);
      if (video.duration) {
        seekBar.value = (video.currentTime / video.duration) * 100;
      }
    });

    // Seek bar interaction
    seekBar.addEventListener("input", () => {
      if (!video.duration) return;
      video.currentTime = (seekBar.value / 100) * video.duration;
    });

    // Quality selector change
    topQualitySelect.addEventListener("change", () => {
      loadStream(topQualitySelect.value);
    });

    // Playback speed change
    speedSelect.addEventListener("change", () => {
      video.playbackRate = parseFloat(speedSelect.value);
    });

    // Reset hide‐UI timer on user interaction
    ["mousemove", "click"].forEach(evt => {
      document.addEventListener(evt, resetHideTimer);
    });

    // When fullscreen state changes, reset/hide UI as appropriate
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        // Entered fullscreen: start the timer
        resetHideTimer();
      } else {
        // Exited fullscreen: clear timer and show UI
        clearTimeout(hideUITimer);
        showUI();
      }
    });

    // On initial load, start playing the default quality
    document.addEventListener("DOMContentLoaded", () => {
      loadStream(topQualitySelect.value);
      // Ensure UI‐hide logic won’t run until (if) the user goes fullscreen
      showUI();
    });
  </script>

  <script>
    // Auto-rotate to landscape when entering fullscreen
    function isFullscreen() {
      return (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    }

    function onFullScreenChange() {
      if (isFullscreen()) {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape')
            .catch((err) => {
              console.warn('Orientation lock failed:', err);
            });
        }
      } else {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      }
    }

    document.addEventListener('fullscreenchange', onFullScreenChange);
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);
  </script>

</body>
</html>
