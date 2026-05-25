const express = require('express');
const session = require('express-session');
const path = require('path');
const indexRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка сессий (понадобится позже для входа)
app.use(session({
    secret: '228',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // в продакшене true с HTTPS
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

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});