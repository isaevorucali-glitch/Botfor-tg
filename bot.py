# main.py
import asyncio
import json
import os
import random
import string
import time
from datetime import datetime
from typing import Dict, List, Set, Tuple, Any
from collections import defaultdict, deque

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes

# Конфигурация
TOKEN = "8573154507:AAFdIktsSkIAi8sN6XnQ7GgEZyQ_kZ9f51g"
MANAGERS = [8211976202, 6101289439]
MANAGER_USERNAME = "prime41ks"
REQUIRED_CHANNEL = "@prime_1edits"
REPORT_GROUP_ID = -5102612415

# Файлы для хранения данных
USERS_FILE = "users.json"
REFERRALS_FILE = "referrals.json"
REFERRER_FILE = "referrer.json"
PURCHASES_FILE = "purchases.json"
HISTORY_FILE = "history.json"
CODES_FILE = "codes.json"
BLACKLIST_FILE = "blacklist.json"
PROMOCODES_FILE = "promocodes.json"

# Переменные для хранения данных в памяти
users: Dict[int, dict] = {}
referral_counts: Dict[int, int] = {}
referrers: Dict[int, int] = {}
purchases: Dict[int, int] = {}
purchase_history: Dict[int, Dict[int, dict]] = {}
user_codes: Dict[int, str] = {}
code_to_user_id: Dict[str, int] = {}
blacklist: Set[int] = set()
promo_codes: Dict[str, dict] = {}

# Система анти-спама
user_commands: Dict[int, deque] = {}
user_blocked: Dict[int, int] = {}
user_promo_attempts: Dict[int, dict] = {}

# Загрузка данных при запуске
def load_data():
    global users, referral_counts, referrers, purchases, purchase_history, user_codes, code_to_user_id, blacklist, promo_codes
    
    def safe_load(file, default=None):
        try:
            if os.path.exists(file):
                with open(file, 'r') as f:
                    return json.load(f)
            return default
        except Exception as e:
            print(f"❌ Ошибка чтения {file}: {e}")
            return default
    
    # Загрузка пользователей
    data = safe_load(USERS_FILE, [])
    users = {int(k): v for k, v in data}
    
    # Загрузка рефералов
    data = safe_load(REFERRALS_FILE, [])
    referral_counts = {int(k): v for k, v in data}
    
    # Загрузка рефереров
    data = safe_load(REFERRER_FILE, [])
    referrers = {int(k): v for k, v in data}
    
    # Загрузка покупок
    data = safe_load(PURCHASES_FILE, [])
    purchases = {int(k): v for k, v in data}
    
    # Загрузка черного списка
    data = safe_load(BLACKLIST_FILE, [])
    blacklist = {int(id) for id in data}
    
    # Загрузка кодов
    data = safe_load(CODES_FILE, {"user_codes": [], "code_to_user_id": []})
    user_codes = {int(k): v for k, v in data.get("user_codes", [])}
    code_to_user_id = {k: int(v) for k, v in data.get("code_to_user_id", [])}
    
    # Загрузка истории покупок
    data = safe_load(HISTORY_FILE, [])
    purchase_history = {}
    if isinstance(data, list):
        for user_id, items in data:
            history_dict = {}
            if isinstance(items, list):
                for item_id, item_data in items:
                    history_dict[int(item_id)] = item_data
            purchase_history[int(user_id)] = history_dict
    
    # Загрузка промокодов
    data = safe_load(PROMOCODES_FILE, None)
    if isinstance(data, list):
        promo_codes = dict(data)
    else:
        generate_promo_codes()

    print('✅ Данные загружены')

