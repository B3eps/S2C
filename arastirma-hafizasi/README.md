# S2C araştırma hafızası

Obsidian başlangıç sayfası [[pano|XAU/USD · İkinci Beyin]]. Göreve başlarken pano ve ilgili kısa not yeterli. Kod ve verilerin mevcut durumunu gerektiğinde doğrula. Eski sonuçlar yeni strateji için yalnız bağlam sağlar.

**Aktif odak:** XAU/USD M1’de fiyat davranışını anlamak ve aynı temel fikre erken bağlanmamak. Parça yorumu ve diğer araştırmalar dizinde. Parça ileri kuralı kilitli, veri açılmadı.

- [[istek-ve-kisitlar]] — kullanıcının amacı ve kararları
- [[bilgi/xauusd-mekanigi]] — spot, vadeli piyasa, spread ve fiyatı değiştirebilen koşullar
- [[bilgi/m1-grafik-okuma]] — fiyat yapısının ve göstergelerin ölçtüğü gözlemler
- [[arastirma-isleyisi]] — hipotez, kontrol ve deney kaydı
- [[guvenilirlik]] — bilinen simülasyon riskleri ve önceki çalışmalar
- [[gpt-62-gorev]] — yeni sohbete verilecek başlangıç görevi
- `deneyler/` — her strateji ve deney için ayrı, kısa raporlar; oluşturulduklarında buraya bağlantı ekle.

Her anlamlı aşamadan sonra yalnızca kararları, veri dönemlerini, komutları, sonuçların yerini ve sıradaki işi güncelle. Ham işlem kayıtlarını özet notlara kopyalama. Bu hafıza okunan bağlamı azaltabilir, fakat token tasarrufu garanti etmez.

- [[deneyler/00-simulasyon-denetimi]] — düzeltilen hesap olay sırası, veri kapsamı ve doğrulama.
- [[deneyler/donem-kaydi]] — ayrılmış dönemler ve önbellek çakışmaları.
- [[deneyler/01-fibonacci]] — ayrılmış testte 37 işlem, %21,6 kazanma, −12,05 $/işlem. Uygulama adayı değil.
- [[deneyler/02-acilis-araligi]] — kırılım testi 11 işlem, −6,71 $/işlem. Retest yalnızca 2 işlem.
- [[deneyler/03-basarisiz-kirilim]] — birincil test negatif. Teyitli varyant dört günde pozitif, eski iki dönemde negatif.
- [[deneyler/04-vwap-donusu]] — iki varyant aynı 10 test işlemi; +3,02 $/işlem ve eski iki dönemde negatif.

Dört deney tamamlandı. Uygulamaya alınabilecek bir strateji doğrulanmadı. Yeni bir ileri test istenirse teyitli başarısız kırılım ve VWAP adaylarında kurallar kilitli kalmalı ve yeni tarih aralığı önce ayrılmalı.

- [[deneyler/05-vwap-duyarlilik]] — 21 ayar, 201 uygun gün. Baz −5,48 $/işlem. Eski sekiz günlük artı tek güne duyarlı. Yeni ileri dönem açılmadı.
- [[deneyler/06-islem-kayip-denetimi]] — 17.581 kayıt mum bazında doğrulandı. Geniş stop VWAP zararını azalttı, sabit gecikme kötüleştirdi. Kayıp ayrıntıları CSV’de.
- [[deneyler/07-arastirma-yol-haritasi]] — önce tik maliyet denetimi, sonra tamamlanmış M15 aralığında M1 geri dönüş hipotezi, ardından kilitli ileri test.
- [[deneyler/08-aday-kayip-teshisi]] — yeni sıra mevcut adayı işlem bazında teşhis etmek. Teyitli kırılımda geniş stop ve erken kapanış değişiklikleri net avantaj vermedi. 37 Fibonacci çizimi yeniden hesaplandı.

M15 ve M1 yön uyumu gerekli, H4 öncelikle bağlam. İlk kod yorumu kapanmış 2+2 swing, yapısal stop ve açık M15 pivot hedefi kullandı. Benzer eski kod `src/lib/liquidityStrategies.ts` (H1/M15, M15 sweep, M1 yapı kırılımı) ve `src/lib/parcaSetup.ts`.
- [[deneyler/09-parca-video-kural-okumasi]] — iki dökümden olay sırası ve S2C farkları çıkarıldı. Açık nokta M15/M1 yön ve swing seçimi.
- [[deneyler/10-parca-m1-sonuc]] — birincil FVG 938 işlem, 513 stop. Sonraki 30 dakikada 40 hedef teması. M15 bölge keşfi doğrulamada negatif.
- [[deneyler/11-parca-kontrol-sonuc]] — FVG/iFVG benzer tetiksiz M1 kontrollerinden −1,75/−1,56 $ geride. H1 hedefi, ICT sırası ve koşullu günlük FVG yönü sınandı, tutarlılık yok. Altı tikte kapanış türleri aynı, 0,20 $ spread iyimser.
- [[deneyler/13-m1-davranis-sonuc]] — 201 uygun gün ve iki seviye referansı. İlk sığ süpürme örneklemi yetersiz, saatlik devam ve derin Fib doğrulamada negatif. Altı kotasyon denetimi ve sinyal bazlı kayıp yolları. İleri dönem açılmadı.
