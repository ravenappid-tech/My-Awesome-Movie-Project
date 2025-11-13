// /routes/dashboard.js (ไฟล์เต็ม - แก้ไข POST /keys)
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); 
const pool = require('../config/db');
const checkAuth = require('../middleware/checkAuth'); 
// ‼️ (ใหม่) Import ค่าต่ออายุ (เช่น 30.00) ‼️
const { MONTHLY_RENEWAL_COST } = require('../middleware/checkApiKey');

const router = express.Router();

// ‼️ (ใหม่) กฎธุรกิจ: ต้องมีเงินอย่างน้อย $100 ถึงจะสร้าง Key ได้ ‼️
const MINIMUM_BALANCE_TO_CREATE = 100.00;

router.use(checkAuth); 

// --- 1. GET /dashboard/profile ---
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
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

// --- 2. PUT /dashboard/profile ---
router.put('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        const { first_name, last_name, phone } = req.body;
        if (!first_name || !last_name) {
            return res.status(400).json({ error: 'First Name and Last Name are required' });
        }
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

// --- 3. GET /dashboard/stats ---
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id; 
        const [users] = await pool.execute(
            'SELECT balance, is_admin FROM users WHERE id = ?',
            [userId]
        );
        const [stats] = await pool.execute(
            'SELECT COUNT(*) as totalKeys FROM api_keys WHERE user_id = ?',
            [userId]
        );
        if (users.length === 0) {
             return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            email: req.user.email,
            balance: parseFloat(users[0].balance).toFixed(4), 
            totalKeys: stats[0].totalKeys || 0,
            is_admin: users[0].is_admin
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 4. GET /dashboard/keys ---
router.get('/keys', async (req, res) => {
    try {
        const userId = req.user.id;
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

// --- 5. ‼️ POST /dashboard/keys (แก้ไข Logic ทั้งหมด) ‼️ ---
router.post('/keys', async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await pool.execute('SELECT balance FROM users WHERE id = ?', [userId]);
        const currentBalance = parseFloat(users[0].balance);
        
        // ‼️ (กฎข้อที่ 1) ตรวจสอบว่ามีเงินถึง $100 หรือไม่
        if (currentBalance < MINIMUM_BALANCE_TO_CREATE) {
            return res.status(402).json({ 
                error: `You must have at least $${MINIMUM_BALANCE_TO_CREATE.toFixed(2)} in your balance to create a new key.` 
            });
        }

        // ‼️ (กฎข้อที่ 2) ตรวจสอบว่ามีเงินพอสำหรับ "ค่าสร้าง" ($30) หรือไม่
        if (currentBalance < MONTHLY_RENEWAL_COST) {
            return res.status(402).json({
                error: `You do not have enough funds ($${currentBalance.toFixed(2)}) to pay the initial key cost ($${MONTHLY_RENEWAL_COST.toFixed(2)}).`
            });
        }
        
        // ‼️ (กฎข้อที่ 3) ถ้ามีเงินพอ -> สร้าง Key, หักเงิน, และบันทึก Transaction
        const newKey = `sk_live_${crypto.randomBytes(16).toString('hex')}`;
        const initialExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // (A) สร้าง Key
            const [result] = await connection.execute(
                'INSERT INTO api_keys (user_id, api_key, expires_at) VALUES (?, ?, ?)',
                [userId, newKey, initialExpiryDate]
            );
            const newKeyId = result.insertId;

            // (B) หักเงิน (Deduct Balance)
            await connection.execute(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                [MONTHLY_RENEWAL_COST, userId]
            );

            // (C) บันทึกประวัติ (Log Transaction)
            await connection.execute(
                "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'debit', ?, ?)",
                [userId, MONTHLY_RENEWAL_COST, `Initial charge for new API Key ID: ${newKeyId}`]
            );

            await connection.commit();

            res.status(201).json({
                id: newKeyId,
                api_key: newKey,
                status: 'active',
                expires_at: initialExpiryDate
            });

        } catch (dbError) {
            await connection.rollback();
            throw dbError; // โยน Error ให้ catch บล็อกด้านนอก
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Create Key error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- 6. DELETE /dashboard/keys/:keyId ---
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

// --- 7. POST /dashboard/link-telegram ---
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

// --- 8. POST /dashboard/change-password ---
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

// --- 9. GET /dashboard/transactions ---
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        const [transactions] = await pool.execute(
            'SELECT type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        res.json(transactions);
    } catch (error) {
        console.error('GET Transactions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;