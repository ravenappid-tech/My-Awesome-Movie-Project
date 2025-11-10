// /routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Import JWT
const pool = require('../config/db');

const router = express.Router();

// --- POST /auth/register (ที่คุณมีอยู่แล้ว) ---
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }

        const [existingUser] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.execute(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, passwordHash]
        );

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// --- ‼️ โค้ดใหม่: POST /auth/login (API สำหรับล็อกอิน) ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. ตรวจสอบว่ามีข้อมูลครบไหม
        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }

        // 2. ค้นหา User ใน DB
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' }); // ใช้ "Invalid" เพื่อความปลอดภัย
        }

        const user = users[0];

        // 3. ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 4. (สำคัญ!) สร้าง "ตั๋ว" (JWT Token)
        const payload = {
            user: {
                id: user.id, // เราจะใช้ ID นี้ในการค้นหา Key ของเขา
                email: user.email
            }
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET, // ดึง Secret Key จาก .env
            { expiresIn: '7d' }  // Token หมดอายุใน 7 วัน
        );

        // 5. ส่ง Token กลับไปให้หน้าบ้าน (Frontend)
        res.json({
            message: 'Login successful!',
            token: token // หน้าบ้านจะเก็บ Token นี้ไว้
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;