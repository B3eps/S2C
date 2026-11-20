# 13 · XAU/USD M1 davranış karşılaştırması

19 Kasım 2026. İlk sonuç okunmadan önce yazıldı. Birincil soru, önceden bilinen aralık ucunu az aşıp geri alan tepkinin, uca çok az değmeden dönen benzer tepkiye göre ek değer üretmesi. Tüm ölçüm ve karar M1. 00:00–06:00 UTC aralığı bir araştırma referansı. 07:00–16:00 UTC sinyal penceresi.

## Adaylar

- **Sweep / yakın dönüş.** İlk tamamlanmış aralık ucunda fitil, ilgili seviyeyi yön işaretine göre −0,25…−0,05 ATR aşmalı veya +0,05…+0,25 ATR içeride kalmalı. Tepki gövdesi yönünde en az 0,20 ATR. Kapanış, ucun 0,10…0,80 ATR içerisine gelmeli. Tetikten önce uç fitille alındıysa sonraki vakalar birincil gruba girmez. Her dal ve taraf için günde en fazla bir örnek. ATR, karar mumundan önceki 20 bitişik M1'in ortalama gerçek aralığı.
- **Dışarıda tutunma.** Aralık ucunun dışına en az 0,10 ATR kapanır. En çok beş sonraki M1'de uçtan 0,15 ATR uzakta veya daha yakında dış tarafta yeniden kapanış. İlk kapanış yönüne devam ölçülür. Aralığın içine 0,25 ATR kapanırsa bekleme biter. Uç başına günde en çok bir.
- **Sıradan tepki.** Fiyat aynı uç yakınında, aralığın içinde kapanır ama güçlü tepki ölçüsünü sağlamaz. Taraf başına günde bir. Fiyat konumu ve açılış saatiyle karşılaştırma yapılır; daha zayıf gövde bilerek eşlenmez.
- **Fibonacci derin/sığ.** Bağımsız hipotez. İki sağ ve iki sol mumla teyit edilen zıt M1 pivotlarının 5–60 dakikalık, en az 4 ATR boyundaki itkisi. Son uç bilindikten sonra 30 M1 içinde ilk %60–70 ya da %35–45 bölge temasında, yönlü gövde en az 0,20 ATR ve sığ sınırın ötesinde kapanış. Derin sınır 0,05 ATR'den fazla aşılırsa o bandın kurulumunu iptal et. Aynı itki tanımı, her bandın kurulumunda en fazla bir sinyal. İki bandın sonucu, itki, zaman ve oynaklık farklarıyla birlikte yorumlanır.

M15 ve H4 yönü ayrı tanı alanlarıdır. En yeni iki dolu kapanmış M15/H4 mumda hem tepe hem dip yönü aynıysa yönlü, diğer durumlarda nötr veya veri eksik. Bu alanlar giriş kapısı değildir.

## Veri ve ölçü

- Geliştirme [2026-01-05, 2026-05-01), doğrulama [2026-05-04, 2026-08-08), görülmüş çapraz [2026-09-07, 2026-11-19), sonuncuda 20–21 Ekim ve 3 Kasım hariç. Tümü geçmişte görülmüş. 00:00–06:00 içinde en az 345 dakika. Girişten sona kadar bitişik olmayan yollar ayrı sayılır.
- Sweep ve yakın dönüş aynı dönem, taraf ve London saati, ±90 dakika içinde UTC açılış saati, fitilin uca mutlak uzaklığı farkı en çok 0,12 ATR, kapanış farkı en çok 0,25 ATR, gövde farkı en çok 0,35 ATR ve oynaklık oranı 0,67–1,50. En yakın eşleşme, sonuçları kullanmadan ve kontrolü tekrar kullanmadan. Sıradan tepki kıyasında gövde eşleyicisi uygulanmaz. Eşleşmeler yoksa karşılaştırma sayısı açık yazılır. Fibonacci kıyasında 5–60 dakikalık itki süresi ve ATR cinsinden genlik yakınlığı aranır. Eşleşmeler gözlemsel ve kısmen bağımlı.
- Sonraki ilk M1 açılışı. Gerçek fiyat yolu için ilk sonraki açılıştan 5, 15 ve 30 dakika sonraki ilk kotasyonla net $/ons. 15 dakika birincil. Aynı 15 dakika içinde net +1 ATR ve −1 ATR eşiklerinin hangisinin önce görüldüğü ayrıca kaydedilir. M1 mumunda ikisi görülürse iki mümkün sıralama. Çıkış eşiği bir teşhis, bir stop/TP kuralı değil. Model spread 0,50 $/ons, stres 0,65 $, eski S2C 0,20 $ karşılaştırma. Taraf başı komisyon %0,005. Model yolunda M1 bid gözlenir, ask sabit spread ile üretilir. Görülmüş verinin kronolojik ilk üç eşleşmesinde gözlenen çift taraflı tik denetimi planlanır. Tik yoksa kapsam eksik olarak kaydedilir.
- Gün bazlı bootstrap. Eşli fark için sweep veya derin Fib gününe göre gruplanır, karşı taraflar başka gün olabilir. Aralıklar betimsel, çoklu karşılaştırma ve günler arası seri bağımlılık için düzeltilmedi. Girişten sonraki en iyi/en kötü kotasyon, hedef benzeri eşiğe aleyhte eşikten önce/sonra ulaşma ve kazanılan gün yoğunlaşması aynı kayıtlarda.

## Sonraki aşamaya geçiş

En az 40 gözlem ve 20 gün hem geliştirme hem doğrulamada. 15 dakikalık net beklentinin gün bloklu %95 alt sınırı iki bölümde sıfır üstünde, stres beklentisi de pozitif. İlgili eşli karşılaştırma varsa doğrulamada en az 20 eşleşme ve ek fark en az 0,15 $/ons, alt sınır sıfır üstünde. Birincil sweep'in karşılaştırması yakın dönüş, Fib derinin karşılaştırması sığ; diğer davranışlar tek başına maliyet sonrası aday olarak değerlendirilir. Kontrol kolu emir adayı değildir. 0,15 $, çalışmadaki iki spread koşulunun farkı. Bunlar keşif aşamasında aday seçmeyi sınırlayan önceden belirlenmiş kapılar.

Kapı geçilirse iki M1 giriş (ilk kotasyon veya üç mum içinde tutunan retest) ve iki çıkış (15 dakika veya önceden bilinen yapısal hedef, en çok 15 dakika), aynı yapısal stop ve S2C risk/marj çerçevesiyle sınanır. En fazla bir aday seçilir. Potansiyel daha önce açılmamış tarih [2027-02-01, 2027-04-01) UTC, ayrı Parça döneminin ardından. Kural seçimi yoksa ileri bölüm açılmaz.
