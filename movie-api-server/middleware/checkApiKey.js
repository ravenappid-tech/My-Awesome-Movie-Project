// /middleware/checkApiKey.js (เวอร์ชัน Funds/Wallet ที่ส่ง Balance เมื่อเงินหมด)
const pool = require('../config/db');

// ‼️ (สำคัญ!) กำหนดราคาต่อการเรียก API 1 ครั้ง (ต้องตรงกับที่คุณตั้ง)
const COST_PER_CALL = 0.0001; // (เช่น $0.0001)

async function checkApiKey(req, res, next) {
    const key = req.headers['x-api-key']; 

    if (!key) {
        return res.status(401).json({ error: 'Missing API Key' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. ค้นหา Key และ "เจ้าของ" (User)
        const [rows] = await connection.execute(
            `SELECT 
                k.id AS key_id, 
                u.id AS user_id, 
                u.email AS user_email, 
                u.balance AS user_balance
             FROM api_keys k
             JOIN users u ON k.user_id = u.id
             WHERE k.api_key = ? AND k.status = 'active'`,
            [key]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: 'Invalid or inactive API Key' });
        }

        const data = rows[0];
        const currentBalance = data.user_balance;
        const userId = data.user_id;

        // 2. (‼️ Logic ใหม่!) ตรวจสอบยอดเงินคงเหลือ
        if (currentBalance < COST_PER_CALL) {
            // (สำคัญ!) 402 = Payment Required
            // ‼️ แก้ไข: ส่งข้อมูล Balance และ Email กลับไป ‼️
            return res.status(402).json({ 
                error: 'Insufficient funds. Please top-up your wallet.',
                status: 'INSUFFICIENT_FUNDS', // เพิ่มสถานะเพื่อให้ Frontend ดักจับง่าย
                user_email: data.user_email,
                current_balance: parseFloat(currentBalance).toFixed(4),
                cost_per_call: COST_PER_CALL
            });
        }

        // 3. หักเงินออกจาก Balance (Fire-and-forget)
        pool.execute(
            "UPDATE users SET balance = balance - ? WHERE id = ?",
            [COST_PER_CALL, userId]
        );
        
        // (แนบข้อมูลผู้ใช้ไปกับ req สำหรับใช้ใน route อื่นๆ)
        req.user = { 
            id: userId,
            email: data.user_email,
            balance: currentBalance - COST_PER_CALL 
        };
        
        next(); // อนุญาตให้ API ทำงานต่อ

    } catch (error) {
        console.error('API Key check error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = checkApiKey;