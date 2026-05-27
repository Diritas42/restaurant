const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

function requireAuth(req, res, next) {
    if (req.session.user) return next();
    return res.status(401).json({ error: 'Unauthorized' });
}

router.use(requireAuth);
router.use((req, res, next) => {
    if (!req.session.cart) req.session.cart = [];
    next();
});

// Добавление в корзину (AJAX)
router.post('/add', async (req, res) => {
    const dishId = parseInt(req.body.dishId, 10);
    try {
        const result = await pool.query(
            'SELECT id, name, price, image_url FROM menu_items WHERE id = $1 AND is_available = true',
            [dishId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Блюдо не найдено' });
        }

        const dish = result.rows[0];
        const cart = req.session.cart;
        const existing = cart.find(item => item.id === dishId);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ id: dish.id, name: dish.name, price: dish.price, image_url: dish.image_url, quantity: 1 });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка добавления в корзину:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Просмотр корзины (страница)
router.get('/', (req, res) => {
    const cart = req.session.cart;
    let total = 0;
    if (cart.length > 0) {
        total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
    res.render('cart', { cart, total, currentPage: 'cart', user: req.session.user });
});

// Обновление количества
router.post('/update/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const quantity = parseInt(req.body.quantity, 10);
    const cart = req.session.cart;
    const item = cart.find(i => i.id === id);
    if (item) {
        if (quantity > 0) {
            item.quantity = quantity;
        } else {
            req.session.cart = cart.filter(i => i.id !== id);
        }
    }
    res.redirect('/cart');
});

// Удаление позиции
router.post('/remove/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    req.session.cart = req.session.cart.filter(i => i.id !== id);
    res.redirect('/cart');
});

module.exports = router;