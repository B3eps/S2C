# Parça · Altın short'un kodla eşleştirilmesi

19 Kasım 2026. Amaç, anlatılan tek altın işlemi ile S2C'nin XAU/USD M1 kuralı arasındaki farkı, yeniden ayar aramadan teşhis etmek. Önceki kurallar ve ileri dönem kilidi korunuyor.

## Dökümde doğrulanabilenler

- **02.02–02.38.** M5 bullish FVG aşağı geçiliyor. Parça devam ve likidite tepkisi belirsiz olduğu için hemen girmediğini, sonra M1'de aşağı itkinin sürmesini izlediğini söylüyor.
- **02.38–03.36.** M1'de yeni bearish FVG oluşuyor. Fiyat geri dönüp bu FVG'ye temas ediyor ve bir mini structure point sonrasında short açılıyor. Hedef aşağıda H1'de görünür ve H4/günlükte de önemli kabul edilen bir likidite seviyesi. Hedefin önündeki M3 FVG potansiyel tepki alanı.
- **04.26–05.23.** Aynı fikir birkaç hesapta uygulanıyor. Bir hesabın giriş fiyatı farklı. Dökümün bu örneğinde düşük lot ve ancak ileride başa başa taşıma düşüncesi var. **06.15** hedef 3.460 $, **07.12** hedefe ulaştığını söylüyor. [Altın işlemi ve hedef](https://www.youtube.com/watch?v=m8GLmRxPlWI&t=122s)
- Diğer videoda 200.000 $ hesapta beş gün ve yedi işlem bildiriliyor. 08.32–08.39 civarında yedi işlemin beş ya da altısının NQ olduğunu söylüyor. Bu kayıt altının tam işlem veya pas listesini vermiyor. [Hesap özeti](https://www.youtube.com/watch?v=Mdxv5SV2qHY&t=108s) · [NQ payı](https://www.youtube.com/watch?v=Mdxv5SV2qHY&t=512s)

## Kodun neyi fazla veya eksik seçebileceği

1. İlk kuralda otomatik M15 yönü kapı. Dökümde günlük yön ve daha büyük seviyedeki koşullu tepki seçimde rol alıyor. H4 yönünü tek başına etiketlemek bu kararı temsil etmiyor. Önceki günlük FVG deneyi bunun sayısallaştırılmış bir yorumu. [[11-parca-kontrol-sonuc]]
2. `m5Confirmed` son 45 dakika içindeki aynı yönlü M5 inversion zamanının M1 FVG oluşumundan geç olmamasına bakıyor. Aradaki düşüşün hangisi olduğu veya Parça'nın hangi seviyeyi izlediği kodda bağlanmıyor. M1 sinyali ise son 2+2 pivotu kullanıyor. Parça'nın MSP dersinde seçilen uç, FVG'yi kuran hareketle ilişkili. Bu nedenle kod, görsel olarak farklı hareketleri aynı başlıkta toplayabilir. [İlk araştırma kuralı](../../scripts/research/parca-m1-rules.mjs) · [MSP dersi](https://www.youtube.com/watch?v=I74zsmAstWQ&t=260s)
3. İlk hedef en yakın açık M15 pivotu, stop son ters M1 pivotu ve bölge sınırına ATR payı. Videoda H1/H4/D1 bağlamı, aradaki M3 engel ve hesap bazında farklı giriş görülüyor. H1 hedefi ve M5 engel ayrı kodlanmış denemelerde tutarlı fayda vermedi. Aynı işlemde bütün kararların doğru eşlendiği henüz görülmedi. [[12-parca-hedef-sira-protokol]]

## Çıkarımın sınırı ve ilk yapılacak doğrulama

Kayıtlı 513 stopun 40'ı sonraki 30 dakikada kendi eski hedefini gördü. 473'ü görmedi. Üç tarih bölümünde bid hareketi tek başına da eksi. Bu bulgu test edilen seçimin genel olarak yalnız stop gevşetmekle düzeleceği görüşünü zayıflatıyor. Altı tik örneğinde stop/hedef sonucu korunurken gerçek çift taraflı kotasyon maliyeti yükseltti. [[10-parca-m1-sonuc]] · [[11-parca-kontrol-sonuc]]

Dökümdeki 3.460 $ hedefi, 201 uygun gündeki Parça araştırmasının kontrol edilen M1 bid aralığı 3.719,655–5.596,805 $ dışında. Yerel 2023–2025 önbelleğinde mum bandı tam 3.460 $'ı içeren günler 22 Nisan ve 1 Eylül 2025. Bunlar fiyat eşleşmesi adaylarıdır. Yuvarlama, farklı broker kotasyonu ve eksik günler tarih teşhisini sınırlar. Video sayfası bu denetimde yüklenmedi. Tarih/saat, grafik sembolü ve kesin fiyat seviyeleri dökümde yok. Tek kazananı geçmişten seçip başarıyı yeniden üretmiş sayma.

Grafik zamanı bulunursa ilk test kâr karşılaştırması yerine olay eşleşmesi. Giriş öncesi yön senaryosu, M5 inversion, M1 FVG, MSP fitili, ilk kotasyon, stop ve H1/M3 hedef yapısında kodun ilk ayrıldığı karar işaretlenir. Kronolojik kabul, pas ve kayıp örnekleriyle aynı etiketler tekrar edilir. Bu aşama usulü ölçer. Net beklenti daha sonra dondurulmuş kurallarla ve ayrı XAU/USD verisiyle sınanır.
