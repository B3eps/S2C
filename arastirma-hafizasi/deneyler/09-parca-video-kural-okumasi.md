# 09 · Parça Trades anlatımı ve M15/M1 araştırma fikri

Kaynak, 19 Kasım 2026'da verilen iki zaman damgalı döküm. YouTube sayfaları bu oturumda yüklenmedi. İmleçle seçilen mum, çizilen sınır ve görünen fiyatların tam koordinatları metinden doğrulanamadı. [Altın canlı işlem özeti](https://www.youtube.com/watch?v=m8GLmRxPlWI) · [Kural ve işlem örnekleri](https://www.youtube.com/watch?v=Mdxv5SV2qHY)

## Dökümde görülen karar sıraları

| Örnek | Giriş öncesi olaylar ve işlem kararı |
|---|---|
| Altın short 02:02–03:36 | M5 bullish FVG aşağı kırılıp invert oluyor. Anlatıcı likiditeye tepkiyi ve düşüşün devamını görmek için giriş bekliyor. M1'de düşüş devamı, yeni bearish FVG, o FVG'ye temas ve aşağı yönlü mini structure point. Hedef aşağıdaki H1 likiditesi, H4/D1'de de görünür. TP'yi karşı tepki beklenen M3 FVG'nin üstünde tutmak istiyor. Haftalık FVG konuşmada bağlam. |
| Kural videosu 03:43–05:34 | Önce daily bias. Engulf, belirlenmiş FVG/iFVG/OB ile ilişkili olmalı. Mini structure point yön teyidi. 07:35–08:08 bölümünde daha küçük zaman dilimindeki ters hareket, üst zaman diliminde geri çekilme olabilir. Seans ucu süpürmesi ağırlıkla NQ/S&P örneğinde anlatıldı. Altın için her işlemde zorunlu kabul edilmedi. |
| Kural videosu 09:27–12:24 | Birikmiş M5 FVG'leri tek bölge gibi işaretliyor. Bunlar invert olmadan önceki engulf işaretlerinden geçiyor. M3'te bölge aşılırken giriş. Yönün tersindeki önceki engulf'u pas geçiyor. |
| Kural videosu 13:13–14:36 | Fiyatın geri çekilmesinin ardından önceden işaretlediği yerel dip altında kapanış short tetikleyicisi. Aşağıdaki likidite hedefi. |
| Kural videosu 15:49–17:53 | H4 FVG teması ve aşağı displacement. M1 bullish FVG aşağı invert oluyor ve aynı mum işaretli M1 dibinin altında kapanıyor. Bu örnekte iki teyit aynı M1'de. Dökümde anlatıcı tam giriş işaretini düzeltip yer konusunda tereddüt ediyor. |
| Kural videosu 19:27–20:24 | Örnekte short stop için M1 FVG'nin üstü. 2R elde etmek için stopu FVG içine veya daha dar yere çekmeye karşı çıkıyor. |
| Kural videosu 20:55–22:07 | Anlatıcı güçlü gördüğü üst yön ve hedef gerekçesiyle bir iFVG girişini seçiyor. Bunu tek iFVG ile girişin olağan kuralı olarak sunmuyor. |

## S2C ile doğrulanmış farklar

- [Parça motoru](../../src/lib/parcaSetup.ts) otomatik yönü kapanmış H1/H4/D1 okumalarından yaklaştırır. Engulf, bölgeyi kapanışla geçme ve FVG'yi iFVG'ye dönüştürme kuralı ile swing kapanış kırılımı zaten var. Klasik iki olaya ayar penceresi tanır. Videoda bir örnekte ikisi aynı M1'de. Motor stopları türetilmiş bölge ve ATR ile, hedefi R katıyla hesaplar.
- [Önceki likidite motoru](../../src/lib/liquidityStrategies.ts) H1/M15 yapısını, M15 sweep'i ve bir varyantta M1 yapı teyidini birleştirir. Hedefi fiyatın ötesindeki daha önce alınmamış M15 pivotu olarak seçer. Bu, kullanıcının M15/M1 yön uyumu ile H4'ü bağlam olarak kullanma tarifinden farklı.
- Anlatıcı videoda 200K hesapta seçilen beş gün ve yedi işlem bildirdiğini söylüyor. İşlemlerin çoğunun NQ olduğunu da belirtiyor. XAU/USD 5.000 $ S2C sonucu ayrı ölçülecek.

## Araştırma kararı

Kullanıcı bu araştırmayı tek aktif odak yaptı. İki döküm ortak bir yöntem ailesini anlatıyor. İlk altın örneği M5 inversion sonrası M1 yönlü FVG geri teması ve swing kırılımı. İkinci dökümde bir örnek aynı M1 mumunda inversion ve swing kırılımı. İki sıra, aynı üst yön ve fiyat yapısı fikrinin farklı giriş biçimleri olarak kaydedilir.

Kullanıcı fikrinin çekirdeği M15 yönü ile M1'in tekrar o yöne dönmesi. H4 yönü başlangıçta ayrı alan olarak kaydedilir. Dökümden alınan karşılaştırma, üst bölge teması veya likidite alımı, FVG'nin invert olması, yeni yönlü FVG'ye dönüş ve kapanışla M1 swing kırılımı gibi olayların zaman sırasıdır. M5/M3 gerekiyorsa yalnız kapanmış bağlam verisidir. Emir M1 üzerinden değerlendirilir.

İki teyidi ayrı kaydet. Birinci karşılaştırma yalnız M1 swing kapanış kırılımı. İkincisi aynı fırsat kümesinde daha önce oluşmuş yönlü FVG'ye geri temas ile kırılım. Üçüncüsü aynı M1'de karşı FVG inversion ve swing kırılımı. Sweep'i ayrı işaretle. Stopu geçersizlik seviyesinin ötesinde işaretle, hedefi girişte görünür karşı swing veya önündeki ters bölgeye göre belirle ve R'yi sonuç olarak kaydet. M5 birikmiş FVG'ler için blok sınırı kuralı ayrıca gerekebilir.

Teknik iş başlamadan ayrıştırılması gereken en etkili belirsizlik, M15 ve M1 yönünün hangi kapanışla değiştiği ve hangi pivotun yerel kırılım seviyesi sayıldığıdır. Önerilen ilk ölçüm, iki solda ve iki sağda kapanmış muma dayalı swing, son karşı swing'in kapanışla aşılması ve bu kuralla işaretlenmiş bir kabul ve bir pas örneği. Bu henüz araştırma varsayımı. Belirli videodaki mumları doğrulamak için tarih/saat ya da grafik karesi gerekiyor. Dönem kilidi, sonuç ve uygulama değişikliği bu okuma sırasında üretilmedi.
