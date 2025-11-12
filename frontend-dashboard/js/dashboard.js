// js/dashboard.js (ไฟล์เต็ม - แก้ไข fetchDashboardStats และ createNewKey)

const API_URL = 'http://localhost:3001';

/**
 * ฟังก์ชันสำหรับ Logout
 */
function logout() {
    alert('You have been logged out.');
    localStorage.removeItem('movieApiToken'); 
    window.location.href = 'index.html'; 
}

// --- 1. ดึงข้อมูลผู้ใช้และ Keys ทันทีที่หน้าโหลด ---
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('movieApiToken');
    if (!token) {
        alert('Please login to access the dashboard.');
        window.location.href = 'index.html';
        return;
    }

    fetchDashboardStats(token);
    fetchApiKeys(token);

    document.getElementById('create-key-btn').addEventListener('click', () => createNewKey(token));
    document.getElementById('logout-button').addEventListener('click', logout);
});

// --- 2. ฟังก์ชัน: ดึงข้อมูลสถิติ (Stats) (‼️ แก้ไข ‼️) ---
async function fetchDashboardStats(token) {
    try {
        const response = await fetch(`${API_URL}/dashboard/stats`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 400) logout();
            throw new Error('Could not fetch stats');
        }

        const stats = await response.json();

        document.getElementById('user-email').textContent = stats.email;
        document.getElementById('user-balance').textContent = stats.balance; 
        document.getElementById('active-keys-count').textContent = stats.totalKeys;

        // ‼️ (Logic ใหม่) ปิด/เปิด ปุ่มสร้าง Key ตาม Balance ‼️
        const createKeyBtn = document.getElementById('create-key-btn');
        if (parseFloat(stats.balance) <= 0) {
            createKeyBtn.disabled = true;
            createKeyBtn.textContent = 'Add Funds to Create Key';
            createKeyBtn.classList.add('bg-gray-500', 'cursor-not-allowed');
            createKeyBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        } else {
            createKeyBtn.disabled = false;
            createKeyBtn.textContent = '+ Create New Key';
            createKeyBtn.classList.remove('bg-gray-500', 'cursor-not-allowed');
            createKeyBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }

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
        renderApiKeys(keys);
    } catch (error) {
        console.error('Error fetching keys:', error);
    }
}

// --- 4. ฟังก์ชัน: แสดงผล API Keys (สร้าง HTML) (‼️ แก้ไข ‼️) ---
function renderApiKeys(keys) {
    const listElement = document.getElementById('api-keys-list');
    listElement.innerHTML = ''; 

    if (keys.length === 0) {
        listElement.innerHTML = '<p class="text-center text-gray-400">You have not created any API keys yet.</p>';
        return;
    }

    keys.forEach(key => {
        const keyCard = document.createElement('div');
        keyCard.className = 'bg-gray-700 p-4 rounded-md flex justify-between items-center';
        
        // (เพิ่มการแสดงวันหมดอายุ)
        const expiryDate = new Date(key.expires_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        
        keyCard.innerHTML = `
            <div>
                <p class="text-sm text-gray-400">Key (ID: ${key.id}):</p>
                <code class="text-lg text-indigo-300">${key.api_key}</code>
                <p class="text-sm text-gray-400 mt-1">Status: <span class="text-green-400">${key.status}</span></p>
                <p class="text-sm text-gray-400 mt-1">Renews/Expires: ${expiryDate}</p>
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

// --- 5. ฟังก์ชัน: สร้าง Key ใหม่ (‼️ แก้ไข ‼️) ---
async function createNewKey(token) {
    if (!confirm('Are you sure you want to create a new API key? This key will be active for 30 days.')) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/dashboard/keys`, {
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json(); // อ่าน JSON เสมอ

        if (!response.ok) {
            // (แสดง Error ถ้า Balance ไม่พอ)
            throw new Error(data.error || 'Could not create key'); 
        }
        
        alert('New API Key created successfully!');
        fetchApiKeys(token); 
        fetchDashboardStats(token); 
        
    } catch (error) {
        console.error('Error creating key:', error);
        alert(`Error: ${error.message}`); // (แสดง Error ที่มาจาก Backend)
    }
}

// --- 6. ฟังก์ชัน: ลบ Key ---
async function deleteApiKey(keyId, keyPrefix) {
    if (!confirm(`Are you sure you want to delete key ${keyPrefix}? This action cannot be undone.`)) {
        return;
    }
    const token = localStorage.getItem('movieApiToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/dashboard/keys/${keyId}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Could not delete key');

        alert('API Key deleted successfully!');
        fetchApiKeys(token); 
        fetchDashboardStats(token); 

    } catch (error) {
        console.error('Error deleting key:', error);
        alert('Error deleting key.');
    }
}

// --- 7. ฟังก์ชัน: Logout ---
function logout() {
    alert('You have been logged out.');
    localStorage.removeItem('movieApiToken'); 
    window.location.href = 'index.html'; 
}