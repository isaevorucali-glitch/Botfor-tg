const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = "8573154507:AAFE7Drx_YDTpa7aNZLu9mD_0sv7s3CvWjU";
const MANAGERS = [8211976202, 6101289439];
const MANAGER_USERNAME = "prime41ks";
const REQUIRED_CHANNEL = "@prime_1edits";
const REPORT_GROUP_ID = -5102612415;

const bot = new TelegramBot(TOKEN, { polling: true });

// Жёстко задаём имя бота
const BOT_USERNAME = "giftscheap_bot";
console.log(`✅ Имя бота: @${BOT_USERNAME}`);

// ========== ДАННЫЕ ==========
let purchases = new Map();        // userId -> дата последней покупки
let ratings = new Map();          // userId -> количество покупок
let pendingOrders = new Map();    // userId -> заявка
let referrers = new Map();        // userId -> кто пригласил
let referralCounts = new Map();   // userId -> количество рефералов
let purchaseHistory = new Map();  // userId -> Map(покупок)
let users = new Map();            // userId -> данные
let testMode = new Map();         // userId -> boolean

let blacklist = new Set();
let faq = [];
let promocodes = new Map();       // только HAPPY

// Файлы
const DATA_FILE_USERS = "users.json";
const DATA_FILE_REFERRALS = "referrals.json";
const DATA_FILE_REFERRER = "referrer.json";
const DATA_FILE_PURCHASES = "purchases.json";
const DATA_FILE_RATINGS = "ratings.json";
const DATA_FILE_HISTORY = "history.json";
const DATA_FILE_BLACKLIST = "blacklist.json";
const DATA_FILE_FAQ = "faq.json";
const DATA_FILE_PROMOCODES = "promocodes.json";
const DATA_FILE_TESTMODE = "testmode.json";

function loadData() {
    if (fs.existsSync(DATA_FILE_USERS)) users = new Map(JSON.parse(fs.readFileSync(DATA_FILE_USERS)));
    if (fs.existsSync(DATA_FILE_REFERRALS)) referralCounts = new Map(JSON.parse(fs.readFileSync(DATA_FILE_REFERRALS)));
    if (fs.existsSync(DATA_FILE_REFERRER)) referrers = new Map(JSON.parse(fs.readFileSync(DATA_FILE_REFERRER)));
    if (fs.existsSync(DATA_FILE_PURCHASES)) purchases = new Map(JSON.parse(fs.readFileSync(DATA_FILE_PURCHASES)));
    if (fs.existsSync(DATA_FILE_RATINGS)) ratings = new Map(JSON.parse(fs.readFileSync(DATA_FILE_RATINGS)));
    if (fs.existsSync(DATA_FILE_BLACKLIST)) blacklist = new Set(JSON.parse(fs.readFileSync(DATA_FILE_BLACKLIST)));
    if (fs.existsSync(DATA_FILE_FAQ)) faq = JSON.parse(fs.readFileSync(DATA_FILE_FAQ));
    if (fs.existsSync(DATA_FILE_TESTMODE)) testMode = new Map(JSON.parse(fs.readFileSync(DATA_FILE_TESTMODE)));

    if (fs.existsSync(DATA_FILE_PROMOCODES)) {
        const promos = JSON.parse(fs.readFileSync(DATA_FILE_PROMOCODES));
        promocodes = new Map(Object.entries(promos));
    } else {
        promocodes.set("HAPPY", { uses: 0, maxUses: 3 });
        savePromocodes();
    }

    if (fs.existsSync(DATA_FILE_HISTORY)) {
        const historyArray = JSON.parse(fs.readFileSync(DATA_FILE_HISTORY));
        purchaseHistory = new Map(historyArray.map(item => [item[0], new Map(item[1])]));
    }
}
loadData();

function saveUsers() { fs.writeFileSync(DATA_FILE_USERS, JSON.stringify([...users])); }
function saveReferrals() { fs.writeFileSync(DATA_FILE_REFERRALS, JSON.stringify([...referralCounts])); }
function saveReferrer() { fs.writeFileSync(DATA_FILE_REFERRER, JSON.stringify([...referrers])); }
function savePurchases() { fs.writeFileSync(DATA_FILE_PURCHASES, JSON.stringify([...purchases])); }
function saveRatings() { fs.writeFileSync(DATA_FILE_RATINGS, JSON.stringify([...ratings])); }
function saveBlacklist() { fs.writeFileSync(DATA_FILE_BLACKLIST, JSON.stringify([...blacklist])); }
function saveFaq() { fs.writeFileSync(DATA_FILE_FAQ, JSON.stringify(faq)); }
function saveTestMode() { fs.writeFileSync(DATA_FILE_TESTMODE, JSON.stringify([...testMode])); }
function savePromocodes() { fs.writeFileSync(DATA_FILE_PROMOCODES, JSON.stringify(Object.fromEntries(promocodes))); }

