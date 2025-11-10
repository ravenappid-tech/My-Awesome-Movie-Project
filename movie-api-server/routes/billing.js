// /routes/billing.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const checkAuth = require('../middleware/checkAuth'); // "ยาม" ตรวจสอบ Token

const router = express.Router();

// (ข้อมูลแพ็คเกจ - เราจะเก็บไว้ตรงนี้ก่อนเพื่อความง่าย)
// (ในระบบจริง, คุณควรสร้าง "Products" ใน Stripe Dashboard)
const PLANS = {
    pro: {
        id: 'price_YOUR_PRO_PLAN_ID', // ‼️ (สำคัญ!) คุณต้องสร้าง Price ID นี้ใน Stripe Dashboard
        name: 'Pro Plan',
        quota: 1000000
    }
};

// 1. API สำหรับ "สร้างหน้าจ่ายเงิน" (ที่หน้าบ้านจะเรียก)
router.post('/create-checkout-session', checkAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const plan = 'pro'; // (สมมติว่าอัปเกรดเป็น Pro)

        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        let user = users[0];

        let stripeCustomerId = user.stripe_customer_id;

        // 1.1) ถ้า User คนนี้ยังไม่เคยจ่ายเงิน, สร้าง Customer ID ใน Stripe ให้เขา
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: email,
                metadata: {
                    userId: userId 
                }
            });
            stripeCustomerId = customer.id;

            // 1.2) บันทึก ID นี้ไว้ใน Database ของเรา
            await pool.execute(
                'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                [stripeCustomerId, userId]
            );
        }

        // 1.3) สร้าง Checkout Session (หน้าจ่ายเงิน)
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: PLANS.pro.id, 
                    quantity: 1,
                },
            ],
            mode: 'subscription', // (สำคัญ!) เราขายแบบรายเดือน
            success_url: `${process.env.FRONTEND_URL}/dashboard.html?payment=success`, // กลับมาหน้านี้ถ้าสำเร็จ
            cancel_url: `${process.env.FRONTEND_URL}/pricing.html?payment=cancel`, // กลับมาหน้านี้ถ้ายกเลิก
            metadata: {
                userId: userId,
                plan: plan
            }
        });

        // 1.4) ส่ง URL ของหน้าจ่ายเงิน กลับไปให้หน้าบ้าน
        res.json({ url: session.url });

    } catch (error) {
        console.error('Stripe Checkout error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. API สำหรับ "Stripe Webhook" (ที่ Stripe จะเรียกหาเรา)
// (นี่คือ API ที่สำคัญที่สุด!)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    
    // (หมายเหตุ: เราต้องใช้ express.raw() เพราะ Stripe ต้องการ Body ดิบๆ)
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // 2.1) ตรวจสอบลายเซ็น (Signature) ว่ามาจาก Stripe จริง
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.warn('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2.2) จัดการ Event (เหตุการณ์) ต่างๆ
    const data = event.data.object;
    
    try {
        switch (event.type) {
            // -- เหตุการณ์: จ่ายเงินสำเร็จ (ครั้งแรก) --
            case 'checkout.session.completed':
            case 'invoice.payment_succeeded': {
                const session = data;
                const userId = session.metadata ? session.metadata.userId : data.customer_metadata.userId;
                const plan = session.metadata ? session.metadata.plan : data.customer_metadata.plan;
                const subscriptionStatus = session.status === 'complete' || data.status === 'paid' ? 'active' : 'incomplete';
                
                if (userId && plan) {
                    console.log(`✅ Payment Succeeded for User ID: ${userId}, Plan: ${plan}`);
                    // (สำคัญ!) อัปเดต Database ของเรา
                    await pool.execute(
                        "UPDATE users SET subscription_status = ?, plan_type = ? WHERE id = ?",
                        [subscriptionStatus, plan, userId]
                    );
                    
                    // (สำคัญ!) อัปเดตโควต้าในตาราง api_keys
                    const newQuota = PLANS[plan].quota;
                    await pool.execute(
                        "UPDATE api_keys SET quota_limit = ? WHERE user_id = ?",
                        [newQuota, userId]
                    );
                }
                break;
            }

            // -- เหตุการณ์: ลูกค้ายกเลิก Subscription --
            case 'customer.subscription.deleted':
            case 'customer.subscription.updated': {
                const subscription = data;
                const customerId = subscription.customer;
                const newStatus = subscription.status; // เช่น 'canceled'
                
                if (subscription.cancel_at_period_end) {
                    // (ยังไม่ยกเลิกทันที จะยกเลิกตอนครบรอบบิล)
                } else {
                    // (ยกเลิกทันที หรือ อัปเดตสถานะ)
                    console.log(`Subscription Updated for Customer: ${customerId}, Status: ${newStatus}`);
                    // ค้นหา User จาก customerId
                    const [users] = await pool.execute('SELECT * FROM users WHERE stripe_customer_id = ?', [customerId]);
                    if (users.length > 0) {
                        const user = users[0];
                        const newPlan = (newStatus === 'active') ? user.plan_type : 'free'; // ถ้ายกเลิก -> กลับไป 'free'
                        
                        await pool.execute(
                            "UPDATE users SET subscription_status = ?, plan_type = ? WHERE id = ?",
                            [newStatus, newPlan, user.id]
                        );

                        // ถ้ากลับไป Free Plan, ลดโควต้ากลับ
                        if (newPlan === 'free') {
                            await pool.execute(
                                "UPDATE api_keys SET quota_limit = ? WHERE user_id = ?",
                                [10000, user.id] // กลับไปโควต้า 10,000
                            );
                        }
                    }
                }
                break;
            }
            // (เราสามารถเพิ่ม case อื่นๆ ได้ เช่น 'invoice.payment_failed')
            
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