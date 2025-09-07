#!/usr/bin/env node

/**
 * [RU] Скрипт миграции для добавления поля username в таблицу users
 * [EN] Migration script to add username field to users table
 */

const { getDatabaseConnection } = require('./connection');
const fs = require('fs');

/**
 * [RU] Выполнение миграции добавления поля username
 * [EN] Execute migration to add username field
 */
async function migrateAddUsername() {
  console.log('🔧 Начинаем миграцию добавления поля username...');
  
  try {
    // Подключаемся к базе данных
    const dbPath = process.env.DATABASE_PATH || './bot_database.db';
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ База данных не найдена. Запустите init-database.js сначала.');
      process.exit(1);
    }

    const dbConnection = getDatabaseConnection(dbPath);
    const db = dbConnection.connect();
    
    // Проверяем текущую структуру таблицы users
    console.log('📊 Проверяем текущую структуру таблицы users...');
    const currentSchema = db.prepare(`PRAGMA table_info(users)`).all();
    const hasUsername = currentSchema.some(col => col.name === 'username');
    
    if (hasUsername) {
      console.log('ℹ️ Поле username уже существует в таблице users');
      dbConnection.close();
      return;
    }

    // Создаем резервную копию данных
    console.log('💾 Создаем резервную копию данных пользователей...');
    const backupData = db.prepare(`SELECT * FROM users`).all();
    console.log(`📋 Сохранено ${backupData.length} записей пользователей`);

    // Добавляем поле username
    console.log('🔧 Добавляем поле username в таблицу users...');
    db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`);

    // Добавляем индекс для поля username
    console.log('🔍 Создаем индекс для поля username...');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);

    // Проверяем успешность миграции
    const newSchema = db.prepare(`PRAGMA table_info(users)`).all();
    const usernameColumn = newSchema.find(col => col.name === 'username');
    
    if (usernameColumn) {
      console.log('✅ Поле username успешно добавлено');
      console.log(`   Тип: ${usernameColumn.type}`);
      console.log(`   NULL разрешен: ${!usernameColumn.notnull}`);
    } else {
      throw new Error('Поле username не было добавлено');
    }

    // Проверяем что данные не потерялись
    const currentData = db.prepare(`SELECT * FROM users`).all();
    if (currentData.length === backupData.length) {
      console.log('✅ Данные пользователей сохранены');
    } else {
      console.warn('⚠️ Количество записей изменилось!');
    }

    // Проверяем работу с новым полем
    console.log('🧪 Тестируем работу с новым полем...');
    
    // Создаем тестового пользователя с username
    const testInsert = db.prepare(`
      INSERT INTO users (telegram_id, full_name, username) 
      VALUES (?, ?, ?)
    `);
    
    const testResult = testInsert.run('test_migration_123', 'Тест Миграции', 'test_user');
    
    if (testResult.changes > 0) {
      console.log('✅ Вставка с username работает');
      
      // Проверяем чтение
      const testUser = db.prepare(`
        SELECT telegram_id, full_name, username 
        FROM users 
        WHERE telegram_id = ?
      `).get('test_migration_123');
      
      if (testUser && testUser.username === 'test_user') {
        console.log('✅ Чтение username работает');
        
        // Обновляем username
        const updateResult = db.prepare(`
          UPDATE users 
          SET username = ? 
          WHERE telegram_id = ?
        `).run('updated_test_user', 'test_migration_123');
        
        if (updateResult.changes > 0) {
          console.log('✅ Обновление username работает');
        } else {
          console.warn('⚠️ Обновление username не сработало');
        }
      } else {
        console.warn('⚠️ Чтение username не сработало');
      }
      
      // Удаляем тестового пользователя
      db.prepare('DELETE FROM users WHERE telegram_id = ?').run('test_migration_123');
      console.log('🧹 Тестовые данные очищены');
    } else {
      console.warn('⚠️ Вставка с username не сработала');
    }

    dbConnection.close();
    console.log('\n🎉 Миграция успешно завершена!');
    console.log('📋 Добавления:');
    console.log('  - Поле username (TEXT, NULL разрешен)');
    console.log('  - Индекс idx_users_username');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * [RU] Откат миграции (удаление поля username)
 * [EN] Rollback migration (remove username field)
 */
async function rollbackAddUsername() {
  console.log('🔄 Начинаем откат миграции username...');
  
  try {
    const dbPath = process.env.DATABASE_PATH || './bot_database.db';
    const dbConnection = getDatabaseConnection(dbPath);
    const db = dbConnection.connect();
    
    // Удаляем индекс
    console.log('🗑️ Удаляем индекс username...');
    db.exec(`DROP INDEX IF EXISTS idx_users_username;`);
    
    // SQLite не поддерживает DROP COLUMN, поэтому пересоздаем таблицу
    console.log('🔧 Пересоздаем таблицу users без поля username...');
    
    // Получаем данные
    const userData = db.prepare(`
      SELECT id, telegram_id, full_name, attendance_status, 
             attendance_updated_at, created_at, updated_at 
      FROM users
    `).all();
    
    // Пересоздаем таблицу
    db.exec(`DROP TABLE users;`);
    
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        attendance_status TEXT DEFAULT 'attending' CHECK (attendance_status IN ('attending', 'not_attending', 'maybe')),
        attendance_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Восстанавливаем данные
    const insertStmt = db.prepare(`
      INSERT INTO users (id, telegram_id, full_name, attendance_status, 
                        attendance_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const user of userData) {
      insertStmt.run(
        user.id, user.telegram_id, user.full_name, user.attendance_status,
        user.attendance_updated_at, user.created_at, user.updated_at
      );
    }
    
    // Восстанавливаем индексы
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_attendance ON users(attendance_status);`);
    
    dbConnection.close();
    console.log('✅ Откат миграции завершен');
    
  } catch (error) {
    console.error('❌ Ошибка отката миграции:', error.message);
    throw error;
  }
}

// Запускаем если вызвано напрямую
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackAddUsername();
  } else {
    migrateAddUsername();
  }
}

module.exports = { migrateAddUsername, rollbackAddUsername };