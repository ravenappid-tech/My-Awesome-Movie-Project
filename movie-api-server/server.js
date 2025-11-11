// /server.js
require('dotenv').config(); // โหลด .env ก่อนเพื่อน
const express = require('express');
const cors = require('cors');

// --- Import Routes (นำเข้า API ทั้งหมด) ---
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const movieRoutes = require('./routes/movies');
const billingRoutes = require('./routes/billing'); 

const app = express();
const port = process.env.PORT || 3001; 

// --- Middlewares ---
app.use(cors()); // อนุญาตให้ Frontend (ที่รันคนละ Port) เรียกหาได้

// ‼️ (สำคัญ!) โค้ด Webhook ต้องอยู่ "ก่อน" express.json() ‼️
// Stripe Webhook (ต้องการ Body ดิบ)
app.use('/billing/webhook', billingRoutes);

// (ตอนนี้เราค่อยใช้ express.json() สำหรับ API ที่เหลือ)
app.use(express.json()); 

// --- Middleware สำหรับแนบ CLOUDFRONT_DOMAIN (แก้ไขปัญหา Invalid URL) ---
app.use((req, res, next) => {
    // โดเมน CloudFront (ต้องมาจาก .env)
    req.cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN; 
    next();
});

// --- API Routes ---

// ส่วนจัดการลูกค้า (สมัคร/ล็อกอิน/ลืมรหัส)
app.use('/auth', authRoutes);

// ส่วนจัดการ Dashboard (Profile, Keys, Balance, Telegram)
app.use('/dashboard', dashboardRoutes);

// ส่วน API หนัง (สินค้าของเรา - จะใช้ checkApiKey)
app.use('/api/v1', movieRoutes); // 👈 แก้ไข: ใช้ movieRoutes สำหรับ /api/v1/movie

// ส่วน Billing (สำหรับสร้าง Checkout Session)
app.use('/billing', billingRoutes); 

// --- Endpoint ทดสอบ ---
app.get('/', (req, res) => {
    res.send('Movie API Server is running! 🚀');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 API Server running on http://localhost:${port}`);
    // แสดงค่า Domain ที่โหลดได้ใน Terminal เพื่อ Debug
    console.log(`DEBUG: CLOUDFRONT_DOMAIN loaded as: ${process.env.CLOUDFRONT_DOMAIN}`);
});