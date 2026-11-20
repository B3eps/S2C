# Hesap simülasyonu: gerçek uygulama, temiz profil

Üretildi: 2026-11-13T10:09 UTC

**Nasıl yapıldı.** Uygulamanın kendi kodu (hesap kuralları, programlar, günlük/toplam zarar, ödeme şartları, spread, komisyon) temiz bir tarayıcı profilinde çalıştırıldı: her koşunun başında hesap/işlem/günlük 0'dı, her hesaptan sonra uygulama sıfırlandı. Senin gerçek verine dokunulmadı. Bir bot, Parça sinyallerinde kuralına göre piyasa emriyle girdi (sinyalin stopu ve hedefi, bakiyenin sabit yüzdesi risk). Mumlar Dukascopy XAU/USD, başlangıç anları 2024-2026 arası gerçek dönemlerden rastgele. Replay'de geleceğe bakmak yok.

## 1. Özet (koşu başına)

Koşu adı: `<sinyal ayarı>-r<işlem başına risk %>`. "Geçti" = değerlendirmeyi bitirip fonlu hesaba ulaştı. "Ödeme" = en az bir ödeme alındı. Net = alınan ödeme − hesap ücreti.

| Koşu | Hesap | Geçti | İhlal (patladı) | Ödeme alan | Toplam ücret | Toplam ödeme | Net |
|---|---|---|---|---|---|---|---|
| aplus-r1 | 42 | 0 | 4 | 0 | $2.855 | $0 | $-2.855 |
| gold-r0.5 | 52 | 1 | 4 | 0 | $3.522 | $0 | $-3.522 |
| gold-r1 | 73 | 9 | 36 | 0 | $4.953 | $0 | $-4.953 |

## 2. aplus-r1: program program

| Program | Hesap | Geçti | Patladı | Süre doldu/bitmedi | Ödeme alan | Toplam ödeme | Ücret | Net | Ort. işlem | İşlem kazanma | Ort. R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BEM Classic Normal | 7 | 0 | 1 | 6 | 0 | $0 | $416 | $-416 | 15 | 54% | 0,05 |
| BEM Classic Swing | 7 | 0 | 0 | 7 | 0 | $0 | $651 | $-651 | 22 | 48% | -0,05 |
| BEM One | 7 | 0 | 0 | 7 | 0 | $0 | $374 | $-374 | 17 | 42% | -0,17 |
| BEM One Only | 7 | 0 | 0 | 7 | 0 | $0 | $378 | $-378 | 19 | 46% | -0,10 |
| FTM Infinity | 7 | 0 | 3 | 4 | 0 | $0 | $483 | $-483 | 15 | 50% | -0,02 |
| FTM Infinity Plus | 7 | 0 | 0 | 7 | 0 | $0 | $553 | $-553 | 20 | 59% | 0,11 |

**Hesaplar neden patladı:** 3× Toplam zarar limiti # aşıldı (%#)# · 1× Günlük zarar limiti # aşıldı (%#)#

## 2. gold-r0.5: program program

| Program | Hesap | Geçti | Patladı | Süre doldu/bitmedi | Ödeme alan | Toplam ödeme | Ücret | Net | Ort. işlem | İşlem kazanma | Ort. R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BEM Classic Normal | 9 | 0 | 0 | 9 | 0 | $0 | $535 | $-535 | 37 | 56% | 0,09 |
| BEM Classic Swing | 9 | 0 | 0 | 9 | 0 | $0 | $837 | $-837 | 39 | 50% | -0,02 |
| BEM One | 9 | 0 | 0 | 9 | 0 | $0 | $481 | $-481 | 38 | 53% | 0,03 |
| BEM One Only | 9 | 1 | 2 | 7 | 0 | $0 | $486 | $-486 | 35 | 51% | -0,01 |
| FTM Infinity | 8 | 0 | 2 | 6 | 0 | $0 | $552 | $-552 | 38 | 54% | 0,02 |
| FTM Infinity Plus | 8 | 0 | 0 | 8 | 0 | $0 | $632 | $-632 | 39 | 61% | 0,15 |

**Hesaplar neden patladı:** 3× Toplam zarar limiti # aşıldı (%#)# · 1× Günlük zarar limiti # aşıldı (%#)#

## 2. gold-r1: program program

