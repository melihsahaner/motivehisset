// MotiveHisset - Main Application
import './style.css';
import { getRandomQuote } from './quotes.js';
import { setApiKey, fetchRandomVideo, validateApiKey } from './pexels.js';
import { recordVideo, downloadBlob } from './recorder.js';

// DOM Elements
const apiKeyModal = document.getElementById('api-key-modal');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeySubmit = document.getElementById('api-key-submit');
const mainApp = document.getElementById('main-app');
const videoPlayer = document.getElementById('video-player');
const quoteText = document.getElementById('quote-text');
const quoteOverlay = document.getElementById('quote-overlay');
const outroOverlay = document.getElementById('outro-overlay');
const videoLoading = document.getElementById('video-loading');
const btnRefresh = document.getElementById('btn-refresh');
const btnChangeQuote = document.getElementById('btn-change-quote');
const btnChangeVideo = document.getElementById('btn-change-video');
const btnDownload = document.getElementById('btn-download');
const downloadProgress = document.getElementById('download-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Constants
const MAX_VIDEO_DURATION = 7; // seconds
const OUTRO_DURATION = 3; // seconds

// State
let currentQuote = '';
let currentVideoUrl = '';
let isLoading = false;
let isRecording = false;
let previewTimer = null;
let outroTimer = null;

// ========================================
// API Key Management
// ========================================
function initApiKey() {
  showMainApp();
  loadContent();
}

apiKeySubmit.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('Lütfen API anahtarı girin.', 'error');
    return;
  }
  apiKeySubmit.disabled = true;
  apiKeySubmit.textContent = 'Doğrulanıyor...';
  try {
    const isValid = await validateApiKey(key);
    if (isValid) {
      setApiKey(key);
      localStorage.setItem('pexels_api_key', key);
      showMainApp();
      loadContent();
    } else {
      showToast('Geçersiz API anahtarı. Lütfen kontrol edin.', 'error');
    }
  } catch (error) {
    showToast('Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
  } finally {
    apiKeySubmit.disabled = false;
    apiKeySubmit.textContent = 'Başla';
  }
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') apiKeySubmit.click();
});

function showMainApp() {
  apiKeyModal.classList.add('hidden');
  mainApp.classList.remove('hidden');
}

// ========================================
// Preview Playback with Outro
// ========================================
function startPreviewLoop() {
  stopPreviewLoop();

  // Hide outro, show quote
  outroOverlay.classList.add('hidden');
  quoteOverlay.classList.remove('hidden');

  videoPlayer.currentTime = 0;
  videoPlayer.loop = false;
  videoPlayer.muted = true;
  videoPlayer.play().catch(() => { });

  // Monitor video time to cut at MAX_VIDEO_DURATION
  function checkTime() {
    if (isRecording) return;

    if (videoPlayer.currentTime >= MAX_VIDEO_DURATION || videoPlayer.ended) {
      videoPlayer.pause();
      showOutro();
      return;
    }
    previewTimer = requestAnimationFrame(checkTime);
  }

  previewTimer = requestAnimationFrame(checkTime);
}

function showOutro() {
  // Show white outro overlay with logo
  quoteOverlay.classList.add('hidden');
  outroOverlay.classList.remove('hidden');

  // After OUTRO_DURATION, loop back
  outroTimer = setTimeout(() => {
    outroOverlay.classList.add('hidden');
    quoteOverlay.classList.remove('hidden');
    startPreviewLoop();
  }, OUTRO_DURATION * 1000);
}

function stopPreviewLoop() {
  if (previewTimer) {
    cancelAnimationFrame(previewTimer);
    previewTimer = null;
  }
  if (outroTimer) {
    clearTimeout(outroTimer);
    outroTimer = null;
  }
}

// ========================================
// Content Loading
// ========================================
async function loadContent() {
  loadNewQuote();
  await loadNewVideo();
}

function loadNewQuote() {
  currentQuote = getRandomQuote();
  quoteText.textContent = currentQuote;
  quoteText.style.animation = 'none';
  quoteText.offsetHeight;
  quoteText.style.animation = '';
}

async function loadNewVideo() {
  if (isLoading) return;
  isLoading = true;

  stopPreviewLoop();
  videoLoading.classList.remove('hidden');
  outroOverlay.classList.add('hidden');
  setButtonsDisabled(true);

  try {
    const videoData = await fetchRandomVideo();
    currentVideoUrl = videoData.url;

    return new Promise((resolve, reject) => {
      const onReady = () => {
        videoLoading.classList.add('hidden');
        isLoading = false;
        setButtonsDisabled(false);
        startPreviewLoop();
        resolve();
      };

      videoPlayer.addEventListener('canplaythrough', onReady, { once: true });

      videoPlayer.onerror = () => {
        isLoading = false;
        setButtonsDisabled(false);
        videoLoading.classList.add('hidden');
        showToast('Video yüklenemedi. Tekrar deneyin.', 'error');
        reject(new Error('Video load failed'));
      };

      videoPlayer.crossOrigin = 'anonymous';
      videoPlayer.src = currentVideoUrl;
      videoPlayer.load();
    });
  } catch (error) {
    isLoading = false;
    setButtonsDisabled(false);
    videoLoading.classList.add('hidden');
    showToast(error.message || 'Video alınamadı.', 'error');
  }
}

function setButtonsDisabled(disabled) {
  btnRefresh.disabled = disabled;
  btnChangeQuote.disabled = disabled;
  btnChangeVideo.disabled = disabled;
  btnDownload.disabled = disabled;
}

// ========================================
// Button Handlers
// ========================================
btnRefresh.addEventListener('click', async () => {
  loadNewQuote();
  await loadNewVideo();
});

btnChangeQuote.addEventListener('click', () => {
  loadNewQuote();
});

btnChangeVideo.addEventListener('click', async () => {
  await loadNewVideo();
});

btnDownload.addEventListener('click', async () => {
  if (isRecording || !currentVideoUrl) return;
  isRecording = true;

  // Stop preview loop during recording
  stopPreviewLoop();
  outroOverlay.classList.add('hidden');
  quoteOverlay.classList.remove('hidden');

  // Show progress
  downloadProgress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Video hazırlanıyor...';
  setButtonsDisabled(true);

  try {
    const blob = await recordVideo(videoPlayer, currentQuote, (progress) => {
      const pct = Math.round(progress * 100);
      progressFill.style.width = pct + '%';
      if (pct < 90) {
        progressText.textContent = `Kaydediliyor... %${pct}`;
      } else {
        progressText.textContent = 'Tamamlanıyor...';
      }
    });

    // Download
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    downloadBlob(blob, `motivehisset-${timestamp}.webm`);

    progressText.textContent = 'İndirildi! ✅';
    showToast('Video başarıyla indirildi!', 'success');

  } catch (error) {
    console.error('Recording failed:', error);
    showToast('Video oluşturulurken hata: ' + error.message, 'error');
    progressText.textContent = 'Hata oluştu ❌';
  } finally {
    isRecording = false;
    setButtonsDisabled(false);

    // Restart preview loop
    startPreviewLoop();

    // Hide progress after delay
    setTimeout(() => {
      downloadProgress.classList.add('hidden');
    }, 3000);
  }
});

// ========================================
// Toast Notifications
// ========================================
function showToast(message, type = 'error') {
  document.querySelectorAll('.toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ========================================
// Initialize
// ========================================
initApiKey();
