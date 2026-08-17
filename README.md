# Lucky Roulette

GitHub Pages + Firebase Authentication + Realtime Database asosidagi virtual casino demo.

## Login tizimi

Foydalanuvchi interfeysida email ko‘rsatilmaydi. Foydalanuvchi faqat `login + parol` kiritadi.

Hozirgi GitHub Pages arxitekturasida Firebase Email/Password Authentication email talab qilgani uchun foydalanuvchidan yashirilgan ichki texnik email ishlatiladi. Bu haqiqiy email manzili emas.

## GitHub Pages

Settings -> Pages -> Deploy from branch -> `main` -> `/ (root)`.

## Firebase

Authentication -> Email/Password yoqilgan bo‘lsin.
Realtime Database mavjud bo‘lsin.
GitHub Pages domeni Authentication -> Settings -> Authorized domains ichiga qo‘shilsin.

## Muhim xavfsizlik

Bu demo GitHub Pages-only client-side loyiha. O‘yin natijasi browser JavaScriptida hisoblanadi va production/real pul tizimi uchun xavfsiz emas.

Realtime Database rules vaqtinchalik ochiq bo‘lsa, keyinchalik autentifikatsiyaga asoslangan rules bilan almashtirish kerak.
