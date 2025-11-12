// /routes/billing.js (เวอร์ชัน Funds/Wallet 5 ระดับ)
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const checkAuth = require('../middleware/checkAuth');

const router = express.Router();

// ‼️ (สำคัญ!) ใส่ Price ID ที่ถูกต้องที่คุณสร้างใน Stripe ‼️
const PLANS = {
    topup30: {
        id: 'price_1SRz9FRoD2KA8WefPs1FsZns', 
        amount: 30.00
    },
    topup90: {
        id: 'price_1SRz9pRoD2KA8Wef4d2UPZBX',
        amount: 90.00
    },
    topup300: {
        id: 'price_1SRzAeRoD2KA8WefqyazSYHU',
        amount: 300.00
    },
    topup500: {
        id: 'price_1SRzAvRoD2KA8WefyPxAM0iW',
        amount: 500.00
    },
    topup1000: {
        id: 'price_1SRzBCRoD2KA8WefEcXyuWx6',
        amount: 1000.00
    }
};

// 1. API สำหรับ "สร้างหน้าจ่ายเงิน" (เติมเงิน)
// (ใช้ 'checkAuth' เพื่อให้แน่ใจว่าเฉพาะผู้ใช้ที่ล็อกอินเท่านั้นที่สามารถเติมเงินได้)
router.post('/create-checkout-session', checkAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const { planKey } = req.body; // รับ 'topup30', 'topup90', ฯลฯ

        const plan = PLANS[planKey];
        if (!plan) {
            return res.status(400).json({ error: 'Invalid top-up amount selected.' });
        }

        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        let user = users[0];
        let stripeCustomerId = user.stripe_customer_id;

        // 1.1) สร้าง Customer ID ใน Stripe (ถ้ายังไม่มี)
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: email,
                metadata: { userId: userId }
            });
            stripeCustomerId = customer.id;
            await pool.execute(
                'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                [stripeCustomerId, userId]
            );
        }

        // 1.2) สร้าง Checkout Session (โหมด "Payment" จ่ายครั้งเดียว)
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.id, // ใช้ Price ID ที่กำหนดล่วงหน้า
                    quantity: 1,
                },
            ],
            mode: 'payment', 
            success_url: `${process.env.FRONTEND_URL}/dashboard.html?payment=success&amount=${plan.amount}`,
            cancel_url: `${process.env.FRONTEND_URL}/pricing.html?payment=cancel`,
            metadata: {
                userId: userId,
                amountToAdd: plan.amount // เก็บยอดเงินที่จะเติม
            }
        });

        // 1.3) ส่ง URL ของหน้าจ่ายเงิน กลับไปให้หน้าบ้าน
        res.json({ url: session.url });

    } catch (error) {
        console.error('Stripe Checkout error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. API สำหรับ "Stripe Webhook" (ที่ Stripe จะเรียกหาเรา)
// (ใช้ express.raw() เพื่อรับ Body ดิบๆ)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.warn('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2.2) จัดการ Event
    const data = event.data.object;
    
    try {
        switch (event.type) {
            // เหตุการณ์: จ่ายเงินครั้งเดียวสำเร็จ
            case 'checkout.session.completed': {
                const session = data;
                
                if (session.payment_status === 'paid') {
                    const userId = session.metadata.userId;
                    const amountToAdd = parseFloat(session.metadata.amountToAdd);

                    if (userId && amountToAdd > 0) {
                        console.log(`✅ Funds Added for User ID: ${userId}, Amount: ${amountToAdd}`);
                        
                        // ‼️ (Logic ใหม่) เชื่อมต่อ DB ใน Transaction (กันข้อมูลพัง)
                        const connection = await pool.getConnection();
                        try {
                            await connection.beginTransaction();
                            
                            // 1. อัปเดต "Balance" ของผู้ใช้
                            await connection.execute(
                                "UPDATE users SET balance = balance + ? WHERE id = ?",
                                [amountToAdd, userId]
                            );

                            // 2. บันทึกประวัติการเติมเงิน (Credit)
                            await connection.execute(
                                "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'credit', ?, ?)",
                                [userId, amountToAdd, `Stripe Top-up (ID: ${session.id})`]
                            );
                            
                            await connection.commit();
                        } catch (dbError) {
                            await connection.rollback();
                            throw dbError; // โยน Error ให้ catch บล็อกด้านนอกจัดการ
                        } finally {
                            connection.release();
                        }
                    }
                }
                break;
            }
            
            default:
                // console.log(`Unhandled event type ${event.type}`);
        }
    } catch (dbError) {
        console.error('Webhook DB Error:', dbError);
        return res.status(500).json({ error: 'Database error handling webhook' });
    }

    // 2.3) ตอบกลับ Stripe ว่า "ได้รับแล้ว"
    res.json({ received: true });
});

module.exports = router;