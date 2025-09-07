/**
 * [RU] Интеграционные тесты для улучшенной админской рассылки
 * [EN] Integration tests for enhanced admin broadcast
 */

const path = require('path');
const Database = require('better-sqlite3');
const { AdminAPI } = require('../../features/admin/api');
const { AdminLogic } = require('../../features/admin/logic');
const { runEnhancedDeliveryLogsMigration } = require('../../database/migrate-enhanced-delivery-logs');

// Константы тестирования
const TEST_DB_PATH = path.join(__dirname, '../tmp/test_enhanced_broadcast.db');
const TEST_ADMIN_ID = '123456789';
const TEST_BOT_TOKEN = 'test_token';

// Мок-объекты
const createMockBot = () => ({
  telegram: {
    sendMessage: jest.fn().mockResolvedValue({ message_id: Math.floor(Math.random() * 1000) }),
    getMe: jest.fn().mockResolvedValue({
      id: 12345,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'test_bot'
    })
  }
});

const createMockContext = (userId = TEST_ADMIN_ID, callbackData = null) => ({
  from: { id: parseInt(userId), first_name: 'Test Admin' },
  callbackQuery: callbackData ? { data: callbackData } : null,
  reply: jest.fn().mockResolvedValue({ message_id: 1 }),
  editMessageText: jest.fn().mockResolvedValue({ message_id: 1 }),
  answerCbQuery: jest.fn().mockResolvedValue(true),
  telegram: createMockBot().telegram
});

