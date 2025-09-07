#!/usr/bin/env node

/**
 * [RU] Скрипт валидации улучшенной админской рассылки
 * [EN] Enhanced admin broadcast validation script
 */

const path = require('path');
const Database = require('better-sqlite3');
const { AdminAPI } = require('./features/admin/api');
const { AdminLogic } = require('./features/admin/logic');
const { MessageSequenceProcessor } = require('./utils/message-sequence-processor');
const { UserDataValidator } = require('./utils/user-data-validator');
const { isEnhancedBroadcastEnabled, printConfig, validateConfig } = require('./config/enhanced-admin');
const { checkMigrationStatus } = require('./database/migrate-enhanced-delivery-logs');

// Цвета для консольного вывода
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.cyan}🔧 ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.magenta}📋 ${msg}${colors.reset}`)
};

/**
 * [RU] Создает мок-объект бота для тестирования
 * [EN] Creates a mock bot object for testing
 */
function createMockBot() {
  return {
    telegram: {
      sendMessage: async (chatId, text, options) => {
        console.log(`  📤 Mock отправка сообщения в ${chatId}: ${text.substring(0, 50)}...`);
        return Promise.resolve({ message_id: Math.floor(Math.random() * 1000) });
      },
      getMe: async () => {
        return Promise.resolve({
          id: 12345,
          is_bot: true,
          first_name: 'Test Bot',
          username: 'validation_bot'
        });
      }
    }
  };
}

/**
 * [RU] Проверяет состояние базы данных
 * [EN] Checks database status
 */
async function validateDatabase() {
  log.step('Проверка состояния базы данных...');
  
  const dbPath = process.env.DATABASE_PATH || './database/bot_database.db';
  
  try {
    // Проверяем существование файла базы данных
    const db = new Database(dbPath);
    
    // Проверяем основные таблицы
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('users', 'admin_messages')
    `).all();
    
    if (tables.length < 2) {
      log.error('Основные таблицы не найдены. Выполните инициализацию базы данных.');
      return false;
    }
    
    log.success('Основные таблицы найдены');
    
    // Проверяем миграцию enhanced_delivery_logs
    const migrationStatus = checkMigrationStatus(dbPath);
    
    if (!migrationStatus.migrated) {
      log.error(`Миграция enhanced_delivery_logs не выполнена: ${migrationStatus.reason}`);
      return false;
    }
    
    log.success(`Миграция enhanced_delivery_logs выполнена (столбцов: ${migrationStatus.tableColumns}, индексов: ${migrationStatus.indexCount})`);
    
    // Проверяем новые поля в admin_messages
    const adminTableInfo = db.prepare('PRAGMA table_info(admin_messages)').all();
    const hasEnhancedFields = adminTableInfo.some(col => col.name === 'enhanced_mode');
    
    if (!hasEnhancedFields) {
      log.error('Поля для улучшенной рассылки не найдены в таблице admin_messages');
      return false;
    }
    
    log.success('Поля для улучшенной рассылки найдены в admin_messages');
    
    db.close();
    return true;
  } catch (error) {
    log.error(`Ошибка проверки базы данных: ${error.message}`);
    return false;
  }
}

/**
 * [RU] Проверяет конфигурацию
 * [EN] Validates configuration
 */
function validateConfiguration() {
  log.step('Проверка конфигурации...');
  
  // Проверяем доступность улучшенной рассылки
  const enhancedEnabled = isEnhancedBroadcastEnabled();
  
  if (!enhancedEnabled) {
    log.warning('Улучшенная рассылка отключена. Проверьте ENHANCED_BROADCAST_ENABLED в .env');
    return false;
  }
  
  log.success('Улучшенная рассылка включена');
  
  // Проверяем валидность конфигурации
  const configValidation = validateConfig();
  
  if (!configValidation.valid) {
    log.error('Найдены проблемы с конфигурацией:');
    configValidation.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
    return false;
  }
  
  log.success('Конфигурация валидна');
  
  // Выводим текущую конфигурацию
  console.log('\n📊 Текущая конфигурация:');
  printConfig();
  
  return true;
}

