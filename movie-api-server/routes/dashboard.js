// /routes/dashboard.js
const express = require('express');
const crypto = require('crypto'); // Library สำหรับสร้าง Key (มีใน Node.js)
const pool = require('../config/db');
const checkAuth = require('../middleware/checkAuth'); // Import "ยาม"

const router = express.Router();

// ‼️ ใช้ "ยาม" (checkAuth) กับทุก API ในไฟล์นี้
// แปลว่า ทุก API ในนี้ ต้องมี Token ถึงจะเรียกได้
router.use(checkAuth);

// --- GET /dashboard/stats (ดึงสถิติ) ---
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id; // ID นี้ได้มาจาก checkAuth

        // เราจะรวมข้อมูลจาก Key ทุกใบของ User คนนี้
        const [stats] = await pool.execute(
            'SELECT COUNT(*) as totalKeys, SUM(quota_used) as totalUsage, MAX(quota_limit) as quotaLimit FROM api_keys WHERE user_id = ?',
            [userId]
        );

        // ส่งข้อมูลกลับไปให้หน้า Dashboard
        res.json({
            email: req.user.email,
            totalKeys: stats[0].totalKeys || 0,
            totalUsage: parseInt(stats[0].totalUsage) || 0,
            quotaLimit: stats[0].quotaLimit || 10000 // (ค่าเริ่มต้น)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- GET /dashboard/keys (ดึง API Key ทั้งหมด) ---
router.get('/keys', async (req, res) => {
    try {
        const userId = req.user.id;
        const [keys] = await pool.execute(
            'SELECT id, api_key, status, quota_used, quota_limit FROM api_keys WHERE user_id = ? ORDER BY id DESC',
            [userId]
        );
        res.json(keys);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- POST /dashboard/keys (สร้าง Key ใหม่) ---
router.post('/keys', async (req, res) => {
    try {
        const userId = req.user.id;

        // สร้าง Key แบบสุ่ม (เช่น sk_live_... )
        const newKey = `sk_live_${crypto.randomBytes(16).toString('hex')}`;

        // บันทึกลง DB
        const [result] = await pool.execute(
            'INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)',
            [userId, newKey]
        );
        
        const newKeyId = result.insertId;

        // ส่ง Key ใหม่กลับไปให้หน้าบ้าน
        res.status(201).json({
            id: newKeyId,
            api_key: newKey,
            status: 'active',
            quota_used: 0,
            quota_limit: 10000
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- DELETE /dashboard/keys/:keyId (ลบ Key) ---
router.delete('/keys/:keyId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { keyId } = req.params;

        // ลบ Key โดยต้องมั่นใจว่า Key นี้เป็นของ User คนนี้ (กันคนแอบลบ Key คนอื่น)
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

module.exports = router;