const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// Middleware для проверки прав администратора
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.roles.includes('Admin')) {
        return next();
    }
    res.status(403).send('Доступ запрещён');
}

// ---------- Главная страница меню ----------
router.get('/', async (req, res) => {
    try {
        // Получаем категории
        const catResult = await pool.query('SELECT id, name FROM categories ORDER BY id');
        const categories = catResult.rows;

        // Получаем все доступные блюда
        const dishResult = await pool.query(
            `SELECT id, name, description, price, image_url, category_id
             FROM menu_items
             WHERE is_available = true
             ORDER BY id`
        );
        const dishes = dishResult.rows;

        res.render('menu', {
            dishes,
            categories,
            currentPage: 'menu',
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Ошибка получения меню:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ---------- Форма добавления блюда (только админ) ----------
router.get('/add', isAdmin, (req, res) => {
    res.render('add-dish', {
        currentPage: 'menu',
        user: req.session.user,
        error: null
    });
});

// ---------- Обработка добавления блюда ----------
router.post('/add', isAdmin, async (req, res) => {
    const { name, category_id, price, description, image_url } = req.body;
    try {
        await pool.query(
            `INSERT INTO menu_items (name, category_id, price, description, image_url, is_available)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [name, category_id, price, description, image_url]
        );
        res.redirect('/menu');
    } catch (err) {
        console.error('Ошибка добавления блюда:', err);
        res.render('add-dish', {
            currentPage: 'menu',
            user: req.session.user,
            error: 'Ошибка при добавлении'
        });
    }
});

// ---------- Удаление блюда (только админ) ----------
router.post('/delete/:id', isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
        res.redirect('/menu');
    } catch (err) {
        console.error('Ошибка удаления блюда:', err);
        res.status(500).send('Ошибка при удалении');
    }
});

// ---------- Форма редактирования блюда (только админ) ----------
router.get('/edit/:id', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Блюдо не найдено');

        // Получаем категории для выпадающего списка
        const catResult = await pool.query('SELECT id, name FROM categories ORDER BY id');

        res.render('edit-dish', {
            dish: result.rows[0],
            categories: catResult.rows,
            currentPage: 'menu',
            user: req.session.user,
            error: null
        });
    } catch (err) {
        console.error('Ошибка загрузки формы редактирования:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ---------- Обработка сохранения изменений блюда ----------
router.post('/edit/:id', isAdmin, async (req, res) => {
    const { name, category_id, price, description, image_url, is_available } = req.body;
    const dishId = parseInt(req.params.id, 10);

    try {
        await pool.query(
            `UPDATE menu_items SET name = $1, category_id = $2, price = $3, description = $4,
             image_url = $5, is_available = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7`,
            [name, category_id, price, description, image_url, is_available ? true : false, dishId]
        );
        res.redirect('/menu');
    } catch (err) {
        console.error('Ошибка обновления блюда:', err);
        // Перезагружаем форму с ошибкой
        const dishResult = await pool.query('SELECT * FROM menu_items WHERE id = $1', [dishId]);
        const catResult = await pool.query('SELECT id, name FROM categories ORDER BY id');
        res.render('edit-dish', {
            dish: dishResult.rows[0],
            categories: catResult.rows,
            currentPage: 'menu',
            user: req.session.user,
            error: 'Ошибка при обновлении блюда'
        });
    }
});

module.exports = router;