/**
 * [RU] Создает тестовых пользователей
 * [EN] Creates test users
 */
function createTestUsers(database) {
  log.step('Создание тестовых пользователей...');
  
  try {
    // Очищаем существующих тестовых пользователей
    database.exec("DELETE FROM users WHERE telegram_id LIKE 'test_%'");
    
    const insertUser = database.prepare(`
      INSERT INTO users (telegram_id, username, full_name, attendance_status) 
      VALUES (?, ?, ?, ?)
    `);
    
    const testUsers = [
      ['test_111', 'test_user_1', 'Тестовый Пользователь 1', 'attending'],
      ['test_222', 'test_user_2', 'Тестовый Пользователь 2', 'maybe'],
      ['test_333', null, 'Тестовый Пользователь 3', 'attending']
    ];
    
    testUsers.forEach(userData => {
      insertUser.run(...userData);
    });
    
    log.success(`Создано ${testUsers.length} тестовых пользователей`);
    return true;
  } catch (error) {
    log.error(`Ошибка создания тестовых пользователей: ${error.message}`);
    return false;
  }
}

/**
 * [RU] Тестирует валидацию пользователей
 * [EN] Tests user validation
 */
function testUserValidation(database) {
  log.step('Тестирование валидации пользователей...');
  
  try {
    const validator = new UserDataValidator(database);
    
    // Получаем подходящих пользователей
    const eligibleResult = validator.getEligibleUsersForEnhancedBroadcast();
    
    if (!eligibleResult.success) {
      log.error(`Ошибка получения подходящих пользователей: ${eligibleResult.error}`);
      return false;
    }
    
    log.success(`Найдено ${eligibleResult.eligibleCount} подходящих пользователей из ${eligibleResult.totalCount} общих`);
    
    // Проверяем статистику
    const statsResult = validator.getEligibilityStatistics();
    
    if (statsResult.success) {
      log.info(`Процент подходящих пользователей: ${statsResult.stats.eligibilityRate.toFixed(1)}%`);
      log.info(`Активных пользователей: ${statsResult.stats.activeUsers}`);
    }
    
    // Тестируем индивидуальную валидацию
    const testUserId = 'test_111';
    const userValidation = validator.hasUserData(testUserId);
    
    if (userValidation.hasData) {
      log.success(`Пользователь ${testUserId} прошел валидацию: ${userValidation.reason}`);
    } else {
      log.warning(`Пользователь ${testUserId} не прошел валидацию: ${userValidation.reason}`);
    }
    
    return true;
  } catch (error) {
    log.error(`Ошибка тестирования валидации пользователей: ${error.message}`);
    return false;
  }
}

/**
 * [RU] Тестирует обработку последовательности сообщений
 * [EN] Tests message sequence processing
 */
async function testMessageSequenceProcessor(database) {
  log.step('Тестирование обработки последовательности сообщений...');
  
  try {
    const processor = new MessageSequenceProcessor(database);
    const mockBot = createMockBot();
    
    console.log('\n📤 Тестирование последовательности для пользователя test_111:');
    
    const result = await processor.processUserMessageSequence(
      mockBot,
      'test_111',
      'Тестовое сообщение для валидации',
      {
        includeUsefulInfo: true,
        includeEventDetails: true,
        triggerMenu: true,
        sequenceDelay: 100 // Быстрая последовательность для тестов
      }
    );
    
    if (result.success) {
      log.success(`Последовательность выполнена: ${result.results.completedSteps}/${result.results.totalSteps} шагов (${result.completionRate.toFixed(1)}%)`);
      
      // Проверяем отдельные шаги
      Object.entries(result.results.steps).forEach(([step, data]) => {
        const status = data.success ? '✅' : '❌';
        console.log(`  ${status} ${step}: ${data.success ? 'успешно' : 'ошибка'}`);
      });
      
      if (result.results.errors.length > 0) {
        log.warning(`Ошибки в последовательности: ${result.results.errors.length}`);
        result.results.errors.forEach(error => {
          console.log(`    - ${error.step}: ${error.error}`);
        });
      }
    } else {
      log.error(`Последовательность не выполнена: ${result.criticalError}`);
      return false;
    }
    
    return true;
  } catch (error) {
    log.error(`Ошибка тестирования последовательности сообщений: ${error.message}`);
    return false;
  }
}

