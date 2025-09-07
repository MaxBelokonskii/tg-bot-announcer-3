#!/usr/bin/env node

/**
 * [RU] Скрипт инициализации базы данных
 * [EN] Database initialization script
 */

const { getDatabaseConnection } = require('./database/connection');
const fs = require('fs');

async function initializeDatabase() {
  console.log('🔧 Инициализация базы данных...');
  
  try {
    // Удаляем существующую базу если есть
    const dbPath = process.env.DATABASE_PATH || './database/bot_database.db';
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🗑️ Удалена старая база данных');
    }

    // Создаем новое подключение
    const dbConnection = getDatabaseConnection(dbPath);
    const db = dbConnection.connect();
    
    // Проверяем что таблицы созданы
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();
    
    console.log('📊 Созданные таблицы:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // Проверяем структуру таблицы users
    const userTableInfo = db.prepare(`PRAGMA table_info(users)`).all();
    console.log('\n👥 Структура таблицы users:');
    userTableInfo.forEach(column => {
      console.log(`  - ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.dflt_value ? `DEFAULT ${column.dflt_value}` : ''}`);
    });
    
    // Проверяем что колонка attendance_status существует
    const hasAttendanceStatus = userTableInfo.some(col => col.name === 'attendance_status');
    if (hasAttendanceStatus) {
      console.log('✅ Колонка attendance_status найдена');
    } else {
      console.error('❌ Колонка attendance_status отсутствует!');
      process.exit(1);
    }

    // Проверяем что колонка username существует
    const hasUsername = userTableInfo.some(col => col.name === 'username');
    if (hasUsername) {
      console.log('✅ Колонка username найдена');
    } else {
      console.error('❌ Колонка username отсутствует!');
      process.exit(1);
    }

    // Проверяем индексы
    console.log('\n🔍 Проверка индексов:');
    const indexes = db.prepare(`PRAGMA index_list(users)`).all();
    
    const requiredIndexes = ['idx_users_telegram_id', 'idx_users_username', 'idx_users_attendance'];
    const existingIndexes = indexes.map(idx => idx.name);
    
    requiredIndexes.forEach(indexName => {
      if (existingIndexes.includes(indexName)) {
        console.log(`✅ Индекс ${indexName} найден`);
      } else {
        console.warn(`⚠️ Индекс ${indexName} отсутствует`);
      }
    });
    
    // Создаем тестового пользователя для проверки
    try {
      // Тест 1: Пользователь с username
      const insertUser = db.prepare(`
        INSERT INTO users (telegram_id, full_name, username, attendance_status) 
        VALUES (?, ?, ?, ?)
      `);
      
      insertUser.run('test_123', 'Тестовый Пользователь', 'test_user', 'attending');
      console.log('✅ Тестовый пользователь с username создан');
      
      // Проверяем что пользователь создался
      const user = db.prepare(`
        SELECT telegram_id, full_name, username, attendance_status 
        FROM users 
        WHERE telegram_id = ?
      `).get('test_123');
      
      if (user && user.username === 'test_user') {
        console.log(`✅ Тестовый пользователь найден: ${user.full_name} (@${user.username}) (${user.attendance_status})`);
        
        // Тест обновления username
        const updateResult = db.prepare(`
          UPDATE users 
          SET username = ? 
          WHERE telegram_id = ?
        `).run('updated_user', 'test_123');
        
        if (updateResult.changes > 0) {
          console.log('✅ Обновление username работает');
        } else {
          console.warn('⚠️ Обновление username не сработало');
        }
      } else {
        console.error('❌ Ошибка: пользователь с username не найден или username некорректен');
        process.exit(1);
      }
      
      // Тест 2: Пользователь без username (обратная совместимость)
      insertUser.run('test_456', 'Пользователь без Username', null, 'attending');
      console.log('✅ Пользователь без username создан (обратная совместимость)');
      
      // Удаляем тестовых пользователей
      db.prepare('DELETE FROM users WHERE telegram_id IN (?, ?)').run('test_123', 'test_456');
      console.log('🧹 Тестовые пользователи удалены');
      
    } catch (error) {
      console.error('❌ Ошибка работы с username:', error.message);
      process.exit(1);
    }
    
    dbConnection.close();
    console.log('\n🎉 База данных успешно инициализирована!');
    console.log(`📍 Файл базы данных: ${dbPath}`);
    
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запускаем если вызвано напрямую
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };