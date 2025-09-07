#!/bin/bash

# Скрипт быстрой диагностики админской рассылки
# Quick diagnostic script for admin broadcast functionality

echo "🔍 Диагностика админской рассылки"
echo "================================="

# Проверка файлов
echo "📁 Проверка файлов:"
check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1"
    else
        echo "❌ $1 отсутствует"
    fi
}

check_file "database/bot_database.db"
check_file ".env"
check_file "features/admin/api.js"
check_file "features/admin/logic.js"
check_file "bot/index.js"
check_file "bot/router.js"

# Проверка переменных окружения
echo ""
echo "🔧 Проверка переменных окружения:"
if [ -f ".env" ]; then
    if grep -q "BOT_TOKEN=" .env; then
        echo "✅ BOT_TOKEN найден"
    else
        echo "❌ BOT_TOKEN отсутствует"
    fi
    
    if grep -q "ADMIN_ID=" .env; then
        echo "✅ ADMIN_ID найден"
    else
        echo "❌ ADMIN_ID отсутствует"
    fi
else
    echo "❌ .env файл отсутствует"
fi

# Проверка структуры базы данных
echo ""
echo "💾 Проверка базы данных:"
if [ -f "database/bot_database.db" ]; then
    echo "✅ База данных найдена"
    
    # Проверяем наличие таблиц
    tables=$(sqlite3 database/bot_database.db ".tables")
    
    if echo "$tables" | grep -q "admin_messages"; then
        echo "✅ Таблица admin_messages найдена"
    else
        echo "❌ Таблица admin_messages отсутствует"
    fi
    
    if echo "$tables" | grep -q "users"; then
        echo "✅ Таблица users найдена"
    else
        echo "❌ Таблица users отсутствует"
    fi
    
    # Подсчет пользователей
    user_count=$(sqlite3 database/bot_database.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    echo "👥 Пользователей в базе: $user_count"
    
    # Подсчет админских сообщений
    admin_msg_count=$(sqlite3 database/bot_database.db "SELECT COUNT(*) FROM admin_messages;" 2>/dev/null || echo "0")
    echo "📨 Админских сообщений: $admin_msg_count"
else
    echo "❌ База данных отсутствует"
fi

# Проверка компонентов
echo ""
echo "🧪 Проверка компонентов:"
echo "✅ Используйте node tests/debug/validate-admin-broadcast.js для полной проверки"

# Валидация кода
echo ""
echo "🔍 Валидация кода:"
if node tests/debug/validate-admin-broadcast.js > /dev/null 2>&1; then
    echo "✅ Валидация прошла успешно"
else
    echo "❌ Ошибки валидации"
fi

echo ""
echo "🚀 Для запуска полной валидации:"
echo "     node tests/debug/validate-admin-broadcast.js"
echo ""
echo "📋 Для запуска бота:"
echo "     npm start"
echo ""
echo "🎯 ДИАГНОСТИКА ЗАВЕРШЕНА"