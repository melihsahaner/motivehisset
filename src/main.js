// MotiveHisset - Main Application
import './style.css';
import { generateScenesQuotes } from './xai.js';
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

const selectSceneCount = document.getElementById('select-scene-count');
const btnGenerate = document.getElementById('btn-generate');
const btnManual = document.getElementById('btn-manual');
const scenesContainer = document.getElementById('scenes-container');

const btnDownload = document.getElementById('btn-download');
const downloadProgress = document.getElementById('download-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const bgVideo = document.getElementById('bg-video');
const videoWrapper = document.getElementById('video-wrapper');
const btnFullscreen = document.getElementById('btn-fullscreen');

// Text Customization
const btnAligns = document.querySelectorAll('.btn-align');
const rangeFontSize = document.getElementById('range-font-size');
const valFontSize = document.getElementById('val-font-size');
const rangeLineHeight = document.getElementById('range-line-height');
const valLineHeight = document.getElementById('val-line-height');

// Constants
const SCENE_DURATION = 6; // Her sahne için saniye
const OUTRO_DURATION = 3; // saniye

// State
let scenes = [];
let currentSceneIndex = 0;
let isLoading = false;
let isRecording = false;
let previewTimer = null;
let outroTimer = null;
let sceneStartTime = 0;

let textSettings = {
  align: 'center',
  fontSize: '1.8rem',
  lineHeight: '1.1'
};

// ========================================
// API Key Management
// ========================================
function initApiKey() {
  const defaultKey = 'n8Vz12g2eGrmN8CNertGVonXNcWfn7Wi2pvGYMq0FBr9pvcnFjulqU93';
  setApiKey(defaultKey);
  showMainApp();
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
// Scene Generation
// ========================================
async function handleGenerate() {
  if (isLoading || isRecording) return;
  isLoading = true;
  
  stopPreviewLoop();
  videoLoading.classList.remove('hidden');
  outroOverlay.classList.add('hidden');
  quoteOverlay.classList.add('hidden');
  setButtonsDisabled(true);
  btnDownload.disabled = true;
  scenesContainer.innerHTML = '';
  
  const count = parseInt(selectSceneCount.value, 10);
  const loadingSpan = videoLoading.querySelector('span');
  
  try {
    // 1. Fetch AI Quotes
    loadingSpan.textContent = 'Yapay zeka metinleri üretiyor...';
    let quotes;
    try {
        quotes = await generateScenesQuotes(count);
    } catch (e) {
        console.warn('Yapay zeka hatası, yedek metinler yükleniyor:', e);
        showToast('API hatası: Yedek metinler kullanılıyor.', 'error');
        quotes = [];
        for (let i = 0; i < count; i++) {
            quotes.push(getRandomQuote());
        }
    }
    
    // 2. Fetch Videos
    loadingSpan.textContent = 'Videolar indiriliyor...';
    scenes = [];
    
    for (let i = 0; i < count; i++) {
        loadingSpan.textContent = `Video ${i+1}/${count} indiriliyor...`;
        const videoData = await fetchRandomVideo();
        
        const response = await fetch(videoData.url, { mode: 'cors' });
        if (!response.ok) throw new Error('Video indirilemedi');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        scenes.push({
            quote: quotes[i],
            videoUrl: videoData.url,
            blobUrl: blobUrl
        });
    }
    
    renderSceneInputs();
    currentSceneIndex = 0;
    
    videoLoading.classList.add('hidden');
    isLoading = false;
    setButtonsDisabled(false);
    btnDownload.disabled = false;
    
    startPreviewLoop();
    
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Oluşturma hatası', 'error');
    isLoading = false;
    videoLoading.classList.add('hidden');
    setButtonsDisabled(false);
  }
}

btnGenerate.addEventListener('click', handleGenerate);
btnManual.addEventListener('click', handleManualGenerate);

async function handleManualGenerate() {
    if (isLoading) return;
    
    const count = parseInt(selectSceneCount.value, 10);
    isLoading = true;
    setButtonsDisabled(true);
    
    // Clear previous scenes
    scenes.forEach(s => URL.revokeObjectURL(s.blobUrl));
    scenes = [];
    
    videoLoading.classList.remove('hidden');
    const loadingSpan = videoLoading.querySelector('span');
    
    try {
        // Use example quotes from our pool
        const quotes = [];
        for (let i = 0; i < count; i++) {
            quotes.push(getRandomQuote());
        }
        
        // 2. Fetch Videos
        for (let i = 0; i < count; i++) {
            loadingSpan.textContent = `Örnek videolar indiriliyor (${i+1}/${count})...`;
            const videoData = await fetchRandomVideo();
            
            const response = await fetch(videoData.url, { mode: 'cors' });
            if (!response.ok) throw new Error('Video indirilemedi');
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            scenes.push({
                quote: quotes[i],
                videoUrl: videoData.url,
                blobUrl: blobUrl
            });
        }
        
        renderSceneInputs();
        currentSceneIndex = 0;
        
        videoLoading.classList.add('hidden');
        isLoading = false;
        setButtonsDisabled(false);
        btnDownload.disabled = false;
        
        startPreviewLoop();
        
    } catch (error) {
        console.error(error);
        showToast('Manuel başlatma hatası', 'error');
        isLoading = false;
        videoLoading.classList.add('hidden');
        setButtonsDisabled(false);
    }
}

function renderSceneInputs() {
    scenesContainer.innerHTML = '';
    scenes.forEach((scene, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        
        const header = document.createElement('div');
        header.className = 'scene-header';
        header.innerHTML = `
            <span>Sahne ${index + 1}</span>
            <div class="scene-actions">
                <button class="btn-action-small btn-change-quote" title="Yeni Söz" data-index="${index}">✏️</button>
                <button class="btn-action-small btn-change-video" title="Yeni Video" data-index="${index}">🎬</button>
                <button class="btn-action-small btn-copy" title="Kopyala" data-index="${index}">📋</button>
            </div>
        `;
                           
        const textarea = document.createElement('textarea');
        textarea.value = scene.quote;
        textarea.addEventListener('input', (e) => {
            scenes[index].quote = e.target.value;
            // Ekranda oynayan sahne buysa, metni anında güncelle
            if (index === currentSceneIndex && !isRecording && !quoteOverlay.classList.contains('hidden')) {
                updateQuoteUI(scenes[index].quote);
            }
        });
        
        item.appendChild(header);
        item.appendChild(textarea);
        scenesContainer.appendChild(item);
    });
    
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const idx = e.currentTarget.getAttribute('data-index');
            try {
                await navigator.clipboard.writeText(scenes[idx].quote);
                showToast('Metin kopyalandı!', 'success');
            } catch (err) {}
        });
    });

    document.querySelectorAll('.btn-change-quote').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            const newQuote = getRandomQuote();
            scenes[idx].quote = newQuote;
            
            // Update textarea
            const parentItem = e.currentTarget.closest('.scene-item');
            parentItem.querySelector('textarea').value = newQuote;
            
            if (idx === currentSceneIndex && !isRecording && !quoteOverlay.classList.contains('hidden')) {
                updateQuoteUI(newQuote);
            }
        });
    });

    document.querySelectorAll('.btn-change-video').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (isLoading) return;
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            
            videoLoading.classList.remove('hidden');
            videoLoading.querySelector('span').textContent = 'Yeni video indiriliyor...';
            isLoading = true;
            setButtonsDisabled(true);

            try {
                const videoData = await fetchRandomVideo();
                const response = await fetch(videoData.url, { mode: 'cors' });
                if (!response.ok) throw new Error('Video indirilemedi');
                const blob = await response.blob();
                
                scenes[idx].blobUrl = URL.createObjectURL(blob);
                scenes[idx].videoUrl = videoData.url;

                if (idx === currentSceneIndex && !isRecording) {
                    videoPlayer.src = scenes[idx].blobUrl;
                    videoPlayer.load();
                    videoPlayer.play().catch(() => {});
                    if (bgVideo) {
                        bgVideo.src = scenes[idx].blobUrl;
                        bgVideo.load();
                        bgVideo.play().catch(() => {});
                    }
                }
            } catch (err) {
                showToast('Yeni video alınamadı.', 'error');
            } finally {
                isLoading = false;
                setButtonsDisabled(false);
                videoLoading.classList.add('hidden');
            }
        });
    });
}

