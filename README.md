# S2C

Masaüstü tarayıcı için yerel XAU/USD replay ve sanal prop hesabı simülatörü.

Node.js 22 ve npm ile proje klasöründe `npm ci`, ardından `npm run dev` çalıştırın. Uygulamayı http://localhost:5198 adresinden açın. Hesaplar, emirler ve günlük o tarayıcı ve adrese ait IndexedDB içinde saklanır. Tarayıcı verisini silmeden önce Ayarlar üzerinden yedek alın.

Vite sunucusu Dukascopy bid mumlarını getirir ve diskte önbelleğe alır. Statik dosyalar tek başına mum servisini çalıştırmaz. Tek fiyat serisi, gerçek spread veya kaymayı temsil etmez. Aynı dakika içinde stop ve hedefe dokunulduğunda simülasyon stopa öncelik verir. BEM paketleri sürümlü simülasyon varsayımları içerir. Firmanın duyurduğu bütün haberler, yaptırımlar ve ödeme incelemeleri modellenmez.

Yeni BEM One hesaplarında istenen net ödemenin alt sınırı, 150 USD ile günlük zarar tutarının yarısından büyük olanıdır. Pozitif bakiye tamponu için simülatör 0,01 USD bırakır. One Only ayrıca günlük zarar tutarının yarısını hesapta tutar. Var olan hesaplar oluşturulurken kaydedilen kuralları kullanır.

Tarayıcı testi: Chrome kurulu bir bilgisayarda `npm run test:browser`. Geçici bir profilde sentetik mumlar ve örnek hesaplarla çalışır.

Kontroller: `npm test`, `npm run typecheck`, `npm run build`. Yerel yedekler, veri önbelleği ve kişisel çıktılar Git kapsamı dışındadır.
