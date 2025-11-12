// ecosystem.config.js
module.exports = {
    apps : [
      {
        // --- หลังบ้าน (Backend API) ---
        name: "api-server",
        script: "npm",
        args: "start",
        cwd: "./movie-api-server", // ‼️ ระบุ Path ไปยังโฟลเดอร์ Backend
        watch: false, // (ตั้งเป็น true ถ้าต้องการให้รีสตาร์ทเองเมื่อแก้โค้ด)
        env: {
          "NODE_ENV": "production",
        }
      },
      {
        // --- หน้าบ้าน (Frontend Server) ---
        name: "frontend-server",
        script: "npm",
        args: "run serve", // ‼️ รันคำสั่ง "serve" (live-server) ที่เราตั้งไว้
        cwd: "./frontend-dashboard", // ‼️ ระบุ Path ไปยังโฟลเดอร์ Frontend
        watch: false,
      }
    ]
  };