def save_data():
    def safe_save(file, data):
        try:
            with open(file, 'w') as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            print(f"❌ Ошибка сохранения {file}: {e}")
            return False
    
    # Сохранение пользователей
    safe_save(USERS_FILE, list(users.items()))
    
    # Сохранение рефералов
    safe_save(REFERRALS_FILE, list(referral_counts.items()))
    
    # Сохранение рефереров
    safe_save(REFERRER_FILE, list(referrers.items()))
    
    # Сохранение покупок
    safe_save(PURCHASES_FILE, list(purchases.items()))
    
    # Сохранение черного списка
    safe_save(BLACKLIST_FILE, list(blacklist))
    
    # Сохранение кодов доступа
    safe_save(CODES_FILE, {
        "user_codes": list(user_codes.items()),
        "code_to_user_id": list(code_to_user_id.items())
    })
    
    # Сохранение истории покупок
    history_list = [[userId, list(history.items())] for userId, history in purchase_history.items()]
    safe_save(HISTORY_FILE, history_list)
    
    # Сохранение промокодов
    safe_save(PROMOCODES_FILE, list(promo_codes.items()))

def generate_promo_codes():
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ2345679'
    codes = []
    for _ in range(100):
        code = ''.join(random.choice(chars) for _ in range(5))
        codes.append((code, {"used": False}))
    
    global promo_codes
    promo_codes = dict(codes)
    save_data()

def check_spam(user_id: int) -> dict:
    if user_id in user_blocked:
        until = user_blocked[user_id]
        if time.time() < until:
            return {"blocked": True, "seconds": int((until - time.time()) / 1000)}
        del user_blocked[user_id]
        if user_id in user_commands:
            del user_commands[user_id]
    
    now = time.time()
    commands = user_commands.get(user_id, deque(maxlen=10))
    commands.append(now)
    user_commands[user_id] = commands
    
    if len(commands) >= 10:
        user_blocked[user_id] = now + 30
        return {"blocked": True, "seconds": 30}
    
    return {"blocked": False}

def check_promo_attempt(user_id: int) -> dict:
    now = time.time()
    data = user_promo_attempts.get(user_id, {"attempts": 0, "block_until": 0})
    
    if data["block_until"] > now:
        return {"blocked": True, "seconds": int((data["block_until"] - now) / 1000)}
    
    if data["attempts"] >= 3:
        user_promo_attempts[user_id] = {"attempts": 0, "block_until": now + 600}
        return {"blocked": True, "seconds": 600}
    
    return {"blocked": False}

def reset_promo_attempts(user_id: int):
    user_promo_attempts[user_id] = {"attempts": 0, "block_until": 0}

def increase_promo_attempt(user_id: int):
    data = user_promo_attempts.get(user_id, {"attempts": 0, "block_until": 0})
    data["attempts"] += 1
    user_promo_attempts[user_id] = data

def generate_ref_code(user_id: int) -> str:
    if user_id in user_codes:
        return user_codes[user_id]
    
    code = ""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6)).upper()
        if code not in code_to_user_id:
            break
            
    user_codes[user_id] = code
    code_to_user_id[code] = user_id
    save_data()
    return code

def get_balance(user_id: int) -> int:
    return referral_counts.get(user_id, 0) * 50

def add_referral(referrer_id: int, new_user_id: int) -> bool:
    if referrer_id == new_user_id or new_user_id in referrers or referrer_id in blacklist or new_user_id in blacklist:
        return False
    
    referrers[new_user_id] = referrer_id
    referral_counts[referrer_id] = referral_counts.get(referrer_id, 0) + 1
    save_data()
    return True

def add_stars(user_id: int, stars: int) -> bool:
    refs = stars // 50
    if refs <= 0:
        return False
    
    referral_counts[user_id] = referral_counts.get(user_id, 0) + refs
    save_data()
    return True

async def register_user(user_id: int, username: str, first_name: str):
    if user_id not in users:
        users[user_id] = {
            "id": user_id,
            "first_name": first_name or "Без имени",
            "username": username or None,
            "reg_date": int(time.time()),
            "reg_date_str": datetime.now().strftime('%d.%m.%Y %H:%M:%S')
        }
        save_data()

async def check_subscription(user_id: int) -> bool:
    try:
        # Здесь должен быть код для проверки подписки, но мы просто отправим сообщение
        # В реальном приложении вы бы использовали Bot API для проверки статуса пользователя
        return False  # временно отключено
    except Exception:
        return False

