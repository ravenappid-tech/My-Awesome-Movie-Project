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
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML' // เราจะส่งลิงก์แบบ HTML
        });
        console.log('Telegram message sent to:', chatId);
    } catch (error) {
        // แสดง error ให้ละเอียดขึ้น
        console.error('Error sending Telegram message:', error.response ? error.response.data : error.message);
    }
};

/**
 * ฟังก์ชันสำหรับส่งลิงก์รีเซ็ตรหัสผ่าน
 */
const sendPasswordResetTelegram = async (chatId, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    const message = `
You requested a password reset for your Movie API account.

Please click the link below to reset your password. This link is valid for 1 hour.

<a href="${resetUrl}">Reset Your Password</a>

If you did not request this, please ignore this message.
    `;
    await sendTelegramMessage(chatId, message);
};

module.exports = { sendPasswordResetTelegram, sendTelegramMessage };