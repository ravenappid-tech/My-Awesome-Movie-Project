// /routes/admin.js (ไฟล์เต็ม - จัดการทั้งหนังและผู้ใช้)
const express = require('express');
const pool = require('../config/db');
const checkAdmin = require('../middleware/checkAdmin'); // Import "ยาม" Admin

const router = express.Router();

// ‼️ ใช้ "ยาม" Admin (checkAdmin) กับทุก API ในไฟล์นี้ ‼️
router.use(checkAdmin);

// ===================================================================
// 1. MOVIE MANAGEMENT (จัดการหนัง)
// ===================================================================

// --- GET /admin/movies (API สำหรับ "ดู" หนังทั้งหมด) ---
router.get('/movies', async (req, res) => {
    try {
        const [movies] = await pool.execute(
            'SELECT * FROM movies ORDER BY id DESC'
        );
        res.json(movies);
    } catch (error) {
        console.error('Admin Get Movies error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- POST /admin/movies (API สำหรับ "เพิ่ม" หนัง) ---
router.post('/movies', async (req, res) => {
    try {
        const { id, title, description, s3_path } = req.body;

        if (!id || !title || !s3_path) {
            return res.status(400).json({ error: 'Movie ID, Title, and S3 Path are required.' });
        }

        // (ตรวจสอบว่า s3_path ขึ้นต้นด้วย /)
        const formattedPath = s3_path.startsWith('/') ? s3_path : `/${s3_path}`;

        await pool.execute(
            'INSERT INTO movies (id, title, description, s3_path) VALUES (?, ?, ?, ?)',
            [id, title, description, formattedPath]
        );

        res.status(201).json({ message: `Movie ID ${id} (${title}) added successfully.` });

    } catch (error) {
        console.error('Admin Add Movie error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Movie ID already exists.' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- PUT /admin/movies/:movieId (API สำหรับ "แก้ไข" หนัง) ---
router.put('/movies/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const { title, description, s3_path } = req.body;

        if (!title || !s3_path) {
            return res.status(400).json({ error: 'Title and S3 Path are required.' });
        }
        
        const formattedPath = s3_path.startsWith('/') ? s3_path : `/${s3_path}`;

        const [result] = await pool.execute(
            'UPDATE movies SET title = ?, description = ?, s3_path = ? WHERE id = ?',
            [title, description, formattedPath, movieId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Movie ID not found.' });
        }

        res.json({ message: `Movie ID ${movieId} updated successfully.` });

    } catch (error) {
        console.error('Admin Update Movie error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- DELETE /admin/movies/:movieId (API สำหรับ "ลบ" หนัง) ---
router.delete('/movies/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM movies WHERE id = ?',
            [movieId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Movie ID not found.' });
        }

        res.json({ message: `Movie ID ${movieId} deleted successfully.` });

    } catch (error) {
        console.error('Admin Delete Movie error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ===================================================================
// 2. USER MANAGEMENT (จัดการผู้ใช้ - นี่คือส่วน "ควบคุม" ที่คุณต้องการ)
// ===================================================================

// --- GET /admin/users (API สำหรับ "ดู" ผู้ใช้ทั้งหมด) ---
router.get('/users', async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, balance, telegram_chat_id, is_admin, created_at FROM users ORDER BY id DESC'
        );
        res.json(users);
    } catch (error) {
        console.error('Admin Get Users error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- GET /admin/users/:userId (API สำหรับ "ดู" ผู้ใช้คนเดียว + API Keys ของเขา) ---
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const [keys] = await pool.execute('SELECT * FROM api_keys WHERE user_id = ?', [userId]);

        const userData = users[0];
        // (เราไม่ส่ง password_hash กลับไป)
        delete userData.password_hash;
        
        res.json({
            user_details: userData,
            api_keys: keys
        });

    } catch (error) {
        console.error('Admin Get User Details error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- PUT /admin/users/:userId (API สำหรับ "แก้ไข" ผู้ใช้) ---
// (นี่คือส่วนที่ Admin "ควบคุม" ผู้ใช้ เช่น เติมเงินให้, แต่งตั้ง Admin)
router.put('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { first_name, last_name, phone, balance, is_admin, telegram_chat_id } = req.body;

        // ตรวจสอบข้อมูลขั้นพื้นฐาน
        if (first_name === undefined || last_name === undefined || balance === undefined || is_admin === undefined) {
            return res.status(400).json({ error: 'Missing required fields (first_name, last_name, balance, is_admin)' });
        }

        await pool.execute(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, balance = ?, is_admin = ?, telegram_chat_id = ? WHERE id = ?',
            [
                first_name, 
                last_name, 
                phone, 
                parseFloat(balance), 
                Boolean(is_admin), 
                telegram_chat_id, 
                userId
            ]
        );

        res.json({ message: `User ID ${userId} updated successfully.` });

    } catch (error) {
        console.error('Admin Update User error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- DELETE /admin/users/:userId (API สำหรับ "ลบ" ผู้ใช้) ---
router.delete('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // (เนื่องจากเราตั้งค่า ON DELETE CASCADE, การลบ User จะลบ api_keys และ transactions ของเขาด้วย)
        const [result] = await pool.execute(
            'DELETE FROM users WHERE id = ?',
            [userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User ID not found.' });
        }

        res.json({ message: `User ID ${userId} and all associated data deleted successfully.` });

    } catch (error) {
        console.error('Admin Delete User error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = router;