const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = "8573154507:AAFE7Drx_YDTpa7aNZLu9mD_0sv7s3CvWjU";
const MANAGERS = [8211976202, 6101289439];
const MANAGER_USERNAME = "prime41ks";
const REQUIRED_CHANNEL = "@prime_1edits";
const REPORT_GROUP_ID = -5102612415;

const bot = new TelegramBot(TOKEN, { polling: true });

// ========== ОСНОВНЫЕ ПЕРЕМЕННЫЕ ==========
let purchases = new Map();
let ratings = new Map();
let pendingOrders = new Map();
let referrers = new Map();
let referralCounts = new Map();
let purchaseHistory = new Map();
let users = new Map();
let testMode = new Map();

// ========== НОВЫЕ ПЕРЕМЕННЫЕ ==========
let achievements = new Map();
let userActivity = new Map();
let promocodes = new Map();
let blacklist = new Set();
let faq = [];
let templates = new Map();
let weeklyReferrals = new Map();
let userStats = new Map();
let usedPromocodes = new Map();

// ========== ФАЙЛЫ ДАННЫХ ==========
const DATA_FILE = "purchases.json";
const RATINGS_FILE = "ratings.json";
const REFERRALS_FILE = "referrals.json";
const REFERRER_FILE = "referrer.json";
const HISTORY_FILE = "history.json";
const USERS_FILE = "users.json";
const TESTMODE_FILE = "testmode.json";
const ACHIEVEMENTS_FILE = "achievements.json";
const USER_ACTIVITY_FILE = "user_activity.json";
const PROMOCODES_FILE = "promocodes.json";
const BLACKLIST_FILE = "blacklist.json";
const FAQ_FILE = "faq.json";
const TEMPLATES_FILE = "templates.json";
const WEEKLY_FILE = "weekly.json";
const USER_STATS_FILE = "user_stats.json";
const USED_PROMOCODES_FILE = "used_promocodes.json";

// ========== ЗАГРУЗКА ДАННЫХ ==========
if (fs.existsSync(DATA_FILE)) purchases = new Map(JSON.parse(fs.readFileSync(DATA_FILE)));
if (fs.existsSync(RATINGS_FILE)) ratings = new Map(JSON.parse(fs.readFileSync(RATINGS_FILE)));
if (fs.existsSync(REFERRALS_FILE)) referralCounts = new Map(JSON.parse(fs.readFileSync(REFERRALS_FILE)));
if (fs.existsSync(REFERRER_FILE)) referrers = new Map(JSON.parse(fs.readFileSync(REFERRER_FILE)));
if (fs.existsSync(USERS_FILE)) users = new Map(JSON.parse(fs.readFileSync(USERS_FILE)));
if (fs.existsSync(TESTMODE_FILE)) testMode = new Map(JSON.parse(fs.readFileSync(TESTMODE_FILE)));
if (fs.existsSync(ACHIEVEMENTS_FILE)) achievements = new Map(JSON.parse(fs.readFileSync(ACHIEVEMENTS_FILE)));
if (fs.existsSync(USER_ACTIVITY_FILE)) userActivity = new Map(JSON.parse(fs.readFileSync(USER_ACTIVITY_FILE)));
if (fs.existsSync(BLACKLIST_FILE)) blacklist = new Set(JSON.parse(fs.readFileSync(BLACKLIST_FILE)));
if (fs.existsSync(FAQ_FILE)) faq = JSON.parse(fs.readFileSync(FAQ_FILE));
if (fs.existsSync(WEEKLY_FILE)) weeklyReferrals = new Map(JSON.parse(fs.readFileSync(WEEKLY_FILE)));
if (fs.existsSync(USER_STATS_FILE)) userStats = new Map(JSON.parse(fs.readFileSync(USER_STATS_FILE)));
if (fs.existsSync(USED_PROMOCODES_FILE)) usedPromocodes = new Map(JSON.parse(fs.readFileSync(USED_PROMOCODES_FILE)));

if (fs.existsSync(PROMOCODES_FILE)) {
    const promos = JSON.parse(fs.readFileSync(PROMOCODES_FILE));
    promocodes = new Map(Object.entries(promos));
}

if (fs.existsSync(TEMPLATES_FILE)) {
    const temps = JSON.parse(fs.readFileSync(TEMPLATES_FILE));
    templates = new Map(Object.entries(temps));
}

if (fs.existsSync(HISTORY_FILE)) {
    const historyArray = JSON.parse(fs.readFileSync(HISTORY_FILE));
    purchaseHistory = new Map(historyArray.map(item => [item[0], new Map(item[1])]));
}

// ========== ФУНКЦИИ СОХРАНЕНИЯ ==========
function savePurchases() { fs.writeFileSync(DATA_FILE, JSON.stringify([...purchases])); }
function saveRatings() { fs.writeFileSync(RATINGS_FILE, JSON.stringify([...ratings])); }
function saveReferrals() { fs.writeFileSync(REFERRALS_FILE, JSON.stringify([...referralCounts])); }
function saveReferrer() { fs.writeFileSync(REFERRER_FILE, JSON.stringify([...referrers])); }
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify([...users])); }
function saveTestMode() { fs.writeFileSync(TESTMODE_FILE, JSON.stringify([...testMode])); }
function saveAchievements() { fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify([...achievements])); }
function saveUserActivity() { fs.writeFileSync(USER_ACTIVITY_FILE, JSON.stringify([...userActivity])); }
function savePromocodes() { fs.writeFileSync(PROMOCODES_FILE, JSON.stringify(Object.fromEntries(promocodes))); }
function saveBlacklist() { fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([...blacklist])); }
function saveFaq() { fs.writeFileSync(FAQ_FILE, JSON.stringify(faq)); }
function saveTemplates() { fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(Object.fromEntries(templates))); }
function saveWeekly() { fs.writeFileSync(WEEKLY_FILE, JSON.stringify([...weeklyReferrals])); }
function saveUserStats() { fs.writeFileSync(USER_STATS_FILE, JSON.stringify([...userStats])); }
function saveUsedPromocodes() { fs.writeFileSync(USED_PROMOCODES_FILE, JSON.stringify([...usedPromocodes])); }

function saveHistory() {
    const historyArray = [];
    for (const [userId, historyMap] of purchaseHistory) {
        historyArray.push([userId, [...historyMap]]);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyArray));
}

