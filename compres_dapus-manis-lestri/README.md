# Dapur Manis Lestari — 15 file inti (siap unggah Devizip, < 20 file)

Situs profil toko kue: HTML + CSS + JavaScript native, tanpa framework.
Data dimuat lewat `fetch()`, jadi jalankan lewat server (Live Server / hosting), bukan buka file langsung.

## File tambahan (opsional, tetap di bawah 20)
15 file inti + `fonts/Bobaland.woff2` + `assets/qris.png` + 2 foto produk = 19 file. Jangan tambah file lain.
- `fonts/Bobaland.woff2` (atau `.ttf`): font isi; sebelum ada otomatis Fredoka/Quicksand.
- `assets/qris.png`: gambar QRIS asli; sebelum ada tampil contoh "BUKAN QRIS ASLI".
- `assets/produk/dessert-table-paket-a.jpg`, `assets/produk/putri-salju-pandan-mede.jpg`: foto produk; sebelum ada tampil emoji.

## Mengubah isi
| Yang diubah | Di mana |
|---|---|
| Warna & font | `css/style.css` (blok TOKENS) |
| Produk & harga | `data/produk.json` |
| WA, jam buka, DP %, pelunasan, rekening, e-wallet, sosmed | `data/bisnis.json` |
| Cabang + koordinat lat/lng | `data/cabang.json` |
| Testimoni / FAQ | `data/testimoni.json` / `data/faq.json` |
| Radius, tarif dasar, tarif per km, zona manual | blok PENGATURAN di `js/checkout.js` |
| Format pesan WhatsApp | `buatPesanPesanan()` di `js/checkout.js` |
| Foto hero | `HERO_FOTO` di `js/pages.js` |
| Alamat halaman | `ROUTES` di `js/core.js` |

PENTING: semua isi folder `data/` adalah contoh; ganti dengan data asli sebelum tayang.
GPS hanya berfungsi di HTTPS atau localhost.
