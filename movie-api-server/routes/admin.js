// /routes/admin.js (ไฟล์เต็ม - รองรับการอัปโหลดไฟล์โปสเตอร์)
const express = require('express');
const pool = require('../config/db');
const checkAdmin = require('../middleware/checkAdmin'); // Import "ยาม" Admin
const AWS = require('aws-sdk'); // ‼️ (ใหม่) Import AWS SDK
const multer = require('multer'); // ‼️ (ใหม่) Import Multer
const multerS3 = require('multer-s3'); // ‼️ (ใหม่) Import Multer-S3
const path = require('path');

const router = express.Router();

// --- 1. ‼️ (ใหม่) ตั้งค่า AWS S3 Uploader ---
// (SDK จะดึง Key, Secret, Region, Bucket จากไฟล์ .env อัตโนมัติ)
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_S3_REGION
});

const s3 = new AWS.S3();

// (ตั้งค่า Multer S3)
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        acl: 'public-read', // ‼️ (สำคัญ!) ตั้งค่าไฟล์โปสเตอร์ให้ "สาธารณะ"
        contentType: multerS3.AUTO_CONTENT_TYPE, // ตรวจจับประเภทไฟล์อัตโนมัติ (image/jpeg)
        key: function (req, file, cb) {
            // สร้างชื่อไฟล์ใหม่ที่ไม่ซ้ำกัน
            // เช่น: posters/102_poster_1678886400000.jpg
            const movieId = req.body.id || req.params.movieId; // (ดึง ID จากฟอร์ม)
            const fileExt = path.extname(file.originalname);
            const fileName = `posters/${movieId}_poster_${Date.now()}${fileExt}`;
            cb(null, fileName);
        }
    })
});

// --- 2. ‼️ (ใหม่) Middleware สำหรับจัดการการอัปโหลด ‼️
// 'poster_file' คือชื่อ <input type="file" name="poster_file"> ใน HTML
const uploadMiddleware = upload.single('poster_file');

// --- 3. ใช้ "ยาม" Admin (checkAdmin) กับทุก API ในไฟล์นี้ ---
router.use(checkAdmin);

// ===================================================================
// 4. MOVIE MANAGEMENT (จัดการหนัง)
// ===================================================================

// --- GET /admin/movies (API สำหรับ "ดู" หนังทั้งหมด) ---
// (เหมือนเดิม)
router.get('/movies', async (req, res) => {
    try {
        const [movies] = await pool.execute(
            'SELECT id, title, description, s3_path, poster_url FROM movies ORDER BY id DESC'
        );
        res.json(movies);
    } catch (error) {
        console.error('Admin Get Movies error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- POST /admin/movies (API สำหรับ "เพิ่ม" หนัง - ‼️ แก้ไข ‼️) ---
router.post('/movies', uploadMiddleware, async (req, res) => {
    try {
        // (ข้อมูล Text จะมาจาก req.body)
        const { id, title, description, s3_path } = req.body;
        
        // (‼️ ไฟล์ที่อัปโหลด จะมาจาก req.file ‼️)
        const poster_url = req.file ? req.file.location : null; // .location คือ S3 URL

        if (!id || !title || !s3_path) {
            return res.status(400).json({ error: 'Movie ID, Title, and S3 Path are required.' });
        }

        const formattedPath = s3_path.startsWith('/') ? s3_path : `/${s3_path}`;

        await pool.execute(
            'INSERT INTO movies (id, title, description, s3_path, poster_url) VALUES (?, ?, ?, ?, ?)',
            [id, title, description, formattedPath, poster_url]
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

// --- PUT /admin/movies/:movieId (API สำหรับ "แก้ไข" หนัง - ‼️ แก้ไข ‼️) ---
router.put('/movies/:movieId', uploadMiddleware, async (req, res) => {
    try {
        const { movieId } = req.params;
        const { title, description, s3_path } = req.body;
        
        // (ถ้ามีการอัปโหลดไฟล์ใหม่ ไฟล์จะอยู่ที่ req.file)
        const new_poster_url = req.file ? req.file.location : req.body.poster_url; // (ถ้าไม่ส่งไฟล์ใหม่ ให้ใช้ URL เดิม)

        if (!title || !s3_path) {
            return res.status(400).json({ error: 'Title and S3 Path are required.' });
        }
        
        const formattedPath = s3_path.startsWith('/') ? s3_path : `/${s3_path}`;

        const [result] = await pool.execute(
            'UPDATE movies SET title = ?, description = ?, s3_path = ?, poster_url = ? WHERE id = ?',
            [title, description, formattedPath, new_poster_url, movieId]
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
// (เหมือนเดิม)
router.delete('/movies/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const [result] = await pool.execute('DELETE FROM movies WHERE id = ?', [movieId]);
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
// 5. USER MANAGEMENT (จัดการผู้ใช้ - ส่วนนี้เหมือนเดิม)
// ===================================================================

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

router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        const [keys] = await pool.execute('SELECT * FROM api_keys WHERE user_id = ?', [userId]);
        const userData = users[0];
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

router.put('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { first_name, last_name, phone, balance, is_admin, telegram_chat_id } = req.body;
        if (first_name === undefined || last_name === undefined || balance === undefined || is_admin === undefined) {
            return res.status(400).json({ error: 'Missing required fields (first_name, last_name, balance, is_admin)' });
        }
        await pool.execute(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, balance = ?, is_admin = ?, telegram_chat_id = ? WHERE id = ?',
            [first_name, last_name, phone, parseFloat(balance), Boolean(is_admin), telegram_chat_id, userId]
        );
        res.json({ message: `User ID ${userId} updated successfully.` });
    } catch (error) {
        console.error('Admin Update User error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
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