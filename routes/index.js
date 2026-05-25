const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// Фиксированные ID популярных блюд (должны совпадать с ID в вашей таблице PostgreSQL)
const POPULAR_DISH_IDS = [1, 2, 3, 4];

router.get('/', async (req, res) => {
    try {
        // Формируем безопасный запрос с параметрами
        const placeholders = POPULAR_DISH_IDS.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT id, name, price, image_url
            FROM menu_items
            WHERE id IN (${placeholders})
            AND is_available = true
        `;
        const values = POPULAR_DISH_IDS;
        const result = await pool.query(query, values);
        const popularDishes = result.rows;   // в pg результат в .rows, не .recordset

        console.log('Популярные блюда:', popularDishes);

        res.render('index', {
            popularDishes,
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Ошибка получения блюд:', err);
        res.status(500).send('Ошибка сервера');
    }
});

module.exports = router;