function saveHistory() {
    const historyArray = [];
    for (const [userId, historyMap] of purchaseHistory) {
        historyArray.push([userId, [...historyMap]]);
    }
    fs.writeFileSync(DATA_FILE_HISTORY, JSON.stringify(historyArray));
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
async function checkSubscription(userId) {
    try {
        const chatMember = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        return chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator';
    } catch { return false; }
}

async function registerUser(userId, username, firstName) {
    if (!users.has(userId)) {
        users.set(userId, { id: userId, username: username || null, firstName: firstName, regDate: Date.now(), regDateStr: new Date().toLocaleString('ru-RU') });
        saveUsers();
    }
}

function addToHistory(userId, giftName, recipient, price, paymentMethod) {
    if (!purchaseHistory.has(userId)) purchaseHistory.set(userId, new Map());
    const userHistory = purchaseHistory.get(userId);
    const purchaseId = Date.now();
    userHistory.set(purchaseId, { id: purchaseId, giftName, recipient, price, paymentMethod, date: purchaseId, dateStr: new Date(purchaseId).toLocaleString('ru-RU') });
    saveHistory();
    return purchaseId;
}

function getUserHistory(userId, limit = 10) {
    const userHistory = purchaseHistory.get(userId);
    if (!userHistory || userHistory.size === 0) return [];
    const historyArray = [];
    for (const [id, purchase] of userHistory) historyArray.push(purchase);
    historyArray.sort((a, b) => b.date - a.date);
    return historyArray.slice(0, limit);
}

function getBalance(userId) { return (referralCounts.get(userId) || 0) * 5; }

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
    referralCounts.set(referrerId, (referralCounts.get(referrerId) || 0) + 1);
    saveReferrals();
    saveReferrer();
    return true;
}

function applyPromocode(userId, code) {
    const promo = promocodes.get(code.toUpperCase());
    if (!promo) return { success: false, message: "❌ Промокод не найден" };
    if (promo.uses >= promo.maxUses) return { success: false, message: "❌ Промокод использован" };
    promo.uses++;
    savePromocodes();
    return { success: true, discount: 100, message: `✅ Промокод HAPPY активирован! Следующий подарок бесплатно!` };
}

function getPurchaseRatingBadge(rating) {
    if (rating === 0) return "🆕 Новый покупатель";
    if (rating === 1) return "🥉 Бронза";
    if (rating === 2) return "🥈 Серебро";
    if (rating === 3) return "🥇 Золото";
    if (rating >= 5) return "💎 Бриллиант";
    return `⭐ ${rating} покупок`;
}

function isManager(userId) { return MANAGERS.includes(userId) || testMode.get(userId); }
function isTestMode(userId) { return testMode.get(userId) || false; }
function toggleTestMode(userId) { testMode.set(userId, !isTestMode(userId)); saveTestMode(); return isTestMode(userId); }
function notifyManagers(text) { for (const id of MANAGERS) bot.sendMessage(id, text, { parse_mode: 'Markdown' }).catch(() => {}); }

async function sendPhotoReport(userId, giftName, recipient, paymentMethod, photoPath) {
    const user = users.get(userId) || {};
    const text = `📸 *НОВЫЙ ФОТООТЧЁТ!*\n\n👤 Клиент: ${user.firstName || 'Неизвестно'} @${user.username || 'нет'}\n🆔 ID: ${userId}\n🎁 ${giftName}\n👥 ${recipient}\n💳 ${paymentMethod === 'balance' ? 'балансом' : 'менеджеру'}\n📅 ${new Date().toLocaleString('ru-RU')}`;
    try { await bot.sendPhoto(REPORT_GROUP_ID, photoPath, { caption: text, parse_mode: 'Markdown' }); } catch (error) { await bot.sendMessage(REPORT_GROUP_ID, text + '\n\n❌ Фото не загрузилось', { parse_mode: 'Markdown' }); }
}

