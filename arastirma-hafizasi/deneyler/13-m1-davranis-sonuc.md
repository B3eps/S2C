---
tags: [xauusd, m1, deney]
---

# XAU/USD M1 · Süpürme, devam ve Fibonacci

19 Kasım 2026. **Hiçbir kural emir testine geçiş eşiğini karşılamadı.** Sabit seans seviyesindeki sığ süpürme hipotezi için yeterli örnek çıkmadı. Daha sık oluşan saatlik kırılım sonrası devam kuralında ortalama hareket, maliyet öncesinde de üç dönemde aleyhteydi. %60–70 Fibonacci geliştirme döneminde pozitifti ve doğrulamada negatife döndü.

## Karşılaştırmalar

Dukascopy XAU/USD M1 bid. UTC saatleri 07.00–16.00. Geliştirme 5 Ocak–30 Nisan (83 uygun gün), doğrulama 4 Mayıs–7 Ağustos (68 uygun gün), daha önce görülmüş çapraz bölüm 7 Eylül–18 Kasım (50 uygun gün). Son bölümde 20–21 Ekim ve 3 Kasım dışarıda. Bütün tarihler 2026. Uygunluk veya referans için toplam 3 gün elendi. Ana 15 dakika ölçümünde sinyal sonrası mum boşluğu olmadı. Saatlik ek deneyde 30 dakikalık bir yol boşluk nedeniyle çıkarıldı. [Dukascopy veri arşivi](https://www.dukascopy.com/swiss/english/marketwatch/historical/)

Tablo `gözlem sayısı / ortalama net $/ons`. Karar mumunun kapanışından sonraki M1 açılışı ve 15 dakika sonraki açılış kullanıldı. Bid gözlendi ve ask 0,50 $/ons sabit spread ile modellendi. S2C FTM komisyonu taraf başı %0,005. 0,65 $ stres ve 0,20 $ eski S2C spread sonuçları JSON'da.

| 00.00–06.00 sabit seviye | Geliştirme | Doğrulama | Görülmüş çapraz |
|---|---:|---:|---:|
| Sığ süpürme ve geri alma | 0 | 0 | 1 / −4,19 |
| Seviyeyi aşmadan benzer dönüş | 0 | 0 | 0 |
| Kırılım sonrası dışarıda tutunma | 71 / −2,38 | 58 / +0,08 | 37 / −2,64 |
| Sıradan tepki kontrolü | 17 / −7,93 | 16 / −3,59 | 5 / −1,58 |
| Fibonacci %60–70 | 76 / +1,45 | 63 / −1,40 | 47 / −0,30 |
| Fibonacci %35–45 | 152 / −1,41 | 139 / −1,11 | 98 / −0,64 |

Seviyenin ilk aşımını hedefleyen kural 239 ham süpürme geometrisinden birini kabul etti. Kalan 238'de uç daha önce aşılmıştı veya bir veri boşluğu ilk aşım sırasını gözlenemez kılmıştı. Seviyeyi aşmadan dönüşte 122 ham adayın tamamı aynı nedenle elendi. Fibonacci seviyeleri seans aralığından bağımsız M1 pivotlarından çizildi.

Tamamlanmış bir önceki UTC saatini referans alan ek deney aynı M1 geometrisini korudu. 1.808 saatlik seviye setinde 650 ham süpürme geometrisinin 27'si ilk aşım kuralına uydu. Bu referans değişikliği ilk çalışmanın örneklem sorunundan sonra yapıldı. Aynı tarihleri kullandığı için keşif sayılır. [[13-m1-davranis-ek-protokol|Ek protokol]]

| Tamamlanmış önceki saat | Geliştirme | Doğrulama | Görülmüş çapraz |
|---|---:|---:|---:|
| Sığ süpürme ve geri alma | 11 / +0,03 | 6 / +1,75 | 10 / −2,02 |
| Seviyeyi aşmadan benzer dönüş | 22 / +0,19 | 11 / −3,43 | 15 / −1,51 |
| Kırılım sonrası dışarıda tutunma | 425 / −1,38 | 332 / −1,29 | 267 / −1,18 |
| Sıradan tepki kontrolü | 293 / +0,10 | 264 / −0,86 | 250 / −0,75 |

- **Süpürme.** Doğrulamada 6 gözlemde +1,75 $/ons, gün bazlı %95 aralık [−0,71; +4,45]. Benzer tepkiyle eşleşen çift sayısı 4 / 2 / 4. Doğrulamada iki çiftin farkı ortalama +10,05 $/ons, iki ayrı fark −5,74 ve +25,84. Bu iki gözlem net bir yön göstermiyor. Süpürmenin doğrulama ortalaması 5 dakikada +1,20, 30 dakikada −4,21 $/ons. Aynı küçük örneklemle ufuk seçmek aşırı uyum olur.
- **Kırılımı takip etmek.** En fazla örnek burada. Saatlik doğrulamada 332 gözlem, %39,5 pozitif, ortalama kazanç +4,82 ve kayıp −5,28 $/ons. Net aralık [−2,05; −0,50], spread ve komisyonsuz bid hareketi −0,36 $/ons. Gün toplamı 68 sinyal gününün 26'sında artıda, ortalama −6,31 $/ons. Bir ons başına sinyal sonuçlarının birikimli gün sonu düşüşü 494,16 $. Sinyaller çakışabildiği için bu, hesap düşüşü olarak kullanılamaz.
- **Fibonacci.** Geliştirmede derin bandın belirsizlik aralığı [−1,00; +4,20] ve toplam artının %56'sı en iyi günden geldi. Doğrulamada %39,7 pozitif, ortalama kazanç +4,77 ve kayıp −5,45 $/ons. Net aralık [−3,63; +0,46]. Benzer sığ onaylarla 59 çiftte derin bandın farkı −1,23 $/ons [−4,37; +1,64]. Bid hareketi −0,47 $/ons, 0,65 $ spread varsayımında net −1,55 $/ons. 43 işlemli günün 16'sı artıda, ortalama −2,05 $/ons. Aynı bir ons tanımıyla gün sonu düşüşü 107,87 $. Çizimler yalnız sağdaki iki mum kapanmış M1 pivotlarından üretildi. Bu sonuç seçilen itki ve teyit kuralları için geçerlidir.

## Kaybeden ve kazanan fiyat yolları

Her sinyal kaydında 5/15/30 dakikalık net sonuç, en iyi ve en kötü çıkış fiyatının net değeri, maliyetsiz bid değişimi, hangi net ±1 ATR eşiğinin önce geldiği ve sonradan toparlanma bilgisi var. Aynı mumda sırayı belirleyemediğimizde iki olasılık korunur. ±1 ATR seviyeleri teşhis içindir. Yapısal stop ve lot simülasyonu sonraki aşamadır.

- **Fibonacci doğrulaması.** 38 negatif sonucun 28'inde aleyhte eşik önce geldi. 16 negatif sonuç, yolun bir noktasında net +1 ATR gördü. 4 negatif sonuçta bid yönü doğruydu ve maliyet net işareti çevirdi. Bu sayılar örtüşebilir. 25 pozitif sonucun 12'si önce −1 ATR'ye, sonra +1 ATR'ye gitti. Dar bir stop bazı kazananları da keserdi. Bu gözlem daha geniş stopun, eşit hesap riski altında, daha kârlı olacağını göstermez.
- **Kırılım takibi doğrulaması.** Saatlik 201 negatif sonucun 166'sı önce −1 ATR, 58'i herhangi bir anda +1 ATR gördü. 21 negatif sonuçta bid hareketi pozitifti. 131 pozitif sonucun 54'ü önce −1 ATR, sonra +1 ATR gördü. Çıkış zamanlaması bazı örnekleri açıklıyor. Maliyetsiz ortalamanın da aleyhte oluşu, bu girişte daha geniş stopu genel çözüm olarak desteklemiyor.
- **Aynı kurala ait iki zıt örnek.** 6 Mayıs 07.26 UTC kısa Fibonacci'nin en iyi net çıkışı bile −0,48 $/ons, 15 dakika sonu −4,41. 8 Mayıs 15.53 UTC kısa Fibonacci önce aleyhte gitti, sonra +3,67 $/ons gördü ve −1,48 $/ons bitirdi. Birinde girişten sonraki hareket sürekli yetersizdi. Diğerinde lehte hareket vardı ve sabit çıkış onu yakalayamadı. Bu vakalar mekanizmayı gösterir, kural seçiminde kanıt olarak sayılmaz.

## Kotasyon ve veri denetimi

Önceden belirlenen ilk üç saatlik süpürme ve kontrol çifti gerçek Dukascopy bid/ask tikleriyle yeniden yürütüldü. Girişte spread 0,37–0,93 $/ons. Altı net sonucun işareti aynı kaldı. Bir mumda belirsiz olan eşik sırası tiklerde önce aleyhte olarak çözüldü. Bu altı olay, tüm tarihler için spread dağılımı ya da gerçek emir gerçekleşmesi tahmini vermez. Sinyalden önceki eksik dakikalar ATR/bağlamı sıfırlıyor, sonraki eksik dakikalar ilgili yolu geçersiz kılıyor. İki referansta veri kesme ile 144 sinyal tutarlılığı kontrolü ve üç otomatik test geçti.

M15/H4 yönü yalnız kapanmış mumlardan kayıt edildi. Bu deney FVG, iFVG ve başka göstergeleri filtre olarak kullanmadı. Eşleştirme taraf, saat, oynaklık ve tetik geometrisini benzetir. Seviyelerin geçmiş önemini, piyasa haberlerini ve uygulama gecikmesini doğrudan ölçmez. Aralıklar betimsel ve çoklu kıyaslamaya göre düzeltilmemiştir.

## Karar ve tekrar üretme

Dört giriş–çıkış bileşimi ve FTM hesap geçiş/ihlal simülasyonu için önceden belirlenmiş aşama açılmadı. Bu çalışmada ileri bölüm `[2027-02-01, 2027-04-01)` ve daha önceki Parça ileri bölümü açılmadı. Strateji uygulamaya eklenmedi. Sonraki sınanabilir soru, ilk sığ aşım yerine daha geniş bir **önceden bilinen seviyenin temasları** örnekleminde yönün, temas öncesi fiyat yaklaşımı ve tepkiyle ne ölçüde değiştiği. Temas ve tolerans tanımları ile kontrol eşleşmesi, bir sonraki veri bölümünden önce yazılmalı.

Komutları S2C kökünden, Dukascopy mum önbelleği ile çalıştır.

```powershell
node --test scripts/research/test-m1-behavior.mjs
node scripts/research/run-m1-behavior.mjs
node scripts/research/run-m1-behavior.mjs --hourly
node scripts/research/audit-m1-behavior-ticks.mjs --manifest
& ./scripts/research/fetch-parca-audit-ticks.ps1 -Manifest analysis/research-m1-behavior-tick-manifest.json
node scripts/research/audit-m1-behavior-ticks.mjs
```

İlk kurallar [[13-m1-davranis-protokol|ana protokolde]]. Sinyal yolları `analysis/research-m1-behavior.json` ve `analysis/research-m1-behavior-hourly.json` içinde. Kotasyon farkı, sıra ve kaynak dosyalarının özet değerleri `analysis/research-m1-behavior-ticks.json` içinde.
