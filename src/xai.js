const API_KEY = 'AIzaSyD3Ts3Zyi9dfgrM_N5NWahui5mHSDrHJn0';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

/**
 * Generates N motivational sentences using xAI Grok API
 * @param {number} count - number of scenes
 * @returns {Promise<string[]>} array of sentences
 */
export async function generateScenesQuotes(count) {
    const prompt = `Sen çok etkili bir motivasyon konuşmacısısın. Kısa bir dikey format (Reels/TikTok/Shorts) motivasyon videosu için ${count} sahneden oluşan, birbiriyle sıkı sıkıya bağlı, mantıksal bir akışı olan ve izleyiciyi adım adım duygusal bir zirveye taşıyan bir motivasyon metni oluştur. 

Kurallar:
1. Sahneler rastgele sözler olmamalı; birbiriyle bağlantılı bir hikaye veya güçlü bir argüman dizisi oluşturmalı.
2. Her sahne bir öncekini tamamlamalı ve bir sonrakine hazırlamalı.
3. Sadece ve sadece şu formatta bir JSON array döndür: ["cümle1", "cümle2", ...]
4. Dizinin tam olarak ${count} elemanı olmalı.
5. Cümleler dikey videoda okunabilmesi için kısa ve öz olmalı (maksimum 10-12 kelime).`;

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.8,
                    responseMimeType: "application/json"
                }
            })
        });

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
        const content = data.candidates[0].content.parts[0].text.trim();
        const sentences = JSON.parse(content);
        if (!Array.isArray(sentences)) {
            throw new Error('API geçerli bir dizi (array) döndürmedi.');
        }

        // Return exact count of sentences, pad with duplicates or slice if necessary
        if (sentences.length > count) {
            return sentences.slice(0, count);
        } else if (sentences.length < count) {
            while (sentences.length < count) {
                sentences.push(sentences[sentences.length - 1]);
            }
            return sentences;
        }

        return sentences;
    } catch (error) {
        console.error('generateScenesQuotes error:', error);
        throw error;
    }
}