async function showDashboard(chatId) {
    const totalUsers = users.size;
    const totalReferrals = Array.from(referralCounts.values()).reduce((a, b) => a + b, 0);
    let totalPurchases = 0;
    for (const userHistory of purchaseHistory.values()) totalPurchases += userHistory.size;
    const totalRevenue = totalPurchases * 15;
    const totalBalance = totalReferrals * 5;
    const pendingCount = pendingOrders.size;

    const topReferrals = Array.from(referralCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let topText = "";
    if (topReferrals.length) {
        topText = "\n🏆 *ТОП РЕФЕРАЛОВ*\n";
        for (let i = 0; i < topReferrals.length; i++) {
            const [uid, count] = topReferrals[i];
            const user = users.get(uid) || {};
            topText += `${i+1}. ${user.firstName || uid} — ${count} рефералов\n`;
        }
    }

    const dashboardText = `📊 *ДАШБОРД БОТА*\n\n👥 *ПОЛЬЗОВАТЕЛИ*\nВсего: ${totalUsers}\nАктивных: ${ratings.size}\n\n💰 *ФИНАНСЫ*\nВыручка: ${totalRevenue} ₽\nРеферальный фонд: ${totalBalance} ₽\nПокупок: ${totalPurchases}\nОжидает: ${pendingCount}\n\n👥 *РЕФЕРАЛЫ*\nВсего: ${totalReferrals}\nРефереров: ${referralCounts.size}${topText}\n\n🔧 *ТЕСТОВЫЙ РЕЖИМ:* ${isTestMode(chatId) ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЁН'}\n🚫 *ЧЁРНЫЙ СПИСОК:* ${blacklist.size}`;
    await bot.sendMessage(chatId, dashboardText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'refresh_dashboard' }, { text: '🔧 Тестовый режим', callback_data: 'toggle_testmode' }]] } });
}

async function getUserProfile(userId) {
    const user = users.get(userId) || { firstName: "Пользователь", regDateStr: "неизвестно" };
    const refCount = referralCounts.get(userId) || 0;
    const balance = getBalance(userId);
    const purchaseCount = ratings.get(userId) || 0;
    const totalSpent = (() => { let s = 0; for (const p of (purchaseHistory.get(userId) || new Map()).values()) s += p.price; return s; })();
    const rank = getPurchaseRatingBadge(purchaseCount);
    const referralRank = getReferralRank(userId);
    return `👤 *ПРОФИЛЬ*\n\nИмя: ${user.firstName}\nID: ${userId}\nДата: ${user.regDateStr}\n\n📊 *СТАТИСТИКА*\n👥 Рефералов: ${refCount}\n💰 Баланс: ${balance} руб\n🎁 Покупок: ${purchaseCount}\n💸 Потрачено: ${totalSpent} руб\n🏆 Рейтинг покупок: ${rank}\n👑 Рейтинг рефералов: ${referralRank}`;
}