// ========== СПИСОК ВСЕХ АЧИВОК ==========
const ALL_ACHIEVEMENTS = {
    "first_purchase": { name: "🎯 Первый шаг", desc: "Совершил первую покупку", icon: "🎯", type: "purchase", need: 1 },
    "first_referral": { name: "👥 Первый друг", desc: "Пригласил первого реферала", icon: "👥", type: "referral", need: 1 },
    "sniper": { name: "🎯 Снайпер", desc: "Купил подарок в первый день", icon: "🎯", type: "sniper", need: 1 },
    "king_referral": { name: "👑 Король рефералов", desc: "Пригласил 10 рефералов", icon: "👑", type: "referral", need: 10 },
    "vip": { name: "💎 VIP", desc: "Совершил 5 покупок", icon: "💎", type: "purchase", need: 5 },
    "bear_lover": { name: "🐻 Любитель мишек", desc: "Купил 3 мишки", icon: "🐻", type: "gift_bear", need: 3 },
    "romantic": { name: "💝 Романтик", desc: "Купил 3 романтичных подарка", icon: "💝", type: "gift_romantic", need: 3 },
    "photographer": { name: "📸 Фотограф", desc: "Отправил фотоотчёт", icon: "📸", type: "photo", need: 1 },
    "streak_7": { name: "🔥 7 дней подряд", desc: "Заходил 7 дней подряд", icon: "🔥", type: "streak", need: 7 },
    "streak_30": { name: "⚡ Легенда", desc: "Заходил 30 дней подряд", icon: "⚡", type: "streak", need: 30 },
    "referral_master": { name: "🎓 Мастер рефералов", desc: "Пригласил 50 рефералов", icon: "🎓", type: "referral", need: 50 }
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getUserGiftCount(userId, giftName) {
    const userHistory = purchaseHistory.get(userId);
    if (!userHistory) return 0;
    let count = 0;
    for (const purchase of userHistory.values()) {
        if (purchase.giftName === giftName) count++;
    }
    return count;
}

function getUserTotalSpent(userId) {
    const userHistory = purchaseHistory.get(userId);
    if (!userHistory) return 0;
    let total = 0;
    for (const purchase of userHistory.values()) {
        total += purchase.price;
    }
    return total;
}

function checkAchievements(userId) {
    if (!achievements.has(userId)) achievements.set(userId, new Set());
    const userAchievements = achievements.get(userId);
    const newAchievements = [];
    
    const purchaseCount = ratings.get(userId) || 0;
    const referralCount = referralCounts.get(userId) || 0;
    const bearCount = getUserGiftCount(userId, "🧸 Мишка");
    const romanticCount = getUserGiftCount(userId, "💝 Романтичный подарок");
    const activity = userActivity.get(userId) || { dailyStreak: 0 };
    
    for (const [key, ach] of Object.entries(ALL_ACHIEVEMENTS)) {
        if (userAchievements.has(key)) continue;
        
        let earned = false;
        if (ach.type === "purchase" && purchaseCount >= ach.need) earned = true;
        else if (ach.type === "referral" && referralCount >= ach.need) earned = true;
        else if (ach.type === "gift_bear" && bearCount >= ach.need) earned = true;
        else if (ach.type === "gift_romantic" && romanticCount >= ach.need) earned = true;
        else if (ach.type === "streak" && (activity.dailyStreak || 0) >= ach.need) earned = true;
        
        if (earned) {
            userAchievements.add(key);
            newAchievements.push(ach);
        }
    }
    
    if (newAchievements.length > 0) {
        saveAchievements();
        return newAchievements;
    }
    return [];
}

function updateActivity(userId) {
    const today = new Date().toDateString();
    let activity = userActivity.get(userId) || { lastActive: null, dailyStreak: 0, weeklyActivity: [] };
    const lastActive = activity.lastActive ? new Date(activity.lastActive).toDateString() : null;
    
    if (lastActive === today) return;
    
    if (lastActive && new Date(activity.lastActive).getTime() + 86400000 >= Date.now()) {
        activity.dailyStreak = (activity.dailyStreak || 0) + 1;
    } else if (lastActive !== today) {
        activity.dailyStreak = 1;
    }
    
    activity.lastActive = Date.now();
    userActivity.set(userId, activity);
    saveUserActivity();
    
    const newAchievements = checkAchievements(userId);
    return newAchievements;
}

function updateWeeklyReferrals(referrerId) {
    const weekKey = getWeekKey();
    let weekly = weeklyReferrals.get(referrerId) || {};
    weekly[weekKey] = (weekly[weekKey] || 0) + 1;
    weeklyReferrals.set(referrerId, weekly);
    saveWeekly();
}

function getWeekKey() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / 86400000);
    return Math.ceil(days / 7);
}

function getWeeklyTop() {
    const weekKey = getWeekKey();
    const top = [];
    for (const [userId, weeks] of weeklyReferrals) {
        const count = weeks[weekKey] || 0;
        if (count > 0) top.push({ userId, count });
    }
    top.sort((a, b) => b.count - a.count);
    return top.slice(0, 10);
}

async function checkSubscription(userId) {
    try {
        const chatMember = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        return chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator';
    } catch (error) {
        return false;
    }
}

async function registerUser(userId, username, firstName) {
    if (!users.has(userId)) {
        users.set(userId, {
            id: userId,
            username: username || null,
            firstName: firstName,
            regDate: Date.now(),
            regDateStr: new Date().toLocaleString('ru-RU')
        });
        saveUsers();
    }
    
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            totalVisits: 0,
            firstVisit: Date.now(),
            lastVisit: Date.now()
        });
        saveUserStats();
    }
    
    const stats = userStats.get(userId);
    stats.totalVisits++;
    stats.lastVisit = Date.now();
    userStats.set(userId, stats);
    saveUserStats();
    
    updateActivity(userId);
}

function addToHistory(userId, giftName, recipient, price, paymentMethod) {
    if (!purchaseHistory.has(userId)) {
        purchaseHistory.set(userId, new Map());
    }
    const userHistory = purchaseHistory.get(userId);
    const purchaseId = Date.now();
    userHistory.set(purchaseId, {
        id: purchaseId,
        giftName,
        recipient,
        price,
        paymentMethod,
        date: purchaseId,
        dateStr: new Date(purchaseId).toLocaleString('ru-RU')
    });
    saveHistory();
    return purchaseId;
}

function getUserHistory(userId, limit = 10) {
    const userHistory = purchaseHistory.get(userId);
    if (!userHistory || userHistory.size === 0) return [];
    const historyArray = [];
    for (const [id, purchase] of userHistory) {
        historyArray.push(purchase);
    }
    historyArray.sort((a, b) => b.date - a.date);
    return historyArray.slice(0, limit);
}

function getBalance(userId) {
    const refCount = referralCounts.get(userId) || 0;
    return refCount * 5;
}

function getReferralRank(userId) {
    const count = referralCounts.get(userId) || 0;
    if (count === 0) return "📌 Новичок";
    if (count < 3) return "🌱 Начинающий";
    if (count < 10) return "⭐ Активный";
    if (count < 25) return "🔥 Лидер";
    if (count < 50) return "👑 Эксперт";
    return "💎 Легенда";
}

function addReferral(referrerId, newUserId) {
    if (referrerId === newUserId) return false;
    if (referrers.has(newUserId)) return false;
    if (blacklist.has(referrerId) || blacklist.has(newUserId)) return false;

    referrers.set(newUserId, referrerId);
    const currentCount = referralCounts.get(referrerId) || 0;
    referralCounts.set(referrerId, currentCount + 1);
    
    updateWeeklyReferrals(referrerId);

    saveReferrals();
    saveReferrer();
    return true;
}

