# VWAP duyarlılık deneyi protokolü

19 Kasım 2026. Yeni varyantlar çalıştırılmadan önce kaydedildi. Bu deney eski veriyi yeniden kullanır ve ayar seçimi için bağımsız kanıt üretmez. Eski VWAP çalışmasının geliştirme ve doğrulama bölümleri, 7 Eylül–9 Kasım arasındaki önceki strateji bölümleri (ilgili kayıtlı hariç tarihlerle) ve 9–18 Kasım eski VWAP testi ayrı gösterilir. Birleşik sonuç betimseldir. Yeni ileri dönem adayı [2026-11-20, 2027-02-01) UTC. Bu dosya o dönem için eşik veya kazanan seçmez. Güncel veriyle sadece duyarlılık ölçülür.

## Sınanan mekanizma

Merkez çizgisi Dukascopy bid M1 tipik fiyatının (H+L+C)/3 hacim ağırlıklı birikimidir. Sinyal mumunun başındaki bilinen VWAP ve son 20 tamamlanmış M1'in ortalama gerçek aralığı sabit referans alınır. Long, dışarı taşan bid dibinden merkeze doğru kapanır ve pozitif mum ister. Short simetriktir. Mekanizmanın lehine beklenti, tek tek ayar değişiklikleri altında net sonucun istikrarlı biçimde pozitif olması, eşit ağırlıklı kontrolden daha iyi olması ve işlem yönündeki 5/15/30 dk fiyat değişiminin pozitif olmasıdır. Bu kıstaslar nedensellik ispatı değildir.

## Önceden seçilen tek değişkenli karşılaştırmalar

| Eksen | Değişiklik | Sınadığı fikir |
|---|---|---|
| Hacim | Her muma eşit ağırlık | Hacim alanı bilgi taşıyor mu? |
| Başlangıç | Merkez 07:00 yerine 08:00 UTC | Seans başlangıcı seçimine bağımlı mı? |
| ATR | 10, 40 M1 | Hızlı ya da yavaş oynaklık tahmini |
| Dış çizgi | 1,8 ve 2,2 ATR | Dışarı taşma kuvveti |
| İç çizgi | Alt kapanış mesafesi 0,75 ATR | Geometri filtresi bunu zaten belirliyor mu? |
| Mum | Pozitif/negatif mum gövdesi filtresiz | Geri kapanış dışında gövde yönü bilgi taşıyor mu? |
| Trend | Son 15 M1 VWAP değişimi en çok 0,50 veya 0,25 ATR | Yatay referans faydalı mı? |
| Stop | Uçtan 0,10 ve 0,40 ATR pay | Piyasa gürültüsüne verilen boşluk etkisi |
| Sinyal arası | 30 M1 yerine 0 | Bağlantılı sinyalleri elemenin etkisi |
| Hedef | 1,00 R, 1,50 R veya sinyal anında bilinen sabit VWAP | Sonuç çıkış yöntemine bağlı mı? Giriş sinyalindeki 1,25 R geometrisi sabit kalır. Açılışta sabit referansa erişilmişse emir atlanır. |
| Giriş geometrisi | Varsayılan 1,25 R önkoşulu kaldırılır | Hedefe alan bırakma koşulunun katkısı |
| Maliyet | 0,40 ve 0,60 $ sabit spread, aynı komisyon | Daha geniş spread altında dayanıklılık |
| Yön kontrolü | Aynı baz sinyal anları, ters yön ve açılışın çevresinde yansıtılmış bid stop | Zamanlama etkisini yön fikrinden ayırmaya yönelik kaba kontrol. Pozisyon çakışmaları ve kotasyon tarafı gerçekleşen kohortu değiştirebilir. |

Her varyant bazın diğer ayarlarını korur. Orijinal üç dosyanın tüm işlem ve hesap çıktıları yeniden üretim kontrolüdür. Yön tanısında bazın gerçekleşen girişlerinden sonraki 5/15/30 M1 kapanışı, bid açılışı ve sinyalde sabitlenen ATR ile karşılaştırılır. Ufuk boyunca kesintisiz veri gerekir. 30 dakika içinde sabit VWAP'a bid temasını da ölç. Bunlar çıkıştan bağımsız sonradan gözlenebilir tanılardır. Açılış bid ile hedefin bid tarafına çevrilmiş seviyesi referansa göre ayrıca kıyaslanır. Her dönemde bazın gün ve yön katkıları gösterilir.
