const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// Фиксированные ID популярных блюд
const POPULAR_DISH_IDS = [1, 2, 3, 4];

router.get('/', async (req, res) => {
    try {
        // 1. Проверим, загружена ли переменная окружения
        console.log('=== НАЧАЛО ЗАПРОСА ГЛАВНОЙ ===');
        console.log('DATABASE_URL определён:', !!process.env.DATABASE_URL);
        console.log('Первые 40 символов DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40));

        // 2. Проверим, доступен ли пул
        console.log('Проверяем подключение к базе...');
        const testResult = await pool.query('SELECT NOW()');
        console.log('Текущее время в БД:', testResult.rows[0].now);

        // 3. Формируем запрос на популярные блюда
        const placeholders = POPULAR_DISH_IDS.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT id, name, price, image_url
            FROM menu_items
            WHERE id IN (${placeholders})
            AND is_available = true
        `;
        const values = POPULAR_DISH_IDS;

        console.log('SQL-запрос:', query);
        console.log('Значения параметров:', values);

        // 4. Выполняем запрос
        const result = await pool.query(query, values);
        console.log('Результат запроса (количество строк):', result.rows.length);
        console.log('Данные популярных блюд:', JSON.stringify(result.rows, null, 2));

        const popularDishes = result.rows;

        // 5. Рендерим страницу
        res.render('index', {
            popularDishes,
            user: req.session?.user || null
        });

        console.log('=== СТРАНИЦА УСПЕШНО ОТРЕНДЕРЕНА ===');

    } catch (err) {
        // 6. Подробный вывод ошибки
        console.error('=== ОШИБКА В МАРШРУТЕ ГЛАВНОЙ ===');
        console.error('Сообщение:', err.message);
        console.error('Стек ошибки:', err.stack);
        console.error('Код ошибки (если есть):', err.code);
        console.error('Детали (detail):', err.detail);
        console.error('Таблица (table):', err.table);
        console.error('Ограничение (constraint):', err.constraint);

        res.status(500).send('Ошибка сервера. Подробности смотрите в консоли.');
    }
});

module.exports = router;