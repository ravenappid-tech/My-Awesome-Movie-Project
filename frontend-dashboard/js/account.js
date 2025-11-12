// js/account.js (ไฟล์เต็ม)

const API_URL = 'https://kuayapi.com';

// --- 1. Event Listener หลัก เมื่อหน้าเว็บโหลด ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1.1) ตรวจสอบ Token (ตั๋ว)
    const token = localStorage.getItem('movieApiToken');
    if (!token) {
        alert('Please login to access settings.');
        window.location.href = 'index.html';
        return;
    }

    // 1.2) ผูก Event ให้ฟอร์มต่างๆ
    document.getElementById('profile-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        updateProfile(token);
    });

    document.getElementById('change-password-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangePassword(token);
    });

    document.getElementById('telegram-link-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLinkTelegram(token);
    });

    document.getElementById('logout-button')?.addEventListener('click', logout);

    // 1.3) ผูก Event ให้เมนู Sidebar
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetMenu = item.getAttribute('data-menu');
            setActiveMenu(targetMenu, token);
        });
    });

    // 1.4) โหลดเมนูเริ่มต้น (Profile)
    setActiveMenu('profile', token);
});


// --- 2. ฟังก์ชันหลักสำหรับสลับเมนู ---
function setActiveMenu(activeMenu, token) {
    // ซ่อน Content ทั้งหมด
    document.querySelectorAll('.menu-content').forEach(content => {
        content.classList.add('hidden');
    });

    // แสดง Content ที่เลือก
    const activeContent = document.getElementById(activeMenu + '-content');
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }

    // ปรับ Style ของปุ่มเมนู
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active'); // (ใช้ class .active ที่เราเพิ่มใน CSS)
    });
    const activeItem = document.querySelector(`[data-menu="${activeMenu}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    // ‼️ (สำคัญ!) โหลดข้อมูลเมื่อคลิกเมนู ‼️
    if (activeMenu === 'profile') {
        fetchProfileData(token);
    } else if (activeMenu === 'invoices') {
        fetchTransactions(token);
    }
}

// --- 3. ฟังก์ชัน Profile (GET และ PUT) ---
async function fetchProfileData(token) {
    try {
        const response = await fetch(`${API_URL}/dashboard/profile`, { 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch profile data.');

        const data = await response.json();
        
        document.getElementById('user-email').value = data.email || '';
        document.getElementById('first-name').value = data.first_name || '';
        document.getElementById('last-name').value = data.last_name || '';
        document.getElementById('phone').value = data.phone || '';
        
    } catch (error) {
        console.error('Error fetching profile data:', error);
        document.getElementById('profile-message').textContent = 'Error loading profile data.';
        document.getElementById('profile-message').className = 'text-red-400 mt-4';
    }
}

async function updateProfile(token) {
    const first_name = document.getElementById('first-name').value.trim();
    const last_name = document.getElementById('last-name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    const messageEl = document.getElementById('profile-message');
    messageEl.textContent = 'Updating...';
    messageEl.className = 'text-gray-400 mt-4';

    try {
        const response = await fetch(`${API_URL}/dashboard/profile`, { 
            method: 'PUT', 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ first_name, last_name, phone })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Update failed.');
        
        messageEl.textContent = 'Profile updated successfully!';
        messageEl.className = 'text-green-400 mt-4';
        
    } catch (error) {
        console.error('Profile update failed:', error);
        messageEl.textContent = `Update failed: ${error.message}`;
        messageEl.className = 'text-red-400 mt-4';
    }
}

// --- 4. ฟังก์ชัน Password (POST) ---
async function handleChangePassword(token) {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const messageEl = document.getElementById('password-message');

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'New passwords do not match!';
        messageEl.className = "text-red-400 mt-4";
        return;
    }

    messageEl.textContent = 'Updating...';
    messageEl.className = "text-gray-400 mt-4";

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
        if (!response.ok) throw new Error(data.error || 'Update failed');

        messageEl.textContent = data.message;
        messageEl.className = "text-green-400 mt-4";
        
        document.getElementById('change-password-form').reset(); // ล้างฟอร์ม
    } catch (error) {
        messageEl.textContent = `Error: ${error.message}`;
        messageEl.className = "text-red-400 mt-4";
    }
}

// --- 5. ฟังก์ชัน Telegram (POST) ---
async function handleLinkTelegram(token) {
    const chatId = document.getElementById('telegram-chat-id').value;
    const messageEl = document.getElementById('telegram-message');
    
    messageEl.textContent = 'Linking...';
    messageEl.className = "text-gray-400 mt-0"; 

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
            messageEl.className = "text-green-400 mt-0"; 
            document.getElementById('telegram-chat-id').value = '';
        } else {
            messageEl.textContent = `Error: ${data.error}`;
            messageEl.className = "text-red-400 mt-0"; 
        }
    } catch (error) {
        messageEl.textContent = 'Failed to connect to server.';
        messageEl.className = "text-red-400 mt-0";
    }
}

// --- 6. ‼️ ฟังก์ชัน Invoices (GET Transactions) (ใหม่) ‼️ ---
async function fetchTransactions(token) {
    const tableBody = document.getElementById('transactions-table-body');
    tableBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-400">Loading transactions...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/dashboard/transactions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Could not fetch transactions.');

        const transactions = await response.json();

        if (transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-400">No transactions found.</td></tr>';
            return;
        }
        
        tableBody.innerHTML = ''; // ล้างตาราง

        transactions.forEach(tx => {
            const date = new Date(tx.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
            const amountClass = tx.type === 'credit' ? 'text-green-400' : 'text-red-400';
            const amountSign = tx.type === 'credit' ? '+' : '-';

            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700';
            row.innerHTML = `
                <td class="py-3 pr-3">${date}</td>
                <td class="py-3 pr-3 capitalize">${tx.type}</td>
                <td class="py-3 pr-3 text-gray-400">${tx.description}</td>
                <td class="py-3 text-right font-medium ${amountClass}">
                    ${amountSign}$${parseFloat(tx.amount).toFixed(2)}
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        tableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-red-400">Error loading transactions.</td></tr>`;
    }
}

// --- 7. ฟังก์ชัน Logout ---
function logout() {
    alert('You have been logged out.');
    localStorage.removeItem('movieApiToken');
    window.location.href = 'index.html';
}