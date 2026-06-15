// Video recorder module - composites video + text overlay + white outro
// Uses Canvas API + MediaRecorder for video export + FFmpeg.wasm for MP4 conversion
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const OUTRO_DURATION = 3; // seconds of white screen at the end
const MAX_VIDEO_DURATION = 10; // max video duration in seconds
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920; // 9:16 aspect ratio
const FPS = 30;
const LOGO_PATH = '/Motive-Hisset-Logo.png';

let ffmpeg = null;

/**
 * Initialize and load FFmpeg
 */
async function loadFFmpeg(onStatusUpdate) {
    if (ffmpeg) return ffmpeg;

    if (onStatusUpdate) onStatusUpdate(0, 'FFmpeg bileşenleri yükleniyor...');

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    try {
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
    } catch (err) {
        console.error('FFmpeg load failed:', err);
        throw new Error('Video işleme modülü yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
    }

    return ffmpeg;
}

// Preload the logo image
let logoImage = null;
function loadLogo() {
    return new Promise((resolve) => {
        if (logoImage) { resolve(logoImage); return; }
        const img = new Image();
        img.onload = () => { logoImage = img; resolve(img); };
        img.onerror = () => { console.warn('Logo yüklenemedi'); resolve(null); };
        img.src = LOGO_PATH;
    });
}
// Start loading immediately
loadLogo();

/**
 * Record a video with text overlay and white outro
 * @param {Array} scenes - array of scenes { quote, videoUrl, blobUrl }
 * @param {object} textSettings - text settings object
 * @param {number} sceneDuration - duration of each scene in seconds
 * @param {Function} onProgress - progress callback (0-1)
 * @returns {Promise<Blob>} - recorded MP4 video blob
 */
export async function recordVideo(scenes, textSettings, sceneDuration, onProgress) {
    const canvas = document.getElementById('record-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 1. Load FFmpeg and fonts
    await loadFFmpeg(onProgress);

    onProgress(0.05, 'Yazı tipleri yükleniyor...');
    try {
        const fontPromise = document.fonts.load('italic 500 84px "Cormorant Garamond"');
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Font timeout')), 2000));
        await Promise.race([fontPromise, timeoutPromise]);
    } catch (e) {
        console.warn('Font load failed or timed out:', e);
    }

    onProgress(0.1, 'Logo hazırlanıyor...');
    await loadLogo();

    // Prepare video elements for each scene
    onProgress(0.12, 'Sahneler hazırlanıyor...');
    const videoEls = await Promise.all(scenes.map((scene) => {
        return new Promise((resolve, reject) => {
            const v = document.createElement('video');
            v.crossOrigin = 'anonymous';
            v.muted = true;
            v.playsInline = true;
            v.src = scene.blobUrl;
            v.preload = 'auto';
            v.load();
            const onCanPlay = async () => {
                v.removeEventListener('canplaythrough', onCanPlay);
                try {
                    // Videonun ilk karesini çözmesini zorlamak için kısa bir oynatma yapıyoruz
                    await v.play();
                    v.pause();
                    v.currentTime = 0;
                } catch(e) {}
                resolve(v);
            };
            v.addEventListener('canplaythrough', onCanPlay);
            v.onerror = () => reject(new Error('Video yüklenemedi'));
            
            // Fallback timeout
            setTimeout(() => resolve(v), 5000); 
        });
    }));

    const videoDuration = scenes.length * sceneDuration;
    const totalDuration = videoDuration + OUTRO_DURATION;
    
    onProgress(0.15, 'Kayıt başlıyor...');

    return new Promise((resolve, reject) => {
        const stream = canvas.captureStream(FPS);

        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
            mimeType = 'video/webm;codecs=h264';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
        }
        
        const recorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 5000000 // Reduced slightly for better real-time performance
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
            try {
                const webmBlob = new Blob(chunks, { type: 'video/webm' });
                onProgress(0.95, 'MP4 formatına dönüştürülüyor (Lütfen bekleyin)...');

                const inputName = 'input.webm';
                const outputName = 'output.mp4';

                await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));

                await ffmpeg.exec([
                    '-i', inputName,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-crf', '22',
                    '-pix_fmt', 'yuv420p',
                    '-r', '30',
                    '-g', '60',
                    outputName
                ]);

                const data = await ffmpeg.readFile(outputName);
                const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });

                console.log('MP4 conversion complete, size:', mp4Blob.size);
                resolve(mp4Blob);
                
                // Cleanup video elements
                videoEls.forEach(v => { v.pause(); v.src = ''; });
            } catch (err) {
                console.error('MP4 conversion error:', err);
                reject(err);
            }
        };

        recorder.onerror = (e) => {
            reject(new Error('Kayıt hatası: ' + (e.error || e.message || 'unknown')));
        };

        recorder.start();

        let recordingStartTime = performance.now();
        let currentSceneIndex = -1;
        let activeVideo = null;

        function drawFrame() {
            if (recorder.state !== 'recording') return;

            const now = performance.now();
            const elapsed = (now - recordingStartTime) / 1000;

            if (elapsed < videoDuration) {
                // Video phase
                const sceneIndex = Math.floor(elapsed / sceneDuration);
                
                // Transition to new scene
                if (sceneIndex !== currentSceneIndex) {
                    if (activeVideo) activeVideo.pause();
                    currentSceneIndex = sceneIndex;
                    activeVideo = videoEls[sceneIndex];
                    activeVideo.currentTime = 0;
                    activeVideo.play().catch(e => console.warn('Play failed:', e));
                }

                if (activeVideo) {
                    drawVideoCover(ctx, activeVideo, CANVAS_WIDTH, CANVAS_HEIGHT);
                }

                const vignette = ctx.createRadialGradient(
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.3,
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.6
                );
                vignette.addColorStop(0, 'transparent');
                vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                const sceneElapsed = elapsed % sceneDuration;
                
                // Combine text and textSettings
                const quotePayload = {
                    text: scenes[sceneIndex].quote,
                    align: textSettings.align,
                    fontSize: textSettings.fontSize,
                    lineHeight: textSettings.lineHeight
                };

                drawQuoteText(ctx, quotePayload, CANVAS_WIDTH, CANVAS_HEIGHT, sceneElapsed, sceneDuration);
                drawBranding(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

                onProgress(Math.min(elapsed / totalDuration, 0.7));
            } else {
                // Outro phase
                if (activeVideo) {
                    activeVideo.pause();
                    activeVideo = null;
                }
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                if (logoImage) {
                    const maxLogoW = CANVAS_WIDTH * 0.5;
                    const maxLogoH = CANVAS_HEIGHT * 0.3;
                    const scale = Math.min(maxLogoW / logoImage.width, maxLogoH / logoImage.height);
                    const logoW = logoImage.width * scale;
                    const logoH = logoImage.height * scale;
                    const logoX = (CANVAS_WIDTH - logoW) / 2;
                    const logoY = (CANVAS_HEIGHT - logoH) / 2;
                    ctx.drawImage(logoImage, logoX, logoY, logoW, logoH);
                }

                const outroElapsed = elapsed - videoDuration;
                const totalProgress = elapsed / totalDuration;
                onProgress(Math.min(totalProgress, 0.99));

                if (outroElapsed >= OUTRO_DURATION) {
                    onProgress(1);
                    setTimeout(() => {
                        if (recorder.state === 'recording') recorder.stop();
                    }, 100);
                    return;
                }
            }

            requestAnimationFrame(drawFrame);
        }

        drawFrame();
    });
}

