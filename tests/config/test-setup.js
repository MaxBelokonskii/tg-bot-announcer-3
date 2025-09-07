/**
 * [RU] Настройка окружения для тестов
 * [EN] Test environment setup
 */

// Установка переменных окружения для тестов
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Минимальное логирование в тестах

// Мокинг Telegram API если необходимо
global.mockTelegramContext = {
  from: { id: 'test_user_123', first_name: 'Test User' },
  chat: { id: 'test_chat_123' },
  answerCbQuery: jest.fn(() => Promise.resolve()),
  reply: jest.fn(() => Promise.resolve()),
  editMessageText: jest.fn(() => Promise.resolve()),
  editMessageReplyMarkup: jest.fn(() => Promise.resolve())
};

// Настройка глобальных моков если нужно
global.console = {
  ...console,
  // Отключаем избыточное логирование в тестах, кроме ошибок
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Оставляем ошибки видимыми
};

// Увеличиваем таймаут для долгих операций с базой данных
jest.setTimeout(30000);