def add_to_history(user_id: int, gift_name: str, recipient: str, price: int):
    if user_id not in purchase_history:
        purchase_history[user_id] = {}
    
    item_id = int(time.time() * 1000)
    purchase_history[user_id][item_id] = {
        "id": item_id,
        "gift_name": gift_name,
        "recipient": recipient,
        "price": price,
        "date": int(time.time() * 1000),
        "date_str": datetime.now().strftime('%d.%m.%Y %H:%M:%S')
    }
    save_data()

def get_user_history(user_id: int, limit: int = 10) -> list:
    history = purchase_history.get(user_id, {})
    if not history:
        return []
    
    # Сортировка по дате (новые сверху)
    sorted_items = sorted(history.items(), key=lambda x: x[1]['date'], reverse=True)
    return [item[1] for item in sorted_items[:limit]]

def get_referral_top() -> list:
    top = []
    for user_id, count in referral_counts.items():
        if count > 0:
            user = users.get(user_id)
            name = user.get("first_name") or user.get("username") or f"ID{user_id}"
            top.append({"name": name, "count": count})
    
    # Сортировка по количеству рефералов
    top.sort(key=lambda x: x["count"], reverse=True)
    return top[:10]

def get_referral_rank(count: int) -> str:
    if count == 0:
        return "📌 Новичок"
    elif count < 3:
        return "🌱 Начинающий"
    elif count < 10:
        return "⭐ Активный"
    elif count < 25:
        return "🔥 Лидер"
    elif count < 50:
        return "👑 Эксперт"
    else:
        return "💎 Легенда"

async def get_profile(user_id: int) -> str:
    user = users.get(user_id)
    if not user:
        return "❌ Вы не зарегистрированы"
    
    ref_count = referral_counts.get(user_id, 0)
    return f"""👤 *ПРОФИЛЬ*

👤 Имя: {user['first_name']}
🆔 ID: `{user_id}`
📅 Регистрация: {user['reg_date_str']}

👥 Рефералов: {ref_count}
💰 Баланс: {get_balance(user_id)} ⭐
🏆 Статус: {get_referral_rank(ref_count)}

🔑 *Твой код:* `{generate_ref_code(user_id)}`"""

