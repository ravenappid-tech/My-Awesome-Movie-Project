// /middleware/checkApiKey.js (ไฟล์เต็ม - แก้ไข module.exports)
const pool = require('../config/db');

// ‼️ (สำคัญ!) กำหนดราคาต่ออายุรายเดือน
const MONTHLY_RENEWAL_COST = 30.00; // (เราจะใช้ราคานี้เป็น "ค่าสร้าง" ด้วย)

async function checkApiKey(req, res, next) {
    const key = req.headers['x-api-key']; 

    if (!key) {
        return res.status(401).json({ error: 'Missing API Key' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. ค้นหา Key, เจ้าของ, Balance, และ วันหมดอายุ
        const [rows] = await connection.execute(
            `SELECT 
                k.id AS key_id, 
                k.expires_at AS key_expires,
                u.id AS user_id, 
                u.email AS user_email, 
                u.balance AS user_balance
             FROM api_keys k
             JOIN users u ON k.user_id = u.id
             WHERE k.api_key = ? AND k.status = 'active'`,
            [key]
        );

        if (rows.length === 0) {
            connection.release();
            return res.status(403).json({ error: 'Invalid or inactive API Key' });
        }

        const data = rows[0];
        const currentBalance = parseFloat(data.user_balance);
        const expiresAt = data.key_expires;
        const keyId = data.key_id;
        const userId = data.user_id;
        let renewalOccurred = false;

        // 2. ตรวจสอบ: Key หมดอายุหรือยัง
        if (expiresAt && new Date(expiresAt) < new Date()) {
            
            // 3. ถ้าหมดอายุ: ตรวจสอบ Balance เพื่อต่ออายุอัตโนมัติ
            if (currentBalance >= MONTHLY_RENEWAL_COST) {
                
                const newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
                
                try {
                    await connection.beginTransaction();

                    // หักเงิน (UPDATE users)
                    await connection.execute(
                        "UPDATE users SET balance = balance - ? WHERE id = ?",
                        [MONTHLY_RENEWAL_COST, userId]
                    );
                    
                    // ต่ออายุ Key (UPDATE api_keys)
                    await connection.execute(
                        "UPDATE api_keys SET expires_at = ? WHERE id = ?",
                        [newExpiryDate, keyId]
                    );

                    // บันทึกประวัติ (Debit)
                    await connection.execute(
                        "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'debit', ?, ?)",
                        [userId, MONTHLY_RENEWAL_COST, `Auto-renewal for API Key ID: ${keyId}`]
                    );

                    await connection.commit();
                } catch (dbError) {
                    await connection.rollback();
                    throw dbError; 
                }
                
                renewalOccurred = true;
                console.log(`✅ Auto-Renewal: Key ${keyId} renewed for ${MONTHLY_RENEWAL_COST} from balance. New Expiry: ${newExpiryDate.toISOString()}`);
                
            } else {
                // 4. ถ้าหมดอายุและเงินไม่พอ: บล็อกการใช้งาน
                connection.release();
                return res.status(402).json({ 
                    error: `Key expired. Insufficient funds (${currentBalance.toFixed(2)}) for automatic renewal (${MONTHLY_RENEWAL_COST.toFixed(2)}).`,
                    status: 'EXPIRED_FUNDS_LOW',
                    user_email: data.user_email,
                    current_balance: currentBalance.toFixed(4)
                });
            }
        }
        
        // 5. อนุญาตให้ API ทำงานต่อ
        req.keyData = { 
            id: keyId,
            status: 'ACTIVE',
            renewal_status: renewalOccurred ? 'RENEWED' : 'NOT_DUE',
            user_id: userId,
            user_email: data.user_email,
            user_balance: renewalOccurred ? currentBalance - MONTHLY_RENEWAL_COST : currentBalance
        };
        next(); 

    } catch (error) {
        console.error('API Key check error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (connection) connection.release();
    }
}

// ‼️ (แก้ไข!) เรา Export ทั้งฟังก์ชันและค่าคงที่ ‼️
module.exports = {
    checkApiKey,
    MONTHLY_RENEWAL_COST 
};