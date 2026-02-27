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
async function loadFFmpeg() {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

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
 * @param {HTMLVideoElement} videoEl - source video element
 * @param {string} quoteText - motivational quote to overlay
 * @param {Function} onProgress - progress callback (0-1)
 * @returns {Promise<Blob>} - recorded MP4 video blob
 */
export async function recordVideo(videoEl, quoteText, onProgress) {
    const canvas = document.getElementById('record-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 1. Load FFmpeg and fonts
    await loadFFmpeg();
    try {
        await document.fonts.load('italic 500 84px "Cormorant Garamond"');
    } catch (e) {
        console.warn('Font load failed, proceeding with fallback:', e);
    }

    // Ensure logo is loaded
    await loadLogo();

    // Determine durations
    const videoDuration = Math.min(videoEl.duration || MAX_VIDEO_DURATION, MAX_VIDEO_DURATION);
    const totalDuration = videoDuration + OUTRO_DURATION;

    return new Promise((resolve, reject) => {
        const stream = canvas.captureStream(FPS);

        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 8000000 // Higher bitrate for cleaner source
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
            try {
                const webmBlob = new Blob(chunks, { type: 'video/webm' });

                // 2. Transcode to MP4 using FFmpeg
                onProgress(0.95, 'MP4\'e dönüştürülüyor...'); // Custom signal for processing

                const inputName = 'input.webm';
                const outputName = 'output.mp4';

                await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));

                // Libx264 for MP4, ultrafast for speed in browser
                // -crf 22 is a good balance of quality/size
                await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22', '-pix_fmt', 'yuv420p', outputName]);

                const data = await ffmpeg.readFile(outputName);
                const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });

                console.log('MP4 conversion complete, size:', mp4Blob.size);
                resolve(mp4Blob);
            } catch (err) {
                console.error('MP4 conversion error:', err);
                reject(err);
            }
        };

        recorder.onerror = (e) => {
            reject(new Error('Kayıt hatası: ' + (e.error || e.message || 'unknown')));
        };

        // Request data every 100ms
        recorder.start(100);

        // Reset video
        videoEl.currentTime = 0;
        videoEl.muted = true;

        const playPromise = videoEl.play();
        if (playPromise) {
            playPromise.catch(e => console.warn('Play failed:', e));
        }

        let recordingStartTime = performance.now();
        let phase = 'video';
        let outroStartTime = null;

        function drawFrame() {
            if (recorder.state !== 'recording') return;

            const now = performance.now();
            const elapsed = (now - recordingStartTime) / 1000;

            if (phase === 'video') {
                // Draw video frame to canvas
                drawVideoCover(ctx, videoEl, CANVAS_WIDTH, CANVAS_HEIGHT);

                // Draw cinematic vignette for text readability
                const vignette = ctx.createRadialGradient(
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.3,
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.6
                );
                vignette.addColorStop(0, 'transparent');
                vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                // Draw quote text with intro animation
                drawQuoteText(ctx, quoteText, CANVAS_WIDTH, CANVAS_HEIGHT, elapsed);

                // Draw branding overlays (Poppins font)
                drawBranding(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

                // Update progress
                onProgress(Math.min(elapsed / totalDuration, 0.7));

                // Check if we should transition to outro
                if (elapsed >= videoDuration || videoEl.ended) {
                    phase = 'outro';
                    outroStartTime = performance.now();
                    videoEl.pause();
                }
            }

            if (phase === 'outro') {
                // Draw white background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                // Draw logo centered
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

                const outroElapsed = (performance.now() - outroStartTime) / 1000;
                const totalProgress = (videoDuration + outroElapsed) / totalDuration;
                onProgress(Math.min(totalProgress, 0.99));

                if (outroElapsed >= OUTRO_DURATION) {
                    onProgress(1);
                    // Stop recording after a small delay to ensure last frame is captured
                    setTimeout(() => {
                        if (recorder.state === 'recording') {
                            recorder.stop();
                        }
                    }, 100);
                    return;
                }
            }

            requestAnimationFrame(drawFrame);
        }

        // Wait for video to be ready then start drawing
        if (videoEl.readyState >= 2) {
            recordingStartTime = performance.now();
            drawFrame();
        } else {
            videoEl.addEventListener('canplay', function onCanPlay() {
                videoEl.removeEventListener('canplay', onCanPlay);
                recordingStartTime = performance.now();
                drawFrame();
            });
        }
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
function drawQuoteText(ctx, text, canvasW, canvasH, elapsed) {
    const maxWidth = canvasW * 0.8;
    const fontSize = 84;
    const lineHeight = fontSize * 1.35;

    // Cinematic Animation (1.5s duration)
    const animDuration = 1.5;
    let opacity = 1;
    let blur = 0;
    let scale = 1;

    if (elapsed < animDuration) {
        const progress = elapsed / animDuration;
        // Cubic-bezier(0.22, 1, 0.36, 1) approximate
        const ease = 1 - Math.pow(1 - progress, 3);

        opacity = ease;
        blur = 15 * (1 - ease);
        scale = 1.05 - (0.05 * ease);
    }

    ctx.save();

    // Applying cinematic blur is expensive on canvas, but supported in modern browsers
    if (blur > 0 && typeof ctx.filter !== 'undefined') {
        ctx.filter = `blur(${blur}px)`;
    }

    // Apply scale for animation
    if (scale !== 1) {
        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.scale(scale, scale);
        ctx.translate(-canvasW / 2, -canvasH / 2);
    }

    ctx.globalAlpha = opacity;
    ctx.font = `italic 500 ${fontSize}px "Cormorant Garamond", serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw soft background behind text for better readability
    const lines = wrapText(ctx, text, maxWidth);
    const totalHeight = lines.length * lineHeight;
    const startY = (canvasH - totalHeight) / 2 + lineHeight / 2;

    const bgGlow = ctx.createRadialGradient(
        canvasW / 2, canvasH / 2, 0,
        canvasW / 2, canvasH / 2, totalHeight * 1.5
    );
    bgGlow.addColorStop(0, `rgba(0, 0, 0, ${0.4 * opacity})`);
    bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, canvasW, canvasH); // Fill the glow (clamped by gradient)

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    lines.forEach((line, index) => {
        ctx.fillText(line, canvasW / 2, startY + index * lineHeight);
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
