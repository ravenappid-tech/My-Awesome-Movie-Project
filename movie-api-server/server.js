// /server.js (เวอร์ชันอัปเดตสำหรับ Billing)
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const movieRoutes = require('./routes/movies');
const billingRoutes = require('./routes/billing'); // 👈 เพิ่ม Import นี้

const app = express();
const port = process.env.PORT || 3001; 

// --- Middlewares ---
app.use(cors()); 

// (‼️ สำคัญ: เราจะย้าย express.json() ลงไปข้างล่าง)

// --- API Routes ---

// (‼️ สำคัญ: Webhook ต้องอยู่ "ก่อน" express.json())
// Stripe Webhook (ต้องการ Body ดิบ)
app.use('/billing/webhook', billingRoutes);

// (ตอนนี้เราค่อยใช้ express.json() สำหรับ API ที่เหลือ)
app.use(express.json()); 

// ส่วนจัดการลูกค้า (สมัคร/ล็อกอิน/แดชบอร์ด)
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);

// ส่วน API หนัง (สินค้าของเรา)
app.use('/api/v1/movie', movieRoutes);

// ส่วน Billing (สำหรับสร้าง Checkout)
app.use('/billing', billingRoutes); // 👈 เพิ่มบรรทัดนี้

// --- Endpoint ทดสอบ ---
app.get('/', (req, res) => {
    res.send('Movie API Server is running! 🚀');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 API Server running on http://localhost:${port}`);
});