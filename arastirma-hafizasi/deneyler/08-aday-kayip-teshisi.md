# 08 · Önce adayın kaybını teşhis et

İlk inceleme adayı teyitli başarısız kırılım. Ayrılmış eski bölümde 14 işlemde +2,34 $/işlem verdi, geliştirme ve doğrulamada kaybetti. Üç dönemin toplam net sonucu 443 işlemde yaklaşık −1.300 $. VWAP'ın daha geniş geçmişindeki kaybı işlem başına daha yüksek ve çoklu ayar çalışmasında pozitif bir varyant çıkmadı. Buradaki seçim inceleme sırasıdır.

## Stop mu, giriş mi, fikir mi?

Sabit strateji, gerçekleşen giriş ve orijinal hedef. Ana senaryoda stop, alternatifte yalnızca hedef veya girişten 120 dakika sonraki çıkış. Stop olmadan PnL, teşhis için orijinal lotla hesaplandı. 443 arşiv işleminin 275'i zarar. Aşağıdaki sabit ufuklar, zarar yazan işlemlerin tamamı için gözlenebildi. Yön sütunu, ufkun sonunda bid fiyatının giriş bid'inden istenen yönde olmasını sayar. Hedef sütunu, hedefin uygun bid/ask tarafında o süre içinde görülmesini sayar.

| Girişten sonra | İstenen yönde kapanış | Eski hedefe temas | İlk taranan ucun aşılması |
|---|---:|---:|---:|
| 5 dk | 84/275 | 1/275 | 119/275 |
| 15 dk | 80/275 | 11/275 | 210/275 |
| 30 dk | 95/275 | 47/275 | 243/275 |
| 60 dk | 101/275 | 85/275 | 263/275 |
| 120 dk | 107/275 | 116/275 | 272/275 |

Stop kaldırılınca 116 eski kayıp hedefe ulaştı, 159'u ulaşmadı. 102 işlemde sonuç orijinal stoplu kayıptan daha kötüydü. Zarar vakalarının sabit kohort toplamı stoplu −5.909,85 $, stopsuz −6.760,86 $. Kayıpların çoğu 30 dakikada hedefi görmedi ve 243'ünde başarısız kırılımın ilk uç fiyatı yeniden aşıldı. Aynı giriş ve hedefte stop mesafesini %50 artırıp lotu düşürmek 47 eski kaybı kazanca çevirdi. Minimum lotu karşılayan aynı 395 işlemde toplam −1.301,01 $'dan −540,30 $'a geldi. %25 artış −684,95 $ verdi. Genişletilmiş işlemler zaman bakımından çakışabilir. Bu tablo işlem teşhisidir.

Teyit beklemek ortalama 2,40 $/ons daha kötü giriş fiyatı yarattı. Erken giriş yalnız sonunda teyit alan sinyallerde sınandığında, kendi 1,5 R hedefiyle eşleşen 440 kayıt +2.753,25 $ verdi. Bu eşleşme sonradan teyit alacağını bildiği için seçilim içerir. Tüm ilk geri kapanışları kullanan arşivli kural, üç dönemde de net eksideydi.

## Giriş varsayımını uygulanabilir koşulla sınama

Tek değişiklik denendi. İlk M1 geri kapanışı kanalın en az **0,50 ATR içine** girmeliydi. Temel kuralın alt sınırı 0,10 ATR. Mantık, sonraki üç mumu beklerken ödenen fiyatı azaltıp ilk mumun yeterli dönüş göstermesini istemekti. Dinamik kanal, stop ve hedef, pozisyon boyutlandırması ve temel sinyalin bekleme kuralları sabit tutuldu. Eşiği geçemeyen ilk sinyal temel kuraldaki bekleme süresini tüketir.

| Eski bölüm | Temel ilk geri kapanış | Güçlü ilk geri kapanış |
|---|---:|---:|
| Geliştirme | 533 işlem, −4,37 $/işlem | 261 işlem, −4,39 $/işlem |
| Doğrulama | 447 işlem, −3,73 $/işlem | 188 işlem, −3,59 $/işlem |

Güçlü kapanış tek başına teyit için işe yarar bir vekil olamadı. Yeni kural eski test bölümüne veya ileri veriye taşınmadı. Şu anki bulgu, stop mesafesinin bir etkisi olduğu ve beklemenin giriş maliyeti getirdiği. Bunların ölçülen değişiklikleri, adayın çalışma mantığını kârlı bir kurala çevirmedi.

### Eski ayrılmış örnekte yedi zarar

| Giriş UTC | Yön | Net | Stopsuz, aynı hedef ve 120 dk sınırı | 30 dk bid yönü |
|---|---|---:|---|---|
| 2 Kasım 08:14 | Long | −24,37 $ | Hedef +26,81 $ | Lehine |
| 2 Kasım 10:15 | Long | −22,63 $ | Hedef +26,15 $ | Aleyhine |
| 2 Kasım 11:05 | Short | −23,06 $ | Süre −25,10 $ | Aleyhine |
| 4 Kasım 09:14 | Short | −21,97 $ | Süre +10,42 $ | Lehine |
| 5 Kasım 08:11 | Short | −20,07 $ | Süre +1,34 $ | Lehine |
| 5 Kasım 10:46 | Short | −24,61 $ | Hedef +26,59 $ | Aleyhine |
| 6 Kasım 09:06 | Short | −23,54 $ | Hedef +28,18 $ | Lehine |

## Fibonacci’de çizim ve stop ayrımı

%60–70 varyantının eski testindeki 37 işlemin her birinde iki pivotun gerçek M1 uç fiyatından bölgeyi yeniden hesapladım ve pivot teyidinin sinyalden önce erişilebilir olduğunu denetledim. 37/37 uydu. Bu, çizimin tanımlanan kurala uygun olduğunu doğrular. Başka bir salınım uzunluğunun üstünlüğü ayrı hipotezdir.

29 kaybın hiçbirinde salınımın başlangıç ucu stop mumuna kadar kırılmadı. Orijinal stop, salınımın tamamından çok geri çekilme tepkisini koruyordu. Aynı giriş ve hedefi koruyup stopu başlangıç pivotunun 0,20 ATR ötesine koyduğumda, riske göre lotu uyan 36 işlem toplam −425,93 $ yerine −415,24 $ verdi. İki eski zarar kazanca döndü. Bu karşılaştırmada stopun yapısal uca taşınması kayıp tablosunu büyük ölçüde değiştirmedi.

## Tekrar üretim

```powershell
node scripts/research/vwap-sensitivity.mjs --audit-ledger
node scripts/research/audit-losses.mjs
node scripts/research/test-reentry-close.mjs
```

[443 işlem, alternatifler ve Fibonacci pivot denetimi](../../analysis/research-best-candidate-diagnosis.json) · [Güçlü ilk kapanış karşılaştırması](../../analysis/research-reentry-stronger-close.json)
