# Qurban

Aplikasi iuran qurban berbasis Next.js App Router, PostgreSQL, Drizzle, dan Better Auth. Halaman operasional sudah tersambung ke database dengan akses khusus panitia, transaksi tunai atomik, audit, kuitansi, laporan, dan agregat publik per periode.

## Frontend yang tersedia

Tampilan ponsel di bawah 768 px mengikuti [rancangan mobile](prototype.md): beranda dengan ringkasan iuran, navigasi bawah, menu penuh layar, filter berbentuk sheet, formulir mobile, serta langkah pemeriksaan dan hasil pencatatan setoran/pengembalian. Detail kelompok memiliki tab ringkasan, anggota, dan pelaksanaan. Gunakan `/preview/dashboard` pada ukuran ponsel untuk mencoba alurnya dengan data contoh. Tampilan tablet dan desktop tetap memakai tata letak yang sudah tersedia.

Buka [halaman publik](http://localhost:3000), lalu [login panitia](http://localhost:3000/login) untuk pengelolaan nyata. Database baru menampilkan panduan membuat periode pertama. Semua perubahan operasional disimpan ke PostgreSQL dan tetap tersedia setelah reload. Informasi publik memakai data agregat terbaru tanpa nama, kontak peserta, cicilan, maupun kuitansi.

Penambahan anggota kelompok memakai multi-select dengan pencarian nama/nomor, checkbox, dan tag peserta terpilih. Desktop menggunakan dropdown, sedangkan ponsel memakai panel bawah. Daftar tetap terbuka saat memilih beberapa peserta dan membatasi pilihan sesuai kapasitas; tombol **Selesai** kembali ke form sebelum perubahan disimpan.

Palet antarmuka mengikuti referensi pengguna: teal `#287A74`, sea green `#55A9A0`, mint `#AEEED3`, dan lemon `#FFF8B0`. Token warna dipusatkan di `src/app/qurban.css`. Aplikasi selalu memakai tema terang: latar putih/mint lembut, termasuk sidebar dan kepala beranda, dengan teal untuk tombol dan aksen.

[Pratinjau dashboard](http://localhost:3000/preview/dashboard) tetap tersedia tanpa login dengan fixture sintetis. Perubahan di `/preview` direset saat reload dan tidak pernah ditulis ke database.

| Halaman           | Alamat pratinjau            | Interaksi                                                                                       |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| Dashboard         | `/preview/dashboard`        | Ringkasan, grafik iuran, agenda, transaksi dan kelompok terbaru                                 |
| Periode           | `/preview/periode`          | Jadwal, status dengan alasan, sorotan publik, arsip dan pembukaan kembali                       |
| Peserta           | `/preview/peserta`          | Cari/filter, pagination, tambah, penempatan, pembatalan/pengaktifan kembali, detail dan riwayat |
| Kelompok Sapi     | `/preview/kelompok`         | Estimasi, anggota, harga final, pembukaan kembali, pembelian dan pelaksanaan                    |
| Iuran Tunai       | `/preview/iuran`            | Deposit/refund, validasi saldo, void, riwayat, kuitansi dan cetak                               |
| Laporan           | `/preview/laporan`          | Ringkasan, peserta, kelompok, transaksi, CSV dan cetak                                          |
| Informasi Publik  | `/preview/informasi-publik` | Informasi, pratinjau langsung, WhatsApp, kondisi tanpa sorotan                                  |
| Akun Panitia      | `/preview/akun-panitia`     | Profil dan daftar contoh, tambah, aktif/nonaktif dengan alasan                                  |
| Riwayat Aktivitas | `/preview/aktivitas`        | Cari, filter kategori/petugas/tanggal dan detail                                                |

Detail contoh: `/preview/peserta/peserta-1`, `/preview/kelompok/sapi-01`, dan `/preview/iuran/trx-1`. Path tanpa `/preview` memakai data nyata dengan proteksi admin aktif di server. `/register` mengarah ke login; signup publik pada API juga dinonaktifkan.

Isi Informasi Publik, buat periode dan jadwal, tambahkan kelompok sapi, lalu buka pendaftaran. Peserta lama dapat dipakai kembali melalui direktori jamaah. Daftar tunggu belum menerima setoran sampai memiliki kelompok. Akun panitia nyata dibuat melalui menu Akun Panitia; akun contoh di `/preview` tetap tidak membuat kredensial login.

## Aturan backend

- Setiap halaman, API privat, dan Server Action memeriksa sesi serta `committee_admins.is_active`. Signup publik ditutup, login nonadmin/nonaktif ditolak, dan penonaktifan mengakhiri sesi akun tersebut.
- Mutasi memvalidasi payload di server, memeriksa status dan tanggal berdasarkan `Asia/Jakarta`, lalu mengunci periode, kelompok, dan kepesertaan secara konsisten. Saldo dihitung ulang setelah kunci diperoleh.
- Satu kelompok maksimal tujuh anggota. Target anggota rata dibulatkan ke atas. Harga/anggota terkunci hanya dapat dibuka kembali sebelum pembelian, dengan alasan dan audit. Kelompok siap hanya jika semua anggota tepat lunas.
- Deposit tidak melampaui sisa kewajiban; refund tidak melampaui setoran bersih. Form memakai UUID yang tetap saat retry. Key sama dengan payload berbeda ditolak. Kuitansi unik dibuat di server.
- Void dan koreksi berantai menjaga saldo nonnegatif. Tombol **Koreksi sekaligus** dapat membatalkan transaksi terkait dan membuat pengganti dalam satu transaksi database, termasuk audit. Riwayat transaksi dan audit dijaga trigger append-only.
- Periode selesai/arsip hanya baca. Pembukaan kembali, perubahan jadwal, pembatalan, dan pengaturan akses memerlukan pencatatan yang dapat ditelusuri. Refund tetap dapat diselesaikan setelah tenggat sebelum periode selesai.
- Mutasi API memeriksa origin dan JSON; data privat memakai `Cache-Control: private, no-store`. Publik memakai daftar kolom eksplisit dan snapshot agregat konsisten tanpa cache lintas periode. Sinkronisasi dashboard dilakukan setelah mutasi, saat jendela aktif kembali, dan setiap 30 detik.

API: `GET /api/qurban` untuk snapshot panitia, `POST /api/qurban` untuk command tervalidasi, dan `GET /api/public/qurban` untuk informasi publik. Layanan berada di `src/lib/server/`. Data domain tidak dapat ditulis dengan mengirim state frontend secara langsung. Password memakai hashing resmi Better Auth dan tidak dicatat dalam audit.

Foto sapi: [Daniel Gheorghe / Unsplash](https://unsplash.com/photos/brown-cow-on-green-grass-field-during-daytime-0PESYk_WkUY), disimpan lokal di `public/qurban-cow.jpg`. Logo memakai `public/logo.png` milik proyek.

## Prasyarat

- Node.js **24.15+** direkomendasikan; proyek diverifikasi dengan **24.19.0**. Node 22.22.2+ dan 26+ juga memenuhi persyaratan dependency. `.nvmrc` tersedia.
- pnpm **11.20.0**, sesuai `packageManager` di `package.json`.
- Docker Desktop/Engine dan Docker Compose v2 yang sudah berjalan.
- Port **3000** dan **5432** tersedia.

## Setup

1. Salin environment untuk checkout baru:

   ```powershell
   Copy-Item .env.example .env
   ```

   Di macOS/Linux: `cp .env.example .env`. Workspace yang disiapkan saat instalasi sudah memiliki `.env` lokal dengan kredensial acak; tidak perlu menimpanya.

2. Untuk checkout baru, buat secret dan masukkan hasilnya ke `BETTER_AUTH_SECRET` di `.env`:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   Secret contoh sengaja ditolak oleh validasi environment. Sesuaikan `POSTGRES_USER`, `POSTGRES_PASSWORD`, dan `POSTGRES_DB`; pastikan ketiganya cocok dengan `DATABASE_URL`. Persen-encode karakter khusus pada kredensial di URL.

3. Jalankan database, instal dependency, dan terapkan migrasi yang sudah disertakan:

   ```sh
   docker compose up -d --wait
   pnpm install --frozen-lockfile
   pnpm db:migrate
   pnpm dev
   ```

4. Pada database baru, jalankan `pnpm admin:bootstrap` di terminal untuk membuat admin pertama. Isi nama dan email; script menghasilkan password acak yang ditampilkan sekali. Script menolak dijalankan kembali setelah panitia pertama tersedia. Tidak ada endpoint bootstrap publik atau password bawaan.

   Bootstrap noninteraktif dapat membaca `QURBAN_BOOTSTRAP_NAME`, `QURBAN_BOOTSTRAP_EMAIL`, dan `QURBAN_BOOTSTRAP_PASSWORD` dari environment proses. Jangan menyimpan password tersebut ke repository.

5. Buka [http://localhost:3000/login](http://localhost:3000/login) memakai admin yang sudah disiapkan. Tambahkan panitia berikutnya melalui dashboard. Password awal panitia tambahan dan password baru minimal 12 karakter; perubahan password mengakhiri seluruh sesi akun.

`pnpm install` tanpa `--frozen-lockfile` juga dapat dipakai untuk pengembangan. Jangan menjalankan `db:generate` untuk setup awal: migrasi awal sudah tersedia di `drizzle/`.

## Environment

| Variabel              | Kegunaan                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `POSTGRES_USER`       | User PostgreSQL yang dibuat Docker saat volume pertama kali diinisialisasi. |
| `POSTGRES_PASSWORD`   | Kata sandi PostgreSQL lokal.                                                |
| `POSTGRES_DB`         | Nama database lokal; default `qurban`.                                      |
| `DATABASE_URL`        | Koneksi aplikasi dan Drizzle ke database tersebut.                          |
| `BETTER_AUTH_SECRET`  | Secret privat acak, minimal 32 karakter.                                    |
| `BETTER_AUTH_URL`     | Origin server autentikasi; lokal `http://localhost:3000`.                   |
| `NEXT_PUBLIC_APP_URL` | Origin publik untuk auth client; lokal `http://localhost:3000`.             |

Gunakan origin yang sama pada browser dan kedua variabel URL. Jika mengganti port/domain, ubah keduanya dan restart aplikasi. Variabel `NEXT_PUBLIC_*` dimasukkan ke bundle browser saat build; secret hanya berada pada environment server. `.env*` diabaikan Git dengan pengecualian `.env.example`.

## Script

| Perintah               | Fungsi                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`             | Server development Next.js/Turbopack.                                            |
| `pnpm build`           | Build produksi dan pemeriksaan TypeScript Next.js.                               |
| `pnpm start`           | Menjalankan hasil build produksi.                                                |
| `pnpm lint`            | ESLint dengan cache dan tanpa warning yang diizinkan.                            |
| `pnpm typecheck`       | Membuat tipe route Next.js dan menjalankan TypeScript strict.                    |
| `pnpm format`          | Memformat kode memakai Prettier.                                                 |
| `pnpm format:check`    | Memeriksa format tanpa mengubah file.                                            |
| `pnpm test`            | Menjalankan seluruh unit test sekali.                                            |
| `pnpm test:watch`      | Unit test dalam mode watch.                                                      |
| `pnpm test:e2e`        | E2E Chromium; otomatis menjalankan server bila perlu.                            |
| `pnpm test:e2e:ui`     | Playwright dalam mode UI.                                                        |
| `pnpm test:backend`    | Build produksi dan integrasi pada database uji terisolasi.                       |
| `pnpm admin:bootstrap` | Membuat admin pertama melalui terminal internal.                                 |
| `pnpm db:generate`     | Menghasilkan migrasi SQL dari perubahan skema.                                   |
| `pnpm db:migrate`      | Menerapkan migrasi SQL yang belum dijalankan.                                    |
| `pnpm db:push`         | Menyinkronkan skema langsung untuk eksperimen lokal.                             |
| `pnpm db:studio`       | Membuka Drizzle Studio.                                                          |
| `pnpm auth:generate`   | Menghasilkan ulang skema Better Auth dan menormalkan timestamp ke `timestamptz`. |

## Struktur

```text
src/
  app/
    (auth)/
      layout.tsx                # Redirect pengguna yang sudah masuk
      login/page.tsx
      register/page.tsx
    (app)/
      layout.tsx                # Proteksi sesi pada server
      dashboard/
        page.tsx                # Server Component
        actions.ts              # Server Action perubahan profil
        loading.tsx
    api/
      auth/[...all]/route.ts    # Handler Better Auth
      account/route.ts          # Contoh endpoint data terproteksi
    globals.css                 # Tailwind v4 + token tema terang
    layout.tsx
    page.tsx
    error.tsx
    not-found.tsx
  components/
    ui/                         # Komponen shadcn milik proyek
    shared/                     # Layout, autentikasi, dan informasi akun
  db/
    index.ts                    # Pool postgres-js, aman untuk hot reload
    schema/
      auth.ts                   # Skema hasil CLI Better Auth
      index.ts                  # Ekspor skema ke adapter/Drizzle Kit
  hooks/                        # useAccount dan useSidebar
  lib/
    auth.ts                     # Better Auth server + adapter PostgreSQL
    auth-client.ts              # Better Auth React client
    env.ts                      # Validasi environment server
    session.ts                  # getSession dan requireSession
    validations/auth.ts         # Skema form bersama client/server
    types.ts
    utils.ts
  providers/                    # Theme, TanStack Query, dan sidebar
  stores/                       # Factory store Zustand per instance
scripts/
  normalize-auth-schema.mjs
drizzle/                        # Migrasi SQL dan metadata
tests/
  setup.ts
  unit/
  e2e/
```

## Autentikasi dan data

- Better Auth menyimpan user, akun/password hash, sesi, dan verifikasi pada PostgreSQL melalui `@better-auth/drizzle-adapter` dengan provider `pg`.
- Layout `(app)`, setiap halaman internal, endpoint privat, dan Server Action memeriksa admin aktif. Mutasi memeriksa ulang keanggotaan di dalam transaksi. `getSession` hanya memakai cache per request.
- `/api/account` memberi respons `401` tanpa sesi dan `Cache-Control: private, no-store`. Respons hanya berisi ringkasan akun, tanpa token sesi atau password.
- `DemoProvider` mempunyai dua mode: initial state database dan command API pada halaman nyata, fixture dalam memori pada `/preview`. Data contoh tidak masuk ke jalur operasional.
- Sidebar dan pilihan periode memakai state lokal. Snapshot server dimuat ulang setelah operasi berhasil; refresh lama tidak boleh menimpa hasil mutasi yang lebih baru.
- Tema terang ditetapkan melalui `next-themes`, termasuk ketika perangkat atau preferensi tersimpan menggunakan mode gelap. Notifikasi dan kontrol bawaan browser juga memakai tema terang.
- Email verification dan reset password belum diaktifkan karena penyedia pengiriman email belum dikonfigurasi.

### Menambahkan OAuth

Email/password sudah dapat digunakan tanpa kredensial tambahan. Untuk menambahkan Google, misalnya, simpan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di environment server, validasi keduanya di `src/lib/env.ts`, lalu tambahkan pada `socialProviders` di `src/lib/auth.ts`:

```ts
socialProviders: {
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
},
```

Daftarkan redirect URI lokal `http://localhost:3000/api/auth/callback/google` pada provider. Tambahkan tombol client `authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })` ketika provider sudah dikonfigurasi. Untuk deployment, gunakan origin HTTPS dan secret/kredensial environment deployment tersendiri.

### Mengubah skema

Untuk tabel aplikasi baru, tambahkan file pada `src/db/schema/`, ekspor melalui `index.ts`, lalu jalankan `pnpm db:generate` dan `pnpm db:migrate`.

Setelah menambah plugin atau field Better Auth, jalankan `pnpm auth:generate`, tinjau perubahan, lalu buat dan terapkan migrasinya. Generator resmi menghasilkan tabel, relasi, indeks foreign key, dan unique email/token; script lanjutan mempertahankan tipe timestamp dengan zona waktu. Jangan mengedit migrasi yang sudah diterapkan.

Volume `postgres_data` mempertahankan data ketika container dihentikan dengan `docker compose down`. Kredensial `POSTGRES_*` dipakai image PostgreSQL saat volume pertama kali dibuat; mengubah `.env` saja tidak mengubah password pada volume yang sudah berisi database.

## Pengujian

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:backend
pnpm format:check
```

Unit test mencakup login, isolasi store, perhitungan iuran, refund/void, pembulatan, dan pemisahan periode. E2E frontend memeriksa seluruh menu pada desktop/ponsel, tema, formulir contoh, kuitansi cetak, dan CSV. `pnpm test:backend` membuat database `qurban_e2e_*` acak, menerapkan migrasi, memeriksa bootstrap, membangun server produksi terpisah di port 3002, lalu menguji otorisasi, penyimpanan UI, konkurensi, retry, koreksi atomik, tenggat, arsip, dan akses panitia. Database uji dihapus setelah pengujian; database utama tidak diisi fixture. Role database lokal perlu izin `CREATE DATABASE` untuk runner ini.

Playwright memakai `http://localhost:3000`. Ia menggunakan server lokal yang sudah berjalan, atau menjalankan dan menghentikan server sendiri. Untuk menguji build produksi pada PowerShell saat port 3000 kosong:

```powershell
pnpm build
$env:PLAYWRIGHT_USE_PRODUCTION = "1"
pnpm test:e2e
Remove-Item Env:PLAYWRIGHT_USE_PRODUCTION
```

Laporan HTML tersedia melalui `pnpm exec playwright show-report`. Screenshot contoh tersimpan di `artifacts/`; trace dan screenshot kegagalan di `test-results/`. Semua hasil lokal tersebut diabaikan Git.

Screenshot verifikasi frontend tersedia di `artifacts/frontend/`. Audit Lighthouse dari template awal tidak mewakili halaman frontend yang baru.

## Versi yang dikunci

| Dependency utama                         | Versi                                        |
| ---------------------------------------- | -------------------------------------------- |
| Next.js / React                          | 16.4.2 / 19.3.0                              |
| TypeScript                               | 5.9.3, strict                                |
| Tailwind CSS                             | 4.3.3, loader resmi `@tailwindcss/turbopack` |
| shadcn CLI / Radix UI                    | 4.22.1 / 1.8.1                               |
| PostgreSQL lokal                         | 17.11, image `postgres:17-alpine`            |
| Drizzle ORM / Kit                        | 0.45.4 / 0.31.11                             |
| postgres-js                              | 3.4.9                                        |
| Better Auth / Drizzle adapter / CLI auth | 1.7.12                                       |
| Zod / React Hook Form / resolver         | 4.6.7 / 7.90.0 / 6.0.0                       |
| TanStack Query / Zustand                 | 5.104.5 / 5.0.15                             |
| next-themes / Sonner                     | 0.4.6 / 2.0.8                                |
| Vitest / Testing Library React           | 5.0.5 / 16.3.3                               |
| Playwright                               | 1.64.1                                       |
| ESLint / Prettier                        | 9.39.5 / 3.9.10                              |

Seluruh dependency langsung di `package.json` menggunakan versi persis dan dependency transitif terkunci di `pnpm-lock.yaml`. ESLint 9 dipertahankan karena plugin import, React, dan aksesibilitas pada konfigurasi Next.js saat ini masih mendeklarasikan dukungan hingga major 9. shadcn menggunakan preset `radix-nova`; komponen form berasal dari registry resmi `new-york-v4` karena preset baru tidak menyertakan form lama.

## Referensi resmi

- [Next.js: instalasi dan persyaratan](https://nextjs.org/docs/app/getting-started/installation)
- [Better Auth: integrasi Next.js](https://better-auth.com/docs/integrations/next)
- [Better Auth: Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth: CLI dan schema generation](https://better-auth.com/docs/concepts/cli)
- [Drizzle: PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/docs)
- [TanStack Query: SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [Zustand: Next.js](https://zustand.docs.pmnd.rs/guides/nextjs)

Dokumentasi library diperiksa menggunakan Context7 dan sumber resmi sebelum integrasi.