function getReferralTop() {
    return Array.from(referralCounts.entries())
        .map(([uid, count]) => ({ userId: uid, count, name: users.get(uid)?.firstName || `ID${uid}` }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

function getPurchaseTop() {
    return Array.from(ratings.entries())
        .map(([uid, count]) => ({ userId: uid, count, name: users.get(uid)?.firstName || `ID${uid}` }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

function getAllHistory() {
    const all = [];
    for (const [uid, hist] of purchaseHistory) for (const p of hist.values()) all.push({ userId: uid, ...p });
    all.sort((a, b) => b.date - a.date);
    return all;
}

async function showMainMenu(chatId, userId) {
    const balance = getBalance(userId);
    const refCount = referralCounts.get(userId) || 0;
    const purchaseRating = getPurchaseRatingBadge(ratings.get(userId) || 0);
    await bot.sendMessage(chatId, `🐻 *ГЛАВНОЕ МЕНЮ*\n\n💰 Баланс: ${balance} руб\n👥 Рефералов: ${refCount}\n🏆 Рейтинг: ${purchaseRating}`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎁 КУПИТЬ ПОДАРОК', callback_data: 'menu_buy' }],
                [{ text: '👤 МОЙ ПРОФИЛЬ', callback_data: 'menu_profile' }],
                [{ text: '💰 МОЙ БАЛАНС', callback_data: 'menu_balance' }],
                [{ text: '👥 МОИ РЕФЕРАЛЫ', callback_data: 'menu_referrals' }],
                [{ text: '📜 ИСТОРИЯ ПОКУПОК', callback_data: 'menu_history' }],
                [{ text: '🏆 ТОП ПОЛЬЗОВАТЕЛЕЙ', callback_data: 'menu_top' }],
                [{ text: '🎫 ПРОМОКОД', callback_data: 'menu_promo' }],
                [{ text: '❓ ПОМОЩЬ / КОМАНДЫ', callback_data: 'menu_help' }],
                [{ text: '📞 СВЯЗАТЬСЯ', callback_data: 'menu_manager' }]
            ]
        }
    });
}

// ========== КОМАНДЫ ==========
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const userId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;
    if (blacklist.has(userId)) { bot.sendMessage(msg.chat.id, "🚫 Вы заблокированы"); return; }
    await registerUser(userId, username, firstName);
    
    // Проверка подписки
    const isSubscribed = await checkSubscription(userId);
    if (!isSubscribed && !isManager(userId)) {
        const channelLink = `https://t.me/${REQUIRED_CHANNEL.slice(1)}`;
        bot.sendMessage(msg.chat.id, `🔒 *ПОДПИШИСЬ НА КАНАЛ*\n\n${REQUIRED_CHANNEL}\n\nПосле подписки нажми кнопку 👇`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '📢 ПОДПИСАТЬСЯ', url: channelLink }, { text: '✅ ПРОВЕРИТЬ', callback_data: 'check_subscribe' }]] }
        });
        return;
    }
    
    // Реферальная ссылка
    if (match && match[1]) {
        const referrerId = parseInt(match[1]);
        if (!isNaN(referrerId) && referrerId !== userId && !referrers.has(userId)) {
            if (addReferral(referrerId, userId)) {
                bot.sendMessage(referrerId, `🎉 *НОВЫЙ РЕФЕРАЛ!*\n👤 ${firstName} @${username || 'без username'}\n💰 Твой баланс: ${getBalance(referrerId)} руб.`, { parse_mode: 'Markdown' });
                bot.sendMessage(msg.chat.id, `✅ Ты зарегистрирован по реферальной ссылке!`);
            }
        }
    }
    await showMainMenu(msg.chat.id, userId);
});

bot.onText(/\/menu/, async (msg) => { if (!blacklist.has(msg.from.id)) await showMainMenu(msg.chat.id, msg.from.id); });
bot.onText(/\/profile/, async (msg) => { if (!blacklist.has(msg.from.id)) bot.sendMessage(msg.chat.id, await getUserProfile(msg.from.id), { parse_mode: 'Markdown' }); });
bot.onText(/\/balance/, (msg) => { if (!blacklist.has(msg.from.id)) { const b = getBalance(msg.from.id); bot.sendMessage(msg.chat.id, `💰 *БАЛАНС*\n\n${b} руб\n👥 Рефералов: ${referralCounts.get(msg.from.id) || 0}\n💵 1 реферал = 5 руб`, { parse_mode: 'Markdown' }); } });
bot.onText(/\/referrals/, (msg) => { if (!blacklist.has(msg.from.id)) { const refCount = referralCounts.get(msg.from.id) || 0; bot.sendMessage(msg.chat.id, `👥 *ТВОИ РЕФЕРАЛЫ*\n\nВсего: ${refCount}\n💰 Заработано: ${refCount * 5} руб\n🏆 Рейтинг: ${getReferralRank(msg.from.id)}\n\n🔗 Твоя ссылка:\nhttps://t.me/${BOT_USERNAME}?start=${msg.from.id}`, { parse_mode: 'Markdown' }); } });
bot.onText(/\/history/, (msg) => { if (!blacklist.has(msg.from.id)) { const hist = getUserHistory(msg.from.id, 10); if (!hist.length) bot.sendMessage(msg.chat.id, "📭 Нет покупок"); else { let t = "📜 *ИСТОРИЯ ПОКУПОК*\n\n"; for (const p of hist) t += `🆔 #${p.id.toString().slice(-6)}\n🎁 ${p.giftName}\n👥 ${p.recipient}\n💰 ${p.price} ₽\n📅 ${p.dateStr}\n━━━━━━━━━━\n`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); } } });
bot.onText(/\/top/, (msg) => { if (!blacklist.has(msg.from.id)) { const refTop = getReferralTop(); let t = "🏆 *ТОП РЕФЕРАЛОВ*\n\n"; if (!refTop.length) t += "Пока нет\n"; else for (let i=0;i<Math.min(5,refTop.length);i++) t += `${i+1}. ${refTop[i].name} — ${refTop[i].count} рефералов\n`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); } });
bot.onText(/\/promo (.+)/, (msg, match) => { if (!blacklist.has(msg.from.id)) bot.sendMessage(msg.chat.id, applyPromocode(msg.from.id, match[1]).message); });
bot.onText(/\/manager/, (msg) => bot.sendMessage(msg.chat.id, `📞 Менеджер: @${MANAGER_USERNAME}`));
bot.onText(/\/help/, async (msg) => { if (!blacklist.has(msg.from.id)) await showMainMenu(msg.chat.id, msg.from.id); });
bot.onText(/\/faq/, (msg) => { if (faq.length) bot.sendMessage(msg.chat.id, "❓ *FAQ*\n\n" + faq.map((q,i)=>`${i+1}. *${q.question}*\n${q.answer}`).join("\n\n"), { parse_mode: 'Markdown' }); else bot.sendMessage(msg.chat.id, "❓ FAQ пуст"); });

