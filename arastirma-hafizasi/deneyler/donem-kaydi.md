# Araştırma dönemleri ve seçim disiplini

UTC, sol uç dahil ve sağ uç hariç. 19 Kasım 2026 tarihinde, yeni dönemlerin OHLC içeriği ve sonuçları açılmadan ayrıldı. Mevcut kayıtlar Ağustos 2026 sonuna kadar araştırma yapıldığını gösteriyor. Eylül başı ve sonraki birkaç tarihte önbellek dosyası da var. Bu nedenle önbellekte görülen günlerin hiçbirini yeni test örneğine katma. Proje dışı inceleme geçmişi bilinmiyor.

| Deney | Geliştirme | Doğrulama | Ayrılmış test |
|---|---|---|---|
| Fibonacci | [2026-01-05, 2026-05-01) | [2026-05-04, 2026-08-08) | [2026-09-07, 2026-10-19) |
| Açılış aralığı kırılımı | Aynı | Aynı | [2026-10-19, 2026-11-02) |
| Başarısız kırılım ve geri dönüş | Aynı | Aynı | [2026-11-02, 2026-11-09) |
| UTC seans içi VWAP'a dönüş | Aynı | Aynı | [2026-11-09, 2026-11-19) |

Test öncesi tarihlerin yerel dosya adlarıyla kör çakışma kontrolü yapılır. Önbellekte olan tarihler içerik okunmadan test örneğinden çıkarılır, günler önceden kayıt altına alınır. Tarih ve veri erişimi elverirse bu dönemler tarihsel proje dışı test olarak değerlendirilir. Geliştirme ve doğrulama geçmiş çalışmalarda incelenmiş olabilir. Test bölümlerinde ön ısınma için başka bölümden fiyat okunmaz. Uzun pencere erişilemezse test beklemede kalır. Test sonuçlarıyla seçim, eşik ayarı veya yeni filtre yapılmaz.

Kör dosya adı kontrolünde 20–21 Ekim ve 3 Kasım görüldü. Bunlar ilgili testlerden çıkarıldı. Fibonacci testinde yerel dosya çakışması yoktu.
