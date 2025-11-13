// js/admin.js (ไฟล์เต็ม - อัปเดตเพิ่ม File Upload)

const API_URL = 'http://localhost:3001'; 

/**
 * ฟังก์ชันสำหรับ Logout
 */
function logout() {
    localStorage.removeItem('movieApiToken');
    window.location.href = 'index.html';
}

/**
 * ---------------------------------------------------
 * Event Listener หลัก (เริ่มทำงานเมื่อหน้าเว็บโหลด)
 * ---------------------------------------------------
 */
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('movieApiToken');

    // 1. ตรวจสอบสิทธิ์ Admin
    const isAdmin = await checkAdminStatus(token);
    if (!isAdmin) {
        alert('Access Denied. You do not have permission to view this page.');
        window.location.href = 'dashboard.html'; 
        return;
    }

    // 2. ผูก Event ให้ปุ่มและเมนู
    
    const menuItems = document.querySelectorAll('.admin-menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetMenu = item.getAttribute('data-menu');
            setActiveMenu(targetMenu, token);
        });
    });

    // ‼️ (แก้ไข) ผูก Event กับฟอร์ม "Add" ‼️
    document.getElementById('add-movie-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddMovie(token);
    });

    // ‼️ (แก้ไข) ผูก Event กับฟอร์ม "Edit" ‼️
    document.getElementById('edit-movie-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleUpdateMovie(token);
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('logout-button').addEventListener('click', logout);

    // 3. โหลดเมนูเริ่มต้น (Movies)
    setActiveMenu('movies', token);
});

/**
 * ---------------------------------------------------
 * 1. ฟังก์ชันตรวจสอบสิทธิ์ (Security)
 * ---------------------------------------------------
 */
async function checkAdminStatus(token) {
    if (!token) return false;
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.ok; 
    } catch (error) {
        console.error('Admin check failed:', error);
        return false;
    }
}

/**
 * ---------------------------------------------------
 * 2. ฟังก์ชันจัดการเมนู (Tabs)
 * ---------------------------------------------------
 */
