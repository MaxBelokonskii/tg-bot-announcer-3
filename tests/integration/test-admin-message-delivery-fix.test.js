/**
 * [RU] Интеграционные тесты для исправления доставки админских сообщений
 * [EN] Integration tests for admin message delivery fix
 */

const { DatabaseConnection } = require('../../database/connection');
const { AdminAPI } = require('../../features/admin/api');
const { MessageDeliveryAPI } = require('../../features/message-delivery/api');

// Мок бота для тестирования
const mockBot = {
  telegram: {
    getMe: jest.fn(),
    sendMessage: jest.fn()
  }
};

// Мок данных пользователей
const mockUsers = [
  { id: 1, telegram_id: '12345', full_name: 'Test User 1' },
  { id: 2, telegram_id: '67890', full_name: 'Test User 2' },
  { id: 3, telegram_id: '54321', full_name: 'Test User 3' }
];

describe('Admin Message Delivery Fix', () => {
  let database;
  let adminAPI;
  let messageDeliveryAPI;

  beforeEach(() => {
    // Создаем тестовую базу данных
    database = new DatabaseConnection(':memory:');
    database.connect();
    
    // Инициализируем API
    adminAPI = new AdminAPI(database.getDatabase());
    messageDeliveryAPI = new MessageDeliveryAPI(database.getDatabase());

    // Сбрасываем моки
    jest.clearAllMocks();

    // Настраиваем мок бота
    mockBot.telegram.getMe.mockResolvedValue({
      id: 123456789,
      username: 'test_bot',
      first_name: 'Test Bot'
    });
  });

  afterEach(() => {
    if (database) {
      database.close();
    }
  });

  describe('MessageDeliveryAPI.isAdminMessage', () => {
    test('должен правильно определять админские сообщения', () => {
      expect(messageDeliveryAPI.isAdminMessage('admin_test_123')).toBe(true);
      expect(messageDeliveryAPI.isAdminMessage('admin_diagnostic')).toBe(true);
      expect(messageDeliveryAPI.isAdminMessage('admin_broadcast_456')).toBe(true);
      expect(messageDeliveryAPI.isAdminMessage('regular_message_789')).toBe(false);
      expect(messageDeliveryAPI.isAdminMessage('123')).toBe(false);
      expect(messageDeliveryAPI.isAdminMessage(null)).toBe(false);
      expect(messageDeliveryAPI.isAdminMessage(undefined)).toBe(false);
    });
  });

  describe('MessageDeliveryAPI.categorizeError', () => {
    test('должен правильно категоризировать ошибки Telegram API', () => {
      const blockedError = new Error('Forbidden: bot was blocked by the user');
      expect(messageDeliveryAPI.categorizeError(blockedError)).toBe('blocked');

      const notFoundError = new Error('Bad Request: chat not found');
      expect(messageDeliveryAPI.categorizeError(notFoundError)).toBe('failed');

      const rateLimitError = new Error('Too Many Requests: retry after 5');
      rateLimitError.code = 429;
      expect(messageDeliveryAPI.categorizeError(rateLimitError)).toBe('rate_limited');

      const badRequestError = new Error('Bad Request: message text is empty');
      badRequestError.code = 400;
      expect(messageDeliveryAPI.categorizeError(badRequestError)).toBe('failed');

      const networkError = new Error('Network error');
      expect(messageDeliveryAPI.categorizeError(networkError)).toBe('failed');
    });
  });

  describe('MessageDeliveryAPI.validateBotToken', () => {
    test('должен успешно валидировать корректный токен', async () => {
      const result = await messageDeliveryAPI.validateBotToken(mockBot);
      
      expect(result.success).toBe(true);
      expect(result.bot).toEqual({
        id: 123456789,
        username: 'test_bot',
        first_name: 'Test Bot'
      });
      expect(mockBot.telegram.getMe).toHaveBeenCalledTimes(1);
    });

    test('должен обработать ошибку валидации токена', async () => {
      mockBot.telegram.getMe.mockRejectedValue(new Error('Invalid token'));
      
      const result = await messageDeliveryAPI.validateBotToken(mockBot);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('MessageDeliveryAPI.sendToUser with admin messages', () => {
    beforeEach(() => {
      // Добавляем пользователей в базу
      mockUsers.forEach(user => {
        database.getDatabase().prepare(`
          INSERT INTO users (id, telegram_id, full_name) 
          VALUES (?, ?, ?)
        `).run(user.id, user.telegram_id, user.full_name);
      });
    });

    test('должен отправлять админские сообщения без логирования в delivery_logs', async () => {
      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await messageDeliveryAPI.sendToUser(
        mockBot,
        '12345',
        'Тестовое админское сообщение',
        'admin_test_123'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');

      // Проверяем, что запись в delivery_logs НЕ создана
      const logs = database.getDatabase().prepare('SELECT * FROM delivery_logs').all();
      expect(logs).toHaveLength(0);
    });

    test('должен отправлять обычные сообщения с логированием в delivery_logs', async () => {
      // Сначала создаем запись в scheduled_messages
      const messageResult = database.getDatabase().prepare(`
        INSERT INTO scheduled_messages (id, message_text, send_date) 
        VALUES (?, ?, ?)
      `).run(1, 'Обычное сообщение', new Date().toISOString());

      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await messageDeliveryAPI.sendToUser(
        mockBot,
        '12345',
        'Обычное сообщение',
        1 // Обычный messageId
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');

      // Проверяем, что запись в delivery_logs создана
      const logs = database.getDatabase().prepare('SELECT * FROM delivery_logs').all();
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('delivered');
    });

    test('должен обрабатывать ошибки админских сообщений без логирования', async () => {
      mockBot.telegram.sendMessage.mockRejectedValue(
        new Error('Forbidden: bot was blocked by the user')
      );

      const result = await messageDeliveryAPI.sendToUser(
        mockBot,
        '12345',
        'Тестовое админское сообщение',
        'admin_test_123'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');

      // Проверяем, что запись в delivery_logs НЕ создана
      const logs = database.getDatabase().prepare('SELECT * FROM delivery_logs').all();
      expect(logs).toHaveLength(0);
    });
  });

  describe('AdminAPI.sendTestMessage integration', () => {
    beforeEach(() => {
      // Добавляем пользователей в базу
      mockUsers.forEach(user => {
        database.getDatabase().prepare(`
          INSERT INTO users (id, telegram_id, full_name) 
          VALUES (?, ?, ?)
        `).run(user.id, user.telegram_id, user.full_name);
      });
    });

    test('должен успешно отправлять тестовые сообщения', async () => {
      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await adminAPI.sendTestMessage(mockBot, 'admin123');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^admin_test_\d+$/);
      expect(result.deliveryStats.total).toBe(3);
      expect(result.deliveryStats.delivered).toBe(3);
      expect(result.deliveryStats.failed).toBe(0);
      expect(result.deliveryStats.blocked).toBe(0);

      // Проверяем создание записи в admin_messages
      const adminMessages = database.getDatabase().prepare('SELECT * FROM admin_messages').all();
      expect(adminMessages).toHaveLength(1);
      expect(adminMessages[0].message_type).toBe('test_message');
      expect(adminMessages[0].sent_by).toBe('admin123');
      expect(adminMessages[0].delivered_count).toBe(3);

      // Проверяем, что НЕТ записей в delivery_logs
      const logs = database.getDatabase().prepare('SELECT * FROM delivery_logs').all();
      expect(logs).toHaveLength(0);
    });

    test('должен обрабатывать частичные неудачи доставки', async () => {
      // Первые два сообщения успешны, третье заблокировано
      mockBot.telegram.sendMessage
        .mockResolvedValueOnce({ message_id: 123 })
        .mockResolvedValueOnce({ message_id: 124 })
        .mockRejectedValueOnce(new Error('Forbidden: bot was blocked by the user'));

      const result = await adminAPI.sendTestMessage(mockBot, 'admin123');

      expect(result.success).toBe(true);
      expect(result.deliveryStats.total).toBe(3);
      expect(result.deliveryStats.delivered).toBe(2);
      expect(result.deliveryStats.failed).toBe(1);
      expect(result.deliveryStats.blocked).toBe(1);

      // Проверяем запись в admin_messages
      const adminMessages = database.getDatabase().prepare('SELECT * FROM admin_messages').all();
      expect(adminMessages).toHaveLength(1);
      expect(adminMessages[0].delivered_count).toBe(2);
      expect(adminMessages[0].failed_count).toBe(1);
      expect(adminMessages[0].blocked_count).toBe(1);
    });

    test('должен обрабатывать ошибку валидации бота', async () => {
      mockBot.telegram.getMe.mockRejectedValue(new Error('Invalid token'));

      const result = await adminAPI.sendTestMessage(mockBot, 'admin123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ошибка валидации бота');
    });

    test('должен обрабатывать отсутствие пользователей', async () => {
      // Очищаем таблицу пользователей
      database.getDatabase().prepare('DELETE FROM users').run();

      const result = await adminAPI.sendTestMessage(mockBot, 'admin123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Нет пользователей для отправки сообщений');
      expect(result.deliveryStats.total).toBe(0);
    });
  });

  describe('MessageDeliveryAPI.sendDiagnosticMessage', () => {
    test('должен отправлять диагностическое сообщение администратору', async () => {
      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await messageDeliveryAPI.sendDiagnosticMessage(
        mockBot, 
        'admin123',
        'Тест диагностики'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        'admin123',
        'Тест диагностики',
        expect.objectContaining({
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      );
    });
  });
});