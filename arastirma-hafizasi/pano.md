---
tags: [xauusd, pano]
---

# XAU/USD · İkinci Beyin

S2C'de ana enstrüman **XAU/USD**, giriş ve gerçekleşme ölçeği **M1**. Araştırma sorusunu çözmek için M15, H4 ve günlük bağlamda yalnız karar anına kadar çıkan veri kullanılır.

| İhtiyacın | Açılacak not |
|---|---|
| Altının spot fiyatı, vadeli işlemler, kotasyon ve maliyet | [[bilgi/xauusd-mekanigi|XAU/USD piyasa mekaniği]] |
| Altın işlemcilerinin yöntemleri ve haber sonrası M1 hipotezi | [[bilgi/xauusd-m1-piyasa-arastirmasi|M1 piyasa araştırması]] |
| Mum, swing, FVG/iFVG, order block, EMA, VWAP ve ATR | [[bilgi/m1-grafik-okuma|M1 grafiği nasıl okunur?]] |
| Hipotez kurma, kazanç ve kayıp teşhisi | [[arastirma-isleyisi|Araştırma akışı]] |
| Simülatörün neyi modellediği | [[guvenilirlik|Güvenilirlik notu]] |
| Kullanıcının hedef ve tercihleri | [[istek-ve-kisitlar|İstek ve sınırlar]] |
| Önceki deneyler ve komutlar | [[README|Araştırma dizini]] |

## Kaldığımız yer

Maliyet sonrası doğrulanmış kârlı bir M1 kuralı bulunmadı. Parça yaklaşımının mekanik yorumu, altın fiyatını araştırırken kullandığımız belgeli karşılaştırmalardan biri. İlk sürümün ileri dönemi önceden kilitli. [[deneyler/10-parca-m1-sonuc|Parça M1]] · [[deneyler/11-parca-kontrol-sonuc|Eşleştirilmiş kontrol ve tik denetimi]]

Parça'nın altın videosuyla ilk modelin farkı günlük yön, aynı itkiye bağlı MSP ve hedef önü M3 engel. Tek short örneği grafikte tarih/saat doğrulaması bekliyor. [[deneyler/parca-altin-islem-eslestirme|Altın işlemi eşleştirme notu]]

Son deney 201 uygun günde altı M1 davranışını karşılaştırdı. Sığ ilk süpürme örneklemi yetersiz, saatlik kırılım takibi üç dönemde negatif, derin Fibonacci geliştirmedeki artısını doğrulamada kaybetti. Altı örnek gerçek kotasyonla denetlendi. İleri dönem açılmadı. Kaldığımız araştırma sorusu, önceden bilinen seviye temaslarında yaklaşım ve tepkinin ekonomik etkisini yeterli eşleşmeyle ölçmek. [[deneyler/13-m1-davranis-sonuc|M1 davranış raporu]]

## Hızlı okuma

Piyasa bilgisi için yalnız [[bilgi/xauusd-mekanigi]] ile başla. Bir strateji sorusunda ayrıca [[arastirma-isleyisi]] ve ilgili tek deney notu yeterli. Sayısal işlem defterleri proje dışındaki `analysis/` klasöründe, rapor bağlantıları üzerinden açılır.