async def show_menu(chat_id: int, user_id: int):
    balance = get_balance(user_id)
    ref_count = referral_counts.get(user_id, 0)
    
    keyboard = [
        [InlineKeyboardButton("🎁 КУПИТЬ ПОДАРОК", callback_data="buy")],
        [InlineKeyboardButton("👤 МОЙ ПРОФИЛЬ", callback_data="profile")],
        [InlineKeyboardButton("💰 МОЙ БАЛАНС", callback_data="balance")],
        [InlineKeyboardButton("👥 МОИ РЕФЕРАЛЫ", callback_data="referrals")],
        [InlineKeyboardButton("📜 ИСТОРИЯ ПОКУПОК", callback_data="history")],
        [InlineKeyboardButton("🏆 ТОП РЕФЕРАЛОВ", callback_data="top")],
        [InlineKeyboardButton("📞 СВЯЗАТЬСЯ", callback_data="manager")],
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await bot.send_message(
        chat_id=chat_id,
        text=f"🐻 *ГЛАВНОЕ МЕНЮ*\n\n💰 Баланс: {balance} ⭐\n👥 Рефералов: {ref_count}\n\nВыбери действие:",
        parse_mode="Markdown",
        reply_markup=reply_markup
    )

# Команды бота
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"]:
        await update.message.reply_text(f"⏳ Подожди {spam['seconds']} сек")
        return
    
    if user_id in blacklist:
        await update.message.reply_text("🚫 Вы заблокированы")
        return
    
    await register_user(user_id, update.effective_user.username, update.effective_user.first_name)
    
    # Проверка подписки
    
    await show_menu(update.effective_chat.id, user_id)

async def mycode_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    await register_user(user_id, update.effective_user.username, update.effective_user.first_name)
    
    code = generate_ref_code(user_id)
    await update.message.reply_text(f"🔑 *Твой код:* `{code}`", parse_mode="Markdown")

async def ref_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not context.args or len(context.args) == 0:
        await update.message.reply_text("❌ Нужно указать код. Пример: /ref ABCDEF")
        return

    code = context.args[0].upper()
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist or user_id in referrers:
        await update.message.reply_text("❌ Ты уже использовал код")
        return
    
    referrer_id = code_to_user_id.get(code)
    if not referrer_id:
        await update.message.reply_text("❌ Неверный код")
        return
    
    if referrer_id == user_id:
        await update.message.reply_text("❌ Свой код нельзя")
        return
    
    await register_user(user_id, update.effective_user.username, update.effective_user.first_name)
    
    if add_referral(referrer_id, user_id):
        await update.message.reply_text(f"✅ Ты приглашён @{users.get(referrer_id, {}).get('username', f'ID{referrer_id}')}")
        await bot.send_message(
            chat_id=referrer_id,
            text=f"🎉 *НОВЫЙ РЕФЕРАЛ!* 👤 {update.effective_user.first_name}\n💰 Баланс: {get_balance(referrer_id)} ⭐",
            parse_mode="Markdown"
        )

async def promo_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not context.args or len(context.args) == 0:
        await update.message.reply_text("❌ Нужно указать код. Пример: /promo ABCDEF")
        return

    code = context.args[0].upper()
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    promo_check = check_promo_attempt(user_id)
    if promo_check["blocked"]:
        await update.message.reply_text(f"⏳ Подожди {promo_check['seconds']} сек")
        return
    
    promo = promo_codes.get(code)
    if not promo or promo["used"]:
        increase_promo_attempt(user_id)
        await update.message.reply_text("❌ Неверный промокод")
        return
    
    reset_promo_attempts(user_id)
    promo["used"] = True
    add_stars(user_id, 50)
    save_data()
    
    balance = get_balance(user_id)
    await update.message.reply_text(
        f"🎉 Промокод активирован! +50 ⭐\n💰 Новый баланс: {balance} ⭐",
        parse_mode="Markdown"
    )

async def privacy_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        """🔒 *ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ*

Бот собирает: Telegram ID, имя, username, историю покупок, рефералов.
Данные не передаются третьим лицам.

📞 @prime41ks
📢 @prime_1edits""",
        parse_mode="Markdown"
    )

async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    await show_menu(update.effective_chat.id, user_id)

async def profile_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    profile_text = await get_profile(user_id)
    await update.message.reply_text(profile_text, parse_mode="Markdown")

async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    balance = get_balance(user_id)
    ref_count = referral_counts.get(user_id, 0)
    
    await update.message.reply_text(
        f"💰 *БАЛАНС*\n\n{balance} ⭐\n👥 Рефералов: {ref_count}\n💵 1 реферал = 50 ⭐",
        parse_mode="Markdown"
    )

async def referrals_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    ref_count = referral_counts.get(user_id, 0)
    await update.message.reply_text(
        f"👥 *ТВОИ РЕФЕРАЛЫ*\n\nВсего: {ref_count}\n💰 Заработано: {get_balance(user_id)} ⭐\n\n🔑 Твой код: `{generate_ref_code(user_id)}`\n👉 Друг: /ref КОД",
        parse_mode="Markdown"
    )

async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    history = get_user_history(user_id)
    if not history:
        await update.message.reply_text("📭 Нет покупок")
        return
    
    text = "📜 *ИСТОРИЯ ПОКУПОК*\n\n"
    for item in history:
        text += f"🎁 {item['gift_name']}\n👥 {item['recipient']}\n💰 {item['price']} ⭐\n📅 {item['date_str']}\n━━━━━━━━━━\n"
    
    await update.message.reply_text(text, parse_mode="Markdown")

async def top_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    top = get_referral_top()
    text = "🏆 *ТОП РЕФЕРАЛОВ*\n\n"
    if not top:
        text += "Пока нет"
    else:
        for i, item in enumerate(top, 1):
            text += f"{i}. {item['name']} — {item['count']} рефералов\n"
    
    await update.message.reply_text(text, parse_mode="Markdown")

