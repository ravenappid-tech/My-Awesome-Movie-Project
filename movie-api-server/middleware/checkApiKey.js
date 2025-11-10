// /middleware/checkApiKey.js
// นี่คือ "ยาม" สำหรับ API ที่คุณ "ขาย"
const pool = require('../config/db');

async function checkApiKey(req, res, next) {
    const key = req.headers['x-api-key']; // Key ที่ลูกค้าส่งมา

    if (!key) {
        return res.status(401).json({ error: 'Missing API Key' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM api_keys WHERE api_key = ?',
            [key]
        );
        if (rows.length === 0) {
            return res.status(403).json({ error: 'Invalid API Key' });
        }

        const apiKeyData = rows[0];

        if (apiKeyData.status !== 'active') {
            return res.status(403).json({ error: 'API Key is inactive' });
        }
        if (apiKeyData.quota_used >= apiKeyData.quota_limit) {
            return res.status(429).json({ error: 'Quota limit exceeded' });
        }

        // (สำคัญ) นับโควต้า
        // เราจะนับแบบ "Fire and Forget" (ไม่รอให้เสร็จ) เพื่อให้ API ตอบกลับเร็วขึ้น
        pool.execute(
            'UPDATE api_keys SET quota_used = quota_used + 1 WHERE id = ?',
            [apiKeyData.id]
        );
        
        next(); // ไปต่อ

    } catch (error) {
        console.error('API Key check error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = checkApiKey;