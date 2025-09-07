/**
 * [RU] Утилита для диагностики системы доставки админских сообщений
 * [EN] Diagnostic utility for admin message delivery system
 */

const { DatabaseConnection } = require('../../database/connection');
const { AdminAPI } = require('../../features/admin/api');
const { MessageDeliveryAPI } = require('../../features/message-delivery/api');

class AdminMessageDiagnostic {
  constructor() {
    this.database = null;
    this.adminAPI = null;
    this.messageDeliveryAPI = null;
  }

  async initialize() {
    try {
      this.database = new DatabaseConnection(':memory:');
      this.database.connect();
      this.adminAPI = new AdminAPI(this.database.getDatabase());
      this.messageDeliveryAPI = new MessageDeliveryAPI(this.database.getDatabase());
      
      console.log('✅ Диагностический инструмент инициализирован');
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверка подключения к базе данных
   */
  async checkDatabase() {
    try {
      console.log('\n🔍 Проверка базы данных...');
      
      // Проверяем наличие таблиц
      const tables = ['users', 'admin_messages', 'delivery_logs', 'scheduled_messages'];
      const results = {};
      
      for (const table of tables) {
        try {
          const count = this.database.getDatabase().prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          results[table] = count.count;
          console.log(`  📊 ${table}: ${count.count} записей`);
        } catch (error) {
          results[table] = `Ошибка: ${error.message}`;
          console.log(`  ❌ ${table}: Ошибка - ${error.message}`);
        }
      }
      
      return { success: true, results };
    } catch (error) {
      console.error('❌ Ошибка проверки базы данных:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверка токена бота (без реального бота)
   */
  async checkBotTokenValidation() {
    try {
      console.log('\n🔍 Проверка валидации токена бота...');
      
      // Создаем мок бота для тестирования
      const mockBot = {
        telegram: {
          getMe: () => Promise.resolve({
            id: 123456789,
            username: 'test_diagnostic_bot',
            first_name: 'Test Bot'
          })
        }
      };

      const result = await this.messageDeliveryAPI.validateBotToken(mockBot);
      
      if (result.success) {
        console.log(`  ✅ Валидация работает корректно`);
        console.log(`  📋 Информация о боте: ${result.bot.first_name} (@${result.bot.username})`);
      } else {
        console.log(`  ❌ Ошибка валидации: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка проверки валидации:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Тестирование функций категоризации ошибок
   */
  testErrorCategorization() {
    try {
      console.log('\n🔍 Тестирование категоризации ошибок...');
      
      const testCases = [
        { 
          error: new Error('Forbidden: bot was blocked by the user'),
          expected: 'blocked',
          description: 'Бот заблокирован пользователем'
        },
        {
          error: new Error('Bad Request: chat not found'),
          expected: 'failed', 
          description: 'Чат не найден'
        },
        {
          error: Object.assign(new Error('Too Many Requests: retry after 5'), { code: 429 }),
          expected: 'rate_limited',
          description: 'Превышение лимита запросов'
        },
        {
          error: Object.assign(new Error('Bad Request: message text is empty'), { code: 400 }),
          expected: 'failed',
          description: 'Неверный запрос'
        },
        {
          error: new Error('Network error'),
          expected: 'failed',
          description: 'Сетевая ошибка'
        }
      ];

      let passed = 0;
      let failed = 0;

      for (const testCase of testCases) {
        const result = this.messageDeliveryAPI.categorizeError(testCase.error);
        
        if (result === testCase.expected) {
          console.log(`  ✅ ${testCase.description}: ${result}`);
          passed++;
        } else {
          console.log(`  ❌ ${testCase.description}: ожидалось '${testCase.expected}', получено '${result}'`);
          failed++;
        }
      }

      console.log(`  📊 Результат: ${passed} успешно, ${failed} неудачно`);
      
      return { success: failed === 0, passed, failed };
    } catch (error) {
      console.error('❌ Ошибка тестирования категоризации:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверка определения админских сообщений
   */
  testAdminMessageDetection() {
    try {
      console.log('\n🔍 Тестирование определения админских сообщений...');
      
      const testCases = [
        { messageId: 'admin_test_123', expected: true, description: 'Тестовое админское сообщение' },
        { messageId: 'admin_diagnostic', expected: true, description: 'Диагностическое сообщение' },
        { messageId: 'admin_broadcast_456', expected: true, description: 'Админская рассылка' },
        { messageId: 'regular_message_789', expected: false, description: 'Обычное сообщение' },
        { messageId: '123', expected: false, description: 'Числовой ID' },
        { messageId: null, expected: false, description: 'null' },
        { messageId: undefined, expected: false, description: 'undefined' }
      ];

      let passed = 0;
      let failed = 0;

      for (const testCase of testCases) {
        const result = this.messageDeliveryAPI.isAdminMessage(testCase.messageId);
        
        if (result === testCase.expected) {
          console.log(`  ✅ ${testCase.description} (${testCase.messageId}): ${result}`);
          passed++;
        } else {
          console.log(`  ❌ ${testCase.description} (${testCase.messageId}): ожидалось ${testCase.expected}, получено ${result}`);
          failed++;
        }
      }

      console.log(`  📊 Результат: ${passed} успешно, ${failed} неудачно`);
      
      return { success: failed === 0, passed, failed };
    } catch (error) {
      console.error('❌ Ошибка тестирования определения админских сообщений:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверка истории админских сообщений
   */
  async checkAdminMessageHistory() {
    try {
      console.log('\n🔍 Проверка истории админских сообщений...');
      
      const history = await this.adminAPI.getTestMessageHistory(10);
      
      if (history.success) {
        console.log(`  📊 Найдено ${history.count} записей в истории`);
        
        if (history.count > 0) {
          console.log('  📋 Последние сообщения:');
          history.history.slice(0, 3).forEach((message, index) => {
            console.log(`    ${index + 1}. ${message.sentAt}: ${message.deliveryStats.delivered}/${message.deliveryStats.total} доставлено`);
          });
        } else {
          console.log('  ℹ️ История пуста - ещё не было отправок');
        }
      } else {
        console.log(`  ❌ Ошибка получения истории: ${history.error}`);
      }
      
      return history;
    } catch (error) {
      console.error('❌ Ошибка проверки истории:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Имитация отправки тестового сообщения (без реального бота)
   */
  async simulateTestMessageSending() {
    try {
      console.log('\n🔍 Симуляция отправки тестового сообщения...');
      
      // Создаем мок бота
      const mockBot = {
        telegram: {
          getMe: () => Promise.resolve({
            id: 123456789,
            username: 'test_diagnostic_bot',
            first_name: 'Test Bot'
          }),
          sendMessage: () => Promise.resolve({ message_id: 123 })
        }
      };

      // Проверяем количество пользователей
      const usersResult = await this.messageDeliveryAPI.getActiveUsers();
      
      if (!usersResult.success) {
        throw new Error(`Ошибка получения пользователей: ${usersResult.error}`);
      }

      const userCount = usersResult.users.length;
      console.log(`  📊 Пользователей в системе: ${userCount}`);
      
      if (userCount === 0) {
        console.log('  ⚠️ Нет пользователей для отправки. Создать тестовых пользователей? (Только для диагностики)');
        return { success: true, message: 'Нет пользователей для тестирования' };
      }

      console.log('  ✅ Симуляция прошла успешно - система готова к отправке сообщений');
      console.log(`  📋 Будет отправлено ${userCount} сообщений`);
      
      return { 
        success: true, 
        userCount,
        message: 'Система готова к работе'
      };
    } catch (error) {
      console.error('❌ Ошибка симуляции:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Полная диагностика системы
   */
  async runFullDiagnostic() {
    console.log('🔧 Запуск полной диагностики системы доставки админских сообщений');
    console.log('=' .repeat(70));
    
    const results = {};
    
    // Инициализация
    results.initialization = await this.initialize();
    if (!results.initialization.success) {
      return results;
    }

    // Проверка базы данных
    results.database = await this.checkDatabase();
    
    // Проверка валидации бота
    results.botValidation = await this.checkBotTokenValidation();
    
    // Тестирование категоризации ошибок
    results.errorCategorization = this.testErrorCategorization();
    
    // Тестирование определения админских сообщений  
    results.adminMessageDetection = this.testAdminMessageDetection();
    
    // Проверка истории сообщений
    results.messageHistory = await this.checkAdminMessageHistory();
    
    // Симуляция отправки
    results.messageSimulation = await this.simulateTestMessageSending();

    // Итоговый отчет
    console.log('\n📋 ИТОГОВЫЙ ОТЧЕТ ДИАГНОСТИКИ');
    console.log('=' .repeat(50));
    
    let allPassed = true;
    const checks = [
      { name: 'Инициализация', result: results.initialization.success },
      { name: 'База данных', result: results.database.success },
      { name: 'Валидация бота', result: results.botValidation.success },
      { name: 'Категоризация ошибок', result: results.errorCategorization.success },
      { name: 'Определение админских сообщений', result: results.adminMessageDetection.success },
      { name: 'История сообщений', result: results.messageHistory.success },
      { name: 'Симуляция отправки', result: results.messageSimulation.success }
    ];

    checks.forEach(check => {
      const status = check.result ? '✅ ПРОЙДЕН' : '❌ НЕ ПРОЙДЕН';
      console.log(`${check.name}: ${status}`);
      if (!check.result) allPassed = false;
    });

    console.log('\n' + '=' .repeat(50));
    
    if (allPassed) {
      console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Система готова к работе.');
    } else {
      console.log('⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ! Требуется дополнительная настройка.');
    }

    return results;
  }

  /**
   * Закрытие соединения с базой данных
   */
  async cleanup() {
    if (this.database) {
      this.database.close();
      console.log('🔒 Соединение с базой данных закрыто');
    }
  }
}

// Экспорт для использования в других модулях
module.exports = { AdminMessageDiagnostic };

// Запуск диагностики если файл выполняется напрямую
if (require.main === module) {
  (async () => {
    const diagnostic = new AdminMessageDiagnostic();
    
    try {
      await diagnostic.runFullDiagnostic();
    } catch (error) {
      console.error('💥 Критическая ошибка диагностики:', error.message);
    } finally {
      await diagnostic.cleanup();
    }
  })();
}