/**
 * [RU] Интеграционный тест функции отправки сообщений администратором
 * [EN] Integration test for admin message broadcasting feature
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { AdminAPI } = require('../../features/admin/api');
const { AdminLogic } = require('../../features/admin/logic');
const { MainMenu } = require('../../interface/main-menu');
const { MessageRouter } = require('../../bot/router');

describe('Admin Message Broadcasting Integration', () => {
  let db;
  let adminAPI;
  let adminLogic;
  let mainMenu;
  let testDatabasePath;

  // Mock bot object для тестирования
  const mockBot = {
    telegram: {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 123 })
    }
  };

  // Mock context object
  const createMockCtx = (userId, isCallback = false, callbackData = null) => ({
    from: { id: userId, first_name: 'Test User' },
    callbackQuery: isCallback ? { data: callbackData } : null,
    answerCbQuery: jest.fn().mockResolvedValue(),
    editMessageText: jest.fn().mockResolvedValue(),
    reply: jest.fn().mockResolvedValue(),
    telegram: mockBot.telegram
  });

  beforeEach(() => {
    // Создаем временную базу данных для тестов
    testDatabasePath = path.join(__dirname, '../tmp', `test_admin_broadcast_${Date.now()}.db`);
    
    // Создаем директорию для временных файлов если не существует
    const tmpDir = path.dirname(testDatabasePath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    db = new Database(testDatabasePath);
    
    // Инициализируем схему базы данных
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Создаем тестовые компоненты
    adminAPI = new AdminAPI(db);
    adminLogic = new AdminLogic(db);
    mainMenu = new MainMenu(db);

    // Устанавливаем тестового администратора
    process.env.ADMIN_ID = '123456789';

    // Очищаем моки
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    
    // Удаляем временный файл базы данных
    if (fs.existsSync(testDatabasePath)) {
      fs.unlinkSync(testDatabasePath);
    }
  });

  describe('AdminAPI.sendTestMessage()', () => {
    test('should successfully send test message to users', async () => {
      // Создаем тестовых пользователей
      const insertUserQuery = `
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `;
      
      db.prepare(insertUserQuery).run('111111111', 'Тестовый Пользователь 1', 'attending');
      db.prepare(insertUserQuery).run('222222222', 'Тестовый Пользователь 2', 'attending');
      db.prepare(insertUserQuery).run('333333333', 'Тестовый Пользователь 3', 'not_attending');

      const result = await adminAPI.sendTestMessage(mockBot, '123456789');

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('admin_test_');
      expect(result.deliveryStats).toEqual({
        total: 3,
        delivered: 3,
        failed: 0,
        blocked: 0
      });
      expect(result.duration).toContain('сек');

      // Проверяем, что запись создана в admin_messages
      const adminMessage = db.prepare(`
        SELECT * FROM admin_messages WHERE sent_by = ? ORDER BY sent_at DESC LIMIT 1
      `).get('123456789');

      expect(adminMessage).toBeTruthy();
      expect(adminMessage.message_text).toBe('Это тестовое сообщение. Если ты его видишь, то напиши Максиму');
      expect(adminMessage.message_type).toBe('test_message');
      expect(adminMessage.total_recipients).toBe(3);
      expect(adminMessage.delivered_count).toBe(3);

      // Проверяем количество вызовов sendMessage
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should handle case with no users', async () => {
      const result = await adminAPI.sendTestMessage(mockBot, '123456789');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Нет пользователей');
      expect(result.deliveryStats.total).toBe(0);
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    test('should handle unauthorized user', async () => {
      // Создаем неавторизованного пользователя
      const ctx = createMockCtx('999999999');
      
      const result = await adminLogic.handleAdminMessage(ctx, mockBot);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('нет прав'));
    });
  });

  describe('AdminLogic.handleAdminMessage()', () => {
    test('should show message sending panel for admin', async () => {
      // Создаем тестового пользователя для получения статистики
      const insertUserQuery = `
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `;
      db.prepare(insertUserQuery).run('111111111', 'Тестовый Пользователь 1', 'attending');

      const ctx = createMockCtx('123456789');
      ctx.editMessageText = jest.fn().mockResolvedValue();
      ctx.sendMessage = jest.fn().mockResolvedValue();

      const result = await adminLogic.handleAdminMessage(ctx, mockBot);

      expect(result.success).toBe(true);
      expect(result.userCount).toBe(1);
    });
  });

  describe('AdminLogic.confirmMessageSending()', () => {
    test('should successfully confirm and send message', async () => {
      // Создаем тестового пользователя
      const insertUserQuery = `
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `;
      db.prepare(insertUserQuery).run('111111111', 'Тестовый Пользователь 1', 'attending');

      const ctx = createMockCtx('123456789', true, 'admin_confirm_send');

      const result = await adminLogic.confirmMessageSending(ctx, mockBot);

      expect(result.success).toBe(true);
      expect(ctx.editMessageText).toHaveBeenCalled();
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
    });
  });

  describe('AdminLogic.cancelMessageSending()', () => {
    test('should successfully cancel message sending', async () => {
      const ctx = createMockCtx('123456789', true, 'admin_cancel_send');

      const result = await adminLogic.cancelMessageSending(ctx);

      expect(result.success).toBe(true);
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('отменена'),
        expect.any(Object)
      );
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe('MainMenu admin button integration', () => {
    test('should include admin message button for admin users', () => {
      const menuItems = mainMenu.generateMenuItems('123456789');
      
      const adminMessageButton = menuItems.find(item => 
        item.callback_data === 'admin_send_test_message'
      );
      
      expect(adminMessageButton).toBeTruthy();
      expect(adminMessageButton.text).toContain('тестовое сообщение');
    });

    test('should not include admin message button for regular users', () => {
      const menuItems = mainMenu.generateMenuItems('999999999');
      
      const adminMessageButton = menuItems.find(item => 
        item.callback_data === 'admin_send_test_message'
      );
      
      expect(adminMessageButton).toBeUndefined();
    });

    test('should handle admin_send_test_message callback', async () => {
      // Создаем тестового пользователя для статистики
      const insertUserQuery = `
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `;
      db.prepare(insertUserQuery).run('111111111', 'Тестовый Пользователь 1', 'attending');

      const ctx = createMockCtx('123456789', true, 'admin_send_test_message');
      ctx.sendMessage = jest.fn().mockResolvedValue();

      const result = await mainMenu.handleCallback(ctx, 'admin_send_test_message');

      expect(result.success).toBe(true);
    });
  });

  describe('AdminAPI.getTestMessageHistory()', () => {
    test('should retrieve message history correctly', async () => {
      // Создаем тестовую запись в admin_messages
      const insertQuery = `
        INSERT INTO admin_messages (
          message_text, message_type, sent_by, total_recipients, 
          delivered_count, failed_count, blocked_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.prepare(insertQuery).run(
        'Тестовое сообщение',
        'test_message', 
        '123456789',
        10, 8, 1, 1
      );

      const result = await adminAPI.getTestMessageHistory(5);

      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].messageText).toBe('Тестовое сообщение');
      expect(result.history[0].sentBy).toBe('123456789');
      expect(result.history[0].deliveryStats.total).toBe(10);
      expect(result.history[0].deliveryStats.delivered).toBe(8);
      expect(result.history[0].deliveryStats.deliveryRate).toBe(80);
    });

    test('should return empty history when no messages exist', async () => {
      const result = await adminAPI.getTestMessageHistory();

      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      // Закрываем базу данных чтобы вызвать ошибку
      db.close();
      
      const result = await adminAPI.sendTestMessage(mockBot, '123456789');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test('should handle Telegram API errors', async () => {
      // Создаем пользователя
      const insertUserQuery = `
        INSERT INTO users (telegram_id, full_name, attendance_status) 
        VALUES (?, ?, ?)
      `;
      db.prepare(insertUserQuery).run('111111111', 'Тестовый Пользователь 1', 'attending');

      // Мокаем ошибку Telegram API
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Telegram API Error'));

      const result = await adminAPI.sendTestMessage(mockBot, '123456789');

      expect(result.success).toBe(true); // Система должна продолжать работать даже при ошибках отправки
      expect(result.deliveryStats.failed).toBe(1);
      expect(result.deliveryStats.delivered).toBe(0);
    });
  });
});