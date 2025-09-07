#!/usr/bin/env node

/**
 * [RU] Скрипт тестирования инициализации бота без подключения к Telegram
 * [EN] Bot initialization test script without Telegram connection
 */

const { getDatabaseConnection } = require('../../database/connection');
const { ReminderSchedulerLogic } = require('../../features/reminder-scheduler/logic');
const { MessageDeliveryLogic } = require('../../features/message-delivery/logic');

async function testBotInitialization() {
  console.log('🧪 Тестирование инициализации компонентов бота...');
  
  try {
    // Инициализируем базу данных
    console.log('\n📊 Инициализация базы данных...');
    const database = getDatabaseConnection('../../bot_database.db');
    await database.connect();
    console.log('✅ База данных подключена');

    // Инициализируем планировщик напоминаний (без бота)
    console.log('\n⏰ Инициализация планировщика напоминаний...');
    const scheduler = new ReminderSchedulerLogic(database.getDatabase(), null);
    console.log('✅ Планировщик напоминаний инициализирован');

    // Инициализируем систему доставки сообщений
    console.log('\n📨 Инициализация системы доставки сообщений...');
    const delivery = new MessageDeliveryLogic(database.getDatabase());
    console.log('✅ Система доставки сообщений инициализирована');

    // Тестируем создание события
    console.log('\n📅 Тестирование создания события...');
    const eventResult = await scheduler.createEvent(
      'Тестовое событие',
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Завтра
      {
        dayBefore: true,
        hourBefore: true
      }
    );
    
    if (eventResult.success) {
      console.log(`✅ Событие создано: ${eventResult.reminders?.length} напоминаний`);
    } else {
      console.error(`❌ Ошибка создания события: ${eventResult.error}`);
    }

    // Тестируем получение готовых напоминаний
    console.log('\n🔍 Тестирование получения готовых напоминаний...');
    const dueResult = await scheduler.api.getDueReminders();
    
    if (dueResult.success) {
      console.log(`✅ Найдено ${dueResult.reminders.length} готовых напоминаний`);
    } else {
      console.error(`❌ Ошибка получения напоминаний: ${dueResult.error}`);
    }

    database.close();
    console.log('\n🎉 Все компоненты инициализированы успешно!');
    console.log('💡 База данных исправлена и готова к работе.');
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Запускаем если вызвано напрямую
if (require.main === module) {
  testBotInitialization().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testBotInitialization };