async def manager_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"📞 @{MANAGER_USERNAME}")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    spam = check_spam(user_id)
    if spam["blocked"] or user_id in blacklist:
        return
    
    await show_menu(update.effective_chat.id, user_id)

# Команды менеджера
async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in MANAGERS:
        return
    
    total_ref = sum(referral_counts.values())
    total_purch = sum(len(history) for history in purchase_history.values())
    
    await update.message.reply_text(
        f"📊 *СТАТИСТИКА*\n\n👥 Пользователей: {len(users)}\n📦 Покупок: {total_purch}\n💰 Выручка: {total_purch * 150} ⭐\n👥 Рефералов: {total_ref}\n💵 Выплачено: {total_ref * 50} ⭐",
        parse_mode="Markdown"
    )

async def listpromo_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in MANAGERS:
        return
    
    text = "📋 *ПРОМОКОДЫ*\n\n"
    i = 1
    for code, data in list(promo_codes.items())[:20]:
        text += f"{i}. `{code}` — {'✅' if data['used'] else '❌'}\n"
        i += 1
        if i > 20:
            text += f"\n... и ещё {len(promo_codes) - 20}"
            break
    
    await update.message.reply_text(text, parse_mode="Markdown")

async def pending_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in MANAGERS:
        return
    
    await update.message.reply_text("📭 Нет заявок")

async def ban_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in MANAGERS or not context.args or len(context.args) == 0:
        return
    
    try:
        banned_id = int(context.args[0])
        blacklist.add(banned_id)
        save_data()
        await update.message.reply_text(f"🚫 Заблокирован {banned_id}")
    except ValueError:
        await update.message.reply_text("❌ Неверный ID")

