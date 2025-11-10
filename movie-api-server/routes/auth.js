// /routes/auth.js (เวอร์ชัน Telegram-Only)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

// (สำคัญ!) เราลบ import ของ mailer.js ออกไปแล้ว
const { sendPasswordResetTelegram } = require('../config/telegramBot');

const router = express.Router();

// --- POST /auth/register --- (เหมือนเดิม)
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }
        const [existingUser] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'Email already in use' });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await pool.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash]);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- POST /auth/login --- (เหมือนเดิม)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const payload = { user: { id: user.id, email: user.email } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Login successful!', token: token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- ‼️ POST /auth/forgot-password (อัปเดตใหม่!) ---
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        // (1) ถ้าไม่เจออีเมล
        if (users.length === 0) {
            return res.status(404).json({ error: 'Account not found with this email.' });
        }

        const user = users[0];

        // (2) ‼️ (Logic ใหม่!) ตรวจสอบว่าเชื่อม Telegram หรือยัง
        if (!user.telegram_chat_id) {
            // ถ้า "ไม่" ได้เชื่อม Telegram
            return res.status(400).json({ 
                error: 'Password reset is only available via Telegram. Please link your Telegram account in Account Settings first.' 
            });
        }

        // (3) ถ้าเชื่อม Telegram แล้ว -> ดำเนินการตามปกติ
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 3600000); // 1 ชั่วโมง

        await pool.execute(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetToken, tokenExpires, user.id]
        );

        // (4) ส่งทาง Telegram (เท่านั้น)
        await sendPasswordResetTelegram(user.telegram_chat_id, resetToken);

        res.json({ message: 'A password reset link has been sent to your linked Telegram account.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- POST /auth/reset-password --- (เหมือนเดิม)
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = users[0];
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.execute(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [passwordHash, user.id]
        );

        res.json({ message: 'Password has been reset successfully. Please login.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;