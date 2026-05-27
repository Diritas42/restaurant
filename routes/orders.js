const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// ---------- Middleware ----------
function requireAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.roles.includes('Admin')) return next();
    res.status(403).send('Доступ запрещён');
}

// ---------- Страница оформления заказа ----------
router.get('/order', requireAuth, (req, res) => {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/menu');
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.render('order', { cart, total, user: req.session.user, error: null });
});

// ---------- Обработка оформления заказа ----------
router.post('/order', requireAuth, async (req, res) => {
    const { deliveryMethod, address, comment } = req.body;
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/menu');

    const userId = req.session.user.id;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    try {
        const deliveryAddress = deliveryMethod === 'delivery' ? address : null;
        const estCompletion = new Date(Date.now() + 45 * 60000);

        const orderResult = await pool.query(
            `INSERT INTO orders (user_id, status_id, total_amount, delivery_address, comment, estimated_completion_time)
             VALUES ($1, 1, $2, $3, $4, $5) RETURNING id`,
            [userId, total, deliveryAddress, comment, estCompletion]
        );
        const orderId = orderResult.rows[0].id;

        for (const item of cart) {
            await pool.query(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order)
                 VALUES ($1, $2, $3, $4)`,
                [orderId, item.id, item.quantity, item.price]
            );
        }

        req.session.cart = [];
        res.redirect('/orders');
    } catch (err) {
        console.error('Ошибка создания заказа:', err);
        res.render('order', { cart, total, user: req.session.user, error: 'Ошибка при оформлении заказа' });
    }
});

// ---------- История заказов пользователя (все, включая мягко удалённые) ----------
router.get('/orders', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.order_date, o.status_id, os.name AS status_name,
                    o.total_amount, o.delivery_address, o.estimated_completion_time
             FROM orders o
             JOIN order_statuses os ON o.status_id = os.id
             WHERE o.user_id = $1
             ORDER BY o.order_date DESC`,
            [req.session.user.id]
        );
        res.render('orders', { orders: result.rows, currentPage: 'orders', user: req.session.user });
    } catch (err) {
        console.error('Ошибка истории заказов:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ---------- Polling статусов для пользователя (возвращает JSON) ----------
router.get('/orders/statuses', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.id, os.name AS status_name
             FROM orders o
                      JOIN order_statuses os ON o.status_id = os.id
             WHERE o.user_id = $1`,
            [req.session.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения статусов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Отмена заказа пользователем (помечаем как отменённый, если не выполнен/отменён) ----------
router.post('/orders/delete/:id', requireAuth, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    try {
        const orderResult = await pool.query(
            'SELECT id, status_id FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.session.user.id]
        );
        if (orderResult.rows.length === 0) return res.status(404).send('Заказ не найден');

        const order = orderResult.rows[0];
        if (order.status_id !== 5 && order.status_id !== 6) {
            await pool.query('UPDATE orders SET status_id = 6 WHERE id = $1', [orderId]);
        }
        res.redirect('/orders');
    } catch (err) {
        console.error('Ошибка отмены заказа:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ---------- Админ: список заказов (только неудалённые) ----------
router.get('/admin/orders', isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.user_id, u.email, o.order_date, o.status_id, os.name AS status_name,
                    o.total_amount, o.delivery_address, o.estimated_completion_time
             FROM orders o
             JOIN users u ON o.user_id = u.id
             JOIN order_statuses os ON o.status_id = os.id
             WHERE o.is_deleted = false
             ORDER BY o.order_date DESC`
        );
        res.render('admin-orders', { orders: result.rows, currentPage: 'admin', user: req.session.user });
    } catch (err) {
        console.error('Ошибка получения заказов:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ---------- Админ: изменение статуса (AJAX) ----------
router.post('/admin/orders/status', isAdmin, async (req, res) => {
    const { orderId, statusId } = req.body;
    if (!orderId || !statusId) {
        return res.status(400).json({ error: 'orderId и statusId обязательны' });
    }
    try {
        await pool.query('UPDATE orders SET status_id = $1 WHERE id = $2', [statusId, orderId]);
        const statusResult = await pool.query('SELECT name FROM order_statuses WHERE id = $1', [statusId]);
        res.json({
            status_id: parseInt(statusId),
            status_name: statusResult.rows[0].name
        });
    } catch (err) {
        console.error('Ошибка изменения статуса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ---------- Админ: мягкое удаление заказа (только выполненные/отменённые) ----------
router.post('/admin/orders/delete/:id', isAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    try {
        const orderResult = await pool.query('SELECT id, status_id FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) return res.status(404).send('Заказ не найден');

        const order = orderResult.rows[0];
        if (order.status_id !== 5 && order.status_id !== 6) {
            return res.status(400).send('Можно удалять только выполненные или отменённые заказы');
        }

        await pool.query('UPDATE orders SET is_deleted = true WHERE id = $1', [orderId]);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error('Ошибка удаления заказа:', err);
        res.status(500).send('Ошибка сервера');
    }
});

module.exports = router;