/**
 * Draw video frame to canvas with cover fit
 */
function drawVideoCover(ctx, video, canvasW, canvasH) {
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!videoW || !videoH) return;

    const videoRatio = videoW / videoH;
    const canvasRatio = canvasW / canvasH;

    let sx, sy, sw, sh;
    if (videoRatio > canvasRatio) {
        sh = videoH;
        sw = videoH * canvasRatio;
        sx = (videoW - sw) / 2;
        sy = 0;
    } else {
        sw = videoW;
        sh = videoW / canvasRatio;
        sx = 0;
        sy = (videoH - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
}

/**
 * Draw motivational quote text centered on canvas with cinematic intro animation
 */
function drawQuoteText(ctx, textPayload, canvasW, canvasH, elapsed, sceneDuration = 6) {
    const {
        text,
        align = 'center',
        fontSize: uiFontSize = '1.8rem',
        lineHeight: uiLineHeight = '1.1'
    } = typeof textPayload === 'string' ? { text: textPayload } : textPayload;

    // Convert rem to px (base 16, scaled for 1080p canvas)
    // The UI preview is ~320px-360px wide. Canvas is 1080px. Factor ~3.0-3.3
    const basePX = parseFloat(uiFontSize) * 16;
    const fontSize = basePX * 3.2; // Optimized for 1080x1920
    const lineHeight = fontSize * parseFloat(uiLineHeight);
    const maxWidth = canvasW * 0.85;

    // Fade in / Fade out logic
    const fadeDuration = 1.0; // 1 saniye fade in, 1 saniye fade out
    let opacity = 1;

    if (elapsed < fadeDuration) {
        opacity = elapsed / fadeDuration;
    } else if (elapsed > sceneDuration - fadeDuration) {
        opacity = Math.max(0, (sceneDuration - elapsed) / fadeDuration);
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `italic 500 ${fontSize}px "Cormorant Garamond", serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    // Text lines logic
    const lines = wrapText(ctx, text, maxWidth);
    const totalHeight = lines.length * lineHeight;
    const startY = (canvasH - totalHeight) / 2 + lineHeight / 2;

    // Premium text shadow
    ctx.shadowColor = `rgba(0, 0, 0, 0.7)`;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 4;
    ctx.shadowOffsetX = 0;

    const xPos = align === 'center' ? canvasW / 2 : (align === 'left' ? canvasW * 0.075 : canvasW * 0.925);

    lines.forEach((line, index) => {
        ctx.fillText(line, xPos, startY + index * lineHeight);
    });

    ctx.restore();
}

/**
 * Draw branding overlays on canvas (Poppins font)
 */
function drawBranding(ctx, canvasW, canvasH) {
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Top center: MOTİVE HİSSET
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.letterSpacing = '10px';
    ctx.fillText('MOTİVE HİSSET', canvasW / 2, canvasH * 0.06);
    ctx.letterSpacing = '0px';

    // 2. Bottom left: @motivehisset
    ctx.font = '500 28px "Poppins", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('@motivehisset', canvasW * 0.06, canvasH * 0.88);

    // 3. Bottom right: motivehisset.com
    ctx.textAlign = 'right';
    ctx.fillText('motivehisset.com', canvasW * 0.94, canvasH * 0.88);
}

/**
 * Word wrap text for canvas
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Cleanup after a delay
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 3000);
}
