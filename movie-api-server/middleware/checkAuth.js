// /middleware/checkAuth.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. ดึง Token จาก Header
    // หน้าบ้าน (Frontend) ต้องส่งมาใน Header แบบ: Authorization: "Bearer <TOKEN>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // แยกเอาเฉพาะ <TOKEN>

    // 2. ถ้าไม่มี Token
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 3. ตรวจสอบ Token
    try {
        // ถอดรหัส Token โดยใช้ Secret Key
        const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);

        // 4. (สำคัญ!) ส่งข้อมูลผู้ใช้ (ที่ถอดรหัสได้) ไปกับ Request
        req.user = decodedPayload.user; // ตอนนี้ req.user.id จะมี ID ของคนที่ล็อกอิน
        
        next(); // อนุญาตให้ไปต่อได้

    } catch (ex) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};