# QR Garson Çağırma Sistemi

Bu proje, restoranlar için QR kod tabanlı garson çağırma sistemi sağlar. Müşteriler masalarındaki QR kodu tarayarak garsonu çağırabilirler.

## Özellikler

- QR kod tarama ile garson çağırma
- Gerçek zamanlı bildirimler
- Responsive tasarım
- Modern ve kullanıcı dostu arayüz
- Supabase veritabanı entegrasyonu

## Kullanım

1. Masadaki QR kodu tarayın
2. "Garsonu Çağır" butonuna tıklayın
3. Garson çağrınız alındığında bildirim alacaksınız

## Teknik Detaylar

- HTML5, CSS3, JavaScript
- Supabase gerçek zamanlı veritabanı
- TailwindCSS

## Kurulum

```bash
git clone https://github.com/1sthillman/quar.git
cd quar
```

## Supabase Kurulumu

1. [Supabase](https://supabase.com/) hesabı oluşturun
2. Yeni bir proje oluşturun
3. SQL Editor'e gidin ve `rls_setup.sql` dosyasındaki komutları çalıştırın
4. Projenizin URL ve API anahtarını alın
5. `js/waiter-call-client.js` dosyasında Supabase URL ve API anahtarını güncelleyin:

```javascript
const SUPABASE_URL = 'https://your-project-url.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

## QR Kod Oluşturma

QR kodları aşağıdaki formatta bir URL'ye yönlendirmelidir:

```
https://1sthillman.github.io/quar/?restaurant_id=RESTAURANT_ID&table_id=TABLE_NUMBER
```

Örnek:
```
https://1sthillman.github.io/quar/?restaurant_id=DEMO&table_id=1
```

## Sorun Giderme

### CORS Hataları

Eğer CORS hataları alıyorsanız, Supabase projenizde API ayarlarından CORS yapılandırmasını güncelleyin:

1. Supabase Dashboard'a gidin
2. API Ayarları > CORS
3. "Additional Allowed Origins" bölümüne `https://1sthillman.github.io` ekleyin

### 406 ve 400 Hataları

Bu hatalar genellikle Supabase API isteklerinin yanlış formatlanmasından kaynaklanır. Aşağıdaki çözümleri deneyin:

1. RLS (Row Level Security) politikalarının doğru yapılandırıldığından emin olun
2. API isteklerinde doğru başlıkların gönderildiğinden emin olun
3. Supabase projenizin URL ve API anahtarını kontrol edin

## Lisans

MIT 