// /middleware/checkAdmin.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const checkAdmin = async (req, res, next) => {
    // 1. ตรวจสอบ Token (เหมือน checkAuth)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    let decodedPayload;
    try {
        decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (ex) {
        return res.status(400).json({ error: 'Invalid token.' });
    }

    try {
        // 2. (สำคัญ!) ตรวจสอบสิทธิ์ Admin ใน Database
        const userId = decodedPayload.user.id;
        
        const [users] = await pool.execute(
            'SELECT is_admin FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // 3. ถ้าไม่ใช่ Admin (is_admin = false หรือ 0)
        if (!users[0].is_admin) {
            return res.status(403).json({ error: 'Forbidden. Admin access required.' });
        }

        // 4. ถ้าเป็น Admin -> อนุญาตให้ไปต่อ
        req.user = decodedPayload.user; // ส่งข้อมูล User ไปยัง API
        next();

    } catch (error) {
        console.error('checkAdmin Middleware error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = checkAdmin;