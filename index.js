require('dotenv').config();
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'ishtop-landing',
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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

bot.help((ctx) => {
    ctx.reply('Используйте /start для получения ссылки на вход/регистрации.');
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Ошибка обработки обновления:', error);
        res.status(500).send('Internal Server Error');
    }
};

const setWebhook = async () => {
    const webhookUrl = `${process.env.VERCEL_URL}/api/index`;
    try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Вебхук установлен: ${webhookUrl}`);
    } catch (error) {
        console.error('Ошибка установки вебхука:', error);
    }
};

setWebhook();