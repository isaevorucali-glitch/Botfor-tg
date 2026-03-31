const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

// ========== НАСТРОЙКИ ==========
const TOKEN = "8573154507:AAHBwd15btUDSTRHW0z8nCArnJ_nFTXW0Tc";
const MANAGERS = [8211976202, 6101289439];
const MANAGER_USERNAME = "prime41ks";
const REQUIRED_CHANNEL = "@prime_1edits";
const REPORT_GROUP_ID = -5102612415;

const bot = new TelegramBot(TOKEN, { polling: true });

// ========== ВЕБ-СЕРВЕР ДЛЯ RENDER ==========
const app = express();
app.get('/', (req, res) => res.send('Бот работает'));
app.listen(10000, () => console.log('✅ Веб-сервер запущен на порту 10000'));

// ========== ДАННЫЕ ==========
let users = new Map();
let referralCounts = new Map();
let referrers = new Map();
let purchases = new Map();
let purchaseHistory = new Map();
let userCodes = new Map();
let codeToUserId = new Map();
let blacklist = new Set();
let promoCodes = new Map();

let userCommands = new Map();
let userBlocked = new Map();
let userPromoAttempts = new Map();

// Файлы
const USERS_FILE = "users.json";
const REFERRALS_FILE = "referrals.json";
const REFERRER_FILE = "referrer.json";
const PURCHASES_FILE = "purchases.json";
const HISTORY_FILE = "history.json";
const CODES_FILE = "codes.json";
const BLACKLIST_FILE = "blacklist.json";
const PROMOCODES_FILE = "promocodes.json";

// ========== ФУНКЦИИ СОХРАНЕНИЯ ==========
function safeWriteFile(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`❌ Ошибка сохранения ${file}:`, e.message);
        return false;
    }
}

function safeReadFile(file, defaultValue = null) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file));
        }
        return defaultValue;
    } catch (e) {
        console.error(`❌ Ошибка чтения ${file}:`, e.message);
        return defaultValue;
    }
}

function saveUsers() { safeWriteFile(USERS_FILE, [...users].map(([k, v]) => [k.toString(), v])); }
function saveReferrals() { safeWriteFile(REFERRALS_FILE, [...referralCounts].map(([k, v]) => [k.toString(), v])); }
function saveReferrer() { safeWriteFile(REFERRER_FILE, [...referrers].map(([k, v]) => [k.toString(), v])); }
function savePurchases() { safeWriteFile(PURCHASES_FILE, [...purchases].map(([k, v]) => [k.toString(), v])); }
function saveBlacklist() { safeWriteFile(BLACKLIST_FILE, [...blacklist].map(id => id.toString())); }
function saveCodes() {
    safeWriteFile(CODES_FILE, {
        userCodes: [...userCodes].map(([k, v]) => [k.toString(), v]),
        codeToUserId: [...codeToUserId].map(([k, v]) => [k, v.toString()])
    });
}
function savePromoCodes() { safeWriteFile(PROMOCODES_FILE, [...promoCodes]); }
function saveHistory() {
    const historyArray = [];
    for (const [userId, historyMap] of purchaseHistory) {
        historyArray.push([userId.toString(), [...historyMap]]);
    }
    safeWriteFile(HISTORY_FILE, historyArray);
}

// ========== ГЕНЕРАЦИЯ ПРОМОКОДОВ ==========
function generatePromoCodes() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ2345679';
    const codes = [];
    for (let i = 0; i < 100; i++) {
        let code = '';
        for (let j = 0; j < 5; j++) code += chars[Math.floor(Math.random() * chars.length)];
        codes.push([code, { used: false }]);
    }
    promoCodes = new Map(codes);
    savePromoCodes();
}

