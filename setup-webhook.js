require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const setWebhook = async () => {
    const webhookUrl = `${process.env.VERCEL_URL}/api/index`;
    console.log(`Устанавливаем вебхук: ${webhookUrl}`);

    try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`✅ Вебхук успешно установлен: ${webhookUrl}`);

        // Проверяем статус вебхука
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('Информация о вебхуке:', webhookInfo);
    } catch (error) {
        console.error('❌ Ошибка установки вебхука:', error);
    }
};

setWebhook();