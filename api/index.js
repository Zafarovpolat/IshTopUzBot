require('dotenv').config();
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

// Инициализация Firebase только если еще не инициализирован
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'ishtop-landing',
    });
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username || '';
    const uid = `telegram:${telegramId}`;
    
    try {
        console.log(`🔵 New Telegram login attempt: ${uid} (${firstName} ${lastName})`);
        
        // ✅ ШАГ 1: Создать custom token
        const customToken = await admin.auth().createCustomToken(uid, {
            telegramUsername: username,
        });
        console.log(`✅ Custom token created for ${uid}`);

        // ✅ ШАГ 2: Проверить существует ли документ в Firestore
        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // ✅ ШАГ 3: Создать базовый документ для нового пользователя
            await userRef.set({
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                email: '',  // Будет заполнен в onboarding
                phone: '',
                isVerified: false,
                profileComplete: false,  // ✅ Профиль не заполнен
                passwordSet: false,  // ✅ ВАЖНО: Пароль не установлен
                userType: '',  // Будет заполнен в onboarding (freelancer/client)
                profile: {
                    firstName: firstName || '',
                    lastName: lastName || '',
                    avatar: '',  // Telegram не предоставляет фото через bot API
                    city: '',
                    country: '',
                    dateOfBirth: '',
                    gender: '',
                    languages: [],
                    timezone: '',
                },
                wallet: {
                    balance: 0,
                    currency: 'UZS',
                    paymentMethods: [],
                    transactions: [],
                },
            });
            
            console.log(`✅ Created Firestore document for new user ${uid}`);
        } else {
            console.log(`ℹ️ User ${uid} already exists, updating lastLoginAt`);
            
            // ✅ Обновить lastLoginAt для существующих пользователей
            await userRef.update({
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // ✅ ШАГ 4: Отправить ссылку с токеном
        const siteUrl = process.env.SITE_URL || 'https://ishtopuz.vercel.app';
        const authLink = `${siteUrl}/auth?provider=telegram&token=${customToken}`;
        
        const greeting = firstName ? `Добро пожаловать, ${firstName}! 👋` : 'Добро пожаловать! 👋';
        
        await ctx.reply(
            `${greeting}\n\n` +
            `Нажмите на ссылку для входа на платформу IshtopUZ:\n\n` +
            `🔗 ${authLink}\n\n` +
            `${!userDoc.exists ? '✨ Ваш аккаунт создан! Завершите регистрацию на сайте.' : '✅ С возвращением!'}`
        );
        
        console.log(`✅ Auth link sent to ${uid}`);
        
    } catch (error) {
        console.error('❌ Ошибка в боте:', error);
        await ctx.reply('⚠️ Произошла ошибка при создании ссылки для входа. Попробуйте позже.');
    }
});

bot.help((ctx) => {
    ctx.reply(
        '📖 *Справка по боту IshtopUZ*\n\n' +
        'Используйте /start для получения ссылки на вход/регистрацию.\n\n' +
        'Если у вас возникли проблемы, свяжитесь с поддержкой.',
        { parse_mode: 'Markdown' }
    );
});

// ✅ Дополнительная команда для проверки статуса
bot.command('status', async (ctx) => {
    const telegramId = ctx.from.id;
    const uid = `telegram:${telegramId}`;
    
    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
            await ctx.reply('❌ Аккаунт не найден. Используйте /start для регистрации.');
        } else {
            const userData = userDoc.data();
            const status = 
                `✅ *Статус вашего аккаунта*\n\n` +
                `Email: ${userData.email || 'Не указан'}\n` +
                `Профиль: ${userData.profileComplete ? '✅ Заполнен' : '❌ Не заполнен'}\n` +
                `Пароль: ${userData.passwordSet ? '✅ Установлен' : '❌ Не установлен'}\n` +
                `Тип: ${userData.userType || 'Не выбран'}`;
            
            await ctx.reply(status, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('Ошибка при проверке статуса:', error);
        await ctx.reply('⚠️ Ошибка при получении статуса аккаунта.');
    }
});

// ✅ Обработка неизвестных команд
bot.on('text', (ctx) => {
    ctx.reply(
        '❓ Неизвестная команда.\n\n' +
        'Используйте /start для входа или /help для справки.'
    );
});

// Serverless function для Vercel
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Ошибка обработки обновления:', error);
        res.status(500).send('Internal Server Error');
    }
};

// ✅ Для локальной разработки (опционально)
if (process.env.NODE_ENV !== 'production') {
    bot.launch()
        .then(() => console.log('✅ Bot started in polling mode'))
        .catch(err => console.error('❌ Failed to start bot:', err));

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
