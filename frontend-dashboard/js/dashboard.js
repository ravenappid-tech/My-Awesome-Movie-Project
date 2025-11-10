// js/dashboard.js

const API_URL = 'http://localhost:3001';

// --- 1. ดึงข้อมูลผู้ใช้และ Keys ทันทีที่หน้าโหลด ---
document.addEventListener('DOMContentLoaded', () => {
    // 1.1) ดึง Token (ตั๋ว) ที่เก็บไว้
    const token = localStorage.getItem('movieApiToken');

    // 1.2) ถ้าไม่มี Token (ยังไม่ได้ล็อกอิน) ให้เด้งกลับไปหน้า Login
    if (!token) {
        alert('Please login to access the dashboard.');
        window.location.href = 'index.html';
        return;
    }

    // 1.3) ถ้ามี Token ให้ไปดึงข้อมูลสถิติและ API Keys
    fetchDashboardStats(token);
    fetchApiKeys(token);

    // 1.4) ผูก Event ให้ปุ่ม (สร้าง Key, Logout)
    document.getElementById('create-key-btn').addEventListener('click', () => createNewKey(token));
    document.getElementById('logout-button').addEventListener('click', logout);
});

// --- 2. ฟังก์ชัน: ดึงข้อมูลสถิติ (Stats) ---
async function fetchDashboardStats(token) {
    try {
        const response = await fetch(`${API_URL}/dashboard/stats`, {
            method: 'GET',
            headers: {
                // (สำคัญ!) ส่ง "ตั๋ว" (Token) ไปใน Header
                'Authorization': `Bearer ${token}` 
            }
        });

        if (!response.ok) {
            // ถ้า Token หมดอายุ หรือไม่ถูกต้อง
            if (response.status === 401 || response.status === 400) logout();
            throw new Error('Could not fetch stats');
        }

        const stats = await response.json();

        // เอาข้อมูลไปใส่ใน HTML
        document.getElementById('user-email').textContent = stats.email;
        document.getElementById('quota-used').textContent = stats.totalUsage;
        document.getElementById('quota-limit').textContent = stats.quotaLimit;
        document.getElementById('active-keys-count').textContent = stats.totalKeys;

    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// --- 3. ฟังก์ชัน: ดึง API Keys ทั้งหมด ---
async function fetchApiKeys(token) {
    try {
        const response = await fetch(`${API_URL}/dashboard/keys`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 400) logout();
            throw new Error('Could not fetch keys');
        }

        const keys = await response.json();
        
        // เอาข้อมูลไปแสดงผล
        renderApiKeys(keys);

    } catch (error) {
        console.error('Error fetching keys:', error);
    }
}

// --- 4. ฟังก์ชัน: แสดงผล API Keys (สร้าง HTML) ---
function renderApiKeys(keys) {
    const listElement = document.getElementById('api-keys-list');
    
    // ลบข้อความ "Loading..."
    listElement.innerHTML = ''; 

    if (keys.length === 0) {
        listElement.innerHTML = '<p class="text-center text-gray-400">You have not created any API keys yet.</p>';
        return;
    }

    // วน Loop สร้าง Card HTML สำหรับแต่ละ Key
    keys.forEach(key => {
        const keyCard = document.createElement('div');
        keyCard.className = 'bg-gray-700 p-4 rounded-md flex justify-between items-center';
        keyCard.innerHTML = `
            <div>
                <p class="text-sm text-gray-400">Key (ID: ${key.id}):</p>
                <code class="text-lg text-indigo-300">${key.api_key}</code>
                <p class="text-sm text-gray-400 mt-1">Usage: ${key.quota_used} / ${key.quota_limit}</p>
            </div>
            <button 
                class="text-red-400 hover:text-red-300 font-medium" 
                onclick="deleteApiKey(${key.id}, '${key.api_key.substring(0, 10)}...')"
            >
                Delete
            </button>
        `;
        listElement.appendChild(keyCard);
    });
}

// --- 5. ฟังก์ชัน: สร้าง Key ใหม่ (เมื่อกดปุ่ม) ---
async function createNewKey(token) {
    if (!confirm('Are you sure you want to create a new API key?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/dashboard/keys`, {
            method: 'POST', // ยิงไปที่ POST /dashboard/keys
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Could not create key');
        
        // สร้างสำเร็จ
        alert('New API Key created successfully!');
        fetchApiKeys(token); // โหลดรายการ Key ใหม่
        fetchDashboardStats(token); // อัปเดตสถิติ (จำนวน Key)
        
    } catch (error) {
        console.error('Error creating key:', error);
        alert('Error creating key.');
    }
}

// --- 6. ฟังก์ชัน: ลบ Key (เมื่อกดปุ่ม) ---
// (เราต้องสร้างฟังก์ชันนี้ไว้นอกสุดเพื่อให้ onclick ใน HTML เรียกได้)
async function deleteApiKey(keyId, keyPrefix) {
    if (!confirm(`Are you sure you want to delete key ${keyPrefix}? This action cannot be undone.`)) {
        return;
    }

    const token = localStorage.getItem('movieApiToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/dashboard/keys/${keyId}`, { // ยิงไปที่ DELETE /dashboard/keys/:keyId
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Could not delete key');

        // ลบสำเร็จ
        alert('API Key deleted successfully!');
        fetchApiKeys(token); // โหลดรายการ Key ใหม่
        fetchDashboardStats(token); // อัปเดตสถิติ

    } catch (error) {
        console.error('Error deleting key:', error);
        alert('Error deleting key.');
    }
}

// --- 7. ฟังก์ชัน: Logout ---
function logout() {
    alert('You have been logged out.');
    localStorage.removeItem('movieApiToken'); // ลบ "ตั๋ว" ทิ้ง
    window.location.href = 'index.html'; // กลับไปหน้า Login
}