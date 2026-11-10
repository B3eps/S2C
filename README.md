# S2C

Masaüstü tarayıcı için yerel XAU/USD replay ve sanal prop hesabı simülatörü.

## Windows kurulumu

GitHub Releases bölümünden `S2C-Setup-...-Windows-x64.zip` dosyasını indirin, ZIP'i çıkarın ve içindeki `S2C-Setup-...exe` dosyasını çalıştırın. Kurulum kullanıcı hesabına yapılır; yönetici izni gerekmez. Uygulama masaüstü ve Başlat menüsüne kısayol ekler. Uygulamayı kaldırmak yerel kayıt klasörünü otomatik silmez.

Hesaplar, setuplar, işlemler ve günlük `%APPDATA%\\S2C` altında bu bilgisayarda kalır. Başka tarayıcıdaki kayıtlar otomatik taşınmaz; gerekiyorsa tarayıcı sürümünden Ayarlar → Yedekleme ile dışa aktarın ve masaüstü sürümünde içe aktarın. Günlük/strateji klasörleri Ayarlar'dan ayrılır; yeni setup açılırken eskisi notuyla arşivlenir, istatistikler klasör bazında ayrılır.

İlk çalıştırmada Windows SmartScreen, kod imzası bulunmadığı için tanınmayan yayıncı uyarısı gösterebilir. Yayınlanan SHA256SUMS dosyası kurulum ZIP'inin ve EXE'nin bütünlüğünü kontrol etmek içindir.

## Geliştirici kurulumu

Node.js 22+ ve npm ile proje klasöründe `npm ci`, ardından `npm run dev` çalıştırın. Uygulamayı http://localhost:5198 adresinden açın. `npm run desktop` uygulamayı Electron penceresinde açar. Windows kurulum paketini yerelde üretmek için `npm run dist:win` çalıştırın.

Yeni bir GitHub Release için `v*` biçiminde etiket gönderin. Windows Actions iş akışı testleri çalıştırır; setup EXE'si, EXE'yi içeren ZIP ve SHA256SUMS dosyasıyla release oluşturur.

Vite sunucusu Dukascopy bid mumlarını getirir ve diskte önbelleğe alır. Statik dosyalar tek başına mum servisini çalıştırmaz. Tek fiyat serisi, gerçek spread veya kaymayı temsil etmez. Aynı dakika içinde stop ve hedefe dokunulduğunda simülasyon stopa öncelik verir. BEM paketleri sürümlü simülasyon varsayımları içerir. Firmanın duyurduğu bütün haberler, yaptırımlar ve ödeme incelemeleri modellenmez.

Yeni hesaplarda kurallar oluşturulma anındaki sürüme göre saklanır; eski hesaplar kaynak sayfa değişince geriye dönük değişmez. BEM One'da uygun ödemenin kâr payı, günlük zarar tutarının %50'si veya 150 USD (yüksek olan) eşiğini karşılamalıdır. One Only için asgari ödül 150 USD'dir ve ödeme sonrası günlük zarar tutarının %50'si hesapta kalmalıdır. Uygun ödül eşiği ödeme sağlayıcısı kesintisinden önce hesaplanır; gösterilen sanal ödeme %2 işlem kesintisinden sonradır. One hesabında kayan zarar tabanı üzerinde pozitif bakiye bırakmak için simülatör 0,01 USD tampon kullanır.

Kural kaynakları 10 Kasım 2026'da kontrol edildi: [BEM One şartları](https://bemfunding.com/terms-of-use/bem-one), [BEM One Only şartları](https://bemfunding.com/terms-of-use/bem-one-only), [ödül başvuru aralığı](https://bemfunding.com/faq/rewards-when-and-how-often-can-i-request-my-reward), [ödeme ücreti ve alt sınırı](https://bemfunding.com/en/faq/rewards-are-there-any-fees-or-limits-on-rewards). Firma şartları değişebilir; haber kısıtları, yasaklı stratejiler, risk sınırları ve ödeme inceleme kararları simülatörde bütünüyle uygulanmaz.

Tarayıcı testi: Chrome kurulu bir bilgisayarda `npm run test:browser`. Geçici bir profilde sentetik mumlar ve örnek hesaplarla çalışır.

Kontroller: `npm test`, `npm run typecheck`, `npm run build`. Yerel yedekler, veri önbelleği ve kişisel çıktılar Git kapsamı dışındadır.
