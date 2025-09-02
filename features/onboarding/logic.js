/**
 * [RU] Бизнес-логика модуля онбординга пользователей
 * [EN] User onboarding business logic
 */

const texts = require('../../bot/texts');
const { formatUserName } = require('../../utils/format-utils');
const { logUserAction, safeSendMessage, createKeyboard } = require('../../utils/message-helpers');
const { OnboardingAPI } = require('./api');

/**
 * [RU] Основной класс для логики онбординга
 * [EN] Main onboarding logic class
 */
class OnboardingLogic {
  constructor(database) {
    this.api = new OnboardingAPI(database);
    // Состояние пользователей в процессе регистрации
    this.userStates = new Map();
  }

  /**
   * [RU] Обработка команды /start
   * [EN] Handle /start command
   */
  async handleStartCommand(ctx) {
    try {
      const telegramId = ctx.from.id.toString();
      const userExists = await this.api.userExists(telegramId);

      logUserAction(ctx, 'start_command', { userExists });

      if (userExists) {
        return await this.handleExistingUser(ctx);
      } else {
        return await this.startOnboarding(ctx);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки команды /start:', error.message);
      await safeSendMessage(
        ctx, 
        texts.errors.general,
        null,
        { parseMode: 'HTML' }
      );
    }
  }

  /**
   * [RU] Обработка существующего пользователя
   * [EN] Handle existing user
   */
  async handleExistingUser(ctx) {
    const telegramId = ctx.from.id.toString();
    const userResult = await this.api.getUser(telegramId);
    
    if (!userResult) {
      // Странная ситуация - пользователь должен существовать
      return await this.startOnboarding(ctx);
    }

    const welcomeText = texts.formatText(texts.welcome.alreadyRegistered, {
      name: userResult.full_name
    });

    // Создаем клавиатуру с основными функциями
    const keyboard = createKeyboard([
      '📅 Предстоящие события',
      '💬 Мои ответы',
      '⚙️ Настройки',
      '❓ Помощь'
    ], { columns: 2 });

    await safeSendMessage(ctx, welcomeText, keyboard, { parseMode: 'HTML' });
    
    logUserAction(ctx, 'existing_user_welcomed', {
      userId: userResult.id,
      fullName: userResult.full_name
    });

    return { success: true, user: userResult, isNewUser: false };
  }

  /**
   * [RU] Начало процесса онбординга
   * [EN] Start onboarding process
   */
  async startOnboarding(ctx) {
    const telegramId = ctx.from.id.toString();
    
    // Устанавливаем состояние пользователя
    this.userStates.set(telegramId, {
      step: 'awaiting_name',
      startedAt: new Date()
    });

    // Приветственное сообщение
    const welcomeMessage = `${texts.welcome.title}\n\n${texts.welcome.greeting}\n\n${texts.welcome.namePrompt}`;
    
    await safeSendMessage(ctx, welcomeMessage, null, { parseMode: 'HTML' });
    
    logUserAction(ctx, 'onboarding_started');

    return { success: true, step: 'awaiting_name' };
  }

  /**
   * [RU] Обработка сообщений во время онбординга
   * [EN] Handle messages during onboarding
   */
  async handleOnboardingMessage(ctx) {
    const telegramId = ctx.from.id.toString();
    const userState = this.userStates.get(telegramId);

    if (!userState) {
      // Пользователь не в процессе онбординга
      return { success: false, error: 'Пользователь не в процессе онбординга' };
    }

    switch (userState.step) {
      case 'awaiting_name':
        return await this.handleNameInput(ctx);
      default:
        return { success: false, error: 'Неизвестный шаг онбординга' };
    }
  }

  /**
   * [RU] Обработка ввода имени пользователя
   * [EN] Handle user name input
   */
  async handleNameInput(ctx) {
    const telegramId = ctx.from.id.toString();
    const userName = ctx.message?.text?.trim();

    // Валидация имени
    if (!userName || userName.length < 2) {
      await safeSendMessage(
        ctx, 
        'Пожалуйста, введите корректное имя (минимум 2 символа):',
        null,
        { parseMode: 'HTML' }
      );
      return { success: false, error: 'Некорректное имя' };
    }

    if (userName.length > 50) {
      await safeSendMessage(
        ctx, 
        'Слишком длинное имя. Пожалуйста, введите имя покороче (до 50 символов):',
        null,
        { parseMode: 'HTML' }
      );
      return { success: false, error: 'Слишком длинное имя' };
    }

    // Проверяем на команды или специальные символы
    if (userName.startsWith('/') || userName.includes('@')) {
      await safeSendMessage(
        ctx, 
        'Пожалуйста, введите обычное имя без команд и специальных символов:',
        null,
        { parseMode: 'HTML' }
      );
      return { success: false, error: 'Недопустимые символы в имени' };
    }

    try {
      // Создаем пользователя
      const createResult = await this.api.createUser(telegramId, userName);
      
      if (!createResult.success) {
        await safeSendMessage(
          ctx, 
          texts.errors.database,
          null,
          { parseMode: 'HTML' }
        );
        return createResult;
      }

      // Убираем пользователя из состояния онбординга
      this.userStates.delete(telegramId);

      // Отправляем подтверждение регистрации
      const confirmationText = texts.formatText(texts.welcome.nameConfirm, {
        name: userName
      });
      
      await safeSendMessage(ctx, confirmationText, null, { parseMode: 'HTML' });

      // Отправляем завершающее сообщение с меню
      await this.completeOnboarding(ctx, createResult.user);

      logUserAction(ctx, 'onboarding_completed', {
        userId: createResult.user.id,
        fullName: createResult.user.full_name
      });

      return { 
        success: true, 
        user: createResult.user, 
        isNewUser: true 
      };
    } catch (error) {
      console.error('❌ Ошибка создания пользователя:', error.message);
      
      await safeSendMessage(
        ctx, 
        texts.errors.general,
        null,
        { parseMode: 'HTML' }
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Завершение процесса онбординга
   * [EN] Complete onboarding process
   */
  async completeOnboarding(ctx, user) {
    // Создаем главное меню
    const keyboard = createKeyboard([
      '📅 Предстоящие события',
      '💬 Мои ответы',
      '⚙️ Настройки',
      '❓ Помощь'
    ], { columns: 2 });

    const completionText = `${texts.welcome.registrationComplete}\n\n${texts.menu.description}`;

    await safeSendMessage(ctx, completionText, keyboard, { parseMode: 'HTML' });
  }

  /**
   * [RU] Проверка, находится ли пользователь в процессе онбординга
   * [EN] Check if user is in onboarding process
   */
  isUserOnboarding(telegramId) {
    return this.userStates.has(telegramId.toString());
  }

  /**
   * [RU] Получение состояния онбординга пользователя
   * [EN] Get user onboarding state
   */
  getUserOnboardingState(telegramId) {
    return this.userStates.get(telegramId.toString());
  }

  /**
   * [RU] Отмена процесса онбординга
   * [EN] Cancel onboarding process
   */
  async cancelOnboarding(ctx) {
    const telegramId = ctx.from.id.toString();
    
    if (this.userStates.has(telegramId)) {
      this.userStates.delete(telegramId);
      
      await safeSendMessage(
        ctx, 
        'Регистрация отменена. Чтобы начать заново, нажмите /start',
        null,
        { parseMode: 'HTML' }
      );

      logUserAction(ctx, 'onboarding_cancelled');
      
      return { success: true };
    }
    
    return { success: false, error: 'Пользователь не в процессе онбординга' };
  }

  /**
   * [RU] Очистка старых состояний онбординга (вызывается периодически)
   * [EN] Clean up old onboarding states (called periodically)
   */
  cleanupOldStates() {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 минут

    for (const [telegramId, state] of this.userStates.entries()) {
      if (now - state.startedAt > maxAge) {
        this.userStates.delete(telegramId);
        console.log(`🧹 Очищено старое состояние онбординга для пользователя: ${telegramId}`);
      }
    }
  }

  /**
   * [RU] Получение статистики онбординга
   * [EN] Get onboarding statistics
   */
  getOnboardingStats() {
    const activeOnboardings = this.userStates.size;
    const stateDetails = Array.from(this.userStates.entries()).map(([telegramId, state]) => ({
      telegramId,
      step: state.step,
      duration: new Date() - state.startedAt
    }));

    return {
      activeOnboardings,
      stateDetails
    };
  }
}

module.exports = {
  OnboardingLogic
};