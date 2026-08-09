# Auth Testing Playbook (SIMAPAN)

Auth: custom username+password JWT. Token dikembalikan di body (`token`), disimpan di localStorage frontend, dikirim via header `Authorization: Bearer <token>`. Cookie httpOnly `access_token` juga di-set (SameSite=Lax, same-origin).

## API Testing
```
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"Admin@123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

Login harus mengembalikan `{token, user}`. `/auth/me` mengembalikan user yang sama.

## MongoDB verification
```
mongosh
use test_database
db.users.find({role: "admin"})
db.users.findOne({username: "admin"}, {hashed_password: 1})
```
Hash harus diawali `$2b$`. Index unik: `users.username`, `inmates.registration_number`.

## Roles
- admin: semua akses
- supervisor: persetujuan, warga binaan, barcode, scan
- operator: hanya /scan + aktivitas miliknya
- read_only: lihat saja

## Barcode & export (butuh token, bisa via ?token=)
- GET /api/inmates/{id}/barcode (PNG QR)
- GET /api/locations/{id}/barcode (PNG QR)
- GET /api/activities/export (XLSX)
