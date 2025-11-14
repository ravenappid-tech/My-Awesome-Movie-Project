// /routes/movies.js (ไฟล์เต็ม - แก้ไข require)
const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // 1. แก้ไข: ใช้ pool จาก config/db

// ‼️ (แก้ไข!) ‼️
// 2. ใช้ { checkApiKey } (ปีกกา) เพื่อดึง "ฟังก์ชัน" ออกจาก Object ที่ export มา
const { checkApiKey } = require('../middleware/checkApiKey'); 

// 3. (ลบการ import ที่ไม่จำเป็นออก)

// ใช้ "ยาม" (checkApiKey) กับทุก API ในไฟล์นี้
router.use(checkApiKey);

// --- GET /api/v1/movie/:movieId ---
router.get('/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;

        // 1. ดึงข้อมูลหนังจาก Database
        const [rows] = await pool.execute(
            'SELECT * FROM movies WHERE id = ?',
            [movieId]
        );

        // (req.keyData ถูกแนบมาจาก checkApiKey.js)
        const keyData = req.keyData; 

        if (rows.length === 0) {
            console.warn(`Movie API: Movie ID ${movieId} not found in DB.`);
            return res.status(404).json({ error: 'Movie not found' });
        }
        const movie = rows[0];

        // 2. การตรวจสอบ URL ที่สำคัญ 
        if (!movie.s3_path || !req.cloudfrontDomain) {
            console.error(`ERROR: CLOUDFRONT_DOMAIN is missing (Loaded from .env).`);
            return res.status(500).json({ error: 'Internal Server Error: Domain configuration missing.' });
        }
        
        // 3. ประกอบ URL ที่สมบูรณ์ (Path Cleaning Logic)
        const cleanDomain = req.cloudfrontDomain.endsWith('/') 
                            ? req.cloudfrontDomain.slice(0, -1)
                            : req.cloudfrontDomain;
        const cleanPath = movie.s3_path.startsWith('/')
                          ? movie.s3_path.slice(1)
                          : movie.s3_path;

        const streamUrl = `${cleanDomain}/${cleanPath}`; 

        console.log('DEBUG: Final Stream URL sent:', streamUrl); 

        // 4. ตอบกลับด้วย URL ของ CloudFront
        res.json({
            id: movie.id,
            title: movie.title,
            description: movie.description,
            stream_url: streamUrl // ส่ง URL ที่สมบูรณ์กลับไป
        });
        
        // 5. (เราไม่ต้อง Log ที่นี่ เพราะ checkApiKey จัดการแล้ว)

    } catch (error) {
        console.error('Error fetching movie details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;