const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');

// Страница входа
router.get('/login', (req, res) => {
    res.render('login', { currentPage: 'login', error: null, user: req.session.user || null });
});

// Обработка входа
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.password_hash, u.full_name
             FROM users u
             WHERE u.email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.render('login', { currentPage: 'login', error: 'Неверный email или пароль', user: null });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.render('login', { currentPage: 'login', error: 'Неверный email или пароль', user: null });
        }

        // Загружаем роли пользователя
        const rolesResult = await pool.query(
            `SELECT r.name FROM roles r
             JOIN user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = $1`,
            [user.id]
        );
        const roles = rolesResult.rows.map(r => r.name);

        // Сохраняем в сессии
        req.session.user = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            roles: roles
        };

        res.redirect('/');
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.render('login', { currentPage: 'login', error: 'Ошибка сервера', user: null });
    }
});

// Страница регистрации
router.get('/register', (req, res) => {
    res.render('register', { currentPage: 'login', error: null, user: req.session.user || null });
});

// Обработка регистрации
router.post('/register', async (req, res) => {
    const { email, password, fullName, phone } = req.body;

    try {
        // Проверка, существует ли пользователь
        const exist = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exist.rows.length > 0) {
            return res.render('register', { currentPage: 'login', error: 'Пользователь с таким email уже существует', user: null });
        }

        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Создаём пользователя
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
            [email, passwordHash, fullName, phone]
        );
        const userId = result.rows[0].id;

        // Назначаем роль User (id = 1)
        await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, 1)', [userId]);

        // Сразу авторизуем
        req.session.user = {
            id: userId,
            email: email,
            fullName: fullName,
            roles: ['User']
        };

        res.redirect('/');
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.render('register', { currentPage: 'login', error: 'Ошибка сервера', user: null });
    }
});

// Выход
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;