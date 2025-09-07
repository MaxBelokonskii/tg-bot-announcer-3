#!/usr/bin/env node

/**
 * [RU] Скрипт проверки функциональности базы данных
 * [EN] Database functionality verification script
 */

const { getDatabaseConnection } = require('../../database/connection');

async function testDatabaseFunctionality() {
  console.log('🔍 Проверка функциональности базы данных...');
  
  try {
    // Подключаемся к существующей базе
    const dbConnection = getDatabaseConnection('../../bot_database.db');
    const db = dbConnection.connect();
    
    console.log('✅ Подключение к базе данных установлено');
    
    // Проверяем availability колонки attendance_status
    console.log('\n📋 Тестирование операций с attendance_status:');
    
    // Создаем тестового пользователя
    const insertUser = db.prepare(`
      INSERT INTO users (telegram_id, full_name, attendance_status) 
      VALUES (?, ?, ?)
    `);
    
    const userId = 'test_' + Date.now();
    insertUser.run(userId, 'Test User', 'attending');
    console.log('✅ Создан тестовый пользователь с attendance_status');
    
    // Читаем пользователя
    const getUser = db.prepare(`
      SELECT telegram_id, full_name, attendance_status, attendance_updated_at
      FROM users 
      WHERE telegram_id = ?
    `);
    
    const user = getUser.get(userId);
    console.log(`✅ Пользователь найден: ${user.full_name} (статус: ${user.attendance_status})`);
    
    // Обновляем статус
    const updateStatus = db.prepare(`
      UPDATE users 
      SET attendance_status = ?, attendance_updated_at = CURRENT_TIMESTAMP 
      WHERE telegram_id = ?
    `);
    
    updateStatus.run('maybe', userId);
    console.log('✅ Статус обновлен на "maybe"');
    
    // Проверяем обновление
    const updatedUser = getUser.get(userId);
    console.log(`✅ Обновленный статус: ${updatedUser.attendance_status}`);
    
    // Проверяем статистику по статусам
    const getStats = db.prepare(`
      SELECT attendance_status, COUNT(*) as count 
      FROM users 
      GROUP BY attendance_status
    `);
    
    const stats = getStats.all();
    console.log('\n📊 Статистика по статусам:');
    stats.forEach(stat => {
      console.log(`  - ${stat.attendance_status}: ${stat.count} пользователей`);
    });
    
    // Удаляем тестового пользователя
    const deleteUser = db.prepare('DELETE FROM users WHERE telegram_id = ?');
    deleteUser.run(userId);
    console.log('🧹 Тестовый пользователь удален');
    
    dbConnection.close();
    console.log('\n🎉 Все операции с attendance_status выполнены успешно!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка при работе с базой данных:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Запускаем если вызвано напрямую
if (require.main === module) {
  testDatabaseFunctionality().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testDatabaseFunctionality };