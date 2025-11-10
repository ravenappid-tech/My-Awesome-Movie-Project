// /server.js
require('dotenv').config(); // โหลด .env ก่อนเพื่อน
const express = require('express');
const cors = require('cors');

// --- Import Routes (นำเข้า API ทั้ง 3 ส่วน) ---
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const movieRoutes = require('./routes/movies');

const app = express();
const port = process.env.PORT || 3001;

// --- Middlewares ---
app.use(cors()); // อนุญาตให้ Frontend (ที่รันคนละ Port) เรียกหาได้
app.use(express.json()); // ให้ Express อ่าน JSON ที่ส่งมาจาก Body ได้

// --- API Routes ---
// ส่วนจัดการลูกค้า (สมัคร/ล็อกอิน/แดชบอร์ด)
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);

// ส่วน API หนัง (สินค้าของเรา)
app.use('/api/v1/movie', movieRoutes);


// --- Endpoint ทดสอบ ---
app.get('/', (req, res) => {
    res.send('Movie API Server is running! 🚀');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 API Server running on http://localhost:${port}`);
});