// ========== КОМАНДЫ МЕНЕДЖЕРА ==========
bot.onText(/\/dashboard/, (msg) => { if (isManager(msg.from.id)) showDashboard(msg.chat.id); });
bot.onText(/\/testmode/, (msg) => { if (isManager(msg.from.id)) bot.sendMessage(msg.chat.id, `🔧 Тестовый режим: ${toggleTestMode(msg.from.id) ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЁН'}`); });
bot.onText(/\/export/, (msg) => { if (isManager(msg.from.id)) { const data = { users:[...users], purchases:[...purchases], ratings:[...ratings], referrals:[...referralCounts], history:[...purchaseHistory].map(([k,v])=>[k,[...v]]) }; fs.writeFileSync("export.json", JSON.stringify(data,null,2)); bot.sendDocument(msg.chat.id, "export.json", { caption: "📤 Экспорт" }); } });
bot.onText(/\/ban (\d+)/, (msg, match) => { if (isManager(msg.from.id)) { blacklist.add(parseInt(match[1])); saveBlacklist(); bot.sendMessage(msg.chat.id, `🚫 Заблокирован ${match[1]}`); } });
bot.onText(/\/unban (\d+)/, (msg, match) => { if (isManager(msg.from.id)) { blacklist.delete(parseInt(match[1])); saveBlacklist(); bot.sendMessage(msg.chat.id, `✅ Разблокирован ${match[1]}`); } });
bot.onText(/\/blacklist/, (msg) => { if (isManager(msg.from.id)) { if (!blacklist.size) bot.sendMessage(msg.chat.id, "🚫 ЧС пуст"); else bot.sendMessage(msg.chat.id, "🚫 *ЧС*\n" + [...blacklist].map(id=>`🆔 ${id}`).join("\n"), { parse_mode: 'Markdown' }); } });
bot.onText(/\/faq_add (.+?) \|\| (.+)/, (msg, match) => { if (isManager(msg.from.id)) { faq.push({ question: match[1], answer: match[2] }); saveFaq(); bot.sendMessage(msg.chat.id, `✅ FAQ добавлен`); } });
bot.onText(/\/pending/, (msg) => { if (isManager(msg.from.id)) { if (!pendingOrders.size) bot.sendMessage(msg.chat.id, "📭 Нет заявок"); else { let t = "📋 *ЗАЯВКИ*\n"; for (const [uid, o] of pendingOrders) t += `🆔 ${uid}\n🎁 ${o.giftName}\n👥 ${o.recipient}\n📅 ${new Date(o.date).toLocaleString()}\n\n`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); } } });
bot.onText(/\/stats/, (msg) => { if (isManager(msg.from.id)) { let totalRef = 0; for (const c of referralCounts.values()) totalRef += c; let totalPurch = 0; for (const h of purchaseHistory.values()) totalPurch += h.size; bot.sendMessage(msg.chat.id, `📊 *СТАТИСТИКА*\n📦 Покупок: ${totalPurch}\n👥 Покупателей: ${ratings.size}\n💰 Выручка: ${totalPurch*15} ₽\n⏳ Ожидает: ${pendingOrders.size}\n👥 Рефералов: ${totalRef}\n💵 Выплачено: ${totalRef*5} ₽`, { parse_mode: 'Markdown' }); } });
bot.onText(/\/allhistory/, (msg) => { if (isManager(msg.from.id)) { const all = getAllHistory(); if (!all.length) bot.sendMessage(msg.chat.id, "📭 Нет покупок"); else { let t = "📜 *ИСТОРИЯ ВСЕХ*\n"; let sum = 0; for (const p of all.slice(0,20)) { t += `🆔 ${p.userId}\n🎁 ${p.giftName}\n👥 ${p.recipient}\n💰 ${p.price} ₽\n📅 ${p.dateStr}\n━━━━\n`; sum += p.price; } t += `\n📊 Всего: ${all.length} покупок на ${sum} ₽`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); } } });
bot.onText(/\/refresh/, async (msg) => { if (isManager(msg.from.id)) { bot.sendMessage(msg.chat.id, `✅ Обновлено! @${BOT_USERNAME}`); } });

