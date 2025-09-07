require('dotenv').config();
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

// Парсим service account из .env (он в строке JSON)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Инициализируем Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'ishtop-landing', // Из вашего конфига
});

// Создаем бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Команда /start: Генерирует custom token и отправляет ссылку для auth
bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const uid = `telegram:${telegramId}`; // Уникальный UID для Firebase (можно добавить username для displayName)

    try {
        // Генерируем custom token (действует 1 час)
        const customToken = await admin.auth().createCustomToken(uid, {
            telegramUsername: ctx.from.username || '', // Опционально: дополнительные claims
        });

        // Формируем deep-link на сайт
        const siteUrl = process.env.SITE_URL;
        const authLink = `${siteUrl}/auth?provider=telegram&token=${customToken}`;

        // Отправляем сообщение с ссылкой
        await ctx.reply(`Добро пожаловать! Нажмите на ссылку для входа/регистрации на сайте:\n${authLink}\n\nЕсли вы новый пользователь, аккаунт создастся автоматически.`);
    } catch (error) {
        console.error('Ошибка генерации токена:', error);
        await ctx.reply('Ошибка при создании ссылки для входа. Попробуйте позже.');
    }
});

// Команда /help: Пояснения
bot.help((ctx) => {
    ctx.reply('Используйте /start для получения ссылки на вход/регистрацию.');
});

// Запускаем бота в polling-режиме (для dev; для prod используйте webhook)
bot.launch()
    .then(() => console.log('Бот запущен!'))
    .catch((err) => console.error('Ошибка запуска бота:', err));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));