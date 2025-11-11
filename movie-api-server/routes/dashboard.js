// /routes/dashboard.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); 
const pool = require('../config/db');
const checkAuth = require('../middleware/checkAuth'); 

const router = express.Router();

// ใช้ "ยาม" (checkAuth) กับทุก API ในไฟล์นี้
router.use(checkAuth);

// --- 1. GET /dashboard/profile (ดึงข้อมูล Profile) ---
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // ดึงข้อมูลทั้งหมดสำหรับหน้า Profile/Account Settings
        const [users] = await pool.execute(
            'SELECT email, first_name, last_name, phone FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(users[0]);

    } catch (error) {
        console.error('GET Profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 2. PUT /dashboard/profile (อัปเดตข้อมูล Profile) ---
router.put('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        const { first_name, last_name, phone } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({ error: 'First Name and Last Name are required' });
        }
        
        // อัปเดตข้อมูลในตาราง users
        await pool.execute(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?',
            [first_name, last_name, phone, userId]
        );

        res.json({ message: 'Profile updated successfully!' });

    } catch (error) {
        console.error('PUT Profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 3. GET /dashboard/stats (ดึงสถิติ Balance) ---
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id; 

        // ดึง Balance
        const [users] = await pool.execute(
            'SELECT balance FROM users WHERE id = ?',
            [userId]
        );

        // ดึงจำนวน Key
        const [stats] = await pool.execute(
            'SELECT COUNT(*) as totalKeys FROM api_keys WHERE user_id = ?',
            [userId]
        );

        res.json({
            email: req.user.email,
            balance: parseFloat(users[0].balance).toFixed(4), 
            totalKeys: stats[0].totalKeys || 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 4. GET /dashboard/keys (ดึง API Key ทั้งหมด) ---
router.get('/keys', async (req, res) => {
    try {
        const userId = req.user.id;
        // ดึง expires_at มาแสดงใน Frontend ด้วย
        const [keys] = await pool.execute(
            'SELECT id, api_key, status, expires_at FROM api_keys WHERE user_id = ? ORDER BY id DESC',
            [userId]
        );
        res.json(keys);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 5. POST /dashboard/keys (สร้าง Key ใหม่) ---
router.post('/keys', async (req, res) => {
    try {
        const userId = req.user.id;
        const newKey = `sk_live_${crypto.randomBytes(16).toString('hex')}`;
        
        // กำหนดวันหมดอายุเริ่มต้น (30 วันนับจากนี้)
        const initialExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 

        // บันทึกลง DB
        const [result] = await pool.execute(
            'INSERT INTO api_keys (user_id, api_key, expires_at) VALUES (?, ?, ?)',
            [userId, newKey, initialExpiryDate]
        );
        
        const newKeyId = result.insertId;

        res.status(201).json({
            id: newKeyId,
            api_key: newKey,
            status: 'active',
            expires_at: initialExpiryDate // ส่งกลับไป
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 6. DELETE /dashboard/keys/:keyId (ลบ Key) ---
router.delete('/keys/:keyId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { keyId } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
            [keyId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Key not found or user not authorized' });
        }
        res.json({ message: 'API Key deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 7. POST /dashboard/link-telegram (บันทึก Chat ID) ---
router.post('/link-telegram', async (req, res) => {
    try {
        const { chatId } = req.body;
        const userId = req.user.id;

        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }
        await pool.execute(
            'UPDATE users SET telegram_chat_id = ? WHERE id = ?',
            [chatId, userId]
        );
        res.json({ message: 'Telegram account linked successfully!' });
    } catch (error) {
        console.error('Error linking Telegram:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 8. POST /dashboard/change-password (เปลี่ยนรหัสผ่าน) ---
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newPasswordHash, userId]
        );

        res.json({ message: 'Password updated successfully!' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;