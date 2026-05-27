require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db/database');
const path = require('path');
const indexRoutes = require('./routes/index');
const menuRoutes = require('./routes/menu');
const authRoutes = require('./routes/auth');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка сессий
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'секретный_ключ_для_разработки',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: false,
        httpOnly: true
    }
}));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Парсинг тела POST-запросов
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Шаблонизатор EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Маршруты
app.use('/', indexRoutes);
app.use('/menu', menuRoutes);
app.use('/', authRoutes);
app.use('/cart', cartRoutes);
app.use('/', orderRoutes);

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});