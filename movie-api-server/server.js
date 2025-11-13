// /server.js
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');

// --- Import Routes (นำเข้า API ทั้งหมด) ---
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const movieRoutes = require('./routes/movies');
const billingRoutes = require('./routes/billing'); 
const adminRoutes = require('./routes/admin'); // 👈 (Import ใหม่)

const app = express();
const port = process.env.PORT || 3001; 

// --- Middlewares ---
app.use(cors()); 

// Webhook ต้องอยู่ "ก่อน" express.json() 
app.use('/billing/webhook', billingRoutes);
app.use(express.json()); 

// --- Middleware สำหรับแนบ CLOUDFRONT_DOMAIN ---
app.use((req, res, next) => {
    req.cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN; 
    next();
});

// --- API Routes ---

// ส่วนจัดการลูกค้า (สมัคร/ล็อกอิน/ลืมรหัส)
app.use('/auth', authRoutes);

// ส่วนจัดการ Dashboard (Profile, Keys, Balance, Telegram)
app.use('/dashboard', dashboardRoutes);

// ส่วน API หนัง (สินค้าของเรา - สำหรับลูกค้า)
app.use('/api/v1/movie', movieRoutes); 

// ส่วน Billing (สำหรับสร้าง Checkout Session)
app.use('/billing', billingRoutes); 

// ‼️ (Route ใหม่) ส่วนจัดการ Admin ‼️
app.use('/admin', adminRoutes);

// --- Endpoint ทดสอบ ---
app.get('/', (req, res) => {
    res.send('Movie API Server is running! 🚀');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 API Server running on http://localhost:${port}`);
    console.log(`DEBUG: CLOUDFRONT_DOMAIN loaded as: ${process.env.CLOUDFRONT_DOMAIN}`);
});