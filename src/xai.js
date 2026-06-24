// API anahtarı .env dosyasından okunur (VITE_GEMINI_API_KEY). Koda gömülmez.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Generates N motivational sentences using Google Gemini API
 * @param {number} count - number of scenes
 * @returns {Promise<string[]>} array of sentences
 */
export async function generateScenesQuotes(count) {
    const prompt = `Sen çok etkili bir motivasyon konuşmacısısın. Kısa bir dikey format (Reels/TikTok/Shorts) motivasyon videosu için TEK bir güçlü, akıcı ve vurucu motivasyon cümlesi oluştur; sonra bu TEK cümleyi anlamlı duraklama noktalarından (virgül, bağlaç) tam olarak ${count} parçaya böl. Her parça bir videoda gösterilecek; parçalar arka arkaya okunduğunda tek ve bütün bir cümle oluşturmalı.

Örnek (2 parça için):
Cümle: "Bazen sıkışmış hissetmek normal, ama bu senin kaderin değil."
Sonuç: ["Bazen sıkışmış hissetmek normal", "ama bu senin kaderin değil"]

Kurallar:
1. Parçalar bağımsız sözler DEĞİL; hepsi birleşince TEK bir bütün cümle/düşünce oluşturmalı.
2. Her parça bir öncekini doğal olarak tamamlamalı.
3. Sadece ve sadece şu formatta bir JSON array döndür: ["parça1", "parça2", ...]
4. Dizinin tam olarak ${count} elemanı olmalı.
5. İlk parça dışındaki parçalar küçük harfle başlayan, cümlenin devamı niteliğinde olmalı.
6. Toplam cümle kısa ve okunabilir olmalı. Başka hiçbir açıklama, markdown veya text ekleme.`;

    const requestBody = JSON.stringify({
        contents: [
            {
                parts: [
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.8,
            responseMimeType: 'application/json'
        }
    });

    // Gemini ücretsiz katmanda yoğunlukta 503/429 dönebilir; bu durumda
    // artan beklemeyle birkaç kez yeniden dene.
    const MAX_RETRIES = 4;
    const RETRYABLE = [429, 500, 503];

    try {
        let response;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': API_KEY
                },
                body: requestBody
            });

            if (response.ok) break;

            if (RETRYABLE.includes(response.status) && attempt < MAX_RETRIES) {
                const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s
                console.warn(`Gemini ${response.status} döndü, ${waitMs}ms sonra tekrar deneniyor (${attempt + 1}/${MAX_RETRIES})...`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }
            break;
        }

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API hatası: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error && errorJson.error.message) {
                    errorMessage = `API Hatası: ${errorJson.error.message}`;
                }
            } catch (e) {
                if (errorText) errorMessage += ` - ${errorText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        let content = data.candidates[0].content.parts[0].text.trim();

        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '').trim();
        }

        let sentences = JSON.parse(content);
        if (!Array.isArray(sentences)) {
            throw new Error('API geçerli bir dizi (array) döndürmedi.');
        }

        // Tam olarak count parçaya getir (fazlaysa kırp, azsa son parçayı tekrarla)
        if (sentences.length > count) {
            sentences = sentences.slice(0, count);
        } else {
            while (sentences.length < count && sentences.length > 0) {
                sentences.push(sentences[sentences.length - 1]);
            }
        }

        // Parçaları temizle: noktalama kaldır; ilk parça dışındakileri küçük harfe çevir
        return sentences.map((s, i) => cleanFragment(String(s), i));
    } catch (error) {
        console.error('generateScenesQuotes error:', error);
        throw error;
    }
}

/**
 * Bir cümle parçasını videoda gösterilecek hale getirir.
 * - Baştaki/sondaki tırnak ve cümle noktalama işaretlerini kaldırır.
 * - İlk parça (index 0) dışındaki tüm parçaları küçük harfe çevirir.
 * - Türkçe büyük/küçük harf dönüşümü için 'tr' locale kullanır (İ→i, I→ı).
 * @param {string} text
 * @param {number} index - parçanın sırası (0 = ilk parça)
 * @returns {string}
 */
function cleanFragment(text, index) {
    let t = (text || '').trim();
    // Çevreleyen tırnak işaretlerini kaldır
    t = t.replace(/^["'«»“”‘’]+|["'«»“”‘’]+$/g, '').trim();
    // Cümle noktalamasını kaldır (kesme işareti ' korunur: Türkçe ekler için)
    t = t.replace(/[.,;:!?…]/g, '').trim();
    // İlk parça hariç tamamını küçük harfe çevir
    if (index > 0) {
        t = t.toLocaleLowerCase('tr-TR');
    }
    return t;
}