| Program | Hesap | Geçti | Patladı | Süre doldu/bitmedi | Ödeme alan | Toplam ödeme | Ücret | Net | Ort. işlem | İşlem kazanma | Ort. R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BEM Classic Normal | 13 | 0 | 3 | 10 | 0 | $0 | $772 | $-772 | 34 | 54% | 0,05 |
| BEM Classic Swing | 12 | 0 | 1 | 11 | 0 | $0 | $1.116 | $-1.116 | 37 | 51% | -0,01 |
| BEM One | 12 | 2 | 7 | 5 | 0 | $0 | $641 | $-641 | 25 | 52% | 0,03 |
| BEM One Only | 12 | 3 | 9 | 3 | 0 | $0 | $648 | $-648 | 25 | 53% | 0,03 |
| FTM Infinity | 12 | 1 | 11 | 1 | 0 | $0 | $828 | $-828 | 16 | 46% | -0,10 |
| FTM Infinity Plus | 12 | 3 | 5 | 7 | 0 | $0 | $948 | $-948 | 33 | 60% | 0,13 |

**Hesaplar neden patladı:** 22× Toplam zarar limiti # aşıldı (%#)# · 14× Günlük zarar limiti # aşıldı (%#)#

## 3. Kayıplar nerede toplandı?

Toplam 4786 işlem (bağlamı kayıtlı), kazanma 53%, ort. R 0,03.

| Boyut | Grup | İşlem | Kazanma | Ort. R | Toplam P/L |
|---|---|---|---|---|---|
| Giriş seviyede mi | seviyede | 1833 | 55% | 0,08 | $9.844 |
| Giriş seviyede mi | seviyede değil | 2953 | 51% | -0,01 | $715 |
| Seviye türü | 100'lük | 180 | 61% | 0,21 | $2.602 |
| Seviye türü | 4sa dip | 222 | 45% | -0,12 | $-2.538 |
| Seviye türü | 4sa tepe | 179 | 61% | 0,15 | $1.798 |
| Seviye türü | Asya | 254 | 60% | 0,18 | $2.817 |
| Seviye türü | Londra | 790 | 56% | 0,09 | $5.550 |
| Seviye türü | önceki gün | 208 | 49% | -0,04 | $-387 |
| Önündeki seviye | <1R | 3236 | 50% | -0,03 | $-5.892 |
| Önündeki seviye | 1–2R | 525 | 50% | -0,06 | $-2.489 |
| Önündeki seviye | 2–4R | 249 | 57% | 0,07 | $1.370 |
| Önündeki seviye | 4R+/yok | 776 | 67% | 0,30 | $17.569 |
| Önündeki seviye türü | 4sa dip | 511 | 33% | -0,34 | $-12.909 |
| Önündeki seviye türü | 4sa tepe | 512 | 57% | 0,11 | $3.107 |
| Önündeki seviye türü | Asya | 971 | 44% | -0,14 | $-9.628 |
| Önündeki seviye türü | Londra | 1248 | 53% | 0,04 | $4.713 |
| Önündeki seviye türü | önceki gün | 519 | 60% | 0,16 | $6.336 |
| Olasılık | <%40 | 885 | 55% | 0,06 | $3.892 |
| Olasılık | %40–55 | 1772 | 51% | -0,02 | $-2.508 |
| Olasılık | %55–70 | 1523 | 51% | 0,01 | $1.289 |
| Olasılık | %70+ | 606 | 61% | 0,16 | $7.886 |
| Bölge | 15dk OB | 512 | 52% | 0,04 | $298 |
| Bölge | 15dk iFVG | 658 | 55% | 0,10 | $5.001 |
| Bölge | 1sa OB | 279 | 47% | -0,14 | $-3.126 |
| Bölge | 1sa iFVG | 349 | 60% | 0,18 | $5.397 |
| Bölge | 4sa OB | 252 | 46% | -0,10 | $-2.664 |
| Bölge | 4sa iFVG | 326 | 41% | -0,19 | $-4.143 |
| Bölge | OB | 872 | 47% | -0,09 | $-5.062 |
| Bölge | iFVG | 1538 | 59% | 0,12 | $14.858 |
| Yön | long | 2689 | 56% | 0,07 | $14.530 |
| Yön | short | 2097 | 49% | -0,03 | $-3.971 |
| Yıldız (★) | var | 4476 | 52% | 0,01 | $2.992 |
| Yıldız (★) | yok | 310 | 69% | 0,32 | $7.567 |
| Haber ±60 dk | haber dışı | 4666 | 53% | 0,02 | $7.395 |
| Haber ±60 dk | haberde | 120 | 69% | 0,36 | $3.164 |
| New York saati | 00–03 | 364 | 74% | 0,45 | $11.952 |
| New York saati | 03–06 | 1008 | 53% | 0,02 | $1.376 |
| New York saati | 06–09 | 1201 | 49% | -0,05 | $-4.017 |
| New York saati | 09–12 | 1237 | 46% | -0,10 | $-9.417 |
| New York saati | 12–16 | 933 | 61% | 0,16 | $12.017 |
| New York saati | 16–24 | 43 | 28% | -0,45 | $-1.351 |
| Haftanın günü (UTC) | Pzt | 707 | 55% | 0,06 | $4.020 |
| Haftanın günü (UTC) | Sal | 969 | 49% | -0,05 | $-2.998 |
| Haftanın günü (UTC) | Çar | 1253 | 47% | -0,08 | $-7.585 |
| Haftanın günü (UTC) | Per | 925 | 58% | 0,12 | $7.557 |
| Haftanın günü (UTC) | Cum | 932 | 58% | 0,14 | $9.565 |