function applyPromocode(userId, code) {
    const promo = promocodes.get(code.toUpperCase());
    if (!promo) return { success: false, message: "❌ Промокод не найден" };
    if (!promo.active) return { success: false, message: "❌ Промокод не активен" };
    if (promo.uses >= promo.maxUses) return { success: false, message: "❌ Промокод использован максимальное количество раз" };
    
    const userPromos = usedPromocodes.get(userId) || new Set();
    if (userPromos.has(code.toUpperCase())) return { success: false, message: "❌ Вы уже использовали этот промокод" };
    
    userPromos.add(code.toUpperCase());
    usedPromocodes.set(userId, userPromos);
    promo.uses++;
    savePromocodes();
    saveUsedPromocodes();
    
    return { success: true, discount: promo.discount, message: `✅ Промокод активирован! Скидка ${promo.discount}% на следующую покупку` };
}

function getPurchaseRatingBadge(rating) {
    if (rating === 0) return "🆕 Новый покупатель";
    if (rating === 1) return "🥉 Бронза";
    if (rating === 2) return "🥈 Серебро";
    if (rating === 3) return "🥇 Золото";
    if (rating >= 5) return "💎 Бриллиант";
    return `⭐ ${rating} покупок`;
}

function isManager(userId) {
    return MANAGERS.includes(userId) || testMode.get(userId);
}

function isTestMode(userId) {
    return testMode.get(userId) || false;
}

function toggleTestMode(userId) {
    const current = testMode.get(userId) || false;
    testMode.set(userId, !current);
    saveTestMode();
    return !current;
}

function notifyManagers(text) {
    for (const id of MANAGERS) {
        bot.sendMessage(id, text, { parse_mode: 'Markdown' }).catch(() => {});
    }
}

async function sendPhotoReport(userId, giftName, recipient, paymentMethod, photoPath) {
    const user = users.get(userId) || {};
    const text = `📸 *НОВЫЙ ФОТООТЧЁТ!*\n\n` +
        `👤 Клиент: ${user.firstName || 'Неизвестно'} @${user.username || 'нет'}\n` +
        `🆔 ID: ${userId}\n` +
        `🎁 Подарок: ${giftName}\n` +
        `👥 Получатель: ${recipient}\n` +
        `💳 Оплата: ${paymentMethod === 'balance' ? 'балансом' : 'менеджеру'}\n` +
        `📅 Дата: ${new Date().toLocaleString('ru-RU')}`;
    
    try {
        await bot.sendPhoto(REPORT_GROUP_ID, photoPath, { caption: text, parse_mode: 'Markdown' });
        
        if (!achievements.has(userId)) achievements.set(userId, new Set());
        const userAchievements = achievements.get(userId);
        if (!userAchievements.has("photographer")) {
            userAchievements.add("photographer");
            saveAchievements();
            bot.sendMessage(userId, "📸 *АЧИВКА ПОЛУЧЕНА!*\n\nФотограф — спасибо за фотоотчёт!", { parse_mode: 'Markdown' });
        }
    } catch (error) {
        await bot.sendMessage(REPORT_GROUP_ID, text + '\n\n❌ Фото не загрузилось', { parse_mode: 'Markdown' });
    }
}

async function showDashboard(chatId) {
    const totalUsers = users.size;
    const totalReferrals = Array.from(referralCounts.values()).reduce((a, b) => a + b, 0);
    let totalPurchases = 0;
    for (const userHistory of purchaseHistory.values()) {
        totalPurchases += userHistory.size;
    }
    const totalRevenue = totalPurchases * 15;
    const totalBalance = totalReferrals * 5;
    const pendingCount = pendingOrders.size;
    
    const rankStats = { "Новичок": 0, "Начинающий": 0, "Активный": 0, "Лидер": 0, "Эксперт": 0, "Легенда": 0 };
    for (const [userId, count] of referralCounts) {
        const rank = getReferralRank(userId);
        if (rank.includes("Новичок")) rankStats["Новичок"]++;
        else if (rank.includes("Начинающий")) rankStats["Начинающий"]++;
        else if (rank.includes("Активный")) rankStats["Активный"]++;
        else if (rank.includes("Лидер")) rankStats["Лидер"]++;
        else if (rank.includes("Эксперт")) rankStats["Эксперт"]++;
        else if (rank.includes("Легенда")) rankStats["Легенда"]++;
    }
    
    let totalAchievements = 0;
    for (const userAch of achievements.values()) {
        totalAchievements += userAch.size;
    }
    
    const dashboardText = `📊 *ДАШБОРД БОТА*\n\n` +
        `👥 *ПОЛЬЗОВАТЕЛИ*\nВсего: ${totalUsers}\nАктивных: ${ratings.size}\n\n` +
        `💰 *ФИНАНСЫ*\nВыручка: ${totalRevenue} ₽\nРеферальный фонд: ${totalBalance} ₽\nПокупок: ${totalPurchases}\nОжидает: ${pendingCount}\n\n` +
        `👥 *РЕФЕРАЛЫ*\nВсего: ${totalReferrals}\nРефереров: ${referralCounts.size}\n\n` +
        `🏆 *АЧИВКИ*\nВыдано: ${totalAchievements}\nВсего: ${Object.keys(ALL_ACHIEVEMENTS).length}\n\n` +
        `🔧 *ТЕСТОВЫЙ РЕЖИМ:* ${isTestMode(chatId) ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЁН'}\n` +
        `🚫 *ЧЁРНЫЙ СПИСОК:* ${blacklist.size} пользователей`;
    
    await bot.sendMessage(chatId, dashboardText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 Обновить', callback_data: 'refresh_dashboard' }],
                [{ text: '🔧 Тестовый режим', callback_data: 'toggle_testmode' }]
            ]
        }
    });
}

