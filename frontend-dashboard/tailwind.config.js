/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}", // บอกให้ Tailwind สแกนไฟล์ .html และ .js ที่อยู่ข้างนอก
    "./js/*.js"      // (เผื่อไว้) สแกนไฟล์ JS ในโฟลเดอร์ js
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}