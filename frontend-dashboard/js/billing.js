// js/billing.js

const API_URL = 'http://localhost:3001';

/**
 * ฟังก์ชันสำหรับ Logout
 */
function logout() {
    alert('You have been logged out.');
    localStorage.removeItem('movieApiToken'); // ลบ "ตั๋ว" ทิ้ง
    window.location.href = 'index.html'; // กลับไปหน้า Login
}

// --- 1. รอให้หน้าเว็บโหลด ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1.1) ดึง Token (ตั๋ว) ที่เก็บไว้
    const token = localStorage.getItem('movieApiToken');

    // 1.2) ดึงปุ่มต่างๆ
    const upgradeButton = document.getElementById('upgrade-to-pro-btn');
    const logoutButton = document.getElementById('logout-button');

    // 1.3) ผูก Event ให้ปุ่ม Upgrade
    if (upgradeButton) {
        upgradeButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // ตรวจสอบก่อนว่าล็อกอินหรือยัง
            if (!token) {
                alert('Please login before upgrading.');
                window.location.href = 'index.html';
                return;
            }

            // แสดง Feedback ให้ผู้ใช้รู้ว่ากำลังทำงาน
            upgradeButton.textContent = 'Redirecting to payment...';
            upgradeButton.disabled = true;

            try {
                // 1.4) ยิง API ไปหา "หลังบ้าน" เพื่อขอหน้าจ่ายเงิน
                const response = await fetch(`${API_URL}/billing/create-checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // (สำคัญ!) ส่ง "ตั๋ว" ไปด้วย
                    }
                    // (เราไม่ต้องส่ง Body อะไรไป เพราะหลังบ้านรู้ Plan จากโค้ด และรู้ User จาก Token)
                });

                const data = await response.json();

                if (response.ok) {
                    // 1.5) ถ้าสำเร็จ: ส่งผู้ใช้ไปที่หน้าจ่ายเงินของ Stripe
                    window.location.href = data.url;
                } else {
                    // ถ้าหลังบ้านมีปัญหา (เช่น Stripe Key ผิด)
                    alert(`Error: ${data.error}`);
                    upgradeButton.textContent = 'Upgrade to Pro';
                    upgradeButton.disabled = false;
                }

            } catch (error) {
                // ถ้าเชื่อมต่อ Server ไม่ได้เลย
                console.error('Failed to create checkout session:', error);
                alert('Could not connect to the server. Please try again.');
                upgradeButton.textContent = 'Upgrade to Pro';
                upgradeButton.disabled = false;
            }
        });
    }

    // 1.6) ผูก Event ให้ปุ่ม Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});