async function getUserProfile(userId) {
    const user = users.get(userId) || { firstName: "Пользователь", regDateStr: "неизвестно" };
    const purchaseRating = getPurchaseRatingBadge(ratings.get(userId) || 0);
    const balance = getBalance(userId);
    const refCount = referralCounts.get(userId) || 0;
    const referralRank = getReferralRank(userId);
    const totalSpent = getUserTotalSpent(userId);
    const purchaseCount = ratings.get(userId) || 0;
    const stats = userStats.get(userId) || { totalVisits: 0, firstVisit: Date.now() };
    const activity = userActivity.get(userId) || { dailyStreak: 0 };
    const userAchievements = achievements.get(userId) || new Set();
    
    let achievementsText = "";
    for (const ach of userAchievements) {
        const achData = ALL_ACHIEVEMENTS[ach];
        if (achData) achievementsText += `${achData.icon} ${achData.name}\n`;
    }
    if (!achievementsText) achievementsText = "Пока нет достижений";
    
    let nextPurchaseLevel = "";
    if (purchaseCount < 1) nextPurchaseLevel = "До Бронзы: 1 покупка";
    else if (purchaseCount < 2) nextPurchaseLevel = "До Серебра: 1 покупка";
    else if (purchaseCount < 3) nextPurchaseLevel = "До Золота: 1 покупка";
    else if (purchaseCount < 5) nextPurchaseLevel = "До Бриллианта: " + (5 - purchaseCount) + " покупки";
    else nextPurchaseLevel = "Максимальный уровень! 💎";
    
    let nextReferralLevel = "";
    if (refCount < 1) nextReferralLevel = "До Начинающего: 1 реферал";
    else if (refCount < 3) nextReferralLevel = "До Активного: " + (3 - refCount) + " реферала";
    else if (refCount < 10) nextReferralLevel = "До Лидера: " + (10 - refCount) + " рефералов";
    else if (refCount < 25) nextReferralLevel = "До Эксперта: " + (25 - refCount) + " рефералов";
    else if (refCount < 50) nextReferralLevel = "До Легенды: " + (50 - refCount) + " рефералов";
    else nextReferralLevel = "Максимальный уровень! 👑";
    
    return `👤 *ПРОФИЛЬ*\n\n` +
        `Имя: ${user.firstName}\n` +
        `ID: ${userId}\n` +
        `Дата регистрации: ${user.regDateStr}\n\n` +
        `📊 *СТАТИСТИКА*\n` +
        `👥 Рефералов: ${refCount}\n` +
        `💰 Баланс: ${balance} руб\n` +
        `🎁 Покупок: ${purchaseCount}\n` +
        `💸 Потрачено: ${totalSpent} руб\n` +
        `🏆 Рейтинг покупок: ${purchaseRating}\n` +
        `👑 Рейтинг рефералов: ${referralRank}\n` +
        `🔥 Серия заходов: ${activity.dailyStreak || 0} дней\n` +
        `👀 Всего визитов: ${stats.totalVisits || 0}\n\n` +
        `🎯 *СЛЕДУЮЩИЙ УРОВЕНЬ*\n` +
        `📦 Покупки: ${nextPurchaseLevel}\n` +
        `👥 Рефералы: ${nextReferralLevel}\n\n` +
        `🏅 *ДОСТИЖЕНИЯ*\n${achievementsText}`;
}

function getReferralTop() {
    const top = [];
    for (const [userId, count] of referralCounts) {
        const user = users.get(userId) || {};
        top.push({ userId, count, name: user.firstName || `ID${userId}` });
    }
    top.sort((a, b) => b.count - a.count);
    return top.slice(0, 10);
}

function getPurchaseTop() {
    const top = [];
    for (const [userId, count] of ratings) {
        const user = users.get(userId) || {};
        top.push({ userId, count, name: user.firstName || `ID${userId}` });
    }
    top.sort((a, b) => b.count - a.count);
    return top.slice(0, 10);
}

function getAllHistory() {
    const allHistory = [];
    for (const [userId, userHistory] of purchaseHistory) {
        for (const [id, purchase] of userHistory) {
            allHistory.push({ userId, ...purchase });
        }
    }
    allHistory.sort((a, b) => b.date - a.date);
    return allHistory;
}

// ========== ГЛАВНОЕ МЕНЮ (ИНЛАЙН-КНОПКИ) ==========
async function showMainMenu(chatId, userId) {
    const balance = getBalance(userId);
    const refCount = referralCounts.get(userId) || 0;
    const purchaseRating = getPurchaseRatingBadge(ratings.get(userId) || 0);
    
    const menuText = `🐻 *ГЛАВНОЕ МЕНЮ*\n\n` +
        `💰 Баланс: ${balance} руб\n` +
        `👥 Рефералов: ${refCount}\n` +
        `🏆 Рейтинг: ${purchaseRating}\n\n` +
        `Выберите действие:`;
    
    await bot.sendMessage(chatId, menuText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎁 Купить подарок', callback_data: 'menu_buy' }],
                [{ text: '👤 Мой профиль', callback_data: 'menu_profile' }],
                [{ text: '💰 Мой баланс', callback_data: 'menu_balance' }],
                [{ text: '👥 Мои рефералы', callback_data: 'menu_referrals' }],
                [{ text: '📜 История покупок', callback_data: 'menu_history' }],
                [{ text: '🏆 Топ пользователей', callback_data: 'menu_top' }],
                [{ text: '🏅 Мои достижения', callback_data: 'menu_achievements' }],
                [{ text: '🎫 Промокод', callback_data: 'menu_promo' }],
                [{ text: '❓ Помощь / Команды', callback_data: 'menu_help' }],
                [{ text: '📞 Связаться с менеджером', callback_data: 'menu_manager' }]
            ]
        }
    });
}

// ========== АВТООБНОВЛЕНИЕ ==========
async function refreshBotCache() {
    try {
        const me = await bot.getMe();
        bot.options.username = me.username;
    } catch (e) {}
}
setInterval(refreshBotCache, 15 * 60 * 1000);
refreshBotCache();

