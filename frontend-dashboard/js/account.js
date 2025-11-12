// js/account.js
const API_URL = 'https://kuayapi.com';

// --- 1. รอให้หน้าเว็บโหลด ---
document.addEventListener('DOMContentLoaded', () => {
    // 1.1) ตรวจสอบ Token (เหมือนเดิม)
    const token = localStorage.getItem('movieApiToken');
    if (!token) {
        alert('Please login to access settings.');
        window.location.href = 'index.html';
        return;
    }

    // 1.2) ดึง Element ของฟอร์มทั้งสอง
    const telegramForm = document.getElementById('telegram-link-form');
    const passwordForm = document.getElementById('change-password-form');
    const logoutButton = document.getElementById('logout-button');

    // 1.3) ผูก Event ให้ฟอร์ม Telegram
    telegramForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLinkTelegram(token);
    });

    // 1.4) ผูก Event ให้ฟอร์มเปลี่ยนรหัสผ่าน
    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangePassword(token);
    });
    
    // 1.5) ผูก Event ให้ปุ่ม Logout
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('movieApiToken');
        window.location.href = 'index.html';
    });
});

// --- 2. ฟังก์ชัน: จัดการการเชื่อม Telegram ---
async function handleLinkTelegram(token) {
    const chatId = document.getElementById('telegram-chat-id').value;
    const messageEl = document.getElementById('telegram-message');
    
    messageEl.textContent = 'Linking... Please wait.';
    messageEl.className = "text-gray-400 mt-0"; // สีปกติ

    try {
        const response = await fetch(`${API_URL}/dashboard/link-telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ chatId })
        });

        const data = await response.json();
        if (response.ok) {
            messageEl.textContent = data.message;
            messageEl.className = "text-green-400 mt-0"; // สีเขียว
            document.getElementById('telegram-chat-id').value = ''; // ล้างช่อง input
        } else {
            // ข้อความ Error มาจาก Backend
            messageEl.textContent = `Error: ${data.error}`;
            messageEl.className = "text-red-400 mt-0"; // สีแดง
        }
    } catch (error) {
        // (นี่คือ Error ที่คุณเจอ!)
        console.error('Network or server error:', error);
        messageEl.textContent = 'Failed to connect to server. Please check your network or try again later.';
        messageEl.className = "text-red-400 mt-0";
    }
}

// --- 3. ฟังก์ชัน: จัดการการเปลี่ยนรหัสผ่าน ---
async function handleChangePassword(token) {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const messageEl = document.getElementById('password-message');

    // 3.1) ตรวจสอบว่ารหัสใหม่ตรงกัน
    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'New passwords do not match!';
        messageEl.className = "text-red-400 mt-4";
        return;
    }

    messageEl.textContent = 'Updating...';
    messageEl.className = "text-gray-400 mt-4";

    // 3.2) ยิง API ไปหลังบ้าน
    try {
        const response = await fetch(`${API_URL}/dashboard/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = data.message;
            messageEl.className = "text-green-400 mt-4";
            // ล้างฟอร์ม
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';
        } else {
            messageEl.textContent = `Error: ${data.error}`;
            messageEl.className = "text-red-400 mt-4";
        }

    } catch (error) {
        messageEl.textContent = 'Failed to connect to server.';
        messageEl.className = "text-red-400 mt-4";
    }
}