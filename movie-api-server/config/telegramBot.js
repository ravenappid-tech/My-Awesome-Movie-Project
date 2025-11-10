// config/telegramBot.js
const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * ฟังก์ชันสำหรับส่งข้อความ Telegram
 */
const sendTelegramMessage = async (chatId, text) => { 
    try {
        // (‼️ ลบ parse_mode ออกทั้งหมด ‼️)
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
        });
        console.log('Telegram message sent to:', chatId);
    } catch (error) {
        console.error('Error sending Telegram message:', error.response ? error.response.data : error.message);
    }
};

/**
 * ฟังก์ชันสำหรับส่งลิงก์รีเซ็ตรหัสผ่าน
 */
const sendPasswordResetTelegram = async (chatId, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    
    // ‼️ นี่คือส่วนที่แก้ไข ‼️
    // เราจะส่ง URL ดิบๆ ไปในข้อความเลย
    // Telegram จะสร้างลิงก์ให้เองอัตโนมัติ
    
    const message = `You requested a password reset for your Movie API account.

Please click the link below to reset your password. This link is valid for 1 hour:

${resetUrl}

If you did not request this, please ignore this message.`;

    await sendTelegramMessage(chatId, message);
};

module.exports = { sendPasswordResetTelegram, sendTelegramMessage };