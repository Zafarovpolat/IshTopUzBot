require('dotenv').config();
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express'); // Новая зависимость

// Парсим service account из .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Инициализируем Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'ishtop-landing',
});

// Создаем бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Команда /start: Генерирует custom token и отправляет ссылку для auth
bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const uid = `telegram:${telegramId}`;

    try {
        const customToken = await admin.auth().createCustomToken(uid, {
            telegramUsername: ctx.from.username || '',
        });

        const siteUrl = process.env.SITE_URL;
        const authLink = `${siteUrl}/auth?provider=telegram&token=${customToken}`;

        await ctx.reply(`Добро пожаловать! Нажмите на ссылку для входа/регистрации на сайте:\n${authLink}\n\nЕсли вы новый пользователь, аккаунт создастся автоматически.`);
    } catch (error) {
        console.error('Ошибка генерации токена:', error);
        await ctx.reply('Ошибка при создании ссылки для входа. Попробуйте позже.');
    }
});

// Команда /help: Пояснения
bot.help((ctx) => {
    ctx.reply('Используйте /start для получения ссылки на вход/регистрации.');
});

// Express app для обработки webhook
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/telegram-webhook')); // Путь для webhook (можно изменить)

// Устанавливаем вебхук автоматически при запуске
const setWebhook = async () => {
    const webhookUrl = `${process.env.RENDER_URL}/telegram-webhook`; // Замени VERCEL_URL на RENDER_URL
    try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Вебхук установлен: ${webhookUrl}`);
    } catch (error) {
        console.error('Ошибка установки вебхука:', error);
    }
};

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    setWebhook(); // Устанавливаем webhook при старте
});