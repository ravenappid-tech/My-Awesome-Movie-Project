// js/auth.js

// นี่คือ "ที่อยู่" ของ API หลังบ้านของเรา
const API_URL = 'http://localhost:3001';

// รอให้หน้าเว็บโหลดเสร็จก่อน
document.addEventListener('DOMContentLoaded', () => {
    
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form'); // 👈 เพิ่มตัวแปรฟอร์มล็อกอิน

    // 1. --- (โค้ดเดิม) จัดการฟอร์มสมัครสมาชิก ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();
                if (response.ok) {
                    alert('Registration successful! Please login.');
                    window.location.href = 'index.html'; // 👈 แก้ Path ให้ไม่มี /
                } else {
                    alert(`Error: ${data.error}`);
                }
            } catch (error) {
                console.error('Registration failed:', error);
                alert('Could not connect to the server.');
            }
        });
    }

    // 2. --- (โค้ดใหม่) จัดการฟอร์มล็อกอิน ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // หยุดไม่ให้ฟอร์มโหลดหน้าใหม่

            // 2.1 ดึงข้อมูลจากฟอร์ม
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // 2.2 ส่งข้อมูลไปหา API หลังบ้าน (Backend)
            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    // ถ้าล็อกอินสำเร็จ
                    alert('Login successful! Redirecting to dashboard...');
                    
                    // 2.3 (สำคัญมาก!) เก็บ "ตั๋ว" (Token) ไว้ใน browser
                    localStorage.setItem('movieApiToken', data.token);
                    
                    // 2.4 ส่งไปหน้า Dashboard
                    window.location.href = 'dashboard.html'; // 👈 แก้ Path ให้ไม่มี /
                } else {
                    // ถ้าไม่สำเร็จ (เช่น รหัสผ่านผิด)
                    alert(`Error: ${data.error}`);
                }

            } catch (error) {
                console.error('Login failed:', error);
                alert('Could not connect to the server.');
            }
        });
    }
});