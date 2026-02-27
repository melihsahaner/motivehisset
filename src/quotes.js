// Turkish motivational quotes collection
const quotes = [
  "Başarı, her gün tekrarlanan küçük çabaların toplamıdır.",
  "Hayallerinin peşinden gitmekten asla vazgeçme.",
  "Her şey imkânsız görünür, ta ki yapılana kadar.",
  "Bugün zor olan, yarın gücün olacak.",
  "Fırtına ne kadar sert eserse, güneş o kadar parlak doğar.",
  "Kendine inan, gerisi gelir.",
  "Düşmek yenilgi değildir, kalkmamak yenilgidir.",
  "En karanlık gece bile bir gün sona erer.",
  "Büyük yolculuklar tek bir adımla başlar.",
  "Cesaretini topla, hayatını değiştir.",
  "Başarısızlık, başarıya giden yolun ta kendisidir.",
  "Zorluklar, seni güçlendirmek için vardır.",
  "Hayat, cesur olanları ödüllendirir.",
  "Hayal et, inan, başar.",
  "Sınırlarını sen belirle, sonra onları aş.",
  "Her yeni gün, yeni bir başlangıçtır.",
  "Güçlü ol, çünkü bu fırtına da geçecek.",
  "Kendi ışığını yak, karanlık kendiliğinden kaybolur.",
  "Yapamam deme, henüz yapamadım de.",
  "Azim, yeteneğin yerini alır.",
  "Bugün ektiğin tohumlar, yarın meyve verecek.",
  "Hayat sana ne verirse versin, ayağa kalk.",
  "Başarı, konfor alanının dışında başlar.",
  "Küçük adımlar, büyük değişimlere yol açar.",
  "Sen düşündüğünden çok daha güçlüsün.",
  "Hedeflerine odaklan, engeller küçülür.",
  "Sabır ve azim, her kapıyı açar.",
  "Kendi hikâyeni sen yaz.",
  "Değişim, cesaretle başlar.",
  "Her zorluk, bir fırsatın habercisidir.",
  "Yıldızlar, sadece karanlıkta parlar.",
  "Hayallerin büyüklüğü, cesaretinin ölçüsüdür.",
  "Bugünün çabası, yarının zaferidir.",
  "İmkânsız, sadece bir bakış açısıdır.",
  "Rüzgâra karşı yürüyen, en güzel manzaraya ulaşır.",
  "Başlamak, bitirmenin yarısıdır.",
  "Kendi yolunu kendin çiz.",
  "Güneş her zaman bulutların arkasındadır.",
  "Dünya, harekete geçenlere aittir.",
  "İnandığın sürece, her şey mümkündür.",
  "Güçlü bir irade, her engeli aşar.",
  "Bugün bir adım at, yarın bir devrim yarat.",
  "Kendinle gurur duyacağın bir hayat yarat.",
  "Zirveye ulaşmak istiyorsan, tırmanmaya başla.",
  "Hayatın anlamı, onu anlamlı kılmaktır.",
  "En iyi zaman şimdi, en iyi yer burasıdır.",
  "Korku geçicidir, pişmanlık kalıcıdır.",
  "Başarı bir yolculuktur, bir varış noktası değil.",
  "Her gün bir mucize için yeni bir şanstır.",
  "Dağları yerinden oynatmak, küçük taşları taşımakla başlar.",
  "Kendini keşfet, sınırlarını yeniden tanımla.",
  "Işığını dünyayla paylaş.",
  "En büyük zafer, kendini yenmektir.",
  "Umut, karanlıktaki en parlak yıldızdır.",
  "Yolculuğun tadını çıkar, hedefe ulaşmak bonus.",
  "Her son, yeni bir başlangıcın kapısıdır.",
  "Potansiyelini keşfetmek için sınırlarını zorla.",
  "Hayat kısa, hayallerin büyük olsun.",
  "Tutku ile yapılan iş, başarıyı getirir.",
  "Bugün verdiğin emek, yarın seni tanımlayacak."
];

let lastIndex = -1;

/**
 * Returns a random motivational quote, avoiding immediate repeats
 */
export function getRandomQuote() {
  let index;
  do {
    index = Math.floor(Math.random() * quotes.length);
  } while (index === lastIndex && quotes.length > 1);
  lastIndex = index;
  return quotes[index];
}

export default quotes;
