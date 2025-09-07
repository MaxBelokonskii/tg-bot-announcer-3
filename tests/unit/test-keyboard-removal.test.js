/**
 * [RU] Тесты для проверки удаления Reply Keyboard
 * [EN] Tests for Reply Keyboard removal functionality
 */

// Мокаем зависимости перед импортом
jest.mock('../../utils/message-helpers', () => ({
  ...jest.requireActual('../../utils/message-helpers'),
  safeSendMessage: jest.fn().mockResolvedValue({ success: true }),
  logUserAction: jest.fn(),
  createKeyboard: jest.fn()
}));

// Мокаем texts
jest.mock('../../bot/texts', () => ({
  formatText: jest.fn((template, vars) => template.replace(/{(\w+)}/g, (match, key) => vars[key] || match)),
  welcome: {
    alreadyRegistered: 'Добро пожаловать, {name}!',
    registrationComplete: '✅ Регистрация завершена!',
    nameConfirm: 'Приятно познакомиться, {name}!'
  },
  menu: {
    description: 'Используйте меню для навигации'
  },
  errors: {
    general: 'Произошла ошибка'
  }
}));

// Мокаем OnboardingAPI
jest.mock('../../features/onboarding/api', () => ({
  OnboardingAPI: jest.fn().mockImplementation(() => ({
    userExists: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    syncTelegramUsername: jest.fn()
  }))
}));

const { OnboardingLogic } = require('../../features/onboarding/logic');
const { createKeyboard } = require('../../utils/message-helpers');

describe('Reply Keyboard Removal Tests', () => {
  let onboardingLogic;
  let mockCtx;
  let mockAPI;

  beforeEach(() => {
    // Создаем мок API
    mockAPI = {
      userExists: jest.fn(),
      getUser: jest.fn(),
      createUser: jest.fn(),
      syncTelegramUsername: jest.fn()
    };
    
    // Создаем новый экземпляр для каждого теста
    onboardingLogic = new OnboardingLogic(mockAPI);
    
    // Заменяем API в экземпляре
    onboardingLogic.api = mockAPI;
    
    // Сбрасываем все моки
    jest.clearAllMocks();
    
    // Создаем мок контекста
    mockCtx = {
      from: {
        id: 12345,
        username: 'testuser',
        first_name: 'Test'
      },
      chat: {
        id: 12345
      },
      reply: jest.fn().mockResolvedValue({ message_id: 1 })
    };
  });

  describe('handleExistingUser', () => {
    it('should not create Reply Keyboard for existing users', async () => {
      // Подготовка
      mockAPI.userExists.mockResolvedValue(true);
      mockAPI.getUser.mockResolvedValue({
        id: 1,
        full_name: 'Тестовый Пользователь',
        telegram_id: '12345'
      });
      mockAPI.syncTelegramUsername.mockResolvedValue();

      // Выполнение
      const result = await onboardingLogic.handleExistingUser(mockCtx);

      // Проверка
      expect(result.success).toBe(true);
      expect(createKeyboard).not.toHaveBeenCalled();
      
      // Проверяем, что safeSendMessage вызвана с null вместо клавиатуры
      const { safeSendMessage } = require('../../utils/message-helpers');
      expect(safeSendMessage).toHaveBeenCalledWith(
        mockCtx,
        expect.stringContaining('📋 Используйте команду /menu'),
        null,
        { parseMode: 'HTML' }
      );
    });

    it('should include /menu instruction in message text', async () => {
      // Подготовка
      mockAPI.userExists.mockResolvedValue(true);
      mockAPI.getUser.mockResolvedValue({
        id: 1,
        full_name: 'Тестовый Пользователь',
        telegram_id: '12345'
      });
      mockAPI.syncTelegramUsername.mockResolvedValue();

      // Выполнение
      await onboardingLogic.handleExistingUser(mockCtx);

      // Проверка
      const { safeSendMessage } = require('../../utils/message-helpers');
      const calledArgs = safeSendMessage.mock.calls[0];
      const messageText = calledArgs[1];
      
      expect(messageText).toContain('📋 Используйте команду /menu для доступа к функциям бота');
    });
  });

  describe('completeOnboarding', () => {
    it('should not create Reply Keyboard after onboarding completion', async () => {
      // Подготовка
      const mockUser = {
        id: 1,
        full_name: 'Новый Пользователь',
        telegram_id: '12345'
      };

      // Выполнение
      await onboardingLogic.completeOnboarding(mockCtx, mockUser);

      // Проверка
      expect(createKeyboard).not.toHaveBeenCalled();
      
      // Проверяем, что safeSendMessage вызвана с null вместо клавиатуры
      const { safeSendMessage } = require('../../utils/message-helpers');
      expect(safeSendMessage).toHaveBeenCalledWith(
        mockCtx,
        expect.stringContaining('📋 Используйте команду /menu'),
        null,
        { parseMode: 'HTML' }
      );
    });

    it('should include /menu instruction in completion message', async () => {
      // Подготовка
      const mockUser = {
        id: 1,
        full_name: 'Новый Пользователь',
        telegram_id: '12345'
      };

      // Выполнение
      await onboardingLogic.completeOnboarding(mockCtx, mockUser);

      // Проверка
      const { safeSendMessage } = require('../../utils/message-helpers');
      const calledArgs = safeSendMessage.mock.calls[0];
      const messageText = calledArgs[1];
      
      expect(messageText).toContain('📋 Используйте команду /menu для доступа к функциям');
    });
  });

  describe('createKeyboard deprecation', () => {
    it('should log deprecation warning when createKeyboard is called', () => {
      // Мокаем console.warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Используем реальную функцию
      const { createKeyboard: realCreateKeyboard } = jest.requireActual('../../utils/message-helpers');
      
      // Выполнение
      realCreateKeyboard(['Test Button']);

      // Проверка
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ createKeyboard deprecated. Use createInlineKeyboard instead.');
      
      // Восстанавливаем console.warn
      consoleSpy.mockRestore();
    });
  });

  describe('Integration test for onboarding flow', () => {
    it('should complete onboarding flow without Reply Keyboard', async () => {
      // Подготовка данных для нового пользователя
      mockAPI.userExists.mockResolvedValue(false);
      mockAPI.createUser.mockResolvedValue({
        success: true,
        user: {
          id: 1,
          full_name: 'Новый Пользователь',
          telegram_id: '12345',
          username: 'testuser'
        }
      });

      // Имитируем ввод текстового сообщения с именем
      const nameCtx = {
        ...mockCtx,
        message: { text: 'Новый Пользователь' }
      };

      // Выполнение: начинаем онбординг
      const startResult = await onboardingLogic.startOnboarding(mockCtx);
      expect(startResult.success).toBe(true);

      // Выполнение: завершаем онбординг с вводом имени
      const nameResult = await onboardingLogic.handleOnboardingMessage(nameCtx);
      expect(nameResult.success).toBe(true);

      // Проверка: createKeyboard не должна вызываться в процессе онбординга
      expect(createKeyboard).not.toHaveBeenCalled();

      // Проверка: все сообщения должны быть отправлены с null клавиатурой
      const { safeSendMessage } = require('../../utils/message-helpers');
      const calls = safeSendMessage.mock.calls;
      
      calls.forEach(call => {
        const keyboard = call[2]; // Третий аргумент - клавиатура
        expect(keyboard).toBeNull();
      });

      // Проверка: последнее сообщение должно содержать инструкцию /menu
      const lastCall = calls[calls.length - 1];
      const lastMessageText = lastCall[1];
      expect(lastMessageText).toContain('📋 Используйте команду /menu');
    });
  });
});