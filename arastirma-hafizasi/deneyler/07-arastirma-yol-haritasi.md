# 07 · XAU/USD M1 araştırma yol haritası

Sonraki kullanıcı yönlendirmesiyle önce mevcut en iyi adayın giriş, stop ve çalışma mantığı ayrıştırıldı. Tamamlanan ön aşama [[08-aday-kayip-teshisi]] dosyasında. Aşağıdaki maddeler araştırmanın kalan olası aşamalarıdır.

19 Kasım 2026. Dört stratejiden uygulamaya taşınabilecek kadar doğrulanmış bir aday çıkmadı. Ayrılmış kısa bölümde olumlu olan teyitli başarısız kırılım 14 işlemde +2,34 $/işlem, VWAP 10 işlemde +3,02 $/işlem verdi. İkisi de geliştirme ve doğrulamada eksideydi. İki kısa pencerenin belirsizlik aralıkları sıfırı kapsıyor.

| Başarısız kırılım | Geliştirme | Doğrulama | Ayrılmış test |
|---|---:|---:|---:|
| Birincil, bid hareketi / işlem | −0,77 $ | +0,73 $ | +4,35 $ |
| Birincil, net / işlem | −4,37 $ | −3,73 $ | −1,01 $ |
| Ek teyitli, bid hareketi / işlem | +0,68 $ | −1,78 $ | +6,34 $ |
| Ek teyitli, net / işlem | −1,81 $ | −4,74 $ | +2,34 $ |

Bid hareketi, gerçekleşmiş işlem zamanları ve miktarları sabitken yapılan maliyet ayrıştırmasıdır. Başarısız kırılımın orijinali, maliyet ve fiyat hareketi için karşılaştırma örneği olarak saklanır. Fibonacci ve açılış kırılımı maliyet öncesi üç bölümde de eksideydi. VWAP'ın 21 keşif ayarı birleşik dönemde ekside kaldı. İlgili rapor [[06-islem-kayip-denetimi]].

1. **Önce dolum maliyetini ölç.** Bilinen tarihlerden önceden belirlenmiş stop, hedef ve arada boşluk olan örnekleri Dukascopy bid/ask tikleriyle yeniden oynat. İşlemler M1 sinyaliyle açılmaya devam eder. Tik verisi stop/TP sırası, gerçekleşebilir spread ve kotasyon sıçramalarını iyileştirmek için kullanılır. Kotasyon sağlayıcısı ve varsa demo dolumları ayrılır. Komisyon, olumsuz dolum varsayımı ve yüksek spread senaryosu testten önce kaydedilir. [Dukascopy tikler](https://wiki.dukascopy.com/en/development/strategy-api/historical-data/history-ticks/)
2. **İlk yeni hipotezi işlem girişinden ayırarak ölç.** Aday, tamamlanmış M15 aralığı dışındaki M1 kapanışın yeniden aralık içine dönmesi ve sonraki M1'de aralık içine doğru yapıyı kırması. İlk karşılaştırma aynı aralık ve ilk geri kapanış, ikinci karşılaştırma M1 yapı teyidi. Önceden belirlenen 5/15/30 dakika ufuklarında işaretli bid hareketi, işlem lehine/aleyhine mesafe ve anlık tahmini gidiş-dönüş maliyeti karşılaştırılır. Brüt hareket tutarlı bir maliyet payı bırakırsa giriş, stop ve hedef kuralları tasarlanır. Dönemler arası işaret değişirse aday yeniden filtrelenmeden elenebilir.
3. **Adayı zaman içinde doğrula.** Eski veriyle geliştir, art arda tarih bloklarında doğrula, tek birincil kural kümesini dondur ve daha önce incelenmemiş daha ileri dönemi bir kez aç. Veri kalitesi, uygun günler, seans grupları, aday sayısı, belirsizlik hedefi ve durma kuralı önceden kaydedilir. Gün veya hafta bloklarıyla net beklenti aralığı hesaplanır. Ayar değişikliği yeni bir deney ve yeni bir ileri dönem gerektirir. [Çoklu deneme ve aşırı uyum](https://escholarship.org/uc/item/4w1110bb)
4. **Kâr ve hesap riskine ayrı geçiş ölçütü koy.** Önerilen eşik, ileri testte maliyet sonrası pozitif işlem başı beklenti ve sıfırın üstünde belirsizlik alt sınırı. Net sonuç daha olumsuz dolum senaryosunda da pozitif kalırsa günlük dağılım, azami düşüş, FTM geçiş/ihlal/açık hesap oranı ve ihlale kadar süre değerlendirilir. Demo ileri takipte gerçekleşen spread ve dolum ayrışması ölçülür. %65 kazanma oranı ve 100 $/gün, açıklanan sonuç ölçüleridir. Kabul koşulu olarak dayatılmaz.

Yol haritası araştırma önerisidir. Yeni aday henüz sınanmadı. S2C strateji entegrasyonu bu aşamadan sonra ayrı karardır.