// ========== АВТООТВЕТЧИК ==========
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = msg.text?.toLowerCase() || '';
    if (text.startsWith('/') || blacklist.has(userId)) return;
    if (text.includes('помощ') || text === 'help') bot.sendMessage(msg.chat.id, `❓ *ЧЕМ ПОМОЧЬ?*\n\n/faq — Частые вопросы\n/menu — Главное меню\n📞 @${MANAGER_USERNAME}`, { parse_mode: 'Markdown' });
    else if (text.includes('как купить')) bot.sendMessage(msg.chat.id, `🎁 *КАК КУПИТЬ*\n1. /menu → Купить подарок\n2. Выбери подарок\n3. Напиши @username получателя\n4. Оплати балансом или менеджеру\n💰 15 ₽, раз в 30 дней`, { parse_mode: 'Markdown' });
    else if (text.includes('спасиб')) bot.sendMessage(msg.chat.id, `Всегда рады помочь! 💝\n📞 @${MANAGER_USERNAME}`);
    else if (text.includes('реферал') || text.includes('пригласить')) bot.sendMessage(msg.chat.id, `👥 *ПРИГЛАСИТЬ*\n🔗 https://t.me/${BOT_USERNAME}?start=${userId}\n+5 руб за друга\nПриглашено: ${referralCounts.get(userId) || 0}`, { parse_mode: 'Markdown' });
});