// ========== ЗАГРУЗКА ДАННЫХ ==========
function loadData() {
    let data = safeReadFile(USERS_FILE, []);
    users = new Map(data.map(([k, v]) => [parseInt(k), v]));
    
    data = safeReadFile(REFERRALS_FILE, []);
    referralCounts = new Map(data.map(([k, v]) => [parseInt(k), v]));
    
    data = safeReadFile(REFERRER_FILE, []);
    referrers = new Map(data.map(([k, v]) => [parseInt(k), v]));
    
    data = safeReadFile(PURCHASES_FILE, []);
    purchases = new Map(data.map(([k, v]) => [parseInt(k), v]));
    
    data = safeReadFile(BLACKLIST_FILE, []);
    blacklist = new Set(data.map(id => parseInt(id)));
    
    data = safeReadFile(CODES_FILE, { userCodes: [], codeToUserId: [] });
    userCodes = new Map(data.userCodes?.map(([k, v]) => [parseInt(k), v]) || []);
    codeToUserId = new Map(data.codeToUserId?.map(([k, v]) => [k, parseInt(v)]) || []);
    
    data = safeReadFile(HISTORY_FILE, []);
    purchaseHistory = new Map();
    if (Array.isArray(data)) {
        data.forEach(([userId, items]) => {
            if (Array.isArray(items)) {
                const historyMap = new Map();
                items.forEach(([itemId, itemData]) => historyMap.set(itemId, itemData));
                purchaseHistory.set(parseInt(userId), historyMap);
            }
        });
    }
    
    data = safeReadFile(PROMOCODES_FILE, null);
    if (data && Array.isArray(data)) {
        promoCodes = new Map(data);
    } else {
        generatePromoCodes();
    }
    
    console.log('✅ Данные загружены');
}
loadData();

// ========== АНТИСПАМ ==========
function checkSpam(userId) {
    if (userBlocked.has(userId)) {
        const until = userBlocked.get(userId);
        if (Date.now() < until) return { blocked: true, seconds: Math.ceil((until - Date.now()) / 1000) };
        userBlocked.delete(userId);
        userCommands.delete(userId);
    }
    const now = Date.now();
    let commands = userCommands.get(userId) || [];
    commands = commands.filter(t => now - t < 20000);
    commands.push(now);
    userCommands.set(userId, commands);
    if (commands.length >= 10) {
        userBlocked.set(userId, now + 30000);
        return { blocked: true, seconds: 30 };
    }
    return { blocked: false };
}