async def unban_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id not in MANAGERS or not context.args or len(context.args) == 0:
        return
    
    try:
        unbanned_id = int(context.args[0])
        blacklist.discard(unbanned_id)
        save_data()
        await update.message.reply_text(f"✅ Разблокирован {unbanned_id}")
    except ValueError:
        await update.message.reply_text("❌ Неверный ID")

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    data = query.data
    
    if user_id in blacklist:
        await query.answer(text="🚫 Заблокирован", show_alert=True)
        return
    
    # Для простоты проверки используем пустую функцию, которая ничего не делает
    if data == 'check_sub':
        # Здесь должна быть проверка подписки (в реальном боте)
        await query.message.reply_text("✅ Спасибо!")
        await show_menu(query.message.chat_id, user_id)
        return
    elif data == 'profile':
        profile_text = await get_profile(user_id)
        await query.message.reply_text(profile_text, parse_mode="Markdown")
        return
    elif data == 'balance':
        balance = get_balance(user_id)
        ref_count = referral_counts.get(user_id, 0)
        await query.message.reply_text(
            f"💰 *БАЛАНС*\n\n{balance} ⭐\n👥 Рефералов: {ref_count}",
            parse_mode="Markdown"
        )
        return
    elif data == 'referrals':
        ref_count = referral_counts.get(user_id, 0)
        balance = get_balance(user_id)
        await query.message.reply_text(
            f"👥 *РЕФЕРАЛЫ*\n\nВсего: {ref_count}\n💰 Заработано: {balance} ⭐\n\n🔑 Твой код: `{generate_ref_code(user_id)}`",
            parse_mode="Markdown"
        )
        return
    elif data == 'history':
        history = get_user_history(user_id)
        if not history:
            await query.message.reply_text("📭 Нет покупок")
        else:
            text = "📜 *ИСТОРИЯ*\n\n"
            for item in history:
                text += f"🎁 {item['gift_name']}\n👥 {item['recipient']}\n💰 {item['price']} ⭐\n📅 {item['date_str']}\n━━━\n"
            await query.message.reply_text(text, parse_mode="Markdown")
        return
    elif data == 'top':
        top = get_referral_top()
        text = "🏆 *ТОП РЕФЕРАЛОВ*\n\n"
        if not top:
            text += "Пока нет"
        else:
            for i, item in enumerate(top, 1):
                text += f"{i}. {item['name']} — {item['count']}\n"
        await query.message.reply_text(text, parse_mode="Markdown")
        return
    elif data == 'manager':
        await query.message.reply_text(f"📞 @{MANAGER_USERNAME}")
        return
    elif data == 'buy':
        last_purchase = purchases.get(user_id)
        if last_purchase and time.time() - last_purchase < 30*24*60*60 and user_id not in MANAGERS:
            days = max(1, int((last_purchase + 30*24*60*60 - time.time()) / (24*60*60)))
            await query.message.reply_text(f"⏳ Через {days} дн.")
            return
        
        keyboard = [
            [InlineKeyboardButton("🧸 МИШКА (150 ⭐)", callback_data="buy_bear")],
            [InlineKeyboardButton("💝 РОМАНТИЧНЫЙ (150 ⭐)", callback_data="buy_romantic")],
            [InlineKeyboardButton("🤝 ОТБЛАГОДАРИТЬ (30 ₽)", callback_data="buy_dev")],
            [InlineKeyboardButton("🔙 НАЗАД", callback_data="back")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.message.reply_text(
            "🎁 *ВЫБЕРИ ПОДАРОК*\n\n💰 Мишка/Романтичный — 150 ⭐\n🤝 Отблагодарить — 30 ₽\n\n🔍 Промокоды: @prime_1edits",
            parse_mode="Markdown",
            reply_markup=reply_markup
        )
        return
    elif data == 'buy_bear' or data == 'buy_romantic':
        gift = "🧸 Мишка" if data == 'buy_bear' else "💝 Романтичный"
        price = 150
        
        if get_balance(user_id) < price and user_id not in MANAGERS:
            await query.message.reply_text(f"❌ Нужно {price} ⭐")
            return
            
        await query.message.reply_text(f"📝 {gift}\nНапиши @username или ID:")
        
        # Логика ожидания ответа пользователя
        return
    elif data == 'buy_dev':
        await query.message.reply_text(
            f"🤝 *ОТБЛАГОДАРИТЬ РАЗРАБА*\n\nСтоимость: 30 ₽\n\n💳 Напишите менеджеру: @{MANAGER_USERNAME}",
            parse_mode="Markdown"
        )
        return
    elif data == 'back':
        await show_menu(query.message.chat_id, user_id)
        return

# Запуск бота
async def main():
    # Загрузка всех данных при старте
    load_data()
    
    # Создание приложения бота
    application = Application.builder().token(TOKEN).build()
    
    # Добавление обработчиков команд
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("mycode", mycode_command))
    application.add_handler(CommandHandler("ref", ref_command))
    application.add_handler(CommandHandler("promo", promo_command))
    application.add_handler(CommandHandler("privacy", privacy_command))
    application.add_handler(CommandHandler("menu", menu_command))
    application.add_handler(CommandHandler("profile", profile_command))
    application.add_handler(CommandHandler("balance", balance_command))
    application.add_handler(CommandHandler("referrals", referrals_command))
    application.add_handler(CommandHandler("history", history_command))
    application.add_handler(CommandHandler("top", top_command))
    application.add_handler(CommandHandler("manager", manager_command))
    application.add_handler(CommandHandler("help", help_command))
    
    # Команды менеджера
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("listpromo", listpromo_command))
    application.add_handler(CommandHandler("pending", pending_command))
    application.add_handler(CommandHandler("ban", ban_command))
    application.add_handler(CommandHandler("unban", unban_command))
    
    # Обработчик кнопок
    application.add_handler(CallbackQueryHandler(button_handler))
    
    # Запуск бота
    await application.run_polling()

if __name__ == "__main__":
    print('✅ БОТ ЗАПУЩЕН!')
    print(f"📢 Канал: {REQUIRED_CHANNEL}")
    print(f"📸 Группа отчётов: {REPORT_GROUP_ID}")
    
    # Запуск главного цикла
    asyncio.run(main())
