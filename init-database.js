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
    const dbPath = process.env.DATABASE_PATH || './bot_database.db';
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
    
    // Создаем тестового пользователя для проверки
    try {
      const insertUser = db.prepare(`
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `);
      
      insertUser.run('test_123', 'Тестовый Пользователь', 'attending');
      console.log('✅ Тестовый пользователь создан');
      
      // Проверяем что пользователь создался
      const user = db.prepare(`
        SELECT telegram_id, full_name, attendance_status 
        FROM users 
        WHERE telegram_id = ?
      `).get('test_123');
      
      if (user) {
        console.log(`✅ Тестовый пользователь найден: ${user.full_name} (${user.attendance_status})`);
        
        // Удаляем тестового пользователя
        db.prepare('DELETE FROM users WHERE telegram_id = ?').run('test_123');
        console.log('🧹 Тестовый пользователь удален');
      }
      
    } catch (error) {
      console.error('❌ Ошибка работы с attendance_status:', error.message);
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