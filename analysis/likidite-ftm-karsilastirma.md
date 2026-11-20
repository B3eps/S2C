# Üç likidite stratejisi: FTM ilk aşama deneyi

Sanal FTM Infinity Plus, 5.000 $, 10 hesap/strateji; her hesap farklı başlangıçta 30 takvim günü. Aynı 10 başlangıç üç grupta kullanıldı. %0,5 risk, 0,20 $ spread, taraf başına %0,005 komisyon. Sinyal mumu kapanışında piyasa emri; kayma modellenmez. Tek pozisyon, aynı mum SL/TP temasında SL öncelikli. İlk aşama geçilince durur. Süresi dolanlar başarısızlık değil, henüz sonuçlanmamış hesaplar.

| Strateji | Hesap | Geçti | İhlal | Açık | İşlem | Kazanan | Net işlem P/L |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 10 | 0 | 0 | 10 | 53 | 16 | $-11.18 |
| 2 | 10 | 0 | 0 | 10 | 4 | 2 | $21.70 |
| 3 | 10 | 0 | 0 | 10 | 15 | 6 | $89.92 |

Her hesap ve işlem için ayrı kayıt defterlerine ve JSONL dosyalarına bakınız. Örneklem küçük; geçen hesap sayısı tek başına strateji üstünlüğünü kanıtlamaz. Bu deneyde kullanılan kurallar S2C uygulamasının 2026-11-13 tarihli FTM modeli; gerçek şirket kuralları güncel olmayabilir.

Sinyaller, her pencerenin öncesindeki 15 takvim günlük 1dk verisiyle ısıtılmış bağımsız motor tarafından hesaplandı; ilk test başlangıcı öncesine ait veriler yalnız bağlam içindir. R eşikleri spread öncesi sinyal fiyatıyla uygulanır; gerçekleşen risk/getiri spread ve komisyon yüzünden farklıdır. Süre sınırı piyasa kapalı zamanına rastlarsa, replay ilk mevcut sonraki mumda durur ve açık pozisyon bu noktada kapatılabilir. Kod modelinin bazı firma şartlarını içermediği program tanımında belirtilmiştir.