function setActiveMenu(activeMenu, token) {
    document.querySelectorAll('.menu-content').forEach(content => {
        content.classList.add('hidden');
    });
    const activeContent = document.getElementById(`content-${activeMenu}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.classList.remove('active', 'border-indigo-500', 'text-indigo-400');
        item.classList.add('border-transparent', 'text-gray-400');
    });
    const activeItem = document.getElementById(`menu-${activeMenu}`);
    if (activeItem) {
        activeItem.classList.add('active', 'border-indigo-500', 'text-indigo-400');
        activeItem.classList.remove('border-transparent', 'text-gray-400');
    }

    if (activeMenu === 'movies') {
        loadMovies(token);
    } else if (activeMenu === 'users') {
        loadUsers(token);
    }
}

/**
 * ---------------------------------------------------
 * 3. ฟังก์ชันจัดการ "หนัง" (Movies)
 * ---------------------------------------------------
 */

// โหลดหนังทั้งหมดมาแสดงในตาราง (‼️ อัปเดต ‼️)
async function loadMovies(token) {
    const tableBody = document.getElementById('movies-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">Loading movies...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/admin/movies`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch movies');

        const movies = await response.json();

        if (movies.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">No movies found.</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; 
        movies.forEach(movie => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700';
            
            row.innerHTML = `
                <td class="py-3 pr-3">
                    <img src="${movie.poster_url || 'https://via.placeholder.com/50x75'}" alt="Poster" class="w-12 h-auto rounded">
                </td>
                <td class="py-3 pr-3 font-bold">${movie.id}</td>
                <td class="py-3 pr-3">${movie.title}</td>
                <td class="py-3 pr-3 text-gray-400 text-sm">${movie.s3_path}</td>
                <td class="py-3">
                    <button class="text-blue-400 hover:text-blue-300 mr-4" 
                            onclick='openEditModal(${JSON.stringify(movie)})'>
                        Edit
                    </button>
                    <button class="text-red-500 hover:text-red-400" 
                            onclick="deleteMovie(${movie.id}, '${movie.title}')">
                        Delete
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading movies:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-red-500">Error loading movies.</td></tr>';
    }
}

// จัดการฟอร์ม "เพิ่มหนัง" (‼️ อัปเดต - ใช้ FormData ‼️)
async function handleAddMovie(token) {
    const messageEl = document.getElementById('movie-form-message');
    messageEl.textContent = 'Adding...';
    messageEl.className = 'text-gray-400 mt-4 inline-block ml-4';

    // 1. ดึงฟอร์ม
    const form = document.getElementById('add-movie-form');
    // 2. สร้าง FormData จากฟอร์ม (มันจะดึง name="id", name="title", name="poster_file" ฯลฯ อัตโนมัติ)
    const formData = new FormData(form);
    
    try {
        const response = await fetch(`${API_URL}/admin/movies`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                // (‼️ ไม่ต้องใส่ 'Content-Type', Browser จะตั้งค่า 'multipart/form-data' ให้เอง ‼️)
            },
            body: formData // 👈 ส่ง FormData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add movie');

        messageEl.textContent = data.message;
        messageEl.className = 'text-green-400 mt-4 inline-block ml-4';
        
        form.reset(); 
        loadMovies(token); 

    } catch (error) {
        console.error('Error adding movie:', error);
        messageEl.textContent = `Error: ${error.message}`;
        messageEl.className = 'text-red-400 mt-4 inline-block ml-4';
    }
}

// ฟังก์ชัน "ลบหนัง"
async function deleteMovie(id, title) {
    const safeTitle = (title || '').replace(/'/g, "\\'");
    if (!confirm(`Are you sure you want to delete movie ID ${id} (${safeTitle})?`)) {
        return;
    }
    
    const token = localStorage.getItem('movieApiToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/admin/movies/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete movie');

        alert('Movie deleted successfully!');
        loadMovies(token); 

    } catch (error) {
        console.error('Error deleting movie:', error);
        alert('Error deleting movie.');
    }
}

// ฟังก์ชัน "เปิด Modal แก้ไข"
function openEditModal(movie) {
    document.getElementById('edit-movie-id-display').textContent = movie.id;
    document.getElementById('edit-movie-id').value = movie.id;
    document.getElementById('edit-movie-title').value = movie.title;
    document.getElementById('edit-movie-s3-path').value = movie.s3_path;
    
    document.getElementById('edit-current-poster').src = movie.poster_url || 'https://via.placeholder.com/100x150';
    document.getElementById('edit-movie-poster-url').value = movie.poster_url || '';
    
    document.getElementById('edit-movie-description').value = movie.description || '';
    
    document.getElementById('edit-movie-message').textContent = '';
    document.getElementById('edit-movie-modal').classList.remove('hidden');
}

// ฟังก์ชัน "ปิด Modal แก้ไข"
function closeEditModal() {
    document.getElementById('edit-movie-modal').classList.add('hidden');
    document.getElementById('edit-movie-form').reset(); 
}

// ฟังก์ชัน "จัดการอัปเดตหนัง" (‼️ อัปเดต - ใช้ FormData ‼️)
async function handleUpdateMovie(token) {
    const messageEl = document.getElementById('edit-movie-message');
    messageEl.textContent = 'Saving...';
    messageEl.className = 'text-gray-400';

    const movieId = document.getElementById('edit-movie-id').value;
    
    const form = document.getElementById('edit-movie-form');
    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/admin/movies/${movieId}`, {
            method: 'PUT', 
            headers: {
                'Authorization': `Bearer ${token}`,
                // (‼️ ไม่ต้องใส่ 'Content-Type' ‼️)
            },
            body: formData 
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update movie');

        messageEl.textContent = 'Update Successful!';
        messageEl.className = 'text-green-400';

        setTimeout(() => {
            closeEditModal();
            loadMovies(token);
        }, 1000);

    } catch (error) {
        console.error('Error updating movie:', error);
        messageEl.textContent = `Error: ${error.message}`;
        messageEl.className = 'text-red-400';
    }
}


/**
 * ---------------------------------------------------
 * 4. ฟังก์ชันจัดการ "ผู้ใช้" (Users)
 * ---------------------------------------------------
 */

// โหลดผู้ใช้ทั้งหมดมาแสดงในตาราง
async function loadUsers(token) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-400">Loading users...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch users');

        const users = await response.json();

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-400">No users found.</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; 
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700';
            row.innerHTML = `
                <td class="py-3 pr-3 font-bold">${user.id}</td>
                <td class="py-3 pr-3">${user.email}</td>
                <td class="py-3 pr-3">${user.first_name || ''} ${user.last_name || ''}</td>
                <td class="py-3 pr-3 text-right text-green-400">$${parseFloat(user.balance).toFixed(2)}</td>
                <td class="py-3 pr-3">${user.is_admin ? '<span class="text-red-500 font-bold">YES</span>' : 'No'}</td>
                <td class="py-3">
                    <button class="text-blue-400 hover:text-blue-300 mr-2" onclick="alert('Edit user ID ${user.id} (feature to be built)')">
                        Edit
                    </button>
                    <button class="text-red-500 hover:text-red-400" onclick="deleteUser(${user.id}, '${user.email}')">
                        Delete
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading users:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Error loading users.</td></tr>';
    }
}

// ฟังก์ชัน "ลบผู้ใช้"
async function deleteUser(id, email) {
    const safeEmail = (email || '').replace(/'/g, "\\'");
    if (!confirm(`Are you sure you want to DELETE user ID ${id} (${safeEmail})? This action is permanent and will delete all their keys and transactions.`)) {
        return;
    }
    
    const token = localStorage.getItem('movieApiToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete user');

        alert('User deleted successfully!');
        loadUsers(token); 

    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user.');
    }
}