**Üst üste kayıp:** patlayan hesaplarda ortalama en uzun seri 3,84, patlamayanlarda 3,56. En uzun seri 9.

Patlamadan önceki son 4 işlem (175 işlem): kazanma 36%; seviyede olanlar 37%; önünde 2R'den yakın seviye olanlar 89%.

## 4. "Bu kural olsaydı para yanmazdı" testi

Her kural, tüm hesapların **ilk değerlendirme aşaması** işlem listesinden uygun olmayan işlemleri çıkarıp hesabı yeniden yürütür (gerçekleşen kâr/zarar, hesabın kendi günlük ve toplam zarar sınırı). Yaklaşık bir hesaptır: lotlar ve bileşik etki yeniden hesaplanmaz. Hesaplar ikiye bölündü (çift/tek sıra): bir kuralın iki yarıda da aynı yönde iyileştirmesi gerekir; yalnız birinde işe yarayan şans olabilir.

| Kural | geçti / patladı / sürüyor | Toplam net P/L | Yarı 1 (çift) fark | Yarı 2 (tek) fark |
|---|---|---|---|---|
| hiçbiri (olduğu gibi) | 17 / 25 / 125 | $11.016 |  |  |
| önünde 1R içinde seviye varsa girme | 1 / 1 / 165 | $16.451 | patlama -18, geçiş -7 | patlama -6, geçiş -9 |
| önünde 2R içinde seviye varsa girme | 0 / 0 / 167 | $18.939 | patlama -18, geçiş -7 | patlama -7, geçiş -10 |
| seviyede değilse girme | 0 / 4 / 163 | $9.759 | patlama -15, geçiş -7 | patlama -6, geçiş -10 |
| olasılık < %60 ise girme | 0 / 2 / 165 | $2.428 | patlama -16, geçiş -7 | patlama -7, geçiş -10 |
| yıldızsızsa girme | 4 / 22 / 141 | $3.986 | patlama -1, geçiş -7 | patlama -2, geçiş -6 |
| haber ±60 dk içinde girme | 13 / 25 / 129 | $7.863 | patlama +0, geçiş -1 | patlama +0, geçiş -3 |

## 5. Dürüst uyarılar

- Bu bir geçmiş testi; bot kuralı mekanik uyguluyor, insan değil. Gerçekte duygular ve gecikme eklenir.
- Spread sabit, kayma yok, haber anında gerçek spread çok açılır; sonuçlar gerçekte daha kötü olur.
- Hesap sayısı arttıkça sonuç güvenilir olur; <30 hesaplı satırlardaki yüzdelere güvenme.
- Programların kuralları uygulamadaki gibi (firmanın gerçek şartlarını birebir yansıtmayabilir).
- Kural testi (bölüm 4) yaklaşık hesap; bir kural önerisini uygulamaya almadan önce yine uygulamada denenmeli.
