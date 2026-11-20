# Seans VWAP'ına doğru geri dönüş protokolü

19 Kasım 2026. Başarısız kırılım raporundan sonra, bu deneyin sonuçları açılmadan önce kaydedildi. Ayrılmış dönem [[donem-kaydi]].

- Hipotez, UTC 07:00'dan itibaren toplanan, Dukascopy hacim ağırlıklı tipik fiyatın ((yüksek + düşük + kapanış)/3) en az 2 ATR dışına çıkan ve 1–1,5 ATR mesafeye geri kapanan fiyatın merkeze doğru ilerlemesidir. Referans, sinyal mumundan önceki kapanışta sabitlenir. Bu hesap Dukascopy akışındaki hacmi kullanır; bütün spot altın piyasasının hacmi mevcut değildir.
- 08:00–16:00 UTC. 07:00'dan itibaren dakika devamlılığı gerekir. Long için mum dibi referansın en az 2 ATR altında, kapanış 1 ila 1,5 ATR altında ve mum pozitif olmalı. Short simetriktir. İki yönde 2 ATR çizgisini aynı mumda gören kurulum atlanır. Geçerli sinyaller arasında yön bağımsız 30 dakika beklenir.
- Stop sinyal mumunun uzak ucundan 0,25 ATR ötede. 1,25 brüt R hedefi. Sinyal anındaki bid geometrisinde hedefe kadar en az 1,25 stop mesafesi olmalı. Gerçek hedef sonraki açılıştan sabit R ile hesaplanır. Giriş fiyatı değiştiğinde hedef VWAP'ın ötesine geçebilir.
- İkinci varyantta, referans VWAP'ın son 15 kapanmış M1'deki mutlak değişimi 0,50 ATR'yi aşmamalı. Ortak S2C meseleleri ve 25 $ planlı risk [[01-fibonacci-protokol]] ile aynı.
