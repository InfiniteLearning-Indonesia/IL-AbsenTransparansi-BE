# Absensi Tools - Backend API

Backend ini merupakan layanan REST API yang dibangun menggunakan Node.js dan Express. Layanan ini berfungsi sebagai jembatan sinkronisasi data antara Airtable (sumber data utama) dan MongoDB (database aplikasi), serta menyediakan endpoint untuk autentikasi dan pengambilan data absensi.

## Teknologi Utama (Tech Stack)

Berikut adalah teknologi dan pustaka utama yang digunakan dalam pengembangan backend:

- **Runtime & Framework:**
  - **Node.js**: Runtime environment JavaScript.
  - **Express.js**: Framework web untuk membangun routing dan middleware API.

- **Database & ODM:**
  - **MongoDB**: Database NoSQL untuk menyimpan data mentee dan history absensi.
  - **Mongoose**: Object Data Modeling (ODM) untuk manajemen skema dan validasi data.

- **Integrasi Pihak Ketiga:**
  - **Airtable SDK**: Digunakan untuk mengambil data mentah dari base Airtable Infinite Learning.

- **Autentikasi & Keamanan:**
  - **JWT (JSON Web Token)**: Untuk manajemen sesi login admin yang aman.
  - **Bcrypt / Crypto**: Untuk hashing password (jika diimplementasikan untuk user management).
  - **Cors**: Middleware untuk mengizinkan akses resource dari domain frontend.

- **Utilitas:**
  - **Dotenv**: Manajemen variabel lingkungan (.env).
  - **Nodemon**: Utilitas pengembangan untuk restart server otomatis.

## Struktur Data Mentee

Sistem ini menggunakan skema `MenteeAttendance` yang dinamis untuk mengakomodasi perubahan jadwal:

- **Identitas**: Nama, Nomor WhatsApp (sebagai kunci unik), Institusi, Program.
- **Attendance Map**: `Map<String, String>` yang menyimpan status harian (Tanggal -> Status).
  - Kunci: Tanggal (misalnya "10", "11").
  - Nilai: Status kehadiran ("Hadir", "Izin", "Alpha") atau string "null" untuk jadwal yang belum dimulai.
- **Summary**: Objek ringkasan statistik yang mencakup:
  - `hadir`, `izin`, `alpha`: Jumlah sesi yang sudah terlaksana.
  - `belumDiisi`: Jumlah sesi yang dijadwalkan tetapi belum diabsen.
  - `persen`: Persentase kehadiran (dihitung dari total seluruh jadwal sebulan).

## Instalasi dan Menjalankan Server

1. **Prasyarat**: Pastikan Node.js dan MongoDB sudah terinstal dan berjalan.
2. **Instalasi Dependensi**:
   ```bash
   npm install
   ```
3. **Konfigurasi Environment**:
   Untuk menjalankan aplikasi, salin file `.env.example` menjadi `.env` dan isi variabel berikut sesuai kebutuhan (lokal atau live):
   ```bash
   cp .env.example .env
   ```

   **Daftar Variabel (`.env.example`):**
   - `PORT`: Port server backend (default: 5000).
   - `MONGODB_URI`: URL koneksi database MongoDB.
   - `AIRTABLE_PAT`: Personal Access Token dari Airtable.
   - `BASE_ID`: ID Base Airtable yang digunakan.
   - `JWT_SECRET`: String acak untuk keamanan token sesi login.
   - `FRONTEND_URL`: URL aplikasi frontend (misal: `http://localhost:3000` atau URL live Anda) untuk konfigurasi CORS.

4. **Menjalankan Server (Mode Development)**:
   ```bash
   npm run dev
   ```

## Endpoint Utama

- `POST /auth/login`: Autentikasi admin.
- `POST /admin/fetch/:month`: Memicu sinkronisasi data dari Airtable ke MongoDB untuk bulan tertentu.
- `GET /admin/stats`: Mengambil statistik ringkasan dashboard.
- `GET /admin/history`: Mengambil riwayat detail per hari.
- `GET /admin/data`: Mengambil data mentee dengan fitur pencarian dan filter.
- `POST /mentee/check`: Endpoint publik untuk pengecekan absensi berdasarkan nomor WhatsApp.
