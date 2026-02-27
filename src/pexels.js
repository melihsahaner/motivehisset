// Pexels API integration for fetching nature/landscape videos

const PEXELS_BASE_URL = 'https://api.pexels.com/videos';

const NATURE_QUERIES = [
    'mountain landscape',
    'nature forest',
    'waterfall',
    'ocean waves',
    'sunset sky',
    'clouds timelapse',
    'river stream',
    'snow mountain',
    'green forest',
    'lake nature',
    'rain drops',
    'flowers field',
    'aurora borealis',
    'desert sand',
    'misty mountains'
];

let apiKey = 'n8Vz12g2eGrmN8CNertGVonXNcWfn7Wi2pvGYMq0FBr9pvcnFjulqU93';
let cachedVideos = [];
let lastQueryIndex = -1;

/**
 * Set the Pexels API key
 */
export function setApiKey(key) {
    apiKey = key.trim();
}

/**
 * Get a random search query from the nature queries list
 */
function getRandomQuery() {
    let index;
    do {
        index = Math.floor(Math.random() * NATURE_QUERIES.length);
    } while (index === lastQueryIndex && NATURE_QUERIES.length > 1);
    lastQueryIndex = index;
    return NATURE_QUERIES[index];
}

/**
 * Fetch portrait/vertical videos from Pexels API
 * @returns {Promise<{url: string, image: string, width: number, height: number}>}
 */
export async function fetchRandomVideo() {
    if (!apiKey) {
        throw new Error('API key not set');
    }

    const query = getRandomQuery();
    const page = Math.floor(Math.random() * 3) + 1; // Random page 1-3

    const response = await fetch(
        `${PEXELS_BASE_URL}/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15&page=${page}`,
        {
            headers: {
                'Authorization': apiKey
            }
        }
    );

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Geçersiz API anahtarı. Lütfen kontrol edin.');
        }
        throw new Error(`Pexels API hatası: ${response.status}`);
    }

    const data = await response.json();

    if (!data.videos || data.videos.length === 0) {
        throw new Error('Video bulunamadı. Tekrar deneyin.');
    }

    // Pick a random video from results
    const randomVideo = data.videos[Math.floor(Math.random() * data.videos.length)];

    // Find the best quality portrait video file (prefer HD, mp4)
    const videoFiles = randomVideo.video_files
        .filter(f => f.file_type === 'video/mp4')
        .sort((a, b) => {
            // Prefer portrait orientation
            const aPortrait = a.height > a.width ? 1 : 0;
            const bPortrait = b.height > b.width ? 1 : 0;
            if (bPortrait !== aPortrait) return bPortrait - aPortrait;
            // Then prefer higher quality but not too high (target ~720p-1080p)
            const aScore = Math.abs(a.height - 1080);
            const bScore = Math.abs(b.height - 1080);
            return aScore - bScore;
        });

    const bestFile = videoFiles[0] || randomVideo.video_files[0];

    return {
        url: bestFile.link,
        image: randomVideo.image,
        width: bestFile.width,
        height: bestFile.height,
        duration: randomVideo.duration
    };
}

/**
 * Validate the API key by making a test request
 */
export async function validateApiKey(key) {
    const response = await fetch(
        `${PEXELS_BASE_URL}/search?query=nature&per_page=1`,
        {
            headers: {
                'Authorization': key.trim()
            }
        }
    );
    return response.ok;
}
