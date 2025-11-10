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

        const [rows] = await pool.execute(
            'SELECT * FROM movies WHERE id = ?',
            [movieId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        const movie = rows[0];

        // ตอบกลับด้วย URL ของ CloudFront
        res.json({
            id: movie.id,
            title: movie.title,
            description: movie.description,
            stream_url: `${process.env.CLOUDFRONT_DOMAIN}${movie.s3_path}`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;