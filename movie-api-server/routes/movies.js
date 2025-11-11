// /routes/movies.js
const express = require('express');
const pool = require('../config/db');
const checkApiKey = require('../middleware/checkApiKey'); // Import "ยาม"

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

        if (rows.length === 0) {
            console.warn(`Movie API: Movie ID ${movieId} not found in DB.`);
            return res.status(404).json({ error: 'Movie not found' });
        }
        const movie = rows[0];

        // 2. ‼️ การตรวจสอบ URL ที่สำคัญ ‼️
        if (!movie.s3_path) {
            console.error(`ERROR: Movie ID ${movieId} has an empty s3_path in the database.`);
            return res.status(500).json({ error: 'Internal Server Error: Missing S3 path data.' });
        }
        
        // 3. ประกอบ URL ที่สมบูรณ์
        // เราใช้ process.env.CLOUDFRONT_DOMAIN เพื่อให้ URL สมบูรณ์
        const streamUrl = `${process.env.CLOUDFRONT_DOMAIN}${movie.s3_path}`;

        // (DEBUG: แสดง URL ที่กำลังจะส่งใน Terminal)
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