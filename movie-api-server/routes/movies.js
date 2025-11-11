// /routes/movies.js
const express = require('express');
const pool = require('../config/db');
// ‼️ แก้ไข: ใช้ checkApiKey โดยตรง (เพราะเป็น middleware หลัก) ‼️
const checkApiKey = require('../middleware/checkApiKey'); 

const router = express.Router();

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

        // ‼️ Logic ที่แก้ไข: ใช้ req.keyData ที่แนบมาจาก Middleware ‼️
        // checkApiKey จะแนบ keyData มาถ้าผ่านการตรวจสอบ
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

    } catch (error) {
        console.error('Error fetching movie details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;