function setButtonsDisabled(disabled) {
  btnGenerate.disabled = disabled;
  btnManual.disabled = disabled;
  selectSceneCount.disabled = disabled;
}

// ========================================
// Preview Playback Logic
// ========================================
function startPreviewLoop() {
  if (scenes.length === 0) return;
  stopPreviewLoop();
  
  if (currentSceneIndex >= scenes.length) {
      showOutro();
      return;
  }
  
  const scene = scenes[currentSceneIndex];
  
  outroOverlay.classList.add('hidden');
  quoteOverlay.classList.remove('hidden');
  
  updateQuoteUI(scene.quote);
  
  const playScene = () => {
      videoPlayer.currentTime = 0;
      videoPlayer.loop = false;
      videoPlayer.muted = true;
      videoPlayer.play().catch(() => {});
      
      if (bgVideo) {
          if (bgVideo.src !== scene.blobUrl) bgVideo.src = scene.blobUrl;
          bgVideo.currentTime = 0;
          bgVideo.play().catch(() => {});
      }
      
      sceneStartTime = performance.now();
      checkTime();
  };
  
  // Video kaynağı aynıysa beklemeden oynat
  if (!videoPlayer.src.includes(scene.blobUrl)) {
      videoPlayer.src = scene.blobUrl;
      videoPlayer.load();
      const onCanPlay = () => {
          videoPlayer.removeEventListener('canplaythrough', onCanPlay);
          playScene();
      };
      videoPlayer.addEventListener('canplaythrough', onCanPlay);
  } else {
      playScene();
  }
}

