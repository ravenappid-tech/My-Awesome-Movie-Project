// /server.js
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware'); // เพิ่มบรรทัดนี้

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const movieRoutes = require('./routes/movies');
const billingRoutes = require('./routes/billing'); 

const app = express();
const port = process.env.PORT || 3001; 

// --- Middlewares ---
app.use(cors()); 
app.use('/billing/webhook', billingRoutes);
app.use(express.json()); 

// --- Middleware สำหรับแนบ CLOUDFRONT_DOMAIN ---
app.use((req, res, next) => {
    req.cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN; 
    next();
});

// --- เพิ่ม HLS PROXY (สำคัญ!) ---
app.use('/hls', createProxyMiddleware({
    target: process.env.CLOUDFRONT_DOMAIN, // เช่น https://d3oqkbjyzfjzcw.cloudfront.net
    changeOrigin: true,
    pathRewrite: { '^/hls': '' },
    onError: (err, req, res) => {
        console.error('HLS Proxy Error:', err);
        res.status(502).json({ error: 'Stream proxy failed' });
    },
    onProxyRes: (proxyRes) => {
        // แก้ CORS ให้ทุกไฟล์ .m3u8 และ .ts
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, HEAD';
        proxyRes.headers['Access-Control-Allow-Headers'] = '*';
    }
}));

// --- API Routes ---
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api/v1/movie', movieRoutes); 
app.use('/billing', billingRoutes); 

// --- Endpoint ทดสอบ ---
app.get('/', (req, res) => {
    res.send('Movie API Server is running!');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`API Server running on http://localhost:${port}`);
    console.log(`DEBUG: CLOUDFRONT_DOMAIN = ${process.env.CLOUDFRONT_DOMAIN}`);
    console.log(`HLS Proxy วิ่งที่ /hls → ${process.env.CLOUDFRONT_DOMAIN}`);
});