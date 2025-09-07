-- Схема базы данных для Telegram бота напоминаний о событиях
-- [RU] Создание таблиц для управления пользователями, ответами, сообщениями и логами доставки
-- [EN] Database schema for Telegram event reminder bot

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    attendance_status TEXT DEFAULT 'attending' CHECK (attendance_status IN ('attending', 'not_attending', 'maybe')),
    attendance_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ответов пользователей
CREATE TABLE IF NOT EXISTS user_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Таблица запланированных сообщений
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_text TEXT NOT NULL,
    send_date DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица логов доставки
CREATE TABLE IF NOT EXISTS delivery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'blocked')),
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES scheduled_messages(id) ON DELETE CASCADE
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_attendance ON users(attendance_status);
CREATE INDEX IF NOT EXISTS idx_user_responses_user ON user_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_date ON scheduled_messages(send_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_user_message ON delivery_logs(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON delivery_logs(status);

-- Триггеры для автоматического обновления timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_scheduled_messages_timestamp 
    AFTER UPDATE ON scheduled_messages
BEGIN
    UPDATE scheduled_messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;