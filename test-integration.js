#!/usr/bin/env node

/**
 * [RU] Скрипт для тестирования интеграции модулей
 * [EN] Module integration testing script
 */

require('dotenv').config();
const { getDatabaseConnection } = require('./database/connection');
const { OnboardingAPI } = require('./features/onboarding/api');
const { ReminderSchedulerAPI } = require('./features/reminder-scheduler/api');
const { MessageDeliveryAPI } = require('./features/message-delivery/api');

console.log('🧪 Запуск тестов интеграции модулей...\n');

async function testDatabaseConnection() {
  console.log('📊 Тестирование подключения к базе данных...');
  
  try {
    const db = getDatabaseConnection('./test_database.db');
    await db.connect();
    
    console.log('✅ База данных подключена');
    
    // Проверяем создание таблиц
    const database = db.getDatabase();
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    const expectedTables = ['users', 'user_responses', 'scheduled_messages', 'delivery_logs'];
    const actualTables = tables.map(t => t.name);
    
    for (const expectedTable of expectedTables) {
      if (actualTables.includes(expectedTable)) {
        console.log(`✅ Таблица '${expectedTable}' создана`);
      } else {
        throw new Error(`Таблица '${expectedTable}' не найдена`);
      }
    }
    
    db.close();
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка базы данных:', error.message);
    return { success: false, error: error.message };
  }
}

async function testOnboardingModule() {
  console.log('\n👤 Тестирование модуля онбординга...');
  
  try {
    const db = getDatabaseConnection('./test_database.db');
    await db.connect();
    
    const api = new OnboardingAPI(db.getDatabase());
    
    // Тест создания пользователя
    const createResult = await api.createUser('123456789', 'Тестовый Пользователь');
    if (createResult.success) {
      console.log('✅ Создание пользователя работает');
    } else {
      throw new Error('Не удалось создать пользователя');
    }
    
    // Тест получения пользователя
    const getResult = await api.getUser('123456789');
    if (getResult && getResult.full_name === 'Тестовый Пользователь') {
      console.log('✅ Получение пользователя работает');
    } else {
      throw new Error('Не удалось получить пользователя');
    }
    
    // Тест проверки существования
    const existsResult = await api.userExists('123456789');
    if (existsResult) {
      console.log('✅ Проверка существования пользователя работает');
    } else {
      throw new Error('Проверка существования не работает');
    }
    
    db.close();
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка модуля онбординга:', error.message);
    return { success: false, error: error.message };
  }
}

async function testSchedulerModule() {
  console.log('\n⏰ Тестирование планировщика напоминаний...');
  
  try {
    const db = getDatabaseConnection('./test_database.db');
    await db.connect();
    
    const api = new ReminderSchedulerAPI(db.getDatabase());
    
    // Тест создания напоминания
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // завтра
    const createResult = await api.createReminder(
      'Тестовое напоминание о встрече',
      futureDate
    );
    
    if (createResult.success) {
      console.log('✅ Создание напоминания работает');
      
      // Тест получения напоминаний
      const getResult = await api.getReminders();
      if (getResult.success && getResult.reminders.length > 0) {
        console.log('✅ Получение напоминаний работает');
      } else {
        throw new Error('Не удалось получить напоминания');
      }
      
      // Тест обновления статуса
      const updateResult = await api.updateReminderStatus(
        createResult.reminderId, 
        'sent'
      );
      if (updateResult.success) {
        console.log('✅ Обновление статуса напоминания работает');
      } else {
        throw new Error('Не удалось обновить статус');
      }
    } else {
      throw new Error('Не удалось создать напоминание');
    }
    
    db.close();
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка планировщика:', error.message);
    return { success: false, error: error.message };
  }
}

async function testDeliveryModule() {
  console.log('\n📨 Тестирование модуля доставки...');
  
  try {
    const db = getDatabaseConnection('./test_database.db');
    await db.connect();
    
    const api = new MessageDeliveryAPI(db.getDatabase());
    
    // Тест получения пользователей
    const usersResult = await api.getActiveUsers();
    if (usersResult.success) {
      console.log('✅ Получение активных пользователей работает');
      
      if (usersResult.users.length > 0) {
        // Тест логирования доставки
        const logResult = await api.logDelivery(
          usersResult.users[0].telegram_id,
          1,
          'delivered'
        );
        
        if (logResult.success) {
          console.log('✅ Логирование доставки работает');
          
          // Тест статистики доставки
          const statsResult = await api.getDeliveryStats(1);
          if (statsResult.success) {
            console.log('✅ Статистика доставки работает');
          } else {
            throw new Error('Не удалось получить статистику');
          }
        } else {
          throw new Error('Не удалось залогировать доставку');
        }
      }
    } else {
      throw new Error('Не удалось получить пользователей');
    }
    
    db.close();
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка модуля доставки:', error.message);
    return { success: false, error: error.message };
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Очистка тестовых данных...');
  
  try {
    const fs = require('fs');
    const testDbPath = './test_database.db';
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('✅ Тестовая база данных удалена');
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка очистки:', error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  const results = [];
  
  // Запускаем все тесты
  results.push(await testDatabaseConnection());
  results.push(await testOnboardingModule());
  results.push(await testSchedulerModule());
  results.push(await testDeliveryModule());
  
  // Очищаем тестовые данные
  await cleanupTestData();
  
  // Подводим итоги
  console.log('\n📋 Результаты тестирования:');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  if (successful === total) {
    console.log(`🎉 Все тесты пройдены успешно! (${successful}/${total})`);
    console.log('\n✅ Интеграция модулей работает корректно');
    process.exit(0);
  } else {
    console.log(`❌ Пройдено ${successful} из ${total} тестов`);
    console.log('\n🔧 Необходимо исправить ошибки перед запуском бота');
    process.exit(1);
  }
}

// Запуск тестов
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('\n💥 Критическая ошибка тестирования:', error);
    process.exit(1);
  });
}

module.exports = {
  testDatabaseConnection,
  testOnboardingModule,
  testSchedulerModule,
  testDeliveryModule,
  runAllTests
};