// ========== ЗАЩИТА ПРОМОКОДОВ ==========
function checkPromoAttempt(userId) {
    const now = Date.now();
    let data = userPromoAttempts.get(userId) || { attempts: 0, blockUntil: 0 };
    if (data.blockUntil > now) return { blocked: true, seconds: Math.ceil((data.blockUntil - now) / 1000) };
    if (data.attempts >= 3) {
        userPromoAttempts.set(userId, { attempts: 0, blockUntil: now + 600000 });
        return { blocked: true, seconds: 600 };
    }
    return { blocked: false };
}
function resetPromoAttempts(userId) { userPromoAttempts.set(userId, { attempts: 0, blockUntil: 0 }); }
function increasePromoAttempt(userId) {
    let data = userPromoAttempts.get(userId) || { attempts: 0, blockUntil: 0 };
    data.attempts++;
    userPromoAttempts.set(userId, data);
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
function generateRefCode(userId) {
    if (userCodes.has(userId)) return userCodes.get(userId);
    let code;
    do { code = Math.random().toString(36).substring(2, 8).toUpperCase(); }
    while (codeToUserId.has(code));
    userCodes.set(userId, code);
    codeToUserId.set(code, userId);
    saveCodes();
    return code;
}

function getBalance(userId) { return (referralCounts.get(userId) || 0) * 50; }

function addReferral(referrerId, newUserId) {
    if (referrerId === newUserId || referrers.has(newUserId) || blacklist.has(referrerId) || blacklist.has(newUserId)) return false;
    referrers.set(newUserId, referrerId);
    referralCounts.set(referrerId, (referralCounts.get(referrerId) || 0) + 1);
    saveReferrals();
    saveReferrer();
    return true;
}

function addStars(userId, stars) {
    const refs = Math.floor(stars / 50);
    if (refs <= 0) return false;
    referralCounts.set(userId, (referralCounts.get(userId) || 0) + refs);
    saveReferrals();
    return true;
}

async function registerUser(userId, username, firstName) {
    if (!users.has(userId)) {
        users.set(userId, { id: userId, firstName: firstName || 'Без имени', username: username || null, regDate: Date.now(), regDateStr: new Date().toLocaleString('ru-RU') });
        saveUsers();
    }
}

async function checkSubscription(userId) {
    try {
        const chatMember = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch { return false; }
}

function addToHistory(userId, giftName, recipient, price) {
    if (!purchaseHistory.has(userId)) purchaseHistory.set(userId, new Map());
    const id = Date.now();
    purchaseHistory.get(userId).set(id, { id, giftName, recipient, price, date: id, dateStr: new Date(id).toLocaleString('ru-RU') });
    saveHistory();
}

function getUserHistory(userId, limit = 10) {
    const history = purchaseHistory.get(userId);
    if (!history || history.size === 0) return [];
    const arr = Array.from(history.values());
    arr.sort((a, b) => b.date - a.date);
    return arr.slice(0, limit);
}

function getReferralTop() {
    const top = [];
    for (const [userId, count] of referralCounts) {
        const user = users.get(userId);
        if (count > 0) top.push({ name: user?.firstName || user?.username || `ID${userId}`, count });
    }
    top.sort((a, b) => b.count - a.count);
    return top.slice(0, 10);
}

function getReferralRank(count) {
    if (count === 0) return "📌 Новичок";
    if (count < 3) return "🌱 Начинающий";
    if (count < 10) return "⭐ Активный";
    if (count < 25) return "🔥 Лидер";
    if (count < 50) return "👑 Эксперт";
    return "💎 Легенда";
}

async function getProfile(userId) {
    const user = users.get(userId);
    if (!user) return "❌ Вы не зарегистрированы";
    const refCount = referralCounts.get(userId) || 0;
    return `👤 *ПРОФИЛЬ*\n\n👤 Имя: ${user.firstName}\n🆔 ID: \`${userId}\`\n📅 Регистрация: ${user.regDateStr}\n\n👥 Рефералов: ${refCount}\n💰 Баланс: ${getBalance(userId)} ⭐\n🏆 Статус: ${getReferralRank(refCount)}\n\n🔑 *Твой код:* \`${generateRefCode(userId)}\``;
}

async function showMenu(chatId, userId) {
    await bot.sendMessage(chatId,
        `🐻 *ГЛАВНОЕ МЕНЮ*\n\n💰 Баланс: ${getBalance(userId)} ⭐\n👥 Рефералов: ${referralCounts.get(userId) || 0}\n\nВыбери действие:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎁 КУПИТЬ ПОДАРОК', callback_data: 'buy' }],
                    [{ text: '👤 МОЙ ПРОФИЛЬ', callback_data: 'profile' }],
                    [{ text: '💰 МОЙ БАЛАНС', callback_data: 'balance' }],
                    [{ text: '👥 МОИ РЕФЕРАЛЫ', callback_data: 'referrals' }],
                    [{ text: '📜 ИСТОРИЯ ПОКУПОК', callback_data: 'history' }],
                    [{ text: '🏆 ТОП РЕФЕРАЛОВ', callback_data: 'top' }],
                    [{ text: '📞 СВЯЗАТЬСЯ', callback_data: 'manager' }]
                ]
            }
        }
    );
}

// ========== КОМАНДЫ ==========
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const spam = checkSpam(userId);
    if (spam.blocked) return bot.sendMessage(msg.chat.id, `⏳ Подожди ${spam.seconds} сек`);
    if (blacklist.has(userId)) return bot.sendMessage(msg.chat.id, "🚫 Вы заблокированы");
    await registerUser(userId, msg.from.username, msg.from.first_name);
    const subscribed = await checkSubscription(userId);
    if (!subscribed && !MANAGERS.includes(userId)) {
        const link = `https://t.me/${REQUIRED_CHANNEL.slice(1)}`;
        return bot.sendMessage(msg.chat.id, `🔒 *ПОДПИШИСЬ НА КАНАЛ*\n\n${REQUIRED_CHANNEL}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '📢 ПОДПИСАТЬСЯ', url: link }, { text: '✅ ПРОВЕРИТЬ', callback_data: 'check_sub' }]] }
        });
    }
    await showMenu(msg.chat.id, userId);
});

bot.onText(/\/mycode/, async (msg) => {
    const userId = msg.from.id;
    if (checkSpam(userId).blocked || blacklist.has(userId)) return;
    await registerUser(userId, msg.from.username, msg.from.first_name);
    bot.sendMessage(msg.chat.id, `🔑 *Твой код:* \`${generateRefCode(userId)}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/ref (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    const code = match[1].toUpperCase();
    if (checkSpam(userId).blocked || blacklist.has(userId) || referrers.has(userId)) return bot.sendMessage(msg.chat.id, "❌ Ты уже использовал код");
    const referrerId = codeToUserId.get(code);
    if (!referrerId) return bot.sendMessage(msg.chat.id, "❌ Неверный код");
    if (referrerId === userId) return bot.sendMessage(msg.chat.id, "❌ Свой код нельзя");
    await registerUser(userId, msg.from.username, msg.from.first_name);
    if (addReferral(referrerId, userId)) {
        bot.sendMessage(userId, `✅ Ты приглашён @${users.get(referrerId)?.username || 'ID'+referrerId}`);
        bot.sendMessage(referrerId, `🎉 *НОВЫЙ РЕФЕРАЛ!* 👤 ${msg.from.first_name}\n💰 Баланс: ${getBalance(referrerId)} ⭐`, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/promo (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    const code = match[1].toUpperCase();
    if (checkSpam(userId).blocked || blacklist.has(userId)) return;
    const promoCheck = checkPromoAttempt(userId);
    if (promoCheck.blocked) return bot.sendMessage(msg.chat.id, `⏳ Подожди ${promoCheck.seconds} сек`);
    const promo = promoCodes.get(code);
    if (!promo || promo.used) {
        increasePromoAttempt(userId);
        return bot.sendMessage(msg.chat.id, "❌ Неверный промокод");
    }
    resetPromoAttempts(userId);
    promo.used = true;
    addStars(userId, 50);
    savePromoCodes();
    bot.sendMessage(msg.chat.id, `🎉 Промокод активирован! +50 ⭐\n💰 Новый баланс: ${getBalance(userId)} ⭐`, { parse_mode: 'Markdown' });
});

bot.onText(/\/privacy/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔒 *ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ*\n\nБот собирает: Telegram ID, имя, username, историю покупок, рефералов.\nДанные не передаются третьим лицам.\n\n📞 @prime41ks\n📢 @prime_1edits`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/menu/, async (msg) => {
    if (checkSpam(msg.from.id).blocked || blacklist.has(msg.from.id)) return;
    await showMenu(msg.chat.id, msg.from.id);
});

bot.onText(/\/profile/, async (msg) => {
    if (checkSpam(msg.from.id).blocked || blacklist.has(msg.from.id)) return;
    bot.sendMessage(msg.chat.id, await getProfile(msg.from.id), { parse_mode: 'Markdown' });
});

bot.onText(/\/balance/, (msg) => {
    if (checkSpam(msg.from.id).blocked || blacklist.has(msg.from.id)) return;
    bot.sendMessage(msg.chat.id, `💰 *БАЛАНС*\n\n${getBalance(msg.from.id)} ⭐\n👥 Рефералов: ${referralCounts.get(msg.from.id) || 0}\n💵 1 реферал = 50 ⭐`, { parse_mode: 'Markdown' });
});

bot.onText(/\/referrals/, (msg) => {
    if (checkSpam(msg.from.id).blocked || blacklist.has(msg.from.id)) return;
    const refCount = referralCounts.get(msg.from.id) || 0;
    bot.sendMessage(msg.chat.id,
        `👥 *ТВОИ РЕФЕРАЛЫ*\n\nВсего: ${refCount}\n💰 Заработано: ${getBalance(msg.from.id)} ⭐\n\n🔑 Твой код: \`${generateRefCode(msg.from.id)}\`\n👉 Друг: /ref КОД`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/history/, (msg) => {
    if (checkSpam(msg.from.id).blocked || blacklist.has(msg.from.id)) return;
    const history = getUserHistory(msg.from.id);
    if (!history.length) return bot.sendMessage(msg.chat.id, "📭 Нет покупок");
    let text = "📜 *ИСТОРИЯ ПОКУПОК*\n\n";
    for (const p of history) text += `🎁 ${p.giftName}\n👥 ${p.recipient}\n💰 ${p.price} ⭐\n📅 ${p.dateStr}\n━━━━━━━━━━\n`;
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/top/, (msg) => {
    if (checkSpam(msg.from.id).blocked || blacklist.has(msg.from.id)) return;
    const top = getReferralTop();
    let text = "🏆 *ТОП РЕФЕРАЛОВ*\n\n";
    if (!top.length) text += "Пока нет";
    else top.forEach((t, i) => text += `${i+1}. ${t.name} — ${t.count} рефералов\n`);
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/manager/, (msg) => bot.sendMessage(msg.chat.id, `📞 @${MANAGER_USERNAME}`));
bot.onText(/\/help/, async (msg) => { if (!checkSpam(msg.from.id).blocked && !blacklist.has(msg.from.id)) await showMenu(msg.chat.id, msg.from.id); });

// ========== КОМАНДЫ МЕНЕДЖЕРА ==========
bot.onText(/\/stats/, (msg) => {
    if (!MANAGERS.includes(msg.from.id)) return;
    let totalRef = 0, totalPurch = 0;
    for (const c of referralCounts.values()) totalRef += c;
    for (const h of purchaseHistory.values()) totalPurch += h.size;
    bot.sendMessage(msg.chat.id, `📊 *СТАТИСТИКА*\n\n👥 Пользователей: ${users.size}\n📦 Покупок: ${totalPurch}\n💰 Выручка: ${totalPurch * 150} ⭐\n👥 Рефералов: ${totalRef}\n💵 Выплачено: ${totalRef * 50} ⭐`, { parse_mode: 'Markdown' });
});

bot.onText(/\/listpromo/, (msg) => {
    if (!MANAGERS.includes(msg.from.id)) return;
    let text = "📋 *ПРОМОКОДЫ*\n\n";
    let i = 1;
    for (const [code, data] of promoCodes) {
        text += `${i}. \`${code}\` — ${data.used ? '✅' : '❌'}\n`;
        if (i++ >= 20) { text += `\n... и ещё ${promoCodes.size - 20}`; break; }
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/pending/, (msg) => { if (MANAGERS.includes(msg.from.id)) bot.sendMessage(msg.chat.id, "📭 Нет заявок"); });
bot.onText(/\/ban (\d+)/, (msg, match) => { if (MANAGERS.includes(msg.from.id)) { blacklist.add(parseInt(match[1])); saveBlacklist(); bot.sendMessage(msg.chat.id, `🚫 Заблокирован ${match[1]}`); } });
bot.onText(/\/unban (\d+)/, (msg, match) => { if (MANAGERS.includes(msg.from.id)) { blacklist.delete(parseInt(match[1])); saveBlacklist(); bot.sendMessage(msg.chat.id, `✅ Разблокирован ${match[1]}`); } });

// ========== ОБРАБОТКА КНОПОК ==========
bot.on('callback_query', async (cb) => {
    const userId = cb.from.id;
    const msg = cb.message;
    const data = cb.data;
    
    if (blacklist.has(userId)) return cb.answerCallbackQuery("🚫 Заблокирован");
    
    if (data === 'check_sub') {
        const sub = await checkSubscription(userId);
        if (sub) {
            bot.sendMessage(msg.chat.id, "✅ Спасибо!");
            await showMenu(msg.chat.id, userId);
        } else bot.sendMessage(msg.chat.id, "❌ Не подписан");
        return cb.answerCallbackQuery();
    }
    if (data === 'profile') { bot.sendMessage(msg.chat.id, await getProfile(userId), { parse_mode: 'Markdown' }); return cb.answerCallbackQuery(); }
    if (data === 'balance') { bot.sendMessage(msg.chat.id, `💰 *БАЛАНС*\n\n${getBalance(userId)} ⭐\n👥 Рефералов: ${referralCounts.get(userId) || 0}`, { parse_mode: 'Markdown' }); return cb.answerCallbackQuery(); }
    if (data === 'referrals') { const c = referralCounts.get(userId) || 0; bot.sendMessage(msg.chat.id, `👥 *РЕФЕРАЛЫ*\n\nВсего: ${c}\n💰 Заработано: ${getBalance(userId)} ⭐\n\n🔑 Твой код: \`${generateRefCode(userId)}\``, { parse_mode: 'Markdown' }); return cb.answerCallbackQuery(); }
    if (data === 'history') { const h = getUserHistory(userId); if (!h.length) bot.sendMessage(msg.chat.id, "📭 Нет покупок"); else { let t = "📜 *ИСТОРИЯ*\n\n"; for (const p of h) t += `🎁 ${p.giftName}\n👥 ${p.recipient}\n💰 ${p.price} ⭐\n📅 ${p.dateStr}\n━━━\n`; bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); } return cb.answerCallbackQuery(); }
    if (data === 'top') { const top = getReferralTop(); let t = "🏆 *ТОП РЕФЕРАЛОВ*\n\n"; if (!top.length) t += "Пока нет"; else top.forEach((u, i) => t += `${i+1}. ${u.name} — ${u.count}\n`); bot.sendMessage(msg.chat.id, t, { parse_mode: 'Markdown' }); return cb.answerCallbackQuery(); }
    if (data === 'manager') { bot.sendMessage(msg.chat.id, `📞 @${MANAGER_USERNAME}`); return cb.answerCallbackQuery(); }
    if (data === 'buy') {
        const last = purchases.get(userId);
        if (last && Date.now() - last < 30*24*60*60*1000 && !MANAGERS.includes(userId)) {
            const days = Math.ceil((last + 30*24*60*60*1000 - Date.now()) / (24*60*60*1000));
            bot.sendMessage(msg.chat.id, `⏳ Через ${days} дн.`);
            return cb.answerCallbackQuery();
        }
        bot.sendMessage(msg.chat.id, `🎁 *ВЫБЕРИ ПОДАРОК*\n\n💰 Мишка/Романтичный — 150 ⭐\n🤝 Отблагодарить — 30 ₽\n\n🔍 Промокоды: @prime_1edits`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
                [{ text: '🧸 МИШКА (150 ⭐)', callback_data: 'buy_bear' }],
                [{ text: '💝 РОМАНТИЧНЫЙ (150 ⭐)', callback_data: 'buy_romantic' }],
                [{ text: '🤝 ОТБЛАГОДАРИТЬ (30 ₽)', callback_data: 'buy_dev' }],
                [{ text: '🔙 НАЗАД', callback_data: 'back' }]
            ] }
        });
        return cb.answerCallbackQuery();
    }
    if (data === 'buy_bear' || data === 'buy_romantic') {
        const gift = data === 'buy_bear' ? "🧸 Мишка" : "💝 Романтичный";
        const price = 150;
        if (getBalance(userId) < price && !MANAGERS.includes(userId)) return bot.sendMessage(msg.chat.id, `❌ Нужно ${price} ⭐`);
        bot.sendMessage(msg.chat.id, `📝 ${gift}\nНапиши @username или ID:`);
        cb.answerCallbackQuery();
        const listener = async (m) => {
            if (m.chat.id !== msg.chat.id) return;
            if (getBalance(userId) < price && !MANAGERS.includes(userId)) return bot.sendMessage(msg.chat.id, `❌ Не хватает`);
            if (!MANAGERS.includes(userId)) {
                referralCounts.set(userId, (referralCounts.get(userId) || 0) - 3);
                saveReferrals();
            }
            purchases.set(userId, Date.now());
            savePurchases();
            addToHistory(userId, gift, m.text, price);
            bot.sendMessage(userId, `✅ *ПОДАРОК ОТПРАВЛЕН!*\n🎁 ${gift}\n👥 ${m.text}\n💰 -${price} ⭐\n💎 Новый баланс: ${getBalance(userId)} ⭐`, { parse_mode: 'Markdown' });
            bot.removeListener('message', listener);
        };
        bot.on('message', listener);
        return;
    }
    if (data === 'buy_dev') {
        bot.sendMessage(msg.chat.id, `🤝 *ОТБЛАГОДАРИТЬ РАЗРАБА*\n\nСтоимость: 30 ₽\n\n💳 Напишите менеджеру: @${MANAGER_USERNAME}`, { parse_mode: 'Markdown' });
        return cb.answerCallbackQuery();
    }
    if (data === 'back') {
        await showMenu(msg.chat.id, userId);
        return cb.answerCallbackQuery();
    }
});

console.log('✅ БОТ ЗАПУЩЕН!');
console.log(`📢 Канал: ${REQUIRED_CHANNEL}`);
console.log(`📸 Группа отчётов: ${REPORT_GROUP_ID}`);