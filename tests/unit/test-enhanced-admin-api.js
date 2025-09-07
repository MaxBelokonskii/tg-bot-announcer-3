/**
 * [RU] Юнит-тесты для Enhanced AdminAPI
 * [EN] Unit tests for Enhanced AdminAPI
 */

const { AdminAPI } = require('../../features/admin/api');

// Мок-объекты
const mockDatabase = {
  prepare: jest.fn(),
  exec: jest.fn()
};

const mockBot = {
  telegram: {
    sendMessage: jest.fn(),
    getMe: jest.fn()
  }
};

describe('Enhanced AdminAPI', () => {
  let adminAPI;

  beforeEach(() => {
    adminAPI = new AdminAPI(mockDatabase);
    
    // Мокаем методы
    adminAPI.executeQuery = jest.fn();
    adminAPI.getOne = jest.fn();
    adminAPI.getMany = jest.fn();
    
    // Мокаем внешние зависимости
    adminAPI.messageDeliveryAPI.validateBotToken = jest.fn();
    adminAPI.messageDeliveryAPI.broadcastMessage = jest.fn();
    adminAPI.userDataValidator.getEligibleUsersForEnhancedBroadcast = jest.fn();
    adminAPI.messageSequenceProcessor.processUserMessageSequence = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('sendEnhancedBroadcast', () => {
    it('должен успешно выполнить улучшенную рассылку', async () => {
      // Настраиваем моки для успешного выполнения
      adminAPI.messageDeliveryAPI.validateBotToken.mockResolvedValue({
        success: true,
        bot: { username: 'test_bot', first_name: 'Test Bot' }
      });

      adminAPI.userDataValidator.getEligibleUsersForEnhancedBroadcast.mockReturnValue({
        success: true,
        users: [
          { telegram_id: '111', full_name: 'Пользователь 1' },
          { telegram_id: '222', full_name: 'Пользователь 2' }
        ],
        totalCount: 10,
        eligibleCount: 2
      });

      adminAPI.messageDeliveryAPI.broadcastMessage.mockResolvedValue({
        success: true,
        results: {
          delivered: 2,
          failed: 0,
          blocked: 0,
          successful: ['111', '222']
        }
      });

      adminAPI.messageSequenceProcessor.processUserMessageSequence.mockResolvedValue({
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
        },
        completionRate: 100
      });

      adminAPI.logEnhancedDeliverySequence = jest.fn().mockResolvedValue();

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, '123456789', {
        messageText: 'Тестовое сообщение'
      });

      expect(result.success).toBe(true);
      expect(result.enhancedStats.total).toBe(10);
      expect(result.enhancedStats.eligibleForEnhanced).toBe(2);
      expect(result.enhancedStats.standardDelivered).toBe(2);
      expect(result.enhancedStats.enhancedSequenceCompleted).toBe(2);
      expect(result.config.enhanced).toBe(true);
    });

    it('должен обрабатывать случай отсутствия подходящих пользователей', async () => {
      adminAPI.messageDeliveryAPI.validateBotToken.mockResolvedValue({
        success: true,
        bot: { username: 'test_bot' }
      });

      adminAPI.userDataValidator.getEligibleUsersForEnhancedBroadcast.mockReturnValue({
        success: true,
        users: [],
        totalCount: 0,
        eligibleCount: 0
      });

      adminAPI.logEnhancedAdminMessage = jest.fn();

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, '123456789');

      expect(result.success).toBe(false);
      expect(result.error).toContain('подходящих пользователей');
      expect(adminAPI.logEnhancedAdminMessage).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки валидации бота', async () => {
      adminAPI.messageDeliveryAPI.validateBotToken.mockResolvedValue({
        success: false,
        error: 'Недействительный токен бота'
      });

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, '123456789');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Недействительный токен бота');
    });

    it('должен обрабатывать частичные сбои последовательности', async () => {
      // Настраиваем успешную валидацию и получение пользователей
      adminAPI.messageDeliveryAPI.validateBotToken.mockResolvedValue({
        success: true,
        bot: { username: 'test_bot' }
      });

      adminAPI.userDataValidator.getEligibleUsersForEnhancedBroadcast.mockReturnValue({
        success: true,
        users: [{ telegram_id: '111', full_name: 'Пользователь 1' }],
        totalCount: 5,
        eligibleCount: 1
      });

      adminAPI.messageDeliveryAPI.broadcastMessage.mockResolvedValue({
        success: true,
        results: {
          delivered: 1,
          successful: ['111']
        }
      });

      // Настраиваем частичный сбой последовательности
      adminAPI.messageSequenceProcessor.processUserMessageSequence.mockResolvedValue({
        success: true,
        results: {
          completedSteps: 2,
          totalSteps: 4,
          steps: {
            adminMessage: { success: true },
            usefulInfo: { success: false },
            eventDetails: { success: true },
            menuTrigger: { success: false }
          }
        },
        completionRate: 50
      });

      adminAPI.logEnhancedDeliverySequence = jest.fn().mockResolvedValue();

      const result = await adminAPI.sendEnhancedBroadcast(mockBot, '123456789');

      expect(result.success).toBe(true);
      expect(result.enhancedStats.enhancedSequenceCompleted).toBe(1);
      expect(result.enhancedStats.completionRate).toBeCloseTo(100, 0);
    });
  });

  describe('logEnhancedAdminMessage', () => {
    it('должен корректно логировать улучшенное админское сообщение', () => {
      const messageText = 'Тестовое сообщение';
      const adminUserId = '123456789';
      const enhancedStats = {
        total: 10,
        standardDelivered: 8,
        sequenceFailures: 1,
        completionRate: 80,
        eligibleForEnhanced: 8
      };
      const messageId = 'test_message_123';

      adminAPI.logEnhancedAdminMessage(messageText, adminUserId, enhancedStats, messageId);

      expect(adminAPI.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_messages'),
        expect.arrayContaining([
          messageText,
          'enhanced_broadcast',
          adminUserId,
          10, // total
          8,  // delivered
          1,  // failed
          0,  // blocked
          true, // enhanced_mode
          80, // completion_rate
          8   // eligible_users_count
        ])
      );
    });

    it('должен обрабатывать ошибки логирования', () => {
      adminAPI.executeQuery.mockImplementation(() => {
        throw new Error('Ошибка базы данных');
      });

      // Не должно выбрасывать исключение
      expect(() => {
        adminAPI.logEnhancedAdminMessage('Тест', '123', {}, 'msg_123');
      }).not.toThrow();
    });
  });

  describe('logEnhancedDeliverySequence', () => {
    it('должен корректно логировать последовательность доставки', async () => {
      const userId = '123456789';
      const messageId = 'admin_enhanced_123';
      const sequenceResult = {
        results: {
          sequenceId: 'seq_123',
          steps: {
            adminMessage: { attempted: true, success: true, timestamp: '2025-01-01T00:00:00Z' },
            usefulInfo: { attempted: true, success: true, timestamp: '2025-01-01T00:00:01Z' },
            eventDetails: { attempted: true, success: false, timestamp: '2025-01-01T00:00:02Z' },
            menuTrigger: { attempted: true, success: true, timestamp: '2025-01-01T00:00:03Z' }
          },
          errors: [
            { step: 'eventDetails', error: 'Ошибка получения деталей события' }
          ]
        },
        completionRate: 75
      };

      adminAPI.getOne.mockReturnValue({ id: 1 });

      await adminAPI.logEnhancedDeliverySequence(userId, messageId, sequenceResult);

      // Проверяем, что executeQuery был вызван для каждого шага
      expect(adminAPI.executeQuery).toHaveBeenCalledTimes(4);
      
      // Проверяем параметры для успешного шага
      expect(adminAPI.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enhanced_delivery_logs'),
        expect.arrayContaining([
          1, // user_id
          messageId,
          'adminMessage',
          'delivered',
          'seq_123',
          75,
          null
        ])
      );

      // Проверяем параметры для неудачного шага
      expect(adminAPI.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enhanced_delivery_logs'),
        expect.arrayContaining([
          1, // user_id
          messageId,
          'eventDetails',
          'failed',
          'seq_123',
          75,
          'Ошибка получения деталей события'
        ])
      );
    });

    it('должен обрабатывать случай отсутствия пользователя в базе', async () => {
      adminAPI.getOne.mockReturnValue(null);

      await adminAPI.logEnhancedDeliverySequence('999999', 'msg_123', {
        results: { steps: {} }
      });

      expect(adminAPI.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('delay', () => {
    it('должен корректно выполнять задержку', async () => {
      const startTime = Date.now();
      await adminAPI.delay(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Небольшая погрешность
    });
  });
});

module.exports = {
  AdminAPI
};