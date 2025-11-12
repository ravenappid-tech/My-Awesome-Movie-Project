// js/auth.js (เวอร์ชันเต็ม)

const API_URL = 'https://kuayapi.com';

// รอให้หน้าเว็บโหลดเสร็จก่อน
document.addEventListener('DOMContentLoaded', () => {
    
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form'); 
    const forgotPasswordForm = document.getElementById('forgot-password-form'); // 👈 ใหม่
    const resetPasswordForm = document.getElementById('reset-password-form');   // 👈 ใหม่

    // 1. --- จัดการฟอร์มสมัครสมาชิก ---
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
                    window.location.href = 'index.html'; 
                } else {
                    alert(`Error: ${data.error}`);
                }
            } catch (error) {
                console.error('Registration failed:', error);
                alert('Could not connect to the server.');
            }
        });
    }

    // 2. --- จัดการฟอร์มล็อกอิน ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('movieApiToken', data.token);
                    window.location.href = 'dashboard.html'; 
                } else {
                    alert(`Error: ${data.error}`);
                }
            } catch (error) {
                console.error('Login failed:', error);
                alert('Could not connect to the server.');
            }
        });
    }

    // 3. --- ‼️ โค้ดใหม่: จัดการฟอร์มลืมรหัสผ่าน ---
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const messageEl = document.getElementById('message');
            messageEl.textContent = 'Sending request...';
            
            try {
                const response = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    messageEl.textContent = data.message;
                    messageEl.className = "text-center text-green-400 mt-4";
                } else {
                    messageEl.textContent = data.error; // (จะแสดง Error ที่เราเขียนไว้ เช่น "Please link Telegram...")
                    messageEl.className = "text-center text-red-400 mt-4";
                }
            } catch (error) {
                console.error('Forgot password failed:', error);
                messageEl.textContent = 'Could not connect to the server.';
                messageEl.className = "text-center text-red-400 mt-4";
            }
        });
    }

    // 4. --- ‼️ โค้ดใหม่: จัดการฟอร์มรีเซ็ตรหัสผ่าน ---
    if (resetPasswordForm) {
        // 4.1) ดึง Token จาก URL มาใส่ในฟอร์ม
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (!token) {
            document.getElementById('message').textContent = 'Invalid or missing reset token.';
        }
        document.getElementById('reset-token').value = token;
        
        // 4.2) ดักจับการ Submit
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const token = document.getElementById('reset-token').value;
            const messageEl = document.getElementById('message');

            if (password !== confirmPassword) {
                messageEl.textContent = 'Passwords do not match!';
                return;
            }
            if (!token) {
                messageEl.textContent = 'Invalid or missing reset token.';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password }),
                });
                
                const data = await response.json();

                if (response.ok) {
                    alert('Password reset successful! Please login.');
                    window.location.href = 'index.html';
                } else {
                    messageEl.textContent = data.error;
                }
            } catch (error) {
                console.error('Reset password failed:', error);
                messageEl.textContent = 'Could not connect to the server.';
                messageEl.className = "text-center text-red-400 mt-4";
            }
        });
    }
});