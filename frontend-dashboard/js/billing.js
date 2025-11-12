// js/billing.js (เวอร์ชัน Funds/Wallet 5 ระดับ)

const API_URL = 'https://kuayapi.com';

/**
 * ฟังก์ชันสำหรับ Logout
 */
function logout() {
    alert('You have been logged out.');
    localStorage.removeItem('movieApiToken');
    window.location.href = 'index.html'; 
}

// ฟังก์ชันจัดการการคลิกปุ่ม Top-up
async function handleTopUp(e) {
    e.preventDefault(); 
    
    const token = localStorage.getItem('movieApiToken');
    const button = e.currentTarget;
    const planKey = button.dataset.plan; // 👈 ดึง planKey (topup30, topup90, ฯลฯ)
    
    if (!token) {
        alert('Please login before adding funds.');
        window.location.href = 'index.html';
        return;
    }

    // แสดง Feedback
    button.textContent = 'Redirecting...';
    button.disabled = true;

    try {
        // 1. ยิง API ไปหา "หลังบ้าน"
        const response = await fetch(`${API_URL}/billing/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ planKey: planKey }) // 👈 ส่ง planKey
        });

        const data = await response.json();

        if (response.ok) {
            // 2. ส่งผู้ใช้ไปที่หน้าจ่ายเงินของ Stripe
            window.location.href = data.url;
        } else {
            alert(`Error: ${data.error}`);
            // รีเซ็ตปุ่ม
            button.textContent = 'Add Funds';
            button.disabled = false;
        }

    } catch (error) {
        console.error('Failed to create checkout session:', error);
        alert('Could not connect to the server. Please try again.');
        button.textContent = 'Add Funds';
        button.disabled = false;
    }
}


// --- 1. รอให้หน้าเว็บโหลด ---
document.addEventListener('DOMContentLoaded', () => {
    
    const topupButtons = document.querySelectorAll('.btn-topup'); // 👈 เลือกปุ่มทั้งหมดที่มี class 'btn-topup'
    const logoutButton = document.getElementById('logout-button');

    // 1.2) ผูก Event ให้ปุ่ม Top-up (ทุกปุ่ม)
    topupButtons.forEach(button => {
        button.addEventListener('click', handleTopUp);
    });

    // 1.3) ผูก Event ให้ปุ่ม Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});