/**
 * [RU] Тестирует полную улучшенную рассылку
 * [EN] Tests full enhanced broadcast
 */
async function testEnhancedBroadcast(database) {
  log.step('Тестирование полной улучшенной рассылки...');
  
  try {
    const adminAPI = new AdminAPI(database);
    const mockBot = createMockBot();
    
    console.log('\n🚀 Запуск тестовой улучшенной рассылки:');
    
    const result = await adminAPI.sendEnhancedBroadcast(mockBot, 'test_admin_123', {
      messageText: 'Тестовое сообщение улучшенной рассылки',
      config: {
        delays: {
          betweenMessages: 50,
          betweenUsers: 20
        },
        batching: {
          maxUsersPerBatch: 3
        }
      }
    });
    
    if (result.success) {
      log.success('Улучшенная рассылка выполнена успешно!');
      
      console.log('\n📊 Статистика выполнения:');
      console.log(`  👥 Всего пользователей: ${result.enhancedStats.total}`);
      console.log(`  ✅ Подходящих для улучшенной рассылки: ${result.enhancedStats.eligibleForEnhanced}`);
      console.log(`  📨 Основных сообщений доставлено: ${result.enhancedStats.standardDelivered}`);
      console.log(`  🎯 Полных последовательностей завершено: ${result.enhancedStats.enhancedSequenceCompleted}`);
      console.log(`  💡 Полезной информации доставлено: ${result.enhancedStats.usefulInfoDelivered}`);
      console.log(`  📅 Деталей события доставлено: ${result.enhancedStats.eventDetailsDelivered}`);
      console.log(`  🔄 Меню активировано: ${result.enhancedStats.menuTriggered}`);
      console.log(`  ❌ Ошибок последовательности: ${result.enhancedStats.sequenceFailures}`);
      console.log(`  📈 Процент завершенности: ${result.enhancedStats.completionRate.toFixed(1)}%`);
      console.log(`  ⏱️ Время выполнения: ${result.duration}`);
      
      // Проверяем логирование в базе данных
      const adminMessage = database.prepare(`
        SELECT * FROM admin_messages 
        WHERE message_type = 'enhanced_broadcast' 
        ORDER BY sent_at DESC LIMIT 1
      `).get();
      
      if (adminMessage && adminMessage.enhanced_mode) {
        log.success('Сообщение корректно залогировано в admin_messages');
      } else {
        log.warning('Проблема с логированием в admin_messages');
      }
      
      // Проверяем детальное логирование
      const deliveryLogs = database.prepare(`
        SELECT COUNT(*) as log_count 
        FROM enhanced_delivery_logs 
        WHERE admin_message_id = ?
      `).get(result.messageId);
      
      if (deliveryLogs && deliveryLogs.log_count > 0) {
        log.success(`Детальное логирование работает: ${deliveryLogs.log_count} записей`);
      } else {
        log.warning('Проблема с детальным логированием');
      }
      
    } else {
      log.error(`Улучшенная рассылка не выполнена: ${result.error}`);
      return false;
    }
    
    return true;
  } catch (error) {
    log.error(`Ошибка тестирования улучшенной рассылки: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * [RU] Очищает тестовые данные
 * [EN] Cleans up test data
 */
function cleanupTestData(database) {
  log.step('Очистка тестовых данных...');
  
  try {
    // Удаляем тестовых пользователей
    database.exec("DELETE FROM users WHERE telegram_id LIKE 'test_%'");
    
    // Удаляем тестовые админские сообщения
    database.exec("DELETE FROM admin_messages WHERE sent_by LIKE 'test_%'");
    
    // Удаляем тестовые логи доставки
    database.exec("DELETE FROM enhanced_delivery_logs WHERE admin_message_id LIKE '%test_%'");
    
    log.success('Тестовые данные очищены');
    return true;
  } catch (error) {
    log.error(`Ошибка очистки тестовых данных: ${error.message}`);
    return false;
  }
}

/**
 * [RU] Главная функция валидации
 * [EN] Main validation function
 */
async function main() {
  log.header('🔍 ВАЛИДАЦИЯ УЛУЧШЕННОЙ АДМИНСКОЙ РАССЫЛКИ');
  console.log();
  
  let database;
  let allTestsPassed = true;
  
  try {
    // 1. Проверка базы данных
    if (!await validateDatabase()) {
      allTestsPassed = false;
    }
    
    // 2. Проверка конфигурации
    if (!validateConfiguration()) {
      allTestsPassed = false;
    }
    
    // Если основные проверки провалены, останавливаемся
    if (!allTestsPassed) {
      log.error('Основные проверки не пройдены. Исправьте ошибки и запустите снова.');
      process.exit(1);
    }
    
    // Подключаемся к базе данных для функциональных тестов
    const dbPath = process.env.DATABASE_PATH || './database/bot_database.db';
    database = new Database(dbPath);
    
    // 3. Создание тестовых пользователей
    if (!createTestUsers(database)) {
      allTestsPassed = false;
    }
    
    // 4. Тестирование валидации пользователей
    if (!testUserValidation(database)) {
      allTestsPassed = false;
    }
    
    // 5. Тестирование обработки последовательности сообщений
    if (!await testMessageSequenceProcessor(database)) {
      allTestsPassed = false;
    }
    
    // 6. Тестирование полной улучшенной рассылки
    if (!await testEnhancedBroadcast(database)) {
      allTestsPassed = false;
    }
    
    // 7. Очистка тестовых данных
    cleanupTestData(database);
    
  } catch (error) {
    log.error(`Критическая ошибка валидации: ${error.message}`);
    console.error(error.stack);
    allTestsPassed = false;
  } finally {
    if (database) {
      database.close();
    }
  }
  
  console.log();
  log.header('🏁 РЕЗУЛЬТАТЫ ВАЛИДАЦИИ');
  
  if (allTestsPassed) {
    log.success('ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Улучшенная админская рассылка готова к использованию.');
    console.log(`
${colors.green}${colors.bold}╔══════════════════════════════════════════════════════════════╗
║                     ✨ ВАЛИДАЦИЯ УСПЕШНА! ✨                 ║
║                                                              ║
║  Система улучшенной админской рассылки полностью настроена   ║
║  и готова к использованию в производственной среде.          ║
║                                                              ║
║  Основные возможности:                                       ║
║  • Автоматическая последовательность сообщений              ║
║  • Фильтрация подходящих пользователей                      ║
║  • Детальное логирование и мониторинг                       ║
║  • Обработка ошибок и восстановление                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
    `);
    process.exit(0);
  } else {
    log.error('НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Проверьте ошибки выше и исправьте их.');
    console.log(`
${colors.red}${colors.bold}╔══════════════════════════════════════════════════════════════╗
║                     ❌ ВАЛИДАЦИЯ ПРОВАЛЕНА ❌                ║
║                                                              ║
║  Обнаружены проблемы в настройке улучшенной админской       ║
║  рассылки. Пожалуйста, исправьте ошибки выше и запустите    ║
║  валидацию снова.                                            ║
║                                                              ║
║  Команда для повторного запуска:                             ║
║  node validate-enhanced-broadcast.js                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
    `);
    process.exit(1);
  }
}

// Запускаем валидацию при прямом запуске скрипта
if (require.main === module) {
  main().catch(error => {
    log.error(`Необработанная ошибка: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  main,
  validateDatabase,
  validateConfiguration,
  testUserValidation,
  testMessageSequenceProcessor,
  testEnhancedBroadcast
};