describe('Enhanced Broadcast Integration Tests', () => {
  let database;
  let adminAPI;
  let adminLogic;
  let mockBot;

  beforeAll(async () => {
    // Создаем временную базу данных для тестов
    try {
      database = new Database(TEST_DB_PATH);
      
      // Инициализируем схему базы данных
      const schemaSQL = `
        -- Базовые таблицы
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id TEXT UNIQUE NOT NULL,
          username TEXT,
          full_name TEXT NOT NULL,
          attendance_status TEXT DEFAULT 'attending' CHECK (attendance_status IN ('attending', 'not_attending', 'maybe')),
          attendance_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_text TEXT NOT NULL,
          message_type TEXT DEFAULT 'test_message',
          sent_by TEXT NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          total_recipients INTEGER DEFAULT 0,
          delivered_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          blocked_count INTEGER DEFAULT 0,
          enhanced_mode BOOLEAN DEFAULT FALSE,
          sequence_completion_rate REAL DEFAULT 0.0,
          eligible_users_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS user_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_text TEXT NOT NULL,
          send_date DATETIME NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS delivery_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message_id INTEGER NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT NOT NULL,
          error_message TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `;
      
      database.exec(schemaSQL);
      
      // Запускаем миграцию для enhanced_delivery_logs
      await runEnhancedDeliveryLogsMigration(TEST_DB_PATH);
      
      console.log('✅ Тестовая база данных инициализирована');
    } catch (error) {
      console.error('❌ Ошибка инициализации тестовой базы данных:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (database) {
      database.close();
    }
  });

  beforeEach(() => {
    // Очищаем таблицы перед каждым тестом
    database.exec('DELETE FROM users');
    database.exec('DELETE FROM admin_messages');
    database.exec('DELETE FROM enhanced_delivery_logs');
    database.exec('DELETE FROM user_responses');
    
    // Создаем экземпляры для тестирования
    adminAPI = new AdminAPI(database);
    adminLogic = new AdminLogic(database);
    mockBot = createMockBot();
    
    // Настраиваем переменные окружения для тестов
    process.env.ADMIN_ID = TEST_ADMIN_ID;
    process.env.ENHANCED_BROADCAST_ENABLED = 'true';
    
    jest.clearAllMocks();
  });

  describe('Полный цикл улучшенной рассылки', () => {
    beforeEach(() => {
      // Создаем тестовых пользователей
      const insertUser = database.prepare(`
        INSERT INTO users (telegram_id, username, full_name, attendance_status) 
        VALUES (?, ?, ?, ?)
      `);
      
      insertUser.run('111111111', 'user1', 'Пользователь Один', 'attending');
      insertUser.run('222222222', 'user2', 'Пользователь Два', 'maybe');
      insertUser.run('333333333', null, 'Пользователь Три', 'attending');
      insertUser.run('444444444', null, null, null); // Неподходящий пользователь
      
      // Добавляем активность для некоторых пользователей
      const insertResponse = database.prepare(`
        INSERT INTO user_responses (user_id, message) VALUES (?, ?)
      `);
      
      insertResponse.run(1, 'Тестовый ответ 1');
      insertResponse.run(2, 'Тестовый ответ 2');
      insertResponse.run(2, 'Тестовый ответ 3');
    });

    it('должен успешно выполнить полную улучшенную рассылку', async () => {
      const result = await adminAPI.sendEnhancedBroadcast(mockBot, TEST_ADMIN_ID, {
        messageText: 'Тестовое улучшенное сообщение',
        config: {
          delays: { betweenMessages: 50, betweenUsers: 10 },
          batching: { maxUsersPerBatch: 2 }
        }
      });

      // Проверяем успешность операции
      expect(result.success).toBe(true);
      expect(result.enhancedStats.total).toBe(4);
      expect(result.enhancedStats.eligibleForEnhanced).toBe(3); // Только пользователи с full_name
      expect(result.enhancedStats.standardDelivered).toBe(3);
      expect(result.config.enhanced).toBe(true);

      // Проверяем логирование в admin_messages
      const adminMessage = database.prepare(`
        SELECT * FROM admin_messages 
        WHERE sent_by = ? AND enhanced_mode = 1
        ORDER BY sent_at DESC LIMIT 1
      `).get(TEST_ADMIN_ID);
      
      expect(adminMessage).toBeTruthy();
      expect(adminMessage.message_type).toBe('enhanced_broadcast');
      expect(adminMessage.eligible_users_count).toBe(3);
      expect(adminMessage.enhanced_mode).toBe(1);

      // Проверяем логирование последовательностей в enhanced_delivery_logs
      const deliveryLogs = database.prepare(`
        SELECT * FROM enhanced_delivery_logs 
        WHERE admin_message_id = ?
        ORDER BY user_id, sequence_step
      `).all(result.messageId);
      
      expect(deliveryLogs.length).toBeGreaterThan(0);
      
      // Проверяем, что логируются все шаги для каждого пользователя
      const steps = ['admin_message', 'useful_info', 'event_details', 'menu_trigger'];
      const userLogs = deliveryLogs.filter(log => log.user_id === 1);
      
      expect(userLogs.length).toBe(4);
      steps.forEach(step => {
        expect(userLogs.find(log => log.sequence_step === step)).toBeTruthy();
      });
    });

    it('должен корректно обрабатывать частичные сбои', async () => {
      // Мокаем сбой для одного из шагов последовательности
      const originalEventInfoAPI = adminAPI.messageSequenceProcessor.eventInfoAPI;
      adminAPI.messageSequenceProcessor.eventInfoAPI.getUsefulInfo = jest.fn()
        .mockResolvedValueOnce({ success: false, error: 'Тестовая ошибка' })
        .mockResolvedValue({ success: true, info: ['Полезная информация'] });

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, TEST_ADMIN_ID, {
        messageText: 'Тестовое сообщение с частичными сбоями'
      });

      expect(result.success).toBe(true);
      expect(result.enhancedStats.sequenceFailures).toBeGreaterThan(0);

      // Проверяем логирование ошибок
      const failedLogs = database.prepare(`
        SELECT * FROM enhanced_delivery_logs 
        WHERE admin_message_id = ? AND delivery_status = 'failed'
      `).all(result.messageId);
      
      expect(failedLogs.length).toBeGreaterThan(0);
      expect(failedLogs[0].error_message).toContain('Тестовая ошибка');

      // Восстанавливаем оригинальный объект
      adminAPI.messageSequenceProcessor.eventInfoAPI = originalEventInfoAPI;
    });
  });

  describe('Интеграция AdminLogic с улучшенной рассылкой', () => {
    it('должен предложить выбор режима рассылки администратору', async () => {
      const ctx = createMockContext(TEST_ADMIN_ID);
      
      const result = await adminLogic.showMessageSendingPanel(ctx, mockBot);
      
      expect(result.success).toBe(true);
      expect(result.enhancedAvailable).toBe(true);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Выберите режим рассылки'),
        expect.objectContaining({
          parse_mode: 'HTML'
        })
      );
    });

    it('должен обрабатывать подтверждение улучшенной рассылки', async () => {
      // Создаем тестовых пользователей
      const insertUser = database.prepare(`
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `);
      insertUser.run('555555555', 'Тестовый Пользователь', 'attending');

      const ctx = createMockContext(TEST_ADMIN_ID, 'admin_confirm_enhanced');
      
      const result = await adminLogic.confirmEnhancedBroadcast(ctx, mockBot);
      
      expect(result.success).toBe(true);
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Начинаем улучшенную рассылку'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('должен обрабатывать подтверждение стандартной рассылки', async () => {
      const ctx = createMockContext(TEST_ADMIN_ID, 'admin_confirm_standard');
      
      const result = await adminLogic.confirmStandardBroadcast(ctx, mockBot);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Фильтрация и валидация пользователей', () => {
    beforeEach(() => {
      // Создаем пользователей с разной степенью полноты данных
      const insertUser = database.prepare(`
        INSERT INTO users (telegram_id, username, full_name, attendance_status) 
        VALUES (?, ?, ?, ?)
      `);
      
      insertUser.run('111', 'complete_user', 'Полный Пользователь', 'attending');
      insertUser.run('222', 'partial_user', 'Частичный Пользователь', 'maybe');
      insertUser.run('333', null, null, 'not_attending'); // Неполные данные
      insertUser.run('444', 'no_name_user', null, 'attending'); // Нет имени
    });

    it('должен корректно фильтровать подходящих пользователей', () => {
      const result = adminAPI.userDataValidator.getEligibleUsersForEnhancedBroadcast();
      
      expect(result.success).toBe(true);
      expect(result.users.length).toBe(2); // Только пользователи с full_name и attendance_status
      expect(result.stats.eligibilityRate).toBeCloseTo(50, 1);
      
      const eligibleIds = result.users.map(user => user.telegram_id);
      expect(eligibleIds).toContain('111');
      expect(eligibleIds).toContain('222');
      expect(eligibleIds).not.toContain('333');
      expect(eligibleIds).not.toContain('444');
    });

    it('должен предоставлять детальную статистику подходящих пользователей', () => {
      const result = adminAPI.userDataValidator.getEligibilityStatistics();
      
      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(4);
      expect(result.stats.eligible).toBe(2);
      expect(result.stats.eligibilityRate).toBe(50);
      expect(result.stats.attendanceBreakdown.attending).toBe(1);
      expect(result.stats.attendanceBreakdown.maybe).toBe(1);
    });
  });

  describe('Обработка ошибок и восстановление', () => {
    it('должен обрабатывать сбои валидации бота', async () => {
      // Мокаем сбой валидации бота
      adminAPI.messageDeliveryAPI.validateBotToken = jest.fn().mockResolvedValue({
        success: false,
        error: 'Недействительный токен бота'
      });

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, TEST_ADMIN_ID);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Недействительный токен бота');
    });

    it('должен обрабатывать отсутствие подходящих пользователей', async () => {
      // База данных пуста, нет подходящих пользователей
      const result = await adminAPI.sendEnhancedBroadcast(mockBot, TEST_ADMIN_ID);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('подходящих пользователей');
      expect(result.enhancedStats.eligibleForEnhanced).toBe(0);
    });

    it('должен продолжать работу при сбоях отдельных последовательностей', async () => {
      // Создаем пользователей
      const insertUser = database.prepare(`
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `);
      insertUser.run('111', 'Пользователь 1', 'attending');
      insertUser.run('222', 'Пользователь 2', 'attending');

      // Мокаем частичный сбой последовательности
      let callCount = 0;
      adminAPI.messageSequenceProcessor.processUserMessageSequence = jest.fn()
        .mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              success: false,
              error: 'Тестовая ошибка для первого пользователя'
            });
          }
          return Promise.resolve({
            success: true,
            results: {
              completedSteps: 4,
              totalSteps: 4,
              steps: {
                adminMessage: { success: true },
                usefulInfo: { success: true },
                eventDetails: { success: true },
                menuTrigger: { success: true }
              }
            }
          });
        });

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, TEST_ADMIN_ID);
      
      expect(result.success).toBe(true);
      expect(result.enhancedStats.sequenceFailures).toBe(1);
      expect(result.enhancedStats.enhancedSequenceCompleted).toBe(1);
    });
  });

  describe('Производительность и масштабирование', () => {
    it('должен обрабатывать большое количество пользователей пакетами', async () => {
      // Создаем много пользователей
      const insertUser = database.prepare(`
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `);
      
      for (let i = 1; i <= 15; i++) {
        insertUser.run(`user_${i}`, `Пользователь ${i}`, 'attending');
      }

      const startTime = Date.now();
      
      const result = await adminAPI.sendEnhancedBroadcast(mockBot, TEST_ADMIN_ID, {
        config: {
          batching: { maxUsersPerBatch: 5 },
          delays: { betweenMessages: 10, betweenUsers: 5 }
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.enhancedStats.eligibleForEnhanced).toBe(15);
      expect(duration).toBeLessThan(10000); // Должно завершиться менее чем за 10 секунд
      
      // Проверяем, что все пользователи обработаны
      const deliveryLogs = database.prepare(`
        SELECT DISTINCT user_id FROM enhanced_delivery_logs 
        WHERE admin_message_id = ?
      `).all(result.messageId);
      
      expect(deliveryLogs.length).toBe(15);
    });
  });
});

module.exports = {
  TEST_DB_PATH,
  createMockBot,
  createMockContext
};