# Yandex → cPanel E-posta Taşıma

Yandex Mail hesaplarındaki e-postaları cPanel'de oluşturulmuş hesaplara **kopyalayan** web arayüzlü araç. Kaynak hesaptaki mailler silinmez.

## Özellikler

- Toplu CSV ile hesap/şifre girişi
- Yandex IMAP → cPanel IMAP kopyalama (imapsync)
- İş kuyruğu ve paralel taşıma
- Canlı durum ve log takibi
- Şifreler veritabanında şifreli saklanır

## Sunucu Ayarları

### Yandex (Kaynak)

| Ayar | Değer |
|------|-------|
| IMAP sunucu (Türkiye) | `imap.yandex.com.tr` |
| IMAP sunucu (Rusya dışı) | `imap.ya.ru` |
| Port | `993` |
| Güvenlik | SSL |

Yandex'te IMAP etkin olmalı ve **uygulama şifresi** kullanılmalıdır.

### cPanel (Hedef)

| Ayar | Değer |
|------|-------|
| IMAP sunucu | `mail.DOMAIN.com` (her domain için farklı) |
| Port | `993` |
| Güvenlik | SSL/TLS |
| Kullanıcı adı | Tam e-posta adresi (ör. `user@example.com`) |

Örnek example.com için: `mail.example.com`, port 993, SSL açık.

## Kurulum

```bash
cp .env.example .env
```

`.env` dosyasında şifreleme anahtarı oluşturun:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Çıktıyı `ENCRYPTION_KEY=` satırına yapıştırın.

```bash
docker compose up --build -d
```

Tarayıcı: **http://localhost:3000**

## Ana Mantık

Her domain için Yandex'teki bir hesaptan cPanel'deki karşılığına **tüm e-postalar ve klasörler** kopyalanır. Kaynak hesap silinmez.

**Örnek (example.com):**

| | Adres |
|---|-------|
| Yandex (kaynak) | `example@example.com` |
| cPanel (hedef) | `example@example.com` |
| IMAP host | `mail.example.com` |

Kopyalanan klasörler: Gelen Kutusu (INBOX), Giden, Taslaklar, Spam, Çöp ve tüm özel klasörler. Okundu/okunmadı bayrakları da aktarılır.

## CSV Formatı

```csv
yandex_email,yandex_password,cpanel_email,cpanel_password,cpanel_imap_host
example@example.com,yandex_sifre,example@example.com,cpanel_sifre,mail.example.com
```

`cpanel_imap_host` boş bırakılırsa otomatik `mail.{domain}` kullanılır:

```csv
example@example.com,yandex_sifre,example@example.com,cpanel_sifre,
```

Arayüzde **Örnek CSV İndir** butonuyla şablon dosyasını indirebilirsiniz.

## Kullanım

1. **Ayarlar** — Yandex IMAP bilgilerini doğrulayın (`imap.yandex.com.tr`, 993, SSL)
2. **Hesaplar** — Elle tek tek ekleyin veya CSV ile toplu içe aktarın
3. **Bağlantıyı Test Et** — kaydetmeden önce Yandex ve cPanel IMAP bağlantısını kontrol edin
4. **Tümünü Taşı** veya seçili hesapları taşıyın
5. **İşler** — ilerlemeyi ve logları izleyin; hatalı işleri yeniden deneyin

## Ön Koşullar

- cPanel'de hedef e-posta hesapları **önceden oluşturulmuş** olmalı
- Yandex'te IMAP açık ve uygulama şifresi hazır olmalı
- Her domain için doğru `mail.domain.com` IMAP host bilgisi
- 50+ hesap için yeterli disk ve bant genişliği (işler uzun sürebilir)

## Servisler

| Servis | Port | Açıklama |
|--------|------|----------|
| web | 3000 | React arayüz |
| api | 8000 | FastAPI REST API |
| worker | — | imapsync iş kuyruğu consumer |
| redis | — | İş kuyruğu |

## Güvenlik Notları

- `.env` dosyasını paylaşmayın
- Üretimde reverse proxy + kimlik doğrulama kullanın
- Uygulama yalnızca güvenilir ağda çalıştırılmalıdır

## Durdurma

```bash
docker compose down
```

Veriler `app_data` ve `app_logs` volume'larında kalır.