// ========== КОМАНДЫ ПОЛЬЗОВАТЕЛЕЙ ==========
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const userId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;
    
    if (blacklist.has(userId)) {
        bot.sendMessage(msg.chat.id, "🚫 Вы заблокированы в боте. По вопросам: @prime41ks");
        return;
    }
    
    await registerUser(userId, username, firstName);
    
    const isSubscribed = await checkSubscription(userId);
    if (!isSubscribed && !isManager(userId)) {
        const channelLink = REQUIRED_CHANNEL.startsWith('@') ? `https://t.me/${REQUIRED_CHANNEL.slice(1)}` : REQUIRED_CHANNEL;
        bot.sendMessage(msg.chat.id,
            `🔒 *ТРЕБУЕТСЯ ПОДПИСКА*\n\n` +
            `Для использования бота необходимо подписаться на наш канал:\n` +
            `${REQUIRED_CHANNEL}\n\n` +
            `После подписки нажми кнопку ниже:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📢 Подписаться', url: channelLink }],
                        [{ text: '✅ Проверить подписку', callback_data: 'check_subscribe' }]
                    ]
                }
            }
        );
        return;
    }
    
    // Обработка реферальной ссылки
    if (match && match[1] && !isNaN(parseInt(match[1]))) {
        const referrerId = parseInt(match[1]);
        if (referrerId !== userId && !referrers.has(userId)) {
            const added = addReferral(referrerId, userId);
            if (added) {
                const newBalance = getBalance(referrerId);
                bot.sendMessage(referrerId,
                    `🎉 *НОВЫЙ РЕФЕРАЛ!*\n\n` +
                    `👤 ${firstName} @${username || 'без username'} присоединился!\n` +
                    `💰 Твой баланс: ${newBalance} руб.`,
                    { parse_mode: 'Markdown' }
                );
                bot.sendMessage(msg.chat.id, `✅ Ты зарегистрирован по реферальной ссылке!`);
                
                const newAchs = checkAchievements(referrerId);
                if (newAchs.length > 0) {
                    for (const ach of newAchs) {
                        bot.sendMessage(referrerId, `🏆 *НОВАЯ АЧИВКА!*\n\n${ach.icon} ${ach.name}\n${ach.desc}`, { parse_mode: 'Markdown' });
                    }
                }
            }
        }
    }
    
    await showMainMenu(msg.chat.id, userId);
});

bot.onText(/\/menu/, async (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    await showMainMenu(msg.chat.id, userId);
});

bot.onText(/\/profile/, async (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const profile = await getUserProfile(userId);
    bot.sendMessage(msg.chat.id, profile, { parse_mode: 'Markdown' });
});

bot.onText(/\/balance/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const balance = getBalance(userId);
    const refCount = referralCounts.get(userId) || 0;
    bot.sendMessage(msg.chat.id,
        `💰 *ТВОЙ БАЛАНС*\n\n` +
        `Баланс: ${balance} руб.\n` +
        `👥 Рефералов: ${refCount}\n` +
        `💵 1 реферал = 5 руб.`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/referrals/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const refCount = referralCounts.get(userId) || 0;
    const balance = getBalance(userId);
    const rank = getReferralRank(userId);
    const refLink = `https://t.me/${bot.options.username || 'bot_username'}?start=${userId}`;

    bot.sendMessage(msg.chat.id,
        `👥 *ТВОИ РЕФЕРАЛЫ*\n\n` +
        `Всего рефералов: ${refCount}\n` +
        `💰 Заработано: ${balance} руб.\n` +
        `🏆 Рейтинг: ${rank}\n\n` +
        `🔗 Твоя ссылка:\n${refLink}`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/history/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const history = getUserHistory(userId, 10);
    
    if (history.length === 0) {
        bot.sendMessage(msg.chat.id, "📭 У вас пока нет покупок");
        return;
    }
    
    let text = "📜 *ИСТОРИЯ ПОКУПОК*\n\n";
    for (const purchase of history) {
        text += `🆔 #${purchase.id.toString().slice(-6)}\n`;
        text += `🎁 ${purchase.giftName}\n`;
        text += `👥 Для: ${purchase.recipient}\n`;
        text += `💰 ${purchase.price} ₽ (${purchase.paymentMethod === 'balance' ? '💳 баланс' : '👨‍💼 менеджеру'})\n`;
        text += `📅 ${purchase.dateStr}\n`;
        text += `━━━━━━━━━━━━━━━━\n`;
    }
    
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/top/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    
    const referralTop = getReferralTop();
    const purchaseTop = getPurchaseTop();
    
    let text = "🏆 *ТОП РЕФЕРАЛОВ*\n\n";
    for (let i = 0; i < Math.min(5, referralTop.length); i++) {
        const t = referralTop[i];
        text += `${i+1}. ${t.name} — ${t.count} рефералов (${t.count*5} руб)\n`;
    }
    
    text += "\n🏆 *ТОП ПОКУПОК*\n\n";
    for (let i = 0; i < Math.min(5, purchaseTop.length); i++) {
        const t = purchaseTop[i];
        text += `${i+1}. ${t.name} — ${t.count} покупок\n`;
    }
    
    const weeklyTop = getWeeklyTop();
    if (weeklyTop.length > 0) {
        text += "\n📅 *ТОП НЕДЕЛИ*\n\n";
        for (let i = 0; i < Math.min(5, weeklyTop.length); i++) {
            const t = weeklyTop[i];
            const user = users.get(t.userId) || {};
            text += `${i+1}. ${user.firstName || t.userId} — ${t.count} рефералов\n`;
        }
    }
    
    const userRefCount = referralCounts.get(userId) || 0;
    let position = 1;
    for (const t of referralTop) {
        if (t.userId === userId) break;
        position++;
    }
    if (userRefCount > 0) text += `\n📍 Твоё место в топе рефералов: #${position}`;
    
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/achievements/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    
    const userAchievements = achievements.get(userId) || new Set();
    
    if (userAchievements.size === 0) {
        bot.sendMessage(msg.chat.id, "🏅 У вас пока нет достижений. Совершайте покупки и приглашайте друзей!");
        return;
    }
    
    let text = "🏅 *ВАШИ ДОСТИЖЕНИЯ*\n\n";
    for (const ach of userAchievements) {
        const achData = ALL_ACHIEVEMENTS[ach];
        if (achData) text += `${achData.icon} **${achData.name}** — ${achData.desc}\n\n`;
    }
    
    text += `\n📊 Всего: ${userAchievements.size} из ${Object.keys(ALL_ACHIEVEMENTS).length}`;
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/promo (.+)/, (msg, match) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    
    const code = match[1];
    const result = applyPromocode(userId, code);
    bot.sendMessage(msg.chat.id, result.message);
});

bot.onText(/\/rating/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const rating = ratings.get(userId) || 0;
    bot.sendMessage(msg.chat.id, `🏆 Твой рейтинг покупок: ${getPurchaseRatingBadge(rating)}`);
});

bot.onText(/\/check/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const lastBuy = purchases.get(userId);
    if (!lastBuy) {
        bot.sendMessage(msg.chat.id, "✅ Ты можешь купить подарок! Введи /menu");
    } else {
        const daysLeft = Math.ceil((lastBuy + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysLeft <= 0) bot.sendMessage(msg.chat.id, "✅ Можно купить! /menu");
        else bot.sendMessage(msg.chat.id, `⏳ Через ${daysLeft} дн.`);
    }
});

