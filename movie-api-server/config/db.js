const mysql = require('mysql2/promise');
require('dotenv').config(); // โหลด .env

// สร้าง Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ทดสอบเชื่อมต่อ (ไม่บังคับ แต่แนะนำ)
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
    });

module.exports = pool; // ส่ง Pool ออกไปให้ไฟล์อื่นใช้