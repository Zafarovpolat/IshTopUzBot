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
        // ✅ ШАГ 1: Создать custom token
        const customToken = await admin.auth().createCustomToken(uid, {
            telegramUsername: username,
        });

        // ✅ ШАГ 2: Проверить существует ли документ в Firestore
        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // ✅ ШАГ 3: Создать базовый документ для нового пользователя
            await userRef.set({
                email: '', // Telegram users не имеют email
                phone: '',
                userType: '', // Будет заполнено в onboarding
                isVerified: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                profile: {
                    firstName: firstName,
                    lastName: lastName,
                    avatar: '', // Можно добавить позже из Telegram API
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
                profileComplete: false, // ❌ FALSE - требуется onboarding!
            });
            
            console.log(`✅ Created Firestore document for ${uid}`);
        } else {
            console.log(`✅ User ${uid} already exists, updating lastLoginAt`);
            
            // Обновить lastLoginAt для существующих пользователей
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
            `Нажмите на ссылку для входа/регистрации на сайте:\n\n${authLink}\n\n` +
            `Если вы новый пользователь, аккаунт создастся автоматически.`
        );
        
    } catch (error) {
        console.error('Ошибка в боте:', error);
        await ctx.reply('Ошибка при создании ссылки для входа. Попробуйте позже.');
    }
});

bot.help((ctx) => {
    ctx.reply('Используйте /start для получения ссылки на вход/регистрацию.');
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
        console.error('Ошибка обработки обновления:', error);
        res.status(500).send('Internal Server Error');
    }
};
