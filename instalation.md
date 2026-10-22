Kamu adalah engineer senior. Tugasmu: membuat template fullstack Next.js yang siap dikembangkan, lengkap dengan instalasi, konfigurasi, dan struktur folder. Kerjakan langkah demi langkah sampai semuanya berjalan, lalu laporkan hasilnya.

## Nama proyek

`Qurban` (ganti sesuai kebutuhan)

## Tech stack

- Next.js (versi stabil terbaru, App Router) + React + TypeScript (strict mode)
- Tailwind CSS v4 + shadcn/ui
- PostgreSQL (lokal lewat Docker Compose) + Drizzle ORM + drizzle-kit
- Better Auth (email/password, siap ditambah OAuth)
- Zod + React Hook Form (validasi dan form)
- TanStack Query (data server) + Zustand (state client)
- Vitest + Testing Library (unit test) dan Playwright (e2e)
- ESLint + Prettier
- Package manager: pnpm (jika tidak tersedia, pakai npm)

## Aturan kerja

1. Jangan menebak API. Sebelum memakai library, cek dokumentasi resmi versi terbaru (gunakan tool dokumentasi/web search jika tersedia), terutama untuk Better Auth, Drizzle, dan Tailwind v4 yang konfigurasinya berbeda dari versi lama.
2. Kunci versi dependency di `package.json` (tanpa `latest`).
3. Gunakan App Router, Server Components sebagai default, dan Server Actions untuk mutasi sederhana. Tandai `"use client"` hanya jika benar-benar perlu.
4. Jangan commit secret. Buat `.env.example` dan masukkan `.env*` ke `.gitignore`.
5. Setelah setiap tahap besar, jalankan lint, typecheck, dan build. Perbaiki error sebelum lanjut.

## Langkah

### 1. Inisialisasi

- Jalankan `create-next-app` dengan opsi: TypeScript, ESLint, Tailwind, App Router, folder `src/`, import alias `@/*`.
- Inisialisasi git dan buat commit awal.

### 2. UI

- Pastikan Tailwind v4 berfungsi.
- Jalankan `shadcn init`, lalu tambahkan komponen dasar: button, input, label, card, form, dialog, dropdown-menu, sonner (toast).
- Buat layout dasar: header, footer, dan dukungan dark mode.

### 3. Database

- Buat `docker-compose.yml` untuk PostgreSQL (volume persisten, port 5432, kredensial dari `.env`).
- Install `drizzle-orm`, `drizzle-kit`, dan driver Postgres (`postgres` atau `pg`).
- Buat `drizzle.config.ts`, `src/db/index.ts` (koneksi), dan `src/db/schema/`.
- Tambahkan script: `db:generate`, `db:migrate`, `db:push`, `db:studio`.

### 4. Autentikasi

- Install `better-auth` dan konfigurasikan dengan drizzle adapter (provider `pg`).
- Buat `src/lib/auth.ts` (server), `src/lib/auth-client.ts` (client), dan route handler `src/app/api/auth/[...all]/route.ts`.
- Generate schema auth ke Drizzle sesuai dokumentasi Better Auth, lalu migrasikan.
- Buat halaman `/login`, `/register`, dan `/dashboard` (terproteksi). Proteksi lewat pengecekan sesi di server, bukan hanya di client.
- Tambahkan tombol logout.

### 5. State &amp; data fetching

- Pasang `QueryClientProvider` (TanStack Query) di provider client.
- Buat satu contoh store Zustand (misalnya status sidebar).

### 6. Validasi &amp; form

- Buat skema Zod untuk form login dan register di `src/lib/validations/`.
- Hubungkan dengan React Hook Form dan komponen form shadcn.

### 7. Testing

- Konfigurasi Vitest + Testing Library dan buat satu contoh test.
- Konfigurasi Playwright dan buat satu e2e test (alur register lalu login).
- Tambahkan script `test`, `test:e2e`, `lint`, `typecheck`.

### 8. Struktur folder yang diinginkan

```
src/
  app/
    (auth)/login, register
    (app)/dashboard
    api/auth/[...all]/route.ts
  components/ui/        # shadcn
  components/shared/
  db/ (index.ts, schema/)
  lib/ (auth.ts, auth-client.ts, validations/, utils.ts)
  hooks/
  stores/
  providers/
tests/ (unit, e2e)
```

### 9. Dokumentasi

Buat [`README.md`](http://README.md) yang berisi:

- Prasyarat (Node, pnpm, Docker)
- Cara setup: salin `.env.example` ke `.env`, jalankan `docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm dev`
- Daftar script
- Penjelasan struktur folder

## Variabel environment (`.env.example`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/NAMA_PROYEK
BETTER_AUTH_SECRET=ganti-dengan-string-acak-minimal-32-karakter
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Kriteria selesai

- `pnpm dev` berjalan tanpa error di [http://localhost:3000](http://localhost:3000)
- Register, login, akses `/dashboard`, dan logout berfungsi
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, dan `pnpm build` lulus
- README lengkap

Di akhir, ringkas: apa yang sudah dibuat, versi tiap dependency utama, dan hal yang perlu saya isi manual (misalnya secret atau kredensial OAuth).