function checkTime() {
    if (isRecording) return;
    
    const elapsed = (performance.now() - sceneStartTime) / 1000;
    
    // Geçiş süresi dolduysa veya video bittiyse bir sonraki sahneye geç
    if (elapsed >= SCENE_DURATION || videoPlayer.ended) {
        currentSceneIndex++;
        startPreviewLoop();
        return;
    }
    
    previewTimer = requestAnimationFrame(checkTime);
}

function showOutro() {
  quoteOverlay.classList.add('hidden');
  outroOverlay.classList.remove('hidden');

  outroTimer = setTimeout(() => {
    currentSceneIndex = 0;
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
  videoPlayer.pause();
  if (bgVideo) bgVideo.pause();
}

function updateQuoteUI(text) {
  quoteText.textContent = text;
  quoteText.style.textAlign = textSettings.align;
  quoteText.style.fontSize = textSettings.fontSize;
  quoteText.style.lineHeight = textSettings.lineHeight;

  if (textSettings.align === 'center') {
    quoteOverlay.style.alignItems = 'center';
    quoteOverlay.style.textAlign = 'center';
  } else if (textSettings.align === 'left') {
    quoteOverlay.style.alignItems = 'center';
    quoteOverlay.style.textAlign = 'left';
  } else {
    quoteOverlay.style.alignItems = 'center';
    quoteOverlay.style.textAlign = 'right';
  }

  // Animasyonu sıfırla
  quoteText.style.animation = 'none';
  quoteText.offsetHeight; 
  quoteText.style.animation = '';
}

// ========================================
// Text Customization Settings
// ========================================
btnAligns.forEach(btn => {
  btn.addEventListener('click', () => {
    btnAligns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    textSettings.align = btn.dataset.align;
    if (scenes.length > 0 && !quoteOverlay.classList.contains('hidden')) {
        updateQuoteUI(scenes[currentSceneIndex].quote);
    }
  });
});

rangeFontSize.addEventListener('input', (e) => {
  const val = e.target.value + 'rem';
  textSettings.fontSize = val;
  valFontSize.textContent = val;
  if (scenes.length > 0 && !quoteOverlay.classList.contains('hidden')) {
      updateQuoteUI(scenes[currentSceneIndex].quote);
  }
});

rangeLineHeight.addEventListener('input', (e) => {
  const val = e.target.value;
  textSettings.lineHeight = val;
  valLineHeight.textContent = val;
  if (scenes.length > 0 && !quoteOverlay.classList.contains('hidden')) {
      updateQuoteUI(scenes[currentSceneIndex].quote);
  }
});

// ========================================
// Video Recording & Download
// ========================================
btnDownload.addEventListener('click', async () => {
  if (isRecording || scenes.length === 0) return;
  isRecording = true;

  stopPreviewLoop();
  outroOverlay.classList.add('hidden');
  quoteOverlay.classList.remove('hidden');

  downloadProgress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Video hazırlanıyor...';
  setButtonsDisabled(true);
  btnDownload.disabled = true;

  try {
    const blob = await recordVideo(scenes, textSettings, (progress, statusMsg) => {
      const pct = Math.round(progress * 100);
      progressFill.style.width = pct + '%';
      if (statusMsg) {
        progressText.textContent = statusMsg;
      } else if (pct < 90) {
        progressText.textContent = `Kaydediliyor... %${pct}`;
      } else {
        progressText.textContent = 'Tamamlanıyor...';
      }
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    downloadBlob(blob, `motivehisset-${timestamp}.mp4`);

    progressText.textContent = 'İndirildi! ✅';
    showToast('Video başarıyla indirildi!', 'success');

  } catch (error) {
    console.error('Recording failed:', error);
    showToast('Video oluşturulurken hata: ' + error.message, 'error');
    progressText.textContent = 'Hata oluştu ❌';
  } finally {
    isRecording = false;
    setButtonsDisabled(false);
    btnDownload.disabled = false;

    currentSceneIndex = 0;
    startPreviewLoop();

    setTimeout(() => {
      downloadProgress.classList.add('hidden');
    }, 3000);
  }
});

// ========================================
// Fullscreen Management
// ========================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    videoWrapper.requestFullscreen().catch(err => {
      showToast(`Tam ekran hatası: ${err.message}`, 'error');
    });
  } else {
    document.exitFullscreen();
  }
}

btnFullscreen.addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    btnFullscreen.querySelector('.fs-icon').textContent = '✕';
  } else {
    btnFullscreen.querySelector('.fs-icon').textContent = '⛶';
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

// Initialize
initApiKey();
