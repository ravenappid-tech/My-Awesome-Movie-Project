// /routes/movies.js
const express = require('express');
const pool = require('../config/db');
const checkApiKey = require('../middleware/checkApiKey'); 

const router = express.Router();
router.use(checkApiKey);

// --- GET /api/v1/movie/:movieId ---
router.get('/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const keyData = req.keyData;

        const [rows] = await pool.execute(
            'SELECT * FROM movies WHERE id = ?', [movieId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        const movie = rows[0];

        if (!movie.s3_path || !req.cloudfrontDomain) {
            return res.status(500).json({ error: 'Domain configuration missing.' });
        }

        // --- 1. ประกอบ Original URL (สำหรับ debug) ---
        const cleanDomain = req.cloudfrontDomain.endsWith('/') 
            ? req.cloudfrontDomain.slice(0, -1)
            : req.cloudfrontDomain;
        const cleanPath = movie.s3_path.startsWith('/') 
            ? movie.s3_path.slice(1)
            : movie.s3_path;

        // --- 2. ใช้ PROXY URL แทน ---
        const proxyBase = process.env.PROXY_BASE_URL || `http://localhost:${port}/hls`;
        const streamUrl = `${proxyBase}/${cleanPath}`;  // ผ่าน /hls

        console.log('Original CloudFront URL:', `${cleanDomain}/${cleanPath}`);
        console.log('Proxied Stream URL:', streamUrl);

        res.json({
            id: movie.id,
            title: movie.title,
            description: movie.description,
            stream_url: streamUrl
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;