// ========== КНОПКИ ==========
bot.on('callback_query', async (cb) => {
    const userId = cb.from.id;
    const msg = cb.message;
    const data = cb.data;
    if (blacklist.has(userId)) return cb.answerCallbackQuery("🚫 Заблокирован");
    
    if (data === 'check_subscribe') {
        const sub = await checkSubscription(userId);
        if (sub) { bot.sendMessage(msg.chat.id, "✅ Спасибо!"); await showMainMenu(msg.chat.id, userId); cb.answerCallbackQuery(); }
        else { bot.sendMessage(msg.chat.id, "❌ Не подписан"); cb.answerCallbackQuery(); }
        return;
    }
    if (data === 'refresh_dashboard' && isManager(userId)) { await showDashboard(msg.chat.id); cb.answerCallbackQuery(); return; }
    if (data === 'toggle_testmode' && isManager(userId)) { toggleTestMode(userId); bot.sendMessage(msg.chat.id, `🔧 Тестовый режим: ${isTestMode(userId) ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЁН'}`); await showDashboard(msg.chat.id); cb.answerCallbackQuery(); return; }

    if (data === 'menu_buy') { const last = purchases.get(userId); if (last && Date.now() - last < 30*24*60*60*1000 && !isTestMode(userId)) { bot.sendMessage(msg.chat.id, "⏳ Раз в 30 дней!"); cb.answerCallbackQuery(); return; } bot.sendMessage(msg.chat.id, "🎁 *ВЫБЕРИ ПОДАРОК*", { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🧸 МИШКА', callback_data: 'buy_bear' }, { text: '💝 РОМАНТИЧНЫЙ', callback_data: 'buy_romantic' }], [{ text: '🔙 НАЗАД', callback_data: 'back_to_menu' }]] } }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_profile') { bot.sendMessage(msg.chat.id, await getUserProfile(userId), { parse_mode: 'Markdown' }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_balance') { bot.sendMessage(msg.chat.id, `💰 *БАЛАНС*\n\n${getBalance(userId)} руб\n👥 Рефералов: ${referralCounts.get(userId) || 0}\n💵 1 реферал = 5 руб\n\n🔗 https://t.me/${BOT_USERNAME}?start=${userId}`, { parse_mode: 'Markdown' }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_referrals') { const refCount = referralCounts.get(userId) || 0; bot.sendMessage(msg.chat.id, `👥 *ТВОИ РЕФЕРАЛЫ*\n\nВсего: ${refCount}\n💰 Заработано: ${refCount*5} руб\n🏆 ${getReferralRank(userId)}\n\n🔗 https://t.me/${BOT_USERNAME}?start=${userId}`, { parse_mode: 'Markdown' }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_history') { const hist = getUserHistory(userId, 10); if (!hist.length) bot.sendMessage(msg.chat.id, "📭 Нет покупок"); else { let t = "📜 *ИСТОРИЯ*\n\n"; for (const p of hist) t += `#${p.id.toString().slice(-6)} ${p.giftName}\n👥 ${p.recipient}\n💰 ${p.price} ₽\n📅 ${p.dateStr}\n━━━\n`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); } cb.answerCallbackQuery(); return; }
    if (data === 'menu_top') { const top = getReferralTop(); let t = "🏆 *ТОП РЕФЕРАЛОВ*\n\n"; if (!top.length) t += "Пока нет\n"; else for (let i=0;i<Math.min(5,top.length);i++) t += `${i+1}. ${top[i].name} — ${top[i].count} рефералов\n`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_promo') { bot.sendMessage(msg.chat.id, `🎫 *ПРОМОКОД*\n\nВведите /promo HAPPY\nДоступно 3 раза`, { parse_mode: 'Markdown' }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_help') { bot.sendMessage(msg.chat.id, `📋 *КОМАНДЫ*\n/menu — Главное меню\n/profile — Профиль\n/balance — Баланс\n/referrals — Рефералы\n/history — История\n/top — Топ\n/promo — Промокод\n/faq — Вопросы\n/manager — Связаться`, { parse_mode: 'Markdown' }); cb.answerCallbackQuery(); return; }
    if (data === 'menu_manager') { bot.sendMessage(msg.chat.id, `📞 @${MANAGER_USERNAME}`); cb.answerCallbackQuery(); return; }
    if (data === 'back_to_menu') { await showMainMenu(msg.chat.id, userId); cb.answerCallbackQuery(); return; }

    if (data === 'buy_bear' || data === 'buy_romantic') {
        const gift = data === 'buy_bear' ? "🧸 Мишка" : "💝 Романтичный";
        const price = 15;
        const balance = getBalance(userId);
        if (balance < price && !isTestMode(userId)) { bot.sendMessage(msg.chat.id, "❌ Не хватает баланса. Пригласи друзей!"); cb.answerCallbackQuery(); return; }
        bot.sendMessage(msg.chat.id, `📝 ${gift} (${price} ₽)\nНапиши @username или ID получателя:`); cb.answerCallbackQuery();
        const listener = (m) => {
            if (m.chat.id !== msg.chat.id) return;
            const newRating = (ratings.get(userId) || 0) + 1;
            ratings.set(userId, newRating);
            purchases.set(userId, Date.now());
            addToHistory(userId, gift, m.text, price, 'balance');
            saveRatings(); savePurchases();
            bot.sendMessage(userId, `✅ *ПОДАРОК ОПЛАЧЕН!*\n🎁 ${gift}\n👥 ${m.text}\n🏆 Новый рейтинг: ${getPurchaseRatingBadge(newRating)}`, { parse_mode: 'Markdown' });
            bot.removeListener('message', listener);
        };
        bot.on('message', listener);
    }
});

bot.on('photo', async (msg) => {
    const userId = msg.from.id;
    if (blacklist.has(userId)) return;
    const caption = msg.caption || '';
    if (caption.toLowerCase().includes('отчёт')) {
        const last = getUserHistory(userId, 1);
        if (last.length) await sendPhotoReport(userId, last[0].giftName, last[0].recipient, last[0].paymentMethod, msg.photo[msg.photo.length-1].file_id);
        else bot.sendMessage(msg.chat.id, "📸 Спасибо! После покупки будет бонус.");
    }
});

console.log('✅ БОТ ЗАПУЩЕН!');
console.log(`📢 Канал: ${REQUIRED_CHANNEL}`);
console.log(`📸 Группа отчётов: ${REPORT_GROUP_ID}`);