bot.onText(/\/today/, (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const lastBuy = purchases.get(userId);
    if (!lastBuy || Date.now() >= lastBuy + 30 * 24 * 60 * 60 * 1000) {
        bot.sendMessage(msg.chat.id, "🎉 *СЕГОДНЯ МОЖНО КУПИТЬ!* /menu", { parse_mode: 'Markdown' });
    } else {
        const daysLeft = Math.ceil((lastBuy + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
        bot.sendMessage(msg.chat.id, `❌ Не сегодня, через ${daysLeft} дн.`);
    }
});

bot.onText(/\/manager/, (msg) => {
    bot.sendMessage(msg.chat.id, `📞 Менеджер: @${MANAGER_USERNAME}`);
});

bot.onText(/\/faq/, (msg) => {
    if (faq.length === 0) {
        bot.sendMessage(msg.chat.id, "❓ FAQ пока пуст");
        return;
    }
    
    let text = "❓ *ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ*\n\n";
    for (let i = 0; i < faq.length; i++) {
        text += `${i+1}. *${faq[i].question}*\n${faq[i].answer}\n\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, async (msg) => {
    const userId = msg.from.id;
    await showMainMenu(msg.chat.id, userId);
});

// ========== КОМАНДЫ МЕНЕДЖЕРА ==========
bot.onText(/\/dashboard/, (msg) => {
    if (!isManager(msg.from.id)) return;
    showDashboard(msg.chat.id);
});

bot.onText(/\/testmode/, (msg) => {
    if (!isManager(msg.from.id)) return;
    const newMode = toggleTestMode(msg.from.id);
    bot.sendMessage(msg.chat.id, `🔧 Тестовый режим: ${newMode ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЁН'}`);
});

bot.onText(/\/export/, (msg) => {
    if (!isManager(msg.from.id)) return;
    
    const data = {
        users: [...users],
        purchases: [...purchases],
        ratings: [...ratings],
        referrals: [...referralCounts],
        history: [...purchaseHistory].map(([k, v]) => [k, [...v]])
    };
    
    fs.writeFileSync("export_backup.json", JSON.stringify(data, null, 2));
    bot.sendDocument(msg.chat.id, "export_backup.json", { caption: "📤 Экспорт данных" });
});

bot.onText(/\/ban (\d+)/, (msg, match) => {
    if (!isManager(msg.from.id)) return;
    const userId = parseInt(match[1]);
    blacklist.add(userId);
    saveBlacklist();
    bot.sendMessage(msg.chat.id, `🚫 Пользователь ${userId} заблокирован`);
});

bot.onText(/\/unban (\d+)/, (msg, match) => {
    if (!isManager(msg.from.id)) return;
    const userId = parseInt(match[1]);
    blacklist.delete(userId);
    saveBlacklist();
    bot.sendMessage(msg.chat.id, `✅ Пользователь ${userId} разблокирован`);
});

bot.onText(/\/blacklist/, (msg) => {
    if (!isManager(msg.from.id)) return;
    if (blacklist.size === 0) {
        bot.sendMessage(msg.chat.id, "🚫 Чёрный список пуст");
        return;
    }
    let text = "🚫 *ЧЁРНЫЙ СПИСОК*\n\n";
    for (const id of blacklist) {
        text += `🆔 ${id}\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/faq_add (.+?) \|\| (.+)/, (msg, match) => {
    if (!isManager(msg.from.id)) return;
    const question = match[1];
    const answer = match[2];
    faq.push({ question, answer });
    saveFaq();
    bot.sendMessage(msg.chat.id, `✅ FAQ добавлен:\n❓ ${question}\n📝 ${answer}`);
});

bot.onText(/\/pending/, (msg) => {
    if (!isManager(msg.from.id)) return;
    if (pendingOrders.size === 0) {
        bot.sendMessage(msg.chat.id, "📭 Нет ожидающих заявок");
        return;
    }
    let text = "📋 *ОЖИДАЮЩИЕ ЗАЯВКИ*\n\n";
    for (const [userId, order] of pendingOrders) {
        text += `🆔 ID: ${userId}\n🎁 ${order.giftName}\n👥 Получатель: ${order.recipient}\n📅 ${new Date(order.date).toLocaleString()}\n\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/stats/, (msg) => {
    if (!isManager(msg.from.id)) return;
    let totalReferrals = 0;
    for (const count of referralCounts.values()) totalReferrals += count;
    let totalPurchases = 0;
    for (const userHistory of purchaseHistory.values()) totalPurchases += userHistory.size;
    bot.sendMessage(msg.chat.id,
        `📊 *СТАТИСТИКА*\n\n` +
        `📦 Покупок: ${totalPurchases}\n` +
        `👥 Покупателей: ${ratings.size}\n` +
        `💰 Выручка: ${totalPurchases * 15} ₽\n` +
        `⏳ Ожидает: ${pendingOrders.size}\n\n` +
        `👥 Всего рефералов: ${totalReferrals}\n` +
        `💵 Выплачено: ${totalReferrals * 5} ₽\n` +
        `🔗 Рефереров: ${referralCounts.size}`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/allhistory/, (msg) => {
    if (!isManager(msg.from.id)) return;
    const allHistory = getAllHistory();
    if (allHistory.length === 0) {
        bot.sendMessage(msg.chat.id, "📭 Нет ни одной покупки");
        return;
    }
    let text = "📜 *ПОЛНАЯ ИСТОРИЯ ПОКУПОК*\n\n";
    let totalSum = 0;
    for (const purchase of allHistory.slice(0, 20)) {
        text += `🆔 ${purchase.userId}\n🎁 ${purchase.giftName}\n👥 ${purchase.recipient}\n💰 ${purchase.price} ₽\n📅 ${purchase.dateStr}\n━━━━━━━━━━\n`;
        totalSum += purchase.price;
    }
    text += `\n📊 ИТОГО: ${allHistory.length} покупок на сумму ${totalSum} ₽`;
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/refresh/, async (msg) => {
    if (!isManager(msg.from.id)) return;
    const me = await bot.getMe();
    bot.options.username = me.username;
    bot.sendMessage(msg.chat.id, `✅ Обновлено! @${me.username}`);
});

// ========== ОБРАБОТКА КНОПОК ==========
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const msg = callbackQuery.message;
    
    if (blacklist.has(userId)) {
        bot.answerCallbackQuery(callbackQuery.id, { text: "🚫 Вы заблокированы" });
        return;
    }
    
    // Проверка подписки
    if (data === 'check_subscribe') {
        const isSubscribed = await checkSubscription(userId);
        if (isSubscribed) {
            bot.sendMessage(msg.chat.id, "✅ Спасибо за подписку!");
            await showMainMenu(msg.chat.id, userId);
            bot.answerCallbackQuery(callbackQuery.id);
        } else {
            bot.sendMessage(msg.chat.id, "❌ Вы ещё не подписаны. Подпишитесь на канал и нажмите кнопку снова.");
            bot.answerCallbackQuery(callbackQuery.id);
        }
        return;
    }
    
    // Дашборд менеджера
    if (data === 'refresh_dashboard' && isManager(userId)) {
        await showDashboard(msg.chat.id);
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'toggle_testmode' && isManager(userId)) {
        const newMode = toggleTestMode(userId);
        bot.sendMessage(msg.chat.id, `🔧 Тестовый режим: ${newMode ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЁН'}`);
        await showDashboard(msg.chat.id);
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    // ========== ГЛАВНОЕ МЕНЮ ==========
    if (data === 'menu_buy') {
        const lastBuy = purchases.get(userId);
        if (lastBuy && Date.now() - lastBuy < 30 * 24 * 60 * 60 * 1000 && !isTestMode(userId)) {
            const daysLeft = Math.ceil((lastBuy + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
            bot.sendMessage(msg.chat.id, `⏳ Следующая покупка через ${daysLeft} дн.`, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        
        bot.sendMessage(msg.chat.id,
            `🎁 *ВЫБЕРИ ПОДАРОК*\n\n` +
            `💰 Цена: 15 ₽\n` +
            `💡 Оплатить можно балансом или менеджеру`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🧸 Мишка (15 ₽)', callback_data: 'buy_bear' }],
                        [{ text: '💝 Романтичный (15 ₽)', callback_data: 'buy_romantic' }],
                        [{ text: '🔙 Назад', callback_data: 'back_to_menu' }]
                    ]
                }
            }
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_profile') {
        const profile = await getUserProfile(userId);
        bot.sendMessage(msg.chat.id, profile, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_balance') {
        const balance = getBalance(userId);
        const refCount = referralCounts.get(userId) || 0;
        bot.sendMessage(msg.chat.id,
            `💰 *ТВОЙ БАЛАНС*\n\n` +
            `Баланс: ${balance} руб.\n` +
            `👥 Рефералов: ${refCount}\n` +
            `💵 1 реферал = 5 руб.\n\n` +
            `🔗 Твоя реферальная ссылка:\nhttps://t.me/${bot.options.username || 'bot_username'}?start=${userId}`,
            { parse_mode: 'Markdown' }
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_referrals') {
        const refCount = referralCounts.get(userId) || 0;
        const balance = getBalance(userId);
        const rank = getReferralRank(userId);
        const refLink = `https://t.me/${bot.options.username || 'bot_username'}?start=${userId}`;
        bot.sendMessage(msg.chat.id,
            `👥 *ТВОИ РЕФЕРАЛЫ*\n\n` +
            `Всего рефералов: ${refCount}\n` +
            `💰 Заработано: ${balance} руб.\n` +
            `🏆 Рейтинг: ${rank}\n\n` +
            `🔗 Твоя ссылка:\n${refLink}`,
            { parse_mode: 'Markdown' }
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_history') {
        const history = getUserHistory(userId, 10);
        if (history.length === 0) {
            bot.sendMessage(msg.chat.id, "📭 У вас пока нет покупок");
        } else {
            let text = "📜 *ИСТОРИЯ ПОКУПОК*\n\n";
            for (const purchase of history) {
                text += `🆔 #${purchase.id.toString().slice(-6)}\n`;
                text += `🎁 ${purchase.giftName}\n`;
                text += `👥 Для: ${purchase.recipient}\n`;
                text += `💰 ${purchase.price} ₽ (${purchase.paymentMethod === 'balance' ? '💳 баланс' : '👨‍💼 менеджеру'})\n`;
                text += `📅 ${purchase.dateStr}\n`;
                text += `━━━━━━━━━━━━━━━━\n`;
            }
            bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
        }
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_top') {
        const referralTop = getReferralTop();
        let text = "🏆 *ТОП РЕФЕРАЛОВ*\n\n";
        for (let i = 0; i < Math.min(5, referralTop.length); i++) {
            const t = referralTop[i];
            text += `${i+1}. ${t.name} — ${t.count} рефералов (${t.count*5} руб)\n`;
        }
        const userRefCount = referralCounts.get(userId) || 0;
        let position = 1;
        for (const t of referralTop) {
            if (t.userId === userId) break;
            position++;
        }
        if (userRefCount > 0) text += `\n📍 Твоё место: #${position}`;
        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_achievements') {
        const userAchievements = achievements.get(userId) || new Set();
        if (userAchievements.size === 0) {
            bot.sendMessage(msg.chat.id, "🏅 У вас пока нет достижений. Совершайте покупки и приглашайте друзей!");
        } else {
            let text = "🏅 *ВАШИ ДОСТИЖЕНИЯ*\n\n";
            for (const ach of userAchievements) {
                const achData = ALL_ACHIEVEMENTS[ach];
                if (achData) text += `${achData.icon} **${achData.name}** — ${achData.desc}\n\n`;
            }
            text += `\n📊 Всего: ${userAchievements.size} из ${Object.keys(ALL_ACHIEVEMENTS).length}`;
            bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
        }
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_promo') {
        bot.sendMessage(msg.chat.id,
            `🎫 *АКТИВАЦИЯ ПРОМОКОДА*\n\n` +
            `Введите промокод командой:\n` +
            `/promo КОД\n\n` +
            `Доступные промокоды:\n` +
            `• WELCOME15 — скидка 15% на первую покупку\n` +
            `• FRIEND10 — скидка 10% за реферала\n` +
            `• PHOTO5 — скидка 5% за фотоотчёт`,
            { parse_mode: 'Markdown' }
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_help') {
        const helpText = `📋 *СПИСОК КОМАНД*\n\n` +
            `👤 *ПОЛЬЗОВАТЕЛЬСКИЕ:*\n` +
            `/menu — Главное меню\n` +
            `/profile — Мой профиль\n` +
            `/balance — Мой баланс\n` +
            `/referrals — Мои рефералы\n` +
            `/history — История покупок\n` +
            `/top — Топ пользователей\n` +
            `/achievements — Мои достижения\n` +
            `/promo [код] — Активировать промокод\n` +
            `/rating — Рейтинг покупок\n` +
            `/check — Проверить покупку\n` +
            `/today — Можно сегодня?\n` +
            `/faq — Частые вопросы\n` +
            `/manager — Связаться\n` +
            `/help — Это меню\n\n` +
            `👨‍💼 *КОМАНДЫ МЕНЕДЖЕРА:*\n` +
            `/dashboard — Дашборд\n` +
            `/testmode — Тестовый режим\n` +
            `/pending — Ожидающие заявки\n` +
            `/stats — Статистика\n` +
            `/allhistory — История всех\n` +
            `/export — Экспорт данных\n` +
            `/ban [id] — Заблокировать\n` +
            `/unban [id] — Разблокировать\n` +
            `/blacklist — Список заблокированных\n` +
            `/faq_add [вопрос] || [ответ] — Добавить FAQ\n` +
            `/refresh — Обновить бота`;
        
        bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'menu_manager') {
        bot.sendMessage(msg.chat.id, `📞 Связаться с менеджером: @${MANAGER_USERNAME}`);
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data === 'back_to_menu') {
        await showMainMenu(msg.chat.id, userId);
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    // ========== ПОКУПКА ПОДАРКОВ ==========
    if (data === 'buy_bear' || data === 'buy_romantic') {
        const giftName = data === 'buy_bear' ? "🧸 Мишка" : "💝 Романтичный подарок";
        const giftPrice = 15;
        const balance = getBalance(userId);
        const lastBuy = purchases.get(userId);
        
        if (lastBuy && Date.now() - lastBuy < 30 * 24 * 60 * 60 * 1000 && !isTestMode(userId)) {
            bot.sendMessage(msg.chat.id, "⏳ Раз в 30 дней!");
            bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        
        let keyboard = [];
        if (balance >= giftPrice) {
            keyboard.push([{ text: '💰 Оплатить балансом', callback_data: `pay_balance_${data}` }]);
            keyboard.push([{ text: '💳 Оплатить менеджеру', callback_data: `pay_manager_${data}` }]);
        } else {
            keyboard.push([{ text: '💳 Оплатить менеджеру', callback_data: `pay_manager_${data}` }]);
            keyboard.push([{ text: '💸 Пополнить баланс (рефералы)', callback_data: 'menu_referrals' }]);
        }
        keyboard.push([{ text: '🔙 Назад', callback_data: 'menu_buy' }]);
        
        bot.sendMessage(msg.chat.id,
            `🎁 *${giftName}* (${giftPrice} ₽)\n\n` +
            `💰 Твой баланс: ${balance} руб.\n\n` +
            `Выбери способ оплаты:`,
            {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            }
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (data.startsWith('pay_balance_')) {
        const giftType = data.replace('pay_balance_', '');
        const giftName = giftType === 'buy_bear' ? "🧸 Мишка" : "💝 Романтичный подарок";
        const giftPrice = 15;
        const balance = getBalance(userId);
        
        if (balance < giftPrice) {
            bot.sendMessage(msg.chat.id, "❌ Недостаточно средств на балансе! Пригласи друзей по реферальной ссылке.");
            bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        
        await bot.sendMessage(msg.chat.id, `📝 Ты выбрал ${giftName} (оплата балансом)\nНапиши @username или ID получателя:`);
        bot.answerCallbackQuery(callbackQuery.id);
        
        const listener = (m) => {
            if (m.chat.id !== msg.chat.id) return;
            
            const newRating = (ratings.get(userId) || 0) + 1;
            ratings.set(userId, newRating);
            purchases.set(userId, Date.now());
            addToHistory(userId, giftName, m.text, giftPrice, 'balance');
            savePurchases();
            saveRatings();
            
            const newAchs = checkAchievements(userId);
            let achText = "";
            if (newAchs.length > 0) {
                for (const ach of newAchs) {
                    achText += `\n\n🏆 *НОВАЯ АЧИВКА!*\n${ach.icon} ${ach.name}`;
                }
            }
            
            bot.sendMessage(userId,
                `✅ *ПОДАРОК ОПЛАЧЕН БАЛАНСОМ!*\n\n` +
                `🎁 ${giftName}\n` +
                `👥 Получатель: ${m.text}\n` +
                `🏆 Новый рейтинг: ${getPurchaseRatingBadge(newRating)}${achText}`,
                { parse_mode: 'Markdown' }
            );
            
            bot.removeListener('message', listener);
        };
        bot.on('message', listener);
        return;
    }
    
    if (data.startsWith('pay_manager_')) {
        const giftType = data.replace('pay_manager_', '');
        const giftName = giftType === 'buy_bear' ? "🧸 Мишка" : "💝 Романтичный подарок";
        
        await bot.sendMessage(msg.chat.id, `📝 Ты выбрал ${giftName} (оплата менеджеру)\nНапиши @username или ID получателя:`);
        bot.answerCallbackQuery(callbackQuery.id);
        
        const listener = (m) => {
            if (m.chat.id !== msg.chat.id) return;
            
            pendingOrders.set(userId, {
                giftName,
                recipient: m.text,
                date: Date.now(),
                userName: callbackQuery.from.first_name,
                userUsername: callbackQuery.from.username,
                paymentMethod: "manager"
            });
            
            for (const managerId of MANAGERS) {
                bot.sendMessage(managerId,
                    `🆕 *НОВАЯ ЗАЯВКА (ожидает оплаты)*\n\n` +
                    `👤 Клиент: ${callbackQuery.from.first_name} @${callbackQuery.from.username || 'нет'}\n` +
                    `🆔 ID: ${userId}\n` +
                    `🎁 Подарок: ${giftName}\n` +
                    `💰 Цена: 15 ₽\n` +
                    `👥 Получатель: ${m.text}\n` +
                    `🏆 Рейтинг: ${getPurchaseRatingBadge(ratings.get(userId) || 0)}\n` +
                    `💰 Баланс: ${getBalance(userId)} руб.\n\n` +
                    `✅ После получения оплаты нажми кнопку "Подтвердить"`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '✅ Подтвердить оплату', callback_data: `confirm_${userId}` },
                                    { text: '❌ Отклонить', callback_data: `reject_${userId}` }
                                ]
                            ]
                        }
                    }
                );
            }
            
            bot.sendMessage(m.chat.id,
                `✅ Заявка отправлена менеджеру!\n\n` +
                `🎁 ${giftName}\n👥 Для: ${m.text}\n\n` +
                `💰 Ожидайте подтверждения оплаты от менеджера @${MANAGER_USERNAME}`
            );
            bot.removeListener('message', listener);
        };
        bot.on('message', listener);
        return;
    }
});

// ========== ПОДТВЕРЖДЕНИЕ ОТ МЕНЕДЖЕРА ==========
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const managerId = callbackQuery.from.id;
    
    if (!data.startsWith('confirm_') && !data.startsWith('reject_')) return;
    if (!isManager(managerId)) {
        bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Только для менеджеров" });
        return;
    }
    
    if (data.startsWith('confirm_')) {
        const userId = parseInt(data.split('_')[1]);
        const order = pendingOrders.get(userId);
        
        if (!order) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Заявка не найдена" });
            return;
        }
        
        const newRating = (ratings.get(userId) || 0) + 1;
        ratings.set(userId, newRating);
        purchases.set(userId, order.date);
        addToHistory(userId, order.giftName, order.recipient, 15, 'manager');
        savePurchases();
        saveRatings();
        pendingOrders.delete(userId);
        
        const newAchs = checkAchievements(userId);
        let achText = "";
        if (newAchs.length > 0) {
            for (const ach of newAchs) {
                achText += `\n\n🏆 *НОВАЯ АЧИВКА!*\n${ach.icon} ${ach.name}`;
            }
        }
        
        bot.sendMessage(userId,
            `✅ *ПЛАТЕЖ ПОДТВЕРЖДЁН!*\n\n` +
            `🎁 Подарок: ${order.giftName}\n` +
            `👥 Получатель: ${order.recipient}\n` +
            `🏆 Новый рейтинг: ${getPurchaseRatingBadge(newRating)}${achText}`,
            { parse_mode: 'Markdown' }
        );
        
        notifyManagers(`✅ Заявка подтверждена!\n👤 ${order.userName}\n🎁 ${order.giftName}`);
        bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Заявка подтверждена!" });
        
    } else if (data.startsWith('reject_')) {
        const userId = parseInt(data.split('_')[1]);
        const order = pendingOrders.get(userId);
        
        if (order) {
            pendingOrders.delete(userId);
            bot.sendMessage(userId,
                `❌ *ЗАЯВКА ОТКЛОНЕНА*\n\n` +
                `К сожалению, менеджер отклонил вашу заявку.\n` +
                `По вопросам: @${MANAGER_USERNAME}`,
                { parse_mode: 'Markdown' }
            );
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Заявка отклонена" });
        }
    }
});

// ========== ОБРАБОТКА ФОТО ==========
bot.on('photo', async (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    
    const caption = msg.caption || '';
    if (caption.toLowerCase().includes('отчёт') || caption.toLowerCase().includes('отчет')) {
        const userHistory = getUserHistory(userId, 1);
        if (userHistory.length > 0) {
            const lastPurchase = userHistory[0];
            const fileId = msg.photo[msg.photo.length - 1].file_id;
            await sendPhotoReport(userId, lastPurchase.giftName, lastPurchase.recipient, lastPurchase.paymentMethod, fileId);
            bot.sendMessage(msg.chat.id, "✅ Фотоотчёт отправлен! Спасибо за отзыв 💝");
        } else {
            bot.sendMessage(msg.chat.id, "📸 Спасибо за фото! Чтобы получать бонусы, отправляй фото после покупки подарка.");
        }
    }
});

console.log('✅ БОТ ЗАПУЩЕН!');
console.log(`📢 Канал: ${REQUIRED_CHANNEL}`);
console.log(`📸 Группа отчётов: ${REPORT_GROUP_ID}`);
console.log(`\n📋 КОМАНДЫ:`);
console.log(`👤 ПОЛЬЗОВАТЕЛЬСКИЕ: /menu - главное меню`);
console.log(`👨‍💼 МЕНЕДЖЕРСКИЕ: /dashboard, /testmode, /pending, /stats, /allhistory, /export, /ban, /unban, /blacklist, /faq_add, /refresh`);