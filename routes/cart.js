const express = require('express');
const router = express.Router();

// Только для авторизованных
function requireAuth(req, res, next) {
    if (req.session.user) return next();
    return res.status(401).json({ error: 'Необходимо войти' });
}

router.use(requireAuth);
router.use((req, res, next) => {
    if (!req.session.cart) req.session.cart = [];
    next();
});

// Добавление блюда в корзину (AJAX) – без запросов к БД, без ограничений
router.post('/add', (req, res) => {
    const dishId = parseInt(req.body.dishId, 10);
    const name = req.body.name || 'Блюдо';
    const price = parseFloat(req.body.price) || 0;
    const imageUrl = req.body.imageUrl || '';

    const cart = req.session.cart;
    const existing = cart.find(item => item.id === dishId);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: dishId,
            name: name,
            price: price,
            image_url: imageUrl,
            quantity: 1
        });
    }
    res.json({ success: true });
});

// Просмотр корзины
router.get('/', (req, res) => {
    const cart = req.session.cart;
    let total = 0;
    if (cart.length > 0) {
        total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
    res.render('cart', { cart, total, currentPage: 'cart', user: req.session.user });
});

// Обновление количества (без ограничений)
router.post('/update/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    let quantity = parseInt(req.body.quantity, 10);
    if (isNaN(quantity) || quantity < 1) quantity = 1;
    const cart = req.session.cart;
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity = quantity;
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